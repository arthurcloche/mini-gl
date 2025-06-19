/**
 * miniGL Web Components
 * Declarative WebGL2 node-based rendering in HTML
 * Made w/ love for Shopify, 2025
 */

// Import and register all components
import { MiniGLCanvas } from "./minigl-canvas.js";
import {
  MiniGLNode,
  ShaderNode,
  ImageNode,
  VideoNode,
  CanvasNode,
  BlendNode,
  FeedbackNode,
  ParticlesNode,
  InputConnection,
} from "./nodes.js";

// Export everything for programmatic use
export {
  MiniGLCanvas,
  MiniGLNode,
  ShaderNode,
  ImageNode,
  VideoNode,
  CanvasNode,
  BlendNode,
  FeedbackNode,
  ParticlesNode,
  InputConnection,
};

// Utility function to check if WebGL2 is supported
export function isWebGL2Supported() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return !!gl;
  } catch (e) {
    return false;
  }
}

// Utility function to create shader text from a template literal
export function glsl(strings, ...values) {
  let result = strings[0];
  for (let i = 1; i < strings.length; i++) {
    result += values[i - 1] + strings[i];
  }
  return result.trim();
}

// Helper function to create common shader patterns
export const shaders = {
  // Simple color shader
  color: (r = 1, g = 0, b = 0, a = 1) => glsl`
    #version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
      fragColor = vec4(${r}, ${g}, ${b}, ${a});
    }
  `,

  // Circle shader
  circle: (radius = 0.3, color = "vec3(1.0, 0.0, 0.0)") => glsl`
    #version 300 es
    precision highp float;
    in vec2 glCoord;
    out vec4 fragColor;
    void main() {
      float dist = length(glCoord - 0.5);
      float circle = step(dist, ${radius});
      fragColor = vec4(${color} * circle, circle);
    }
  `,

  // Simple noise
  noise: () => glsl`
    #version 300 es
    precision highp float;
    uniform float glTime;
    in vec2 glCoord;
    out vec4 fragColor;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    void main() {
      vec2 st = glCoord + glTime * 0.01;
      float noise = random(st);
      fragColor = vec4(vec3(noise), 1.0);
    }
  `,

  // UV display
  uv: () => glsl`
    #version 300 es
    precision highp float;
    in vec2 glUV;
    out vec4 fragColor;
    void main() {
      fragColor = vec4(glUV, 0.0, 1.0);
    }
  `,

  // Pass-through
  copy: () => glsl`
    #version 300 es
    precision highp float;
    uniform sampler2D glTexture;
    in vec2 glUV;
    out vec4 fragColor;
    void main() {
      fragColor = texture(glTexture, glUV);
    }
  `,
};

// Version info
export const version = "1.0.0";

// Default export for convenience
export default {
  MiniGLCanvas,
  MiniGLNode,
  ShaderNode,
  ImageNode,
  VideoNode,
  CanvasNode,
  BlendNode,
  FeedbackNode,
  ParticlesNode,
  InputConnection,
  isWebGL2Supported,
  glsl,
  shaders,
  version,
};
