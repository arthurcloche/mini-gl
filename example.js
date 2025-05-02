import miniGL from "./miniGL.js";
import miniChunks from "./miniChunks.js";

// Example HTML/CSS for properly sizing the canvas:
/*
  <style>
    #container {
      width: 800px;
      height: 600px;
      margin: 0 auto;
      border: 1px solid #333;
    }
    #canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>

  <div id="container">
    <canvas id="canvas"></canvas>
  </div>
*/

// Initialize miniGL
const gl = new miniGL("canvas");
gl.useChunks(miniChunks);

// 1. Create a shader for generating noise
const noiseShader = `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform float glRatio;
in vec2 glCoord; // Square aspect ratio UVs
in vec2 glUV;
out vec4 fragColor;

<#noise.random>
<#noise.noise>
<#noise.fbm>

void main() {
  // Use glCoord for square pixel coordinates
  vec2 st = glUV;
  
  // Animate the noise by moving through the noise field
  vec2 motion = vec2(glTime * 0.1);
  
  // Generate the noise value
  float n = fbm(st * 3.0 + motion);
  
  // Output the noise as grayscale
  fragColor = vec4(vec3(n), 1.0);
}`;

// Create a flowmap shader for tracking mouse movement
const flowmapShader = `#version 300 es
precision highp float;

uniform sampler2D glPrevious; 
uniform vec3 glMouse;         
uniform vec2 glVelocity;      
uniform vec2 glResolution;
uniform float glRatio;    
uniform float glTime;
uniform float uFalloff;
uniform float uAlpha;
uniform float uDissipation;
uniform vec2 uVelocity;
in vec2 glUV;
in vec2 glCoord;
    
out vec4 fragColor;

const vec2 vFactor = vec2(10.0);

void main() {
  // Sample the previous state with dissipation
  vec4 color = texture(glPrevious, glUV) * uDissipation;
  
  // Get cursor position relative to current pixel
  vec2 cursor = glCoord - vec2(glMouse.x, glMouse.y);
  
  // Create stamp based on velocity
  vec3 stamp = vec3(
    uVelocity * vFactor * vec2(1.0, -1.0), 
    1.0 - pow(1.0 - min(1.0, length(uVelocity * vFactor)), 3.0)
  );
  
  
  float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
  
  // Mix previous state with new stamp
  color.rgb = mix(color.rgb, stamp, vec3(falloff));
  
  fragColor = color;
}`;

// 2. Create a shader for applying color effects using the noise and flowmap
const colorEffectShader = `#version 300 es
precision highp float;

uniform sampler2D uNoise;
uniform sampler2D uFlowmap;
uniform vec2 glResolution;
uniform float glTime;
uniform vec3 glMouse;
uniform vec2 glVelocity;
uniform vec2 glPixel;
uniform float glRatio;
uniform float glDistortStrength;
in vec2 glUV;
in vec2 glCoord;

<#math.constants>
<#color.hsv>

out vec4 fragColor;

void main() {
  // Get flowmap data - RG channels contain motion vectors
  vec4 flowData = texture(uFlowmap, glUV);
  vec2 flowVector = flowData.rg;
  float flowIntensity = flowData.b;
  
  // Apply a very subtle distortion to coordinates
  vec2 distortedCoord = glCoord + flowVector * glDistortStrength;
  
  // Create a circle in the center
  float circle = smoothstep(0.25, 0.251, length(distortedCoord - 0.5));
  
  // Base color is white with subtle tint from flowmap
  vec3 baseColor = vec3(0.9);
  
  // Create a subtle RGB gradient from flow vectors
  vec3 flowColor = vec3(
    0.5 + flowVector.x * 0.5,     // R: horizontal movement
    0.5 + flowVector.y * 0.5,     // G: vertical movement
    0.5 + flowIntensity * 0.5     // B: intensity
  );
  
  // Apply flow gradient only where there is flow
  float flowAmount = clamp(length(flowVector) * 5.0, 0.0, 0.3);
  
  // Final color combines the circle with subtle flow visualization
  vec3 finalColor = mix(baseColor, flowColor, flowAmount);
  finalColor = mix(finalColor * 0.95, finalColor, circle);
  
  fragColor = flowData;
}`;

// 3. Create nodes and connect them
const noiseNode = gl.shader(noiseShader, { name: "Noise Generator" });
const blankTexture = gl.canvas2D((ctx, width, height) => {
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, width, height);
});
// Create flowmap with feedback pass
const flowmapNode = gl.pingpong(flowmapShader, {
  name: "Flowmap Generator",
  uniforms: {
    uFalloff: 0.4, // Slightly wider falloff
    uAlpha: 1, // Lower intensity
    uDissipation: 0.99, // Slightly more persistent
    uVelocity: [0, 0],
  },
  type: "FLOAT",
  //   filter: "gl.LINEAR",
});

