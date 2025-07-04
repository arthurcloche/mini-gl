/**
 * BayerDitherNode - Bayer dithering effect
 */

const bayerDitherShader = `#version 300 es
precision highp float;
in vec2 glCoord;
in vec2 glUV;
uniform vec3 glMouse;
uniform vec2 glResolution;

uniform sampler2D uTexture;
uniform float uDitherSize;
uniform float uDitherScale;
uniform bool uUseComposite;

out vec4 fragColor;

const float BAYER_MATRIX[16] = float[](
    0.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
   12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
    3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
   15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
);

float getDither(vec2 pos) {
	vec2 scaled = pos / uDitherSize * uDitherScale;
	int index = int(mod(scaled.x, 4.0)) + int(mod(scaled.y, 4.0)) * 4;
	return BAYER_MATRIX[index];
}

void main() {
  vec2 pixelSize = vec2(uDitherSize/glResolution.x, uDitherSize/glResolution.y);
  vec2 position = floor(glUV/pixelSize)*pixelSize;
  vec4 color = texture(uTexture, position);
	float threshold = getDither(gl_FragCoord.xy);
  float intR = mix(0.0, 1.0, step(threshold, color.r));
  
  if(length(color.rgb) == 0.0) {
    fragColor = vec4(0.0);
    return;
  }
  
  if(uUseComposite){
    float intG = mix(0.0, 1.0, step(threshold, color.g));
    float intB = mix(0.0, 1.0, step(threshold, color.b));
    float intA = mix(0.0, 1.0, step(threshold, color.a));
    fragColor = vec4(intR, intG, intB, intA);
    return;
  } else {
    fragColor = mix(vec4(0.0), vec4(1.0), intR);
  }
}`;

import { MiniNode } from "../../miniGL.js";

export function BayerDitherNode(gl, uniforms = {}, nodeOptions = {}) {
  const { ditherSize = 2, ditherScale = 1, useComposite = true } = uniforms;

  const ditherNode = gl.shader(
    bayerDitherShader,
    {
      uDitherSize: ditherSize,
      uDitherScale: ditherScale,
      uUseComposite: useComposite,
    },
    {
      name: nodeOptions.name || "Bayer Dither",
      ...nodeOptions,
    }
  );

  const mini = new MiniNode(gl, ditherNode, {
    name: nodeOptions.name || "Bayer Dither",
  });

  mini.input("uTexture", "uTexture");

  mini.uniform("ditherSize", "uDitherSize");
  mini.uniform("ditherScale", "uDitherScale");
  mini.uniform("useComposite", "uUseComposite");

  return mini;
}
export default BayerDitherNode;
