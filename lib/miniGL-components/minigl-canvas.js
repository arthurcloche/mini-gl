/**
 * miniGL Web Components - Main Canvas Component
 * Declarative WebGL2 node-based rendering in HTML
 * Made w/ love for Shopify, 2025
 */

import miniGL from "../miniGL/miniGL.js";

export class MiniGLCanvas extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.minigl = null;
    this.nodes = new Map(); // Component ID -> miniGL node mapping
    this.connections = new Map(); // Track connections for later resolution
    this.isInitialized = false;
    this.animationId = null;
  }

  static get observedAttributes() {
    return [
      "width",
      "height",
      "output",
      "auto-render",
      "debug",
      "fps",
      "unlimited-fps",
    ];
  }

  connectedCallback() {
    this.render();
    this.setupCanvas();
    this.initializeAfterChildren();
  }

  disconnectedCallback() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.minigl) {
      this.minigl.dispose();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.isInitialized) {
      this.handleAttributeChange(name, newValue);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        
        .nodes {
          display: none; /* Hide the node elements visually */
        }
        
        :host([debug]) .debug-info {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 10px;
          font-family: monospace;
          font-size: 12px;
          border-radius: 4px;
          z-index: 1000;
        }
      </style>
      
      <canvas></canvas>
      
      <div class="nodes">
        <slot></slot>
      </div>
      
      ${this.hasAttribute("debug") ? '<div class="debug-info"></div>' : ""}
    `;
  }

  setupCanvas() {
    const canvas = this.shadowRoot.querySelector("canvas");

    // Set canvas size
    const width = this.getAttribute("width");
    const height = this.getAttribute("height");

    if (width) canvas.style.width = width + "px";
    if (height) canvas.style.height = height + "px";

    try {
      // Parse FPS options
      const fps = this.getAttribute("fps");
      const unlimitedFps = this.hasAttribute("unlimited-fps");

      this.minigl = new miniGL(canvas, {
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        fps: fps ? parseInt(fps) : 60,
        unlimitedFps: unlimitedFps,
      });

      // Set up debug update callback
      this.minigl.onDebugUpdate = () => this.updateDebugInfo();
    } catch (error) {
      console.error("Failed to initialize miniGL:", error);
      this.dispatchEvent(
        new CustomEvent("minigl-error", {
          detail: { error, message: "Failed to initialize WebGL2" },
        })
      );
    }
  }

  // Wait for child components to be defined, then initialize
  async initializeAfterChildren() {
    // Wait a tick for child components to be connected
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Wait for all custom elements to be defined
    const childElements = this.querySelectorAll(
      "shader-node, image-node, video-node, canvas-node, blend-node, feedback-node, particles-node, input-connection, [node-type]"
    );
    const pendingDefinitions = Array.from(childElements).map((el) => {
      const tagName = el.tagName.toLowerCase();
      if (tagName.includes("-")) {
        return customElements.whenDefined(tagName);
      }
      return Promise.resolve();
    });

    await Promise.all(pendingDefinitions);

    this.initializeGraph();
  }

  initializeGraph() {
    if (!this.minigl) return;

    // Clear existing nodes
    this.nodes.clear();
    this.connections.clear();

    // Find all node components
    const nodeElements = this.querySelectorAll(
      "[node-type], minigl-node, shader-node, image-node, video-node, canvas-node, blend-node, feedback-node, particles-node"
    );

    // First pass: create all nodes
    nodeElements.forEach((element) => {
      this.createNodeFromElement(element);
    });

    // Second pass: establish connections
    nodeElements.forEach((element) => {
      this.setupConnectionsFromElement(element);
    });

    // Set output node
    const outputId = this.getAttribute("output");
    if (outputId && this.nodes.has(outputId)) {
      this.minigl.output(this.nodes.get(outputId));
    } else if (this.nodes.size > 0) {
      // Default to last node if no output specified
      const lastNode = Array.from(this.nodes.values()).pop();
      this.minigl.output(lastNode);
    }

    this.isInitialized = true;

    // Start rendering if auto-render is enabled (default)
    if (this.getAttribute("auto-render") !== "false") {
      // miniGL now handles its own render loop, just make sure it's started
      this.minigl.start();
    } else {
      this.minigl.stop();
    }

    this.dispatchEvent(
      new CustomEvent("minigl-ready", {
        detail: { nodeCount: this.nodes.size },
      })
    );
  }

  createNodeFromElement(element) {
    const id = element.id || `node_${this.nodes.size}`;
    const nodeType =
      element.getAttribute("node-type") ||
      element.tagName.toLowerCase().replace("minigl-", "").replace("-node", "");

    let node;

    try {
      switch (nodeType) {
        case "shader":
          node = this.createShaderNode(element);
          break;
        case "image":
          node = this.createImageNode(element);
          break;
        case "video":
          node = this.createVideoNode(element);
          break;
        case "canvas":
          node = this.createCanvasNode(element);
          break;
        case "blend":
          node = this.createBlendNode(element);
          break;
        case "feedback":
        case "pingpong":
          node = this.createFeedbackNode(element);
          break;
        case "particles":
          node = this.createParticlesNode(element);
          break;
        default:
          console.warn(`Unknown node type: ${nodeType}`);
          return;
      }

      if (node) {
        this.nodes.set(id, node);
        element._miniglNode = node; // Back-reference

        if (this.hasAttribute("debug")) {
          console.log(`Created ${nodeType} node:`, id, node);
        }
      }
    } catch (error) {
      console.error(`Failed to create ${nodeType} node:`, error);
      this.dispatchEvent(
        new CustomEvent("minigl-node-error", {
          detail: { nodeType, id, error, element },
        })
      );
    }
  }

  createShaderNode(element) {
    let fragment =
      element.getAttribute("fragment") || element.textContent.trim();
    if (!fragment) {
      throw new Error("Shader node requires fragment attribute or content");
    }

    // Clean up shader source
    fragment = this.cleanShaderSource(fragment);

    const uniforms = this.parseUniforms(element.getAttribute("uniforms"));
    const options = this.parseNodeOptions(element);

    return this.minigl.shader(fragment, uniforms, options);
  }

  createImageNode(element) {
    const src = element.getAttribute("src");
    if (!src) {
      throw new Error("Image node requires src attribute");
    }

    const options = this.parseNodeOptions(element);
    options.fitting = element.getAttribute("fitting") || "fill";

    return this.minigl.image(src, options);
  }

  createVideoNode(element) {
    const src = element.getAttribute("src");
    if (!src) {
      throw new Error("Video node requires src attribute");
    }

    const options = this.parseNodeOptions(element);
    return this.minigl.video(src, options);
  }

  createCanvasNode(element) {
    // For canvas nodes, we expect a draw function to be defined
    const drawFunctionName = element.getAttribute("draw-function");
    const options = this.parseNodeOptions(element);

    let drawCallback;
    if (drawFunctionName && window[drawFunctionName]) {
      drawCallback = window[drawFunctionName];
    } else {
      // Default simple draw function
      drawCallback = (ctx, w, h) => {
        ctx.fillStyle = element.getAttribute("color") || "#ff0000";
        ctx.fillRect(0, 0, w, h);
      };
    }

    return this.minigl.canvas2D(drawCallback, options);
  }

  createBlendNode(element) {
    const mode = element.getAttribute("mode") || "normal";
    const opacity = parseFloat(element.getAttribute("opacity") || "1.0");

    const uniforms = { blendMode: mode, opacity };
    const options = this.parseNodeOptions(element);

    return this.minigl.blend(uniforms, options);
  }

  createFeedbackNode(element) {
    let fragment =
      element.getAttribute("fragment") || element.textContent.trim();
    if (!fragment) {
      throw new Error("Feedback node requires fragment attribute or content");
    }

    // Clean up shader source
    fragment = this.cleanShaderSource(fragment);

    const uniforms = this.parseUniforms(element.getAttribute("uniforms"));
    const options = this.parseNodeOptions(element);

    return this.minigl.pingpong(fragment, uniforms, options);
  }

  createParticlesNode(element) {
    const options = this.parseNodeOptions(element);
    options.count = parseInt(element.getAttribute("count") || "1000");
    options.size = parseFloat(element.getAttribute("size") || "0.01");
    options.gravity = parseFloat(element.getAttribute("gravity") || "0.001");
    options.damping = parseFloat(element.getAttribute("damping") || "0.98");

    return this.minigl.particles(options);
  }

  setupConnectionsFromElement(element) {
    const nodeId =
      element.id ||
      `node_${Array.from(
        this.querySelectorAll("[node-type], minigl-node, *-node")
      ).indexOf(element)}`;
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Handle input elements (explicit connections)
    const inputs = element.querySelectorAll("input[from]");
    inputs.forEach((input) => {
      const inputName = input.getAttribute("name") || "glTexture";
      const fromId = input.getAttribute("from");
      const outputName = input.getAttribute("output") || "default";

      const sourceNode = this.nodes.get(fromId);
      if (sourceNode) {
        this.minigl.connect(sourceNode, node, inputName, outputName);
      } else {
        console.warn(`Connection source not found: ${fromId}`);
      }
    });

    // Handle shorthand attribute connections
    const connectsTo = element.getAttribute("connects-to");
    if (connectsTo) {
      const sourceNode = this.nodes.get(connectsTo);
      if (sourceNode) {
        this.minigl.connect(sourceNode, node, "glTexture");
      }
    }

    // Handle blend-specific connections
    const connectsBase = element.getAttribute("connects-base");
    const connectsBlend = element.getAttribute("connects-blend");

    if (connectsBase) {
      const sourceNode = this.nodes.get(connectsBase);
      if (sourceNode) {
        this.minigl.connect(sourceNode, node, "glBase");
      }
    }

    if (connectsBlend) {
      const sourceNode = this.nodes.get(connectsBlend);
      if (sourceNode) {
        this.minigl.connect(sourceNode, node, "glBlend");
      }
    }
  }

  parseUniforms(uniformsStr) {
    if (!uniformsStr) return {};

    try {
      return JSON.parse(uniformsStr);
    } catch (error) {
      console.warn("Failed to parse uniforms:", uniformsStr);
      return {};
    }
  }

  parseNodeOptions(element) {
    const options = {};

    const width = element.getAttribute("width");
    const height = element.getAttribute("height");
    const filter = element.getAttribute("filter");
    const wrap = element.getAttribute("wrap");
    const format = element.getAttribute("format");
    const name = element.getAttribute("name");

    if (width) options.width = parseInt(width);
    if (height) options.height = parseInt(height);
    if (filter) options.filter = filter;
    if (wrap) options.wrap = wrap;
    if (format) options.format = format;
    if (name) options.name = name;

    return options;
  }

  cleanShaderSource(source) {
    // Remove leading whitespace lines but preserve #version on first line
    source = source.replace(/^\s*\n+/, "").trim();

    // Ensure #version is on the very first line
    if (source.includes("#version") && !source.startsWith("#version")) {
      const lines = source.split("\n");
      const versionLineIndex = lines.findIndex((line) =>
        line.trim().startsWith("#version")
      );
      if (versionLineIndex > 0) {
        const versionLine = lines.splice(versionLineIndex, 1)[0];
        lines.unshift(versionLine.trim());
        source = lines.join("\n");
      }
    }

    return source;
  }

  startRenderLoop() {
    // miniGL now handles its own render loop
    if (this.minigl) {
      this.minigl.start();
    }
  }

  stopRenderLoop() {
    // miniGL now handles its own render loop
    if (this.minigl) {
      this.minigl.stop();
    }
  }

  updateDebugInfo() {
    if (!this.hasAttribute("debug")) return;

    const debugInfo = this.shadowRoot.querySelector(".debug-info");
    if (debugInfo && this.minigl) {
      debugInfo.innerHTML = `
        Nodes: ${this.nodes.size}<br>
        Frame: ${this.minigl.clock}<br>
        Resolution: ${this.minigl.canvas.width}x${this.minigl.canvas.height}<br>
        Target FPS: ${this.minigl.targetFps}${
        this.minigl.frameInterval === 0 ? " (unlimited)" : ""
      }<br>
        Running: ${this.minigl.isRunning() ? "Yes" : "No"}
      `;
    }
  }

  handleAttributeChange(name, newValue) {
    if (!this.minigl) return;

    switch (name) {
      case "output":
        if (this.nodes.has(newValue)) {
          this.minigl.output(this.nodes.get(newValue));
        }
        break;
      case "auto-render":
        if (newValue === "false") {
          this.stopRenderLoop();
        } else {
          this.startRenderLoop();
        }
        break;
      case "debug":
        this.render(); // Re-render to show/hide debug info
        break;
      case "fps":
        const fps = parseInt(newValue) || 60;
        this.minigl.setFps(fps);
        break;
      case "unlimited-fps":
        if (this.hasAttribute("unlimited-fps")) {
          this.minigl.unlimitFps();
        } else {
          const currentFps = this.getAttribute("fps");
          this.minigl.setFps(parseInt(currentFps) || 60);
        }
        break;
    }
  }

  // Public API methods
  getNode(id) {
    return this.nodes.get(id);
  }

  updateNodeUniform(nodeId, key, value) {
    const node = this.nodes.get(nodeId);
    if (node && node.updateUniform) {
      node.updateUniform(key, value);
    }
  }

  renderFrame() {
    if (this.minigl) {
      this.minigl.render();
    }
  }

  // Re-initialize when nodes change
  refreshGraph() {
    if (this.isInitialized) {
      this.initializeGraph();
    }
  }
}

// Register only if not already defined
if (!customElements.get("minigl-canvas")) {
  try {
    customElements.define("minigl-canvas", MiniGLCanvas);
  } catch (error) {
    // Silently ignore if constructor is already used
    if (!error.message.includes("already been used")) {
      throw error;
    }
  }
}
