/**
 * miniGPU.js - A node-based WebGPU rendering pipeline
 * Focused on flexible composition of shader effects with node architecture
 * WebGPU port of miniGL
 **/

class Node {
  constructor(device, options = {}) {
    this.device = device;
    this.id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.name = options.name || this.id;
    this.inputs = new Map();
    this.outputs = new Set();
    this.isProcessing = false;
    this.lastUpdateTime = 0;
    this.width = options.width || 800;
    this.height = options.height || 600;
    this._lastFrame = -1; // For per-frame visited flag
  }

  connect(inputName, sourceNode, outputName = "default") {
    if (!sourceNode)
      throw new Error(
        `Cannot connect null source to ${this.name}.${inputName}`
      );
    this.inputs.set(inputName, { node: sourceNode, output: outputName });
    sourceNode.outputs.add(this);
    if (this.miniGPU) this.miniGPU._graphDirty = true;
    return this;
  }

  disconnect(inputName) {
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);
      if (this.miniGPU) this.miniGPU._graphDirty = true;
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
class TextureNode extends Node {
  constructor(device, options = {}) {
    super(device, options);
    this.texture = null;
    this.textureOptions = {
      format: options.format || "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_SRC,
      addressMode: options.addressMode || "clamp-to-edge",
      minFilter: options.minFilter || "linear",
      magFilter: options.magFilter || "linear",
      mipmapFilter: options.mipmapFilter || "linear",
    };
  }

  output(outputName = "default") {
    if (!this.texture && !this.isProcessing) {
      this.isProcessing = true;
      this.process(this.lastUpdateTime);
      this.isProcessing = false;
    }
    // If still not ready, return transparent black
    if (!this.texture) {
      return { texture: null, view: null, width: 1, height: 1 };
    }
    return {
      texture: this.texture,
      view: this.texture.createView(),
      width: this.width,
      height: this.height,
    };
  }

  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      if (this.texture) {
        this.texture.destroy();
        this.texture = null;
      }
    }
    return this;
  }

  dispose() {
    if (this.texture) {
      this.texture.destroy();
      this.texture = null;
    }
  }
}

/**
 * ShaderNode - Executes a fragment shader and produces a texture
 */
class ShaderNode extends TextureNode {
  constructor(device, options = {}) {
    super(device, options);
    if (!options.code) throw new Error("Shader code required");
    this.code = options.code;
    this.uniforms = options.uniforms || {};
    this.uniformBuffer = null;
    this.uniformBindGroup = null;
    this.pipeline = null;
    this.textureBindGroups = new Map();

    this.createRenderTarget();
  }

  createRenderTarget() {
    if (this.texture) {
      this.texture.destroy();
    }

    this.texture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: this.textureOptions.format,
      usage: this.textureOptions.usage,
    });
  }

  createPipeline() {
    if (this.pipeline) return;
    if (!this.miniGPU) return;

    // WebGPU shader module
    const shaderModule = this.device.createShaderModule({
      code: this.code,
    });

    // Create bind group layout for textures and uniforms
    const bindGroupLayouts = [
      // Group 0: Uniforms
      this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
          },
        ],
      }),
      // Group 1: Textures (created dynamically)
      this.createTextureBindGroupLayout(),
    ];

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts,
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this.textureOptions.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  createTextureBindGroupLayout() {
    const entries = [];
    let bindingIndex = 0;

    // Add entries for each input texture
    for (const [inputName, connection] of this.inputs) {
      entries.push(
        {
          binding: bindingIndex++,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: bindingIndex++,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        }
      );
    }

    return this.device.createBindGroupLayout({
      entries,
    });
  }

  updateUniformBuffer() {
    // Create or update uniform buffer with global uniforms + node-specific uniforms
    const globalUniforms = this.miniGPU.getGlobalUniforms(
      this.width,
      this.height
    );

    // TODO: Properly serialize uniform data to ArrayBuffer based on types
    // For now, just using a simple approach for demo
    const uniformData = new Float32Array(16); // Adjust size as needed

    // Example: Set resolution and time
    uniformData[0] = this.width;
    uniformData[1] = this.height;
    uniformData[2] = this.miniGPU.clock;

    // Add custom uniforms
    // This is simplified - would need proper type handling in real implementation

    if (!this.uniformBuffer) {
      this.uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Create bind group for uniforms
    if (!this.uniformBindGroup) {
      this.uniformBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      });
    }
  }

  updateTextureBindGroups() {
    // Create bind groups for input textures
    const entries = [];
    let bindingIndex = 0;

    for (const [inputName, connection] of this.inputs) {
      const output = connection.node.output(connection.output);
      if (output?.view) {
        entries.push({
          binding: bindingIndex++,
          resource: output.view,
        });

        // Create sampler if needed
        const sampler = this.device.createSampler({
          addressModeU: this.textureOptions.addressMode,
          addressModeV: this.textureOptions.addressMode,
          minFilter: this.textureOptions.minFilter,
          magFilter: this.textureOptions.magFilter,
          mipmapFilter: this.textureOptions.mipmapFilter,
        });

        entries.push({
          binding: bindingIndex++,
          resource: sampler,
        });
      }
    }

    if (entries.length > 0) {
      this.textureBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(1),
        entries,
      });
    }
  }

  process(time) {
    this.createPipeline();
    if (!this.pipeline || !this.miniGPU) return;

    this.updateUniformBuffer();
    this.updateTextureBindGroups();

    const commandEncoder = this.device.createCommandEncoder();
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPassEncoder.setPipeline(this.pipeline);
    renderPassEncoder.setBindGroup(0, this.uniformBindGroup);

    if (this.textureBindGroup) {
      renderPassEncoder.setBindGroup(1, this.textureBindGroup);
    }

    // Draw a full-screen triangle
    renderPassEncoder.draw(3);
    renderPassEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  updateUniform(key, value) {
    this.uniforms[key] = value;
    return this;
  }
}

