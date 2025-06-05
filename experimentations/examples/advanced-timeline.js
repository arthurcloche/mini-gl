// Advanced Timeline demo for miniGL
import miniGL from "../../lib/miniGL/miniGL.js";
import { Timeline } from "../../lib/miniGL/Timeline.js";

// Create a miniGL instance
const gl = new miniGL("canvas");

// Create source nodes (different effects)
const effectA = gl.shader(
  `#version 300 es
precision highp float;
uniform vec3 color;
in vec2 glCoord;
out vec4 fragColor;
void main() {
  float distance = length(glCoord - 0.5);
  float circle = smoothstep(0.3, 0.29, distance);
  fragColor = vec4(color * circle, 1.0);
}`,
  { uniforms: { color: { x: 1.0, y: 0.2, z: 0.1 } } }
);

const effectB = gl.shader(
  `#version 300 es
precision highp float;
uniform float time;
in vec2 glCoord;
out vec4 fragColor;
void main() {
  vec2 st = glCoord * 10.0;
  vec2 grid = abs(fract(st - 0.5) - 0.5) / fwidth(st);
  float line = min(grid.x, grid.y);
  float gridPattern = 1.0 - min(line, 1.0);
  
  // Animated color
  vec3 color = vec3(sin(time * 0.01) * 0.5 + 0.5, 
                    cos(time * 0.015) * 0.5 + 0.5,
                    sin(time * 0.02) * 0.5 + 0.5);
  
  fragColor = vec4(color * gridPattern, 1.0);
}`,
  { uniforms: { time: 0 } }
);

const effectC = gl.shader(
  `#version 300 es
precision highp float;
uniform float time;
in vec2 glCoord;
out vec4 fragColor;
void main() {
  vec2 p = glCoord * 2.0 - 1.0;
  float angle = atan(p.y, p.x);
  float radius = length(p);
  float waves = sin(radius * 10.0 - time * 0.05) * 0.5 + 0.5;
  
  vec3 color = vec3(waves, waves * 0.5, 1.0 - waves);
  fragColor = vec4(color, 1.0);
}`,
  { uniforms: { time: 0 } }
);

// Output node
const outputNode = gl.shader(
  `#version 300 es
precision highp float;
uniform sampler2D glTexture;
uniform float opacity;
in vec2 glUV;
out vec4 fragColor;
void main() {
  vec4 tex = texture(glTexture, glUV);
  fragColor = vec4(tex.rgb, tex.a * opacity);
}`,
  { uniforms: { opacity: 1.0 } }
);

// Initial connection
outputNode.connect("glTexture", effectA);

// Set as output
gl.setOutput(outputNode);

// Create a timeline for effect switching
const timeline = new Timeline();

// Animate time and opacity parameters
timeline.tween(effectB, "uniforms.time", 0, 300, 0, 300);
timeline.tween(effectC, "uniforms.time", 0, 300, 0, 300);
timeline.tween(outputNode, "uniforms.opacity", 1.0, 0.0, 90, 30, "easeInQuad");
timeline.tween(
  outputNode,
  "uniforms.opacity",
  0.0,
  1.0,
  120,
  30,
  "easeOutQuad"
);
timeline.tween(outputNode, "uniforms.opacity", 1.0, 0.0, 210, 30, "easeInQuad");
timeline.tween(
  outputNode,
  "uniforms.opacity",
  0.0,
  1.0,
  240,
  30,
  "easeOutQuad"
);

// Create a timeline for dynamic connections using arrays with connection info
// We'll use a special property name '_connect' which the timeline recognizes
// Format: [inputName, sourceNode, outputName]
timeline.track(outputNode, "_connect", [
  { time: 120, value: ["glTexture", effectB, "default"] },
  { time: 240, value: ["glTexture", effectC, "default"] },
  { time: 360, value: ["glTexture", effectA, "default"] },
]);

// Make it loop
timeline.setLoop(true);

// Start the timeline
timeline.play();

// Store current frame as a pseudo-global for the effect shaders
let currentFrame = 0;

// Animation loop
function animate() {
  // Update time-dependent effects
  effectB.updateUniform("time", currentFrame);
  effectC.updateUniform("time", currentFrame);

  // Update the timeline with the current frame
  timeline.update(currentFrame);

  // Render frame
  gl.render();
  currentFrame++;

  requestAnimationFrame(animate);
}

animate();
