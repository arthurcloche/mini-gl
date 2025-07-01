# miniGL Web Components

> Declarative WebGL2 node-based rendering in HTML

Transform WebGL into simple, declarative HTML. Build complex graphics pipelines by connecting nodes in your markup.

## Quick Start

```html
<!-- Include the components -->
<script type="module" src="./lib/miniGL-components/index.js"></script>

<!-- Create a simple shader -->
<minigl-canvas>
  <shader-node fragment="
    #version 300 es
    precision highp float;
    in vec2 glCoord;
    out vec4 fragColor;
    void main() {
      float dist = length(glCoord - 0.5);
      fragColor = vec4(vec3(1.0 - dist), 1.0);
    }
  "></shader-node>
</minigl-canvas>
```

## Core Concept

The web components wrap the core miniGL library, making it accessible through HTML. Each node type becomes a custom element, and connections are established through attributes or nested elements.

## Canvas Element

The `<minigl-canvas>` is the container that manages the WebGL context and node graph.

```html
<minigl-canvas 
  width="800" 
  height="600" 
  output="finalNode" 
  debug
  auto-render="true">
  <!-- nodes go here -->
</minigl-canvas>
```

### Attributes
- `width/height` - Canvas size (optional)
- `output` - ID of the node to render (defaults to last node)
- `debug` - Show debug info overlay
- `auto-render` - Auto-start render loop (default: true)

### Events
- `minigl-ready` - Fired when graph is initialized
- `minigl-error` - Fired on WebGL errors
- `minigl-node-error` - Fired when a node fails to create

## Node Types

### Shader Node
Run custom fragment shaders.

```html
<!-- Inline shader -->
<shader-node id="myShader" fragment="...glsl code..."></shader-node>

<!-- Shader as content -->
<shader-node id="myShader">
  #version 300 es
  precision highp float;
  uniform float glTime;
  in vec2 glCoord;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(sin(glTime), cos(glTime), 0.5, 1.0);
  }
</shader-node>

<!-- With uniforms -->
<shader-node id="myShader" 
             uniforms='{"amount": 1.0, "color": [1,0,0]}'>
  ...
</shader-node>
```

### Image Node
Load images as textures.

```html
<image-node id="photo" 
            src="photo.jpg" 
            fitting="cover">
</image-node>
```

**Fitting modes:** `fill`, `fit`, `cover`

### Video Node
Load videos as textures.

```html
<video-node id="vid" src="video.mp4"></video-node>
```

### Canvas Node
Use 2D canvas as texture source.

```html
<!-- With global draw function -->
<canvas-node id="drawing" 
             draw-function="myDrawFunction"
             width="512" 
             height="512">
</canvas-node>

<!-- Simple color fill -->
<canvas-node id="red" color="#ff0000"></canvas-node>
```

### Blend Node
Combine two textures.

```html
<blend-node id="composite" 
            mode="add" 
            opacity="0.8"
            connects-base="background"
            connects-blend="foreground">
</blend-node>
```

**Blend modes:** `normal`, `add`, `multiply`, `screen`, `overlay`

### Feedback Node
Create feedback/ping-pong effects.

```html
<feedback-node id="trails" uniforms='{"decay": 0.98}'>
  #version 300 es
  precision highp float;
  uniform sampler2D glPrevious;
  uniform float decay;
  in vec2 glUV;
  out vec4 fragColor;
  void main() {
    fragColor = texture(glPrevious, glUV) * decay;
  }
</feedback-node>
```

### Particles Node
Built-in particle system.

```html
<particles-node id="particles"
                count="5000"
                size="0.01"
                gravity="0.001"
                damping="0.98">
</particles-node>
```

## Connecting Nodes

### Method 1: Shorthand Attributes

```html
<!-- Simple connection -->
<shader-node id="effect" connects-to="source">...</shader-node>

<!-- Blend connections -->
<blend-node connects-base="bg" connects-blend="fg"></blend-node>
```

### Method 2: Explicit Input Elements

```html
<shader-node id="complex">
  <input-connection name="texture1" from="source1"></input-connection>
  <input-connection name="texture2" from="source2" output="0"></input-connection>
  
  #version 300 es
  precision highp float;
  uniform sampler2D texture1;
  uniform sampler2D texture2;
  in vec2 glUV;
  out vec4 fragColor;
  void main() {
    vec4 t1 = texture(texture1, glUV);
    vec4 t2 = texture(texture2, glUV);
    fragColor = mix(t1, t2, 0.5);
  }
</shader-node>
```

## Real-Time Updates

### Update Uniforms

```javascript
// Get canvas reference
const canvas = document.querySelector('minigl-canvas');

// Update node uniform
canvas.updateNodeUniform('myNode', 'amount', 0.5);

// Or via node reference
const node = document.querySelector('#myNode');
node.updateUniform('amount', 0.5);
```

### Update Node Properties

```javascript
const blendNode = document.querySelector('#blend');
blendNode.mode = 'multiply';
blendNode.opacity = 0.6;

// Refresh graph to apply changes
canvas.refreshGraph();
```

## Complete Examples

### Image Processing Pipeline

