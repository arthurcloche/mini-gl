# MiniGL + React Flow Integration Test

This is a proof-of-concept integration between miniGL (WebGL2 node-based rendering pipeline) and React Flow (node-based UI library).

## What This Demonstrates

- **Visual Node Editor**: Drag-and-drop interface for creating shader effect chains
- **Real-time Preview**: Live WebGL canvas showing the result of the node graph
- **Bidirectional Sync**: Changes in React Flow automatically update the miniGL pipeline
- **Custom Node Types**: Specialized UI components for different miniGL node types

## Current Features

### Node Types
- **Image Node**: Loads images from URLs with preview thumbnails
- **Shader Node**: Fragment shader editor with expandable code view
- **Blend Node**: Blending operations with mode and opacity controls
- **Output Node**: Final render target

### Integration Features
- Automatic graph synchronization between React Flow and miniGL
- Real-time parameter updates
- Visual connection validation
- Live preview canvas

## How to Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Architecture

### Core Components

1. **MiniGLFlowEditor**: Main integration component that manages both React Flow and miniGL
2. **Custom Node Components**: React components that represent miniGL nodes visually
3. **Synchronization Layer**: Keeps React Flow graph state in sync with miniGL pipeline

### Data Flow

```
React Flow Graph → Sync Layer → miniGL Pipeline → WebGL Canvas
     ↑                                              ↓
User Interactions ←←←←←←←←←←←←←←←←←←←←←←←←←←← Live Preview
```

## Key Integration Points

### 1. Node Creation
React Flow nodes are mapped to miniGL nodes based on their `nodeType` data property:

```typescript
switch (node.data.nodeType) {
  case 'image':
    miniglNode = minigl.image(node.data.url);
    break;
  case 'shader':
    miniglNode = minigl.shader(node.data.fragmentShader);
    break;
  // etc.
}
```

### 2. Connection Management
React Flow edges are converted to miniGL node connections:

```typescript
edges.forEach(edge => {
  const sourceNode = miniglNodes.get(edge.source);
  const targetNode = miniglNodes.get(edge.target);
  if (sourceNode && targetNode) {
    targetNode.connect(edge.targetHandle, sourceNode);
  }
});
```

### 3. Real-time Updates
Changes to the React Flow graph trigger a complete rebuild of the miniGL pipeline, ensuring consistency.

## Current Limitations

- **Performance**: Full graph rebuild on every change (could be optimized)
- **Node Editing**: Limited parameter editing UI (needs expansion)
- **Error Handling**: Basic error handling (needs improvement)
- **TypeScript**: Using `any` types in some places (needs proper typing)

## Next Steps

1. **Enhanced Node UI**: Better parameter editing interfaces
2. **Performance Optimization**: Incremental updates instead of full rebuilds
3. **Error Handling**: Visual error feedback and validation
4. **Node Library**: Expandable library of effect nodes
5. **Save/Load**: Serialization and persistence of graphs
6. **Templates**: Pre-built effect chains and examples

## Technical Notes

### File Structure
```
src/
├── components/
│   ├── MiniGLFlowEditor.tsx    # Main integration component
│   └── nodes/                  # Custom node components
│       ├── ShaderNode.tsx
│       ├── ImageNode.tsx
│       ├── BlendNode.tsx
│       └── OutputNode.tsx
├── lib/                        # miniGL library
└── App.tsx                     # Main app component
```

### Dependencies
- `@xyflow/react`: React Flow library for node-based UI
- `miniGL`: Custom WebGL2 rendering pipeline (local)

This integration demonstrates the potential for creating powerful visual programming tools for WebGL and shader development, making complex graphics programming more accessible through visual interfaces. 