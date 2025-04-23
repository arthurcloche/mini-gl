import React, { useState } from "react";
import MiniGL from "../../src/react/miniGL.jsx";
import {
  DitherEffect,
  MouseBulgeEffect,
  Effect,
} from "../../src/react/EffectComponents.jsx";
import { useTexture } from "../../src/react/hooks.jsx";

/**
 * React MiniGL Example Component
 */
export const ReactMiniGLExample = () => {
  // State for effect parameters
  const [ditherStrength, setDitherStrength] = useState(0.5);
  const [ditherPattern, setDitherPattern] = useState(2);
  const [bulgeRadius, setBulgeRadius] = useState(0.1);
  const [bulgeStrength, setBulgeStrength] = useState(0.5);

  return (
    <div className="example-container">
      <h1>MiniGL React Integration</h1>

      <div className="controls">
        <div className="control-group">
          <h3>Dither Effect</h3>
          <div className="control">
            <label>
              Strength:
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={ditherStrength}
                onChange={(e) => setDitherStrength(parseFloat(e.target.value))}
              />
              <span className="value">{ditherStrength.toFixed(2)}</span>
            </label>
          </div>

          <div className="control">
            <label>
              Pattern:
              <select
                value={ditherPattern}
                onChange={(e) => setDitherPattern(parseInt(e.target.value))}
              >
                <option value="1">Pattern 1</option>
                <option value="2">Pattern 2</option>
                <option value="3">Pattern 3</option>
              </select>
            </label>
          </div>
        </div>

        <div className="control-group">
          <h3>Bulge Effect</h3>
          <div className="control">
            <label>
              Radius:
              <input
                type="range"
                min="0.01"
                max="0.3"
                step="0.01"
                value={bulgeRadius}
                onChange={(e) => setBulgeRadius(parseFloat(e.target.value))}
              />
              <span className="value">{bulgeRadius.toFixed(2)}</span>
            </label>
          </div>

          <div className="control">
            <label>
              Strength:
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bulgeStrength}
                onChange={(e) => setBulgeStrength(parseFloat(e.target.value))}
              />
              <span className="value">{bulgeStrength.toFixed(2)}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="canvas-wrapper">
        <MiniGL
          width="100%"
          height="500px"
          style={{
            border: "1px solid #333",
            borderRadius: "4px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          {/* First pass: Generate base content */}
          <BaseContentPass />

          {/* Apply dithering effect with configured parameters */}
          <DitherEffect pattern={ditherPattern} strength={ditherStrength} />

          {/* Apply mouse bulge effect with configured parameters */}
          <MouseBulgeEffect radius={bulgeRadius} strength={bulgeStrength} />
        </MiniGL>
      </div>

      <div className="code-example">
        <h3>Component Code</h3>
        <pre>{`
// Import MiniGL React components
import MiniGL from 'mini-gl/react';
import { DitherEffect, MouseBulgeEffect } from 'mini-gl/react';

// Create your component
const MyMiniGLComponent = () => {
  // Define state for effect parameters
  const [ditherStrength, setDitherStrength] = useState(0.5);
  const [bulgeRadius, setBulgeRadius] = useState(0.1);
  
  return (
    <MiniGL width="800px" height="600px">
      {/* Generate base content */}
      <BaseContentPass />
      
      {/* Apply effects in sequence */}
      <DitherEffect pattern={2} strength={ditherStrength} />
      <MouseBulgeEffect radius={bulgeRadius} strength={0.5} />
    </MiniGL>
  );
};

// Define a custom pass for the base content
const BaseContentPass = () => {
  const shader = \`#version 300 es
    precision highp float;
    
    uniform vec2 uResolution;
    uniform float uTime;
    
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    void main() {
      // Your shader code here...
      fragColor = vec4(vTexCoord, 0.5, 1.0);
    }
  \`;
  
  return <Effect config={{type: 'shader', fragmentShader: shader}} />;
};
        `}</pre>
      </div>
    </div>
  );
};

/**
 * Base content pass component
 */
const BaseContentPass = () => {
  const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform vec2 uResolution;
    uniform float uTime;
    
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    // Correct aspect ratio calculations
    vec2 correctAspect(vec2 uv, float aspect) {
      // Center the coordinates
      vec2 centered = uv - 0.5;
      // Apply aspect ratio correction
      centered.y *= aspect;
      // Return to 0-1 range
      return centered + 0.5;
    }
    
    void main() {
      float aspect = uResolution.y / uResolution.x;
      
      // Get aspect-corrected coordinates
      vec2 uv = vTexCoord;
      vec2 uvCorrect = correctAspect(uv, aspect);
      
      // Create a gradient background
      vec3 color1 = vec3(0.2, 0.4, 0.8);
      vec3 color2 = vec3(0.8, 0.2, 0.4);
      
      // Oscillating gradient
      float t = (sin(uTime * 0.001) + 1.0) * 0.5;
      vec3 color = mix(color1, color2, t * uv.x + (1.0 - t) * uv.y);
      
      // Add some circles with proper aspect ratio
      float d1 = distance(uvCorrect, vec2(0.3 + 0.2 * sin(uTime * 0.002), 0.3 + 0.2 * cos(uTime * 0.001)));
      float d2 = distance(uvCorrect, vec2(0.7 + 0.2 * cos(uTime * 0.002), 0.7 + 0.2 * sin(uTime * 0.001)));
      
      if (d1 < 0.1) color = vec3(1.0, 1.0, 1.0) - color;
      if (d2 < 0.1) color = vec3(1.0, 1.0, 1.0) - color;
      
      fragColor = vec4(color, 1.0);
    }
  `;

  return (
    <Effect
      config={{
        type: "shader",
        fragmentShader,
        uniforms: {},
      }}
    />
  );
};
