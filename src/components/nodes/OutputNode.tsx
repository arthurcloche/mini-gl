import React from "react";
import { Handle, Position } from "@xyflow/react";

interface OutputNodeData {
  label: string;
  nodeType: string;
}

interface OutputNodeProps {
  data: OutputNodeData;
}

export const OutputNode: React.FC<OutputNodeProps> = ({ data }) => {
  return (
    <div
      style={{
        background: "#2d3748",
        border: "2px solid #48bb78",
        borderRadius: "8px",
        padding: "10px",
        minWidth: "150px",
        color: "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#ff6b6b" }}
      />

      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
        {data.label}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0" }}>Final Output</div>

      <div
        style={{
          width: "20px",
          height: "20px",
          background: "#48bb78",
          borderRadius: "50%",
          margin: "8px auto 0",
        }}
      />
    </div>
  );
};
