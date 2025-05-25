// Luminance extraction shader
const luminanceShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uKnee;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  
  // Calculate luminance
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  
  // Soft threshold with knee
  float threshold = smoothstep(uThreshold - uKnee, uThreshold + uKnee, luma);
  fragColor = mix(vec4(0.),color, threshold);
}`;

// Horizontal Gaussian blur
const horizontalBlurShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uBlurRadius;
uniform vec2 glResolution;
out vec4 fragColor;

void main() {
  vec2 texel = 1./glResolution;
  float sigma = uBlurRadius;
  int kernelSize = 2 * int(floor(4. * sigma + .5)) + 1;
    
    float weightSum = 0.;
    fragColor *= 0.;
    for (int i = 0; i < kernelSize; i++)
    {
        float x = float(i) - (float(kernelSize) * .5);
        float weight = exp(-(x * x) / (2.0 * sigma * sigma));
        weightSum += weight;
        fragColor += texture(uTexture, glUV + vec2( x * texel.x,0.)) * weight;
    }
    fragColor /= weightSum;
  
}`;

// Vertical Gaussian blur
const verticalBlurShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uBlurRadius;
uniform vec2 glResolution;

out vec4 fragColor;

void main() {
  vec2 texel = 1./glResolution;
  float sigma = uBlurRadius;
  int kernelSize = 2 * int(floor(4. * sigma + .5)) + 1;
    
    float weightSum = 0.;
    fragColor *= 0.;
    for (int i = 0; i < kernelSize; i++)
    {
        float x = float(i) - (float(kernelSize) * .5);
        float weight = exp(-(x * x) / (2.0 * sigma * sigma));
        weightSum += weight;
        fragColor += texture(uTexture, glUV + vec2(0., x * texel.y)) * weight;
    }
    fragColor /= weightSum;
  
}`;

// Composite shader - Full bloom implementation
const compositeShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;    // Original
uniform sampler2D uBloom;      // Blurred bloom
uniform float uIntensity;
uniform float uMix;
out vec4 fragColor;

void main() {
  vec4 original = texture(uTexture, glUV);
  vec4 bloom = texture(uBloom, glUV);
  
  // Additive blend with intensity
  vec4 result = original + min(bloom * uIntensity, vec4(1.));
  
  // Optional mix between original and bloomed
  fragColor = mix(original, result, uMix);
}`;

