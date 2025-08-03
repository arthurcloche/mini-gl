# miniGL Node-Graph Editor Development Plan

## Overview

This document outlines the comprehensive plan for building a visual node-graph editor for the miniGL fragment shader library. The editor will provide an intuitive interface for creating, connecting, and managing shader nodes while maintaining real-time preview capabilities.

## Core Requirements & Features

### Essential Features
- **Visual Node Creation**: Drag-and-drop node palette with all miniGL node types
- **Connection System**: Intuitive input/output connection with type validation
- **Real-time Preview**: Live canvas showing the current graph output
- **Property Editor**: Dynamic UI for editing node uniforms and parameters
- **Graph Navigation**: Pan, zoom, minimap for large graphs

### Advanced Features
- **Save/Load**: JSON serialization of complete graphs
- **Undo/Redo**: Full operation history with state management
- **Node Grouping**: MiniNode creation from selected subgraphs
- **Live Coding**: Inline shader editor with syntax highlighting
- **Performance Monitoring**: Frame rate and GPU usage indicators

## Integration Strategy

### Editor ↔ miniGL Integration
- **Bidirectional Sync**: Editor creates/modifies actual miniGL nodes
- **Event System**: Listen to miniGL graph changes for live updates
- **Proxy Layer**: Editor manipulates graph through safe abstraction
- **Hot Reloading**: Real-time shader compilation and error feedback

### Data Flow
```
Editor Actions → Graph Commands → miniGL Nodes → WebGL Rendering → Canvas Preview
     ↑                                                                      ↓
   UI Updates ← Graph Events ← Node Changes ← Frame Updates ← Performance Monitor
```

## Proposed Architecture

### Core Components

#### 1. Editor Engine (`NodeGraphEditor`)
```javascript
class NodeGraphEditor {
  constructor(canvas, options) {
    this.minigl = new MiniGL(canvas);
    this.graph = new EditorGraph();
    this.viewport = new EditorViewport();
    this.selection = new SelectionManager();
    this.history = new UndoRedoManager();
  }
}
```

#### 2. Graph Management (`EditorGraph`)
- Wraps miniGL graph with editor metadata
- Handles node positioning, grouping, comments
- Manages serialization/deserialization
- Validates connections and types

#### 3. UI Components
- `NodeRenderer`: Visual node representation
- `ConnectionRenderer`: Bezier curves for connections  
- `PropertyPanel`: Dynamic uniform/parameter editing
- `NodePalette`: Drag-and-drop node creation
- `Toolbar`: Graph operations and tools

#### 4. State Management
- Command pattern for undo/redo operations
- Observable graph state for reactive UI updates
- Persistence layer for save/load functionality

## Technology Stack

### Framework Choice: Vanilla JS (Prototype) → React (Production)
After prototyping, we've discovered:
- **Vanilla JS** works excellently for rapid prototyping and understanding UX patterns
- State management via global `EditorState` object proved the concept
- Event delegation patterns work well for dynamic UI
- **React** migration path is clear with established patterns

### Rendering Strategy (Validated through Prototype)
- **SVG**: Node graph rendering (better for interactive elements than Canvas2D)
- **WebGL**: miniGL preview (separate canvas) 
- **DOM**: Property panels, menus, overlays
- **Hybrid Approach**: SVG nodes + DOM overlays provides best of both worlds

### Key Libraries
- **No external dependencies needed** for core functionality (proven in prototype)
- **Monaco Editor**: For production shader editing (textarea works for prototype)
- **State Management**: Custom EditorState pattern → Zustand for production
- **No animation library needed**: CSS transitions sufficient

## UX Principles (Discovered Through Prototype)

### Layout & Information Architecture
- **3-Column Layout [0.25, 0.5, 0.25]**: Optimal for workflow
  - Left: Scene graph (read-only) + Node palette
  - Center: Preview (top) + Node graph (bottom)
  - Right: Properties + Settings/Export
- **Contextual Property Panels**: Different UI for different node types
- **Documentation as Default**: Show helpful info when no node selected

