// Core Editor State Management
export class EditorState {
  constructor() {
    this.selectedNode = null;
    this.isShaderPanelOpen = false;
    this.isRecording = false;
    this.frameCount = 0;
    this.nodes = new Map();
    this.connections = [];
    this.outputNode = null;
    this.minigl = null; // Will be initialized with miniGL instance
    this.miniglNodes = new Map(); // Maps editor node IDs to miniGL nodes
    
    // Curated list of 24 Picsum image IDs that work well
    this.picsumImageIds = [
      0, 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
      20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
    ];

    // Bind methods
    this.addNode = this.addNode.bind(this);
    this.removeNode = this.removeNode.bind(this);
    this.selectNode = this.selectNode.bind(this);
    this.connectNodes = this.connectNodes.bind(this);
    this.updateUI = this.updateUI.bind(this);
  }

  // Get a random Picsum URL from our curated list
  getRandomPicsumUrl() {
    const randomIndex = Math.floor(Math.random() * this.picsumImageIds.length);
    const imageId = this.picsumImageIds[randomIndex];
    return `https://picsum.photos/id/${imageId}/800/600`;
  }

  // Initialize with miniGL instance
  initializeMiniGL(canvas) {
    // Dynamic import to handle miniGL
    return import("../../../lib/miniGL/miniGL.js").then((module) => {
      const miniGLClass = module.default || module.miniGL;
      this.minigl = new miniGLClass(canvas);
      return this.minigl;
    });
  }

