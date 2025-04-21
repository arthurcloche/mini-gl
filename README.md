# miniGL

A minimal WebGL2 rendering pipeline focused on fragment shader effects with minimal overhead.

## Overview

miniGL provides a streamlined API for creating GPU-accelerated graphics and effects. It's designed for developers who want to leverage WebGL2's power without the complexity of larger frameworks.

## Features

- WebGL2-based rendering pipeline
- Shader pass system for filter and post-processing effects
- Ping-pong render targets for iterative effects
- Dynamic canvas textures with auto-updates
- Minimal overhead with focus on fragment shader effects

## Installation

```bash
# Clone the repository
git clone https://github.com/arthurcloche/mini-gl.git

# Navigate to the project
cd mini-gl

# Serve with any HTTP server
# For example, with Python:
python -m http.server
```

## Basic Usage

```javascript
import miniGL from "./miniGL.js";

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

## Flowmap Implementation

The flowmap technique creates fluid-like distortion effects based on mouse movement, perfect for interactive backgrounds and hover effects.

### Creating a Flowmap

```javascript
const flowmapPass = gl.createPingPongPass({
  fragmentShader: `#version 300 es
    precision highp float;
  
    in vec2 vTexCoord;
    uniform sampler2D uPrevious; 
    uniform vec2 uMouse;         
    uniform vec2 uVelocity;      
    uniform vec2 uResolution;    
    uniform float uTime;         
    
    uniform float uFalloff;
    uniform float uAlpha;
    uniform float uDissipation;

    out vec4 fragColor;
    
    const vec2 vFactor = vec2(10.);
    
    void main() {
      // Sample the previous state
      vec4 color = texture(uPrevious, vTexCoord) * uDissipation;
      
      vec2 cursor = vTexCoord - uMouse;
      float aspect = uResolution.x/uResolution.y;
      cursor.x *= aspect;

      vec3 stamp = vec3(uVelocity * vFactor * vec2(1, -1), 1.0 - pow(1.0 - min(1.0, length(uVelocity * vFactor)), 3.0));
      float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
      
      color.rgb = mix(color.rgb, stamp, vec3(falloff));
      
      fragColor = color;
    }`,
  uniforms: {
    uFalloff: 0.3,
    uAlpha: 1.0,
    uDissipation: 0.98,
  },
  format: gl.FLOAT, // Important for precision
});
```

### Using the Flowmap for Distortion

```javascript
// Create a texture to distort
const waterTexture = gl.canvasTexture((ctx, width, height) => {
  // Create your texture here
});

// Visualization pass that uses the flowmap
const visualizePass = gl.createShaderPass({
  fragmentShader: `#version 300 es
    precision highp float;

    in vec2 vTexCoord;
    uniform sampler2D uTexture;
    uniform sampler2D uFlowmap;
    uniform sampler2D uWaterTexture;
    uniform float uTime;
    
    out vec4 fragColor;
    
    void main() {
      // Get flow data (R/G = velocity X/Y, B = intensity)
      vec3 flow = texture(uFlowmap, vTexCoord).rgb;
      
      // Create two time-varying phases for smooth animation
      float phase0 = uTime * 0.25;
      float phase1 = phase0 + 0.5;
      
      float time0 = fract(phase0);
      float time1 = fract(phase1);
      
      // Calculate distortion strength that varies over time
      float strength0 = 1.0 - time0;
      float strength1 = 1.0 - time1;
      
      // Apply flow-based distortion to UV coordinates
      vec2 distortion0 = flow.xy * strength0 * 0.05;
      vec2 distortion1 = flow.xy * strength1 * 0.05;
      
      // Sample texture with distorted coordinates
      vec3 color0 = texture(uWaterTexture, vTexCoord - distortion0).rgb;
      vec3 color1 = texture(uWaterTexture, vTexCoord - distortion1).rgb;
      
      // Blend between the two phases
      float blend = abs(1.0 - 2.0 * time0);
      vec3 color = mix(color0, color1, blend);
      
      fragColor = vec4(color, 1.0);
    }`,
  uniforms: {
    uFlowmap: flowmapPass,
    uWaterTexture: waterTexture
  }
});
```

## API Reference

### Core

- `new miniGL(canvasId)` - Initialize miniGL with canvas ID
- `gl.render()` - Render all passes
- `gl.resize()` - Update all passes when canvas size changes

### Textures

- `gl.canvasTexture(drawCallback, options)` - Create a texture from canvas drawing
- `gl.imageTexture(url, options)` - Create a texture from an image

### Render Passes

- `gl.createShaderPass(options)` - Create a basic shader pass
- `gl.createPingPongPass(options)` - Create a ping-pong pass for iterative effects

### Uniforms

Automatically supported uniform types:
- `float`, `int`
- `vec2`, `vec3`, `vec4`
- `texture` objects
- Custom Pass objects (automatically extracts the correct texture)
- No support for `mat` so far as i didn't encounter a usecase yet but if anything, just use the DOMMatrix object.

## License

MIT

Made w/ love for Shopify, 2025