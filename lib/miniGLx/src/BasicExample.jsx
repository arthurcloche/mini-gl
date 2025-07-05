import React, { useRef } from "react";
import { useMiniGL } from "../useMiniGL.js";

// Simple noise shader for testing
const noiseShader = `#version 300 es
precision highp float;

uniform float glTime;
uniform vec2 glResolution;
uniform vec3 glMouse;

in vec2 glUV;
out vec4 fragColor;

// Simple noise function
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = glUV;
  
  // Animated noise based on time and mouse
  float n = noise(uv * 10.0 + glTime * 0.1);
  n += noise(uv * 20.0 + glTime * 0.05) * 0.5;
  
  // Mouse interaction
  float mouseDist = length(uv - glMouse.xy);
  float mouseEffect = 1.0 - smoothstep(0.0, 0.3, mouseDist);
  
  vec3 color = vec3(n) + vec3(0.2, 0.5, 0.8) * mouseEffect;
  
  fragColor = vec4(color, 1.0);
}`;

function BasicExample() {
  const canvasRef = useRef();

  // Phase 1 Test: Basic setup with no dependencies
  const { gl, nodeRefs, isReady } = useMiniGL(
    canvasRef,
    (gl) => {
      console.log("🚀 Setting up basic shader graph");

      // Create a simple noise shader
      const noiseNode = gl.shader(noiseShader, {}, { name: "NoiseShader" });

      // Set as output
      gl.output(noiseNode);

      // Return references for potential runtime updates
      return {
        noise: noiseNode,
      };
    },
    []
  ); // No dependencies for this basic test

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "400px",
        border: "1px solid #ccc",
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
        {isReady && (
          <div>
            <div>Nodes: {nodeRefs ? Object.keys(nodeRefs).length : 0}</div>
            <div>Move mouse to interact</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BasicExample;
