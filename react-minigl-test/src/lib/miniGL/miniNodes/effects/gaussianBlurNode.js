/**
 * GaussianBlurNode - Single direction Gaussian blur
 */

import { MiniNode } from "../../miniGL.js";

export class GaussianBlurNode extends MiniNode {
  constructor(gl, radius = 1.0, direction = [1.0, 0.0], options = {}) {
    super(gl, {
      uniforms: {
        uBlurRadius: radius,
        uDirection: direction,
        uTexture: { texture: gl.TransparentPixel },
      },
      ...options,
    });

    this.fragmentShader = `#version 300 es
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

    // Input routing for simple nodes
    this.inputRouting.set("uTexture", "main");
  }
}

// Self-register with miniGL when imported
export function registerGaussianBlurNode(gl) {
  if (!gl.ignoreMiniNodes && !gl.gaussianBlur) {
    gl.gaussianBlur = (...args) => {
      const node = new GaussianBlurNode(gl, ...args);
      return gl.addNode(node);
    };

    // Add convenience methods for common blur patterns
    gl.gaussianBlurH = (radius = 1.0, options = {}) => {
      return gl.gaussianBlur(radius, [1.0, 0.0], {
        name: "GaussianBlurH",
        ...options,
      });
    };

    gl.gaussianBlurV = (radius = 1.0, options = {}) => {
      return gl.gaussianBlur(radius, [0.0, 1.0], {
        name: "GaussianBlurV",
        ...options,
      });
    };

    // Double-pass gaussian blur factory
    gl.gaussianBlur2Pass = (radius = 1.0, options = {}) => {
      const blurH = gl.gaussianBlurH(radius, {
        name: `${options.name || "GaussianBlur2Pass"}_H`,
      });
      const blurV = gl.gaussianBlurV(radius, {
        name: `${options.name || "GaussianBlur2Pass"}_V`,
      });
      blurV.connect("uTexture", blurH);
      return { blurH, blurV, output: blurV }; // Return both nodes and the final output
    };
  }
}

export default GaussianBlurNode;