```html
<minigl-canvas output="final">
  <!-- Load source image -->
  <image-node id="source" src="photo.jpg"></image-node>
  
  <!-- Apply blur effect -->
  <shader-node id="blur" connects-to="source">
    #version 300 es
    precision highp float;
    uniform sampler2D glTexture;
    uniform vec2 glPixel;
    in vec2 glUV;
    out vec4 fragColor;
    void main() {
      vec4 color = vec4(0.0);
      for(int x = -2; x <= 2; x++) {
        for(int y = -2; y <= 2; y++) {
          vec2 offset = vec2(x, y) * glPixel;
          color += texture(glTexture, glUV + offset);
        }
      }
      fragColor = color / 25.0;
    }
  </shader-node>
  
  <!-- Blend original with blur -->
  <blend-node id="final" 
              mode="screen" 
              opacity="0.7"
              connects-base="source"
              connects-blend="blur">
  </blend-node>
</minigl-canvas>
```

### Multi-Stage Effect

```html
<minigl-canvas output="composite">
  <!-- Generate noise -->
  <shader-node id="noise">
    #version 300 es
    precision highp float;
    uniform float glTime;
    in vec2 glCoord;
    out vec4 fragColor;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    void main() {
      vec2 st = glCoord + glTime * 0.01;
      float n = random(st);
      fragColor = vec4(vec3(n), 1.0);
    }
  </shader-node>
  
  <!-- Create colored shapes -->
  <shader-node id="shapes">
    #version 300 es
    precision highp float;
    uniform float glTime;
    in vec2 glCoord;
    out vec4 fragColor;
    void main() {
      vec2 center = vec2(0.5 + 0.2 * sin(glTime * 0.01), 0.5);
      float dist = length(glCoord - center);
      float circle = smoothstep(0.3, 0.25, dist);
      fragColor = vec4(circle, 0.0, 1.0 - circle, circle);
    }
  </shader-node>
  
  <!-- Combine with different blend modes -->
  <blend-node id="composite"
              mode="multiply"
              connects-base="noise"
              connects-blend="shapes">
  </blend-node>
</minigl-canvas>
```

### Interactive Particles

```html
<minigl-canvas output="particles">
  <particles-node id="particles" 
                  count="8000" 
                  size="0.005"
                  gravity="0.0005"
                  damping="0.99">
  </particles-node>
</minigl-canvas>

<script>
// Interactive controls
const particleControls = {
  count: document.querySelector('#particleCount'),
  size: document.querySelector('#particleSize'),
  gravity: document.querySelector('#particleGravity')
};

Object.entries(particleControls).forEach(([prop, input]) => {
  input?.addEventListener('input', (e) => {
    const particles = document.querySelector('#particles');
    particles[prop] = parseFloat(e.target.value);
    particles.getCanvas().refreshGraph();
  });
});
</script>
```

## Advanced Features

### Custom Draw Functions

```javascript
// Define global draw function
window.myDrawFunction = function(ctx, width, height) {
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(width/2, height/2, 50, 0, Math.PI * 2);
  ctx.fill();
};

// Use in canvas node
// <canvas-node draw-function="myDrawFunction"></canvas-node>
```

### Programmatic Node Creation

```javascript
// Create nodes programmatically
const canvas = document.querySelector('minigl-canvas');
const shader = document.createElement('shader-node');
shader.id = 'dynamic';
shader.fragment = `
  #version 300 es
  precision highp float;
  out vec4 fragColor;
  void main() { fragColor = vec4(1.0, 0.0, 1.0, 1.0); }
`;

canvas.appendChild(shader);
canvas.refreshGraph();
```

### Error Handling

```javascript
document.addEventListener('minigl-error', (e) => {
  console.error('WebGL Error:', e.detail);
  // Handle WebGL initialization failures
});

document.addEventListener('minigl-node-error', (e) => {
  console.error('Node Error:', e.detail);
  // Handle individual node creation failures
});
```

## Built-in Uniforms

All shader nodes automatically receive these uniforms:

- `glResolution` - `{x, y}`: canvas size
- `glTime` - `float`: frame count
- `glMouse` - `{x, y, z}`: mouse position (0-1) + click state
- `glVelocity` - `{x, y}`: mouse velocity
- `glPixel` - `{x, y}`: 1/width, 1/height
- `glRatio` - `float`: aspect ratio
- `glPrevious` - `texture`: previous frame (feedback nodes only)
- `glCoord` - aspect-ratio corrected coordinates
- `glUV` - raw texture coordinates

## Browser Support

- Chrome 56+
- Firefox 51+
- Safari 15+
- Edge 79+

Requires WebGL2 support.

## Performance Tips

1. **Minimize graph changes** - Avoid frequent `refreshGraph()` calls
2. **Use appropriate texture sizes** - Smaller textures for intermediate steps
3. **Optimize shaders** - Complex shaders can be the bottleneck
4. **Batch uniform updates** - Update multiple uniforms before refreshing

## Debugging

Use the `debug` attribute on `minigl-canvas` to see:
- Node count
- Current frame
- Resolution
- Performance info

```html
<minigl-canvas debug>
  <!-- Debug overlay will show -->
</minigl-canvas>
```

---

Made w/ love for Shopify, 2025 