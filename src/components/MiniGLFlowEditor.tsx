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

// Fixed image URL to prevent mismatch between preview and processing
const DEMO_IMAGE_URL =
  "https://cdn.shopify.com/s/files/1/0817/9308/9592/files/crystal.png?v=1722451245";

// Initial nodes for the demo - Complex pipeline: Image → (Luminance + ColorShift) → Blend → Output
const initialNodes: Node[] = [
  {
    id: "image-1",
    type: "image",
    position: { x: 100, y: 150 },
    data: {
      label: "Crystal Image",
      url: DEMO_IMAGE_URL,
      nodeType: "image",
    },
  },
  {
    id: "luminance-1",
    type: "luminance",
    position: { x: 350, y: 100 },
    data: {
      label: "Luminance",
      nodeType: "luminance",
    },
  },
  {
    id: "shader-1",
    type: "shader",
    position: { x: 350, y: 200 },
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
      onShaderChange: (newShader: string) => {
        // This will be handled by the node update system
      },
    },
  },
  {
    id: "blend-1",
    type: "blend",
    position: { x: 600, y: 150 },
    data: {
      label: "Blend",
      blendMode: "multiply",
      opacity: 0.8,
      nodeType: "blend",
    },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 850, y: 150 },
    data: {
      label: "Output",
      nodeType: "output",
    },
  },
];

const initialEdges: Edge[] = [
  // Image to both luminance and color shift
  {
    id: "e1-2",
    source: "image-1",
    target: "luminance-1",
    sourceHandle: "output",
    targetHandle: "glTexture",
  },
  {
    id: "e1-3",
    source: "image-1",
    target: "shader-1",
    sourceHandle: "output",
    targetHandle: "glTexture",
  },
  // Both paths to blend node
  {
    id: "e2-4",
    source: "luminance-1",
    target: "blend-1",
    sourceHandle: "output",
    targetHandle: "base",
  },
  {
    id: "e3-4",
    source: "shader-1",
    target: "blend-1",
    sourceHandle: "output",
    targetHandle: "overlay",
  },
  // Blend to output
  {
    id: "e4-5",
    source: "blend-1",
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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const miniglRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastSyncRef = useRef<string>("");
  const animationRef = useRef<number>();

  // Handle shader code changes
  const handleShaderChange = useCallback(
    (nodeId: string, newShader: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId && node.data.nodeType === "shader") {
            return {
              ...node,
              data: {
                ...node.data,
                fragmentShader: newShader,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Update nodes to include shader change handlers
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      if (node.data.nodeType === "shader") {
        return {
          ...node,
          data: {
            ...node.data,
            onShaderChange: (newShader: string) =>
              handleShaderChange(node.id, newShader),
          },
        };
      }
      return node;
    });
  }, [nodes, handleShaderChange]);

  // Memoize the graph signature to prevent unnecessary re-syncs
  const graphSignature = useMemo(() => {
    const nodeSignature = nodesWithHandlers
      .map((n) => `${n.id}:${n.type}:${JSON.stringify(n.data)}`)
      .sort()
      .join("|");
    const edgeSignature = edges
      .map(
        (e) => `${e.source}->${e.target}:${e.sourceHandle}->${e.targetHandle}`
      )
      .sort()
      .join("|");
    return `${nodeSignature}||${edgeSignature}`;
  }, [nodesWithHandlers, edges]);

  // Initialize miniGL
  useEffect(() => {
    const initMiniGL = async () => {
      try {
        const minigl = new miniGL(canvasId);
        await minigl.ready(); // Wait for miniNodes to load
        miniglRef.current = minigl;
        setIsInitialized(true);

        // Optimized render loop - only render when needed
        let lastTime = 0;
        const animate = (currentTime: number) => {
          // Only render if enough time has passed (60fps max)
          if (currentTime - lastTime >= 16) {
            minigl.render();
            lastTime = currentTime;
          }
          animationRef.current = requestAnimationFrame(animate);
        };
        animationRef.current = requestAnimationFrame(animate);
      } catch (error) {
        console.error("Failed to initialize miniGL:", error);
      }
    };

    initMiniGL();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (miniglRef.current) {
        miniglRef.current.dispose();
      }
    };
  }, [canvasId]);

  // Sync React Flow graph to miniGL - only when graph actually changes
  useEffect(() => {
    if (!isInitialized || !miniglRef.current) return;

    // Skip if graph hasn't actually changed
    if (lastSyncRef.current === graphSignature) return;
    lastSyncRef.current = graphSignature;

    console.log("Syncing graph to miniGL...");
    const minigl = miniglRef.current;

    // Clear existing nodes
    minigl.nodes.clear();

    // Create miniGL nodes based on React Flow nodes
    const miniglNodes = new Map();

    nodesWithHandlers.forEach((node) => {
      let miniglNode;

      switch (node.data.nodeType) {
        case "image":
          miniglNode = minigl.image(node.data.url, {
            name: node.data.label,
          });
          break;

        case "luminance":
          // Create luminance shader
          miniglNode = minigl.shader(
            `#version 300 es
precision highp float;
uniform sampler2D glTexture;
in vec2 glUV;
out vec4 fragColor;

void main() {
  vec4 color = texture(glTexture, glUV);
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  fragColor = vec4(vec3(luma), color.a);
}`,
            {
              name: node.data.label,
            }
          );
          break;

        case "shader":
          miniglNode = minigl.shader(node.data.fragmentShader, {
            name: node.data.label,
          });
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
  }, [isInitialized, graphSignature]);

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
            nodes={nodesWithHandlers}
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
