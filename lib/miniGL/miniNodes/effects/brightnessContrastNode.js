/**
 * BrightnessContrastNode - Brightness and contrast adjustment
 */

const brightnessContrastShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uBrightness;
uniform float uContrast;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  
  // Apply brightness (additive)
  color.rgb += uBrightness;
  
  // Apply contrast (multiplicative around 0.5 midpoint)
  color.rgb = (color.rgb - 0.5) * uContrast + 0.5;
  
  fragColor = color;
}`;

import { MiniNode } from "../../miniGL.js";

// Factory function following the new pattern: BrightnessContrastNode(gl, uniforms, nodeOptions)
export function BrightnessContrastNode(gl, uniforms = {}, nodeOptions = {}) {
  const { brightness = 0.0, contrast = 1.0 } = uniforms;

  // Create the brightness/contrast shader node
  const bcNode = gl.shader(
    brightnessContrastShader,
    {
      uBrightness: brightness,
      uContrast: contrast,
    },
    {
      name: nodeOptions.name || "Brightness Contrast",
      ...nodeOptions,
    }
  );

  // Create clean mini node using MiniNode class
  const mini = new MiniNode(gl, bcNode, {
    name: nodeOptions.name || "Brightness Contrast",
  });

  // Map common input names to internal ones
  mini.input("glTexture", "uTexture");
  mini.input("uTexture", "uTexture");

  // Map external uniform names to internal shader uniforms
  mini.uniform("brightness", "uBrightness");
  mini.uniform("contrast", "uContrast");

  return mini;
}

// Export the factory as default for easy importing
export default BrightnessContrastNode;
