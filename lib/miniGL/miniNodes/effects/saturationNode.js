/**
 * SaturationNode - Saturation adjustment
 */

const saturationShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uSaturation;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 grayColor = vec3(gray);
  fragColor = vec4(mix(grayColor, color.rgb, uSaturation), color.a);
}`;

import { MiniNode } from "../../miniGL.js";

// Factory function following the new pattern: SaturationNode(gl, uniforms, nodeOptions)
export function SaturationNode(gl, uniforms = {}, nodeOptions = {}) {
  const { saturation = 1.0 } = uniforms;

  // Create the saturation shader node
  const saturationNode = gl.shader(
    saturationShader,
    {
      uSaturation: saturation,
    },
    {
      name: nodeOptions.name || "Saturation",
      ...nodeOptions,
    }
  );

  // Create clean mini node using MiniNode class
  const mini = new MiniNode(gl, saturationNode, {
    name: nodeOptions.name || "Saturation",
  });

  // Map common input names to internal ones
  mini.input("glTexture", "uTexture");
  mini.input("uTexture", "uTexture");

  // Map external uniform names to internal shader uniforms
  mini.uniform("saturation", "uSaturation");

  return mini;
}

// Export the factory as default for easy importing
export default SaturationNode;
