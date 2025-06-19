/**
 * MixNode - Mix/blend between two textures
 */

const mixShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTextureA;
uniform sampler2D uTextureB;
uniform float uMix;
out vec4 fragColor;

void main() {
  vec4 colorA = texture(uTextureA, glUV);
  vec4 colorB = texture(uTextureB, glUV);
  fragColor = mix(colorA, colorB, uMix);
}`;

import { MiniNode } from "../../miniGL.js";

// Factory function following the new pattern: MixNode(gl, uniforms, nodeOptions)
export function MixNode(gl, uniforms = {}, nodeOptions = {}) {
  const { mixFactor = 0.5 } = uniforms;

  // Create the mix shader node
  const mixNode = gl.shader(
    mixShader,
    {
      uMix: mixFactor,
    },
    {
      name: nodeOptions.name || "Mix",
      ...nodeOptions,
    }
  );

  // Create clean mini node using MiniNode class
  const mini = new MiniNode(gl, mixNode, {
    name: nodeOptions.name || "Mix",
  });

  // Map common input names to internal ones
  mini.input("glTexture", "uTextureA");
  mini.input("uTexture", "uTextureA");
  mini.input("uTextureA", "uTextureA");
  mini.input("uTextureB", "uTextureB");

  // Map external uniform names to internal shader uniforms
  mini.uniform("mixFactor", "uMix");
  mini.uniform("mix", "uMix");

  return mini;
}

// Export the factory as default for easy importing
export default MixNode;
