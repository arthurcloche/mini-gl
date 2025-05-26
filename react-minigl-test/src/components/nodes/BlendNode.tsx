import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

export const BlendNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = data as any;

  return (
    <div
      style={{
        background: "#805ad5",
        border: "2px solid #9f7aea",
        borderRadius: "8px",
        padding: "10px",
        minWidth: "180px",
        color: "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="glBase"
        style={{ background: "#ff6b6b", top: "30%" }}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="glBlend"
        style={{ background: "#ff6b6b", top: "70%" }}
      />

      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {nodeData.label}
      </div>

      <div style={{ fontSize: "12px", color: "#e9d8fd", marginBottom: "8px" }}>
        Blend Mode: {nodeData.blendMode || "normal"}
      </div>

      <div style={{ fontSize: "12px", color: "#e9d8fd" }}>
        Opacity: {((nodeData.opacity || 1.0) * 100).toFixed(0)}%
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: "#68d391" }}
      />
    </div>
  );
};
