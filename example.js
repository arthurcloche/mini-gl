import miniGL from "./miniGL.js";

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
uniform float glFalloff;
uniform float glAlpha;
uniform float glDissipation;
in vec2 glUV;
in vec2 glCoord;
    
out vec4 fragColor;

const vec2 vFactor = vec2(10.0);

void main() {
  // Sample the previous state with dissipation
  vec4 color = texture(glPrevious, glUV) * glDissipation;
  
  // Get cursor position relative to current pixel
  vec2 cursor = glCoord - vec2(glMouse.x, glMouse.y);
  
  // Create stamp based on velocity
  vec3 stamp = vec3(
    glVelocity * vFactor * vec2(1.0, -1.0), 
    1.0 - pow(1.0 - min(1.0, length(glVelocity * vFactor)), 3.0)
  );
  
  
  float falloff = smoothstep(glFalloff, 0.0, length(cursor)) * glAlpha;
  
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

// Create flowmap with feedback pass
const flowmapNode = gl.pingpong(flowmapShader, {
  name: "Flowmap Generator",
  uniforms: {
    glFalloff: 0.4, // Slightly wider falloff
    glAlpha: 1, // Lower intensity
    glDissipation: 0.99, // Slightly more persistent
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
gl.connect(noiseNode, colorNode, "uNoise");
gl.connect(flowmapNode, colorNode, "uFlowmap");
gl.output(colorNode);

// Animation loop
function animate() {
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