/**
 * ConstantColorNode - Creates a solid color texture
 */
class ConstantColorNode extends TextureNode {
  constructor(device, options = {}) {
    super(device, {
      name: options.name || "ConstantColor",
      ...options,
    });

    this.color = options.color || { r: 0, g: 0, b: 0, a: 1 };
    this.createTexture();
  }

  createTexture() {
    if (this.texture) {
      this.texture.destroy();
    }

    this.texture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: this.textureOptions.format,
      usage: this.textureOptions.usage,
    });

    // Create a command encoder to clear the texture with the specified color
    const commandEncoder = this.device.createCommandEncoder();
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.texture.createView(),
          clearValue: this.color,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPassEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  process(time) {
    // Nothing to do here, the texture is static
  }

  setColor(color) {
    this.color = color;
    this.createTexture();
    return this;
  }
}

/**
 * BlendNode - Blends two textures together
 */
class BlendNode extends ShaderNode {
  constructor(device, options = {}) {
    // Create appropriate shader code based on blend mode
    const blendMode = options.blendMode || "normal";
    const opacity = options.opacity !== undefined ? options.opacity : 1.0;

    // Default vertex shader for full-screen quad
    const vertexShader = `
      @vertex
      fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 3>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>(3.0, -1.0),
          vec2<f32>(-1.0, 3.0)
        );
        return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
      }
    `;

    // Create fragment shader based on blend mode
    let blendFunction;
    switch (blendMode) {
      case "multiply":
        blendFunction = `
          fn blend(base : vec4<f32>, blend : vec4<f32>, opacity : f32) -> vec4<f32> {
            let result = base * blend;
            return mix(base, result, blend.a * opacity);
          }
        `;
        break;
      case "screen":
        blendFunction = `
          fn blend(base : vec4<f32>, blend : vec4<f32>, opacity : f32) -> vec4<f32> {
            let result = vec4<f32>(1.0) - ((vec4<f32>(1.0) - base) * (vec4<f32>(1.0) - blend));
            return mix(base, result, blend.a * opacity);
          }
        `;
        break;
      case "add":
        blendFunction = `
          fn blend(base : vec4<f32>, blend : vec4<f32>, opacity : f32) -> vec4<f32> {
            let result = min(base + blend, vec4<f32>(1.0));
            return mix(base, result, blend.a * opacity);
          }
        `;
        break;
      case "overlay":
        blendFunction = `
          fn blendOverlay(base : f32, blend : f32) -> f32 {
            return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
          }
          
          fn blend(base : vec4<f32>, blend : vec4<f32>, opacity : f32) -> vec4<f32> {
            var result = vec4<f32>(
              blendOverlay(base.r, blend.r),
              blendOverlay(base.g, blend.g),
              blendOverlay(base.b, blend.b),
              base.a
            );
            return mix(base, result, blend.a * opacity);
          }
        `;
        break;
      case "normal":
      default:
        blendFunction = `
          fn blend(base : vec4<f32>, blend : vec4<f32>, opacity : f32) -> vec4<f32> {
            return mix(base, blend, blend.a * opacity);
          }
        `;
        break;
    }

    const fragmentShader = `
      @group(0) @binding(0) var<uniform> uniforms : Uniforms;
      @group(1) @binding(0) var baseTexture: texture_2d<f32>;
      @group(1) @binding(1) var baseSampler: sampler;
      @group(1) @binding(2) var blendTexture: texture_2d<f32>;
      @group(1) @binding(3) var blendSampler: sampler;
      
      struct Uniforms {
        resolution: vec2<f32>,
        time: f32,
        opacity: f32,
      }
      
      ${blendFunction}
      
      @fragment
      fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
        let texCoord = vec2<f32>(pos.xy) / uniforms.resolution;
        let baseColor = textureSample(baseTexture, baseSampler, texCoord);
        let blendColor = textureSample(blendTexture, blendSampler, texCoord);
        
        return blend(baseColor, blendColor, uniforms.opacity);
      }
    `;

    // Combine both shaders
    const shaderCode = vertexShader + fragmentShader;

    super(device, {
      ...options,
      code: shaderCode,
      uniforms: {
        ...options.uniforms,
        opacity,
      },
    });

    this.blendMode = blendMode;
    this.opacity = opacity;
  }

