import React, { useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

export const LuminanceNode: React.FC<NodeProps> = ({ data, id }) => {
  const nodeData = data as any;
  const [threshold, setThreshold] = useState<number>(nodeData.threshold || 0.5);
  const [knee, setKnee] = useState<number>(nodeData.knee || 0.1);

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = parseFloat(e.target.value);
    setThreshold(value);
    // Update node data for miniGL sync
    nodeData.threshold = value;
  };

  const handleKneeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = parseFloat(e.target.value);
    setKnee(value);
    // Update node data for miniGL sync
    nodeData.knee = value;
  };

  return (
    <div
      style={{
        background: "#4a5568",
        border: "2px solid #68d391",
        borderRadius: "8px",
        padding: "10px",
        minWidth: "180px",
        color: "white",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="uTexture"
        style={{ background: "#ff6b6b" }}
      />

      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {nodeData.label}
      </div>

      <div style={{ fontSize: "12px", color: "#a0aec0", marginBottom: "8px" }}>
        Luminance Extraction
      </div>

      <div style={{ marginBottom: "8px" }}>
        <label
          style={{ fontSize: "11px", display: "block", marginBottom: "2px" }}
        >
          Threshold: {threshold.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={threshold}
          onChange={handleThresholdChange}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag"
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ marginBottom: "8px" }}>
        <label
          style={{ fontSize: "11px", display: "block", marginBottom: "2px" }}
        >
          Knee: {knee.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={knee}
          onChange={handleKneeChange}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag"
          style={{ width: "100%" }}
        />
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
