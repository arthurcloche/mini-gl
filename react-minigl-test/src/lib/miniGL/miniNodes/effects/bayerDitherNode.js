/*
`#version 300 es
precision mediump float;

in vec3 vVertexPosition;
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uResolution;

uint fibonacciHash(uint x) {
    const uint FIB_HASH = 2654435769u;
    uint hash = x * FIB_HASH;
    hash ^= hash >> 16;
    hash *= 0x85ebca6bu;
    hash ^= hash >> 13;
    hash *= 0xc2b2ae35u;
    hash ^= hash >> 16;
    return hash;
}

float randFibo(vec2 xy) {
    uvec2 xi = floatBitsToUint(xy);
    uint hashed = fibonacciHash(xi.x ^ fibonacciHash(xi.y));
    return float(hashed) / float(0xffffffffu);
}

const int MAX_LEVEL = 4;
const float PI2 = 6.28318530718;

float getBayerFromCoordLevelScaled(vec2 pixelpos, float scale) {
    float finalBayer = 0.0;
    float finalDivisor = 0.0;
    float layerMult = 1.0;
    for(float bayerLevel = float(MAX_LEVEL); bayerLevel >= 1.0; bayerLevel--) {
        float bayerSize = exp2(bayerLevel) * 0.5 / scale;
        vec2 bayercoord = mod(floor(pixelpos.xy / bayerSize), 2.0);
        layerMult *= 4.0;
        float byxx2 = bayercoord.x * 2.0;
        finalBayer += mix(byxx2, 3.0 - byxx2, bayercoord.y) / 3.0 * layerMult;
        finalDivisor += layerMult;
    }
    return (finalBayer / finalDivisor - 0.001);
}

float getBayerNoise(vec2 st, float delta, float scale) {
    return getBayerFromCoordLevelScaled(st * uResolution + delta, scale);
}

vec3 dither(vec3 color, vec2 st) {
    float delta = floor(uTime);
    vec2 offset = vec2(
        randFibo(vec2(123, 16) + delta),
        randFibo(vec2(56, 96) + delta)
    );
    float noise = 0.0;
    noise = getBayerNoise(st, delta, 0.25);
    float dither_threshold = max(0.0001, 1.0000);
    float num_levels = 1.0 / dither_threshold;
    return floor(color * num_levels + noise) / num_levels;
}

out vec4 fragColor;

void main() {
    vec2 uv = vTextureCoord;
    float delta = floor(uTime);
    vec4 color = texture(uTexture, uv);
    if(color.a == 0.0) {
        fragColor = vec4(0);
        return;
    }
    color.rgb = mix(color.rgb, dither(color.rgb, vTextureCoord), 1.0);
    fragColor = color;
}`

*/

export const unicornDitherShader = `#version 300 es
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
    0.,  8.0/16.0,  2.0/16.0, 10.0/16.0,
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
  float intR = mix( 0., 1., step(threshold, color.r));
  if( length(color.rgb) == 0.) {
    fragColor = vec4(0);
    return;
  }
  if(uUseComposite){
    float intG = mix( 0., 1., step(threshold, color.g));
    float intB = mix( 0., 1., step(threshold, color.b));
    float intA = mix( 0., 1., step(threshold, color.a));
    fragColor = vec4(intR,intG,intB,intA);
    return;
  }else{
    fragColor = mix(vec4(0.), vec4(1.), intR);
  }
}`;

export const bayerDitherShader = `#version 300 es
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
  float intR = mix( 0., 1., step(threshold, color.r));
  if( length(color.rgb) == 0.) {
    fragColor = vec4(0);
    return;
  }
  if(uUseComposite){
    float intG = mix( 0., 1., step(threshold, color.g));
    float intB = mix( 0., 1., step(threshold, color.b));
    float intA = mix( 0., 1., step(threshold, color.a));
    fragColor = vec4(intR,intG,intB,intA);
    return;
  }else{
    fragColor = mix(vec4(0.), vec4(1.), intR);
  }
}`;

export default function bayerDitherNode(
  gl,
  ditherSize = 2,
  ditherScale = 1,
  uUseComposite = true,
  name = "Bayer Dither Node"
) {
  const uniforms = {
    uTexture: { texture: gl.TransparentPixel }, // will connect below
    uDitherSize: ditherSize,
    uDitherScale: ditherScale,
    uUseComposite: uUseComposite,
  };

  const node = gl.shader(bayerDitherShader, {
    name: name,
    uniforms,
  });

  return node;
}
