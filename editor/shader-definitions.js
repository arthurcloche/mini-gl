// Shader definitions for our node types
export const shaderDefinitions = {
  noise: {
    title: "Noise Generator",
    inputs: [],
    outputs: [{ name: "fragColor", type: "vec4" }],
    shaderSource: `#version 300 es
precision highp float;

in vec2 glCoord;
uniform float glTime;

out vec4 fragColor;

// Hash function for noise
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Simple noise function
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0-2.0*f); // Smoothstep
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM (Fractal Brownian Motion)
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

void main() {
  vec2 p = glCoord * 5.0;
  p += glTime * 0.2; // Animate the noise
  
  float n = fbm(p);
  
  // Output noise as grayscale
  fragColor = vec4(vec3(n), 1.0);
}`,
  },

  color: {
    title: "Color Mapper",
    inputs: [{ name: "noise", type: "vec4" }],
    outputs: [{ name: "fragColor", type: "vec4" }],
    uniforms: {
      uColorA: [0.1, 0.1, 0.7, 1.0],
      uColorB: [0.8, 0.2, 0.1, 1.0],
    },
    shaderSource: `#version 300 es
precision highp float;

in vec2 glCoord;
uniform float glTime;
uniform vec4 uColorA; // Cool color
uniform vec4 uColorB; // Warm color
uniform sampler2D noise;

out vec4 fragColor;

void main() {
  // Sample the input noise texture
  vec4 noiseValue = texture(noise, glCoord);
  
  // Create a color gradient based on the noise value
  vec4 color = mix(uColorA, uColorB, noiseValue.r);
  
  // Add some time-based color variation
  float pulse = sin(glTime * 0.5) * 0.5 + 0.5;
  color = mix(color, color * (0.8 + 0.2 * pulse), 0.2);
  
  fragColor = color;
}`,
  },

  output: {
    title: "Output",
    inputs: [{ name: "source", type: "vec4" }],
    outputs: [],
    shaderSource: `#version 300 es
precision highp float;

in vec2 glCoord;
uniform sampler2D source;

out vec4 fragColor;

void main() {
  // Just pass through the input texture
  fragColor = texture(source, glCoord);
}`,
  },
};

// Get a deep copy of a shader definition to avoid modifying the original
export function getShaderDefinition(type) {
  if (!shaderDefinitions[type]) {
    console.error(`Shader type "${type}" not found!`);
    return null;
  }

  // Deep clone the definition
  return JSON.parse(JSON.stringify(shaderDefinitions[type]));
}
