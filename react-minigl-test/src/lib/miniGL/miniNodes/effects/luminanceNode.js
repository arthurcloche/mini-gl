/**
 * LuminanceNode - Luminance extraction with threshold and knee
 */

import { MiniNode } from "../../miniGL.js";

export class LuminanceNode extends MiniNode {
  constructor(gl, threshold = 0.5, knee = 0.1, options = {}) {
    super(gl, {
      uniforms: {
        uThreshold: threshold,
        uKnee: knee,
        uTexture: { texture: gl.TransparentPixel },
      },
      ...options,
    });

    this.fragmentShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uKnee;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  
  // Calculate luminance
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  
  // Soft threshold with knee
  float threshold = smoothstep(uThreshold - uKnee, uThreshold + uKnee, luma);
  fragColor = mix(vec4(0.0), color, threshold);
}`;

    // Input routing for simple nodes
    this.inputRouting.set("uTexture", "main");
  }
}

// Self-register with miniGL when imported
export function registerLuminanceNode(gl) {
  if (!gl.ignoreMiniNodes && !gl.luminance) {
    gl.luminance = (...args) => {
      const node = new LuminanceNode(gl, ...args);
      return gl.addNode(node);
    };
  }
}

export default LuminanceNode;