  // Generate random two-word name
  generateRandomName() {
    const adjectives = [
      "Bright",
      "Dark",
      "Soft",
      "Sharp",
      "Smooth",
      "Rough",
      "Fast",
      "Slow",
      "Warm",
      "Cool",
      "Deep",
      "Light",
      "Heavy",
      "Thin",
      "Thick",
    ];
    const nouns = [
      "Wave",
      "Flow",
      "Pulse",
      "Glow",
      "Shine",
      "Shadow",
      "Echo",
      "Ripple",
      "Burst",
      "Drift",
      "Spark",
      "Flash",
      "Blur",
      "Mix",
      "Fade",
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun}`;
  }

  // Node management
  addNode(type, name, position = { x: 100, y: 100 }) {
    const id =
      "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const node = {
      id,
      type,
      name: name || this.generateRandomName(),
      position,
      uniforms: this.getDefaultUniforms(type),
      shader: this.getDefaultShader(type),
      inputs: this.getDefaultInputs(type),
      outputs: type !== "Output" ? ["output"] : [],
      // Add sizeMode for Canvas and Text nodes (default to responsive)
      sizeMode: (type === "Canvas" || type === "Text") ? "responsive" : undefined,
      // Text node specific properties
      text:
        type === "Text" ? "Hello World\nMultiple lines\nsupported!" : undefined,
      fontSize: type === "Text" ? 24 : undefined,
      fontFamily: type === "Text" ? "Arial" : undefined,
      fontColor: type === "Text" ? "#ffffff" : undefined,
      posX: type === "Text" ? 0 : undefined,
      posY: type === "Text" ? 0 : undefined,
    };

    this.nodes.set(id, node);

    // Create corresponding miniGL node
    if (this.minigl) {
      // If it's a responsive Canvas/Text node, set its size to match the current canvas
      if (node.sizeMode === 'responsive' && (node.type === 'Canvas' || node.type === 'Text')) {
        // Use the actual miniGL canvas dimensions
        node.width = this.minigl.canvas.width;
        node.height = this.minigl.canvas.height;
      }
      this.createMiniGLNode(node);
    }

    // Auto-set as output if it's the first node with output capability and no output is set
    if (!this.outputNode && this.hasOutput(type)) {
      this.setOutputNode(node.id);

      // Force a render for the new output node
      if (this.minigl && this.minigl.renderToScreen) {
        setTimeout(() => {
          this.minigl.renderToScreen();
        }, 100);
      }
    }

    // Start the render loop if a shader node is added
    if (this.minigl && (type === 'Shader' || type === 'Feedback' || type === 'Grayscale' || 
                        type === 'Blur' || type === 'LensDistortion' || type === 'Blend')) {
      if (this.minigl.start) {
        this.minigl.start();
      }
    }

    // Auto-select the new node to show it in properties panel
    this.selectNode(node.id);

    this.updateUI();
    return node;
  }

  createMiniGLNode(editorNode) {
    if (!this.minigl) {
      console.warn("Cannot create miniGL node - minigl instance not available");
      return null;
    }

    let miniglNode = null;

    switch (editorNode.type) {
      case "Texture":
        // Generate random image URL if no URL is provided
        if (!editorNode.url) {
          // Use our curated list of Picsum images
          editorNode.url = this.getRandomPicsumUrl();
        }

        // Use canvas dimensions for texture nodes by default
        const textureWidth = editorNode.width || (this.minigl ? this.minigl.canvas.width : 512);
        const textureHeight = editorNode.height || (this.minigl ? this.minigl.canvas.height : 512);

        // Create image node - let miniGL handle loading internally
        try {
          miniglNode = this.minigl.image(editorNode.url, {
            width: textureWidth,
            height: textureHeight,
            fitting: editorNode.sizeMode || "cover",
          });

          // Set initial loading state
          editorNode.loadingState = "loading";

          // Clear loading state after a reasonable time
          setTimeout(() => {
            editorNode.loadingState = "loaded";
            this.triggerUpdate();
          }, 1500);
        } catch (error) {
          console.error("Failed to create texture node:", error);
          editorNode.loadingState = "error";
        }
        break;

      case "Canvas":
        // Create canvas node with custom code or white background fallback
        // Store the draw function on the editor node to prevent garbage collection
        // Check if we already have a draw function (for recreated nodes)
        if (
          !editorNode._drawFunction ||
          typeof editorNode._drawFunction !== "function"
        ) {
          editorNode._drawFunction = (ctx, width, height) => {
            // Set high-quality rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            if (editorNode.canvasCode) {
              // Use custom canvas code
              try {
                const userDrawFunction = new Function(
                  "ctx",
                  "width",
                  "height",
                  editorNode.canvasCode
                );
                userDrawFunction(ctx, width, height);
              } catch (error) {
                // Fallback to white background on error
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);
                console.warn(
                  "Canvas code error, showing white background:",
                  error
                );
              }
            } else {
              // Default white background
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, width, height);
            }
          };
        }

        // Ensure drawFunction is valid before creating canvas2D node
        if (typeof editorNode._drawFunction !== "function") {
          console.error(
            "Canvas drawFunction is not a function, creating fallback"
          );
          editorNode._drawFunction = (ctx, width, height) => {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          };
        }

        // For responsive nodes, use canvas dimensions, otherwise use node dimensions
        const canvasWidth = editorNode.sizeMode === 'responsive' && this.minigl ? 
          this.minigl.canvas.width : (editorNode.width || 512);
        const canvasHeight = editorNode.sizeMode === 'responsive' && this.minigl ? 
          this.minigl.canvas.height : (editorNode.height || 512);

        miniglNode = this.minigl.canvas2D(editorNode._drawFunction, {
          width: canvasWidth,
          height: canvasHeight,
        });

        // Store the drawCallback reference to ensure it persists
        if (miniglNode) {
          miniglNode._originalDrawCallback = editorNode._drawFunction;
          if (!miniglNode.drawCallback) {
            console.error("Canvas node missing drawCallback, fixing...");
            miniglNode.drawCallback = editorNode._drawFunction;
          }
        }
        break;

      case "Text":
        // Create text node with canvas2D rendering - centered text on transparent background
        // Store the draw function on the editor node to prevent garbage collection
        // Check if we already have a draw function (for recreated nodes)
        if (
          !editorNode._drawFunction ||
          typeof editorNode._drawFunction !== "function"
        ) {
          editorNode._drawFunction = (ctx, width, height) => {
            // Set high-quality rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // Clear with transparent background
            ctx.clearRect(0, 0, width, height);

            // Set text properties
            ctx.fillStyle = editorNode.fontColor || "#ffffff";
            ctx.font = `${editorNode.fontSize || 24}px ${
              editorNode.fontFamily || "Arial"
            }`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Handle line breaks and center the text block
            const text = editorNode.text || "Sample Text";
            const lines = text.split("\n");
            const lineHeight = (editorNode.fontSize || 24) * 1.2;

            // Calculate position based on posX and posY (-1 to 1 range)
            const posX = editorNode.posX || 0;
            const posY = editorNode.posY || 0;
            
            // Convert normalized coordinates to pixel coordinates
            // posX: -1 = left edge, 0 = center, 1 = right edge
            // posY: -1 = top edge, 0 = center, 1 = bottom edge
            const centerX = width / 2 + (posX * width / 2);
            const centerY = height / 2 + (posY * height / 2);
            
            // Calculate starting Y position for the text block
            const totalHeight = lines.length * lineHeight;
            const startY = centerY - totalHeight / 2 + lineHeight / 2;

            // Draw each line centered at the calculated position
            lines.forEach((line, index) => {
              const x = centerX;
              const y = startY + index * lineHeight;
              ctx.fillText(line, x, y);
            });
          };
        }

        // Ensure drawFunction is valid before creating canvas2D node
        if (typeof editorNode._drawFunction !== "function") {
          console.error(
            "Text drawFunction is not a function, creating fallback"
          );
          editorNode._drawFunction = (ctx, width, height) => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "#ffffff";
            ctx.font = "24px Arial";
            ctx.textAlign = "center";
            ctx.fillText("Text Error", width / 2, height / 2);
          };
        }

        // For responsive nodes, use canvas dimensions, otherwise use node dimensions
        const textWidth = editorNode.sizeMode === 'responsive' && this.minigl ? 
          this.minigl.canvas.width : (editorNode.width || 512);
        const textHeight = editorNode.sizeMode === 'responsive' && this.minigl ? 
          this.minigl.canvas.height : (editorNode.height || 512);

        miniglNode = this.minigl.canvas2D(editorNode._drawFunction, {
          width: textWidth,
          height: textHeight,
        });

        // Store the drawCallback reference to ensure it persists
        if (miniglNode) {
          miniglNode._originalDrawCallback = editorNode._drawFunction;
          if (!miniglNode.drawCallback) {
            console.error("Text node missing drawCallback, fixing...");
            miniglNode.drawCallback = editorNode._drawFunction;
          }
        }
        break;

      case "Shader":
        // Create shader with uniforms
        const uniforms = {};
        Object.entries(editorNode.uniforms || {}).forEach(([name, uniform]) => {
          if (uniform.type === "slider" || uniform.type === "constant") {
            uniforms[name] = uniform.value;
          }
        });

        // Use the actual shader code or default
        const shaderCode = editorNode.shader || this.getDefaultShader("Shader");

        // Use canvas dimensions by default for shaders too
        const shaderWidth = editorNode.width || (this.minigl ? this.minigl.canvas.width : 512);
        const shaderHeight = editorNode.height || (this.minigl ? this.minigl.canvas.height : 512);

        miniglNode = this.minigl.shader(shaderCode, uniforms, {
          width: shaderWidth,
          height: shaderHeight,
        });
        break;

      case "Blend":
        // Map blend mode names to numbers
        const blendModes = {
          screen: 0,
          multiply: 1,
          overlay: 2
        };
        
        // Use canvas dimensions by default
        const blendWidth = editorNode.width || (this.minigl ? this.minigl.canvas.width : 512);
        const blendHeight = editorNode.height || (this.minigl ? this.minigl.canvas.height : 512);
        
        // Create blend node with uniforms
        miniglNode = this.minigl.blend(
          {
            glOpacity: editorNode.opacity || 1.0,
            glBlendMode: blendModes[editorNode.blendMode || "screen"] || 0
          },
          {
            width: blendWidth,
            height: blendHeight,
          }
        );
        
        // The blend node needs both glBase and glBlend inputs to work
        // They will be connected when connections are made
        break;

      case "Feedback":
        // Create feedback/pingpong node with shader
        const feedbackUniforms = {};
        Object.entries(
          editorNode.uniforms || this.getDefaultUniforms(editorNode.type)
        ).forEach(([name, uniform]) => {
          if (uniform.type === "slider" || uniform.type === "constant") {
            feedbackUniforms[name] = uniform.value;
          }
        });

        // Use canvas dimensions by default
        const feedbackWidth = editorNode.width || (this.minigl ? this.minigl.canvas.width : 512);
        const feedbackHeight = editorNode.height || (this.minigl ? this.minigl.canvas.height : 512);
        
        miniglNode = this.minigl.pingpong(
          editorNode.shader || this.getDefaultShader("Feedback"),
          feedbackUniforms,
          {
            width: feedbackWidth,
            height: feedbackHeight,
          }
        );
        break;

      case "Grayscale":
      case "Blur":
      case "LensDistortion":
        // Create effect nodes as shader nodes with proper templates
        const effectUniforms = {};
        Object.entries(
          editorNode.uniforms || this.getDefaultUniforms(editorNode.type)
        ).forEach(([name, uniform]) => {
          if (uniform.type === "slider" || uniform.type === "constant") {
            effectUniforms[name] = uniform.value;
          }
        });

        // Use canvas dimensions by default
        const effectWidth = editorNode.width || (this.minigl ? this.minigl.canvas.width : 512);
        const effectHeight = editorNode.height || (this.minigl ? this.minigl.canvas.height : 512);
        
        miniglNode = this.minigl.shader(
          editorNode.shader || this.getDefaultShader(editorNode.type),
          effectUniforms,
          {
            width: effectWidth,
            height: effectHeight,
          }
        );
        break;
    }

    if (miniglNode) {
      this.miniglNodes.set(editorNode.id, miniglNode);

      // Force a render for effect nodes when they become output
      if (
        ["Grayscale", "Blur", "LensDistortion", "Feedback"].includes(
          editorNode.type
        ) &&
        this.outputNode === editorNode.id
      ) {
        setTimeout(() => {
          if (this.minigl && this.minigl.renderToScreen) {
            this.minigl.renderToScreen();
          }
        }, 100);
      }
    } else {
      console.error(
        "Failed to create miniGL node for:",
        editorNode.type,
        editorNode.id
      );
    }

    return miniglNode;
  }

  removeNode(id) {
    // If this node is the current output, clear output first to prevent render errors
    if (this.outputNode === id) {
      this.outputNode = null;
      if (this.minigl && this.minigl.output) {
        this.minigl.output(null); // Clear miniGL output
      }
    }

    // Dispose of the miniGL node
    const miniglNode = this.miniglNodes.get(id);
    if (miniglNode && miniglNode.dispose) {
      miniglNode.dispose();
    }

    // Remove from collections
    this.nodes.delete(id);
    this.miniglNodes.delete(id);
    this.connections = this.connections.filter(
      (c) => c.from !== id && c.to !== id
    );

    this.updateUI();
  }

  connectNodes(fromId, toId, fromPort = "output", toPort = "input") {
    // Validate connection
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (!fromNode || !toNode) {
      console.error("One or both nodes not found");
      return false;
    }

    // Check if connection already exists
    const exists = this.connections.some(
      (c) => c.from === fromId && c.to === toId
    );

    if (exists) {
      return false;
    }

    // Check existing connections BEFORE adding the new one
    const existingConnectionsBeforeAdd = this.connections.filter(
      (c) => c.to === toId
    );

    // Add connection
    this.connections.push({ from: fromId, to: toId, fromPort, toPort });

    // Update miniGL connections
    const fromMiniGL = this.miniglNodes.get(fromId);
    const toMiniGL = this.miniglNodes.get(toId);

    if (fromMiniGL && toMiniGL) {
      try {
        // Use miniGL's connect method
        if (toNode.type === "Blend") {
          // Blend nodes have base and blend inputs
          // Use the count BEFORE we added the new connection
          console.log(`Connecting to Blend node, existing connections before add: ${existingConnectionsBeforeAdd.length}`);
          console.log(`From node type: ${fromNode.type}, miniGL type: ${fromMiniGL.constructor.name}`);
          
          if (existingConnectionsBeforeAdd.length === 0) {
            console.log(`Connecting ${fromId} to ${toId} as glBase (first input)`);
            toMiniGL.connect("glBase", fromMiniGL);
            console.log(`After connect - Blend inputs:`, toMiniGL.inputs);
          } else {
            console.log(`Connecting ${fromId} to ${toId} as glBlend (second input)`);
            toMiniGL.connect("glBlend", fromMiniGL);
            console.log(`After connect - Blend inputs:`, toMiniGL.inputs);
          }
          
          // Force the blend node to re-process with new connections
          if (toMiniGL.dirty !== undefined) {
            toMiniGL.dirty = true;
          }
          // Also mark it for immediate processing
          if (toMiniGL.process && typeof toMiniGL.process === 'function') {
            toMiniGL.process(performance.now());
            // After processing, trigger render
            if (this.minigl && this.minigl.renderToScreen) {
              this.minigl.renderToScreen();
            }
          }
        } else if (
          toNode.type === "Shader" ||
          toNode.type === "Feedback" ||
          toNode.type === "Grayscale" ||
          toNode.type === "Blur" ||
          toNode.type === "LensDistortion"
        ) {
          // Shader and effect nodes can have multiple texture inputs
          const connections = this.connections.filter((c) => c.to === toId);
          const inputIndex = connections.length - 1;

          if (toNode.inputs && toNode.inputs[inputIndex]) {
            // Use the specific input name from the node
            const inputName = toNode.inputs[inputIndex];
            toMiniGL.connect(inputName, fromMiniGL);
          } else {
            // Default to uTexture for effect nodes, glTexture for others
            const defaultInput = [
              "Grayscale",
              "Blur",
              "LensDistortion",
            ].includes(toNode.type)
              ? "uTexture"
              : "glTexture";
            toMiniGL.connect(defaultInput, fromMiniGL);
          }
        } else {
          // Generic input connection
          toMiniGL.input(fromMiniGL);
        }
      } catch (error) {
        console.error("Error connecting miniGL nodes:", error);
      }
    }

    // Force a render to show the connection change immediately
    if (this.minigl && this.minigl.renderToScreen) {
      // Multiple render attempts to ensure connection propagates
      setTimeout(() => this.minigl.renderToScreen(), 50);
      setTimeout(() => this.minigl.renderToScreen(), 150);
      setTimeout(() => this.minigl.renderToScreen(), 300);
    }

    this.updateUI();
    return true;
  }

  disconnectNodes(fromId, toId) {
    this.connections = this.connections.filter(
      (c) => !(c.from === fromId && c.to === toId)
    );

    // TODO: Handle miniGL disconnection (may need to recreate nodes)
    this.updateUI();
  }

  selectNode(id) {
    // Only prevent switching if shader editor is open AND we're trying to select a different node
    const shaderOverlay = document.getElementById("shaderOverlay");
    if (
      shaderOverlay &&
      shaderOverlay.style.display !== "none" &&
      this.selectedNode &&
      id !== this.selectedNode
    ) {
      console.warn("Cannot switch nodes while shader editor is open");
      return; // Prevent switching to a different node while editing
    }

    this.selectedNode = id;
    this.updateUI();
  }

  setOutputNode(id) {
    this.outputNode = id;
    const miniglNode = this.miniglNodes.get(id);

    if (miniglNode && this.minigl) {
      try {
        // Use miniGL's output method
        this.minigl.output(miniglNode);

        // Start render loop if not running
        if (!this.minigl.isRunning()) {
          this.minigl.render();
        }
      } catch (error) {
        console.error("Error setting miniGL output:", error);
      }
    } else {
      console.warn(
        "Cannot set output - miniglNode:",
        miniglNode,
        "minigl:",
        this.minigl
      );
    }

    this.updateUI();
  }

  getDefaultUniforms(type) {
    const defaults = {
      Shader: {}, // Blank shader should have no uniforms
      Feedback: {
        uDecay: { type: "slider", value: 0.95, min: 0, max: 1 },
        uSpeed: { type: "slider", value: 0.5, min: 0, max: 1 },
      },
      Blur: {
        uRadius: { type: "slider", value: 5, min: 0, max: 20 },
        uDirection: { type: "slider", value: 0, min: 0, max: 360 },
      },
      Grayscale: {
        uMix: { type: "slider", value: 1.0, min: 0, max: 1 },
      },
      LensDistortion: {
        uStrength: { type: "slider", value: 0.5, min: -2, max: 2 },
        uChromaticAberration: { type: "slider", value: 0.01, min: 0, max: 0.1 },
      },
      Blend: {
        uMix: { type: "slider", value: 0.5, min: 0, max: 1 },
      },
      Texture: {},
      Canvas: {},
      Text: {},
    };
    return defaults[type] || {};
  }

  getDefaultInputs(type) {
    const defaults = {
      Shader: [], // Custom shaders start with no inputs - user can add them
      Feedback: ["uTexture"],
      Blur: ["uTexture"],
      Grayscale: ["uTexture"],
      LensDistortion: ["uTexture"],
      Blend: [], // Blend nodes use special input handling (glBase, glBlend)
      Texture: [],
      Canvas: [],
      Text: [],
    };
    return defaults[type] || [];
  }

  getDefaultShader(type) {
    const shaders = {
      Shader: `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform vec3 glMouse;

in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    // glUV is [0,1], good for textures
    // For centered coordinates with aspect correction:
    vec2 uv = glUV * 2.0 - 1.0; // Convert to [-1,1]
    float aspect = glResolution.x / glResolution.y;
    uv.x *= aspect;
    
    // Simple gradient pattern with slower animation
    vec3 color = vec3(glUV.x, glUV.y, 0.5 + 0.5 * sin(glTime * 0.01));
    
    fragColor = vec4(color, 1.0);
}`,
      Feedback: `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform sampler2D glPrevious;
uniform float uDecay;
uniform float uSpeed;

in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    // Convert UV to centered coordinates with aspect correction
    vec2 uv = glUV * 2.0 - 1.0; // Convert from [0,1] to [-1,1]
    float aspect = glResolution.x / glResolution.y;
    uv.x *= aspect;
    
