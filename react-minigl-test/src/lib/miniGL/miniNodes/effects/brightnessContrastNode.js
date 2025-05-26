/**
 * BrightnessContrastNode - Brightness and contrast adjustment
 */

import { MiniNode } from "../../miniGL.js";

export class BrightnessContrastNode extends MiniNode {
  constructor(gl, brightness = 0.0, contrast = 1.0, options = {}) {
    super(gl, {
      uniforms: {
        uBrightness: brightness,
        uContrast: contrast,
        uTexture: { texture: gl.TransparentPixel },
      },
      ...options,
    });

    this.fragmentShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uBrightness;
uniform float uContrast;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  
  // Apply contrast (around 0.5 midpoint)
  color.rgb = (color.rgb - 0.5) * uContrast + 0.5;
  
  // Apply brightness
  color.rgb += uBrightness;
  
  fragColor = color;
}`;

    // Input routing for simple nodes
    this.inputRouting.set("uTexture", "main");
  }
}

// Self-register with miniGL when imported
export function registerBrightnessContrastNode(gl) {
  if (!gl.ignoreMiniNodes && !gl.brightnessContrast) {
    gl.brightnessContrast = (...args) => {
      const node = new BrightnessContrastNode(gl, ...args);
      return gl.addNode(node);
    };
  }
}

export default BrightnessContrastNode;
