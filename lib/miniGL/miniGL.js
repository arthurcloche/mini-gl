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
      return { texture: this.gl.TransparentPixel, width: 1, height: 1 };
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
    if (
      !this.dirty ||
      !this.isLoaded ||
      !this.video ||
      this.video.readyState < 2
    )
      return;
    this.dirty = false;
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
  constructor(id, options = {}) {
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
    this.floatSupported = false;
    this._shaderChunks = null;
    this._topoOrder = null;
    this._graphDirty = true;

    // Core node system only

    // Create a shared canvas for texture operations
    this._sharedCanvas = document.createElement("canvas");
    this._sharedCtx = this._sharedCanvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 2;
    // Create a static transparent black 1x1 texture for fallback
    this.TransparentPixel = this._createTransparentPixel();

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

    // Core nodes are ready immediately
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
        this.mouse.x = (e.clientX - rect.left) / this.canvas.width;
        this.mouse.y = 1.0 - (e.clientY - rect.top) / this.canvas.height;

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

  useChunks(chunks) {
    this._shaderChunks = chunks;
    return this;
  }

  // Core nodes are ready immediately
  ready() {
    return Promise.resolve(this);
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
