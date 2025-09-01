export class NodeLibrary {
  constructor(editorState) {
    this.editorState = editorState;
    this.nodesCollection = null;
    this.presets = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Wait for Quick to be available
    await this.waitForQuick();
    
    // Initialize database collection for node presets
    this.nodesCollection = quick.db.collection('node-presets');
    
    // Load default presets
    await this.loadDefaultPresets();
    
    // Subscribe to updates
    this.subscribeToPresets();
    
    this.initialized = true;
  }

  waitForQuick() {
    return new Promise((resolve) => {
      const checkQuick = () => {
        if (typeof quick !== 'undefined' && quick.db) {
          resolve();
        } else {
          setTimeout(checkQuick, 100);
        }
      };
      checkQuick();
    });
  }

  async loadDefaultPresets() {
    // Check if default presets exist in database
    const existingPresets = await this.nodesCollection
      .where({ isDefault: true })
      .limit(1)
      .find();
    
    if (existingPresets.length === 0) {
      // Create default presets
      await this.createDefaultPresets();
    }
    
    // Load all presets into memory
    await this.loadAllPresets();
  }

  async createDefaultPresets() {
    const defaultPresets = [
      {
        name: "Kaleidoscope",
        type: "Shader",
        category: "Effects",
        isDefault: true,
        shader: `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform sampler2D uTexture;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = glUV - center;
    
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    // Kaleidoscope effect
    float segments = 6.0;
    angle = mod(angle, 3.14159 * 2.0 / segments);
    angle = abs(angle - 3.14159 / segments);
    
    vec2 newUV = vec2(cos(angle), sin(angle)) * radius + center;
    
    fragColor = texture(uTexture, newUV);
}`,
        uniforms: {},
        inputs: ["uTexture"]
      },
      {
        name: "Chromatic Aberration",
        type: "Shader",
        category: "Effects",
        isDefault: true,
        shader: `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 glResolution;
uniform float uStrength;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 offset = (glUV - center) * uStrength * 0.01;
    
    float r = texture(uTexture, glUV - offset).r;
    float g = texture(uTexture, glUV).g;
    float b = texture(uTexture, glUV + offset).b;
    
    fragColor = vec4(r, g, b, 1.0);
}`,
        uniforms: {
          uStrength: { type: "slider", value: 1.0, min: 0, max: 5 }
        },
        inputs: ["uTexture"]
      },
      {
        name: "Pixelate",
        type: "Shader",
        category: "Effects",
        isDefault: true,
        shader: `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 glResolution;
uniform float uPixelSize;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 pixelSize = vec2(uPixelSize) / glResolution;
    vec2 pixelatedUV = floor(glUV / pixelSize) * pixelSize + pixelSize * 0.5;
    
    fragColor = texture(uTexture, pixelatedUV);
}`,
        uniforms: {
          uPixelSize: { type: "slider", value: 8.0, min: 2, max: 32 }
        },
        inputs: ["uTexture"]
      },
      {
        name: "Glitch",
        type: "Shader",
        category: "Effects",
        isDefault: true,
        shader: `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform float glTime;
uniform float uIntensity;

in vec2 glUV;
out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    vec2 uv = glUV;
    
    // Random glitch blocks
    float blockSize = 0.05;
    vec2 block = floor(uv / blockSize) * blockSize;
    float glitchTime = floor(glTime * 10.0);
    
    if (random(block + vec2(glitchTime)) > 1.0 - uIntensity * 0.1) {
        // RGB shift
        float shift = (random(block + vec2(glitchTime + 1.0)) - 0.5) * 0.05 * uIntensity;
        uv.x += shift;
    }
    
    vec3 color = texture(uTexture, uv).rgb;
    
    // Color distortion
    if (random(vec2(glitchTime * 0.1)) > 0.9) {
        color = 1.0 - color;
    }
    
    fragColor = vec4(color, 1.0);
}`,
        uniforms: {
          uIntensity: { type: "slider", value: 0.5, min: 0, max: 1 }
        },
        inputs: ["uTexture"]
      },
      {
        name: "Wave Distortion",
        type: "Shader",
        category: "Generators",
        isDefault: true,
        shader: `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform float uAmplitude;
uniform float uFrequency;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 uv = glUV * 2.0 - 1.0;
    float aspect = glResolution.x / glResolution.y;
    uv.x *= aspect;
    
    float wave = sin(uv.y * uFrequency + glTime * 0.01) * uAmplitude;
    float dist = abs(uv.x - wave);
    
    vec3 color = vec3(1.0 - smoothstep(0.0, 0.1, dist));
    color *= vec3(0.5 + uv.y * 0.5, 0.5, 1.0 - uv.y * 0.5);
    
    fragColor = vec4(color, 1.0);
}`,
        uniforms: {
          uAmplitude: { type: "slider", value: 0.3, min: 0, max: 1 },
          uFrequency: { type: "slider", value: 10.0, min: 1, max: 20 }
        },
        inputs: []
      },
      {
        name: "Plasma",
        type: "Shader",
        category: "Generators",
        isDefault: true,
        shader: `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform float uScale;
uniform float uSpeed;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 uv = glUV * uScale;
    float time = glTime * 0.001 * uSpeed;
    
    float v1 = sin(uv.x * 10.0 + time);
    float v2 = sin(10.0 * (uv.x * sin(time * 0.5) + uv.y * cos(time * 0.3)) + time);
    float v3 = sin(sqrt(100.0 * (uv.x * uv.x + uv.y * uv.y) + 1.0) + time);
    
    vec3 color = vec3(v1, v2, v3) * 0.5 + 0.5;
    
    fragColor = vec4(color, 1.0);
}`,
        uniforms: {
          uScale: { type: "slider", value: 5.0, min: 1, max: 20 },
          uSpeed: { type: "slider", value: 1.0, min: 0, max: 5 }
        },
        inputs: []
      }
    ];

    // Save default presets to database
    for (const preset of defaultPresets) {
      await this.nodesCollection.create(preset);
    }
  }

  async loadAllPresets() {
    const presets = await this.nodesCollection.find();
    
    this.presets.clear();
    for (const preset of presets) {
      this.presets.set(preset.id, preset);
    }
  }

  subscribeToPresets() {
    this.nodesCollection.subscribe({
      onCreate: async (doc) => {
        this.presets.set(doc.id, doc);
        this.onPresetsChanged();
      },
      onUpdate: async (doc) => {
        this.presets.set(doc.id, doc);
        this.onPresetsChanged();
      },
      onDelete: (id) => {
        this.presets.delete(id);
        this.onPresetsChanged();
      }
    });
  }

  async createPreset(nodeData) {
    const preset = {
      name: nodeData.name,
      type: nodeData.type,
      category: nodeData.category || "Custom",
      isDefault: false,
      userId: quick.id.email,
      shader: nodeData.shader,
      uniforms: nodeData.uniforms,
      inputs: nodeData.inputs || [],
      canvasCode: nodeData.canvasCode,
      url: nodeData.url,
      text: nodeData.text,
      created_at: new Date().toISOString()
    };

    const created = await this.nodesCollection.create(preset);
    return created;
  }

  async loadPreset(presetId) {
    const preset = this.presets.get(presetId);
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Create node from preset
    const node = this.editorState.addNode(
      preset.type,
      preset.name,
      { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }
    );

    // Apply preset properties
    if (preset.shader) node.shader = preset.shader;
    if (preset.uniforms) node.uniforms = preset.uniforms;
    if (preset.inputs) node.inputs = preset.inputs;
    if (preset.canvasCode) node.canvasCode = preset.canvasCode;
    if (preset.url) node.url = preset.url;
    if (preset.text) node.text = preset.text;

    // Recreate miniGL node
    const miniglNode = this.editorState.miniglNodes.get(node.id);
    if (miniglNode && miniglNode.dispose) {
      miniglNode.dispose();
    }
    this.editorState.miniglNodes.delete(node.id);
    this.editorState.createMiniGLNode(node);

    this.editorState.updateUI();
    
    return node;
  }

  async deletePreset(presetId) {
    const preset = this.presets.get(presetId);
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Only allow deletion of user's own presets
    if (!preset.isDefault && preset.userId === quick.id.email) {
      await this.nodesCollection.delete(presetId);
    } else {
      throw new Error('Cannot delete this preset');
    }
  }

  getPresetsByCategory() {
    const categories = new Map();
    
    for (const preset of this.presets.values()) {
      const category = preset.category || "Uncategorized";
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category).push(preset);
    }
    
    return categories;
  }

  async searchPresets(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];
    
    for (const preset of this.presets.values()) {
      if (preset.name.toLowerCase().includes(lowerQuery) ||
          (preset.category && preset.category.toLowerCase().includes(lowerQuery))) {
        results.push(preset);
      }
    }
    
    return results;
  }

  async sharePreset(nodeId) {
    const node = this.editorState.getNode(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    const preset = await this.createPreset({
      name: node.name + ' (Shared)',
      type: node.type,
      category: 'Shared',
      shader: node.shader,
      uniforms: node.uniforms,
      inputs: node.inputs,
      canvasCode: node.canvasCode,
      url: node.url,
      text: node.text
    });

    return preset.id;
  }

  onPresetsChanged() {
    // This will be overridden by UI components
    if (this.onUpdate) {
      this.onUpdate();
    }
  }
}