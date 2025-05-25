/**
 * Utility MiniNodes - Simple single-shader effect nodes
 */

import { MiniNode } from "../miniNode.js";

// Luminance extraction node
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

// Grayscale conversion node
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

    this.inputRouting.set("uTexture", "main");
  }
}

// Mix/blend between two textures
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

    this.inputRouting.set("uTextureA", "main");
    this.inputRouting.set("uTextureB", "main");
  }
}

// Gaussian blur node (single direction)
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

    this.inputRouting.set("uTexture", "main");
  }
}

// Brightness/Contrast adjustment
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

    this.inputRouting.set("uTexture", "main");
  }
}

// Saturation adjustment
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

    this.inputRouting.set("uTexture", "main");
  }
}

export default {
  LuminanceNode,
  GrayscaleNode,
  MixNode,
  GaussianBlurNode,
  BrightnessContrastNode,
  SaturationNode,
};
