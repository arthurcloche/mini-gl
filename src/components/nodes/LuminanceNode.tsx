import React from "react";
import { Handle, Position } from "@xyflow/react";

interface LuminanceNodeData {
  label: string;
  nodeType: string;
}

interface LuminanceNodeProps {
  data: LuminanceNodeData;
}

export const LuminanceNode: React.FC<LuminanceNodeProps> = ({ data }) => {
  return (
    <div
      style={{
        background: "#2d3748",
        border: "2px solid #4a5568",
        borderRadius: "8px",
        padding: "10px",
        minWidth: "180px",
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
        {data.label}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0", marginBottom: "8px" }}>
        Converts to grayscale using luminance formula
      </div>

      <div
        style={{ fontSize: "11px", color: "#718096", fontFamily: "monospace" }}
      >
        0.299*R + 0.587*G + 0.114*B
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: "#48bb78" }}
      />
    </div>
  );
};
