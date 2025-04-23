import React, { useState, useEffect, useRef } from "react";
import MiniGL, { Pass, PingPongPass, Canvas, Image } from "./react/index.jsx";

// Base shader fragment
const baseShaderFragment = `#version 300 es
  precision highp float;
  
  uniform vec2 uResolution;
  uniform float uTime;
  
  in vec2 vTexCoord;
  out vec4 fragColor;
  
  // Correct aspect ratio calculations
  vec2 correctAspect(vec2 uv, float aspect) {
    // Center the coordinates
    vec2 centered = uv - 0.5;
    // Apply aspect ratio correction
    centered.y *= aspect;
    // Return to 0-1 range
    return centered + 0.5;
  }
  
  void main() {
    float aspect = uResolution.y / uResolution.x;
    
    // Get aspect-corrected coordinates
    vec2 uv = vTexCoord;
    vec2 uvCorrect = correctAspect(uv, aspect);
    
    // Create a gradient background
    vec3 color1 = vec3(0.2, 0.4, 0.8);
    vec3 color2 = vec3(0.8, 0.2, 0.4);
    
    // Oscillating gradient
    float t = (sin(uTime * 0.001) + 1.0) * 0.5;
    vec3 color = mix(color1, color2, t * uv.x + (1.0 - t) * uv.y);
    
    // Add some circles with proper aspect ratio
    float d1 = distance(uvCorrect, vec2(0.3 + 0.2 * sin(uTime * 0.002), 0.3 + 0.2 * cos(uTime * 0.001)));
    float d2 = distance(uvCorrect, vec2(0.7 + 0.2 * cos(uTime * 0.002), 0.7 + 0.2 * sin(uTime * 0.001)));
    
    if (d1 < 0.1) color = vec3(1.0, 1.0, 1.0) - color;
    if (d2 < 0.1) color = vec3(1.0, 1.0, 1.0) - color;
    
    fragColor = vec4(color, 1.0);
  }
`;

// Texture shader fragment
const textureShaderFragment = `#version 300 es
  precision highp float;
  
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uTime;
  
  in vec2 vTexCoord;
  out vec4 fragColor;
  
  void main() {
    float aspect = uResolution.y / uResolution.x;
    
    // Compute distorted UV coordinates
    vec2 uv = vTexCoord;
    float distX = sin(uv.y * 10.0 + uTime * 0.001) * 0.01;
    float distY = cos(uv.x * 10.0 + uTime * 0.001) * 0.01;
    
    vec2 distortedUV = vec2(uv.x + distX, uv.y + distY);
    
    // Sample the texture with distorted coordinates
    vec4 texColor = texture(uTexture, distortedUV);
    
    // Add time-based color modulation
    float t = sin(uTime * 0.001) * 0.5 + 0.5;
    vec3 tint = mix(vec3(1.0, 0.8, 0.8), vec3(0.8, 0.8, 1.0), t);
    
    fragColor = vec4(texColor.rgb * tint, texColor.a);
  }
`;

