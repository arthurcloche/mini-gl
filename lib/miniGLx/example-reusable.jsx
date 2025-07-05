import React, { useRef, useState, useEffect } from "react";
import { useMiniGL, createShaderEffect, createNodeRefs } from "../useMiniGL.js";

// Reusable noise effect using createShaderEffect
const createNoiseEffect = createShaderEffect(
  (gl, { frequency = 10.0, amplitude = 1.0, color = [1, 1, 1] }) => {
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
      vec3 finalColor = uColor * n;
      fragColor = vec4(finalColor, 1.0);
    }`;

    return gl.shader(
      noiseShader,
      {
        uFrequency: frequency,
        uAmplitude: amplitude,
        uColor: { x: color[0], y: color[1], z: color[2] },
      },
      { name: "ReusableNoise" }
    );
  }
);

// Reusable color grading effect
const createColorGradeEffect = createShaderEffect(
  (gl, { brightness = 1.0, contrast = 1.0, saturation = 1.0 }) => {
    const colorGradeShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D uTexture;
    uniform float uBrightness;
    uniform float uContrast;
    uniform float uSaturation;
    
    in vec2 glUV;
    out vec4 fragColor;
    
    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }
    
    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
      vec4 color = texture(uTexture, glUV);
      
      // Brightness and contrast
      color.rgb = ((color.rgb - 0.5) * uContrast + 0.5) * uBrightness;
      
      // Saturation
      vec3 hsv = rgb2hsv(color.rgb);
      hsv.y *= uSaturation;
      color.rgb = hsv2rgb(hsv);
      
      fragColor = color;
    }`;

    return gl.shader(
      colorGradeShader,
      {
        uBrightness: brightness,
        uContrast: contrast,
        uSaturation: saturation,
      },
      { name: "ColorGrade" }
    );
  }
);