export function BloomNode(
  gl,
  threshold = 0.8,
  knee = 0.1,
  intensity = 1.0,
  blurRadius = 1.0,
  mix = 1.0,
  name = "Bloom Node"
) {
  this.gl = gl;
  this.minigl = null; // Will be set when added to miniGL

  // Node interface properties (required by miniGL)
  this.inputs = new Map();
  this.outputs = new Set();
  this.id = `bloom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  this.name = name;

  // Store uniform values
  this.uniforms = {
    uTexture: { texture: gl.TransparentPixel },
    uThreshold: threshold,
    uKnee: knee,
    uIntensity: intensity,
    uBlurRadius: blurRadius,
    uMix: mix,
  };

  // Input routing: maps input keys to target internal nodes
  this.inputBindings = new Map([
    ["uTexture", "luminance"], // Main source goes to luminance extraction
  ]);

  // Uniform distribution: maps uniforms to arrays of target nodes
  this.uniformBindings = new Map([
    ["uThreshold", ["luminance"]],
    ["uKnee", ["luminance"]],
    ["uBlurRadius", ["blurH", "blurV"]],
    ["uIntensity", ["composite"]],
    ["uMix", ["composite"]],
  ]);

  // Get uniforms for a specific node based on bindings
  this.getNodeUniforms = (nodeKey) => {
    const nodeUniforms = {};
    for (const [uniformKey, targetNodes] of this.uniformBindings) {
      if (
        targetNodes.includes(nodeKey) &&
        this.uniforms[uniformKey] !== undefined
      ) {
        nodeUniforms[uniformKey] = this.uniforms[uniformKey];
      }
    }
    return nodeUniforms;
  };

  // Update uniforms and propagate to bound nodes
  this.updateUniform = (key, value) => {
    if (this.uniforms.hasOwnProperty(key)) {
      this.uniforms[key] = value;

      // Find which nodes this uniform affects
      const targetNodes = this.uniformBindings.get(key);
      if (targetNodes) {
        targetNodes.forEach((nodeKey) => {
          if (this.nodes[nodeKey]) {
            this.nodes[nodeKey].updateUniform(key, value);
          }
        });
      }
    }
    return this;
  };

  // Initialize uniform bindings
  this.updateAllBindings = () => {
    for (const [uniformKey, targetNodes] of this.uniformBindings) {
      targetNodes.forEach((nodeKey) => {
        if (this.nodes[nodeKey] && this.uniforms[uniformKey] !== undefined) {
          this.nodes[nodeKey].updateUniform(
            uniformKey,
            this.uniforms[uniformKey]
          );
        }
      });
    }
  };

  // Initialize internal nodes - this will be called after minigl is set
  this.initializeInternalNodes = () => {
    if (!this.minigl) {
      return;
    }

    // Create internal nodes
    this.nodes = {
      luminance: this.minigl.shader(luminanceShader, {
        name: `${name}_Luminance`,
        uniforms: this.getNodeUniforms("luminance"),
        mipmap: true,
      }),

      blurH: this.minigl.shader(horizontalBlurShader, {
        name: `${name}_BlurH`,
        uniforms: this.getNodeUniforms("blurH"),
      }),

      blurV: this.minigl.shader(verticalBlurShader, {
        name: `${name}_BlurV`,
        uniforms: this.getNodeUniforms("blurV"),
      }),

      composite: this.minigl.shader(compositeShader, {
        name: `${name}_Composite`,
        uniforms: this.getNodeUniforms("composite"),
      }),
    };

    // Connect internal nodes: luminance -> blurH -> blurV -> composite
    this.nodes.blurH.connect("uTexture", this.nodes.luminance);
    this.nodes.blurV.connect("uTexture", this.nodes.blurH);
    this.nodes.composite.connect("uBloom", this.nodes.blurV);

    // Set output node to composite for full bloom
    this.outputNode = "composite";

    // Initialize uniform bindings
    this.updateAllBindings();
  };

  // Method to set miniGL reference (called by addNode)
  this.setMiniGL = (minigl) => {
    this.minigl = minigl;
    this.initializeInternalNodes();
  };

  // Node interface methods
  this.connect = (inputName, sourceNode, outputName = "default") => {
    this.inputs.set(inputName, { node: sourceNode, output: outputName });
    sourceNode.outputs.add(this);

    // Route to internal nodes based on inputBindings (only if nodes exist)
    if (this.nodes && inputName === "uTexture") {
      this.nodes.luminance.connect("uTexture", sourceNode);
      this.nodes.composite.connect("uTexture", sourceNode);
    }
    return this;
  };

  this.disconnect = (inputName) => {
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);
    }
    return this;
  };

  // Return the output node (required by miniGL)
  this.output = (outputName = "default") => {
    if (!this.nodes || !this.nodes[this.outputNode]) {
      return { texture: this.gl.TransparentPixel, width: 1, height: 1 };
    }
    return this.nodes[this.outputNode].output(outputName);
  };

  // Process method (required by miniGL for topological sort)
  this.process = (time) => {
    // We need to manually process our internal nodes since they're not part of the external graph
    if (!this.nodes) return;

    // Process internal nodes in dependency order: luminance -> blur -> composite
    this.nodes.luminance.process(time);
    this.nodes.blurH.process(time);
    this.nodes.blurV.process(time);
    this.nodes.composite.process(time);
  };

  // Size method (required by some miniGL operations)
  this.size = () => {
    if (!this.nodes || !this.nodes[this.outputNode]) {
      return [1, 1];
    }
    return this.nodes[this.outputNode].size();
  };
}

export default BloomNode;
