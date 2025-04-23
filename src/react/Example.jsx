import React, { useState, useEffect } from "react";
import MiniGL from "./miniGL.jsx";
import { DitherEffect, MouseBulgeEffect, Effect } from "./EffectComponents.jsx";
import { useTexture } from "./hooks.jsx";
import {
  createDitherEffect,
  createMouseBulgeEffect,
  applyEffectToMiniGL,
} from "../js/effects.js";

/**
 * Example using component-based approach
 */
export const ReactMiniGLExample = () => {
  const [ditherStrength, setDitherStrength] = useState(0.5);
  const [bulgeRadius, setBulgeRadius] = useState(0.1);

  return (
    <div>
      <h2>MiniGL React Example</h2>

      <div style={{ marginBottom: 20 }}>
        <label>
          Dither Strength:
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={ditherStrength}
            onChange={(e) => setDitherStrength(parseFloat(e.target.value))}
            style={{ marginLeft: "10px", width: "200px" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          Bulge Radius:
          <input
            type="range"
            min="0.01"
            max="0.3"
            step="0.01"
            value={bulgeRadius}
            onChange={(e) => setBulgeRadius(parseFloat(e.target.value))}
            style={{ marginLeft: "10px", width: "200px" }}
          />
        </label>
      </div>

      <MiniGL width="800px" height="600px" style={{ border: "1px solid #333" }}>
        {/* First pass: Image source */}
        <ImageTexturePass src="https://example.com/image.jpg" />

        {/* Apply dithering effect */}
        <DitherEffect pattern={2} strength={ditherStrength} />

        {/* Apply mouse bulge effect */}
        <MouseBulgeEffect radius={bulgeRadius} strength={0.5} />
      </MiniGL>
    </div>
  );
};

/**
 * Image texture pass component
 */
const ImageTexturePass = ({ src }) => {
  const texture = useTexture(src);

  // Only create the pass once the texture is loaded
  if (!texture) return null;

  const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D uTexture;
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    void main() {
      fragColor = texture(uTexture, vTexCoord);
    }
  `;

  return (
    <Effect
      config={{ type: "shader", fragmentShader, uniforms: {} }}
      uniforms={{ uTexture: texture }}
    />
  );
};

/**
 * Example using the JavaScript API directly in a React component
 */
export const VanillaAPIExample = () => {
  const canvasRef = React.useRef(null);
  const glInstanceRef = React.useRef(null);

  useEffect(() => {
    const canvasId = "vanilla-minigl-example";

    if (!canvasRef.current) return;
    canvasRef.current.id = canvasId;

    // Import miniGL dynamically to avoid issues
    import("../js/miniGL.js").then((module) => {
      const miniGL = module.default;

      // Create miniGL instance
      const gl = new miniGL(canvasId);
      glInstanceRef.current = gl;

      // Create image texture (this would be an async operation)
      gl.imageTexture("https://example.com/image.jpg").then((texture) => {
        // Create a basic pass to render the image
        const basePass = gl.pass(
          `#version 300 es
          precision highp float;
          
          uniform sampler2D uTexture;
          in vec2 vTexCoord;
          out vec4 fragColor;
          
          void main() {
            fragColor = texture(uTexture, vTexCoord);
          }
        `,
          { uTexture: texture }
        );

        // Create and apply a dither effect
        const ditherEffect = createDitherEffect({ pattern: 2, strength: 0.5 });
        const ditherPass = applyEffectToMiniGL(gl, ditherEffect);

        // Create and apply a mouse bulge effect
        const bulgeEffect = createMouseBulgeEffect({
          radius: 0.1,
          strength: 0.5,
        });
        const bulgePass = applyEffectToMiniGL(gl, bulgeEffect);

        // Start animation loop
        function animate() {
          gl.render();
          requestAnimationFrame(animate);
        }

        animate();
      });
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <div>
      <h2>MiniGL Vanilla API Example</h2>
      <canvas
        ref={canvasRef}
        style={{ width: "800px", height: "600px", border: "1px solid #333" }}
      />
    </div>
  );
};