    // Animate red circle up and down with speed control (scale uSpeed to reasonable range)
    float yOffset = sin(glTime * 0.01 * (uSpeed * 5.0)) * 0.3;
    vec2 circleCenter = vec2(0.0, yOffset);
    
    float radius = 0.4;
    float dist = length(uv - circleCenter);
    
    // Current frame: draw red circle
    vec4 current = vec4(0.0, 0.0, 0.0, 1.0); // Black background
    if (dist < radius) {
        current = vec4(1.0, 0.0, 0.0, 1.0); // Red circle
    }
    
    // Get previous frame from ping-pong buffer
    vec4 previous = texture(glPrevious, glUV);
    
    // Mix current with faded previous frame
    fragColor = mix(current, previous, uDecay);
}`,
      Grayscale: `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform float uMix;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec4 color = texture(uTexture, glUV);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 grayscale = vec3(gray);
    fragColor = vec4(mix(color.rgb, grayscale, uMix), color.a);
}`,
      Blur: `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 glResolution;
uniform float uRadius;
uniform float uDirection;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 direction = vec2(cos(radians(uDirection)), sin(radians(uDirection)));
    vec2 texelSize = 1.0 / glResolution;
    vec4 result = vec4(0.0);
    float total = 0.0;
    
    for (float i = -uRadius; i <= uRadius; i += 1.0) {
        float weight = 1.0 - abs(i) / uRadius;
        vec2 offset = direction * texelSize * i;
        result += texture(uTexture, glUV + offset) * weight;
        total += weight;
    }
    
    fragColor = result / total;
}`,
      LensDistortion: `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 glResolution;
