# MiniNodes - Custom Effect Nodes for miniGL

MiniNodes are reusable effect components that extend miniGL's capabilities with common image processing and visual effects. They provide a clean, composable API for building complex shader pipelines.

## Quick Start

```javascript
import miniGL from './lib/miniGL/miniGL.js';

async function init() {
  // Initialize miniGL (miniNodes enabled by default)
  const gl = new miniGL('canvas');
  
  // Wait for miniNodes to be ready
  await gl.ready();
  
  // Load an image
  const texture = gl.image('image.jpg');

  // Apply bloom effect
  const bloom = gl.bloom(0.3, 0.2, 2.0, 1.5, 1.0);
  bloom.connect('uTexture', texture);
  gl.output(bloom);

  // Animation loop
  function animate() {
      gl.render();
      requestAnimationFrame(animate);
  }
  animate();
}

// Initialize everything
init().catch(console.error);
```

## Important: Async Loading

Since MiniNodes use dynamic imports for optimal loading, they are loaded asynchronously. You must wait for them to be ready before using miniNode factory methods:

```javascript
const gl = new miniGL('canvas');

// ❌ This will fail - miniNodes not loaded yet
// const bloom = gl.bloom(0.3, 0.2, 2.0, 1.5, 1.0);

// ✅ This is correct - wait for ready
await gl.ready();
const bloom = gl.bloom(0.3, 0.2, 2.0, 1.5, 1.0);
```

Core nodes (shader, image, etc.) are available immediately and don't require waiting.

## Available Nodes

### Utility Nodes

**Luminance Extraction**
```javascript
const luminance = gl.luminance(threshold, knee, options);
luminance.connect('uTexture', sourceNode);
```

**Grayscale Conversion**
```javascript
const grayscale = gl.grayscale(strength, options);
grayscale.connect('uTexture', sourceNode);
```

**Texture Mixing**
```javascript
const mix = gl.mix(mixFactor, options);
mix.connect('uTextureA', sourceA);
mix.connect('uTextureB', sourceB);
```

**Gaussian Blur**
```javascript
// Single direction
const blur = gl.gaussianBlur(radius, direction, options);
blur.connect('uTexture', sourceNode);

// Horizontal/Vertical shortcuts
const blurH = gl.gaussianBlurH(radius);
const blurV = gl.gaussianBlurV(radius);

// Two-pass blur (returns { blurH, blurV, output })
const blur2Pass = gl.gaussianBlur2Pass(radius);
blur2Pass.blurH.connect('uTexture', sourceNode);
```

**Brightness/Contrast**
```javascript
const adjust = gl.brightnessContrast(brightness, contrast, options);
adjust.connect('uTexture', sourceNode);
```

**Saturation**
```javascript
const saturation = gl.saturation(amount, options);
saturation.connect('uTexture', sourceNode);
```

### Effect Nodes

**Bloom Effect**
```javascript
const bloom = gl.bloom(threshold, knee, intensity, blurRadius, mix, options);
bloom.connect('uTexture', sourceNode);
```

## API Patterns

### Simple Chains
```javascript
const source = gl.image('image.jpg');
const brightness = gl.brightnessContrast(0.2, 1.5);
const blur = gl.gaussianBlur(2.0, [1.0, 0.0]);

brightness.connect('uTexture', source);
blur.connect('uTexture', brightness);
gl.output(blur);
```

### Branching and Mixing
```javascript
const source = gl.image('image.jpg');
const grayscale = gl.grayscale(1.0);
const blur = gl.gaussianBlur(3.0, [1.0, 0.0]);
const mix = gl.mix(0.7);

grayscale.connect('uTexture', source);
blur.connect('uTexture', grayscale);
mix.connect('uTextureA', source);
mix.connect('uTextureB', blur);

gl.output(mix);
```

