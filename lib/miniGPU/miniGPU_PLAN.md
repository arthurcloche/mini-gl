# miniGPU WebGPU Port Plan

## Why WebGPU? What does it enable for node graphs?
- Modern API, closer to Vulkan/Metal/DX12
- Async & multi-threaded, command buffers
- Compute shaders for GPGPU/feedback
- Explicit resource management
- MRT, robust error handling
- Future-proof

## Node Graph Benefits
- Compute-only or hybrid nodes
- Parallel/batched node execution
- Flexible data flow (storage buffers, bind groups)
- Easier feedback/ping-pong

---

## Step-by-step Plan (Checklist)

- [x] **Step 1:** Boilerplate & Device Setup *(miniGPU skeleton and async device setup done)*
- [x] **Step 2:** Node Base Class (abstract over WebGPU resources) *(Node base class with graph logic implemented)*
- [x] **Step 3:** Port Node Types (TextureNode, ShaderNode, FeedbackNode, MRTNode, Image/Video/Canvas Nodes) *(TextureNode, ShaderNode, FeedbackNode, MRTNode structure implemented)*
- [x] **Step 4:** Shader Conversion (GLSL → WGSL) *(Basic WGSL shaders implemented)*
- [x] **Step 5:** Graph Traversal & Command Submission *(Graph traversal, command submission, and output-to-screen implemented)*
- [x] **Step 6:** Output to Screen *(Working output pipeline for presenting to canvas)*
- [x] **Step 7:** Uniforms & Bind Groups *(Simple uniform/bind group handling implemented)*
- [ ] **Step 8:** Utility & Factory Methods *(More convenience methods needed)*
- [ ] **Step 9:** Event Handling & Resize *(Basic resize support implemented, needs more robust handling)*
- [ ] **Step 10:** Testing & Debugging *(Basic example created, more testing needed)*

---

## What will change/improve?
- Performance, flexibility, parallelism, shader power, resource management

## What stays the same?
- Node graph API, logic, encapsulation

## What will be harder?
- WGSL conversion, more boilerplate, async setup

## Advanced Ideas
- Compute nodes, dynamic graph execution, GPU-driven UI, timeline semaphores (future)

---

## Usage Instructions

### Basic Setup

```javascript
import miniGPU from './miniGPU.js';

// Create a new miniGPU instance with a canvas ID
const gpu = new miniGPU('canvas');

// Wait for WebGPU initialization (it's asynchronous)
setTimeout(async () => {
  if (!gpu.device) {
    console.error('WebGPU not supported or initialization failed');
    return;
  }
  
  // Create nodes and build your graph
  // ...
  
  // Start rendering
  gpu.start();
}, 100);
```

### Creating and Connecting Nodes

```javascript
// Create shader nodes
const shaderNode = gpu.shader(`
  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 3>(
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(3.0, -1.0),
      vec2<f32>(-1.0, 3.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  }
  
  @fragment
  fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0); // Red color
  }
`);

// Create image node
const imageNode = gpu.image('myImage.jpg');

// Create a blend node
const blendNode = gpu.blend({ blendMode: 'screen', opacity: 0.8 });

// Connect nodes
gpu.connect(shaderNode, blendNode, 'baseTexture');
gpu.connect(imageNode, blendNode, 'blendTexture');

// Set final output
gpu.output(blendNode);
```

### Node Types

1. **ShaderNode**: `gpu.shader(code, options)`
2. **FeedbackNode**: `gpu.pingpong(code, options)`
3. **ImageNode**: `gpu.image(url, options)`
4. **VideoNode**: `gpu.video(url, options)`
5. **BlendNode**: `gpu.blend(options)` - with blendMode: 'normal', 'multiply', 'screen', 'add', 'overlay'
6. **MRTNode**: `gpu.mrt(code, options)` - for multi-render targets
7. **ConstantColorNode**: `gpu.color({ r, g, b, a }, options)`

### WGSL Shader Format

WebGPU uses WGSL (WebGPU Shading Language) instead of GLSL. Example:

```wgsl
@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
}

@fragment
fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy / uniforms.resolution;
  return vec4<f32>(uv.x, uv.y, 0.0, 1.0);
}
```

**Progress will be tracked by checking off steps above as they are completed.** 