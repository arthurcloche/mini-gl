import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ShaderNode } from "./nodes/ShaderNode";
import { ImageNode } from "./nodes/ImageNode";
import { BlendNode } from "./nodes/BlendNode";
import { OutputNode } from "./nodes/OutputNode";
import { LuminanceNode } from "./nodes/LuminanceNode";

// Import miniGL - now from src/lib
const miniGL = require("../lib/miniGL/miniGL.js").default;

// Define node types for React Flow
const nodeTypes: NodeTypes = {
  shader: ShaderNode,
  image: ImageNode,
  blend: BlendNode,
  output: OutputNode,
  luminance: LuminanceNode,
};

// Initial nodes for the demo
const initialNodes: Node[] = [
  {
    id: "image-1",
    type: "image",
    position: { x: 100, y: 100 },
    data: {
      label: "Image Input",
      url: "https://cdn.shopify.com/s/files/1/0817/9308/9592/files/crystal.png?v=1722451245",
      nodeType: "image",
    },
  },
  {
    id: "luminance-1",
    type: "luminance",
    position: { x: 400, y: 100 },
    data: {
      label: "Luminance",
      threshold: 0.3,
      knee: 0.1,
      nodeType: "luminance",
    },
  },
  {
    id: "shader-1",
    type: "shader",
    position: { x: 700, y: 100 },
    data: {
      label: "Color Shift",
      fragmentShader: `#version 300 es
precision highp float;
uniform sampler2D glTexture;
uniform float glTime;
uniform vec2 glResolution;
in vec2 glUV;
out vec4 fragColor;

void main() {
  vec4 color = texture(glTexture, glUV);
  float shift = sin(glTime * 0.01) * 0.5 + 0.5;
  color.rgb = color.rgb * vec3(1.0 + shift, 1.0, 1.0 - shift);
  fragColor = color;
}`,
      nodeType: "shader",
    },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 1000, y: 100 },
    data: {
      label: "Output",
      nodeType: "output",
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "image-1",
    target: "luminance-1",
    sourceHandle: "output",
    targetHandle: "uTexture",
  },
  {
    id: "e2-3",
    source: "luminance-1",
    target: "shader-1",
    sourceHandle: "output",
    targetHandle: "glTexture",
  },
  {
    id: "e3-4",
    source: "shader-1",
    target: "output-1",
    sourceHandle: "output",
    targetHandle: "input",
  },
];

interface MiniGLFlowEditorProps {
  canvasId: string;
}

export const MiniGLFlowEditor: React.FC<MiniGLFlowEditorProps> = ({
  canvasId,
}) => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const miniglRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize miniGL
  useEffect(() => {
    const initMiniGL = async () => {
      try {
        const minigl = new miniGL(canvasId);
        await minigl.ready(); // Wait for miniNodes to load
        miniglRef.current = minigl;
        setIsInitialized(true);

        // Start render loop
        const animate = () => {
          minigl.render();
          requestAnimationFrame(animate);
        };
        animate();
      } catch (error) {
        console.error("Failed to initialize miniGL:", error);
      }
    };

    initMiniGL();

    return () => {
      if (miniglRef.current) {
        miniglRef.current.dispose();
      }
    };
  }, [canvasId]);

  // Sync React Flow graph to miniGL
  const graphSignature = useMemo(() => {
    return JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    });
  }, [nodes, edges]);

  const lastSyncRef = useRef<string>("");

  useEffect(() => {
    if (
      !isInitialized ||
      !miniglRef.current ||
      lastSyncRef.current === graphSignature
    )
      return;

    lastSyncRef.current = graphSignature;
    const minigl = miniglRef.current;

    // Clear existing nodes
    minigl.nodes.clear();

    // Create miniGL nodes based on React Flow nodes
    const miniglNodes = new Map();

    nodes.forEach((node) => {
      let miniglNode;

      switch (node.data.nodeType) {
        case "image":
          miniglNode = minigl.image(node.data.url, {
            name: node.data.label,
          });
          break;

        case "shader":
          miniglNode = minigl.shader(node.data.fragmentShader, {
            name: node.data.label,
          });
          break;

        case "luminance":
          miniglNode = minigl.luminance(
            node.data.threshold || 0.5,
            node.data.knee || 0.1,
            {
              name: node.data.label,
            }
          );
          break;

        case "blend":
          miniglNode = minigl.blend({
            blendMode: node.data.blendMode || "normal",
            opacity: node.data.opacity || 1.0,
            name: node.data.label,
          });
          break;

        case "output":
          // Output node doesn't create a miniGL node, it just sets the output
          break;
      }

      if (miniglNode) {
        miniglNodes.set(node.id, miniglNode);
      }
    });

    // Create connections based on React Flow edges
    edges.forEach((edge) => {
      const sourceNode = miniglNodes.get(edge.source);
      const targetNode = miniglNodes.get(edge.target);

      if (sourceNode && targetNode) {
        targetNode.connect(edge.targetHandle || "glTexture", sourceNode);
      }
    });

    // Set output node
    const outputEdge = edges.find((edge) => edge.target === "output-1");
    if (outputEdge) {
      const outputSourceNode = miniglNodes.get(outputEdge.source);
      if (outputSourceNode) {
        minigl.setOutput(outputSourceNode);
      }
    }
  }, [graphSignature, isInitialized]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Handle node editing
      console.log("Double clicked node:", node);
    },
    []
  );

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex" }}>
      {/* React Flow Editor */}
      <div style={{ width: "70%", height: "100%" }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* miniGL Canvas */}
      <div style={{ width: "30%", height: "100%", backgroundColor: "#1a1a1a" }}>
        <div style={{ padding: "10px", color: "white", fontSize: "14px" }}>
          Live Preview
        </div>
        <canvas
          id={canvasId}
          style={{
            width: "100%",
            height: "calc(100% - 40px)",
            display: "block",
          }}
        />
      </div>
    </div>
  );
};
