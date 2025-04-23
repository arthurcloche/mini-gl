# miniGL

A minimal WebGL2 rendering pipeline focused on fragment shader effects with minimal overhead, now with React support!

## Features

- WebGL2-based rendering pipeline with minimal overhead
- Shader pass system for filter and post-processing effects
- Ping-pong render targets for iterative effects
- React components for declarative shaders
- Shared effect system that works with both vanilla JS and React

## Project Structure

The project is organized into two main parts:

- **JavaScript Version** (`src/js/`): The core miniGL library
  - `miniGL.js` - The main WebGL2 rendering pipeline
  - `effects.js` - Factory functions for creating reusable effects

- **React Version** (`src/react/`): React components and hooks
  - `miniGL.jsx` - React wrapper for the core library
  - `hooks.jsx` - React hooks for shaders, textures, and render targets
  - `EffectComponents.jsx` - Reusable shader effect components

## Installation

```bash
npm install
npm run dev
```

## Usage

### Vanilla JavaScript

```javascript
import miniGL from './js/miniGL.js';

// Initialize with canvas ID
const gl = new miniGL("glCanvas");

// Create a basic shader pass
const basicPass = gl.createShaderPass({
  fragmentShader: `#version 300 es
    precision highp float;
    
    in vec2 vTexCoord;
    uniform float uTime;
    
    out vec4 fragColor;
    
    void main() {
      vec3 color = 0.5 + 0.5 * sin(uTime * 0.01 + vTexCoord.xyx);
      fragColor = vec4(color, 1.0);
    }`,
});

// Set up render loop
function render() {
  gl.render();
  requestAnimationFrame(render);
}
render();
```

### React Components

```jsx
import React from 'react';
import { MiniGL, Effect } from './react';

function App() {
  return (
    <MiniGL width="800px" height="400px">
      <Effect 
        config={{
          type: 'shader',
          fragmentShader: `#version 300 es
            precision highp float;
            
            uniform vec2 uResolution;
            uniform float uTime;
            
            in vec2 vTexCoord;
            out vec4 fragColor;
            
            void main() {
              vec3 color = vec3(vTexCoord.x, vTexCoord.y, sin(uTime * 0.001));
              fragColor = vec4(color, 1.0);
            }
          `
        }}
      />
    </MiniGL>
  );
}
```

## Effect System

Create reusable effects that work in both JS and React:

```javascript
// Define an effect once
const ditherEffect = createDitherEffect({ pattern: 2, strength: 0.5 });

// Use in JS
const ditherPass = applyEffectToMiniGL(gl, ditherEffect);

// Or use in React
<Effect config={ditherEffect} />
```

## License

MIT

Made w/ love for Shopify, 2025