/**
 * miniGL_node.js - A node-based WebGL2 rendering pipeline
 * Focused on flexible composition of shader effects with node architecture
 *
 * TODO:
 * [✓] Basic class structure and core functionality
 * [✓] Base Node class
 * [✓] Connection system
 * [✓] Node types: TextureNode, ShaderNode, BlendNode, FeedbackNode
 *   [✓] TextureNode
 *   [✓] ShaderNode
 *   [✓] BlendNode
 *   [✓] FeedbackNode
 * [✓] Screen rendering from output node
 * [ ] Implement topological sorting for dependency resolution
 * [ ] Dependency tracking and execution optimization
 * [ ] Circular dependency handling for feedback loops
 * [ ] Render queue optimization
 * [ ] Enhanced debugging and visualization
 * [ ] Migration guide from miniGL.js
 */

import shaderLib from "./shaderLib.js";

class Node {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.name = options.name || this.id;
    this.inputs = new Map();
    this.outputs = new Set();
    this.isProcessing = false;
    this.lastUpdateTime = 0;
    this.width = options.width || gl.canvas.width;
    this.height = options.height || gl.canvas.height;
    this._lastFrame = -1; // For per-frame visited flag
  }

  connect(inputName, sourceNode, outputName = "default") {
    if (!sourceNode)
      throw new Error(
        `Cannot connect null source to ${this.name}.${inputName}`
      );
    this.inputs.set(inputName, { node: sourceNode, output: outputName });
    sourceNode.outputs.add(this);
    return this;
  }

  disconnect(inputName) {
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);
    }
    return this;
  }

  output(outputName = "default") {
    return null; // Override in subclasses
  }

  update(time, frameId) {
    // Prevent infinite recursion in feedback/circular graphs
    if (this._lastFrame === frameId) return;
    this._lastFrame = frameId;
    // Update all inputs first
    for (const [inputName, connection] of this.inputs) {
      connection.node.update(time, frameId);
    }
    this.process(time);
    this.lastUpdateTime = time;
  }

  process(time) {
    // Override in subclasses
  }

  size() {
    return [this.width, this.height];
  }
}

/**
 * TextureNode - Base class for all texture-producing nodes
 */
class TextureNode extends Node {
  constructor(gl, options = {}) {
    super(gl, options);
    this.texture = null;
    this.textureOptions = {
      filter: options.filter || "LINEAR",
      wrap: options.wrap || "CLAMP_TO_EDGE",
      mipmap: options.mipmap !== false,
      format: options.format || "FLOAT",
    };
    this.floatSupported = options.floatSupported || false;
    // Static transparent black fallback
    if (!TextureNode._transparentBlack) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      TextureNode._transparentBlack = tex;
    }
  }

  output(outputName = "default") {
    if (!this.texture && !this.isProcessing) {
      this.isProcessing = true;
      this.process(this.lastUpdateTime);
      this.isProcessing = false;
    }
    // If still not ready, return transparent black
    if (!this.texture) {
      return { texture: TextureNode._transparentBlack, width: 1, height: 1 };
    }
    return { texture: this.texture, width: this.width, height: this.height };
  }

  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
    }
    return this;
  }

  dispose() {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
  }
}

/**
 * CanvasTextureNode - Creates a texture from Canvas 2D drawing commands
 */
class CanvasTextureNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, {
      name: options.name || "CanvasTexture",
      ...options,
    });

    this.drawCallback = options.drawCallback;
    this.updateCallback = options.update;

    // Create canvas and context
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.context = this.canvas.getContext("2d");
  }

  process(time) {
    const gl = this.gl;
    const minigl = this.minigl;

    // Clear and set up the canvas
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.save();
    this.context.translate(this.width / 2, this.height / 2);
    this.context.scale(1, -1); // Flip Y for WebGL convention
    this.context.translate(-this.width / 2, -this.height / 2);

    // Call the drawing function
    if (this.drawCallback) {
      this.drawCallback(this.context, this.width, this.height);
    }

    this.context.restore();

    // Create or update the texture
    if (!this.texture) {
      this.texture = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    minigl._applyTextureParams(this.texture, this.textureOptions);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.canvas
    );

    if (this.textureOptions.mipmap !== false) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }

  // Update method to be called from the animation loop
  update(drawCallback) {
    if (!drawCallback) {
      return this;
    }
    this.drawCallback = drawCallback;
    this.process(this.minigl.clock);
    return this;
  }
}

