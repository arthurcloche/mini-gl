/**
 * miniGL.js - A minimal WebGL2 rendering pipeline
 * Focused on fragment shader effects with minimal overhead
 */

class miniGL {
  constructor(id) {
    this.canvas = document.getElementById(id);
    this.gl = this.canvas.getContext("webgl2");
    this.clock = 0;
    this.passes = [];
    this.mouse = { x: 0.5, y: 0.5 };
    this.prevMouse = { x: 0.5, y: 0.5 };
    this.mouseVelocity = { x: 0.0, y: 0.0 };
    this.lastMouseUpdateTime = 0;

    this.VERTEX_SHADER = `#version 300 es
        layout(location = 0) in vec3 aPosition;
        layout(location = 1) in vec2 aTexCoord;
        out vec2 vTexCoord;
  
        void main() {
          gl_Position = vec4(aPosition, 1.0);
          vTexCoord = vec2(aTexCoord.x, aTexCoord.y);
        }`;

    if (!this.gl) throw new Error("WebGL2 not supported");

    this.floatSupported = false;
    if (this.gl.getExtension("EXT_color_buffer_float")) {
      this.floatSupported = true;
      this.gl.getExtension("OES_texture_float_linear");
    }

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

    this.setupFullScreenTriangle();

    window.addEventListener("resize", this.resize.bind(this));
    this.resize();

    this.canvas.addEventListener("mousemove", (e) => {
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

        const damping = 0.8;
        this.mouseVelocity.x *= damping;
        this.mouseVelocity.y *= damping;
      }

      this.lastMouseUpdateTime = now;
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.mouseVelocity.x *= 0.5;
      this.mouseVelocity.y *= 0.5;
    });
  }

  setupFullScreenTriangle() {
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

  canvasTexture(drawCallback, options = {}) {
    const width = options.width || this.canvas.width;
    const height = options.height || this.canvas.height;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext("2d");

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(1, -1);
    ctx.translate(-width / 2, -height / 2);
    if (drawCallback && typeof drawCallback === "function") {
      drawCallback(ctx, width, height);
    }
    ctx.restore();
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this._applyTextureParams(texture, options);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      tempCanvas
    );

    if (options.mipmap !== false) {
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }

    return { texture, width, height };
  }

  imageTexture(url, options = {}) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const width = options.width || image.width;
        const height = options.height || image.height;

        if (width !== image.width || height !== image.height) {
          const result = this.canvasTexture(
            (ctx, w, h) => {
              ctx.drawImage(image, 0, 0, width, height);
            },
            { ...options, width, height }
          );

          resolve(result);
        } else {
          const texture = this.gl.createTexture();
          this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

          this._applyTextureParams(texture, options);

          this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            image
          );

          if (options.mipmap !== false) {
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
          }

          resolve({ texture, width, height });
        }
      };

      image.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };

      image.crossOrigin = "anonymous";
      image.src = url;
    });
  }

  createRenderTarget(width, height, options = {}) {
    const gl = this.gl;
    const useFloat = options.format === "FLOAT";
    const wrap = options.wrap === "REPEAT" ? gl.REPEAT : gl.CLAMP_TO_EDGE;

    let internalFormat, type;
    if (useFloat && this.floatSupported) {
      internalFormat = gl.RGBA32F;
      type = gl.FLOAT;
    } else {
      internalFormat = gl.RGBA8;
      type = gl.UNSIGNED_BYTE;
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const filter = options.filter === "NEAREST" ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      width,
      height,
      0,
      gl.RGBA,
      type,
      null
    );

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      if (useFloat) {
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(framebuffer);
        return this.createRenderTarget(width, height, {
          ...options,
          format: null,
        });
      }
      throw new Error(`Framebuffer not complete: ${status}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
      texture,
      framebuffer,
      width,
      height,
      isFloat: useFloat && this.floatSupported,
    };
  }

  copyTexture(srcTexture, dstTarget) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._getReadFramebuffer());
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstTarget.framebuffer);

    gl.framebufferTexture2D(
      gl.READ_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      srcTexture,
      0
    );

    gl.blitFramebuffer(
      0,
      0,
      dstTarget.width,
      dstTarget.height,
      0,
      0,
      dstTarget.width,
      dstTarget.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  _getReadFramebuffer() {
    if (!this._readFramebuffer) {
      this._readFramebuffer = this.gl.createFramebuffer();
    }
    return this._readFramebuffer;
  }

  createShaderPass(options = {}) {
    const gl = this.gl;

    if (!options.fragmentShader) {
      throw new Error("Fragment shader is required for shader pass");
    }

    const program = this.createProgram(
      this.VERTEX_SHADER,
      options.fragmentShader
    );
    const target = this.createRenderTarget(
      this.canvas.width,
      this.canvas.height,
      options
    );

    const defaultUniforms = {
      uResolution: { x: this.canvas.width, y: this.canvas.height },
      uTime: this.clock,
      uMouse: { x: this.mouse.x, y: this.mouse.y },
      uVelocity: { x: this.mouseVelocity.x, y: this.mouseVelocity.y },
    };

    const pass = {
      type: "shader",
      program,
      target,
      uniforms: { ...defaultUniforms, ...(options.uniforms || {}) },
      render: (inputTextures = {}) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pass.target.framebuffer);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(pass.program);
        gl.bindVertexArray(this.vao);

        this.setUniforms(pass.program, {
          ...pass.uniforms,
          ...inputTextures,
        });

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      },
    };

    this.passes.push(pass);
    return pass;
  }

  createPingPongPass(options = {}) {
    const gl = this.gl;

    if (!options.fragmentShader) {
      throw new Error("Fragment shader is required for ping-pong pass");
    }

    const program = this.createProgram(
      this.VERTEX_SHADER,
      options.fragmentShader
    );

    const targetA = this.createRenderTarget(
      this.canvas.width,
      this.canvas.height,
      options
    );

    const targetB = this.createRenderTarget(
      this.canvas.width,
      this.canvas.height,
      options
    );

    const defaultUniforms = {
      uResolution: { x: this.canvas.width, y: this.canvas.height },
      uTime: this.clock,
      uMouse: { x: this.mouse.x, y: this.mouse.y },
      uVelocity: { x: this.mouseVelocity.x, y: this.mouseVelocity.y },
    };

    const pass = {
      type: "pingpong",
      program,
      targetA,
      targetB,
      uniforms: { ...defaultUniforms, ...(options.uniforms || {}) },
      currentTarget: targetA,
      prevTarget: targetB,

      render: (inputTextures = {}) => {
        const temp = pass.currentTarget;
        pass.currentTarget = pass.prevTarget;
        pass.prevTarget = temp;

        gl.bindFramebuffer(gl.FRAMEBUFFER, pass.currentTarget.framebuffer);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(pass.program);
        gl.bindVertexArray(this.vao);

        if (inputTextures.uTexture) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, inputTextures.uTexture.texture);
          gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, pass.prevTarget.texture);
        gl.uniform1i(gl.getUniformLocation(program, "uPrevious"), 1);

        this.setUniforms(pass.program, pass.uniforms);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      },

      getOutputTexture: () => {
        return pass.currentTarget.texture;
      },
    };

    this.passes.push(pass);
    return pass;
  }

  pass(fragmentShader, uniforms = {}, options = {}) {
    return this.createShaderPass({
      fragmentShader,
      uniforms,
      format: options.format,
      filter: options.filter,
      wrap: options.wrap,
      mipmap: options.mipmap,
    });
  }

  render() {
    this.clock++;

    if (this.passes.length === 0) return;

    if (performance.now() - this.lastMouseUpdateTime > 16) {
      this.mouseVelocity.x *= 0.95;
      this.mouseVelocity.y *= 0.95;

      if (Math.abs(this.mouseVelocity.x) < 0.001) this.mouseVelocity.x = 0;
      if (Math.abs(this.mouseVelocity.y) < 0.001) this.mouseVelocity.y = 0;
    }

    for (let i = 0; i < this.passes.length; i++) {
      const pass = this.passes[i];
      if (pass.uniforms.uTime !== undefined) {
        pass.uniforms.uTime = this.clock;
      }
      if (pass.uniforms.uMouse !== undefined) {
        pass.uniforms.uMouse.x = this.mouse.x;
        pass.uniforms.uMouse.y = this.mouse.y;
      }
      if (pass.uniforms.uVelocity !== undefined) {
        pass.uniforms.uVelocity.x = this.mouseVelocity.x;
        pass.uniforms.uVelocity.y = this.mouseVelocity.y;
      }
      if (pass.uniforms.uResolution) {
        pass.uniforms.uResolution.x = this.canvas.width;
        pass.uniforms.uResolution.y = this.canvas.height;
      }
    }

    if (this.passes.length > 0) {
      this.passes[0].render({});
    }

    for (let i = 1; i < this.passes.length; i++) {
      const prevPass = this.passes[i - 1];
      const currentPass = this.passes[i];

      let prevTexture;
      if (prevPass.type === "pingpong") {
        prevTexture = prevPass.getOutputTexture();
      } else if (prevPass.target) {
        prevTexture = prevPass.target.texture;
      } else {
        console.warn(`Pass ${i - 1} has no output texture`);
        continue;
      }

      if (!prevTexture) {
        console.warn(`Pass ${i - 1} returned null texture`);
        continue;
      }

      currentPass.render({
        uTexture: { texture: prevTexture },
      });
    }

    if (this.passes.length > 0) {
      const finalPass = this.passes[this.passes.length - 1];

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      this.gl.useProgram(finalPass.program);
      this.gl.bindVertexArray(this.vao);

      let outputTexture;
      if (finalPass.type === "pingpong") {
        outputTexture = finalPass.getOutputTexture();
      } else if (finalPass.target) {
        outputTexture = finalPass.target.texture;
      }

      if (outputTexture) {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, outputTexture);
        this.gl.uniform1i(
          this.gl.getUniformLocation(finalPass.program, "uTexture"),
          0
        );
      }

      this.setUniforms(finalPass.program, finalPass.uniforms);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
      this.gl.bindVertexArray(null);
    }
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

      for (const pass of this.passes) {
        const resizeTarget = (target) => {
          if (!target) return;

          this.gl.bindTexture(this.gl.TEXTURE_2D, target.texture);

          const format = target.isFloat ? this.gl.RGBA32F : this.gl.RGBA8;
          const type = target.isFloat ? this.gl.FLOAT : this.gl.UNSIGNED_BYTE;

          this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            format,
            this.canvas.width,
            this.canvas.height,
            0,
            this.gl.RGBA,
            type,
            null
          );

          target.width = this.canvas.width;
          target.height = this.canvas.height;
        };

        if (pass.target) {
          resizeTarget(pass.target);
        }

        if (pass.targetA) resizeTarget(pass.targetA);
        if (pass.targetB) resizeTarget(pass.targetB);

        if (pass.uniforms.uResolution) {
          pass.uniforms.uResolution.x = this.canvas.width;
          pass.uniforms.uResolution.y = this.canvas.height;
        }
      }
    }
  }

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

  setUniforms(program, uniforms) {
    const gl = this.gl;
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
}

export default miniGL;
