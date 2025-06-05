/**
 * BloomNode - Refactored to use MiniNode base class
 * Demonstrates complex multi-node composition pattern
 */

import { MiniNode } from "../../miniGL.js";

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
  fragColor = mix(vec4(0.),color, threshold);
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
  vec2 texel = 1./glResolution;
  float sigma = uBlurRadius;
  int kernelSize = 2 * int(floor(4. * sigma + .5)) + 1;
    
    float weightSum = 0.;
    fragColor *= 0.;
    for (int i = 0; i < kernelSize; i++)
    {
        float x = float(i) - (float(kernelSize) * .5);
        float weight = exp(-(x * x) / (2.0 * sigma * sigma));
        weightSum += weight;
        fragColor += texture(uTexture, glUV + vec2( x * texel.x,0.)) * weight;
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
  vec2 texel = 1./glResolution;
  float sigma = uBlurRadius;
  int kernelSize = 2 * int(floor(4. * sigma + .5)) + 1;
    
    float weightSum = 0.;
    fragColor *= 0.;
    for (int i = 0; i < kernelSize; i++)
    {
        float x = float(i) - (float(kernelSize) * .5);
        float weight = exp(-(x * x) / (2.0 * sigma * sigma));
        weightSum += weight;
        fragColor += texture(uTexture, glUV + vec2(0., x * texel.y)) * weight;
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
  vec4 result = original + min(bloom * uIntensity, vec4(1.));
  
  // Optional mix between original and bloomed
  fragColor = mix(original, result, uMix);
}`;

export class BloomNode extends MiniNode {
  constructor(
    gl,
    threshold = 0.8,
    knee = 0.1,
    intensity = 1.0,
    blurRadius = 1.0,
    mix = 1.0,
    options = {}
  ) {
    super(gl, {
      name: options.name || "Bloom Node",
      uniforms: {
        uTexture: { texture: gl.TransparentPixel },
        uThreshold: threshold,
        uKnee: knee,
        uIntensity: intensity,
        uBlurRadius: blurRadius,
        uMix: mix,
      },
      ...options,
    });

    // Define the internal node structure
    this.nodeDefinitions = [
      {
        key: "luminance",
        type: "shader",
        name: "Luminance",
        fragmentShader: luminanceShader,
        options: { mipmap: true },
      },
      {
        key: "blurH",
        type: "shader",
        name: "BlurH",
        fragmentShader: horizontalBlurShader,
      },
      {
        key: "blurV",
        type: "shader",
        name: "BlurV",
        fragmentShader: verticalBlurShader,
      },
      {
        key: "composite",
        type: "shader",
        name: "Composite",
        fragmentShader: compositeShader,
      },
    ];

    // Define internal connections
    this.nodeConnections = [
      { source: "luminance", target: "blurH", input: "uTexture" },
      { source: "blurH", target: "blurV", input: "uTexture" },
      { source: "blurV", target: "composite", input: "uBloom" },
    ];

    // Define input routing
    this.inputRouting.set("uTexture", "luminance");

    // Define uniform bindings (which uniforms go to which internal nodes)
    this.uniformBindings.set("uThreshold", ["luminance"]);
    this.uniformBindings.set("uKnee", ["luminance"]);
    this.uniformBindings.set("uBlurRadius", ["blurH", "blurV"]);
    this.uniformBindings.set("uIntensity", ["composite"]);
    this.uniformBindings.set("uMix", ["composite"]);

    // Set the output node
    this.outputNode = "composite";
  }

  // Override connect to handle special case for composite uTexture
  connect(inputName, sourceNode, outputName = "default") {
    super.connect(inputName, sourceNode, outputName);

    // Also connect original texture to composite for blending
    if (inputName === "uTexture" && this.nodes.composite) {
      this.nodes.composite.connect("uTexture", sourceNode, outputName);
    }

    return this;
  }
}

// Self-register with miniGL when imported
export function registerBloomNode(gl) {
  if (!gl.ignoreMiniNodes && !gl.bloom) {
    gl.bloomNode = (...args) => {
      const node = new BloomNode(gl, ...args);
      return gl.addNode(node);
    };
  }
}

export default BloomNode;