  setOpacity(value) {
    this.opacity = value;
    this.uniforms.opacity = value;
    return this;
  }
}

/**
 * FeedbackNode - Creates a ping-pong feedback texture for iterative effects
 */
class FeedbackNode extends ShaderNode {
  constructor(device, options = {}) {
    super(device, options);

    this.textureB = null;
    this.currentIndex = 0;
    this.initialized = false;

    this.createSecondTarget();
  }

  createSecondTarget() {
    if (this.textureB) {
      this.textureB.destroy();
    }

    this.textureB = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: this.textureOptions.format,
      usage: this.textureOptions.usage,
    });
  }

  process(time) {
    this.createPipeline();
    if (!this.pipeline || !this.miniGPU) return;

    // Swap targets
    this.currentIndex = 1 - this.currentIndex;

    const currentTexture =
      this.currentIndex === 0 ? this.texture : this.textureB;
    const previousTexture =
      this.currentIndex === 1 ? this.texture : this.textureB;

    this.updateUniformBuffer();

    // Create texture bind group entries
    const entries = [];
    let bindingIndex = 0;

    // Add previous frame texture first
    entries.push({
      binding: bindingIndex++,
      resource: previousTexture.createView(),
    });

    // Add sampler for previous texture
    const sampler = this.device.createSampler({
      addressModeU: this.textureOptions.addressMode,
      addressModeV: this.textureOptions.addressMode,
      minFilter: this.textureOptions.minFilter,
      magFilter: this.textureOptions.magFilter,
      mipmapFilter: this.textureOptions.mipmapFilter,
    });

    entries.push({
      binding: bindingIndex++,
      resource: sampler,
    });

    // Add other input textures
    for (const [inputName, connection] of this.inputs) {
      const output = connection.node.output(connection.output);
      if (output?.view) {
        entries.push({
          binding: bindingIndex++,
          resource: output.view,
        });

        entries.push({
          binding: bindingIndex++,
          resource: sampler, // Reuse sampler
        });
      }
    }

    if (entries.length > 0) {
      this.textureBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(1),
        entries,
      });
    }

    // Encode commands
    const commandEncoder = this.device.createCommandEncoder();
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPassEncoder.setPipeline(this.pipeline);
    renderPassEncoder.setBindGroup(0, this.uniformBindGroup);

    if (this.textureBindGroup) {
      renderPassEncoder.setBindGroup(1, this.textureBindGroup);
    }

    // Draw a full-screen triangle
    renderPassEncoder.draw(3);
    renderPassEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    this.initialized = true;
  }

  output(outputName = "default") {
    const currentTexture =
      this.currentIndex === 0 ? this.texture : this.textureB;
    return {
      texture: currentTexture,
      view: currentTexture?.createView(),
      width: this.width,
      height: this.height,
    };
  }

  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;

      if (this.texture) {
        this.texture.destroy();
        this.texture = null;
      }

      if (this.textureB) {
        this.textureB.destroy();
        this.textureB = null;
      }

      this.createRenderTarget();
      this.createSecondTarget();
      this.initialized = false;
    }
    return this;
  }

  dispose() {
    super.dispose();
    if (this.textureB) {
      this.textureB.destroy();
      this.textureB = null;
    }
  }
}

