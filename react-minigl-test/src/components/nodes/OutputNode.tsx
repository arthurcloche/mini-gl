import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

export const OutputNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = data as any;

  return (
    <div
      style={{
        background: "#38a169",
        border: "2px solid #48bb78",
        borderRadius: "8px",
        padding: "10px",
        minWidth: "120px",
        color: "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#ff6b6b" }}
      />

      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {nodeData.label}
      </div>

      <div style={{ fontSize: "12px", color: "#c6f6d5" }}>Final Output</div>
    </div>
  );
};
