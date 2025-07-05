# miniGLx - React Hook for miniGL

A React hook wrapper for miniGL that provides seamless integration with React's lifecycle while preserving miniGL's optimized rendering and graph management.

## Battle Plan Progress

### ✅ Phase 1: Basic Hook Structure
- [x] Hook creates miniGL instance on mount
- [x] Hook accepts ref and setup callback  
- [x] Hook handles cleanup on unmount
- [x] Basic example works (`example-basic.jsx`)

### ✅ Phase 2: Smart Dependency Management
- [x] Dependency array triggers selective rebuilds
- [x] Preserve existing nodes when possible
- [x] Leverage miniGL's topological sorting
- [x] Test with changing uniforms vs changing graph structure (`example-dependencies.jsx`)

### ✅ Phase 3: Node Reference System & Reusability
- [x] Setup callback can return node references
- [x] References allow `updateUniform()` calls
- [x] References work with miniGL's internal RAF loop
- [x] Test performance with high-frequency updates
- [x] Reusable effect composition (`example-reusable.jsx`)

### 🚧 Phase 4: Advanced Features (TODO)
- [ ] Image/video loading nodes work
- [ ] Particle systems work  
- [ ] MiniNode factory pattern works
- [ ] Custom chunks integration works

### 📋 Phase 5: Testing & Examples (TODO)
- [ ] Performance stress test
- [ ] Memory leak testing
- [ ] Production examples

## Quick Start

```jsx
import React, { useRef } from 'react';
import { useMiniGL } from './miniGLx';

function MyShaderComponent() {
  const canvasRef = useRef();
  
  const { gl, nodeRefs, isReady } = useMiniGL(canvasRef, (gl) => {
    // Create shader nodes
    const noise = gl.shader(fragmentShader, { frequency: 10.0 });
    gl.output(noise);
    
    // Return references for runtime updates
    return { noise };
  }, []); // Dependencies trigger rebuilds

  return <div ref={canvasRef} style={{ width: '100%', height: '400px' }} />;
}
```

## Key Features

### 🎯 **Separation of Setup vs Runtime**
- **Setup** (declarative): Graph structure changes trigger React re-renders
- **Runtime** (imperative): High-frequency uniform updates happen outside React

### 🔄 **Smart Rebuilding**
- Leverages miniGL's existing `_graphDirty` optimization
- Only rebuilds when dependencies actually change
- Preserves WebGL context and resources when possible

### 🧩 **Reusable Effects**
```jsx
// Create reusable shader effects
const createBlurEffect = createShaderEffect((gl, { intensity }) => {
  return gl.shader(blurShader, { uIntensity: intensity });
});

// Use in multiple components
const blur = createBlurEffect(gl, { intensity: 0.5 });
```

### ⚡ **Performance Optimized**
- miniGL handles its own RAF loop (60fps default)
- React only re-renders on structural changes
- Node references enable direct uniform updates

## API Reference

### `useMiniGL(canvasRef, setupCallback, deps, options)`

- **canvasRef**: React ref to target DOM element
- **setupCallback**: `(gl) => nodeRefs` - Sets up the shader graph
- **deps**: Dependency array for rebuilds
- **options**: miniGL options (fps, contextOptions, etc.)

Returns: `{ gl, nodeRefs, isReady }`

### `createShaderEffect(setupFn)`

Creates a reusable shader effect function.

### `createNodeRefs(nodeMap)`

Helper to create stable node references with `updateUniform()` methods.

## Examples

- `BasicExample` - Simple shader setup
- `DependenciesExample` - Dependency management testing
- `ReusableExample` - Composable effects

## Design Principles

1. **Keep RAF inside miniGL** - Let miniGL handle its optimized rendering loop
2. **Avoid React naming conflicts** - Don't use `useSomething` for non-hooks
3. **Leverage existing optimization** - Use miniGL's graph management and topological sorting
4. **Separate concerns** - Setup is React's domain, rendering is miniGL's domain

## Performance Notes

- Dependency changes rebuild the entire graph (by design)
- For runtime updates, use node references, not React state
- miniGL's internal RAF is isolated from React's render cycle
- Graph rebuilds are optimized through miniGL's existing systems

## Getting Started

### Running the Test App

A React test app is included to demonstrate the hook in action:

```bash
# Option 1: Use the run script (recommended)
chmod +x run.sh
./run.sh

# Option 2: Manual setup
npm install
npm run dev
```

The app will start at `http://localhost:3000` and includes:
- **Phase 1 Example**: Basic shader setup and rendering
- **Phase 2 Example**: Dependency management testing
- **Battle Plan Progress**: Visual status of implementation phases

### Files Structure

```
lib/miniGLx/
├── useMiniGL.js          # Main hook implementation
├── index.js              # Export definitions
├── example-*.jsx         # Standalone examples
├── src/                  # React test app
│   ├── App.jsx           # Main test application
│   ├── BasicExample.jsx  # Phase 1 tests
│   └── DependenciesExample.jsx  # Phase 2 tests
├── package.json          # React dependencies
├── vite.config.js        # Vite bundler config
└── index.html            # App entry point
``` 