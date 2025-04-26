# miniGL Documentation

## Quickstart
```js
import miniGL from './miniGL.js';
const gl = new miniGL('canvas');
const node = gl.shader(fragmentShader, { uniforms: { ... } });
gl.output(node);
function animate() { gl.render(); requestAnimationFrame(animate); }
animate();
```

## Node Types
- `shader(fragmentShader, options)` — Custom fragment shader node
- `pingpong(fragmentShader, options)` — Feedback node (ping-pong)
- `blend({ blendMode, opacity, ... })` — Blend two textures
- `image(url, options)` — Image texture node
- `video(url, options)` — Video texture node
- `canvas(drawCallback, options)` — Canvas 2D texture node
- `mrt(fragmentShader, { numTargets, ... })` — Multi-render target node (up to 4 outputs)

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
- `add`, `multiply`, `screen`, `overlay`, `normal`, etc. (see shaderLib.js for all)

## MRT Example
```js
const mrtShader = `#version 300 es
precision highp float;
in vec2 glCoord;
layout(location = 0) out vec4 outR;
layout(location = 1) out vec4 outG;
layout(location = 2) out vec4 outB;
void main() {
  float d = length(glCoord - 0.5);
  float circle = smoothstep(0.25, 0.24, d);
  outR = vec4(1,0,0,1) * circle;
  outG = vec4(0,1,0,1) * circle;
  outB = vec4(0,0,1,1) * circle;
}`;
const mrtNode = gl.mrt(mrtShader, { numTargets: 3 });
const sumShader = `#version 300 es
precision highp float;
uniform sampler2D texR, texG, texB;
in vec2 glCoord;
out vec4 fragColor;
void main() {
  fragColor = texture(texR, glCoord) + texture(texG, glCoord) + texture(texB, glCoord);
}`;
const sumNode = gl.shader(sumShader);
gl.connect(mrtNode, sumNode, 'texR', '0');
gl.connect(mrtNode, sumNode, 'texG', '1');
gl.connect(mrtNode, sumNode, 'texB', '2');
gl.output(sumNode);
```

## Shader Snippets
Use `<#category.name>` in your GLSL to include code from `shaderLib.js`.

## Uniforms
- Numbers, booleans, arrays, `{x, y, z, w}` objects, and `{ texture }` objects are supported.

## Advanced
- `ignoreIntersection()` — disables intersection observer
- `ignoreResize()` — disables resize observer

## Minimal Test Suite (suggestion)
- Use [puppeteer](https://github.com/puppeteer/puppeteer) or [playwright](https://playwright.dev/) to launch a headless browser
- Render a known shader, read back pixels with `gl.readPixels`, and compare to expected output (e.g. white circle test)
- Test node graph construction, feedback, blend, MRT, and error handling

## Performance
- Each node = 1 framebuffer/render pass (except MRT, which does N outputs in 1 pass)
- Modern browsers easily handle 10–30 nodes at 1080p, more at lower res or with simple shaders
- Bottleneck: VRAM, shader complexity, and framebuffer switches
- For creative coding/interactive art, you'll hit UI/CPU limits before GPU limits in most cases

---
For more, see the examples and source code. 