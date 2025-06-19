/**
 * GrayscaleNode - Grayscale conversion with adjustable strength
 */

const grayscaleShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uStrength;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 grayColor = vec3(gray);
  fragColor = vec4(mix(color.rgb, grayColor, uStrength), color.a);
}`;

import { MiniNode } from "../../miniGL.js";

// Factory function following the new pattern: GrayscaleNode(gl, uniforms, nodeOptions)
export function GrayscaleNode(gl, uniforms = {}, nodeOptions = {}) {
  const { strength = 1.0 } = uniforms;

  // Create the grayscale shader node
  const grayscaleNode = gl.shader(
    grayscaleShader,
    {
      uStrength: strength,
    },
    {
      name: nodeOptions.name || "Grayscale",
      ...nodeOptions,
    }
  );

  // Create clean mini node using MiniNode class
  const mini = new MiniNode(gl, grayscaleNode, {
    name: nodeOptions.name || "Grayscale",
  });

  // Map common input names to internal ones
  mini.input("glTexture", "uTexture");
  mini.input("uTexture", "uTexture");

  // Map external uniform names to internal shader uniforms
  mini.uniform("strength", "uStrength");

  return mini;
}

// Export the factory as default for easy importing
export default GrayscaleNode;
