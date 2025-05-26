import React, { useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

export const ShaderNode: React.FC<NodeProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const nodeData = data as any;
  const [shaderCode, setShaderCode] = useState(nodeData.fragmentShader || "");

  const handleShaderChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setShaderCode(newCode);
    // Update node data for miniGL sync
    nodeData.fragmentShader = newCode;
  };

  return (
    <div
      style={{
        background: "#2d3748",
        border: "2px solid #4a5568",
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

      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {nodeData.label}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0", marginBottom: "8px" }}>
        Fragment Shader
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: "#4a5568",
          border: "none",
          color: "white",
          padding: "4px 8px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        {isExpanded ? "Hide Code" : "Edit Code"}
      </button>

      {isExpanded && (
        <div
          style={{
            marginTop: "8px",
            background: "#1a202c",
            padding: "8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          <textarea
            value={shaderCode}
            onChange={handleShaderChange}
            style={{
              width: "100%",
              height: "200px",
              background: "#1a202c",
              color: "#e2e8f0",
              border: "1px solid #4a5568",
              borderRadius: "4px",
              padding: "8px",
              fontSize: "11px",
              fontFamily: "monospace",
              resize: "vertical",
            }}
            placeholder="Enter fragment shader code..."
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: "#68d391" }}
      />
    </div>
  );
};
