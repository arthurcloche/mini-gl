import miniGL from "../../lib/miniGL.js";

document.addEventListener("DOMContentLoaded", () => {
  // Default configuration, similar to the original SplashCursor props
  const config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    CAPTURE_RESOLUTION: 512, // Currently unused
    DENSITY_DISSIPATION: 1.0, // Adjusted from 3.5 for potentially more visible dye
    VELOCITY_DISSIPATION: 0.5, // Adjusted from 2
    PRESSURE: 0.8, // Original: 0.1
    PRESSURE_ITERATIONS: 20,
    CURL: 15, // Original: 3
    SPLAT_RADIUS: 0.35, // Original: 0.2 / 100.0 -> very small, this is now direct scale for exp
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLOR_UPDATE_SPEED: 10,
    BACK_COLOR: { r: 0.0, g: 0.0, b: 0.0 },
    TRANSPARENT: true,
  };

  const canvas = document.getElementById("fluid-canvas");
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }

  const minigl = new miniGL("fluid-canvas");
  minigl.gl.clearColor(
    config.BACK_COLOR.r,
    config.BACK_COLOR.g,
    config.BACK_COLOR.b,
    config.TRANSPARENT ? 0.0 : 1.0
  );

  if (!minigl.floatSupported) {
    config.DYE_RESOLUTION = Math.min(config.DYE_RESOLUTION, 512);
    config.SIM_RESOLUTION = Math.min(config.SIM_RESOLUTION, 64);
    config.SHADING = false;
    config.CURL = 10;
    config.PRESSURE_ITERATIONS = 10;
    console.log(
      "Float textures not supported or linear filtering for float textures not supported, adjusting config."
    );
  }

  const pointer = {
    id: -1,
    texcoordX: 0.5,
    texcoordY: 0.5,
    prevTexcoordX: 0.5,
    prevTexcoordY: 0.5,
    deltaX: 0,
    deltaY: 0,
    down: false,
    moved: false,
    color: [0.0, 0.0, 0.0], // Initial color
    colorSplatDone: false, // Flag to check if color has been applied for current interaction
  };

  // --- UTILITY FUNCTIONS ---
  function getResolution(baseResolution, canvasWidth, canvasHeight) {
    const aspectRatio = canvasWidth / canvasHeight;
    if (aspectRatio < 1) {
      // Portrait or square
      return {
        width: Math.round(baseResolution * aspectRatio),
        height: baseResolution,
      };
    } else {
      // Landscape
      return {
        width: baseResolution,
        height: Math.round(baseResolution / aspectRatio),
      };
    }
  }

  function HSVtoRGB(h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
      default:
        r = 0;
        g = 0;
        b = 0;
        break;
    }
    return { r, g, b };
  }

  function generateColor() {
    let c = HSVtoRGB(Math.random(), 1.0, 1.0);
    c.r *= 0.15;
    c.g *= 0.15;
    c.b *= 0.15;
    return [c.r, c.g, c.b];
  }
  pointer.color = generateColor(); // Initial color

  function getNodeTexelSize(node) {
    return { x: 1 / node.width, y: 1 / node.height };
  }

  // --- SHADER DEFINITIONS ---
  const s_clear = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uTexture; // Not strictly needed for a full clear, but often present
      uniform float value;
      uniform vec4 clearColor;
      out vec4 fragColor;
      void main () {
          // fragColor = value * texture(uTexture, glUV); // If scaling existing
          fragColor = clearColor; // If clearing to a specific color
      }
  `;

  const s_display = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uTexture; 
      uniform vec2 displayTexelSize; // gl_Pixel equivalent for display shader if needed for effects
      uniform bool uShading;
      out vec4 fragColor;
      void main () {
          vec3 c = texture(uTexture, glUV).rgb;
          if (uShading) {
              // Simplified shading for performance, original was more complex
              vec2 vL = glUV - vec2(displayTexelSize.x, 0.0);
              vec2 vR = glUV + vec2(displayTexelSize.x, 0.0);
              vec2 vT = glUV + vec2(0.0, displayTexelSize.y);
              vec2 vB = glUV - vec2(0.0, displayTexelSize.y);
              float dx = texture(uTexture, vR).r - texture(uTexture, vL).r;
              float dy = texture(uTexture, vT).r - texture(uTexture, vB).r;
              vec3 n = normalize(vec3(dx * 20.0, dy * 20.0, 1.0)); // Arbitrary scaling for effect
              float diffuse = clamp(dot(n, normalize(vec3(0.5, 0.5, 1.0))) * 0.5 + 0.5, 0.5, 1.0);
              c *= diffuse;
          }
          float alpha = max(c.r, max(c.g, c.b)); // Simple alpha based on brightness
          fragColor = vec4(c, pow(alpha, 0.5)); // Make alpha less harsh
      }
  `;

  const s_splat = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uTarget; // Current state of the FBO being splatted into
      uniform float aspectRatio; 
      uniform vec3 splatColor;  // Color for dye, or dx,dy,0 for velocity
      uniform vec2 point;       // Normalized mouse coords
      uniform float radius;      // Splat radius
      out vec4 fragColor;
      void main () {
          vec2 p = glUV - point.xy;
          p.x *= aspectRatio;
          float distSq = dot(p, p);
          // Gaussian splat: exp(-distSq / (2 * sigma^2)) where radius can be ~3*sigma
          // Let radius be 2*sigma^2 for simplicity in parameter tuning
          vec3 splatValue = exp(-distSq / radius) * splatColor;
          vec3 base = texture(uTarget, glUV).rgb; // Read previous value, alpha is not usually used for vel/dye internal state
          fragColor = vec4(base + splatValue, 1.0); // Ensure full alpha for internal buffers
      }
  `;

  const s_advection = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uVelocity;        // Velocity field
      uniform sampler2D uSource;          // Texture to advect (dye or velocity itself)
      uniform vec2 velocityTexelSize;   // Texel size of the uVelocity map
      uniform float dt;                 // Delta time
      uniform float dissipation;        // Dissipation factor for the source
      out vec4 fragColor;
      void main () {
          vec2 offset = dt * texture(uVelocity, glUV).xy;
          // Velocity is in grid cells / time. Scale by texel size to get UV offset / time.
          offset *= velocityTexelSize; 
          vec2 coord = glUV - offset; // Backwards advection: where did this pixel come from?
          vec4 result = texture(uSource, coord);
          float decay = 1.0 + dissipation * dt;
          fragColor = result / decay;
          // fragColor.a = clamp(fragColor.a, 0.0, 1.0); // Clamp alpha for dye
      }
  `;

  const s_divergence = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uVelocity;
      uniform vec2 velocityTexelSize; 
      out vec4 fragColor;
      void main () {
          vec2 vL = glUV - vec2(velocityTexelSize.x, 0.0);
          vec2 vR = glUV + vec2(velocityTexelSize.x, 0.0);
          vec2 vT = glUV + vec2(0.0, velocityTexelSize.y);
          vec2 vB = glUV - vec2(0.0, velocityTexelSize.y);
          float L = texture(uVelocity, vL).x;
          float R = texture(uVelocity, vR).x;
          float T = texture(uVelocity, vT).y;
          float B = texture(uVelocity, vB).y;
          vec2 C = texture(uVelocity, glUV).xy;
          // Boundary conditions (Neumann for divergence-free)
          if (glUV.x < velocityTexelSize.x * 1.5) L = -C.x; 
          if (glUV.x > 1.0 - velocityTexelSize.x * 1.5) R = -C.x;
          if (glUV.y > 1.0 - velocityTexelSize.y * 1.5) T = -C.y;
          if (glUV.y < velocityTexelSize.y * 1.5) B = -C.y;
          float div = 0.5 * (R - L + T - B); // div / dx (or dy) is implicit with texel sampling
          fragColor = vec4(div, 0.0, 0.0, 1.0);
      }
  `;

  const s_curl = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uVelocity;
      uniform vec2 velocityTexelSize;
      out vec4 fragColor;
      void main () {
          vec2 vL = glUV - vec2(velocityTexelSize.x, 0.0);
          vec2 vR = glUV + vec2(velocityTexelSize.x, 0.0);
          vec2 vT = glUV + vec2(0.0, velocityTexelSize.y);
          vec2 vB = glUV - vec2(0.0, velocityTexelSize.y);
          float Ly = texture(uVelocity, vL).y;
          float Ry = texture(uVelocity, vR).y;
          float Tx = texture(uVelocity, vT).x;
          float Bx = texture(uVelocity, vB).x;
          // Curl_z = (d(Vy)/dx - d(Vx)/dy)
          // (Ry - Ly) / (2*dx) - (Tx - Bx) / (2*dy)
          // Assuming dx=dy=1 (grid space), scaled by 0.5
          float vorticity = (Ry - Ly) - (Tx - Bx); 
          fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
  `;

  const s_vorticity = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uVelocity; 
      uniform sampler2D uCurl;     
      uniform vec2 curlTexelSize; 
      uniform float curlStrength;  
      uniform float dt;
      out vec4 fragColor;
      void main () {
          vec2 vL_c = glUV - vec2(curlTexelSize.x, 0.0);
          vec2 vR_c = glUV + vec2(curlTexelSize.x, 0.0);
          vec2 vT_c = glUV + vec2(0.0, curlTexelSize.y);
          vec2 vB_c = glUV + vec2(0.0, curlTexelSize.y);
          float Lc = texture(uCurl, vL_c).x;
          float Rc = texture(uCurl, vR_c).x;
          float Tc = texture(uCurl, vT_c).x;
          float Bc = texture(uCurl, vB_c).x;
          float Cc = texture(uCurl, glUV).x; 
          // Gradient of curl magnitude: (abs(Tc) - abs(Bc)), (abs(Rc) - abs(Lc))
          vec2 force = 0.5 * vec2(abs(Tc) - abs(Bc), abs(Rc) - abs(Lc));
          if (length(force) > 0.00001) { force = normalize(force); }
          else { force = vec2(0.0, 0.0); }
          // Force is perpendicular to gradient, scaled by curl magnitude
          force = vec2(force.y, -force.x) * curlStrength * Cc; 
          // force.y *= -1.0; // Original had this, check convention
          vec2 currentVelocity = texture(uVelocity, glUV).xy;
          currentVelocity += force * dt;
          fragColor = vec4(currentVelocity, 0.0, 1.0);
      }
  `;

  const s_pressure = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uPressure;    // Previous pressure state (feedback)
      uniform sampler2D uDivergence;  
      // uniform vec2 divergenceTexelSize; // Not needed if uDivergence sampled at glUV
      // Current node's glPixel is implicitly for the output pressure texture (dx for Jacobi)
      out vec4 fragColor;
      void main () {
          vec2 vL = glUV - vec2(glPixel.x, 0.0); // glPixel from this ShaderNode (Pressure node)
          vec2 vR = glUV + vec2(glPixel.x, 0.0);
          vec2 vT = glUV + vec2(0.0, glPixel.y);
          vec2 vB = glUV - vec2(0.0, glPixel.y);
          float Lp = texture(uPressure, vL).x; // Previous pressure
          float Rp = texture(uPressure, vR).x;
          float Tp = texture(uPressure, vT).x;
          float Bp = texture(uPressure, vB).x;
          float divergenceValue = texture(uDivergence, glUV).x; 
          // Jacobi iteration for Poisson equation: (Lp + Rp + Bp + Tp - divergenceValue * dx^2) * 0.25
          // divergenceValue is already scaled by 1/dx from its calculation.
          // So it's (Lp + Rp + Bp + Tp - divergenceValue) * alpha
          // where alpha is related to relaxation, often 0.25 for dx=1 grid.
          float pressureVal = (Lp + Rp + Bp + Tp - divergenceValue) * 0.25;
          fragColor = vec4(pressureVal, 0.0, 0.0, 1.0);
      }
  `;

  const s_gradientSubtract = `
      precision highp float;
      in vec2 glUV;
      uniform sampler2D uPressure; 
      uniform sampler2D uVelocity; 
      uniform vec2 pressureTexelSize; 
      out vec4 fragColor;
      void main () {
          vec2 vL_p = glUV - vec2(pressureTexelSize.x, 0.0);
          vec2 vR_p = glUV + vec2(pressureTexelSize.x, 0.0);
          vec2 vT_p = glUV + vec2(0.0, pressureTexelSize.y);
          vec2 vB_p = glUV + vec2(0.0, pressureTexelSize.y);
          float Lp = texture(uPressure, vL_p).x;
          float Rp = texture(uPressure, vR_p).x;
          float Tp = texture(uPressure, vT_p).x;
          float Bp = texture(uPressure, vB_p).x;
          vec2 currentVelocity = texture(uVelocity, glUV).xy;
          // gradP = ( (Rp-Lp)/(2*dx_p), (Tp-Bp)/(2*dy_p) )
          // Velocity_new = Velocity_old - gradP * (dt or 1.0 depending on formulation)
          // Original used R-L, which is (Rp-Lp) effectively if scaled by 0.5
          // This needs to be scaled by 0.5 / pressureNode.texelSize (implicit dx=1 from shader)
          // Or simply 0.5 * (Rp-Lp)
          vec2 gradP = 0.5 * vec2(Rp - Lp, Tp - Bp); 
          currentVelocity -= gradP; 
          fragColor = vec4(currentVelocity, 0.0, 1.0);
      }
  `;

  // --- NODE SETUP ---
  const simRes = getResolution(
    config.SIM_RESOLUTION,
    minigl.canvas.width,
    minigl.canvas.height
  );
  const dyeRes = getResolution(
    config.DYE_RESOLUTION,
    minigl.canvas.width,
    minigl.canvas.height
  );

  console.log(`Simulation Resolution: ${simRes.width}x${simRes.height}`);
  console.log(`Dye Resolution: ${dyeRes.width}x${dyeRes.height}`);

  const textureOptions = {
    filter: minigl.floatSupported ? "LINEAR" : "NEAREST",
    wrap: "CLAMP_TO_EDGE",
    format: "FLOAT",
  };

  const simTextureOptions = {
    ...textureOptions,
    width: simRes.width,
    height: simRes.height,
  };
  const dyeTextureOptions = {
    ...textureOptions,
    width: dyeRes.width,
    height: dyeRes.height,
  };

  const velocity = minigl.pingpong(s_advection, {
    ...simTextureOptions,
    name: "Velocity",
    uniforms: { dissipation: config.VELOCITY_DISSIPATION },
  });

  const dye = minigl.pingpong(s_advection, {
    ...dyeTextureOptions,
    name: "Dye",
    uniforms: { dissipation: config.DENSITY_DISSIPATION },
  });

  const curl = minigl.shader(s_curl, { ...simTextureOptions, name: "Curl" });
  const divergence = minigl.shader(s_divergence, {
    ...simTextureOptions,
    name: "Divergence",
  });

  const pressure = minigl.pingpong(s_pressure, {
    ...simTextureOptions,
    name: "Pressure",
  });

  // Intermediate processing nodes (not feedback by default, but used to update feedback nodes)
  const vorticityProcessingNode = minigl.shader(s_vorticity, {
    ...simTextureOptions,
    name: "VorticityProcessing",
    uniforms: { curlStrength: config.CURL },
  });
  const gradientSubtractProcessingNode = minigl.shader(s_gradientSubtract, {
    ...simTextureOptions,
    name: "GradientSubtractProcessing",
  });

  const splatProcessingNode = minigl.shader(s_splat, {
    // width/height set dynamically before use
    ...textureOptions,
    name: "SplatProcessing",
  });

  const displayNode = minigl.shader(s_display, {
    width: minigl.canvas.width,
    height: minigl.canvas.height,
    name: "Display",
    uniforms: { uShading: config.SHADING },
  });
  minigl.output(displayNode);

  // Helper to manually render one shader pass into a FeedbackNode's FBOs
  // This is for steps that modify a FeedbackNode's state outside its own advection shader
  function processIntoFeedbackNode(
    feedbackNode,
    processingNode,
    inputTextures,
    additionalUniforms
  ) {
    const gl = minigl.gl;
    const prevFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    // We want to write into the FBO that feedbackNode will read from in its *next* .process call as glPrevious
    // This means we write to its current *write* buffer, then swap.
    let fboToWriteTo =
      feedbackNode.currentIndex === 0
        ? feedbackNode.framebufferB
        : feedbackNode.framebuffer;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fboToWriteTo);
    gl.viewport(0, 0, feedbackNode.width, feedbackNode.height);

    processingNode.ensureProgram();
    gl.useProgram(processingNode.program);
    gl.bindVertexArray(minigl.vao);

    const allUniforms = {
      ...minigl.getGlobalUniforms(
        feedbackNode.width,
        feedbackNode.height,
        minigl.clock
      ), // Node's own resolution
      ...processingNode.uniforms, // Default uniforms of the processingNode
      ...additionalUniforms, // Frame-specific uniforms
    };
    for (const key in inputTextures) {
      allUniforms[key] = inputTextures[key];
    }
    minigl.setUniforms(processingNode.program, allUniforms);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFB);

    // After writing, this buffer is now the "latest". So, swap feedbackNode's internal pointers.
    feedbackNode.currentIndex = 1 - feedbackNode.currentIndex;
  }

  // --- INITIALIZATION ---
  // Clear pressure FBOs to 0. Helper for one-off clear.
  function clearNodeTexture(node, r = 0, g = 0, b = 0, a = 0) {
    const clearShader = minigl.shader(s_clear, {
      width: node.width,
      height: node.height,
      uniforms: { clearColor: [r, g, b, a] },
    });
    const gl = minigl.gl;
    const prevFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    // If node is FeedbackNode, clear both its textures
    if (node.framebuffer && node.framebufferB) {
      [node.framebuffer, node.framebufferB].forEach((fb) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, node.width, node.height);
        clearShader.process(minigl.clock); // process will bind program, set uniforms, draw
      });
    } else if (node.framebuffer) {
      // ShaderNode
      gl.bindFramebuffer(gl.FRAMEBUFFER, node.framebuffer);
      gl.viewport(0, 0, node.width, node.height);
      clearShader.process(minigl.clock);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFB);
    // clearShader.dispose(); // If truly temporary
  }
  clearNodeTexture(pressure, 0, 0, 0, 0); // Initial pressure is 0
  clearNodeTexture(velocity, 0, 0, 0, 0); // Initial velocity is 0
  clearNodeTexture(
    dye,
    config.BACK_COLOR.r,
    config.BACK_COLOR.g,
    config.BACK_COLOR.b,
    config.TRANSPARENT ? 0.0 : 1.0
  );

  // --- EVENT LISTENERS ---
  let firstInteractionDone = false;
  function updatePointerDownData(px, py, id) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false; // Reset moved on new touch/click
    const rect = canvas.getBoundingClientRect();
    pointer.texcoordX = (px - rect.left) / rect.width;
    pointer.texcoordY = 1.0 - (py - rect.top) / rect.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    if (!pointer.colorSplatDone) {
      pointer.color = generateColor();
      pointer.colorSplatDone = true;
    }
  }

  function updatePointerMoveData(px, py) {
    const rect = canvas.getBoundingClientRect();
    const newTexcoordX = (px - rect.left) / rect.width;
    const newTexcoordY = 1.0 - (py - rect.top) / rect.height;

    if (
      !firstInteractionDone &&
      (pointer.texcoordX !== 0.5 || pointer.texcoordY !== 0.5)
    ) {
      // Initialize prev coords if this is the very first move from a non-center position
      if (pointer.prevTexcoordX === 0.5 && pointer.prevTexcoordY === 0.5) {
        pointer.prevTexcoordX = newTexcoordX;
        pointer.prevTexcoordY = newTexcoordY;
      }
    }

    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = newTexcoordX;
    pointer.texcoordY = newTexcoordY;

    let dx = pointer.texcoordX - pointer.prevTexcoordX;
    let dy = pointer.texcoordY - pointer.prevTexcoordY;

    const aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) dx *= aspectRatio;
    else dy /= aspectRatio; // Corrected else

    pointer.deltaX = dx;
    pointer.deltaY = dy;
    pointer.moved = Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001;
    if (pointer.moved && !pointer.colorSplatDone) {
      pointer.color = generateColor();
      pointer.colorSplatDone = true;
    }
  }

  function updatePointerUpData() {
    pointer.down = false;
    pointer.colorSplatDone = false;
  }

  function startSimulationLoop() {
    if (!firstInteractionDone) {
      firstInteractionDone = true;
      lastUpdateTime = Date.now();
      mainLoop();
      console.log("Simulation started.");
    }
  }

  canvas.addEventListener("mousedown", (e) => {
    updatePointerDownData(e.clientX, e.clientY, -1);
    startSimulationLoop();
  });

  canvas.addEventListener("mousemove", (e) => {
    if (pointer.down) {
      updatePointerMoveData(e.clientX, e.clientY);
    } else if (!firstInteractionDone) {
      // Start on first mouse move even if not clicked
      updatePointerMoveData(e.clientX, e.clientY);
      if (pointer.moved) startSimulationLoop();
    }
  });

  window.addEventListener("mouseup", () => {
    if (pointer.down) updatePointerUpData();
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const touch = e.targetTouches[0];
      updatePointerDownData(touch.clientX, touch.clientY, touch.identifier);
      startSimulationLoop();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (pointer.down) {
        const touch = e.targetTouches[0];
        updatePointerMoveData(touch.clientX, touch.clientY);
      }
    },
    { passive: false }
  );

  window.addEventListener("touchend", (e) => {
    const touch = e.changedTouches[0];
    if (pointer.down && touch.identifier === pointer.id) updatePointerUpData();
  });

  // --- SIMULATION LOGIC ---
  let animationFrameId = null;

  function correctSplatRadius(radius) {
    // Original used SPLAT_RADIUS / 100.0 then aspect correction.
    // The s_splat shader uses radius directly in exp(-dot(p,p)/radius)
    // Let's make config.SPLAT_RADIUS a more direct scale factor for the exp falloff
    // A smaller radius means a sharper splat.
    let ar = canvas.width / canvas.height;
    // if (ar > 1) radius *= ar; // This might make splats too wide in landscape
    return radius * 0.001; // Scale down for use in exp
  }

  function applySplatInputs() {
    if (
      !pointer.moved &&
      !pointer.down &&
      !(Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0)
    )
      return;

    const radius = correctSplatRadius(config.SPLAT_RADIUS);
    const force = config.SPLAT_FORCE;
    const col = pointer.color;

    splatProcessingNode.width = velocity.width;
    splatProcessingNode.height = velocity.height;
    processIntoFeedbackNode(
      velocity,
      splatProcessingNode,
      { uTarget: velocity.output() },
      {
        aspectRatio: canvas.width / canvas.height,
        point: { x: pointer.texcoordX, y: pointer.texcoordY },
        splatColor: {
          x: pointer.deltaX * force,
          y: pointer.deltaY * force,
          z: 0.0,
        },
        radius: radius,
      }
    );

    splatProcessingNode.width = dye.width;
    splatProcessingNode.height = dye.height;
    processIntoFeedbackNode(
      dye,
      splatProcessingNode,
      { uTarget: dye.output() },
      {
        aspectRatio: canvas.width / canvas.height,
        point: { x: pointer.texcoordX, y: pointer.texcoordY },
        splatColor: { x: col[0], y: col[1], z: col[2] },
        radius: radius,
      }
    );
    pointer.deltaX = 0; // Dampen after splat
    pointer.deltaY = 0;
    pointer.moved = false;
  }

  function step(dt) {
    const simTexel = getNodeTexelSize(velocity);
    // const dyeTexel = getNodeTexelSize(dye); // Not directly needed if advection shader is general
    const curlTexel = getNodeTexelSize(curl);
    // const divTexel = getNodeTexelSize(divergence); // Not needed by pressure shader if sampled at glUV
    const pressureTexel = getNodeTexelSize(pressure);

    // 1. Curl
    curl.updateUniform("uVelocity", velocity.output());
    curl.updateUniform("velocityTexelSize", simTexel);
    curl.process(minigl.clock);

    // 2. Vorticity (updates velocity FBO)
    processIntoFeedbackNode(
      velocity,
      vorticityProcessingNode,
      { uVelocity: velocity.output(), uCurl: curl.output() },
      { curlTexelSize: curlTexel, dt: dt }
    );

    // 3. Divergence
    divergence.updateUniform("uVelocity", velocity.output()); // Use updated velocity
    divergence.updateUniform("velocityTexelSize", simTexel);
    divergence.process(minigl.clock);

    // 4. Pressure Iterations
    // Pressure FBO was cleared to 0 initially.
    pressure.updateUniform("uDivergence", divergence.output());
    // pressure.updateUniform('divergenceTexelSize', divTexel); // Not needed by shader
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      pressure.process(minigl.clock); // Shader uses uPressure (itself via glPrevious)
    }

    // 5. Gradient Subtract (updates velocity FBO)
    processIntoFeedbackNode(
      velocity,
      gradientSubtractProcessingNode,
      { uVelocity: velocity.output(), uPressure: pressure.output() },
      { pressureTexelSize: pressureTexel }
    );

    // 6. Advection for Velocity (updates velocity FBO)
    velocity.updateUniform("dt", dt);
    velocity.updateUniform("velocityTexelSize", simTexel);
    velocity.updateUniform("uSource", velocity.output()); // Advect itself
    velocity.updateUniform("uVelocity", velocity.output()); // Use itself as advector
    velocity.process(minigl.clock);

    // 7. Advection for Dye (updates dye FBO)
    dye.updateUniform("dt", dt);
    dye.updateUniform("velocityTexelSize", simTexel); // Velocity field's texel size
    dye.updateUniform("uVelocity", velocity.output()); // Use final advected velocity
    dye.updateUniform("uSource", dye.output()); // Advect dye itself
    dye.process(minigl.clock);

    // Update display node
    displayNode.updateUniform("uTexture", dye.output());
    displayNode.updateUniform("uShading", config.SHADING);
    displayNode.updateUniform(
      "displayTexelSize",
      getNodeTexelSize(displayNode)
    );
  }

  let lastUpdateTime = Date.now();
  let colorUpdateTimer = 0.0;

  function mainLoop() {
    animationFrameId = requestAnimationFrame(mainLoop);
    const now = Date.now();
    let dt = (now - lastUpdateTime) / 1000.0;
    dt = Math.min(dt, 0.016666); // Clamp frame time (60fps)
    lastUpdateTime = now;

    minigl.clock++; // Integer clock for less floating point issues in shaders if time is uniform

    colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
    if (colorUpdateTimer >= 1.0) {
      colorUpdateTimer %= 1.0;
      if (!pointer.down) pointer.color = generateColor(); // Change color if mouse not down
    }

    applySplatInputs();
    step(dt);
    minigl.render(); // Renders the displayNode
  }

  console.log("Setup complete. Waiting for interaction to start simulation.");
  minigl.render(); // Render initial state (cleared FBOs, background)
});
