// Timeline demo for miniGL
import miniGL from "../lib/miniGL/miniGL.js";
import { Timeline } from "../lib/miniGL/Timeline.js";

// Create a miniGL instance
const gl = new miniGL("canvas");

// Create some shader nodes
const redNode = gl.shader(
  `#version 300 es
precision highp float;
uniform float redIntensity;
out vec4 fragColor;
void main() {
  fragColor = vec4(redIntensity, 0.0, 0.0, 1.0);
}`,
  { uniforms: { redIntensity: 0.2 } }
);

const blueNode = gl.shader(
  `#version 300 es
precision highp float;
uniform vec2 center;
uniform float radius;
in vec2 glCoord;
out vec4 fragColor;
void main() {
  float dist = distance(glCoord, center);
  float circle = smoothstep(radius + 0.01, radius, dist);
  fragColor = vec4(0.0, 0.0, circle, 1.0);
}`,
  { uniforms: { center: { x: 0.5, y: 0.5 }, radius: 0.1 } }
);

// Create a blend node to combine them
const blendNode = gl.blend({ blendMode: "add" });
blendNode.connect("glBase", redNode);
blendNode.connect("glBlend", blueNode);

// Set as output
gl.setOutput(blendNode);

// Create a timeline
const timeline = new Timeline();

// Animate the red intensity from 0.0 to 1.0 over 60 frames
timeline.tween(
  redNode,
  "uniforms.redIntensity",
  0.0,
  1.0,
  0,
  60,
  "easeInOutQuad"
);

// Animate the circle position
timeline.tween(
  blueNode,
  "uniforms.center",
  { x: 0.2, y: 0.2 }, // from
  { x: 0.8, y: 0.8 }, // to
  30,
  120, // start frame, duration
  "easeOutCubic"
);

// Animate the circle radius
timeline.tween(blueNode, "uniforms.radius", 0.05, 0.3, 0, 90);

// Make it loop
timeline.setLoop(true);

// Start the timeline
timeline.play();

// Animation loop
function animate() {
  // Update the timeline with the current frame
  timeline.update(gl.clock);

  // Render the frame
  gl.render();
  requestAnimationFrame(animate);
}

animate();
