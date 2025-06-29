/**
 * GaussianBlurNode - Single direction Gaussian blur
 */

export const gaussianBlurShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uBlurRadius;
uniform vec2 uDirection;
uniform vec2 glResolution;
out vec4 fragColor;

void main() {
  vec2 texel = 1.0 / glResolution;
  float sigma = uBlurRadius;
  int kernelSize = 2 * int(floor(4.0 * sigma + 0.5)) + 1;
    
  float weightSum = 0.0;
  fragColor = vec4(0.0);
  
  for (int i = 0; i < kernelSize; i++) {
    float x = float(i) - (float(kernelSize) * 0.5);
    float weight = exp(-(x * x) / (2.0 * sigma * sigma));
    weightSum += weight;
    vec2 offset = x * texel * uDirection;
    fragColor += texture(uTexture, glUV + offset) * weight;
  }
  
  fragColor /= weightSum;
}`;

import { MiniNode } from "../../miniGL.js";

// Factory function for directional blur (reusable component)
export function DirectionalBlurNode(gl, uniforms = {}, nodeOptions = {}) {
  const { radius = 1.0, direction = [1.0, 0.0] } = uniforms;

  // Create the directional blur shader node
  const blurNode = gl.shader(
    gaussianBlurShader,
    {
      uBlurRadius: radius,
      uDirection: direction,
    },
    {
      name: nodeOptions.name || "Directional Blur",
      ...nodeOptions,
    }
  );

  // Create clean mini node using MiniNode class
  const mini = new MiniNode(gl, blurNode, {
    name: nodeOptions.name || "Directional Blur",
  });

  // Map common input names to internal ones
  mini.input("uTexture", "uTexture");

  // Map external uniform names to internal shader uniforms
  mini.uniform("radius", "uBlurRadius");
  mini.uniform("direction", "uDirection");

  return mini;
}

// Factory function following the new pattern: GaussianBlurNode(gl, uniforms, nodeOptions)
export function GaussianBlurNode(gl, uniforms = {}, nodeOptions = {}) {
  const { radius = 1.0, strength = 1.0, mask = gl.TransparentPixel } = uniforms;

  // Create horizontal blur pass using DirectionalBlurNode
  const blurH = DirectionalBlurNode(
    gl,
    {
      radius: radius,
      direction: [1.0, 0.0],
    },
    {
      name: `${nodeOptions.name || "GaussianBlur"}_H`,
    }
  );

  // Create vertical blur pass using DirectionalBlurNode
  const blurV = DirectionalBlurNode(
    gl,
    {
      radius: radius,
      direction: [0.0, 1.0],
    },
    {
      name: `${nodeOptions.name || "GaussianBlur"}_V`,
    }
  );

  // Connect horizontal to vertical
  blurV.connect("uTexture", blurH);

  // Create clean mini node using MiniNode class with the final vertical pass as output
  const mini = new MiniNode(gl, blurV, {
    name: nodeOptions.name || "Gaussian Blur",
    internalNodes: [blurH, blurV], // Track both nodes for processing
  });

  // Map input to the first node (horizontal)
  mini.input("uTexture", blurH, "uTexture");

  // Map uniforms
  mini.uniform("radius", "uBlurRadius");
  mini.uniform("strength", "uStrength");

  // Custom uniform handler to update both passes
  mini.onUniform((key, value, mapping) => {
    if (key === "radius") {
      blurH.updateUniform("radius", value);
      blurV.updateUniform("radius", value);
    }
  });

  return mini;
}

// Export both nodes
export default GaussianBlurNode;