/**
 * ImageTextureNode - Creates a texture from an image URL
 */
class ImageTextureNode extends TextureNode {
  constructor(device, options = {}) {
    super(device, {
      name: options.name || "ImageTexture",
      ...options,
    });

    this.url = options.url;
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

    // Create bitmap from image for GPU upload
    createImageBitmap(this.image).then((bitmap) => {
      // Create or update the texture
      if (!this.texture) {
        this.texture = this.device.createTexture({
          size: { width: this.width, height: this.height },
          format: this.textureOptions.format,
          usage: this.textureOptions.usage,
        });
      }

      // Copy image data to texture
      this.device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: this.texture },
        { width: this.width, height: this.height }
      );

      // Clean up
      bitmap.close();
    });
  }
}

/**
 * VideoTextureNode - Creates a texture from a video URL
 */
class VideoTextureNode extends TextureNode {
  constructor(device, options = {}) {
    super(device, {
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

    // Video frames are constantly changing, so we need to update every frame
    createImageBitmap(this.video).then((bitmap) => {
      // Create or update the texture
      if (!this.texture) {
        this.texture = this.device.createTexture({
          size: { width: this.width, height: this.height },
          format: this.textureOptions.format,
          usage: this.textureOptions.usage,
        });
      }

      // Copy video frame to texture
      this.device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: this.texture },
        { width: this.width, height: this.height }
      );

      // Clean up
      bitmap.close();
    });
  }
}

/**
 * MRTNode - Multi-Render Target Node (up to 4 outputs)
 */
class MRTNode extends TextureNode {
  constructor(device, options = {}) {
    super(device, options);

    this.numTargets = Math.min(options.numTargets || 2, 4);
    this.textures = [];
    this.code = options.code;
    this.uniforms = options.uniforms || {};
    this.pipeline = null;
    this.uniformBuffer = null;
    this.uniformBindGroup = null;
    this.textureBindGroup = null;

    this.createRenderTargets();
  }

  createRenderTargets() {
    // Create N textures for the multiple render targets
    this.textures = [];

    for (let i = 0; i < this.numTargets; i++) {
      const texture = this.device.createTexture({
        size: { width: this.width, height: this.height },
        format: this.textureOptions.format,
        usage: this.textureOptions.usage,
      });

      this.textures.push(texture);
    }
  }