/**
 * ImageTextureNode - Creates a texture from an image URL
 */
class ImageTextureNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, {
      name: options.name || "ImageTexture",
      ...options,
    });

    this.url = options.url;
    this.image = null;
    this.isLoading = false;
    this.isLoaded = false;

    // Start loading the image
    if (this.url) {
      this.load(this.url);
    }
  }

  load(url) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.isLoaded = false;
    this.url = url;

    const image = new Image();

    image.onload = () => {
      this.image = image;
      this.width = this.width || image.width;
      this.height = this.height || image.height;
      this.isLoaded = true;
      this.isLoading = false;
    };

    image.onerror = () => {
      console.error(`Failed to load image: ${url}`);
      this.isLoading = false;
    };

    image.crossOrigin = "anonymous";
    image.src = url;
  }

  process(time) {
    if (!this.isLoaded || !this.image) return;

    const gl = this.gl;
    const minigl = this.minigl;

    // If we need to resize the image, use canvas
    if (this.width !== this.image.width || this.height !== this.image.height) {
      const canvas = minigl._sharedCanvas;
      const ctx = minigl._sharedCtx;

      canvas.width = this.width;
      canvas.height = this.height;

      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(this.image, 0, 0, this.width, this.height);

      // Create or update the texture
      if (!this.texture) {
        this.texture = gl.createTexture();
      }

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      minigl._applyTextureParams(this.texture, this.textureOptions);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas
      );
    } else {
      // Direct image to texture
      if (!this.texture) {
        this.texture = gl.createTexture();
      }

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      minigl._applyTextureParams(this.texture, this.textureOptions);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.image
      );
    }

    if (this.textureOptions.mipmap !== false) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }
}

/**
 * ShaderNode - Executes a fragment shader and produces a texture
 */
class ShaderNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, options);

    if (!options.fragmentShader) throw new Error("Fragment shader required");

    this.fragmentShader = options.fragmentShader;
    this.vertexShader = options.vertexShader;
    this.uniforms = options.uniforms || {};
    this.framebuffer = null;
    this.program = null;
    this.defaultVertexShader = options.defaultVertexShader;

    this.createRenderTarget();
  }

  createRenderTarget() {
    const gl = this.gl;
    const useFloat = this.textureOptions.format === "FLOAT";
    const wrap =
      this.textureOptions.wrap === "REPEAT" ? gl.REPEAT : gl.CLAMP_TO_EDGE;

    let internalFormat, type;
    if (useFloat && this.floatSupported) {
      internalFormat = gl.RGBA32F;
      type = gl.FLOAT;
    } else {
      internalFormat = gl.RGBA8;
      type = gl.UNSIGNED_BYTE;
    }

    if (!this.texture) this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    const filter =
      this.textureOptions.filter === "NEAREST" ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      this.width,
      this.height,
      0,
      gl.RGBA,
      type,
      null
    );

    if (!this.framebuffer) this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      if (useFloat) {
        gl.deleteTexture(this.texture);
        gl.deleteFramebuffer(this.framebuffer);
        this.texture = null;
        this.framebuffer = null;
        this.textureOptions.format = null;
        this.createRenderTarget();
        return;
      }
      throw new Error(`Framebuffer not complete: ${status}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.isFloat = useFloat && this.floatSupported;
  }

  ensureProgram() {
    if (this.program) return;
    if (!this.minigl) return;

    const vertexSource =
      this.vertexShader ||
      this.defaultVertexShader ||
      this.minigl.VERTEX_SHADER;
    this.program = this.minigl.createProgram(vertexSource, this.fragmentShader);
  }

  process(time) {
    const gl = this.gl;
    this.ensureProgram();
    if (!this.program || !this.minigl) return;

    const defaultUniforms = this.minigl.getGlobalUniforms(
      this.width,
      this.height,
      time
    );

    const inputTextures = {};
    for (const [inputName, connection] of this.inputs) {
      const output = connection.node.output(connection.output);
      if (output?.texture) {
        inputTextures[inputName] = output;
        // Add size uniform for each input texture
        const size = connection.node.size();
        inputTextures[`${inputName}Size`] = { x: size[0], y: size[1] };
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.minigl.vao);

    this.minigl.setUniforms(this.program, {
      ...defaultUniforms,
      ...this.uniforms,
      ...inputTextures,
    });

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.createRenderTarget();
    }
    return this;
  }

  dispose() {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    if (this.program) gl.deleteProgram(this.program);
    this.texture = this.framebuffer = this.program = null;
  }
}

/**
 * FeedbackNode - Creates a ping-pong feedback texture for iterative effects
 */
class FeedbackNode extends ShaderNode {
  constructor(gl, options = {}) {
    super(gl, options);

    this.textureB = null;
    this.framebufferB = null;
    this.currentIndex = 0;
    this.createSecondTarget();
    this.initialized = false;
  }

  createSecondTarget() {
    const gl = this.gl;
    const useFloat = this.isFloat;
    const wrap =
      this.textureOptions.wrap === "REPEAT" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    const internalFormat = useFloat ? gl.RGBA32F : gl.RGBA8;
    const type = useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;
    console.log(useFloat);
    if (!this.textureB) this.textureB = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.textureB);

    const filter =
      this.textureOptions.filter === "NEAREST" ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      this.width,
      this.height,
      0,
      gl.RGBA,
      type,
      null
    );

    if (!this.framebufferB) this.framebufferB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferB);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.textureB,
      0
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  process(time) {
    const gl = this.gl;
    this.ensureProgram();
    if (!this.program || !this.minigl) return;

    // Swap targets
    this.currentIndex = 1 - this.currentIndex;

    // Determine current and previous textures/framebuffers
    const current =
      this.currentIndex === 0
        ? { texture: this.texture, framebuffer: this.framebuffer }
        : { texture: this.textureB, framebuffer: this.framebufferB };

    const previous =
      this.currentIndex === 1
        ? { texture: this.texture, framebuffer: this.framebuffer }
        : { texture: this.textureB, framebuffer: this.framebufferB };

    const defaultUniforms = this.minigl.getGlobalUniforms(
      this.width,
      this.height,
      time
    );

    // Add previous texture to uniforms
    defaultUniforms.glPrevious = { texture: previous.texture };

    const inputTextures = {};
    for (const [inputName, connection] of this.inputs) {
      const output = connection.node.output(connection.output);
      if (output?.texture) inputTextures[inputName] = output;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, current.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.minigl.vao);

    this.minigl.setUniforms(this.program, {
      ...defaultUniforms,
      ...this.uniforms,
      ...inputTextures,
    });

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.initialized = true;
  }

  output(outputName = "default") {
    const currentTexture =
      this.currentIndex === 0 ? this.texture : this.textureB;
    return { texture: currentTexture, width: this.width, height: this.height };
  }

  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.createRenderTarget();
      this.createSecondTarget();
      this.initialized = false;
    }
    return this;
  }

  dispose() {
    super.dispose();
    const gl = this.gl;
    if (this.textureB) {
      gl.deleteTexture(this.textureB);
      this.textureB = null;
    }
    if (this.framebufferB) {
      gl.deleteFramebuffer(this.framebufferB);
      this.framebufferB = null;
    }
  }
}

// --- MRTNode: Multi-Render Target Node (up to 4 outputs) ---
class MRTNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, options);
    this.numTargets = Math.min(options.numTargets || 2, 4);
    this.textures = [];
    this.framebuffer = null;
    this.program = null;
    this.fragmentShader = options.fragmentShader;
    this.vertexShader = options.vertexShader;
    this.uniforms = options.uniforms || {};
    this.defaultVertexShader = options.defaultVertexShader;
    this.createRenderTargets();
  }
  createRenderTargets() {
    const gl = this.gl;
    const useFloat = this.textureOptions.format === "FLOAT";
    const wrap =
      this.textureOptions.wrap === "REPEAT" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    let internalFormat, type;
    if (useFloat && this.floatSupported) {
      internalFormat = gl.RGBA32F;
      type = gl.FLOAT;
    } else {
      internalFormat = gl.RGBA8;
      type = gl.UNSIGNED_BYTE;
    }
    // Create N textures
    this.textures = [];
    for (let i = 0; i < this.numTargets; ++i) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        this.width,
        this.height,
        0,
        gl.RGBA,
        type,
        null
      );
      this.textures.push(tex);
    }
    // Create framebuffer and attach all textures
    if (!this.framebuffer) this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    const drawBuffers = [];
    for (let i = 0; i < this.numTargets; ++i) {
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        this.textures[i],
        0
      );
      drawBuffers.push(gl.COLOR_ATTACHMENT0 + i);
    }
    gl.drawBuffers(drawBuffers);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`MRT framebuffer not complete: ${status}`);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  ensureProgram() {
    if (this.program) return;
    if (!this.minigl) return;
    const vertexSource =
      this.vertexShader ||
      this.defaultVertexShader ||
      this.minigl.VERTEX_SHADER;
    this.program = this.minigl.createProgram(vertexSource, this.fragmentShader);
  }
  process(time) {
    const gl = this.gl;
    this.ensureProgram();
    if (!this.program || !this.minigl) return;
    const defaultUniforms = this.minigl.getGlobalUniforms(
      this.width,
      this.height,
      time
    );
    const inputTextures = {};
    for (const [inputName, connection] of this.inputs) {
      const output = connection.node.output(connection.output);
      if (output?.texture) {
        inputTextures[inputName] = output;
        const size = connection.node.size();
        inputTextures[`${inputName}Size`] = { x: size[0], y: size[1] };
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.minigl.vao);
    this.minigl.setUniforms(this.program, {
      ...defaultUniforms,
      ...this.uniforms,
      ...inputTextures,
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  output(outputName = "default") {
    // outputName: "0", "1", ...
    const idx = outputName === "default" ? 0 : parseInt(outputName, 10);
    return {
      texture: this.textures[idx] || this.textures[0],
      width: this.width,
      height: this.height,
    };
  }
  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.createRenderTargets();
    }
    return this;
  }
  dispose() {
    const gl = this.gl;
    for (const tex of this.textures) gl.deleteTexture(tex);
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    if (this.program) gl.deleteProgram(this.program);
    this.textures = [];
    this.framebuffer = this.program = null;
  }
}

// --- VideoTextureNode: Like ImageTextureNode, but for <video> ---
class VideoTextureNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, {
      name: options.name || "VideoTexture",
      ...options,
    });
    this.url = options.url;
    this.video = null;
    this.isLoaded = false;
    if (this.url) {
      this.load(this.url);
    }
  }
  load(url) {
    if (this.isLoaded) return;
    this.url = url;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.addEventListener("canplay", () => {
      this.video = video;
      this.width = this.width || video.videoWidth;
      this.height = this.height || video.videoHeight;
      this.isLoaded = true;
      video.play();
    });
    video.load();
  }
  process(time) {
    if (!this.isLoaded || !this.video || this.video.readyState < 2) return;
    const gl = this.gl;
    const minigl = this.minigl;
    if (!this.texture) {
      this.texture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    minigl._applyTextureParams(this.texture, this.textureOptions);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.video
    );
    if (this.textureOptions.mipmap !== false) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }
}

class miniGL {
  constructor(id) {
    this.canvas = document.getElementById(id);
    this.gl = this.canvas.getContext("webgl2");
    this.clock = 0;
    this.nodes = new Map(); // All nodes by ID
    this.outputNode = null; // The final node to render to screen
    this.mouse = { x: 0.5, y: 0.5, click: 0 };
    this.prevMouse = { x: 0.5, y: 0.5 };
    this.mouseVelocity = { x: 0.0, y: 0.0 };
    this.lastMouseUpdateTime = 0;
    this.pixel = { x: 0, y: 0 }; // Will be set in resize()
    this.ratio = 1.0; // Aspect ratio (width/height)
    this.isVisible = true; // For intersection observer
    this.eventController = new AbortController(); // For cleaning up event listeners

    // Create a shared canvas for texture operations
    this._sharedCanvas = document.createElement("canvas");
    this._sharedCtx = this._sharedCanvas.getContext("2d");

    // Default vertex shader with aspect ratio correction
    this.VERTEX_SHADER = `#version 300 es
        layout(location = 0) in vec3 aPosition;
        layout(location = 1) in vec2 aTexCoord;
        uniform float glRatio;
        out vec2 vTexCoord;
        out vec2 glUV;
        out vec2 glCoord; // Corrected square UVs

        void main() {
          gl_Position = vec4(aPosition, 1.0);
          vTexCoord = vec2(aTexCoord.x, aTexCoord.y);
          glUV = aTexCoord;
          float aspectRatio = glRatio;
          glCoord = aTexCoord - .5;
          glCoord.x *= glRatio;
          glCoord += .5;

        }`;

    if (!this.gl) throw new Error("WebGL2 not supported");

    // Set up WebGL
    this.setupWebGL();
    this.setupObservers();
    this.setupEventListeners();
    this.resize();
  }

  setupWebGL() {
    // Check for float texture support
    this.floatSupported = false;
    if (this.gl.getExtension("EXT_color_buffer_float")) {
      this.floatSupported = true;
      console.log(this.floatSupported);
      this.gl.getExtension("OES_texture_float_linear");
    }

    // Enable blending
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Create full-screen triangle
    this.createFullScreenTriangle();
  }

  createFullScreenTriangle() {
    const vertices = new Float32Array([
      -1.0, -1.0, 0.0, 0.0, 0.0, 3.0, -1.0, 0.0, 2.0, 0.0, -1.0, 3.0, 0.0, 0.0,
      2.0,
    ]);

    this.triangleBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.triangleBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 20, 0);

    this.gl.enableVertexAttribArray(1);
    this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 20, 12);

    this.gl.bindVertexArray(null);
  }

  setupObservers() {
    // ResizeObserver removed as it causes black frames during resize

    // IntersectionObserver to only render when visible
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === this.canvas) {
            this.isVisible = entry.isIntersecting;
          }
        }
      },
      {
        threshold: 0.1, // Consider visible when at least 10% is in view
      }
    );
    this.intersectionObserver.observe(this.canvas);
  }

  // Ignore the resize observer
  ignoreResize() {
    // Remove the resize event listener if it exists
    if (this._resizeListener) {
      window.removeEventListener("resize", this._resizeListener);
      this._resizeListener = null;
    }
    return this;
  }

  // Ignore the intersection observer
  ignoreIntersection() {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(this.canvas);
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
      this.isVisible = true; // Always consider visible from now on
    }
    return this;
  }

  setupEventListeners() {
    const signal = this.eventController.signal;

    // Set up resize handling via window event
    this._resizeListener = () => {
      if (this.canvas) {
        this.resize();
      }
    };
    window.addEventListener("resize", this._resizeListener);

    this.canvas.addEventListener(
      "mousemove",
      (e) => {
        this.prevMouse.x = this.mouse.x;
        this.prevMouse.y = this.mouse.y;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) / this.canvas.width;
        this.mouse.y = 1.0 - (e.clientY - rect.top) / this.canvas.height;

        const now = performance.now();
        const deltaTime = now - this.lastMouseUpdateTime;

        if (deltaTime > 0) {
          const timeFactor = Math.min(1000 / 60, deltaTime) / (1000 / 60);
          this.mouseVelocity.x = (this.mouse.x - this.prevMouse.x) / timeFactor;
          this.mouseVelocity.y = (this.mouse.y - this.prevMouse.y) / timeFactor;

          // const damping = 0.8;
          // this.mouseVelocity.x *= damping;
          // this.mouseVelocity.y *= damping;
        }

        this.lastMouseUpdateTime = now;
      },
      { signal }
    );

    this.canvas.addEventListener(
      "mousedown",
      () => {
        this.mouse.click = 1;
      },
      { signal }
    );

    this.canvas.addEventListener(
      "mouseup",
      () => {
        this.mouse.click = 0;
      },
      { signal }
    );

    this.canvas.addEventListener(
      "mouseleave",
      () => {
        this.mouseVelocity.x *= 0.5;
        this.mouseVelocity.y *= 0.5;
        if (Math.abs(this.mouseVelocity.x) < 0.01) this.mouseVelocity.x = 0;
        if (Math.abs(this.mouseVelocity.y) < 0.01) this.mouseVelocity.y = 0;
      },
      { signal }
    );

    // Clean up event listeners when the window is unloaded
    window.addEventListener("unload", () => {
      this.dispose();
    });
  }

  dispose() {
    // Clean up all event listeners
    this.eventController.abort();

    // Clean up resize listener
    this.ignoreResize();

    // Clean up observers
    this.ignoreIntersection();

    // Clean up WebGL resources
    // Note: Could add more cleanup for specific WebGL resources here
    if (this.gl) {
      if (this.triangleBuffer) this.gl.deleteBuffer(this.triangleBuffer);
      if (this.vao) this.gl.deleteVertexArray(this.vao);
      if (this._screenProgram) this.gl.deleteProgram(this._screenProgram);
    }

    // Clean up nodes
    for (const node of this.nodes.values()) {
      node.dispose();
    }

    this.nodes.clear();
  }

  // Add a node to the graph
  addNode(node) {
    this.nodes.set(node.id, node);
    return node;
  }

  // Set the output node (final render target)
  setOutput(node) {
    this.outputNode = node;
    return this;
  }

  // Shorter alias for setOutput
  output(node) {
    return this.setOutput(node);
  }

  // Topological sort utility
  _topoSort(outputNode) {
    const visited = new Set();
    const order = [];
    function visit(node) {
      if (visited.has(node)) return;
      visited.add(node);
      for (const conn of node.inputs.values()) {
        visit(conn.node);
      }
      order.push(node);
    }
    visit(outputNode);
    return order;
  }

  // Rendering and update logic
  render() {
    if (!this.isVisible && this.intersectionObserver) return;
    this.clock++;
    const currentTime = this.clock;
    if (performance.now() - this.lastMouseUpdateTime > 16) {
      this.mouseVelocity.x *= 0.95;
      this.mouseVelocity.y *= 0.95;
      if (Math.abs(this.mouseVelocity.x) < 0.001) this.mouseVelocity.x = 0;
      if (Math.abs(this.mouseVelocity.y) < 0.001) this.mouseVelocity.y = 0;
    }
    if (!this.outputNode) return;
    // Topo sort and update all nodes in order
    const frameId = this.clock;
    const order = this._topoSort(this.outputNode);
    for (const node of order) {
      node.update(currentTime, frameId);
    }
    this.renderToScreen();
  }

  renderToScreen() {
    if (!this.outputNode) return;

    const gl = this.gl;
    const output = this.outputNode.output();

    if (!output || !output.texture) {
      console.warn("Output node has no valid texture");
      return;
    }

    // Use a simple pass-through shader for final render
    if (!this._screenProgram) {
      const fragmentShader = `#version 300 es
        precision highp float;
        uniform sampler2D glTexture;
        in vec2 glUV;
        out vec4 fragColor;
        void main() {
          fragColor = texture(glTexture, glUV);
        }
      `;

      this._screenProgram = this.createProgram(
        this.VERTEX_SHADER,
        fragmentShader
      );
    }

    // Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this._screenProgram);
    gl.bindVertexArray(this.vao);

    // Get global uniforms
    const globalUniforms = this.getGlobalUniforms(
      this.canvas.width,
      this.canvas.height,
      this.clock
    );

    // Add output texture
    globalUniforms.glTexture = output;

    // Set uniforms
    this.setUniforms(this._screenProgram, globalUniforms);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  resize() {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (
      this.canvas.width !== displayWidth ||
      this.canvas.height !== displayHeight
    ) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;

      // Update pixel uniform
      this.pixel.x = 1.0 / this.canvas.width;
      this.pixel.y = 1.0 / this.canvas.height;

      // Update ratio
      this.ratio = this.canvas.width / this.canvas.height;

      // Resize all nodes
      for (const node of this.nodes.values()) {
        node.resize(this.canvas.width, this.canvas.height);
      }
    }
  }

  // Get global uniforms for all shaders
  getGlobalUniforms(width, height, time) {
    const uniforms = {
      // New 'gl' prefixed global uniforms
      glResolution: { x: width, y: height },
      glTime: time,
      glMouse: { x: this.mouse.x, y: this.mouse.y, z: this.mouse.click },
      glVelocity: { x: this.mouseVelocity.x, y: this.mouseVelocity.y },
      glPixel: { x: this.pixel.x, y: this.pixel.y },
      glRatio: this.ratio,
    };

    return uniforms;
  }

  // Utility methods
  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      fragmentSource
    );

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }

    return program;
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    }

    return shader;
  }

  // Apply texture parameters
  _applyTextureParams(texture, options = {}) {
    const gl = this.gl;
    const filter = options.filter === "NEAREST" ? gl.NEAREST : gl.LINEAR;
    const wrap = options.wrap === "REPEAT" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    const mipmap = options.mipmap !== false;

    if (mipmap && filter === gl.LINEAR) {
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
      );
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  }

  // Set shader uniforms
  setUniforms(program, uniforms) {
    const gl = this.gl;

    // Safety check for program
    if (!program) {
      console.warn("setUniforms: program is null or undefined");
      return;
    }

    let textureUnit = 0;

    for (const name in uniforms) {
      const value = uniforms[name];

      if (value === null || value === undefined) continue;

      const location = gl.getUniformLocation(program, name);
      if (location === null) continue;

      if (typeof value === "number") {
        if (name.startsWith("i")) {
          gl.uniform1i(location, Math.round(value));
        } else {
          gl.uniform1f(location, value);
        }
      } else if (typeof value === "boolean") {
        gl.uniform1i(location, value ? 1 : 0);
      } else if (Array.isArray(value)) {
        const len = value.length;
        if (len === 2) gl.uniform2fv(location, value);
        else if (len === 3) gl.uniform3fv(location, value);
        else if (len === 4) gl.uniform4fv(location, value);
      } else if (value.texture) {
        // Handle texture objects
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, value.texture);
        gl.uniform1i(location, textureUnit);
        textureUnit++;
      } else if (value.x !== undefined) {
        if (value.z !== undefined) {
          if (value.w !== undefined) {
            gl.uniform4f(location, value.x, value.y, value.z, value.w);
          } else {
            gl.uniform3f(location, value.x, value.y, value.z);
          }
        } else {
          gl.uniform2f(location, value.x, value.y);
        }
      }
    }
  }

  // Preprocess shader source to replace <#tag> references with actual code
  preprocessShader(shaderSource, maxDepth = 3, _depth = 0) {
    if (!shaderSource.includes("<#")) return shaderSource;
    if (_depth > maxDepth) {
      console.warn("Shader preprocess: max depth exceeded");
      return shaderSource;
    }
    const tagRegex = /<#([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)>/g;
    const dependencies = new Set();
    let match;
    while ((match = tagRegex.exec(shaderSource)) !== null) {
      const category = match[1];
      const func = match[2];
      dependencies.add(`${category}.${func}`);
    }
    const processedSnippets = new Map();
    const processSnippet = (category, func, depth) => {
      const key = `${category}.${func}`;
      if (processedSnippets.has(key)) return processedSnippets.get(key);
      if (!shaderLib[category] || !shaderLib[category][func]) {
        console.warn(`Shader snippet not found: ${key}`);
        return "";
      }
      let snippet = shaderLib[category][func];
      // Recursively expand nested tags up to maxDepth
      if (depth < maxDepth) {
        snippet = this.preprocessShader(snippet, maxDepth, depth + 1);
      }
      processedSnippets.set(key, snippet);
      return snippet;
    };
    for (const dep of dependencies) {
      const [category, func] = dep.split(".");
      processSnippet(category, func, _depth);
    }
    let processedShader = shaderSource;
    for (const [key, code] of processedSnippets.entries()) {
      const [category, func] = key.split(".");
      const tag = `<#${category}.${func}>`;
      processedShader = processedShader.replace(new RegExp(tag, "g"), code);
    }
    return processedShader;
  }

  // Create a shader node
  createShaderNode(fragmentShader, options = {}) {
    // Preprocess the shader first to handle <#tag> references
    const processedShader = this.preprocessShader(fragmentShader);

    const node = new ShaderNode(this.gl, {
      fragmentShader: processedShader,
      vertexShader: options.vertexShader,
      defaultVertexShader: this.VERTEX_SHADER,
      floatSupported: this.floatSupported,
      uniforms: options.uniforms || {},
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
      format: options.format,
      name: options.name,
    });

    // Store reference to the miniGL instance
    node.minigl = this;

    return this.addNode(node);
  }

  // Create a shader node (alias for createShaderNode)
  shader(fragmentShader, options = {}) {
    return this.createShaderNode(fragmentShader, options);
  }

  // Create a feedback node
  createFeedbackNode(fragmentShader, options = {}) {
    // Preprocess the shader first to handle <#tag> references
    const processedShader = this.preprocessShader(fragmentShader);

    const node = new FeedbackNode(this.gl, {
      fragmentShader: processedShader,
      vertexShader: options.vertexShader,
      defaultVertexShader: this.VERTEX_SHADER,
      floatSupported: this.floatSupported,
      uniforms: options.uniforms || {},
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
      format: options.format,
      name: options.name,
    });

    // Store reference to the miniGL instance
    node.minigl = this;

    return this.addNode(node);
  }

  // Create a feedback node (alias for createFeedbackNode)
  pingpong(fragmentShader, options = {}) {
    return this.createFeedbackNode(fragmentShader, options);
  }

  // Factory method for image texture node
  createImageTexture(url, options = {}) {
    const node = new ImageTextureNode(this.gl, {
      url,
      width: options.width,
      height: options.height,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
      name: options.name,
    });

    // Store reference to the miniGL instance
    node.minigl = this;

    return this.addNode(node);
  }

  // Shorter alias for createImageTexture
  image(url, options = {}) {
    return this.createImageTexture(url, options);
  }

  // Factory method for canvas texture node
  createCanvasTexture(drawCallback, options = {}) {
    const node = new CanvasTextureNode(this.gl, {
      drawCallback,
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
      name: options.name,
    });

    // Store reference to the miniGL instance
    node.minigl = this;

    return this.addNode(node);
  }

  // Shorter alias for createCanvasTexture
  canvas(drawCallback, options = {}) {
    return this.createCanvasTexture(drawCallback, options);
  }

  // Create a blend shader node
  createBlendNode(options = {}) {
    const blendMode = options.blendMode || "normal";
    const opacity = options.opacity !== undefined ? options.opacity : 1.0;

    // Simple blend shader that uses the blend function from the shader library
    const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D glBase;
    uniform sampler2D glBlend;
    uniform float glOpacity;
    
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    <#blend.${blendMode}>
    
    void main() {
      vec4 baseColor = texture(glBase, vTexCoord);
      vec4 blendColor = texture(glBlend, vTexCoord);
      
      // Apply opacity to the blend layer
      blendColor.a *= glOpacity;
      
      // Apply the blend mode
      fragColor = blend_${blendMode}(baseColor, blendColor);
    }`;

    // Create shader with processed blend function
    return this.shader(fragmentShader, {
      name: options.name || `Blend_${blendMode}`,
      uniforms: { glOpacity: opacity },
      ...options,
    });
  }

  // Shorter alias for createBlendNode
  blend(options = {}) {
    return this.createBlendNode(options);
  }

  // Helper method to create common node connections
  connect(
    sourceNode,
    targetNode,
    inputName = "glTexture",
    outputName = "default"
  ) {
    targetNode.connect(inputName, sourceNode, outputName);
    return this; // Return 'this' for chaining with miniGL methods
  }

  // Factory method for MRT node
  createMRTNode(fragmentShader, options = {}) {
    const processedShader = this.preprocessShader(fragmentShader);
    const node = new MRTNode(this.gl, {
      fragmentShader: processedShader,
      vertexShader: options.vertexShader,
      defaultVertexShader: this.VERTEX_SHADER,
      floatSupported: this.floatSupported,
      uniforms: options.uniforms || {},
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
      format: options.format,
      name: options.name,
      numTargets: options.numTargets || 2,
    });
    node.minigl = this;
    return this.addNode(node);
  }

  // Shorter alias
  mrt(fragmentShader, options = {}) {
    return this.createMRTNode(fragmentShader, options);
  }

  // Factory method for video texture node
  createVideoTexture(url, options = {}) {
    const node = new VideoTextureNode(this.gl, {
      url,
      width: options.width,
      height: options.height,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
      name: options.name,
    });
    node.minigl = this;
    return this.addNode(node);
  }

  // Shorter alias
  video(url, options = {}) {
    return this.createVideoTexture(url, options);
  }
}

// Export the new node-based system
export default miniGL;
