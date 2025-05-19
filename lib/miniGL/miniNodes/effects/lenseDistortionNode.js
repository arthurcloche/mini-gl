export const lenseDistortionShader = `#version 300 es
precision highp float;
in vec2 glCoord;
in vec2 glUV;
uniform vec3 glMouse;
uniform vec2 glResolution;

uniform sampler2D uTexture;
uniform sampler2D uMasked;
uniform float uIntensity;
uniform float uRadius;
uniform float uDispersion; 
uniform float uDistortion; 
uniform bool uUuseMouse;
uniform bool uUseMasked;

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
    red += texture(uTexture, st - offset) * invSteps;
    blue += texture(uTexture, st + offset) * invSteps;
  }
  
  for (float i = 0.0; i <= STEPS; i++) {
    vec2 offset = aberrated * ((i * invSteps) - 0.5);
    green += texture(uTexture, st + offset) * invSteps;
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
  vec4 color = texture(uTexture, uv);
  float aspectRatio = glResolution.x/glResolution.y;
  uv.x = uv.x * aspectRatio;
  
  vec2 sphereCoords = uv;
  vec2 pos = vec2(0.5, 0.5) + (glMouse.xy - 0.5);
  pos.x *= aspectRatio;
  
  float radius = uRadius * glResolution.x/max(glResolution.x, glResolution.y);
  
  // Use spherical transformation
  sphereCoords = sphericalTransformation(
    sphereCoords.x,
    sphereCoords.y,
    pos.x,
    pos.y,
    radius/2.0,
    uDistortion // Distortion amount (tau parameter)
  );
  
  vec2 scaledCoords = (sphereCoords - 0.5) + 0.5;
  vec4 sphere = texture(uTexture, clamp(scaledCoords, 0.0, 1.0));
  
  float distFromPos = distance(uv, pos);
  float insideSphere = distFromPos < radius/2.0 ? 1.0 : 0.0;
  
  // Apply chromatic aberration inside the sphere
  sphere.rgb = chromaticAberration(
    scaledCoords, 
    atan(scaledCoords.y, scaledCoords.x), 
    distFromPos * uDispersion, 
    1.0
  );
  
  // Mix original and refracted images based on sphere mask
  if(uUseMasked) color = texture(uMasked, glUV);
  color = mix(color, sphere, insideSphere * uIntensity);
  
  fragColor = color;
}`;

export default function lenseDistortionNode(
  gl,
  intensity = 1,
  radius = 1,
  distortion = 10,
  dispersion = 0.95,
  useMouse = true,
  unmasked = gl.TransparentPixel,
  name = "Lense Distortion Node"
) {
  const uniforms = {
    uTexture: { texture: gl.TransparentPixel }, // will connect below
    uIntensity: intensity,
    uDistortion: distortion,
    uRadius: radius,
    uDispersion: dispersion,
    uUseMouse: useMouse,
    uUseMasked: false,
  };

  const node = gl.shader(lenseDistortionShader, {
    name: name,
    uniforms,
  });

  if (unmasked !== gl.TransparentPixel) {
    node.updateUniform("uUseMasked", true);
    gl.connect(unmasked, node, "uMasked");
  }

  return node;
}
