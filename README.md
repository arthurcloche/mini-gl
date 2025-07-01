![minigl](https://github.com/user-attachments/assets/f064614c-3aac-4d3d-a3da-e1e40c1212c6)
# miniGL
> "Why does drawing a circle in WebGL take 300 lines or a 2MB library?"  
> miniGL: Minimal node-based WebGL2 creative coding engine. Compose fragment shaders, feedback, blend, image/video/canvas textures, particles, and more with a simple, chainable API.  
> No build step. No bloat. No tears.

---

## What's This All About?

miniGL was born out of pure frustration at how hard it is to just run a fragment shader on a canvas. If you want to make a feedback loop, blend a video and an image, or just play with pixels, you shouldn't have to learn Three.js, set up a build system, or write 200 lines of boilerplate.  
miniGL is a node graph for WebGL2, inspired by ShaderToy, but with a modern, minimal, and fun API.

---

## How It All Connects (The Node Graph)

Here's the big idea: you build a graph of nodes, each one does a thing (shader, blend, feedback, particles, whatever), and you connect them up.  
No more spaghetti code. No more "wait, which framebuffer is this?"

```
[Image]   [Canvas2D]   [Video]   [Particles]
    \         |           /         |
     \        |          /          |
      [Blend/Shader/MiniNode]   [Noise]
                |                  /
             [Shader/Feedback]
                  |
              [Output]
```
- Each [Node] is a processing step (shader, blend, feedback, particles, etc)
- You connect nodes with `gl.connect(sourceNode, targetNode, 'inputName')`
- The graph is automatically topo-sorted and only reachable nodes are processed
- Feedback nodes (pingpong) can create cycles for effects
- MiniNodes let you encapsulate complex multi-node effects into reusable components

---

## Install
Just drop `miniGL.js` and (optionally) `miniChunks.js` in your project. No build step needed.

---

## Usage
```js
import miniGL from './miniGL.js';
const gl = new miniGL('canvas');

// (Optional) Enable shader snippets:
import miniChunks from './miniChunks.js';
gl.useChunks(miniChunks); // enables <#tag> support in shaders
```

---

## Uniforms
Uniforms are values you pass to shaders. Set them when you make a node, or update them later. They can be numbers, booleans, arrays, `{x, y, z, w}` objects, or `{ texture }` objects.

```js
const node = gl.shader(fragmentShader, { uTime: 0, uAmount: 1.0 });
node.updateUniform('uAmount', 0.5);
```

### Built-in Uniforms (auto-injected)
- `glResolution` — `{x, y}`: canvas size in pixels
- `glTime` — `float`: frame count (or time, depending on usage)
- `glMouse` — `{x, y, z}`: mouse position (0-1), z=1 if mouse down
- `glVelocity` — `{x, y}`: mouse velocity
- `glPixel` — `{x, y}`: 1/width, 1/height
- `glRatio` — `float`: aspect ratio
- `glPrevious` — `{ texture }`: previous frame (for feedback nodes)
- `glCoord` — aspect-ratio corrected coordinates (use for round shapes)
- `glUV` — raw texture coordinates (use for texture lookups)

---

## Node Types (What Can I Plug In?)

### Shader Node
Run a custom fragment shader and get a texture out. Give it your GLSL, get pixels. You can set uniforms, size, filtering, etc.

```js
const node = gl.shader(`
  #version 300 es
  precision highp float;
  uniform float uTime;
  in vec2 glCoord;
  out vec4 fragColor;
  void main() {
    float d = length(glCoord - 0.5);
    fragColor = vec4(vec3(d < 0.25 + 0.1 * sin(uTime)), 1.0);
  }
`, { uTime: 0 });
gl.output(node);
```

### Pingpong (Feedback) Node
Want trails, fluid, or feedback? This node gives your shader the previous frame as a texture. Just use `glPrevious` in your shader.

```js
const feedback = gl.pingpong(`
  #version 300 es
  precision highp float;
  uniform float uAlpha;
  uniform sampler2D glPrevious;
  in vec2 glCoord;
  out vec4 fragColor;
  void main() {
    fragColor = texture(glPrevious, glCoord) * uAlpha;
  }
`, { uAlpha: 0.99 });
gl.output(feedback);
```

### Blend Node
Blend two textures together. Pick a blend mode (`add`, `multiply`, `screen`, `overlay`, `normal`) and an opacity. Connect your base and blend nodes.

```js
const a = gl.shader(...);
const b = gl.shader(...);
const blend = gl.blend({ blendMode: 'add', opacity: 1.0 });
gl.connect(a, blend, 'glBase');
gl.connect(b, blend, 'glBlend');
gl.output(blend);
```

### Image Node
Load an image as a texture. Supports different fitting modes.

```js
const img = gl.image('myimg.jpg', { fitting: 'cover' });
gl.output(img);
```

### Video Node
Load a video as a texture. Auto-plays, loops, muted. No drama.

```js
const vid = gl.video('myvid.mp4');
gl.output(vid);
```

### Canvas2D Node
Use a 2D canvas as a texture, updated by your draw callback.

```js
const canvasNode = gl.canvas2D((ctx, w, h) => {
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(w/2, h/2, Math.min(w,h)/4, 0, 2*Math.PI);
  ctx.fill();
});
gl.output(canvasNode);
```

### MRT (Multi-Render Target) Node
Run a shader that spits out multiple textures in one pass. Useful for GPGPU or fancy effects.

```js
const mrtShader = `#version 300 es
precision highp float;
in vec2 glCoord;
layout(location = 0) out vec4 outR;
layout(location = 1) out vec4 outG;
layout(location = 2) out vec4 outB;
void main() {
  float d = length(glCoord - 0.5);
  float c = step(d, 0.25);
  outR = vec4(c,0,0,1);
  outG = vec4(0,c,0,1);
  outB = vec4(0,0,c,1);
}`;
const mrt = gl.mrt(mrtShader, { numTargets: 3 });
const sum = gl.shader(`
  #version 300 es
  precision highp float;
  uniform sampler2D texR, texG, texB;
  in vec2 glCoord;
  out vec4 fragColor;
  void main() {
    fragColor = texture(texR, glCoord) + texture(texG, glCoord) + texture(texB, glCoord);
  }
`);
gl.connect(mrt, sum, 'texR', '0');
gl.connect(mrt, sum, 'texG', '1');
gl.connect(mrt, sum, 'texB', '2');
gl.output(sum);
```

### Particles Node
Create instanced particle systems with built-in simulation or connect your own.

```js
const particles = gl.particles({ 
  count: 10000, 
  size: 0.01,
  gravity: 0.001,
  damping: 0.98
});
gl.output(particles);

// Or with custom rendering:
const customParticles = particles.particle(`
  #version 300 es
  precision highp float;
  in vec2 particleUV;
  in vec4 particleColor;
  out vec4 fragColor;
  void main() {
    float dist = length(particleUV - 0.5);
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    fragColor = vec4(particleColor.rgb, alpha);
  }
`, { customUniform: 1.0 });
```

### MiniNode (Complex Multi-Node Effects)
Wrap multiple nodes into a single reusable component with custom input/uniform routing.

```js
// Create a complex effect internally
const blur1 = gl.shader(blurShader, { amount: 2.0 });
const blur2 = gl.shader(blurShader, { amount: 4.0 });
gl.connect(blur1, blur2, 'glTexture');

// Wrap it in a MiniNode
const doubleBlur = new MiniNode(gl, blur2, { 
  internalNodes: [blur1, blur2],
  name: 'DoubleBlur'
});

// Configure external interface
doubleBlur
  .input('texture', blur1, 'glTexture')  // Route external 'texture' input to blur1
  .uniform('amount', blur1, 'amount')    // Route external 'amount' uniform to blur1
  .uniform('strength', blur2, 'amount'); // Route external 'strength' uniform to blur2

// Use it like any other node
const source = gl.image('photo.jpg');
gl.connect(source, doubleBlur, 'texture');
doubleBlur.updateUniform('amount', 3.0);
gl.output(doubleBlur);
```

---

## Connecting Nodes
```js
gl.connect(sourceNode, targetNode, inputName, outputName = 'default');
// Example:
gl.connect(noiseNode, colorNode, 'uNoise');

// Or use the node's connect method directly:
colorNode.connect('uNoise', noiseNode);
```

## Output
```js
gl.output(node); // Set the final node to render to screen
```

## Blend Modes
Built-in blend modes: `normal`, `add`, `multiply`, `screen`, `overlay`

---

## MiniNode: Building Complex Reusable Effects

MiniNode lets you encapsulate complex multi-node effects into a single, reusable component. Think of it as creating your own custom node type.

### Basic MiniNode Creation
```js
// Create internal node graph
const step1 = gl.shader(shader1, uniforms1);
const step2 = gl.shader(shader2, uniforms2);
const step3 = gl.blend({ blendMode: 'add' });

// Connect internal nodes
gl.connect(step1, step2, 'input');
gl.connect(step2, step3, 'glBase');

// Wrap in MiniNode (step3 is the output)
const myEffect = new MiniNode(gl, step3, {
  internalNodes: [step1, step2, step3],
  name: 'MyCustomEffect'
});
```

### Input and Uniform Routing
```js
// Route external inputs to specific internal nodes
myEffect
  .input('mainTexture', step1, 'glTexture')   // External 'mainTexture' → step1's 'glTexture'
  .input('blendTexture', step3, 'glBlend')    // External 'blendTexture' → step3's 'glBlend'
  .uniform('intensity', step1, 'amount')      // External 'intensity' → step1's 'amount'
  .uniform('opacity', step3, 'opacity');      // External 'opacity' → step3's 'opacity'

// Use the MiniNode like any other node
const source = gl.image('texture.jpg');
const overlay = gl.video('overlay.mp4');

gl.connect(source, myEffect, 'mainTexture');
gl.connect(overlay, myEffect, 'blendTexture');
myEffect.updateUniform('intensity', 0.8);
myEffect.updateUniform('opacity', 0.6);

gl.output(myEffect);
```

### Event Handlers and Custom Logic
```js
myEffect
  .onConnect((inputName, sourceNode) => {
    console.log(`Connected ${sourceNode.name} to ${inputName}`);
  })
  .onUniform((key, value) => {
    console.log(`Updated uniform ${key} to ${value}`);
  })
  .helper('fade', function(amount) {
    this.updateUniform('opacity', amount);
    return this;
  });

// Use custom helper
myEffect.fade(0.5);
```

---

## Shader Snippets (Optional)
Want to use `<#category.name>` tags in your GLSL? Call `gl.useChunks(miniChunks)` with your chunk library. If you don't, `<#tags>` are ignored and shaders are not preprocessed (zero overhead).

---

## Performance
- Each node = 1 framebuffer/render pass (except MRT, which does N outputs in 1 pass)
- Modern browsers easily handle 10–30 nodes at 1080p, more at lower res or with simple shaders
- Bottleneck: VRAM, shader complexity, and framebuffer switches
- For creative coding/interactive art, you'll hit UI/CPU limits before GPU limits in most cases

---

## Coordinates: glCoord vs glUV
- `glCoord` is aspect-ratio corrected. Use for geometry, round shapes, SDFs, etc.
- `glUV` is raw texture coordinates. Use for texture lookups, sampling, etc.

---

## Target Flexibility

miniGL can work with various HTML elements:

```js
// Canvas element
const gl = new miniGL('canvas');

// Any div/container
const gl = new miniGL('#container');

// Replace an image with interactive content
const gl = new miniGL('img'); // Automatically loads the image as a texture

// Replace a video with processed version
const gl = new miniGL('video'); // Automatically loads the video as a texture

// Fullscreen (no target)
const gl = new miniGL(); // Creates fullscreen overlay
```

---

MIT License

Made w/ love for Shopify, 2025