### Visual Design Principles
- **Color Coding**: Node types have distinct colors for titles and connection dots
  - Input nodes (Texture/Video/Canvas): Light blue (#4fc3f7)
  - Processing nodes (Shader): Orange (#ff8a65)
  - Composition nodes (Blend): Purple (#ba68c8)
  - Temporal nodes (Feedback): Green (#81c784)
- **Minimal Dark Theme**: Reduces eye strain for long sessions
- **Progressive Disclosure**: Advanced settings hidden by default

### Interaction Patterns
- **Drag Preview Rectangle**: Shows where node will land (not live position)
- **Deferred Updates**: Node positions update on mouse release, not during drag
- **Modal Overlays**: Shader editor covers only node graph, preserving preview
- **Visual Feedback**: All actions provide immediate visual response

### Performance Optimizations
- **Event Delegation**: For dynamically created elements
- **Selective Redraws**: Only update changed portions during interactions
- **Connection Redraw**: Update only connections during node drag
- **Debounced Updates**: For expensive operations

## Core Features Implementation Plan

### Phase 1: Basic Node Editor
**Core Functionality:**
- Canvas with pan/zoom/select operations
- Node creation from palette (shader, texture, blend nodes)
- Visual connection system with input/output ports
- Basic property editing (sliders, color pickers, text inputs)
- Real-time miniGL integration

### Phase 2: Advanced Graph Features  
**Enhanced Editing:**
- Multi-selection and group operations
- Copy/paste/duplicate functionality
- Node search and filtering
- Keyboard shortcuts for power users
- Grid snapping and alignment tools

### Phase 3: Shader Development Tools
**Developer Experience:**
- Inline shader editor with syntax highlighting
- GLSL error reporting and debugging
- Shader template library
- Custom node creation from shaders
- Uniform introspection and auto-UI generation

## Advanced Features Specification

### State Management & Persistence

#### Undo/Redo System
- Command pattern implementation
- Granular operation tracking (move, connect, edit property)
- State snapshots for complex operations
- Memory-efficient history management

#### Serialization Format (Validated in Prototype)
```json
{
  "version": "1.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "nodes": [
    {
      "id": "node_1234567890", 
      "type": "Shader",
      "name": "Blur Effect",
      "position": {"x": 100, "y": 200},
      "uniforms": {
        "uRadius": {"type": "slider", "value": 2, "min": 0, "max": 10}
      },
      "shader": "fragment_code_here"
    },
    {
      "id": "node_1234567891",
      "type": "Texture",
      "name": "Source Image",
      "position": {"x": 50, "y": 100},
      "url": "https://example.com/image.jpg",
      "sizeMode": "cover"
    }
  ],
  "connections": [
    {"from": "node_1234567891", "to": "node_1234567890"}
  ],
  "outputNode": "node_1234567890",
  "settings": {
    "resolution": "512x512",
    "loop": true,
    "loopDuration": "4"
  }
}
```

### Performance & Optimization

#### Real-time Features
- Debounced property updates
- Background shader compilation
- Progressive node rendering for large graphs
- FPS monitoring and performance warnings
- Memory usage tracking

#### Validation System
- Type checking for connections
- Circular dependency detection
- Missing texture/asset warnings
- Shader compilation error reporting

## Implementation Roadmap

### Milestone 1: Foundation (Week 1-2)
**Deliverable:** Basic working editor with miniGL integration
- Set up React project with required dependencies  
- Implement core canvas with pan/zoom functionality
- Create basic node rendering system
- Establish miniGL bidirectional communication
- Simple property editing interface

### Milestone 2: Core Editor (Week 3-4) 
**Deliverable:** Functional node graph editor
- Complete node palette with all miniGL node types
- Connection system with visual feedback
- Real-time preview canvas integration
- Basic save/load functionality
- Property panels for common node types

### Milestone 3: Advanced Features (Week 5-6)
**Deliverable:** Production-ready editor
- Undo/redo system implementation
- Shader editor with syntax highlighting
- Performance monitoring and optimization
- Node grouping and MiniNode creation
- Error handling and validation

### Milestone 4: Polish & Extension (Week 7-8)
**Deliverable:** Enhanced user experience
- Keyboard shortcuts and power-user features
- Template library and examples
- Export functionality (images, videos, code)
- Documentation and tutorials
- Mobile/touch support considerations

## Technical Considerations

### Integration Points
- **Editor Bridge**: Adapter layer between editor operations and miniGL graph
- **Hot Reload**: Live shader compilation without breaking the pipeline  
- **Type Safety**: Enforce miniGL connection rules in the visual editor
- **Performance**: Separate update loops for editor UI vs. miniGL rendering

### File Structure
```
minigl-editor/
├── src/
│   ├── components/        # React UI components
│   ├── core/             # Editor engine and graph management
│   ├── minigl-bridge/    # miniGL integration layer
│   ├── serialization/    # Save/load functionality  
│   ├── validation/       # Type checking and error handling
│   └── utils/            # Helpers and utilities
├── examples/             # Demo graphs and tutorials
└── docs/                 # User documentation
```

### Key Design Decisions
1. **React Flow vs Custom**: Use React Flow as base, heavily customize for miniGL
2. **Canvas Strategy**: Hybrid Canvas2D + DOM for optimal performance
3. **State Management**: Zustand for simplicity, avoid Redux complexity
4. **TypeScript**: Full TypeScript for better miniGL integration
5. **Testing**: Unit tests for core logic, E2E for user workflows

## Success Criteria

### Technical Goals
- Real-time performance (60fps) with complex graphs
- Seamless miniGL integration without breaking changes
- Intuitive UX for both beginners and advanced users
- Robust serialization and persistence

### User Experience Goals
- Visual learners can understand shader concepts
- Rapid prototyping of visual effects
- Easy sharing and collaboration
- Professional workflow integration

## Risk Assessment

### Technical Risks
- **Performance**: Large graphs may impact rendering performance
- **Complexity**: Deep miniGL integration could introduce bugs
- **Browser Compatibility**: Canvas/WebGL differences across browsers

### Mitigation Strategies
- Progressive rendering and virtualization for large graphs
- Comprehensive testing with miniGL test suite
- Fallback modes for older browsers

## Lessons Learned from Prototype Phase

### What Worked Well
1. **Vanilla JS First**: Building the prototype without frameworks revealed core patterns
2. **Global State Object**: `EditorState` pattern proved sufficient for complexity
3. **SVG for Nodes**: Better than Canvas2D for interactive elements
4. **Event Delegation**: Scales well with dynamic UI elements
5. **3-Column Layout**: Natural workflow from palette → graph → properties

### Key Discoveries
1. **Drag Preview Rectangle**: Essential for good UX - shows intent before action
2. **Contextual Properties**: Different node types need completely different UIs
3. **Color Coding**: Small visual cues greatly improve usability
4. **Deferred Updates**: Prevents jarring reflows during interactions
5. **Documentation Panel**: Empty states should be helpful, not empty

### Technical Insights
1. **No Complex Libraries Needed**: CSS + SVG + vanilla JS surprisingly capable
2. **Performance**: Selective updates more important than framework choice
3. **State Management**: Simple patterns work until they don't - know when to upgrade
4. **Modularization**: 1300+ line files indicate need for better organization

### Architecture Decisions Validated
- Separation of visual representation from data model
- Event-driven updates with central state
- Specialized property panels per node type
- JSON serialization format with settings included
- Preview and graph as separate concerns

## Next Steps

1. **miniGL Integration**: Connect the visual prototype to actual miniGL nodes
2. **Connection System**: Implement the visual connection drawing and validation
3. **Modularization**: Break down the monolithic script.js into modules
4. **State Management**: Migrate from global object to proper state management
5. **Production Build**: Consider React for complex state and component reuse

---

This plan, validated through prototyping, provides a comprehensive roadmap for creating a professional node-graph editor that leverages miniGL's excellent architecture while providing an intuitive visual interface for shader composition and creative coding.