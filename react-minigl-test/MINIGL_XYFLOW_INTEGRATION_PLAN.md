# MiniGL + XYFlow Integration Game Plan

## Overview

This document outlines the strategy for integrating miniGL (our WebGL2 node-based rendering pipeline) with XYFlow's React Flow library to create a powerful visual node editor for shader effects and WebGL operations.

## What is XYFlow/React Flow?

React Flow is a highly customizable React component library for building node-based editors and interactive diagrams. Key features:

- **Node-based UI**: Drag-and-drop nodes with custom content
- **Edge connections**: Visual connections between nodes with validation
- **Custom nodes/edges**: Full React component customization
- **Built-in features**: Zoom, pan, selection, minimap, controls
- **TypeScript support**: Full type safety
- **Server-side rendering**: Static diagram generation
- **Performance optimized**: Handles hundreds of nodes efficiently

## Integration Strategy

### Phase 1: Core Integration Architecture

#### 1.1 MiniGL Node Wrapper System
Create React components that wrap miniGL nodes and expose them as React Flow nodes:

```typescript
// Core wrapper that bridges miniGL nodes to React Flow
interface MiniGLNodeProps {
  miniglInstance: miniGL;
  nodeType: 'shader' | 'pingpong' | 'blend' | 'image' | 'canvas' | 'mrt';
  nodeConfig: any;
  onNodeUpdate?: (nodeId: string, output: any) => void;
}

// Individual node components
const ShaderNode: React.FC<MiniGLNodeProps>
const BlendNode: React.FC<MiniGLNodeProps>
const ImageNode: React.FC<MiniGLNodeProps>
// etc.
```

#### 1.2 Connection Management
- Map React Flow edges to miniGL node connections
- Validate connections based on node types and compatibility
- Real-time connection updates when edges change

#### 1.3 State Synchronization
- Bidirectional sync between React Flow state and miniGL graph
- Handle node creation, deletion, and parameter updates
- Maintain consistent IDs between both systems

### Phase 2: Visual Node Editor Components

#### 2.1 Custom Node Types
Create specialized React Flow nodes for each miniGL node type:

**Shader Node**
- Code editor for fragment shaders
- Uniform parameter controls
- Input/output handles for textures
- Syntax highlighting and error display

**Image/Video Node**
- File upload/URL input
- Preview thumbnail
- Fitting options (fill, fit, cover)
- Loading states

**Blend Node**
- Blend mode dropdown
- Opacity slider
- Visual blend preview

**Effect Nodes** (Blur, Brightness, etc.)
- Parameter sliders/inputs
- Real-time preview
- Preset management

#### 2.2 Handle System
Design a robust handle system for different data types:
- **Texture handles**: For image/render target connections
- **Parameter handles**: For numeric/vector values
- **Shader handles**: For shader code injection
- Color-coded handles by type
- Validation rules for compatible connections

#### 2.3 Node UI Components
- **Parameter panels**: Collapsible sections for node settings
- **Preview windows**: Small texture previews on nodes
- **Status indicators**: Loading, error, processing states
- **Context menus**: Right-click actions for nodes

### Phase 3: Advanced Features

#### 3.1 Real-time Preview System
- Live canvas output showing final result
- Node-level previews for debugging
- Performance monitoring and optimization
- Automatic LOD for complex graphs

#### 3.2 Graph Execution Engine
- Topological sorting for proper execution order
- Dependency tracking and change propagation
- Caching system for expensive operations
- Background processing for non-blocking UI

#### 3.3 Serialization & Persistence
- Save/load graph configurations
- Export to JSON format
- Import from existing miniGL setups
- Version control for graph changes

### Phase 4: Developer Experience

#### 4.1 Node Library System
- Searchable node palette
- Categorized node browser
- Custom node registration
- Community node sharing

#### 4.2 Template System
- Pre-built effect chains
- Example projects
- Tutorial flows
- Best practice patterns

#### 4.3 Debugging Tools
- Performance profiler
- Texture inspector
- Shader debugger
- Connection tracer

## Technical Implementation Details

### Core Architecture