  createPipeline() {
    if (this.pipeline) return;
    if (!this.miniGPU) return;

    // WebGPU shader module
    const shaderModule = this.device.createShaderModule({
      code: this.code,
    });

    // Create bind group layout for textures and uniforms
    const bindGroupLayouts = [
      // Group 0: Uniforms
      this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
          },
        ],
      }),
      // Group 1: Textures (created dynamically)
      this.createTextureBindGroupLayout(),
    ];

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts,
    });

    // Create targets array for the multiple render targets
    const targets = [];
    for (let i = 0; i < this.numTargets; i++) {
      targets.push({ format: this.textureOptions.format });
    }

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets,
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  createTextureBindGroupLayout() {
    const entries = [];
    let bindingIndex = 0;

    // Add entries for each input texture
    for (const [inputName, connection] of this.inputs) {
      entries.push(
        {
          binding: bindingIndex++,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: bindingIndex++,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        }
      );
    }

    return this.device.createBindGroupLayout({
      entries,
    });
  }

  updateUniformBuffer() {
    // Create or update uniform buffer with global uniforms + node-specific uniforms
    const globalUniforms = this.miniGPU.getGlobalUniforms(
      this.width,
      this.height
    );

    // TODO: Properly serialize uniform data to ArrayBuffer based on types
    // For now, just using a simple approach for demo
    const uniformData = new Float32Array(16); // Adjust size as needed

    // Example: Set resolution and time
    uniformData[0] = this.width;
    uniformData[1] = this.height;
    uniformData[2] = this.miniGPU.clock;

    // Add custom uniforms
    // This is simplified - would need proper type handling in real implementation

    if (!this.uniformBuffer) {
      this.uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Create bind group for uniforms
    if (!this.uniformBindGroup) {
      this.uniformBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      });
    }
  }

  updateTextureBindGroups() {
    // Create bind groups for input textures
    const entries = [];
    let bindingIndex = 0;

    for (const [inputName, connection] of this.inputs) {
      const output = connection.node.output(connection.output);
      if (output?.view) {
        entries.push({
          binding: bindingIndex++,
          resource: output.view,
        });

        // Create sampler if needed
        const sampler = this.device.createSampler({
          addressModeU: this.textureOptions.addressMode,
          addressModeV: this.textureOptions.addressMode,
          minFilter: this.textureOptions.minFilter,
          magFilter: this.textureOptions.magFilter,
          mipmapFilter: this.textureOptions.mipmapFilter,
        });

        entries.push({
          binding: bindingIndex++,
          resource: sampler,
        });
      }
    }

    if (entries.length > 0) {
      this.textureBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(1),
        entries,
      });
    }
  }

  process(time) {
    this.createPipeline();
    if (!this.pipeline || !this.miniGPU) return;

    this.updateUniformBuffer();
    this.updateTextureBindGroups();

    const commandEncoder = this.device.createCommandEncoder();

    // Create color attachments for all render targets
    const colorAttachments = [];
    for (let i = 0; i < this.numTargets; i++) {
      colorAttachments.push({
        view: this.textures[i].createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      });
    }

    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments,
    });

    renderPassEncoder.setPipeline(this.pipeline);
    renderPassEncoder.setBindGroup(0, this.uniformBindGroup);

    if (this.textureBindGroup) {
      renderPassEncoder.setBindGroup(1, this.textureBindGroup);
    }

    // Draw a full-screen triangle
    renderPassEncoder.draw(3);
    renderPassEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  output(outputName = "default") {
    // outputName: "0", "1", ...
    const idx = outputName === "default" ? 0 : parseInt(outputName, 10);
    if (idx >= this.numTargets || !this.textures[idx]) {
      return {
        texture: null,
        view: null,
        width: this.width,
        height: this.height,
      };
    }

    return {
      texture: this.textures[idx],
      view: this.textures[idx].createView(),
      width: this.width,
      height: this.height,
    };
  }

  resize(width, height) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;

      // Destroy existing textures
      for (const texture of this.textures) {
        texture.destroy();
      }

      this.textures = [];
      this.createRenderTargets();
    }
    return this;
  }

  dispose() {
    for (const texture of this.textures) {
      texture.destroy();
    }

    this.textures = [];

    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
  }
}

class miniGPU {
  constructor(id) {
    this.canvas = document.getElementById(id);
    this.device = null;
    this.context = null;
    this.format = "rgba8unorm"; // Default texture format
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
    this._topoOrder = null;
    this._graphDirty = true;

    // Shaders for output to screen
    this.outputShaders = {
      vertex: `
        @vertex
        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 3>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(3.0, -1.0),
            vec2<f32>(-1.0, 3.0)
          );
          return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        }
      `,
      fragment: `
        @group(0) @binding(0) var outputTexture: texture_2d<f32>;
        @group(0) @binding(1) var outputSampler: sampler;

        @fragment
        fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
          let texCoord = vec2<f32>(pos.xy) / vec2<f32>(textureDimensions(outputTexture));
          return textureSample(outputTexture, outputSampler, texCoord);
        }
      `,
    };

    // Initialize WebGPU
    this.init();
  }

