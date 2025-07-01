/**
 * miniGL Web Components - Node Components
 * Individual node components for declarative WebGL2 node graphs
 * Made w/ love for Shopify, 2025
 */

// Base Node Component
export class MiniGLNode extends HTMLElement {
  constructor() {
    super();
    this.setAttribute("node-type", "base");
  }

  static get observedAttributes() {
    return ["id", "name", "width", "height", "filter", "wrap", "format"];
  }

  connectedCallback() {
    this.style.display = "none"; // Hide visually
    this.dispatchEvent(
      new CustomEvent("node-connected", {
        bubbles: true,
        detail: { nodeType: this.getAttribute("node-type"), element: this },
      })
    );
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.dispatchEvent(
      new CustomEvent("node-changed", {
        bubbles: true,
        detail: { attribute: name, oldValue, newValue, element: this },
      })
    );
  }

  // Helper to get the parent canvas
  getCanvas() {
    return this.closest("minigl-canvas");
  }

  // Helper to update uniforms on the underlying miniGL node
  updateUniform(key, value) {
    const canvas = this.getCanvas();
    if (canvas) {
      canvas.updateNodeUniform(this.id, key, value);
    }
  }
}

// Shader Node Component
export class ShaderNode extends MiniGLNode {
  constructor() {
    super();
    this.setAttribute("node-type", "shader");
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "fragment", "uniforms"];
  }

  set fragment(value) {
    this.setAttribute("fragment", value);
  }

  get fragment() {
    return this.getAttribute("fragment") || this.textContent.trim();
  }

  set uniforms(value) {
    this.setAttribute(
      "uniforms",
      typeof value === "string" ? value : JSON.stringify(value)
    );
  }

  get uniforms() {
    const str = this.getAttribute("uniforms");
    try {
      return str ? JSON.parse(str) : {};
    } catch {
      return {};
    }
  }
}

// Image Node Component
export class ImageNode extends MiniGLNode {
  constructor() {
    super();
    this.setAttribute("node-type", "image");
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "src", "fitting"];
  }

  set src(value) {
    this.setAttribute("src", value);
  }

  get src() {
    return this.getAttribute("src");
  }

  set fitting(value) {
    this.setAttribute("fitting", value);
  }

  get fitting() {
    return this.getAttribute("fitting") || "fill";
  }
}

// Video Node Component
export class VideoNode extends MiniGLNode {
  constructor() {
    super();
    this.setAttribute("node-type", "video");
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "src"];
  }

  set src(value) {
    this.setAttribute("src", value);
  }

  get src() {
    return this.getAttribute("src");
  }
}

// Canvas Node Component
export class CanvasNode extends MiniGLNode {
  constructor() {
    super();
    this.setAttribute("node-type", "canvas");
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "draw-function", "color"];
  }

  set drawFunction(value) {
    this.setAttribute("draw-function", value);
  }

  get drawFunction() {
    return this.getAttribute("draw-function");
  }

  set color(value) {
    this.setAttribute("color", value);
  }

  get color() {
    return this.getAttribute("color") || "#ff0000";
  }
}

// Blend Node Component
export class BlendNode extends MiniGLNode {
  constructor() {
    super();
    this.setAttribute("node-type", "blend");
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "mode",
      "opacity",
      "connects-base",
      "connects-blend",
    ];
  }

  set mode(value) {
    this.setAttribute("mode", value);
  }

  get mode() {
    return this.getAttribute("mode") || "normal";
  }

  set opacity(value) {
    this.setAttribute("opacity", value.toString());
  }

  get opacity() {
    return parseFloat(this.getAttribute("opacity") || "1.0");
  }

  set connectsBase(value) {
    this.setAttribute("connects-base", value);
  }

  get connectsBase() {
    return this.getAttribute("connects-base");
  }

  set connectsBlend(value) {
    this.setAttribute("connects-blend", value);
  }

  get connectsBlend() {
    return this.getAttribute("connects-blend");
  }
}

// Feedback Node Component
export class FeedbackNode extends MiniGLNode {
  constructor() {
    super();
    this.setAttribute("node-type", "feedback");
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "fragment", "uniforms"];
  }

  set fragment(value) {
    this.setAttribute("fragment", value);
  }

  get fragment() {
    return this.getAttribute("fragment") || this.textContent.trim();
  }

  set uniforms(value) {
    this.setAttribute(
      "uniforms",
      typeof value === "string" ? value : JSON.stringify(value)
    );
  }

  get uniforms() {
    const str = this.getAttribute("uniforms");
    try {
      return str ? JSON.parse(str) : {};
    } catch {
      return {};
    }
  }
}

// Particles Node Component
export class ParticlesNode extends MiniGLNode {
  constructor() {
    super();
    this.setAttribute("node-type", "particles");
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "count", "size", "gravity", "damping"];
  }

  set count(value) {
    this.setAttribute("count", value.toString());
  }

  get count() {
    return parseInt(this.getAttribute("count") || "1000");
  }

  set size(value) {
    this.setAttribute("size", value.toString());
  }

  get size() {
    return parseFloat(this.getAttribute("size") || "0.01");
  }

  set gravity(value) {
    this.setAttribute("gravity", value.toString());
  }

  get gravity() {
    return parseFloat(this.getAttribute("gravity") || "0.001");
  }

  set damping(value) {
    this.setAttribute("damping", value.toString());
  }

  get damping() {
    return parseFloat(this.getAttribute("damping") || "0.98");
  }
}

// Input Connection Component (for explicit connections)
export class InputConnection extends HTMLElement {
  constructor() {
    super();
    this.style.display = "none";
  }

  static get observedAttributes() {
    return ["name", "from", "output"];
  }

  set name(value) {
    this.setAttribute("name", value);
  }

  get name() {
    return this.getAttribute("name") || "glTexture";
  }

  set from(value) {
    this.setAttribute("from", value);
  }

  get from() {
    return this.getAttribute("from");
  }

  set output(value) {
    this.setAttribute("output", value);
  }

  get output() {
    return this.getAttribute("output") || "default";
  }
}

// Register all components (only if not already defined)
function registerIfNotExists(name, constructor) {
  if (!customElements.get(name)) {
    try {
      customElements.define(name, constructor);
    } catch (error) {
      // Silently ignore if constructor is already used
      if (!error.message.includes("already been used")) {
        throw error;
      }
    }
  }
}

registerIfNotExists("minigl-node", MiniGLNode);
registerIfNotExists("shader-node", ShaderNode);
registerIfNotExists("image-node", ImageNode);
registerIfNotExists("video-node", VideoNode);
registerIfNotExists("canvas-node", CanvasNode);
registerIfNotExists("blend-node", BlendNode);
registerIfNotExists("feedback-node", FeedbackNode);
registerIfNotExists("particles-node", ParticlesNode);
registerIfNotExists("input-connection", InputConnection);

// Also create aliases for convenience
registerIfNotExists("minigl-shader", ShaderNode);
registerIfNotExists("minigl-image", ImageNode);
registerIfNotExists("minigl-video", VideoNode);
registerIfNotExists("minigl-canvas-node", CanvasNode);
registerIfNotExists("minigl-blend", BlendNode);
registerIfNotExists("minigl-feedback", FeedbackNode);
registerIfNotExists("minigl-particles", ParticlesNode);
