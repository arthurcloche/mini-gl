/**
 * miniGL_node.js - A node-based WebGL2 rendering pipeline
 * Focused on flexible composition of shader effects with node architecture
 * Made w/ love for Shopify, 2025
 **/

export class Node {
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
    if (this.minigl) this.minigl._graphDirty = true;
    return this;
  }

  disconnect(inputName) {
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);
      if (this.minigl) this.minigl._graphDirty = true;
    }
    return this;
  }

  output(outputName = "default") {
    return null; // Override in subclasses
  }

  update(time, frameId) {
    if (this._lastFrame === frameId) return this._lastOutput;
    this._lastFrame = frameId;
    for (const [inputName, connection] of this.inputs) {
      connection.node.update(time, frameId);
    }
    this.process(time);
    this.lastUpdateTime = time;
    this._lastOutput = this.output(); // Cache output after processing
    return this._lastOutput;
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
export class TextureNode extends Node {
  constructor(gl, options = {}) {
    super(gl, options);
    this.texture = null;
    this.textureOptions = {
      filter: options.filter || "LINEAR",
      wrap: options.wrap || "CLAMP_TO_EDGE",
      mipmap: options.mipmap !== false,
      mipmapFilter: options.mipmapFilter || "linear-linear",
      format: options.format || "FLOAT",
    };
    this.floatSupported = options.floatSupported || false;
  }

  output(outputName = "default") {
    if (!this.texture && !this.isProcessing) {
      this.isProcessing = true;
      this.process(this.lastUpdateTime);
      this.isProcessing = false;
    }
    // If still not ready, return transparent black
    if (!this.texture) {
      return { texture: this.minigl?.TransparentPixel, width: 1, height: 1 };
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

  async bake() {
    // Render this node to a new 2D texture, return a new TextureNode with the result
    const gl = this.gl;
    const minigl = this.minigl;
    const width = this.width;
    const height = this.height;
    // Create framebuffer and texture
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );
    // Render this node to the framebuffer
    const prevFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.viewport(0, 0, width, height);
    // Use a simple pass-through shader
    if (!minigl._bakeProgram) {
      const frag = `#version 300 es\nprecision highp float;\nuniform sampler2D src;\nin vec2 glCoord;\nout vec4 fragColor;\nvoid main() { fragColor = texture(src, glCoord); }`;
      minigl._bakeProgram = minigl.createProgram(minigl.VERTEX_SHADER, frag);
    }
    gl.useProgram(minigl._bakeProgram);
    gl.bindVertexArray(minigl.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.output().texture);
    gl.uniform1i(gl.getUniformLocation(minigl._bakeProgram, "src"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFB);
    // Return a new TextureNode with the baked texture
    const baked = new TextureNode(gl, { width, height });
    baked.texture = tex;
    baked.minigl = minigl;
    return baked;
  }
}

/**
 * CanvasTextureNode - Creates a texture from Canvas 2D drawing commands
 */
export class CanvasTextureNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, {
      name: options.name || "CanvasTexture",
      ...options,
    });

    this.drawCallback = options.drawCallback;
    this.updateCallback = options.update;
    this.dirty = true;

    // Create canvas and context
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.context = this.canvas.getContext("2d");
  }

  process(time) {
    if (!this.dirty) return;
    this.dirty = false;
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
    this.dirty = true;
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
    this.fitting = options.fitting || "fill"; // 'none', 'fit', 'cover' || 'fill'
    this.image = null;
    this.isLoading = false;
    this.isLoaded = false;
    this.dirty = true;

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
      this.dirty = true;
    };

    image.onerror = () => {
      console.error(`Failed to load image: ${url}`);
      this.isLoading = false;
    };

    image.crossOrigin = "anonymous";
    image.src = url;
  }

  process(time) {
    if (!this.dirty || !this.isLoaded || !this.image) return;
    this.dirty = false;
    const gl = this.gl;
    const minigl = this.minigl;

    // Set pixel store parameter to flip Y for correct orientation
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Always use canvas for fitting calculations
    const canvas = minigl._sharedCanvas;
    const ctx = minigl._sharedCtx;

    canvas.width = this.width;
    canvas.height = this.height;
    ctx.clearRect(0, 0, this.width, this.height);

    // Calculate drawing parameters based on fitting mode
    let drawX = 0,
      drawY = 0,
      drawWidth = this.width,
      drawHeight = this.height;

    if (this.fitting === "fit") {
      // Scale to fit inside while maintaining aspect ratio (contain)
      const scale = Math.min(
        this.width / this.image.width,
        this.height / this.image.height
      );
      drawWidth = this.image.width * scale;
      drawHeight = this.image.height * scale;
      drawX = (this.width - drawWidth) / 2;
      drawY = (this.height - drawHeight) / 2;
    } else if (this.fitting === "cover" || this.fitting === "fill") {
      // Scale to cover entire area while maintaining aspect ratio
      const scale = Math.max(
        this.width / this.image.width,
        this.height / this.image.height
      );
      drawWidth = this.image.width * scale;
      drawHeight = this.image.height * scale;
      drawX = (this.width - drawWidth) / 2;
      drawY = (this.height - drawHeight) / 2;
    }

    ctx.drawImage(this.image, drawX, drawY, drawWidth, drawHeight);

    // Create or update the texture
    if (!this.texture) {
      this.texture = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    minigl._applyTextureParams(this.texture, this.textureOptions);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

    // Reset pixel store parameter
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    if (this.textureOptions.mipmap !== false) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }
}

/**
 * ShaderNode - Executes a fragment shader and produces a texture
 */
