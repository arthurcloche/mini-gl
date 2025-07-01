/**
 * GrayscaleNode - Grayscale conversion with adjustable strength
 */

import { MiniNode } from "../../miniGL.js";

export class GrayscaleNode extends MiniNode {
  constructor(gl, strength = 1.0, options = {}) {
    super(gl, {
      uniforms: {
        uStrength: strength,
        uTexture: { texture: gl.TransparentPixel },
      },
      ...options,
    });

    this.fragmentShader = `#version 300 es
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

    // Input routing for simple nodes
    this.inputRouting.set("uTexture", "main");
  }
}

// Self-register with miniGL when imported
export function registerGrayscaleNode(gl) {
  if (!gl.ignoreMiniNodes && !gl.grayscale) {
    gl.grayscale = (...args) => {
      const node = new GrayscaleNode(gl, ...args);
      return gl.addNode(node);
    };
  }
}

export default GrayscaleNode;