// Create color effect pass with much lower distortion
const colorNode = gl.shader(colorEffectShader, {
  name: "Color Effect",
  uniforms: {
    glDistortStrength: 0.01, // Significantly reduced distortion
  },
});

// Connect nodes
// gl.connect(noiseNode, colorNode, "uNoise");
// gl.connect(flowmapNode, colorNode, "uFlowmap");
gl.output(flowmapNode);

// Animation loop
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function len(x, y) {
  const epsilon = 1e-10; // Smaller epsilon for squared values
  return x * x + y * y > epsilon;
}

function animate() {
  const vellen = len(gl.mouseVelocity.x, gl.mouseVelocity.y);

  const velx = lerp(
    gl.mouseVelocity.x,
    flowmapNode.uniforms["uVelocity"][0],
    vellen > 0 ? 0.9 : 0.2
  );
  const vely = lerp(
    gl.mouseVelocity.y,
    flowmapNode.uniforms["uVelocity"][1],
    vellen > 0 ? 0.9 : 0.2
  );
  flowmapNode.updateUniform("uVelocity", [velx, vely]);
  gl.render();
  requestAnimationFrame(animate);
}

// Start the animation
animate();

// Info about available node types
console.log(`
miniGL Node API - Available methods:

// Create nodes
const shaderNode = gl.shader(fragmentShaderSource, options);
const feedbackNode = gl.ping(fragmentShaderSource, options);
const imageNode = gl.image(url, options);
const canvasNode = gl.canvas(drawCallback, options);
const blendNode = gl.blend({ blendMode: "screen", opacity: 0.8 });

// Use shader snippets with tag syntax
const shader = gl.shader(\`
  #version 300 es
  precision highp float;
  out vec4 fragColor;
  
  <#noise.fbm>  // Include noise.fbm snippet
  <#color.hsv>  // Include color.hsv snippet
  
  void main() {
    // Your shader code using imported functions
  }
\`);

// Connect nodes 
gl.connect(sourceNode, targetNode, "inputName");

// Control observers
gl.ignoreIntersection(); // Disable the intersection observer to always render
gl.ignoreResize();       // Disable the resize handler for manual control
`);

// --- TEST 1: Three shader nodes (A, B, C), blend together ---
const circleShader = (color, id) => `#version 300 es
precision highp float;
in vec2 glCoord;
uniform float glTime;
out vec4 fragColor;
void main() {
  float d = length(glCoord - vec2(0.5, 0.5 + sin(glTime* 0.01+${id}/6.)*.125));
  float circle = smoothstep(0.25, 0.2, d);
  fragColor = vec4(${color}, 1.0) * circle;
}`;

const nodeA = gl.shader(circleShader("1.0,0.0,0.0", "0."), {
  name: "Red Circle",
});
const nodeB = gl.shader(circleShader("0.0,1.0,0.0", "1."), {
  name: "Green Circle",
});
const nodeC = gl.shader(circleShader("0.0,0.0,1.0", "2."), {
  name: "Blue Circle",
});

const blendAB = gl.blend({ blendMode: "add", name: "A+B" });
gl.connect(nodeA, blendAB, "glBase");
gl.connect(nodeB, blendAB, "glBlend");

const blendABC = gl.blend({ blendMode: "add", name: "A+B+C" });
gl.connect(blendAB, blendABC, "glBase");
gl.connect(nodeC, blendABC, "glBlend");

// gl.output(blendABC);

// --- TEST 2: MRT node, 3 outputs, sum in output node ---
const mrtShader = `#version 300 es
precision highp float;
in vec2 glUV;
layout(location = 0) out vec4 outR;
layout(location = 1) out vec4 outG;
layout(location = 2) out vec4 outB;
void main() {
  float d = length(glUV - 0.5);
  float circle = smoothstep(0.25, 0.24, d);
  outR = vec4(1.0, 0.0, 0.0, 1.0) * circle;
  outG = vec4(0.0, 1.0, 0.0, 1.0) * circle;
  outB = vec4(0.0, 0.0, 1.0, 1.0) * circle;
}`;

const mrtNode = gl.mrt(mrtShader, { numTargets: 3, name: "MRT Circle" });

const sumShader = `#version 300 es
precision highp float;
uniform sampler2D texR;
uniform sampler2D texG;
uniform sampler2D texB;
in vec2 glCoord;
out vec4 fragColor;
void main() {
  vec4 r = texture(texR, glCoord);
  vec4 g = texture(texG, glCoord);
  vec4 b = texture(texB, glCoord);
  fragColor = r + g + b;
}`;

const sumNode = gl.shader(sumShader, { name: "Sum MRT" });
gl.connect(mrtNode, sumNode, "texR", "0");
gl.connect(mrtNode, sumNode, "texG", "1");
gl.connect(mrtNode, sumNode, "texB", "2");
// Uncomment to test MRT output:
// gl.output(sumNode);
