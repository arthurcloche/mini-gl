import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

export const ImageNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = data as any;

  return (
    <div
      style={{
        background: "#2b6cb0",
        border: "2px solid #3182ce",
        borderRadius: "8px",
        padding: "10px",
        minWidth: "150px",
        color: "white",
      }}
    >
      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {nodeData.label}
      </div>

      <div style={{ fontSize: "12px", color: "#bee3f8", marginBottom: "8px" }}>
        Image Source
      </div>

      {nodeData.url && (
        <img
          src={nodeData.url}
          alt="Preview"
          style={{
            width: "100px",
            height: "100px",
            objectFit: "cover",
            borderRadius: "4px",
            marginBottom: "8px",
          }}
        />
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
