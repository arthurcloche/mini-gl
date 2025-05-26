/**
 * SaturationNode - Saturation adjustment
 */

import { MiniNode } from "../../miniGL.js";

export class SaturationNode extends MiniNode {
  constructor(gl, saturation = 1.0, options = {}) {
    super(gl, {
      uniforms: {
        uSaturation: saturation,
        uTexture: { texture: gl.TransparentPixel },
      },
      ...options,
    });

    this.fragmentShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uSaturation;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  fragColor = vec4(mix(vec3(gray), color.rgb, uSaturation), color.a);
}`;

    // Input routing for simple nodes
    this.inputRouting.set("uTexture", "main");
  }
}

// Self-register with miniGL when imported
export function registerSaturationNode(gl) {
  if (!gl.ignoreMiniNodes && !gl.saturation) {
    gl.saturation = (...args) => {
      const node = new SaturationNode(gl, ...args);
      return gl.addNode(node);
    };
  }
}

export default SaturationNode;
