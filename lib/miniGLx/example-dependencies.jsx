import React, { useRef, useState, useEffect } from "react";
import { useMiniGL, createNodeRefs } from "../useMiniGL.js";

// Base noise shader
const noiseShader = `#version 300 es
precision highp float;

uniform float glTime;
uniform vec2 glResolution;
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
  int samples = int(blur * 5.0) + 1;
  
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
  const [amplitude, setAmplitude] = useState(1.0);
  const [color, setColor] = useState([1.0, 0.5, 0.2]);
  const [useBlur, setUseBlur] = useState(false);
  const [blurAmount, setBlurAmount] = useState(0.0);

  // Test Phase 2: Dependencies trigger rebuilds appropriately
  const { gl, nodeRefs, isReady } = useMiniGL(
    canvasRef,
    (gl) => {
      console.log("🔧 Building shader graph with:", {
        frequency,
        amplitude,
        color,
        useBlur,
        blurAmount,
      });

      // Create noise node with current uniforms
      const noiseNode = gl.shader(
        noiseShader,
        {
          uFrequency: frequency,
          uAmplitude: amplitude,
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
    [frequency, amplitude, color, useBlur, blurAmount]
  );

  // Test Phase 3: Runtime uniform updates (outside React render cycle)
  useEffect(() => {
    if (!nodeRefs || !isReady) return;

    // This should NOT trigger a rebuild, just update uniforms
    const interval = setInterval(() => {
      // Update time-based animation
      const time = performance.now() * 0.001;
      const dynamicFreq = frequency + Math.sin(time) * 2.0;

      nodeRefs.noise?.updateUniform("uFrequency", dynamicFreq);
    }, 16); // ~60fps updates

    return () => clearInterval(interval);
  }, [nodeRefs, isReady, frequency]);

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Canvas */}
      <div
        style={{ width: "400px", height: "400px", border: "1px solid #ccc" }}
      >
        <div
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ width: "300px", padding: "20px" }}>
        <h3>Phase 2: Dependency Management Test</h3>

        <div style={{ marginBottom: "15px" }}>
          <label>Status: {isReady ? "✓ Ready" : "⏳ Loading"}</label>
          {isReady && nodeRefs && (
            <div style={{ fontSize: "12px", color: "#666" }}>
              Active nodes:{" "}
              {Object.keys(nodeRefs).filter((k) => nodeRefs[k].node).length}
            </div>
          )}
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>
            Frequency: {frequency.toFixed(1)}
            <br />
            <input
              type="range"
              min="1"
              max="50"
              step="0.5"
              value={frequency}
              onChange={(e) => setFrequency(parseFloat(e.target.value))}
            />
          </label>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>
            Amplitude: {amplitude.toFixed(2)}
            <br />
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={amplitude}
              onChange={(e) => setAmplitude(parseFloat(e.target.value))}
            />
          </label>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>
            Color:
            <br />
            R:{" "}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={color[0]}
              onChange={(e) =>
                setColor([parseFloat(e.target.value), color[1], color[2]])
              }
            />
            <br />
            G:{" "}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={color[1]}
              onChange={(e) =>
                setColor([color[0], parseFloat(e.target.value), color[2]])
              }
            />
            <br />
            B:{" "}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={color[2]}
              onChange={(e) =>
                setColor([color[0], color[1], parseFloat(e.target.value)])
              }
            />
          </label>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>
            <input
              type="checkbox"
              checked={useBlur}
              onChange={(e) => setUseBlur(e.target.checked)}
            />
            Enable Blur (Changes Graph Structure)
          </label>
        </div>

        {useBlur && (
          <div style={{ marginBottom: "15px" }}>
            <label>
              Blur Amount: {blurAmount.toFixed(2)}
              <br />
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={blurAmount}
                onChange={(e) => setBlurAmount(parseFloat(e.target.value))}
              />
            </label>
          </div>
        )}

        <div style={{ fontSize: "12px", color: "#666", marginTop: "20px" }}>
          <strong>Test Notes:</strong>
          <ul style={{ margin: "5px 0", paddingLeft: "15px" }}>
            <li>Uniform changes should trigger rebuilds</li>
            <li>Blur toggle changes graph structure</li>
            <li>Runtime frequency animation happens outside React</li>
            <li>Check console for rebuild logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DependenciesExample;
