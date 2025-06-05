import ProxyNode from "../ProxyNode.js";
import { LenseDistortionNode } from "./lenseDistortionNode.js";

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

  // Create proxy that wraps the entire chain
  const proxy = new ProxyNode(gl, lensNode, {
    name: nodeOptions.name || "Saturated Lens",
    internalNodes: [saturationNode, lensNode], // Process order: saturation first, then lens
  });

  // Map external inputs - main texture goes to saturation (start of chain)
  proxy.mapInput("glTexture", saturationNode, "glTexture");
  proxy.mapInput("uTexture", saturationNode, "glTexture");

  // Map masked input to lens distortion node
  proxy.mapInput("uMasked", lensNode, "uMasked");

  // Map uniforms to their respective nodes
  proxy.mapUniform("saturation", saturationNode, "uSaturation");
  proxy.mapUniform("intensity", lensNode, "intensity");
  proxy.mapUniform("radius", lensNode, "radius");
  proxy.mapUniform("distortion", lensNode, "distortion");
  proxy.mapUniform("dispersion", lensNode, "dispersion");
  proxy.mapUniform("position", lensNode, "position");
  proxy.mapUniform("useMouse", lensNode, "useMouse");
  proxy.mapUniform("useMasked", lensNode, "useMasked");

  // Set up custom connection handling for masked input
  proxy.setConnectionHandler(
    // onConnect
    (inputName, sourceNode, outputName) => {
      if (inputName === "uMasked") {
        proxy.updateUniform("useMasked", true);
      }
    },
    // onDisconnect
    (inputName) => {
      if (inputName === "uMasked") {
        proxy.updateUniform("useMasked", false);
      }
    }
  );

  // Add convenient helper methods
  proxy.addHelperMethod("setSaturation", function (value) {
    return this.updateUniform("saturation", value);
  });

  proxy.addHelperMethod("setMaskedInput", function (sourceNode) {
    return this.connect("uMasked", sourceNode);
  });

  proxy.addHelperMethod("enableMouse", function () {
    return this.updateUniform("useMouse", true);
  });

  proxy.addHelperMethod("setPosition", function (x, y) {
    return this.updateUniform("position", [x, y]);
  });

  return proxy;
}

export default SaturatedLenseNode;