// Canvas drawing function
const drawCanvas = (ctx, width, height, gl) => {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Set gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#3498db");
  gradient.addColorStop(1, "#9b59b6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw some shapes
  const time = Date.now() * 0.001;

  // Draw circles
  for (let i = 0; i < 20; i++) {
    const x = width * (0.5 + 0.3 * Math.cos(time + i * 0.5));
    const y = height * (0.5 + 0.3 * Math.sin(time + i * 0.5));
    const radius = 20 + 10 * Math.sin(time * 2 + i);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(time * 50 + i * 20) % 360}, 80%, 60%, 0.7)`;
    ctx.fill();
  }

  // Draw some text
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("Canvas Texture", width / 2, height / 2);

  // If we have access to gl instance, we can use its properties
  if (gl) {
    // Show mouse position
    const { mouseX, mouseY } = gl;
    if (mouseX !== undefined && mouseY !== undefined) {
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "white";
      ctx.fillText(
        `Mouse: ${mouseX.toFixed(2)}, ${mouseY.toFixed(2)}`,
        width / 2,
        height - 20
      );
    }

    // Show time from gl
    ctx.fillText(
      `Time: ${(gl.time * 0.001).toFixed(1)}s`,
      width / 2,
      height - 40
    );
  }
};

// Canvas drawing function (static version)
const drawStaticCanvas = (ctx, width, height) => {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Set gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#2ecc71");
  gradient.addColorStop(1, "#e74c3c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw a pattern
  const size = 30;

  for (let x = 0; x < width; x += size) {
    for (let y = 0; y < height; y += size) {
      // Checker pattern
      if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  // Draw some text
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("Static Canvas", width / 2, height / 2);
};

// Animated pattern drawing function
const drawAnimatedPattern = (ctx, width, height, time) => {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Set gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#3498db");
  gradient.addColorStop(1, "#e67e22");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Calculate time value
  const t = time ? time * 0.005 : Date.now() * 0.0005;

  // Draw animated pattern
  const gridSize = 20;
  for (let x = 0; x < width; x += gridSize) {
    for (let y = 0; y < height; y += gridSize) {
      const distance = Math.sqrt(
        Math.pow(x - width / 2, 2) + Math.pow(y - height / 2, 2)
      );
      const offset = Math.sin(distance * 0.05 + t) * 10;

      ctx.fillStyle = `hsl(${(t * 50 + distance) % 360}, 70%, 60%, 0.7)`;
      ctx.beginPath();
      ctx.arc(x + offset, y + offset, gridSize * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw text
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("Animated Pattern", width / 2, height / 2);
};

// Ripple effect fragment
const rippleFragment = `#version 300 es
  precision highp float;
  
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uMouse;
  
  in vec2 vTexCoord;
  out vec4 fragColor;
  
  void main() {
    float aspect = uResolution.y / uResolution.x;
    
    vec2 uv = vTexCoord;
    vec2 uvAspect = uv;
    uvAspect.y *= aspect;
    
    vec2 mouse = uMouse;
    mouse.y *= aspect;
    
    float dist = distance(uvAspect, mouse);
    
    // Create ripple effect
    float ripple = sin(dist * 40.0 - uTime * 0.02) * 0.005;
    float mask = smoothstep(0.5, 0.0, dist); // Fade out with distance
    
    uv += ripple * mask * vec2(cos(uv.x * 20.0), sin(uv.y * 20.0));
    
    vec4 color = texture(uTexture, uv);
    
    // Add a subtle highlight at ripple center
    color.rgb += 0.1 * vec3(0.5, 0.8, 1.0) * (1.0 - smoothstep(0.0, 0.1, dist));
    
    fragColor = color;
  }
`;

// RGB Split effect fragment
const rgbSplitFragment = `#version 300 es
  precision highp float;
  
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uAmount;
  
  in vec2 vTexCoord;
  out vec4 fragColor;
  
  void main() {
    float aspect = uResolution.y / uResolution.x;
    vec2 uv = vTexCoord;
    
    // Calculate shift amount
    float amount = uAmount + 0.003 * sin(uTime * 0.001);
    
    // Apply RGB channel splitting with aspect ratio correction
    float r = texture(uTexture, vec2(uv.x + amount, uv.y)).r;
    float g = texture(uTexture, uv).g;
    float b = texture(uTexture, vec2(uv.x - amount, uv.y)).b;
    
    // Create vignette effect
    vec2 uvNorm = uv * 2.0 - 1.0;
    uvNorm.y *= aspect;
    float vignetteAmount = 1.0 - dot(uvNorm, uvNorm) * 0.5;
    
    vec3 color = vec3(r, g, b) * vignetteAmount;
    
    fragColor = vec4(color, 1.0);
  }
`;

// Flowmap shader
const flowmapShader = `#version 300 es
  precision highp float;

  in vec2 vTexCoord;
  uniform sampler2D uPrevious; 
  uniform vec2 uMouse;         
  uniform vec2 uVelocity;      
  uniform vec2 uResolution;    
  uniform float uTime;         
  
  uniform float uFalloff;
  uniform float uAlpha;
  uniform float uDissipation;

  out vec4 fragColor;
  
  const vec2 vFactor = vec2(10.);
  
  void main() {
    // Calculate proper aspect ratio
    float aspect = uResolution.y / uResolution.x;
    
    // Sample the previous state
    vec4 color = texture(uPrevious, vTexCoord) * uDissipation;
    
    // Apply aspect ratio to positions
    vec2 pos = vTexCoord;
    vec2 mouse = uMouse;
    
    // Calculate cursor vector with aspect ratio correction
    vec2 cursor = pos - mouse;
    cursor.y *= aspect;
    
    // Create stamp based on velocity
    vec2 vel = uVelocity;
    vel.y *= aspect; // Correct velocity aspect ratio
    
    vec3 stamp = vec3(vel * vFactor * vec2(1, -1), 1.0 - pow(1.0 - min(1.0, length(vel * vFactor)), 3.0));
    float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
    
    color.rgb = mix(color.rgb, stamp, vec3(falloff));
    
    fragColor = color;
  }
`;

// Flowmap visualization shader
const flowmapVisualizationShader = `#version 300 es
  precision highp float;

  in vec2 vTexCoord;
  uniform sampler2D uTexture;  // Flowmap
  uniform vec2 uResolution;
  uniform float uTime;
  
  out vec4 fragColor;
  
  void main() {
    // Get flow data (R/G = velocity X/Y, B = intensity)
    vec3 flow = texture(uTexture, vTexCoord).rgb;
    
    // Calculate proper aspect ratio
    float aspect = uResolution.y / uResolution.x;
    
    // Create base color
    vec3 color = vec3(0.1);
    
    // Create pattern
    vec2 uv = vTexCoord;
    
    // Apply flow-based distortion with aspect ratio correction
    vec2 flowVec = flow.xy;
    flowVec.y *= aspect;
    uv += flowVec * 0.1;
    
    // Create circular pattern
    vec2 distFromCenter = uv - 0.5;
    distFromCenter.y *= aspect;
    
    float dist = length(distFromCenter);
    float circ = smoothstep(0.3, 0.28, dist) - smoothstep(0.28, 0.24, dist);
    color += vec3(0.1, 0.4, 0.7) * circ;
    
    // Add rays
    float angle = atan(distFromCenter.y, distFromCenter.x);
    float rays = abs(sin((angle * 10.0) + uTime * 0.005));
    rays = smoothstep(0.5, 0.8, rays) * smoothstep(0.4, 0.0, dist);
    color += vec3(0.7, 0.3, 0.1) * rays * (flow.b * 2.0 + 0.5);
    
    // Highlight flow intensity
    color.rgb += flow.b * vec3(0.8, 0.2, 0.3) * 0.3;
    
    fragColor = vec4(color, 1.0);
  }
`;

function App() {
  const [effectAmount, setEffectAmount] = useState(0.007);
  const clockRef = useRef(0);

  // Clock updater for animations
  useEffect(() => {
    let animationId;

    const updateClock = () => {
      clockRef.current += 1;
      animationId = requestAnimationFrame(updateClock);
    };

    animationId = requestAnimationFrame(updateClock);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  const containerStyle = {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "40px",
  };

  const canvasStyle = {
    width: "100%",
    aspectRatio: "16/9",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  };

  const titleStyle = {
    textAlign: "center",
    marginBottom: "10px",
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>MiniGL React Shader Pipeline</h1>

      {/* Basic Shader Example */}
      <div style={{ width: "100%" }}>
        <h2 style={titleStyle}>Basic Shader</h2>
        <MiniGL style={canvasStyle}>
          <Pass fragment={baseShaderFragment} id="basePass" />
        </MiniGL>
      </div>

      {/* Ripple Effect Example */}
      <div style={{ width: "100%" }}>
        <h2 style={titleStyle}>Ripple Effect</h2>
        <MiniGL style={canvasStyle}>
          <Pass fragment={baseShaderFragment} id="basePass" />
          <Pass fragment={rippleFragment} uniforms={{ uTexture: "basePass" }} />
        </MiniGL>
      </div>

      {/* RGB Split Example */}
      <div style={{ width: "100%" }}>
        <h2 style={titleStyle}>RGB Split Effect</h2>
        <div style={{ marginBottom: "10px", textAlign: "center" }}>
          <label>
            Effect Amount:
            <input
              type="range"
              min="0.001"
              max="0.02"
              step="0.001"
              value={effectAmount}
              onChange={(e) => setEffectAmount(parseFloat(e.target.value))}
              style={{ marginLeft: "10px", width: "200px" }}
            />
            {effectAmount.toFixed(3)}
          </label>
        </div>
        <MiniGL style={canvasStyle}>
          <Pass fragment={baseShaderFragment} id="basePass" />
          <Pass
            fragment={rgbSplitFragment}
            uniforms={{
              uTexture: "basePass",
              uAmount: effectAmount,
            }}
          />
        </MiniGL>
      </div>

      {/* Flowmap Example */}
      <div style={{ width: "100%" }}>
        <h2 style={titleStyle}>Flowmap Effect</h2>
        <MiniGL style={canvasStyle}>
          <PingPongPass
            fragment={flowmapShader}
            uniforms={{
              uFalloff: 0.3,
              uAlpha: 1.0,
              uDissipation: 0.98,
            }}
            options={{ format: "FLOAT" }}
            id="flowmap"
          />
          <Pass
            fragment={flowmapVisualizationShader}
            uniforms={{ uTexture: "flowmap" }}
          />
        </MiniGL>
      </div>
    </div>
  );
}

export default App;
