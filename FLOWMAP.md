# Flowmap Documentation

## Overview

A flowmap is a technique used to create fluid-like distortion effects by storing motion vectors in a texture. This texture can then be used to distort other textures, creating dynamic and organic visual effects.

In miniGL, flowmaps are implemented using ping-pong rendering, which allows for iterative updates and persistence of motion over time.

## Technical Implementation

The flowmap in miniGL works by:

1. Storing motion vectors in the R and G channels of a texture
2. Using the B channel to store motion intensity
3. Applying motion decay over time for a trailing effect
4. Using mouse velocity to generate motion vectors

## Creating a Flowmap

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

## Parameters

### Core Parameters

- `uFalloff`: Controls the size of the motion stamp (smaller values = larger stamp)
- `uAlpha`: Controls the opacity/strength of each motion stamp
- `uDissipation`: Controls how quickly the motion fades (values closer to 1.0 fade slower)
- `format: gl.FLOAT`: Using floating-point textures for better precision

### Automatic Parameters

These are provided automatically by miniGL:

- `uPrevious`: The previous frame's texture (for ping-pong rendering)
- `uMouse`: The current mouse position (normalized 0-1 coordinates)
- `uVelocity`: The current mouse velocity (change in position per frame)
- `uResolution`: The canvas dimensions
- `uTime`: The current time (incremented each frame)

## Shader Breakdown

The flowmap shader has several key components:

1. **Decay**: `color = texture(uPrevious, vTexCoord) * uDissipation;`
   - Samples the previous frame and applies decay

2. **Cursor Position**: 
   ```glsl
   vec2 cursor = vTexCoord - uMouse;
   cursor.x *= aspect;
   ```
   - Calculates the vector from the current pixel to the mouse
   - Corrects for aspect ratio to maintain circular stamps

3. **Velocity Stamp**:
   ```glsl
   vec3 stamp = vec3(uVelocity * vFactor * vec2(1, -1), 
                    1.0 - pow(1.0 - min(1.0, length(uVelocity * vFactor)), 3.0));
   ```
   - R: X velocity (multiplied by factor and possibly flipped)
   - G: Y velocity (multiplied by factor and possibly flipped)
   - B: Velocity magnitude with non-linear falloff

4. **Spatial Falloff**:
   ```glsl
   float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
   ```
   - Creates a smooth circular falloff from the mouse position

5. **Blending**:
   ```glsl
   color.rgb = mix(color.rgb, stamp, vec3(falloff));
   ```
   - Blends the new motion vectors with the existing ones

## Using the Flowmap for Distortion

To use the flowmap for distortion, you need to:

1. Create a texture to distort
2. Sample the flowmap in a shader
3. Use the R/G channels to offset UV coordinates
4. Sample the distorted texture

```javascript
// Visualization pass that uses the flowmap
const visualizePass = gl.createShaderPass({
  fragmentShader: `#version 300 es
    precision highp float;

    in vec2 vTexCoord;
    uniform sampler2D uTexture;
    uniform sampler2D uFlowmap;
    uniform sampler2D uBaseTexture;
    uniform float uTime;
    
    out vec4 fragColor;
    
    void main() {
      // Get flow data
      vec3 flow = texture(uFlowmap, vTexCoord).rgb;
      
      // Apply distortion to texture coordinates
      vec2 distortedUv = vTexCoord - flow.xy * 0.05;
      
      // Sample with distorted coordinates
      vec3 color = texture(uBaseTexture, distortedUv).rgb;
      
      fragColor = vec4(color, 1.0);
    }`,
  uniforms: {
    uFlowmap: flowmapPass,
    uBaseTexture: yourTexture
  }
});
```

## Advanced Technique: Dual-Phase Animation

For smoother animation, you can use a dual-phase approach:

```glsl
// Create two time phases
float phase0 = uTime * 0.25;
float phase1 = phase0 + 0.5;

float time0 = fract(phase0);
float time1 = fract(phase1);

// Calculate two distortion vectors
vec2 distortion0 = flow.xy * (1.0 - time0) * 0.05;
vec2 distortion1 = flow.xy * (1.0 - time1) * 0.05;

// Sample texture twice with different distortions
vec3 color0 = texture(uBaseTexture, vTexCoord - distortion0).rgb;
vec3 color1 = texture(uBaseTexture, vTexCoord - distortion1).rgb;

// Blend between the two samples
float blend = abs(1.0 - 2.0 * time0);
vec3 color = mix(color0, color1, blend);
```

This technique prevents the "snapping" effect when a new frame begins, creating a continuous flow animation.

## Performance Considerations

1. **Texture Size**: The flowmap doesn't need to be full resolution. Often 256×256 or 512×512 is sufficient.

2. **Floating Point Precision**: Using `format: gl.FLOAT` provides better quality but uses more memory.

3. **Falloff Size**: Smaller `uFalloff` values create larger stamps, which can be more computationally intensive.

4. **Dissipation**: Higher `uDissipation` values (closer to 1.0) mean more history is preserved, which can lead to more complex patterns.

## Creative Applications

Flowmaps can be used for various effects:

- Distorting background textures for hover effects
- Creating water-like ripples and waves
- Simulating wind effects on particles or grass
- Creating dynamic, organic transitions between content

## References

This implementation is inspired by:
- [OGL Flowmap Implementation](https://github.com/oframe/ogl/blob/master/src/extras/Flowmap.js)
- Distortion techniques from [Interactive Fluid Effects](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu) 