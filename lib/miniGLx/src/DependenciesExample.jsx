import React, { useRef, useState, useEffect } from "react";
import { useMiniGL, createNodeRefs } from "../useMiniGL.js";

// Base noise shader
const noiseShader = `#version 300 es
precision highp float;

uniform float glTime;
uniform vec2 glResolution;
uniform vec3 glMouse;
uniform float uFrequency;
uniform float uAmplitude;
uniform vec3 uColor;

in vec2 glUV;
out vec4 fragColor;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = glUV;
  
  float n = noise(uv * uFrequency + glTime * 0.1) * uAmplitude;
  n += noise(uv * uFrequency * 2.0 + glTime * 0.05) * uAmplitude * 0.5;
  
  vec3 color = uColor * n;
  fragColor = vec4(color, 1.0);
}`;

// Blur shader for post-processing
const blurShader = `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 glResolution;
uniform float uBlurAmount;

in vec2 glUV;
out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / glResolution;
  vec4 result = vec4(0.0);
  
  float blur = uBlurAmount;
  int samples = max(1, int(blur * 3.0));
  
  for (int x = -samples; x <= samples; x++) {
    for (int y = -samples; y <= samples; y++) {
      vec2 offset = vec2(float(x), float(y)) * texelSize * blur;
      result += texture(uTexture, glUV + offset);
    }
  }
  
  result /= float((samples * 2 + 1) * (samples * 2 + 1));
  fragColor = result;
}`;

function DependenciesExample() {
  const canvasRef = useRef();

  // State that will affect the shader graph
  const [frequency, setFrequency] = useState(10.0);
  const [color, setColor] = useState([1.0, 0.5, 0.2]);
  const [useBlur, setUseBlur] = useState(false);
  const [blurAmount, setBlurAmount] = useState(1.0);

  // Test Phase 2: Dependencies trigger rebuilds appropriately
  const { gl, nodeRefs, isReady } = useMiniGL(
    canvasRef,
    (gl) => {
      console.log("🔧 Building shader graph with:", {
        frequency,
        color,
        useBlur,
        blurAmount,
      });

      // Create noise node with current uniforms
      const noiseNode = gl.shader(
        noiseShader,
        {
          uFrequency: frequency,
          uAmplitude: 0.8,
          uColor: { x: color[0], y: color[1], z: color[2] },
        },
        { name: "NoiseShader" }
      );

      let outputNode = noiseNode;
      let blurNode = null;

      // Conditionally add blur based on useBlur flag
      if (useBlur) {
        blurNode = gl.shader(
          blurShader,
          {
            uBlurAmount: blurAmount,
          },
          { name: "BlurShader" }
        );

        // Connect noise to blur
        blurNode.connect("uTexture", noiseNode);
        outputNode = blurNode;
      }

      // Set final output
      gl.output(outputNode);

      // Return node references using helper
      return createNodeRefs({
        noise: noiseNode,
        blur: blurNode,
      });
    },
    // Dependencies - changes to these will trigger graph rebuild
    [frequency, color, useBlur, blurAmount]
  );

  return (
    <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
      {/* Canvas */}
      <div
        style={{
          width: "400px",
          height: "300px",
          border: "1px solid #ccc",
          position: "relative",
        }}
      >
        <div
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            color: "white",
            fontSize: "12px",
            textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          Status: {isReady ? "✓ Ready" : "⏳ Loading"}
          {isReady && nodeRefs && (
            <div>
              Active nodes:{" "}
              {Object.keys(nodeRefs).filter((k) => nodeRefs[k].node).length}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ minWidth: "250px", padding: "0" }}>
        <h4 style={{ margin: "0 0 15px 0" }}>Controls (Dependency Testing)</h4>

        <div style={{ marginBottom: "15px" }}>
          <label>
            Frequency: {frequency.toFixed(1)}
            <br />
            <input
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={frequency}
              onChange={(e) => setFrequency(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>Color:</label>
          <br />
          {["R", "G", "B"].map((channel, i) => (
            <div key={channel} style={{ marginBottom: "5px" }}>
              <label style={{ fontSize: "12px" }}>
                {channel}: {color[i].toFixed(1)}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={color[i]}
                  onChange={(e) => {
                    const newColor = [...color];
                    newColor[i] = parseFloat(e.target.value);
                    setColor(newColor);
                  }}
                  style={{ width: "100%", marginLeft: "5px" }}
                />
              </label>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>
            <input
              type="checkbox"
              checked={useBlur}
              onChange={(e) => setUseBlur(e.target.checked)}
            />
            Enable Blur (Changes Graph)
          </label>
        </div>

        {useBlur && (
          <div style={{ marginBottom: "15px" }}>
            <label>
              Blur Amount: {blurAmount.toFixed(1)}
              <br />
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={blurAmount}
                onChange={(e) => setBlurAmount(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        )}

        <div style={{ fontSize: "11px", color: "#666", marginTop: "15px" }}>
          ℹ️ Check console for rebuild logs
        </div>
      </div>
    </div>
  );
}

export default DependenciesExample;