```typescript
// Main integration class
class MiniGLFlowEditor {
  private minigl: miniGL;
  private reactFlowInstance: ReactFlowInstance;
  private nodeRegistry: Map<string, MiniGLNodeWrapper>;
  
  // Sync methods
  syncFromReactFlow(): void;
  syncToReactFlow(): void;
  
  // Node management
  createNode(type: string, config: any): string;
  deleteNode(nodeId: string): void;
  updateNode(nodeId: string, config: any): void;
  
  // Connection management
  connectNodes(sourceId: string, targetId: string, inputName: string): void;
  disconnectNodes(sourceId: string, targetId: string, inputName: string): void;
}
```

### Node Type System

```typescript
// Base node interface
interface MiniGLNodeDefinition {
  type: string;
  displayName: string;
  description: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  parameters: ParameterDefinition[];
  category: string;
  icon?: string;
  color?: string;
}

// Input/Output definitions
interface InputDefinition {
  name: string;
  type: 'texture' | 'number' | 'vector2' | 'vector3' | 'vector4';
  required: boolean;
  description: string;
}
```

### React Flow Integration

```typescript
// Custom node component
const MiniGLNode: React.FC<NodeProps> = ({ data, id }) => {
  const { miniglInstance, nodeConfig } = data;
  const [parameters, setParameters] = useState(nodeConfig.parameters);
  
  // Handle parameter changes
  const updateParameter = (key: string, value: any) => {
    setParameters(prev => ({ ...prev, [key]: value }));
    miniglInstance.getNode(id)?.updateUniform(key, value);
  };
  
  return (
    <div className="minigl-node">
      <NodeHeader title={nodeConfig.displayName} />
      <ParameterPanel 
        parameters={parameters}
        onUpdate={updateParameter}
      />
      <HandleContainer inputs={nodeConfig.inputs} outputs={nodeConfig.outputs} />
    </div>
  );
};
```

## Benefits of This Integration

### For Users
1. **Visual Programming**: No code required for basic effects
2. **Real-time Feedback**: Immediate visual results
3. **Modular Design**: Reusable effect chains
4. **Learning Tool**: Understand shader pipelines visually

### For Developers
1. **Rapid Prototyping**: Quick shader effect experimentation
2. **Complex Pipelines**: Build sophisticated rendering chains
3. **Debugging**: Visual debugging of shader graphs
4. **Collaboration**: Shareable visual representations

### For the Ecosystem
1. **Accessibility**: Lower barrier to entry for WebGL
2. **Education**: Teaching tool for graphics programming
3. **Community**: Shareable effect libraries
4. **Innovation**: New creative possibilities

## Implementation Phases

### Phase 1 (Foundation) - 2-3 weeks
- [ ] Basic React Flow + miniGL integration
- [ ] Core node wrapper system
- [ ] Simple shader and image nodes
- [ ] Basic connection system

### Phase 2 (Core Features) - 3-4 weeks
- [ ] All miniGL node types as React components
- [ ] Parameter editing UI
- [ ] Real-time preview system
- [ ] Save/load functionality

### Phase 3 (Polish) - 2-3 weeks
- [ ] Advanced UI components
- [ ] Performance optimizations
- [ ] Error handling and validation
- [ ] Documentation and examples

### Phase 4 (Advanced) - 3-4 weeks
- [ ] Node library system
- [ ] Template gallery
- [ ] Debugging tools
- [ ] Community features

## Potential Challenges & Solutions

### Challenge 1: Performance
**Problem**: Real-time updates might be expensive
**Solution**: 
- Debounced parameter updates
- Selective re-rendering
- Background processing
- LOD system for previews

### Challenge 2: State Complexity
**Problem**: Keeping React Flow and miniGL in sync
**Solution**:
- Single source of truth pattern
- Event-driven updates
- Immutable state management
- Clear separation of concerns

### Challenge 3: User Experience
**Problem**: Complex shader concepts for beginners
**Solution**:
- Progressive disclosure
- Helpful tooltips and documentation
- Example templates
- Visual feedback for errors

## Success Metrics

1. **Usability**: Users can create basic effects in < 5 minutes
2. **Performance**: 60fps with 20+ nodes in the graph
3. **Flexibility**: Support for custom node types
4. **Adoption**: Community creates and shares node libraries

## Next Steps

1. **Proof of Concept**: Build minimal working integration
2. **User Testing**: Get feedback from target users
3. **Iteration**: Refine based on real usage
4. **Documentation**: Comprehensive guides and examples
5. **Community**: Build ecosystem around the tool

This integration has the potential to democratize WebGL programming and create a new category of visual programming tools for graphics and effects. 