uniform float uStrength;
uniform float uChromaticAberration;

in vec2 glUV;
out vec4 fragColor;

vec2 distort(vec2 uv, float k) {
    vec2 centered = uv * 2.0 - 1.0;
    float r2 = dot(centered, centered);
    float distortion = 1.0 + k * r2;
    return centered * distortion * 0.5 + 0.5;
}

void main() {
    vec2 uv = glUV;
    
    if (uChromaticAberration > 0.0) {
        float r = texture(uTexture, distort(uv, uStrength - uChromaticAberration)).r;
        float g = texture(uTexture, distort(uv, uStrength)).g;
        float b = texture(uTexture, distort(uv, uStrength + uChromaticAberration)).b;
        fragColor = vec4(r, g, b, 1.0);
    } else {
        vec2 distorted = distort(uv, uStrength);
        fragColor = texture(uTexture, distorted);
    }
}`,
    };
    return shaders[type] || "";
  }

  getDefaultCanvasCode() {
    return `// Canvas 2D Drawing Code
// Available: ctx (2D context), width, height, frame (number)

// Clear with white background
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, width, height);`;
  }

  // Utility methods
  getNodeIcon(type) {
    const icons = {
      Texture: "🖼️",
      Text: "📝",
      Shader: "⚡",
      Blend: "🎨",
      Feedback: "🔄",
      Blur: "🌸",
      Bloom: "✨",
      Grayscale: "⚫",
      LensDistortion: "🔮",
    };
    return icons[type] || "⚡";
  }

  hasInput(type) {
    return [
      "Shader",
      "Blend",
      "Feedback",
      "Grayscale",
      "Blur",
      "LensDistortion",
    ].includes(type);
  }

  hasOutput(type) {
    return [
      "Texture",
      "Text",
      "Shader",
      "Blend",
      "Feedback",
      "Grayscale",
      "Blur",
      "LensDistortion",
    ].includes(type);
  }

  exportGraph() {
    return {
      version: "1.0",
      timestamp: new Date().toISOString(),
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        type: node.type,
        name: node.name,
        position: node.position,
        uniforms: node.uniforms,
        shader: node.shader,
        canvasCode: node.canvasCode,
        url: node.url,
        width: node.width,
        height: node.height,
        blendMode: node.blendMode,
        text: node.text,
        fontSize: node.fontSize,
        fontFamily: node.fontFamily,
        fontColor: node.fontColor,
      })),
      connections: this.connections,
      outputNode: this.outputNode,
    };
  }

  importGraph(data) {
    // Clear existing
    this.nodes.clear();
    this.miniglNodes.clear();
    this.connections = [];

    // Import nodes
    data.nodes.forEach((nodeData) => {
      const node = {
        id: nodeData.id,
        type: nodeData.type,
        name: nodeData.name,
        position: nodeData.position,
        uniforms: nodeData.uniforms || this.getDefaultUniforms(nodeData.type),
        shader: nodeData.shader,
        canvasCode: nodeData.canvasCode,
        url: nodeData.url,
        width: nodeData.width,
        height: nodeData.height,
        blendMode: nodeData.blendMode,
        text: nodeData.text,
        fontSize: nodeData.fontSize,
        fontFamily: nodeData.fontFamily,
        fontColor: nodeData.fontColor,
      };

      this.nodes.set(node.id, node);

      if (this.minigl) {
        this.createMiniGLNode(node);
      }
    });

    // Import connections
    data.connections.forEach((conn) => {
      this.connectNodes(conn.from, conn.to, conn.fromPort, conn.toPort);
    });

    // Set output
    if (data.outputNode) {
      this.setOutputNode(data.outputNode);
    }

    this.updateUI();
  }

  // UI update stub - will be implemented by UI components
  updateUI() {
    // This will be overridden by the UI system
    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  // Helper methods for UI components
  getNode(id) {
    return this.nodes.get(id);
  }

  triggerUpdate() {
    this.updateUI();
  }
}

// Create singleton instance
export const editorState = new EditorState();
export default editorState;