export class ShaderNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, options);
    if (!options.fragmentShader) throw new Error("Fragment shader required");
    this.fragmentShader = options.fragmentShader;
    this.uniforms = options.uniforms || {};
    this.framebuffer = null;
    this.program = null;

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
    this.program = this.minigl.createProgram(
      this.minigl.VERTEX_SHADER,
      this.fragmentShader
    );
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

  updateUniform(key, value) {
    this.uniforms[key] = value;
    return this;
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

  updateUniform(key, value) {
    this.uniforms[key] = value;
    return this;
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
    this.uniforms = options.uniforms || {};
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
    const vertexSource = this.minigl.VERTEX_SHADER;

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

  updateUniform(key, value) {
    this.uniforms[key] = value;
    return this;
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
    this.dirty = true;
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
      this.dirty = true;
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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
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

    this.dirty = false; // Mark as clean after processing
  }
}

// --- ParticleNode: Instanced particle renderer with optional simulation ---
class ParticleNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, {
      name: options.name || "Particles",
      ...options,
    });

    // Particle configuration
    this.maxParticles = options.count || 10000;
    this.particleSize = options.size || 0.005;
    this.activeParticleCount = this.maxParticles;

    // Calculate texture size for particle data (square texture)
    this.dataTextureSize = Math.ceil(Math.sqrt(this.maxParticles));
    this.actualParticleCount = this.dataTextureSize * this.dataTextureSize;

    // Rendering shaders (vertex stays internal, fragment is customizable)
    this.vertexShader = this.getDefaultVertexShader();
    this.fragmentShader =
      options.fragmentShader || this.getDefaultFragmentShader();
    this.particleUniforms = options.particleUniforms || {};

    // Simple fallback simulation (used when no external simulation is connected)
    this.fallbackSimulation = {
      gravity: 0.0005,
      damping: 0.95,
      spawnRate: 0.03,
      ...(options.simulationUniforms || {}),
    };

    // Instanced rendering setup
    this.quadVAO = null;
    this.particleProgram = null;
    this.instanceBuffer = null;
    this.quadBuffer = null;

    // Internal fallback simulation node (only used if no external input)
    this.internalSimulation = null;
    this.initialized = false;
    this.hasExternalSimulation = false;
  }

  initialize() {
    if (this.initialized) return;

    this.setupInstancedRendering();
    this.createParticleRenderTarget();
    this.initialized = true;
  }

  // Create internal simulation only when needed (no external input)
  ensureInternalSimulation() {
    if (this.internalSimulation || this.hasExternalSimulation) return;

    this.internalSimulation = new FeedbackNode(this.gl, {
      fragmentShader: this.getDefaultSimulationShader(),
      width: this.dataTextureSize,
      height: this.dataTextureSize,
      format: "FLOAT",
      filter: "NEAREST",
      wrap: "CLAMP_TO_EDGE",
      floatSupported: this.minigl.floatSupported,
      name: "ParticleFallbackSimulation",
    });

    this.internalSimulation.minigl = this.minigl;
  }

  setupInstancedRendering() {
    const gl = this.gl;

    // Create VAO
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);

    // Quad geometry (2 triangles)
    const quadVertices = new Float32Array([
      -1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
    ]);

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Instance IDs (one per particle)
    const instanceIds = new Float32Array(this.actualParticleCount);
    for (let i = 0; i < this.actualParticleCount; i++) {
      instanceIds[i] = i;
    }

    this.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceIds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1); // Advance per instance

    gl.bindVertexArray(null);

    // Create particle shader program
    this.createParticleProgram();
  }

  createParticleProgram() {
    this.particleProgram = this.minigl.createProgram(
      this.vertexShader,
      this.fragmentShader
    );
  }

  createParticleRenderTarget() {
    const gl = this.gl;

    // Create the output texture
    if (!this.texture) this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    // Create the framebuffer
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
      throw new Error(`Particle framebuffer not complete: ${status}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  process(time) {
    if (!this.initialized) this.initialize();

    // Get particle data texture (from external input or internal simulation)
    let particleDataTexture;

    if (this.hasExternalSimulation) {
      // Use external simulation texture
      const simulationInput = this.inputs.get("simulationTexture");
      if (simulationInput) {
        particleDataTexture = simulationInput.node.output(
          simulationInput.output
        ).texture;
      }
    }

    if (!particleDataTexture) {
      // Fall back to internal simulation
      this.ensureInternalSimulation();

      // Update internal simulation
      const globalUniforms = this.minigl.getGlobalUniforms(
        this.dataTextureSize,
        this.dataTextureSize,
        time
      );

      this.internalSimulation.uniforms = {
        ...globalUniforms,
        ...this.fallbackSimulation,
      };

      this.internalSimulation.process(time);
      particleDataTexture = this.internalSimulation.output().texture;
    }

    // Render particles
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for particles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.particleProgram);
    gl.bindVertexArray(this.quadVAO);

    // Set uniforms for particle rendering
    const renderUniforms = this.minigl.getGlobalUniforms(
      this.width,
      this.height,
      time
    );

    // Combine all uniforms for the particle fragment shader
    const allUniforms = {
      ...renderUniforms,
      ...this.particleUniforms,
      particleData: { texture: particleDataTexture },
      particleSize: this.particleSize,
    };

    // Set uniforms using miniGL's uniform system
    this.minigl.setUniforms(this.particleProgram, allUniforms);

    // Draw all particles
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.activeParticleCount);

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Public API methods
  updateUniform(key, value) {
    // Check if it's a simulation uniform or particle uniform
    if (key in this.fallbackSimulation) {
      this.fallbackSimulation[key] = value;
    } else {
      this.particleUniforms[key] = value;
    }
    return this;
  }

  connect(inputName, sourceNode, outputName = "default") {
    // Track the connection for graph integration
    this.inputs.set(inputName, { node: sourceNode, output: outputName });
    sourceNode.outputs.add(this);

    // Check if this is a simulation texture connection
    if (inputName === "simulationTexture") {
      this.hasExternalSimulation = true;
    }

    return this;
  }

  disconnect(inputName) {
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);

      // Check if we're disconnecting the simulation
      if (inputName === "simulationTexture") {
        this.hasExternalSimulation = false;
      }
    }
    return this;
  }

  // API method for connecting external simulation
  simulation(simulationNode) {
    this.connect("simulationTexture", simulationNode);
    return this;
  }

  // Main API method for customizing particle rendering
  particle(fragmentShader, uniforms = {}, options = {}) {
    // Create a specialized particle shader node that uses particle vertex shader
    const particleShaderNode = new ParticleShaderNode(this.gl, {
      fragmentShader: fragmentShader,
      uniforms: uniforms,
      particleRenderer: this,
      quadSize: options.quadSize || 0.03, // Larger default for sprite rendering
      width: this.width,
      height: this.height,
      name: "CustomParticleShader",
    });

    particleShaderNode.minigl = this.minigl;
    return this.minigl.addNode(particleShaderNode);
  }

  setSize(size) {
    this.particleSize = size;
    return this;
  }

  setCount(count) {
    this.activeParticleCount = Math.min(count, this.maxParticles);
    return this;
  }

  resize(width, height) {
    super.resize(width, height);
    if (this.initialized) {
      this.createParticleRenderTarget();
      // Simulation texture size stays the same (based on particle count)
    }
    return this;
  }

  dispose() {
    super.dispose();
    const gl = this.gl;

    if (this.internalSimulation) this.internalSimulation.dispose();
    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.instanceBuffer) gl.deleteBuffer(this.instanceBuffer);
    if (this.particleProgram) gl.deleteProgram(this.particleProgram);
  }

  // Default shader generators
  getDefaultSimulationShader() {
    return `#version 300 es
      precision highp float;
      
      uniform sampler2D glPrevious;
      uniform vec2 glResolution;
      uniform float glTime;
      uniform vec3 glMouse;
      uniform vec2 glVelocity;
      uniform float gravity;
      uniform float damping;
      uniform float spawnRate;
      uniform vec2 glPixel;
      
      in vec2 glUV;
      in vec2 glCoord;
      out vec4 fragColor;
      
      // Simple random function
      float rand(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      void main() {
        vec4 particle = texture(glPrevious, glUV);
        vec2 pos = particle.rg;
        vec2 vel = particle.ba;
        
        vec2 mousePos = glMouse.xy;
        float mouseVelMagnitude = length(glVelocity);
        
        // Particle lifecycle: if particle is dead or out of bounds, try to spawn new one
        bool isDead = (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) || 
                      (length(pos) < 0.001 && length(vel) < 0.001);
        
        if (isDead) {
          // Spawn from mouse position
          float baseSpawnChance = spawnRate;
          float velocitySpawnBoost = mouseVelMagnitude * 20.0;
          float totalSpawnChance = baseSpawnChance + velocitySpawnBoost;
          
          float randomValue = rand(glUV + glTime * 0.1);
          
          if (randomValue < totalSpawnChance) {
            // Spawn new particle at mouse position
            vec2 randomOffset = (vec2(rand(glUV), rand(glUV + 1.0)) - 0.5) * 0.02;
            pos = mousePos + randomOffset;
            
            // Initial velocity based on mouse movement
            vec2 baseVel = glVelocity * 0.5;
            vec2 randomSpread = (vec2(rand(glUV + 2.0), rand(glUV + 3.0)) - 0.5) * 0.01;
            vel = baseVel + randomSpread;
          } else {
            // Keep particle dead
            pos = vec2(-1.0);
            vel = vec2(0.0);
          }
        } else {
          // Update living particles
          
          // Apply gravity
          vel.y -= gravity;
          
          // Apply damping
          vel *= damping;
          
          // Update position
          pos += vel;
          
          // Kill particles that go out of bounds
          if (pos.x < -0.1 || pos.x > 1.1 || pos.y < -0.1 || pos.y > 1.1) {
            pos = vec2(-1.0);
            vel = vec2(0.0);
          }
        }
        
        fragColor = vec4(pos, vel);
      }`;
  }

  getDefaultVertexShader() {
    return `#version 300 es
      layout(location = 0) in vec2 quadVertex;
      layout(location = 1) in float instanceId;
      
      uniform sampler2D particleData;
      uniform vec2 glResolution;
      uniform float particleSize;
      uniform float glRatio;
      
      out vec2 particleUV;
      out vec4 particleColor;
      out vec2 particleVel;
      out float particleLife;
      out float particleID;
      out float quadVertexID;
      
      void main() {
        // Convert instance ID to texture coordinate
        ivec2 texSize = textureSize(particleData, 0);
        float texelX = mod(instanceId, float(texSize.x));
        float texelY = floor(instanceId / float(texSize.x));
        vec2 particleTexCoord = (vec2(texelX, texelY) + 0.5) / vec2(texSize);
        
        // Read particle state
        vec4 particleState = texture(particleData, particleTexCoord);
        vec2 particlePos = particleState.rg;
        vec2 particleVelocity = particleState.ba;
        
        // Skip dead particles (negative positions)
        if (particlePos.x < 0.0) {
          gl_Position = vec4(-10.0, -10.0, 0.0, 1.0); // Move off-screen
          particleUV = vec2(0.0);
          particleColor = vec4(0.0);
          particleVel = vec2(0.0);
          particleLife = 0.0;
          return;
        }
        
        // Convert to screen space (-1 to 1) - use full canvas
        vec2 screenPos = particlePos * 2.0 - 1.0;
        
        // Use consistent particle size (scaling handled in fragment shader)
        vec2 quadOffset = quadVertex * particleSize;
        quadOffset.x /= glRatio; // Only correct particle shape, not position
        
        vec2 finalPos = screenPos + quadOffset;
        
        gl_Position = vec4(finalPos, 0.0, 1.0);
        particleUV = quadVertex * 0.5 + 0.5;
        
        // Color based on velocity with warmer tones
        float speed = length(particleVelocity);
        float normalizedSpeed = min(speed * 30.0, 1.0);
        particleColor = vec4(
          1.0,
          0.8 - normalizedSpeed * 0.3,
          0.4 - normalizedSpeed * 0.2,
          1.0
        );
        particleVel = particleVelocity;
        particleLife = 1.0; // Alive particles
        particleID = instanceId; // Pass instance ID to fragment shader
        quadVertexID = float(gl_VertexID % 6); // 0-5 for each vertex in the quad
      }`;
  }

  getDefaultFragmentShader() {
    return `#version 300 es
      precision highp float;
      
      in vec2 particleUV;
      in vec4 particleColor;
      in vec2 particleVel;
      in float particleLife;
      
      out vec4 fragColor;
      
      void main() {
        // Skip dead particles
        if (particleLife < 0.5) {
          discard;
        }
        
        // Create circular particle with soft edges
        vec2 center = particleUV - 0.5;
        float dist = length(center) * 2.0;
        float alpha = 1.0 - smoothstep(0.3, 0.8, dist);
        
        // Bloom effect - multiple layers of glow
        float bloom1 = (1.0 - smoothstep(0.0, 1.0, dist)) * 0.4;
        float bloom2 = (1.0 - smoothstep(0.0, 1.4, dist)) * 0.2;
        float bloom3 = (1.0 - smoothstep(0.0, 1.8, dist)) * 0.1;
        
        float totalAlpha = alpha + bloom1 + bloom2 + bloom3;
        
        // Velocity-based intensity
        float speed = length(particleVel);
        float intensity = 0.8 + speed * 5.0;
        
        // Color with bloom
        vec3 finalColor = particleColor.rgb * intensity;
        
        fragColor = vec4(finalColor, totalAlpha * particleColor.a);
      }`;
  }
}

class miniGL {
  constructor(target, options = {}) {
    this.options = {
      id: options.id || null,
      className: options.className || null,
      z: options.z || null,
      width: options.width || null,
      height: options.height || null,
      ...options,
    };

    // Initialize loader node properties before canvas setup
    this._loaderNode = undefined;
    this._pendingLoaderNode = null; // Store loader node info until ready

    // Handle different target types
    this.canvas = this._setupMiniGL(target);
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
    this.floatSupported = false;
    this._shaderChunks = null;
    this._topoOrder = null;
    this._graphDirty = true;
    // Core node system only
    this.loaderNode = () => this._loaderNode;
    // Create a shared canvas for texture operations
    this._sharedCanvas = document.createElement("canvas");
    this._sharedCtx = this._sharedCanvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 2;
    // Create a static transparent black 1x1 texture for fallback
    this.TransparentPixel = this._createTransparentPixel();

    // Default vertex shader using gl_VertexID (no vertex buffers needed)
    this.VERTEX_SHADER = `#version 300 es
        uniform float glRatio;
        out vec2 vTexCoord;
        out vec2 glUV;
        out vec2 glCoord; // Corrected square UVs

        void main() {
          // Define fullscreen triangle vertices and texture coordinates
          const vec2 verts[3] = vec2[](
            vec2(-1.0, -1.0),
            vec2(-1.0, 3.0),
            vec2(3.0, -1.0)
          );
          
          const vec2 texCoords[3] = vec2[](
            vec2(0.0, 0.0),
            vec2(0.0, 2.0),
            vec2(2.0, 0.0)
          );
          
          gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
          
          // Use the predefined texture coordinates
          vTexCoord = texCoords[gl_VertexID];
          glUV = vTexCoord;
          
          // Aspect ratio corrected coordinates
          glCoord = vTexCoord - 0.5;
          glCoord.x *= glRatio;
          glCoord += 0.5;
        }`;

    if (!this.gl) throw new Error("WebGL2 not supported");

    // Set up WebGL
    this.setupWebGL();
    this.setupObservers();
    this.setupEventListeners();
    this.resize();

    // Create any pending loader nodes now that miniGL is initialized
    this._createPendingLoaderNode();

    // Now that everything is initialized, trigger initial resize
    if (this._resizeHandler) {
      this._resizeHandler();
    }

    // Core nodes are ready immediately
  }

  _createPendingLoaderNode() {
    if (!this._pendingLoaderNode) return;
    const info = this._pendingLoaderNode;
    if (info.type === "image") {
      this._loaderNode = this.image(info.src, {
        width: info.width,
        height: info.height,
        name: info.name,
      });
    } else if (info.type === "video") {
      this._loaderNode = this.video(info.src, {
        width: info.width,
        height: info.height,
        name: info.name,
      });
    }
    this._pendingLoaderNode = null;
  }

  _setupMiniGL(target) {
    let canvas;
    let element;
    let container;

    // Handle no target - create fullscreen div
    if (!target) {
      container = document.createElement("div");
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      document.body.appendChild(container);
      element = container;
    } else {
      // Determine target element
      if (typeof target === "string") {
        element =
          document.getElementById(target) || document.querySelector(target);
        if (!element) {
          throw new Error(`Element not found: ${target}`);
        }
      } else if (target instanceof HTMLElement) {
        element = target;
      } else {
        throw new Error("Target must be a string selector or HTML element");
      }
    }

    const tagName = element.tagName?.toLowerCase() || "div";

    switch (tagName) {
      case "canvas":
        canvas = element;
        canvas.id = "minigl-canvas";
        break;

      case "div":
      case "section":
      case "article":
      case "main":
        canvas = this._setupCanvas();
        element.appendChild(canvas);
        break;

      case "img":
        // Create wrapper div to replace the image
        const imgSrc = element.src;
        const imgWrapper = document.createElement("div");

        // Copy all computed styles from image to wrapper to maintain exact layout
        const imgComputedStyle = window.getComputedStyle(element);

        // Copy critical layout styles
        imgWrapper.style.cssText = imgComputedStyle.cssText;

        // Preserve important attributes
        if (element.className) imgWrapper.className = element.className;
        if (element.id) {
          imgWrapper.id = element.id;
          element.removeAttribute("id"); // Remove from original to avoid conflicts
        }

        // Replace image with wrapper in DOM
        element.parentNode.replaceChild(imgWrapper, element);

        // Hide original image and add it to wrapper (preserves it for reference)
        element.style.display = "none";
        imgWrapper.appendChild(element);

        // Create responsive canvas that fills the wrapper
        canvas = this._setupCanvas();
        imgWrapper.appendChild(canvas);

        // Store image info for later loader node creation
        if (imgSrc) {
          this._pendingLoaderNode = {
            type: "image",
            src: imgSrc,
            width: this.options.width || imgWrapper.offsetWidth || 512,
            height: this.options.height || imgWrapper.offsetHeight || 512,
            name: "Loader Image",
          };
        }
        break;

      case "video":
        const videoSrc = element.src || element.children[0]?.src;
        const videoWrapper = document.createElement("div");
        const videoComputedStyle = window.getComputedStyle(element);
        videoWrapper.style.cssText = videoComputedStyle.cssText;
        if (element.className) videoWrapper.className = element.className;
        if (element.id) {
          videoWrapper.id = element.id;
          element.removeAttribute("id"); // Remove from original to avoid conflicts
        }
        element.parentNode.replaceChild(videoWrapper, element);
        element.style.display = "none";
        videoWrapper.appendChild(element);
        canvas = this._setupCanvas();
        videoWrapper.appendChild(canvas);
        if (videoSrc) {
          this._pendingLoaderNode = {
            type: "video",
            src: videoSrc,
            width: this.options.width || videoWrapper.offsetWidth || 512,
            height: this.options.height || videoWrapper.offsetHeight || 512,
            name: "Loader Video",
          };
        }
        break;

      case "p":
      case "span":
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        // Text element case - to be handled later
        canvas = this._setupCanvas();
        element.parentNode.insertBefore(canvas, element.nextSibling);
        element.style.display = "none";
        break;

      default:
        // For any other element, treat it like a div
        canvas = this._setupCanvas();
        element.appendChild(canvas);
        break;
    }

    // Set up responsive resize for the canvas
    this._responsiveCanvas(canvas);

    return canvas;
  }

  _setupCanvas() {
    const canvas = document.createElement("canvas");
    canvas.id = "minigl-canvas";
    if (this.options.className) {
      canvas.className = this.options.className;
    }
    if (this.options.z !== null) {
      canvas.style.zIndex = this.options.z;
    }
    canvas.style.cssText += `
      width: 100%;
      height: 100%;
      display: block;
      max-width: 100%;
      max-height: 100%;
    `;
    return canvas;
  }
  _applyCanvasOptions(canvas) {
    if (this.options.id && !canvas.id) {
      canvas.id = this.options.id;
    } else if (!canvas.id) {
      canvas.id = `minigl-canvas-${Date.now()}`;
    }

    if (this.options.className) {
      canvas.className = this.options.className;
    }
    if (this.options.width) {
      canvas.width = this.options.width;
      canvas.style.width = this.options.width + "px";
    }
    if (this.options.height) {
      canvas.height = this.options.height;
      canvas.style.height = this.options.height + "px";
    }
    if (this.options.z !== null) {
      canvas.style.zIndex = this.options.z;
    }

    return canvas;
  }

  _responsiveCanvas(canvas) {
    let lastWidth = 0;
    let lastHeight = 0;

    this._resizeHandler = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      // Only resize if parent size actually changed
      if (displayWidth === lastWidth && displayHeight === lastHeight) {
        return;
      }
      lastWidth = displayWidth;
      lastHeight = displayHeight;
      const dpr = window.devicePixelRatio || 2;
      if (displayWidth > 0 && displayHeight > 0) {
        canvas.width = Math.floor(displayWidth * dpr);
        canvas.height = Math.floor(displayHeight * dpr);
        canvas.style.width = displayWidth + "px";
        canvas.style.height = displayHeight + "px";
        if (this.nodes && this.pixel) {
          this.resize();
        }
      }
    };
    this._canvas = canvas;
    window.addEventListener("resize", this._resizeHandler);
  }

  _createTransparentPixel() {
    const gl = this.gl;
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
    return tex;
  }

  setupWebGL() {
    // Check for float texture support
    this.floatSupported = false;
    if (this.gl.getExtension("EXT_color_buffer_float")) {
      this.floatSupported = true;
      this.gl.getExtension("OES_texture_float_linear");
    }

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.createFullScreenTriangle();
  }

  createFullScreenTriangle() {
    // Create empty VAO - vertices are defined in the vertex shader using gl_VertexID
    this.vao = this.gl.createVertexArray();
  }

  setupObservers() {
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
      this.isVisible = true;
    }
    return this;
  }

  setupEventListeners() {
    const signal = this.eventController.signal;
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
        this.mouse.x = (e.clientX - rect.left) / rect.width;
        this.mouse.y = 1.0 - (e.clientY - rect.top) / rect.height;

        const now = performance.now();
        const deltaTime = now - this.lastMouseUpdateTime;

        // if (deltaTime > 0) {
        const timeFactor = Math.min(1000 / 60, deltaTime) / (1000 / 60);
        this.mouseVelocity.x = (this.mouse.x - this.prevMouse.x) / timeFactor;
        this.mouseVelocity.y = (this.mouse.y - this.prevMouse.y) / timeFactor;

        // const damping = 0.95;
        // this.mouseVelocity.x *= damping;
        // this.mouseVelocity.y *= damping;
        // }

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
        this.mouse.x = 0.5;
        this.mouse.y = 0.5;
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

    // Clean up resize handler
    if (this._resizeHandler) {
      window.removeEventListener("resize", this._resizeHandler);
      this._resizeHandler = null;
    }

    // Clean up resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // Clean up WebGL resources
    // Note: Could add more cleanup for specific WebGL resources here
    if (this.gl) {
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
    this._graphDirty = true;

    // Set miniGL reference for all nodes
    if (typeof node.setMiniGL === "function") {
      node.setMiniGL(this);
    } else {
      // For regular nodes, just set the minigl property
      node.minigl = this;
    }

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

  // Topological sort utility (skip nodes with no output)
  _topoSort(outputNode) {
    if (!this._graphDirty && this._topoOrder) return this._topoOrder;
    const visited = new Set();
    const order = [];
    function visit(node) {
      if (visited.has(node)) return;
      visited.add(node);
      for (const conn of node.inputs.values()) visit(conn.node);
      order.push(node);
    }
    if (outputNode) visit(outputNode);
    this._topoOrder = order;
    this._graphDirty = false;
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
    const order = this._topoSort(this.outputNode);
    for (const node of order) {
      node.process(currentTime);
      node.lastUpdateTime = currentTime;
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
    if (!this.canvas) return;

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
      if (this.nodes) {
        for (const node of this.nodes.values()) {
          node.resize(this.canvas.width, this.canvas.height);
        }
      }
    }
  }

  // Get global uniforms for all shaders
  getGlobalUniforms(width, height, time) {
    const uniforms = {
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
    const mipmapFilter = options.mipmapFilter || "linear-linear";

    // Set min filter based on mipmap and mipmapFilter options
    if (mipmap) {
      let minFilter;
      switch (mipmapFilter) {
        case "linear-linear":
          minFilter = gl.LINEAR_MIPMAP_LINEAR;
          break;
        case "linear-nearest":
          minFilter = gl.LINEAR_MIPMAP_NEAREST;
          break;
        case "nearest-linear":
          minFilter = gl.NEAREST_MIPMAP_LINEAR;
          break;
        case "nearest-nearest":
          minFilter = gl.NEAREST_MIPMAP_NEAREST;
          break;
        default:
          minFilter = gl.LINEAR_MIPMAP_LINEAR;
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
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
    if (!this._shaderChunks) return shaderSource;
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
      if (
        !this._shaderChunks[category] ||
        !this._shaderChunks[category][func]
      ) {
        console.warn(`Shader snippet not found: ${key}`);
        return "";
      }
      let snippet = this._shaderChunks[category][func];
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
  createShaderNode(fragmentShader, uniforms = {}, nodeOptions = {}) {
    // Preprocess the shader first to handle <#tag> references
    const processedShader = this.preprocessShader(fragmentShader);

    const node = new ShaderNode(this.gl, {
      fragmentShader: processedShader,
      vertexShader: nodeOptions.vertexShader,
      defaultVertexShader: this.VERTEX_SHADER,
      floatSupported: this.floatSupported,
      uniforms: uniforms,
      width: nodeOptions.width || this.canvas.width,
      height: nodeOptions.height || this.canvas.height,
      filter: nodeOptions.filter,
      wrap: nodeOptions.wrap,
      mipmap: nodeOptions.mipmap,
      mipmapFilter: nodeOptions.mipmapFilter,
      format: nodeOptions.format,
      name: nodeOptions.name,
    });

    // Store reference to the miniGL instance
    node.minigl = this;

    return this.addNode(node);
  }

  // Create a shader node (alias for createShaderNode)
  shader(fragmentShader, uniforms = {}, nodeOptions = {}) {
    return this.createShaderNode(fragmentShader, uniforms, nodeOptions);
  }

  // Create a feedback node
  createFeedbackNode(fragmentShader, uniforms = {}, nodeOptions = {}) {
    // Preprocess the shader first to handle <#tag> references
    const processedShader = this.preprocessShader(fragmentShader);

    const node = new FeedbackNode(this.gl, {
      fragmentShader: processedShader,
      vertexShader: nodeOptions.vertexShader,
      defaultVertexShader: this.VERTEX_SHADER,
      floatSupported: this.floatSupported,
      uniforms: uniforms,
      width: nodeOptions.width || this.canvas.width,
      height: nodeOptions.height || this.canvas.height,
      filter: nodeOptions.filter,
      wrap: nodeOptions.wrap,
      mipmap: nodeOptions.mipmap,
      mipmapFilter: nodeOptions.mipmapFilter,
      format: nodeOptions.format,
      name: nodeOptions.name,
    });

    // Store reference to the miniGL instance
    node.minigl = this;

    return this.addNode(node);
  }

  // Create a feedback node (alias for createFeedbackNode)
  pingpong(fragmentShader, uniforms = {}, nodeOptions = {}) {
    return this.createFeedbackNode(fragmentShader, uniforms, nodeOptions);
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
      mipmapFilter: options.mipmapFilter,
      fitting: options.fitting,
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
  createCanvas2DTexture(drawCallback, options = {}) {
    const node = new CanvasTextureNode(this.gl, {
      drawCallback,
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
      mipmapFilter: options.mipmapFilter,
      name: options.name,
    });

    // Store reference to the miniGL instance
    node.minigl = this;

    return this.addNode(node);
  }

  // Shorter alias for createCanvas2DTexture
  canvas2D(drawCallback, options = {}) {
    return this.createCanvas2DTexture(drawCallback, options);
  }

  // Create a blend shader node
  createBlendNode(uniforms = {}, nodeOptions = {}) {
    const blendMode = uniforms.blendMode || "normal";
    const opacity = uniforms.opacity !== undefined ? uniforms.opacity : 1.0;
    const blends = {
      normal: `
        vec4 blend_normal(vec4 base, vec4 blend) {
          return mix(base, blend, blend.a);
        }
      `,
      multiply: `
        vec4 blend_multiply(vec4 base, vec4 blend) {
          vec4 result = base * blend;
          return mix(base, result, blend.a);
        }
      `,
      screen: `
        vec4 blend_screen(vec4 base, vec4 blend) {
          vec4 result = vec4(1.0) - ((vec4(1.0) - base) * (vec4(1.0) - blend));
          return mix(base, result, blend.a);
        }
      `,
      add: `
        vec4 blend_add(vec4 base, vec4 blend) {
          vec4 result = min(base + blend, 1.0);
          return mix(base, result, blend.a);
        }
      `,
      overlay: `
        float blendOverlay(float base, float blend) {
          return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
        }
        
        vec4 blend_overlay(vec4 base, vec4 blend) {
          vec4 result;
          result.r = blendOverlay(base.r, blend.r);
          result.g = blendOverlay(base.g, blend.g);
          result.b = blendOverlay(base.b, blend.b);
          result.a = base.a;
          return mix(base, result, blend.a);
        }
      `,
    };
    // Simple blend shader that uses the blend function from the shader library
    const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D glBase;
    uniform sampler2D glBlend;
    uniform float glOpacity;
    
    in vec2 vTexCoord;
    out vec4 fragColor;

    ${blends[blendMode]}
    
    void main() {
      vec4 baseColor = texture(glBase, vTexCoord);
      vec4 blendColor = texture(glBlend, vTexCoord);
      
      // Apply opacity to the blend layer
      blendColor.a *= glOpacity;
      
      // Apply the blend mode
      fragColor = blend_${blendMode}(baseColor, blendColor);
    }`;

    // Create shader with processed blend function
    return this.shader(
      fragmentShader,
      { glOpacity: opacity },
      { name: nodeOptions.name || `Blend_${blendMode}`, ...nodeOptions }
    );
  }

  // Shorter alias for createBlendNode
  blend(uniforms = {}, nodeOptions = {}) {
    return this.createBlendNode(uniforms, nodeOptions);
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

  // Factory method for particle renderer (with optional built-in simulation)
  createParticles(options = {}) {
    const node = new ParticleNode(this.gl, {
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      floatSupported: this.floatSupported,
      ...options,
    });

    node.minigl = this;
    node.floatSupported = this.floatSupported; // Ensure the flag is set
    return this.addNode(node);
  }

  // Shorter alias for createParticles
  particles(options = {}) {
    return this.createParticles(options);
  }

  useChunks(chunks) {
    this._shaderChunks = chunks;
    return this;
  }

  // Core nodes are ready immediately
  ready() {
    return Promise.resolve(this);
  }
}

// --- ParticleShaderNode: Custom particle rendering with user fragment shader ---
class ParticleShaderNode extends TextureNode {
  constructor(gl, options = {}) {
    super(gl, options);

    this.particleRenderer = options.particleRenderer;
    this.fragmentShader = options.fragmentShader;
    this.uniforms = options.uniforms || {};
    this.quadSize = options.quadSize || 0.03; // Size of particle quads
    this.program = null;
    this.framebuffer = null;
  }

  createRenderTarget() {
    const gl = this.gl;

    if (!this.texture) this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
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

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  ensureProgram() {
    if (this.program) return;
    if (!this.minigl || !this.particleRenderer) return;

    // Use the particle renderer's vertex shader with our custom fragment shader
    this.program = this.minigl.createProgram(
      this.particleRenderer.getDefaultVertexShader(),
      this.fragmentShader
    );
  }

  process(time) {
    if (!this.particleRenderer) return;

    this.ensureProgram();
    if (!this.program) return;

    this.createRenderTarget();

    // Make sure the particle renderer is processed first
    this.particleRenderer.process(time);

    // Get particle data texture
    let particleDataTexture;
    if (this.particleRenderer.hasExternalSimulation) {
      const simulationInput =
        this.particleRenderer.inputs.get("simulationTexture");
      if (simulationInput) {
        particleDataTexture = simulationInput.node.output(
          simulationInput.output
        ).texture;
      }
    }

    if (!particleDataTexture && this.particleRenderer.internalSimulation) {
      particleDataTexture =
        this.particleRenderer.internalSimulation.output().texture;
    }

    if (!particleDataTexture) return;

    // Render particles with custom shader
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for particles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.particleRenderer.quadVAO);

    // Set uniforms
    const renderUniforms = this.minigl.getGlobalUniforms(
      this.width,
      this.height,
      time
    );
    const allUniforms = {
      ...renderUniforms,
      ...this.uniforms,
      particleData: { texture: particleDataTexture },
      particleSize: this.quadSize, // Use custom quad size for rendering
    };

    // Handle input connections
    for (const [inputName, connection] of this.inputs) {
      const output = connection.node.output(connection.output);
      if (output?.texture) {
        allUniforms[inputName] = output;
      }
    }

    this.minigl.setUniforms(this.program, allUniforms);

    // Draw all particles
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      6,
      this.particleRenderer.activeParticleCount
    );

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  updateUniform(key, value) {
    this.uniforms[key] = value;
    return this;
  }

  setQuadSize(size) {
    this.quadSize = size;
    return this;
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
    super.dispose();
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    this.program = null;
  }
}

/**
 * MiniNode - A wrapper class that creates a full Node interface around internal node graphs
 * Perfect for factory functions that need to encapsulate complex multi-node effects
 */
export class MiniNode {
  constructor(gl, outputNode, options = {}) {
    this.gl = gl;
    this.outputNode = outputNode; // The final node in the internal chain
    this.internalNodes = options.internalNodes || [outputNode]; // All internal nodes for processing

    // Node interface properties (required for graph integration)
    this.inputs = new Map();
    this.outputs = new Set();
    this.id =
      options.id || `mini_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.name = options.name || "Mini Node";
    this.isProcessing = false;
    this.lastUpdateTime = 0;
    this._lastFrame = -1;
    this._lastOutput = null;

    // Input routing configuration
    this.inputRouting = new Map(); // Maps proxy input names to {node, input} objects
    this.uniformMappings = new Map(); // Maps external uniform names to {node, uniform} objects

    // Register with miniGL
    gl.nodes.set(this.id, this);
  }

  // Configure how external inputs map to specific internal nodes and their inputs
  input(externalInputName, targetNode, internalInputName = externalInputName) {
    // If only two params provided, assume it's for the output node
    if (typeof targetNode === "string") {
      internalInputName = targetNode;
      targetNode = this.outputNode;
    }
    this.inputRouting.set(externalInputName, {
      node: targetNode,
      input: internalInputName,
    });
    return this;
  }

  // Configure how external uniform names map to specific internal nodes and their uniforms
  uniform(externalName, targetNode, internalUniformName = externalName) {
    // If only two params provided, assume it's for the output node
    if (typeof targetNode === "string") {
      internalUniformName = targetNode;
      targetNode = this.outputNode;
    }
    this.uniformMappings.set(externalName, {
      node: targetNode,
      uniform: internalUniformName,
    });
    return this;
  }

  // Core Node interface methods - process all internal nodes
  process(time) {
    // Process all internal nodes (they should be in dependency order)
    for (const node of this.internalNodes) {
      if (node.process) {
        node.process(time);
      }
    }
  }

  update(time, frameId) {
    // Implement frame-based caching like core Node class
    if (this._lastFrame === frameId) return this._lastOutput;
    this._lastFrame = frameId;

    // Update inputs first (topological sort handles this, but for safety)
    for (const [inputName, connection] of this.inputs) {
      connection.node.update?.(time, frameId);
    }

    // Process this node
    this.process(time);
    this.lastUpdateTime = time;

    // Cache output
    this._lastOutput = this.output();
    return this._lastOutput;
  }

  output(outputName = "default") {
    return this.outputNode.output ? this.outputNode.output(outputName) : null;
  }

  size() {
    return this.outputNode.size ? this.outputNode.size() : [512, 512];
  }

  resize(width, height) {
    // Resize all internal nodes
    for (const node of this.internalNodes) {
      if (node.resize) {
        node.resize(width, height);
      }
    }
    return this;
  }

  // Connection methods with optional custom routing
  connect(inputName, sourceNode, outputName = "default") {
    // Track the connection for graph integration
    this.inputs.set(inputName, { node: sourceNode, output: outputName });
    sourceNode.outputs.add(this);

    // Route to specific internal node using mapping or default to output node
    const routing = this.inputRouting.get(inputName);
    if (routing) {
      routing.node.connect(routing.input, sourceNode, outputName);
    } else {
      // Default: connect to output node with same input name
      this.outputNode.connect(inputName, sourceNode, outputName);
    }

    // Call custom connection handler if defined
    this._callConnectHandler(inputName, sourceNode, outputName);

    return this;
  }

  disconnect(inputName) {
    // Remove from tracking
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);
    }

    // Disconnect from specific internal node
    const routing = this.inputRouting.get(inputName);
    if (routing) {
      routing.node.disconnect(routing.input);
    } else {
      // Default: disconnect from output node
      this.outputNode.disconnect(inputName);
    }

    // Call custom disconnection handler if defined
    this._callDisconnectHandler(inputName);

    return this;
  }

  // Uniform management with specific node targeting
  updateUniform(key, value) {
    // Route to specific node if mapped
    const mapping = this.uniformMappings.get(key);
    if (mapping) {
      mapping.node.updateUniform(mapping.uniform, value);
    } else {
      // Default: update on output node
      if (this.outputNode.updateUniform) {
        this.outputNode.updateUniform(key, value);
      }
    }

    // Call custom uniform handler if defined
    this._callUniformHandler(key, value, mapping);

    return this;
  }

  // Cleanup
  dispose() {
    // Clean up connections
    for (const connection of this.inputs.values()) {
      connection.node.outputs.delete(this);
    }
    this.inputs.clear();

    for (const outputNode of this.outputs) {
      if (outputNode.disconnect) {
        outputNode.disconnect(this);
      }
    }
    this.outputs.clear();

    // Remove from miniGL registry
    this.gl.nodes.delete(this.id);

    // Dispose all internal nodes
    for (const node of this.internalNodes) {
      if (node.dispose) {
        node.dispose();
      }
    }
  }

  // Helper methods for common patterns
  helper(name, fn) {
    this[name] = fn.bind(this);
    return this;
  }

  // Set custom handlers
  onConnect(handler) {
    this.onConnectHandler = handler;
    return this;
  }

  onDisconnect(handler) {
    this.onDisconnectHandler = handler;
    return this;
  }

  onUniform(handler) {
    this.onUniformHandler = handler;
    return this;
  }

  // Updated handler calls
  _callConnectHandler(inputName, sourceNode, outputName) {
    if (this.onConnectHandler) {
      this.onConnectHandler(inputName, sourceNode, outputName);
    }
  }

  _callDisconnectHandler(inputName) {
    if (this.onDisconnectHandler) {
      this.onDisconnectHandler(inputName);
    }
  }

  _callUniformHandler(key, value, mapping) {
    if (this.onUniformHandler) {
      this.onUniformHandler(key, value, mapping);
    }
  }
}

// Export the new node-based system
export default miniGL;
