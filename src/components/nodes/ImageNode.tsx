import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";

interface ImageNodeData {
  label: string;
  url: string;
  nodeType: string;
}

interface ImageNodeProps {
  data: ImageNodeData;
}

export const ImageNode: React.FC<ImageNodeProps> = ({ data }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

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
      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
        {data.label}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0", marginBottom: "8px" }}>
        Image Source
      </div>

      <input
        type="text"
        value={data.url}
        readOnly
        style={{
          width: "100%",
          padding: "4px 8px",
          background: "#1a202c",
          border: "1px solid #4a5568",
          borderRadius: "4px",
          color: "white",
          fontSize: "12px",
          marginBottom: "8px",
        }}
      />

      {data.url && (
        <div style={{ textAlign: "center" }}>
          <img
            src={data.url}
            alt="Preview"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(false)}
            style={{
              maxWidth: "100%",
              maxHeight: "100px",
              borderRadius: "4px",
              border: imageLoaded ? "1px solid #48bb78" : "1px solid #e53e3e",
            }}
          />
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
