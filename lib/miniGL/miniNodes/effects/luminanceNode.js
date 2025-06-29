/**
 * LuminanceNode - Luminance extraction with threshold and knee
 */

const luminanceShader = `#version 300 es
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

import { MiniNode } from "../../miniGL.js";

// Factory function following the new pattern: LuminanceNode(gl, uniforms, nodeOptions)
export function LuminanceNode(gl, uniforms = {}, nodeOptions = {}) {
  const { threshold = 0.5, knee = 0.1 } = uniforms;

  // Create the luminance shader node
  const luminanceNode = gl.shader(
    luminanceShader,
    {
      uThreshold: threshold,
      uKnee: knee,
    },
    {
      name: nodeOptions.name || "Luminance",
      ...nodeOptions,
    }
  );

  // Create clean mini node using MiniNode class
  const mini = new MiniNode(gl, luminanceNode, {
    name: nodeOptions.name || "Luminance",
  });

  // Map common input names to internal ones
  mini.input("uTexture", "uTexture");

  // Map external uniform names to internal shader uniforms
  mini.uniform("threshold", "uThreshold");
  mini.uniform("knee", "uKnee");

  return mini;
}

// Export the factory as default for easy importing
export default LuminanceNode;
