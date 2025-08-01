import miniGL from "../../../lib/miniGL/miniGL.js";

const gl = new miniGL("fluidCanvas");

// Simulation parameters
const params = {
  text: "FLUID",
  fontSize: 80,
  color: { r: 1, g: 0.0, b: 0.5 },
  pointerSize: 0.004,
  dt: 1.0 / 60.0,
  pressureIterations: 10,
  velocityDissipation: 0.96,
  colorDissipation: 0.96,
  viscosity: 0.02, // Added for UI controls
};

// Mouse tracking
const pointer = {
  x: 0.5,
  y: 0.5,
  dx: 0,
  dy: 0,
  moved: false,
};

// Create text canvas
const textCanvas = gl.canvas2D(
  (ctx, width, height) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    ctx.font = `bold ${params.fontSize}px Arial`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.filter = "blur(3px)";

    ctx.fillText(params.text, width / 2, height / 2);
  },
  { name: "Text Canvas" }
);

// Velocity field (ping-pong buffer for advection)
const velocityField = gl.pingpong(
  `#version 300 es
  precision highp float;
  uniform sampler2D glPrevious;
  uniform sampler2D u_velocity_texture;
  uniform sampler2D u_text_texture;
  uniform vec2 glPixel;
  uniform float u_dt;
  uniform float u_dissipation;
  uniform float u_use_text;
  
  // Mouse splat uniforms
  uniform vec2 u_point;
  uniform vec3 u_point_value;
  uniform float u_point_size;
  uniform float glRatio;
  uniform float u_splat_active;
  
  in vec2 glUV;
  out vec4 fragColor;
  
  vec4 bilerp(sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    
    vec4 a = texture(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }
  
  void main() {
    // Advection
    vec2 coord = glUV - u_dt * bilerp(u_velocity_texture, glUV, glPixel).xy * glPixel;
    float text = texture(u_text_texture, vec2(glUV.x, 1.0 - glUV.y)).r;
    float dissipation = u_dissipation + text * 0.04 * u_use_text;
    
    vec4 advected = dissipation * bilerp(u_velocity_texture, coord, glPixel);
    
    // Apply mouse splat
    vec2 p = glUV - u_point;
    p.x *= glRatio;
    vec3 splat = pow(2.0, -dot(p, p) / u_point_size) * u_point_value * u_splat_active;
    splat *= (0.7 + 0.2 * text);
    
    fragColor = vec4(advected.xy + splat.xy, 0.0, 1.0);
  }
`,
  {
    u_dt: params.dt,
    u_dissipation: params.velocityDissipation,
    u_use_text: 0.0,
    u_point: { x: 0.5, y: 0.5 },
    u_point_value: { x: 0, y: 0, z: 0 },
    u_point_size: params.pointerSize,
    u_splat_active: 0.0,
  },
  {
    name: "Velocity Field",
    format: "FLOAT",
    filter: "NEAREST",
  }
);

// Divergence computation
const divergenceNode = gl.shader(
  `#version 300 es
  precision highp float;
  uniform sampler2D u_velocity_texture;
  uniform vec2 glPixel;
  
  in vec2 glUV;
  out vec4 fragColor;
  
  void main() {
    vec2 texel = glPixel;
    
    float L = texture(u_velocity_texture, glUV - vec2(texel.x, 0.0)).x;
    float R = texture(u_velocity_texture, glUV + vec2(texel.x, 0.0)).x;
    float T = texture(u_velocity_texture, glUV + vec2(0.0, texel.y)).y;
    float B = texture(u_velocity_texture, glUV - vec2(0.0, texel.y)).y;
    
    float div = 0.6 * (R - L + T - B);
    fragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`,
  {},
  {
    name: "Divergence",
    format: "FLOAT",
    filter: "NEAREST",
  }
);

