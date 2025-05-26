/**
 * MixNode - Mix/blend between two textures
 */

import { MiniNode } from "../../miniGL.js";

export class MixNode extends MiniNode {
  constructor(gl, mixFactor = 0.5, options = {}) {
    super(gl, {
      uniforms: {
        uMix: mixFactor,
        uTextureA: { texture: gl.TransparentPixel },
        uTextureB: { texture: gl.TransparentPixel },
      },
      ...options,
    });

    this.fragmentShader = `#version 300 es
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

    // Input routing for simple nodes
    this.inputRouting.set("uTextureA", "main");
    this.inputRouting.set("uTextureB", "main");
  }
}

// Self-register with miniGL when imported
export function registerMixNode(gl) {
  if (!gl.ignoreMiniNodes && !gl.mix) {
    gl.mix = (...args) => {
      const node = new MixNode(gl, ...args);
      return gl.addNode(node);
    };
  }
}

export default MixNode;