### Updating Uniforms
```javascript
const bloom = gl.bloom(0.3, 0.2, 2.0, 1.5, 1.0);

// Update parameters at runtime
bloom.updateUniform('uThreshold', 0.5);
bloom.updateUniform('uIntensity', 3.0);
```

## Creating Custom MiniNodes

### Simple Single-Shader Node
```javascript
import { MiniNode } from './lib/miniGL/miniNode.js';

class InvertNode extends MiniNode {
  constructor(gl, strength = 1.0, options = {}) {
    super(gl, {
      uniforms: { 
        uStrength: strength,
        uTexture: { texture: gl.TransparentPixel }
      },
      ...options
    });

    this.fragmentShader = `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform float uStrength;
out vec4 fragColor;

void main() {
  vec4 color = texture(uTexture, glUV);
  vec3 inverted = vec3(1.0) - color.rgb;
  fragColor = vec4(mix(color.rgb, inverted, uStrength), color.a);
}`;

    this.inputRouting.set('uTexture', 'main');
  }
}

// Usage
const invert = new InvertNode(gl, 1.0);
gl.addNode(invert);
invert.connect('uTexture', sourceNode);
```

### Complex Multi-Node Composition
```javascript
class CustomBloomNode extends MiniNode {
  constructor(gl, threshold = 0.8, options = {}) {
    super(gl, {
      uniforms: { uThreshold: threshold, uTexture: { texture: gl.TransparentPixel } },
      ...options
    });

    // Define internal node structure
    this.nodeDefinitions = [
      {
        key: 'luminance',
        type: 'shader',
        name: 'Luminance',
        fragmentShader: luminanceShader
      },
      {
        key: 'blur',
        type: 'shader', 
        name: 'Blur',
        fragmentShader: blurShader
      }
    ];

    // Define connections between internal nodes
    this.nodeConnections = [
      { source: 'luminance', target: 'blur', input: 'uTexture' }
    ];

    // Route external inputs to internal nodes
    this.inputRouting.set('uTexture', 'luminance');

    // Route uniforms to internal nodes
    this.uniformBindings.set('uThreshold', ['luminance']);

    // Set output node
    this.outputNode = 'blur';
  }
}
```

## Configuration Options

### Disabling MiniNodes
```javascript
// Initialize miniGL without miniNodes (core nodes only)
const gl = new miniGL('canvas', { enableMiniNodes: false });
```

### Node Options
All nodes accept an options object:
```javascript
const bloom = gl.bloom(0.3, 0.2, 2.0, 1.5, 1.0, {
  name: 'Custom Bloom',
  width: 1024,
  height: 1024,
  filter: 'LINEAR',
  wrap: 'CLAMP_TO_EDGE',
  mipmap: true
});
```

## Architecture Notes

### MiniNode Base Class
- Handles standard node interface (inputs, outputs, connect, disconnect)
- Manages uniform routing to internal nodes
- Supports both simple single-shader and complex multi-node patterns
- Automatic initialization when added to miniGL

### Integration with React Flow
The node system is designed with future React Flow integration in mind:
- Unique node IDs for graph representation
- Clean input/output port definitions
- Serializable node configurations
- Modular composition patterns

### Performance Considerations
- Internal nodes are processed in dependency order
- Uniform updates are efficiently propagated
- Texture resources are properly managed
- Supports WebGL2 float textures when available

## Examples

Check out these example files:
- `examples/bloom-test.html` - Bloom effect with controls
- `examples/mininode-test.html` - Multiple effects showcase

## Core vs MiniNodes

**Core Nodes** (always available):
- `shader()` - Custom fragment shaders
- `pingpong()` - Feedback/ping-pong buffers  
- `image()` - Image textures
- `canvas2D()` - Canvas 2D textures
- `video()` - Video textures
- `blend()` - Blend modes
- `mrt()` - Multi-render targets
- `group()` - Node grouping

**MiniNodes** (optional, enabled by default):
- All utility and effect nodes listed above
- Custom composable effects
- Reusable shader components 