// Pressure field (ping-pong buffer for Jacobi iteration)
const pressureField = gl.pingpong(
  `#version 300 es
  precision highp float;
  uniform sampler2D glPrevious;
  uniform sampler2D u_divergence_texture;
  uniform sampler2D u_text_texture;
  uniform vec2 glPixel;
  
  in vec2 glUV;
  out vec4 fragColor;
  
  void main() {
    vec2 texel = glPixel;
    
    float L = texture(glPrevious, glUV - vec2(texel.x, 0.0)).x;
    float R = texture(glPrevious, glUV + vec2(texel.x, 0.0)).x;
    float T = texture(glPrevious, glUV + vec2(0.0, texel.y)).x;
    float B = texture(glPrevious, glUV - vec2(0.0, texel.y)).x;
    float divergence = texture(u_divergence_texture, glUV).x;
    float text = texture(u_text_texture, vec2(glUV.x, 1.0 - glUV.y)).r;
    
    float pressure = (L + R + B + T - divergence) * 0.25;
    pressure += 0.2 * text;
    
    fragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`,
  {},
  {
    name: "Pressure Field",
    format: "FLOAT",
    filter: "NEAREST",
  }
);

// Gradient subtraction
const gradientSubtractNode = gl.shader(
  `#version 300 es
  precision highp float;
  uniform sampler2D u_pressure_texture;
  uniform sampler2D u_velocity_texture;
  uniform vec2 glPixel;
  
  in vec2 glUV;
  out vec4 fragColor;
  
  void main() {
    vec2 texel = glPixel;
    
    float L = texture(u_pressure_texture, glUV - vec2(texel.x, 0.0)).x;
    float R = texture(u_pressure_texture, glUV + vec2(texel.x, 0.0)).x;
    float T = texture(u_pressure_texture, glUV + vec2(0.0, texel.y)).x;
    float B = texture(u_pressure_texture, glUV - vec2(0.0, texel.y)).x;
    
    vec2 velocity = texture(u_velocity_texture, glUV).xy;
    velocity.xy -= vec2(R - L, T - B);
    
    fragColor = vec4(velocity, 0.0, 1.0);
  }
`,
  {},
  {
    name: "Gradient Subtract",
    format: "FLOAT",
    filter: "NEAREST",
  }
);

// Color field (ping-pong buffer for advection)
const colorField = gl.pingpong(
  `#version 300 es
  precision highp float;
  uniform sampler2D glPrevious;
  uniform sampler2D u_velocity_texture;
  uniform sampler2D u_text_texture;
  uniform vec2 glPixel;
  uniform float u_dt;
  uniform float u_dissipation;
  
  // Mouse splat uniforms
  uniform vec2 u_point;
  uniform vec3 u_point_value;
  uniform float u_point_size;
  uniform float glRatio;
  uniform float u_splat_active;
  
  in vec2 glUV;
  out vec4 fragColor;
  
  vec4 bilerp(sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    
    vec4 a = texture(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }
  
  void main() {
    // Advection
    vec2 coord = glUV - u_dt * bilerp(u_velocity_texture, glUV, glPixel).xy * glPixel;
    float text = texture(u_text_texture, vec2(glUV.x, glUV.y)).r;
    float dissipation = u_dissipation + text * 0.04;
    
    vec4 advected = dissipation * bilerp(glPrevious, coord, glPixel);
    
    // Apply mouse splat
    vec2 p = glUV - u_point;
    p.x *= glRatio;
    vec3 splat = pow(2.0, -dot(p, p) / u_point_size) * u_point_value * u_splat_active;
    splat *= (0.7 + 0.2 * text);
    
    fragColor = vec4(advected.rgb + splat, 1.0);
  }
`,
  {
    u_dt: params.dt,
    u_dissipation: params.colorDissipation,
    u_point: { x: 0.5, y: 0.5 },
    u_point_value: { x: 0, y: 0, z: 0 },
    u_point_size: params.pointerSize,
    u_splat_active: 0.0,
  },
  {
    name: "Color Field",
    format: "FLOAT",
    filter: "NEAREST",
  }
);

// Final output shader
const outputShader = gl.shader(
  `#version 300 es
  precision highp float;
  uniform sampler2D u_output_texture;
  uniform sampler2D u_text_texture;
  
  in vec2 glUV;
  out vec4 fragColor;
  
  void main() {
    vec3 color = texture(u_output_texture, glUV).rgb;
    float text = texture(u_text_texture, vec2(glUV.x, glUV.y)).r;
    
    fragColor = vec4(vec3(1.0) - color, 1.0);
  }
`,
  {},
  { name: "Output" }
);