  async init() {
    try {
      // Request adapter
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        throw new Error("WebGPU not supported - couldn't get adapter");
      }

      // Request device
      this.device = await adapter.requestDevice();

      // Set up canvas context
      this.context = this.canvas.getContext("webgpu");
      this.format = navigator.gpu.getPreferredCanvasFormat();

      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "premultiplied",
      });

      // Create output pipeline
      this.createOutputPipeline();

      // Set up event listeners
      this.setupEventListeners();
      this.setupObservers();

      // Initial sizing
      this.resize();

      console.log("WebGPU initialized successfully");
    } catch (error) {
      console.error("WebGPU initialization failed:", error);
    }
  }

  createOutputPipeline() {
    const vertexModule = this.device.createShaderModule({
      code: this.outputShaders.vertex,
    });

    const fragmentModule = this.device.createShaderModule({
      code: this.outputShaders.fragment,
    });

    // Create bind group layout for the output texture
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.outputPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this.outputSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
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

        if (deltaTime > 0) {
          const timeFactor = Math.min(1000 / 60, deltaTime) / (1000 / 60);
          this.mouseVelocity.x = (this.mouse.x - this.prevMouse.x) / timeFactor;
          this.mouseVelocity.y = (this.mouse.y - this.prevMouse.y) / timeFactor;
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

      // Reconfigure context with new size
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "premultiplied",
      });

      // Resize all nodes
      for (const node of this.nodes.values()) {
        node.resize(this.canvas.width, this.canvas.height);
      }
    }
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

  // Add a node to the graph
  addNode(node) {
    node.miniGPU = this;
    this.nodes.set(node.id, node);
    this._graphDirty = true;
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

  // Create a shader node
  createShaderNode(code, options = {}) {
    const node = new ShaderNode(this.device, {
      code,
      uniforms: options.uniforms || {},
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      format: options.format || this.format,
      addressMode: options.addressMode,
      minFilter: options.minFilter,
      magFilter: options.magFilter,
      mipmapFilter: options.mipmapFilter,
      name: options.name,
    });

    return this.addNode(node);
  }

  // Shorter alias for createShaderNode
  shader(code, options = {}) {
    return this.createShaderNode(code, options);
  }

  // Create a feedback node
  createFeedbackNode(code, options = {}) {
    const node = new FeedbackNode(this.device, {
      code,
      uniforms: options.uniforms || {},
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      format: options.format || this.format,
      addressMode: options.addressMode,
      minFilter: options.minFilter,
      magFilter: options.magFilter,
      mipmapFilter: options.mipmapFilter,
      name: options.name,
    });

    return this.addNode(node);
  }

  // Shorter alias for createFeedbackNode
  pingpong(code, options = {}) {
    return this.createFeedbackNode(code, options);
  }

  // Get global uniforms for all shaders
  getGlobalUniforms(width, height) {
    return {
      resolution: { x: width, y: height },
      time: this.clock,
      mouse: { x: this.mouse.x, y: this.mouse.y, z: this.mouse.click },
      velocity: { x: this.mouseVelocity.x, y: this.mouseVelocity.y },
      pixel: { x: this.pixel.x, y: this.pixel.y },
      ratio: this.ratio,
    };
  }

  // Helper method to create common node connections
  connect(
    sourceNode,
    targetNode,
    inputName = "texture",
    outputName = "default"
  ) {
    targetNode.connect(inputName, sourceNode, outputName);
    return this;
  }

  // Rendering logic
  async render() {
    if (!this.device || !this.isVisible) return;
    if (!this.outputNode) return;

    this.clock++;
    const currentTime = this.clock;

    // Update velocity dampening
    if (performance.now() - this.lastMouseUpdateTime > 16) {
      this.mouseVelocity.x *= 0.95;
      this.mouseVelocity.y *= 0.95;
      if (Math.abs(this.mouseVelocity.x) < 0.001) this.mouseVelocity.x = 0;
      if (Math.abs(this.mouseVelocity.y) < 0.001) this.mouseVelocity.y = 0;
    }

    // Process nodes in topological order
    const order = this._topoSort(this.outputNode);
    for (const node of order) {
      node.process(currentTime);
      node.lastUpdateTime = currentTime;
    }

    // Render final output to screen
    this.renderToScreen();

    // Queue next frame
    requestAnimationFrame(() => this.render());
  }

  renderToScreen() {
    if (!this.outputNode) return;

    const output = this.outputNode.output();
    if (!output?.view) return;

    // Create bind group for the output texture
    const bindGroup = this.device.createBindGroup({
      layout: this.outputPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: output.view,
        },
        {
          binding: 1,
          resource: this.outputSampler,
        },
      ],
    });

    // Create command encoder and render pass
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.outputPipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3); // Draw full-screen triangle
    renderPass.end();

    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);
  }

  dispose() {
    // Clean up all event listeners
    this.eventController.abort();

    // Clean up resize listener
    if (this._resizeListener) {
      window.removeEventListener("resize", this._resizeListener);
      this._resizeListener = null;
    }

    // Clean up observers
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(this.canvas);
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    // Clean up nodes
    for (const node of this.nodes.values()) {
      node.dispose();
    }

    this.nodes.clear();
  }

  // Start rendering loop
  start() {
    requestAnimationFrame(() => this.render());
    return this;
  }

  // Create an image texture node
  createImageTexture(url, options = {}) {
    const node = new ImageTextureNode(this.device, {
      url,
      width: options.width,
      height: options.height,
      format: options.format || this.format,
      addressMode: options.addressMode,
      minFilter: options.minFilter,
      magFilter: options.magFilter,
      mipmapFilter: options.mipmapFilter,
      name: options.name,
    });

    return this.addNode(node);
  }

  // Shorter alias for createImageTexture
  image(url, options = {}) {
    return this.createImageTexture(url, options);
  }

  // Create a video texture node
  createVideoTexture(url, options = {}) {
    const node = new VideoTextureNode(this.device, {
      url,
      width: options.width,
      height: options.height,
      format: options.format || this.format,
      addressMode: options.addressMode,
      minFilter: options.minFilter,
      magFilter: options.magFilter,
      mipmapFilter: options.mipmapFilter,
      name: options.name,
    });

    return this.addNode(node);
  }

  // Shorter alias for createVideoTexture
  video(url, options = {}) {
    return this.createVideoTexture(url, options);
  }

  // Create an MRT node
  createMRTNode(code, options = {}) {
    const node = new MRTNode(this.device, {
      code,
      numTargets: options.numTargets || 2,
      uniforms: options.uniforms || {},
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      format: options.format || this.format,
      addressMode: options.addressMode,
      minFilter: options.minFilter,
      magFilter: options.magFilter,
      mipmapFilter: options.mipmapFilter,
      name: options.name,
    });

    return this.addNode(node);
  }

  // Shorter alias for createMRTNode
  mrt(code, options = {}) {
    return this.createMRTNode(code, options);
  }

  // Create a constant color node
  createConstantColor(color, options = {}) {
    const node = new ConstantColorNode(this.device, {
      color,
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      format: options.format || this.format,
      name: options.name,
    });

    return this.addNode(node);
  }

  // Shorter alias for createConstantColor
  color(color, options = {}) {
    return this.createConstantColor(color, options);
  }

  // Create a blend node
  createBlendNode(options = {}) {
    const node = new BlendNode(this.device, {
      blendMode: options.blendMode || "normal",
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      width: options.width || this.canvas.width,
      height: options.height || this.canvas.height,
      format: options.format || this.format,
      addressMode: options.addressMode,
      minFilter: options.minFilter,
      magFilter: options.magFilter,
      mipmapFilter: options.mipmapFilter,
      name: options.name || `Blend_${options.blendMode || "normal"}`,
    });

    return this.addNode(node);
  }

  // Shorter alias for createBlendNode
  blend(options = {}) {
    return this.createBlendNode(options);
  }

  // Create default shaders with expected formats for WebGPU
  createDefaultShaders() {
    // Simple circle shader
    this.defaultShaders = {
      circle: `
        @vertex
        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 3>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(3.0, -1.0),
            vec2<f32>(-1.0, 3.0)
          );
          return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        }
        
        struct Uniforms {
          resolution: vec2<f32>,
          time: f32,
        }
        
        @group(0) @binding(0) var<uniform> uniforms : Uniforms;
        
        @fragment
        fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
          let uv = pos.xy / uniforms.resolution;
          let center = vec2<f32>(0.5);
          let dist = distance(uv, center);
          let circle = smoothstep(0.3, 0.29, dist);
          return vec4<f32>(circle, circle * 0.5, circle * abs(sin(uniforms.time * 0.01)), 1.0);
        }
      `,

      ripple: `
        @vertex
        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 3>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(3.0, -1.0),
            vec2<f32>(-1.0, 3.0)
          );
          return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        }
        
        struct Uniforms {
          resolution: vec2<f32>,
          time: f32,
        }
        
        @group(0) @binding(0) var<uniform> uniforms : Uniforms;
        
        @fragment
        fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
          let uv = pos.xy / uniforms.resolution;
          let center = vec2<f32>(0.5);
          let dist = distance(uv, center);
          let ripple = sin(dist * 50.0 - uniforms.time * 0.05) * 0.5 + 0.5;
          let falloff = smoothstep(0.5, 0.0, dist);
          return vec4<f32>(ripple * falloff, ripple * 0.5 * falloff, falloff, 1.0);
        }
      `,
    };
  }
}

export default miniGPU;