// Reusable distortion effect
const createDistortionEffect = createShaderEffect(
  (gl, { amount = 0.1, frequency = 5.0, speed = 1.0 }) => {
    const distortionShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D uTexture;
    uniform float glTime;
    uniform float uAmount;
    uniform float uFrequency;
    uniform float uSpeed;
    
    in vec2 glUV;
    out vec4 fragColor;
    
    void main() {
      vec2 uv = glUV;
      
      // Wave distortion
      float wave = sin(uv.x * uFrequency + glTime * uSpeed) * uAmount;
      uv.y += wave;
      
      // Circular distortion
      vec2 center = vec2(0.5);
      float dist = distance(uv, center);
      float ripple = sin(dist * uFrequency * 2.0 - glTime * uSpeed * 2.0) * uAmount * 0.5;
      uv += normalize(uv - center) * ripple;
      
      fragColor = texture(uTexture, uv);
    }`;

    return gl.shader(
      distortionShader,
      {
        uAmount: amount,
        uFrequency: frequency,
        uSpeed: speed,
      },
      { name: "Distortion" }
    );
  }
);

function ReusableExample() {
  const canvasRef = useRef();

  // Configuration for reusable effects
  const [noiseConfig, setNoiseConfig] = useState({
    frequency: 15.0,
    amplitude: 0.8,
    color: [0.2, 0.8, 1.0],
  });

  const [colorGradeConfig, setColorGradeConfig] = useState({
    brightness: 1.2,
    contrast: 1.1,
    saturation: 1.3,
  });

  const [distortionConfig, setDistortionConfig] = useState({
    amount: 0.05,
    frequency: 8.0,
    speed: 1.0,
  });

  const [enableColorGrade, setEnableColorGrade] = useState(true);
  const [enableDistortion, setEnableDistortion] = useState(false);

  // Test Phase 3: Reusable effects composition
  const { gl, nodeRefs, isReady } = useMiniGL(
    canvasRef,
    (gl) => {
      console.log("🎨 Composing reusable effects");

      // Start with noise effect
      const noiseNode = createNoiseEffect(gl, noiseConfig);
      let currentNode = noiseNode;
      let colorGradeNode = null;
      let distortionNode = null;

      // Chain effects based on configuration
      if (enableColorGrade) {
        colorGradeNode = createColorGradeEffect(gl, colorGradeConfig);
        colorGradeNode.connect("uTexture", currentNode);
        currentNode = colorGradeNode;
      }

      if (enableDistortion) {
        distortionNode = createDistortionEffect(gl, distortionConfig);
        distortionNode.connect("uTexture", currentNode);
        currentNode = distortionNode;
      }

      gl.output(currentNode);

      return createNodeRefs({
        noise: noiseNode,
        colorGrade: colorGradeNode,
        distortion: distortionNode,
      });
    },
    [
      noiseConfig,
      colorGradeConfig,
      distortionConfig,
      enableColorGrade,
      enableDistortion,
    ]
  );

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
      <div
        style={{
          width: "350px",
          padding: "20px",
          maxHeight: "400px",
          overflow: "auto",
        }}
      >
        <h3>Phase 3: Reusable Effects</h3>

        <div style={{ marginBottom: "20px" }}>
          <strong>Status:</strong> {isReady ? "✓ Ready" : "⏳ Loading"}
          {isReady && nodeRefs && (
            <div style={{ fontSize: "12px", color: "#666" }}>
              Active effects:{" "}
              {Object.keys(nodeRefs).filter((k) => nodeRefs[k].node).length}
            </div>
          )}
        </div>

        {/* Noise Effect Controls */}
        <fieldset style={{ marginBottom: "20px", padding: "10px" }}>
          <legend>
            <strong>Noise Effect (Base)</strong>
          </legend>

          <div style={{ marginBottom: "10px" }}>
            <label>
              Frequency: {noiseConfig.frequency.toFixed(1)}
              <br />
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={noiseConfig.frequency}
                onChange={(e) =>
                  setNoiseConfig((prev) => ({
                    ...prev,
                    frequency: parseFloat(e.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label>
              Amplitude: {noiseConfig.amplitude.toFixed(2)}
              <br />
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={noiseConfig.amplitude}
                onChange={(e) =>
                  setNoiseConfig((prev) => ({
                    ...prev,
                    amplitude: parseFloat(e.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div>
            <label>Color:</label>
            <br />
            {["R", "G", "B"].map((channel, i) => (
              <div
                key={channel}
                style={{ display: "inline-block", width: "80px" }}
              >
                {channel}:{" "}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={noiseConfig.color[i]}
                  onChange={(e) => {
                    const newColor = [...noiseConfig.color];
                    newColor[i] = parseFloat(e.target.value);
                    setNoiseConfig((prev) => ({ ...prev, color: newColor }));
                  }}
                />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Color Grade Effect */}
        <fieldset style={{ marginBottom: "20px", padding: "10px" }}>
          <legend>
            <label>
              <input
                type="checkbox"
                checked={enableColorGrade}
                onChange={(e) => setEnableColorGrade(e.target.checked)}
              />
              <strong>Color Grading</strong>
            </label>
          </legend>

          {enableColorGrade && (
            <>
              <div style={{ marginBottom: "10px" }}>
                <label>
                  Brightness: {colorGradeConfig.brightness.toFixed(2)}
                  <br />
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={colorGradeConfig.brightness}
                    onChange={(e) =>
                      setColorGradeConfig((prev) => ({
                        ...prev,
                        brightness: parseFloat(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label>
                  Contrast: {colorGradeConfig.contrast.toFixed(2)}
                  <br />
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={colorGradeConfig.contrast}
                    onChange={(e) =>
                      setColorGradeConfig((prev) => ({
                        ...prev,
                        contrast: parseFloat(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div>
                <label>
                  Saturation: {colorGradeConfig.saturation.toFixed(2)}
                  <br />
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={colorGradeConfig.saturation}
                    onChange={(e) =>
                      setColorGradeConfig((prev) => ({
                        ...prev,
                        saturation: parseFloat(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            </>
          )}
        </fieldset>

        {/* Distortion Effect */}
        <fieldset style={{ marginBottom: "20px", padding: "10px" }}>
          <legend>
            <label>
              <input
                type="checkbox"
                checked={enableDistortion}
                onChange={(e) => setEnableDistortion(e.target.checked)}
              />
              <strong>Distortion</strong>
            </label>
          </legend>

          {enableDistortion && (
            <>
              <div style={{ marginBottom: "10px" }}>
                <label>
                  Amount: {distortionConfig.amount.toFixed(3)}
                  <br />
                  <input
                    type="range"
                    min="0"
                    max="0.2"
                    step="0.005"
                    value={distortionConfig.amount}
                    onChange={(e) =>
                      setDistortionConfig((prev) => ({
                        ...prev,
                        amount: parseFloat(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label>
                  Frequency: {distortionConfig.frequency.toFixed(1)}
                  <br />
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={distortionConfig.frequency}
                    onChange={(e) =>
                      setDistortionConfig((prev) => ({
                        ...prev,
                        frequency: parseFloat(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div>
                <label>
                  Speed: {distortionConfig.speed.toFixed(1)}
                  <br />
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={distortionConfig.speed}
                    onChange={(e) =>
                      setDistortionConfig((prev) => ({
                        ...prev,
                        speed: parseFloat(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            </>
          )}
        </fieldset>

        <div style={{ fontSize: "12px", color: "#666" }}>
          <strong>Reusability Test:</strong>
          <ul style={{ margin: "5px 0", paddingLeft: "15px" }}>
            <li>Each effect is a reusable function</li>
            <li>Effects can be chained dynamically</li>
            <li>Configuration changes rebuild the chain</li>
            <li>Perfect for component libraries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ReusableExample;
