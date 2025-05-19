import miniGL, { Node } from "../lib/miniGL/miniGL.js";
import miniChunks from "../lib/miniGL/miniChunks.js";

import lenseDistortionNode from "../lib/miniGL/miniNodes/effects/lenseDistortionNode.js";
import gaussianBlurNode from "../lib//miniGL/miniNodes/effects/gaussianBlurNode.js";

const gl = new miniGL("canvas");
gl.useChunks(miniChunks);

// 1. Background Gradient Layer (White)
const gradientShader = `#version 300 es
precision highp float;
in vec2 glCoord;
uniform vec2 glMouse;
out vec4 fragColor;

const float PI = 3.14159265;

vec2 rotate(vec2 coord, float angle) { 
  float s = sin(angle); 
  float c = cos(angle); 
  return vec2(
    coord.x * c - coord.y * s,
    coord.x * s + coord.y * c
  );
}

vec3 getColor(vec2 uv) {
  // White background from the JSON
  return vec3(1.);
}

void main() {
  vec2 uv = glCoord;
  vec2 pos = vec2(0.5);
  uv -= pos;
  uv /= 1.0;
  vec4 color = vec4(getColor(uv), 1.0);
  fragColor = color;
}`;

// 2. Text Layer Shader
const textFragmentShader = `#version 300 es
precision mediump float;
in vec2 glCoord;
in vec2 glUV;
uniform sampler2D glTexture;
uniform sampler2D glBgTexture;
uniform vec2 glMouse;
uniform int uSampleBg;
out vec4 fragColor;

void main() {
  vec2 uv = glUV;
  
  vec4 color = texture(glTexture, uv);
//   vec4 background = vec4(0.0);
  
//   if(uSampleBg == 1) {
//     background = texture(glBgTexture, glUV);
//   }
  
//   // Alpha blending
//   color = mix(background, color / max(color.a, 0.0001), color.a * 1.0);
  
  fragColor = color;
}`;

// 3. Sphere Effect (Bubble Refract) Shader
const sphereShader = `#version 300 es
precision highp float;
in vec2 glCoord;
in vec2 glUV;
uniform sampler2D glTexture;
uniform vec3 glMouse;
uniform vec2 glResolution;
out vec4 fragColor;

const float PI = 3.1415926;
const float STEPS = 16.0;

// Chromatic Aberration function
vec3 chromaticAberration(vec2 st, float angle, float amount, float blend) {
  float aspectRatio = glResolution.x/glResolution.y;
  float rotation = angle * 360.0 * PI / 180.0;
  vec2 aberrated = amount * vec2(0.1 * sin(rotation) * aspectRatio, 0.1 * cos(rotation));
  aberrated *= distance(st, vec2(0.5)) * 2.0;
  
  vec4 red = vec4(0);
  vec4 blue = vec4(0);
  vec4 green = vec4(0);
  
  float invSteps = 1.0 / STEPS;
  float invStepsHalf = invSteps * 0.5;
  
  for(float i = 1.0; i <= STEPS; i++) {
    vec2 offset = aberrated * (i * invSteps);
    red += texture(glTexture, st - offset) * invSteps;
    blue += texture(glTexture, st + offset) * invSteps;
  }
  
  for (float i = 0.0; i <= STEPS; i++) {
    vec2 offset = aberrated * ((i * invSteps) - 0.5);
    green += texture(glTexture, st + offset) * invSteps;
  }
  
  return vec3(red.r, green.g, blue.b);
}

// Spherical transformation
vec2 sphericalTransformation(float u, float v, float uCenter, float vCenter, float lensRadius, float tau) {
  float aspectRatio = glResolution.x/glResolution.y;
  u -= uCenter;
  v -= vCenter;
  
  float s = sqrt(u * u + v * v);
  if (s > lensRadius) return vec2(u + uCenter, v + vCenter);
  
  float z = sqrt(lensRadius * lensRadius - s * s);
  float uAlpha = (1.0 - (1.0 / tau)) * asin(u / lensRadius);
  float vAlpha = (1.0 - (1.0 / tau)) * asin(v / lensRadius);
  
  u = uCenter + z * sin(uAlpha);
  v = vCenter + z * sin(vAlpha);
  
  return vec2(u/aspectRatio, v);
}

float circularIn(float t) {
  return 1.0 - sqrt(1.0 - t * t);
}

void main() {
  vec2 uv = glUV;
  vec4 color = texture(glTexture, uv);
  float aspectRatio = glResolution.x/glResolution.y;
  uv.x = uv.x * aspectRatio;
  
  vec2 sphereCoords = uv;
  vec2 pos = vec2(0.5, 0.5) + (glMouse.xy - 0.5);
  pos.x *= aspectRatio;
  
  float radius = 1.99 * glResolution.x/max(glResolution.x, glResolution.y);
  
  // Use spherical transformation
  sphereCoords = sphericalTransformation(
    sphereCoords.x,
    sphereCoords.y,
    pos.x,
    pos.y,
    radius/2.0,
    10.0 // Distortion amount (tau parameter)
  );
  
  vec2 scaledCoords = (sphereCoords - 0.5) + 0.5;
  vec4 sphere = texture(glTexture, clamp(scaledCoords, 0.0, 1.0));
  
  float distFromPos = distance(uv, pos);
  float insideSphere = distFromPos < radius/2.0 ? 1.0 : 0.0;
  
  // Apply chromatic aberration inside the sphere
  sphere.rgb = chromaticAberration(
    scaledCoords, 
    atan(scaledCoords.y, scaledCoords.x), 
    distFromPos * 0.95, 
    1.0
  );
  
  // Mix original and refracted images based on sphere mask
  color = mix(color, sphere, insideSphere);
  
  fragColor = color;
}`;

const textCanvas = gl.canvas2D((ctx, w, h) => {
  ctx.fillStyle = "rgba(0, 0, 0, 255)"; // Transparent background
  ctx.fillRect(0, 0, w, h);

  // Setup text styling
  ctx.fillStyle = "white";
  ctx.font = '500 80px "Hubot Sans", "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw text
  ctx.fillText("HELLO miniGL", w / 2, h / 2);
});
const sphereNode = lenseDistortionNode(gl, 1, 0.7, 10, 0.9, true, textCanvas);
const blurNode = gaussianBlurNode(gl, textCanvas, 8);
gl.connect(blurNode, sphereNode, "uTexture");
gl.output(sphereNode);

// Animation function
function animate() {
  // Render all nodes
  gl.render();
  requestAnimationFrame(animate);
}

// Ensure fonts are loaded before starting animation
document.fonts.ready.then(() => {
  console.log("Fonts loaded, starting animation");
  animate();
});
