import miniGL from "./miniGL.js";
(async () => {
  const gl = new miniGL("glCanvas");

  const blankTexture = gl.canvasTexture((ctx, width, height) => {
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, width, height);
  });

  // Create a dynamic canvas texture
  const myTexture = gl.canvasTexture(
    // Initial draw function
    (ctx, width, height) => {
      ctx.fillStyle = "blue";
      ctx.fillRect(0, 0, width, height);
    },
    {
      // Update function that will be called each frame
      update: (ctx, width, height, time) => {
        ctx.fillStyle = "blue";
        ctx.fillRect(0, 0, width, height);

        // Draw something that changes over time
        ctx.fillStyle = "white";
        const x = (Math.sin(time * 0.01) * width) / 2 + width / 2;
        ctx.beginPath();
        ctx.arc(x, height / 2, 20, 0, Math.PI * 2);
        ctx.fill();
      },
    }
  );

  const mouseTrailPass = gl.createPingPongPass({
    fragmentShader: `#version 300 es
    precision highp float;
  
    in vec2 vTexCoord;
    uniform sampler2D uPrevious; // Previous frame
    uniform vec2 uMouse;         // Current mouse position
    uniform vec2 uResolution;    // Canvas dimensions
    uniform float uTime;         // Time for animation
    
    out vec4 fragColor;
    
    void main() {
      // Sample the previous frame's state
      vec4 prevColor = texture(uPrevious, vTexCoord);
      
      // Slightly decay the previous frame (fade effect)
      prevColor *= 0.97;
      
      // Calculate distance from current mouse position
      float aspect = uResolution.x / uResolution.y;
      vec2 mousePos = vec2(uMouse.x, uMouse.y);
      vec2 st = vTexCoord;
      
      // Correct for aspect ratio by scaling the x coordinate
      // This ensures our distance calculation creates a perfect circle
      vec2 aspectCorrectedSt = vec2(st.x * aspect, st.y);
      vec2 aspectCorrectedMouse = vec2(mousePos.x * aspect, mousePos.y);
      
      // Draw new particles at mouse position
      float trail = 0.0;
      float dist = distance(aspectCorrectedSt, aspectCorrectedMouse);
      float mouseRadius = 0.1; // Size of the mouse trail dot
      
      // Draw trail only when within the radius
      if (dist < mouseRadius) {
        trail = smoothstep(mouseRadius, 0.0, dist);
      }
      
      // Add the new trail to the previous state
      vec4 newColor = prevColor;
      newColor.r += trail * 0.7; // Add to the red channel (for a basic flowmap)
      
      // Ensure we don't go above 1.0
      newColor = min(newColor, 1.0);
      
      fragColor = newColor;
    }`,
  });

  const visualizePass = gl.createShaderPass({
    fragmentShader: `#version 300 es
    precision highp float;
  
    in vec2 vTexCoord;
    uniform sampler2D uTexture;    // The flowmap from ping-pong pass
    uniform sampler2D uCanvasTexture; // Our dynamic canvas texture
    uniform vec2 uResolution;
    uniform float uTime;
    
    out vec4 fragColor;
    
    void main() {
      // Sample the flowmap and canvas texture
      vec4 flowMap = texture(uTexture, vTexCoord);
      vec4 canvasColor = texture(uCanvasTexture, vTexCoord);
      
      // Create a colorful visualization of the trail
      vec3 trailColor = vec3(0.0);
      
      // Use the red channel for intensity
      float intensity = flowMap.r;
      
      // Create rainbow-like color based on intensity and time
      vec3 color1 = vec3(0.2, 0.5, 1.0); // Blue-ish
      vec3 color2 = vec3(1.0, 0.4, 0.1); // Orange-ish
      
      trailColor = mix(color1, color2, intensity);
      
      // Add some shimmer effect with time
      float shimmer = sin(uTime * 0.05 + vTexCoord.x * 10.0) * 0.5 + 0.5;
      trailColor = mix(trailColor, vec3(shimmer), intensity * 0.3);
      
      // Combine with background
      vec3 bgColor = vec3(0.05);
      vec3 finalColor = mix(bgColor, trailColor, intensity * 1.2);
      
      // Layer the mouse trail on top of the canvas texture
      // Composite the trail over the canvas texture
      fragColor = vec4(mix(canvasColor.rgb, finalColor, intensity * 0.8), 1.0);
    }`,
    uniforms: {
      uCanvasTexture: myTexture,
    },
  });

  // Setup render loop
  const render = () => {
    gl.render();
    requestAnimationFrame(render);
  };

  // Handle window resizing
  window.addEventListener("resize", () => gl.resize());

  // Initial setup
  gl.resize();
  render();
})();
