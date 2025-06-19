/**
 * BloomNode - Multi-pass bloom effect with luminance extraction and blur
 */

// Luminance extraction shader
const luminanceShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uKnee;
out vec4 fragColor;

void main() {
  vec4 color = textureLod(uTexture, glUV, 1.0);
  
  // Calculate luminance
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  
  // Soft threshold with knee
  float threshold = smoothstep(uThreshold - uKnee, uThreshold + uKnee, luma);
  fragColor = mix(vec4(0.0), color, threshold);
}`;

// Horizontal Gaussian blur
const horizontalBlurShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uBlurRadius;
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
    fragColor += texture(uTexture, glUV + vec2(x * texel.x, 0.0)) * weight;
  }
  fragColor /= weightSum;
}`;

// Vertical Gaussian blur
const verticalBlurShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uBlurRadius;
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
    fragColor += texture(uTexture, glUV + vec2(0.0, x * texel.y)) * weight;
  }   
  fragColor /= weightSum;
}`;

// Composite shader - Full bloom implementation
const compositeShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;    // Original
uniform sampler2D uBloom;      // Blurred bloom
uniform float uIntensity;
uniform float uMix;
out vec4 fragColor;

void main() {
  vec4 original = texture(uTexture, glUV);
  vec4 bloom = texture(uBloom, glUV);
  
  // Additive blend with intensity
  vec4 result = original + min(bloom * uIntensity, vec4(1.0));
  
  // Optional mix between original and bloomed
  fragColor = mix(original, result, uMix);
}`;

import { MiniNode } from "../../miniGL.js";

// Factory function following the new pattern: BloomNode(gl, uniforms, nodeOptions)
export function BloomNode(gl, uniforms = {}, nodeOptions = {}) {
  const {
    threshold = 0.8,
    knee = 0.1,
    intensity = 1.0,
    blurRadius = 1.0,
    mix = 1.0,
  } = uniforms;

  // Create internal nodes for the bloom pipeline
  const luminanceNode = gl.shader(
    luminanceShader,
    {
      uThreshold: threshold,
      uKnee: knee,
    },
    {
      name: `${nodeOptions.name || "Bloom"}_Luminance`,
      mipmap: true,
    }
  );

  const blurHNode = gl.shader(
    horizontalBlurShader,
    {
      uBlurRadius: blurRadius,
    },
    {
      name: `${nodeOptions.name || "Bloom"}_BlurH`,
    }
  );

  const blurVNode = gl.shader(
    verticalBlurShader,
    {
      uBlurRadius: blurRadius,
    },
    {
      name: `${nodeOptions.name || "Bloom"}_BlurV`,
    }
  );

  const compositeNode = gl.shader(
    compositeShader,
    {
      uIntensity: intensity,
      uMix: mix,
    },
    {
      name: `${nodeOptions.name || "Bloom"}_Composite`,
    }
  );

  // Connect the internal pipeline: luminance → blurH → blurV → composite(bloom input)
  blurHNode.connect("uTexture", luminanceNode);
  blurVNode.connect("uTexture", blurHNode);
  compositeNode.connect("uBloom", blurVNode);

  // Create clean mini node using MiniNode class with composite as output
  const mini = new MiniNode(gl, compositeNode, {
    name: nodeOptions.name || "Bloom",
    internalNodes: [luminanceNode, blurHNode, blurVNode, compositeNode],
  });

  // Map main input to both luminance (start of bloom pipeline) and composite (original texture)
  mini.input("glTexture", luminanceNode, "uTexture");
  mini.input("uTexture", luminanceNode, "uTexture");

  // Map uniforms to their respective internal nodes
  mini.uniform("threshold", luminanceNode, "uThreshold");
  mini.uniform("knee", luminanceNode, "uKnee");
  mini.uniform("intensity", compositeNode, "uIntensity");
  mini.uniform("mix", compositeNode, "uMix");

  // Custom uniform handler for blur radius (affects both blur passes)
  mini.onUniform((key, value, mapping) => {
    if (key === "blurRadius") {
      blurHNode.updateUniform("uBlurRadius", value);
      blurVNode.updateUniform("uBlurRadius", value);
    }
  });

  // Custom connection handler to also send original texture to composite
  mini.onConnect((inputName, sourceNode, outputName) => {
    if (inputName === "uTexture" || inputName === "glTexture") {
      compositeNode.connect("uTexture", sourceNode, outputName);
    }
  });

  return mini;
}

// Export the factory as default for easy importing
export default BloomNode;
