import miniGL, { MiniNode } from "../../miniGL.js";
import LenseDistortionNode from "./lenseDistortionNode.js";

// Simple saturation shader
export const saturationShader = `#version 300 es
precision highp float;
uniform sampler2D glTexture;
uniform float uSaturation;
in vec2 glUV;
out vec4 fragColor;

void main() {
  vec4 color = texture(glTexture, glUV);
  
  // Convert to grayscale
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  
  // Mix between grayscale and original based on saturation
  vec3 saturated = mix(vec3(gray), color.rgb, uSaturation);
  
  fragColor = vec4(saturated, color.a);
}`;

// Factory function that creates a multi-node effect: Saturation → Lens Distortion
export function SaturatedLenseNode(gl, uniforms = {}, nodeOptions = {}) {
  const {
    // Saturation uniforms
    saturation = 1.0,

    // Lens distortion uniforms
    intensity = 1.0,
    radius = 1.0,
    distortion = 10.0,
    dispersion = 0.95,
    position = [0.5, 0.5],
    useMouse = position === "mouse",
    useMasked = false,
  } = uniforms;

  // Create the saturation node (first in chain)
  const saturationNode = gl.shader(
    saturationShader,
    {
      uSaturation: saturation,
    },
    {
      name: nodeOptions.name ? `${nodeOptions.name}_Saturation` : "Saturation",
      ...nodeOptions,
    }
  );

  // Create the lens distortion node (second in chain)
  const lensNode = LenseDistortionNode(
    gl,
    {
      intensity,
      radius,
      distortion,
      dispersion,
      position,
      useMouse,
      useMasked,
    },
    {
      name: nodeOptions.name ? `${nodeOptions.name}_Lens` : "Lens Distortion",
      ...nodeOptions,
    }
  );

  // Connect saturation → lens distortion internally
  lensNode.connect("glTexture", saturationNode);

  // Create mini node that wraps the entire chain
  const mini = new MiniNode(gl, lensNode, {
    name: nodeOptions.name || "Saturated Lens",
    internalNodes: [saturationNode, lensNode], // Process order: saturation first, then lens
  });

  // Map external inputs - main texture goes to saturation (start of chain)
  mini.input("glTexture", saturationNode, "glTexture");
  mini.input("uTexture", saturationNode, "glTexture");

  // Map masked input to lens distortion node
  mini.input("uMasked", lensNode, "uMasked");

  // Map uniforms to their respective nodes
  mini.uniform("saturation", saturationNode, "uSaturation");
  mini.uniform("intensity", lensNode, "intensity");
  mini.uniform("radius", lensNode, "radius");
  mini.uniform("distortion", lensNode, "distortion");
  mini.uniform("dispersion", lensNode, "dispersion");
  mini.uniform("position", lensNode, "position");
  mini.uniform("useMouse", lensNode, "useMouse");
  mini.uniform("useMasked", lensNode, "useMasked");

  // Set up custom connection handling for masked input
  mini
    .onConnect((inputName, sourceNode, outputName) => {
      if (inputName === "uMasked") {
        mini.updateUniform("useMasked", true);
      }
    })
    .onDisconnect((inputName) => {
      if (inputName === "uMasked") {
        mini.updateUniform("useMasked", false);
      }
    });

  // Add convenient helper methods
  mini.helper("setSaturation", function (value) {
    return this.updateUniform("saturation", value);
  });

  mini.helper("setMaskedInput", function (sourceNode) {
    return this.connect("uMasked", sourceNode);
  });

  mini.helper("enableMouse", function () {
    return this.updateUniform("useMouse", true);
  });

  mini.helper("setPosition", function (x, y) {
    return this.updateUniform("position", [x, y]);
  });

  return mini;
}

export default SaturatedLenseNode;