// Connect the pipeline
gl.connect(textCanvas, velocityField, "u_text_texture");
gl.connect(textCanvas, pressureField, "u_text_texture");
gl.connect(textCanvas, colorField, "u_text_texture");
gl.connect(textCanvas, outputShader, "u_text_texture");

// Velocity -> Divergence
gl.connect(velocityField, divergenceNode, "u_velocity_texture");

// Divergence -> Pressure (for Jacobi iteration)
gl.connect(divergenceNode, pressureField, "u_divergence_texture");

// Pressure + Velocity -> Gradient Subtract
gl.connect(pressureField, gradientSubtractNode, "u_pressure_texture");
gl.connect(velocityField, gradientSubtractNode, "u_velocity_texture");

// Gradient Subtract -> Velocity (for next frame)
gl.connect(gradientSubtractNode, velocityField, "u_velocity_texture");

// Velocity -> Color (for advection)
gl.connect(velocityField, colorField, "u_velocity_texture");

// Color -> Output
gl.connect(colorField, outputShader, "u_output_texture");

// Set final output
gl.output(outputShader);

// Mouse interaction
let isPreview = true;

gl.onFrame((time, timestamp) => {
  // Auto-movement for preview
  if (isPreview) {
    updateMousePosition(
      (0.5 - 0.45 * Math.sin(0.003 * timestamp - 2)) * window.innerWidth,
      (0.5 +
        0.1 * Math.sin(0.0025 * timestamp) +
        0.1 * Math.cos(0.002 * timestamp)) *
        window.innerHeight
    );
  }

  // Handle mouse splats
  if (pointer.moved) {
    if (!isPreview) {
      pointer.moved = false;
    }

    // Update velocity splat
    velocityField.updateUniform("u_point", { x: pointer.x, y: 1 - pointer.y });
    velocityField.updateUniform("u_point_value", {
      x: pointer.dx,
      y: -pointer.dy,
      z: 1,
    });
    velocityField.updateUniform("u_splat_active", 1.0);

    // Update color splat
    colorField.updateUniform("u_point", { x: pointer.x, y: 1 - pointer.y });
    colorField.updateUniform("u_point_value", {
      x: 1 - params.color.r,
      y: 1 - params.color.g,
      z: 1 - params.color.b,
    });
    colorField.updateUniform("u_splat_active", 1.0);
  } else {
    // Disable splats
    velocityField.updateUniform("u_splat_active", 0.0);
    colorField.updateUniform("u_splat_active", 0.0);
  }
});

// Event handlers
function updateMousePosition(x, y) {
  const rect = gl.canvas.getBoundingClientRect();
  const normalizedX = x / rect.width;
  const normalizedY = y / rect.height;

  pointer.moved = true;
  pointer.dx = 5 * (normalizedX - pointer.x);
  pointer.dy = 5 * (normalizedY - pointer.y);
  pointer.x = normalizedX;
  pointer.y = normalizedY;
}

// Mouse events
gl.canvas.addEventListener("mousemove", (e) => {
  isPreview = false;
  updateMousePosition(e.clientX, e.clientY);
});

gl.canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  isPreview = false;
  updateMousePosition(e.touches[0].clientX, e.touches[0].clientY);
});

// Resize handler
gl.onResize((width, height) => {
  params.pointerSize = 4 / height;
  velocityField.updateUniform("u_point_size", params.pointerSize);
  colorField.updateUniform("u_point_size", params.pointerSize);

  // Update text canvas
  textCanvas.update((ctx, w, h) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, w, h);

    ctx.font = `bold ${params.fontSize}px Arial`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.filter = "blur(3px)";

    ctx.fillText(params.text, w / 2, h / 2);
  });
});

console.log("miniGL Fluid Simulation loaded");

// Export for potential GUI controls
export { params, velocityField, colorField };
