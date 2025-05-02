import miniGL from "./miniGL.js";
(async () => {
  const gl = new miniGL("glCanvas");
  console.log(gl);
  // const blankTexture = gl.canvas((ctx, width, height) => {
  //   ctx.fillStyle = "rgba(0,0,0,0)";
  //   ctx.fillRect(0, 0, width, height);
  // });

  const flowmapPass = gl.pingpong({
    fragmentShader: `#version 300 es
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
      // Sample the previous state (equivalent to tMap)
      vec4 color = texture(uPrevious, vTexCoord) * uDissipation;
      vec2 cursor = vTexCoord - uMouse;
      float aspect = uResolution.x/uResolution.y;
      cursor.x *= aspect;

      vec3 stamp = vec3(uVelocity * vFactor * vec2(1, -1), 1.0 - pow(1.0 - min(1.0, length(uVelocity * vFactor)), 3.0));
      float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
      color.rgb = mix(color.rgb, stamp, vec3(falloff));
      
      fragColor = vec4(color.rgb,1.);
    }`,
    uniforms: {
      uFalloff: 0.45,
      uAlpha: 1,
      uDissipation: 0.98,
    },
    format: gl.FLOAT,
  });

  const noisePass = gl.shader({
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

  const waterTexture = gl.createCanvasTexture((ctx, width, height) => {
    // Create a blue water-like texture with some patterns
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1E3B70");
    gradient.addColorStop(1, "#2389DA");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add some wave patterns
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;

    for (let i = 0; i < 10; i++) {
      const y = i * (height / 10) + Math.sin(i * 0.7) * 20;
      ctx.beginPath();
      ctx.moveTo(0, y);

      for (let x = 0; x < width; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.02) * 10);
      }

      ctx.stroke();
    }
  });

  const visualizePass = gl.shader({
    fragmentShader: `#version 300 es
    precision highp float;

    uniform vec2 glCoord;
    uniform sampler2D uTexture;
    uniform sampler2D uNoiseTexture;
    uniform sampler2D uMouseTrailTexture;
    uniform sampler2D uWaterTexture;
    uniform vec2 uResolution;
    uniform float uTime;

    out vec4 fragColor;

    void main() {
      // Get flow data
      vec3 flow = texture(uMouseTrailTexture, glCoord).rgb;
      vec3 water = texture(uWaterTexture, glCoord).rgb;
      fragColor = vec4(water, 1.0);
    }`,
    uniforms: {
      uNoiseTexture: noisePass,
      uMouseTrailTexture: flowmapPass,
      uWaterTexture: waterTexture,
    },
  });
  gl.output(visualizePass);
  const render = () => {
    gl.render();
    requestAnimationFrame(render);
  };
  render();
})();
