import React, { useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";

interface ShaderNodeData {
  label: string;
  fragmentShader: string;
  nodeType: string;
  onShaderChange?: (newShader: string) => void;
}

interface ShaderNodeProps {
  data: ShaderNodeData;
  id: string;
}

export const ShaderNode: React.FC<ShaderNodeProps> = ({ data, id }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localShader, setLocalShader] = useState(data.fragmentShader);
  const [hasError, setHasError] = useState(false);

  const handleShaderChange = useCallback(
    (newShader: string) => {
      setLocalShader(newShader);

      // Basic validation - check for required elements
      const hasMainFunction = newShader.includes("void main()");
      const hasFragColor = newShader.includes("fragColor");
      const hasVersion = newShader.includes("#version 300 es");

      if (!hasMainFunction || !hasFragColor || !hasVersion) {
        setHasError(true);
        // Return transparent black for invalid shader
        const errorShader = `#version 300 es
precision highp float;
uniform sampler2D glTexture;
in vec2 glUV;
out vec4 fragColor;

void main() {
  fragColor = vec4(0.0, 0.0, 0.0, 0.0); // Transparent black for errors
}`;
        data.onShaderChange?.(errorShader);
      } else {
        setHasError(false);
        data.onShaderChange?.(newShader);
      }
    },
    [data]
  );

  return (
    <div
      style={{
        background: hasError ? "#742a2a" : "#2d3748",
        border: `2px solid ${hasError ? "#e53e3e" : "#4a5568"}`,
        borderRadius: "8px",
        padding: "10px",
        minWidth: "200px",
        color: "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="glTexture"
        style={{ background: "#ff6b6b" }}
      />

      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
        {data.label} {hasError && "⚠️"}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0", marginBottom: "8px" }}>
        Fragment Shader {hasError && "(Error)"}
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: hasError ? "#e53e3e" : "#4a5568",
          border: "none",
          color: "white",
          padding: "4px 8px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "12px",
          marginBottom: isExpanded ? "8px" : "0",
        }}
      >
        {isExpanded ? "Hide Code" : "Edit Code"}
      </button>

      {isExpanded && (
        <div>
          <textarea
            value={localShader}
            onChange={(e) => handleShaderChange(e.target.value)}
            style={{
              width: "100%",
              height: "200px",
              background: hasError ? "#1a1a1a" : "#1a202c",
              color: hasError ? "#ff6b6b" : "#e2e8f0",
              border: `1px solid ${hasError ? "#e53e3e" : "#4a5568"}`,
              borderRadius: "4px",
              padding: "8px",
              fontSize: "11px",
              fontFamily: "monospace",
              resize: "vertical",
            }}
            placeholder="Enter GLSL fragment shader code..."
          />
          {hasError && (
            <div
              style={{
                fontSize: "10px",
                color: "#ff6b6b",
                marginTop: "4px",
                fontStyle: "italic",
              }}
            >
              Invalid shader - must include #version 300 es, void main(), and
              fragColor
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: "#48bb78" }}
      />
    </div>
  );
};
