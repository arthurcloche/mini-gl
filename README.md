# miniGL

Minimal node-based WebGL2 creative coding engine. Compose fragment shaders, feedback, blend, image/video/canvas textures, and more with a simple, chainable API. Inspired by ShaderToy, but without the WebGL boilerplate.

## Features
- Node-based: connect shader, feedback, blend, texture, MRT, and more
- Topological sort: stable, efficient updates
- Feedback and ping-pong for GPGPU/iterative effects
- Minimal, modern API
- **Optional**: Shader snippet system (see below)

## Install
Just drop `miniGL.js` and (optionally) `miniChunks.js` in your project. No build step needed.

## Usage
```js
import miniGL from './miniGL.js';
const gl = new miniGL('canvas');

// (Optional) Enable shader snippets:
import miniChunks from './miniChunks.js';
gl.useChunks(miniChunks); // enables <#tag> support in shaders
```

## Uniforms
Uniforms are values passed to shaders. You can set them at node creation or update them dynamically.

### How to use
- Pass a `uniforms` object in the node options:
  ```js
  const node = gl.shader(fragmentShader, { uniforms: { uTime: 0, uAmount: 1.0 } });
  ```
- Update a uniform at runtime:
  ```js
  node.updateUniform('uAmount', 0.5);
  ```
- Uniforms can be numbers, booleans, arrays, `{x, y, z, w}` objects, or `{ texture }` objects.

### Built-in Uniforms (auto-injected)
- `glUV` — `{x, y}`: raw texture coordinates
- `glCoord` — `{x, y}`: normalized texture coordinates
- `glResolution` — `{x, y}`: canvas size in pixels
- `glTime` — `float`: frame count (or time, depending on usage)
- `glMouse` — `{x, y, z}`: mouse position (0-1), z=1 if mouse down
- `glVelocity` — `{x, y}`: mouse velocity
- `glPixel` — `{x, y}`: 1/width, 1/height
- `glRatio` — `float`: aspect ratio
- `glPrevious` — `{ texture }`: previous frame (for feedback nodes only !)

## Node Types & Examples

### 1. Shader Node
**Description:** Runs a custom fragment shader and outputs a texture.
**Options:**
```js
{
  uniforms: { ... }, // uniforms for the shader
  vertexShader: '...', // optional custom vertex shader
  width: 512, // optional, default: canvas width
  height: 512, // optional, default: canvas height
  filter: 'LINEAR' | 'NEAREST',
  wrap: 'CLAMP_TO_EDGE' | 'REPEAT',
  mipmap: true | false,
  format: 'FLOAT' | 'UNSIGNED_BYTE',
  name: 'MyShader',
}
```
**Template:**
```js
const node = gl.shader(fragmentShader, { uniforms: { uTime: 0 } });
```
**Example:**
```js
const shaderNode = gl.shader(`
  #version 300 es
  precision highp float;
  uniform float uTime;
  in vec2 glCoord;
  out vec4 fragColor;
  void main() {
    float d = length(glCoord - 0.5);
    fragColor = vec4(vec3(d < 0.25 + 0.1 * sin(uTime)), 1.0);
  }
`, { uniforms: { uTime: 0 } });
gl.output(shaderNode);
```

### 2. Pingpong (Feedback) Node
**Description:** Runs a fragment shader with feedback from the previous frame (for trails, fluid, etc).
**Options:**
```js
{
  uniforms: { ... },
  width, height, filter, wrap, mipmap, format, name // same as shader
}
```
**Template:**
```js
const node = gl.pingpong(fragmentShader, { uniforms: { ... } });
```
**Example:**
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
`, { uniforms: { uAlpha: 0.99 } });
gl.output(feedback);
```

### 3. Blend Node
**Description:** Blends two textures using a blend mode and opacity.
**Options:**
```js
{
  blendMode: 'add' | 'multiply' | 'screen' | ...,
  opacity: 1.0, // blend layer opacity
  uniforms: { ... },
  width, height, filter, wrap, mipmap, format, name
}
```
**Template:**
```js
const node = gl.blend({ blendMode: 'add', opacity: 1.0 });
```
**Example:**
```js
const a = gl.shader(...); // any node
const b = gl.shader(...);
const blend = gl.blend({ blendMode: 'add', opacity: 1.0 });
gl.connect(a, blend, 'glBase');
gl.connect(b, blend, 'glBlend');
gl.output(blend);
```

### 4. Image Node
**Description:** Loads an image as a texture.
**Options:**
```js
{
  url: 'img.jpg',
  width, height, filter, wrap, mipmap, name
}
```
**Template:**
```js
const node = gl.image('img.jpg', { width: 256, height: 256 });
```
**Example:**
```js
const img = gl.image('myimg.jpg');
gl.output(img);
```

