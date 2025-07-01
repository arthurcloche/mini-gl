import React from "react";
import { Handle, Position } from "@xyflow/react";

interface BlendNodeData {
  label: string;
  blendMode?: string;
  opacity?: number;
  nodeType: string;
}

interface BlendNodeProps {
  data: BlendNodeData;
}

export const BlendNode: React.FC<BlendNodeProps> = ({ data }) => {
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
        id="base"
        style={{ background: "#ff6b6b", top: "30%" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="overlay"
        style={{ background: "#ff6b6b", top: "70%" }}
      />

      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
        {data.label}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0", marginBottom: "4px" }}>
        Mode: {data.blendMode || "normal"}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0", marginBottom: "8px" }}>
        Opacity: {((data.opacity || 1.0) * 100).toFixed(0)}%
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
