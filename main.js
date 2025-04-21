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

  const noisePass = gl.createShaderPass({
    fragmentShader: `#version 300 es
    precision highp float;

    in vec2 vTexCoord;
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uTime;

    out vec4 fragColor;

    float hash12(vec2 p){
      vec3 p3  = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      // Sample the flowmap and canvas texture
      vec2 position = gl_FragCoord.xy;
      fragColor = vec4(vec3(hash12(position)),1.);
    }`,
  });

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
      
      fragColor = newColor; // Make sure we output the actual trail data
    }`,
  });

  const visualizePass = gl.createShaderPass({
    fragmentShader: `#version 300 es
    precision highp float;

    in vec2 vTexCoord;
    uniform sampler2D uTexture;
    uniform sampler2D uNoiseTexture;
    uniform sampler2D uMouseTrailTexture;
    uniform vec2 uResolution;
    uniform float uTime;

    out vec4 fragColor;

    void main() {
      // Sample each texture independently
      vec4 defaultTex = texture(uTexture, vTexCoord);
      vec4 noiseTex = texture(uNoiseTexture, vTexCoord);
      vec4 trailTex = texture(uMouseTrailTexture, vTexCoord);
      
      // Debug output - split screen to show all textures
      if (vTexCoord.x < 0.33) {
        // Left third: show noise texture
        fragColor = noiseTex;
      } else if (vTexCoord.x < 0.66) {
        // Middle third: show trail texture
        fragColor = trailTex;
      } else {
        // Right third: show default texture
        fragColor = defaultTex;
      }
    }`,
    uniforms: {
      uNoiseTexture: noisePass,
      uMouseTrailTexture: mouseTrailPass,
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