### 5. Video Node
**Description:** Loads a video as a texture (auto-plays, loops, muted).
**Options:**
```js
{
  url: 'vid.mp4',
  width, height, filter, wrap, mipmap, name
}
```
**Template:**
```js
const node = gl.video('myvid.mp4', { width: 256, height: 256 });
```
**Example:**
```js
const vid = gl.video('myvid.mp4');
gl.output(vid);
```

### 6. Canvas Node
**Description:** Uses a 2D canvas as a texture, updated by a draw callback.
**Options:**
```js
{
  drawCallback: (ctx, w, h) => { ... },
  width, height, filter, wrap, mipmap, name
}
```
**Template:**
```js
const node = gl.canvas((ctx, w, h) => { ... }, { width: 256, height: 256 });
```
**Example:**
```js
const canvasNode = gl.canvas((ctx, w, h) => {
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(w/2, h/2, Math.min(w,h)/4, 0, 2*Math.PI);
  ctx.fill();
});
gl.output(canvasNode);
```

### 7. MRT (Multi-Render Target) Node
**Description:** Runs a shader that outputs to multiple textures in one pass.
**Options:**
```js
{
  fragmentShader: '...',
  numTargets: 2-4,
  uniforms: { ... },
  width, height, filter, wrap, mipmap, format, name
}
```
**Template:**
```js
const node = gl.mrt(fragmentShader, { numTargets: 3, uniforms: { ... } });
```
**Example:**
```js
const mrtShader = `#version 300 es
precision highp float;
uniform float uMix;
in vec2 glCoord;
layout(location = 0) out vec4 outR;
layout(location = 1) out vec4 outG;
layout(location = 2) out vec4 outB;
void main() {
  float d = length(glCoord - 0.5);
  float c = step(d, 0.25 + 0.1 * uMix);
  outR = vec4(c,0,0,1);
  outG = vec4(0,c,0,1);
  outB = vec4(0,0,c,1);
}`;
const mrt = gl.mrt(mrtShader, { numTargets: 3, uniforms: { uMix: 0 } });
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

### 8. Group Node (Subgraph)
**Description:** Build a subgraph with the same API as miniGL, for custom multi-pass effects.
**Options:**
```js
{
  width, height, name // (optional)
}
```
**Template:**
```js
const group = gl.group();
const a = group.shader(...);
const b = group.shader(...);
group.connect(a, b, 'uInput');
group.output(b);
gl.output(group);
```
**Example:**
```js
const group = gl.group();
const a = group.shader(...);
const b = group.shader(...);
group.connect(a, b, 'uInput');
group.output(b);
gl.output(group);
```

**Note:** Only `shader`, `pingpong`, and `mrt` nodes support `.updateUniform(key, value)`.

## How miniGL Works (Node Graph Example)

```
[Image]   [Canvas]   [Video]
    \         |         /
     \        |        /
      [Blend/Shader/Group]   [Noise]
                |         /
             [Blend/Shader]
                  |
              [Output]
```
- Each [Node] is a processing step (shader, blend, feedback, etc)
- You connect nodes with `gl.connect(a, b, 'inputName')`
- The graph is topo-sorted and only reachable nodes are processed
- Feedback nodes (pingpong) can create cycles for effects

## Shader Snippets (Optional)
- To use `<#category.name>` tags in your GLSL, you **must** call `gl.useChunks(miniChunks)` with your chunk library.
- If you never call `useChunks`, `<#tags>` are ignored and shaders are not preprocessed (zero overhead).

## Connecting Nodes
```js
gl.connect(sourceNode, targetNode, inputName, outputName = 'default');
// Example:
gl.connect(noiseNode, colorNode, 'uNoise');
```

## Output
```js
gl.output(node); // Set the final node to render to screen
```

## Blend Modes
- `add`, `multiply`, `screen`, `overlay`, `normal`, etc. (see your chunk lib for all)

## Minimal Test Suite
- See `test/graph.test.js` for dry graph logic tests (no rendering, just node plumbing).

## Performance
- Each node = 1 framebuffer/render pass (except MRT, which does N outputs in 1 pass)
- Modern browsers easily handle 10–30 nodes at 1080p, more at lower res or with simple shaders
- Bottleneck: VRAM, shader complexity, and framebuffer switches
- For creative coding/interactive art, you'll hit UI/CPU limits before GPU limits in most cases

---
MIT License

Made w/ love for Shopify, 2025