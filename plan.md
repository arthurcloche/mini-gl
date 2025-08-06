# miniGL Node-Graph Editor Development Plan

## Overview

This document outlines the comprehensive plan for building a visual node-graph editor for the miniGL fragment shader library. The editor will provide an intuitive interface for creating, connecting, and managing shader nodes while maintaining real-time preview capabilities.

## Current Status (As of January 2025)

### ✅ Completed
1. **UI Implementation**
   - Modular ES6 architecture with UIManager, NodeGraph, PropertiesPanel, NodePalette
   - SVG-based node graph visualization with drag functionality
   - 3-column layout matching prototype design
   - Dynamic property panels with contextual UI per node type
   - CSS styling matching dark theme from prototype

2. **miniGL Integration**
   - MiniGLBridge module handling editor ↔ miniGL communication
   - Fixed import paths and module loading
   - Added missing render() method to miniGL library
   - Fixed shader compilation issues (GLSL ES 3.00 compatibility)
   - Proper uniform naming conventions (glTexture, glPrevious)

3. **Basic Functionality**
   - Node creation with drag-and-drop from palette
   - Node selection and property editing
   - Default scene with texture and blur shader
   - Real-time preview rendering
   - Export graph as JSON

### 🚧 Current Issues & Next Steps

#### Immediate Priority: Fix Node Graph Functionality
1. **Connection System**
   - Visual connections not rendering between nodes
   - Need to implement connection dragging UI
   - Validate connection compatibility (input/output types)
   - Update miniGL graph when connections change

2. **Node Execution**
   - Ensure nodes are properly connected in miniGL
   - Fix data flow from texture → shader → output
   - Implement proper output node designation
   - Debug why blur effect isn't showing

3. **Property Updates**
   - Ensure uniform changes propagate to miniGL nodes
   - Fix texture URL updates
   - Implement shader code editing
   - Add real-time parameter adjustments

#### Phase 1: Core Functionality (Week 1)
- [ ] Fix connection rendering in NodeGraph component
- [ ] Implement connection dragging (mousedown on output → mousemove → mouseup on input)
- [ ] Add connection validation (type checking)
- [ ] Ensure miniGL nodes are properly connected when visual connections are made
- [ ] Fix output node designation and rendering
- [ ] Test data flow: Texture → Shader → Output
- [ ] Add visual feedback for active connections

#### Phase 2: Enhanced Editing (Week 2)
- [ ] Multi-node selection with Shift/Cmd click
- [ ] Delete nodes and connections (Delete key)
- [ ] Copy/paste functionality (Cmd+C/V)
- [ ] Undo/redo system (Cmd+Z/Shift+Cmd+Z)
- [ ] Node alignment and snapping
- [ ] Connection rerouting

#### Phase 3: Advanced Features (Week 3)
- [ ] Shader editor modal with syntax highlighting
- [ ] Live shader compilation with error reporting
- [ ] More node types (Video, Canvas, Feedback, Blend)
- [ ] Custom uniform controls (color pickers, curve editors)
- [ ] Node grouping and templates
- [ ] Performance monitoring

#### Phase 4: Polish & UX (Week 4)
- [ ] Keyboard shortcuts documentation
- [ ] Interactive tutorials
- [ ] Example graphs and templates
- [ ] Export to standalone code
- [ ] Touch/mobile support
- [ ] Accessibility improvements

## Technical Debt & Refactoring

### Immediate Needs
1. **Connection Management**
   ```javascript
   // Current: connections stored but not visualized properly
   // Need: Proper connection class with visual representation
   class Connection {
     constructor(fromNode, fromPort, toNode, toPort) {
       this.id = generateId();
       this.from = { node: fromNode, port: fromPort };
       this.to = { node: toNode, port: toPort };
       this.path = null; // SVG path element
     }
     
     updatePath() {
       // Calculate bezier curve between ports
     }
   }
   ```

2. **Event System**
   - Current: Direct DOM manipulation
   - Need: Proper event bus for decoupled components
   - Implement node events: created, updated, deleted, connected

3. **State Synchronization**
   - Current: EditorState and miniGL can get out of sync
   - Need: Single source of truth with proper update propagation
   - Consider using Proxy for reactive updates

### Architecture Improvements
1. **Modularize NodeGraph.js**
   - Extract Connection rendering
   - Separate interaction handlers
   - Create dedicated Port component

2. **Improve Error Handling**
   - Wrap miniGL operations in try-catch
   - User-friendly error messages
   - Fallback states for failed operations

3. **Testing Infrastructure**
   - Unit tests for graph operations
   - Integration tests for miniGL bridge
   - Visual regression tests for UI

## Updated File Structure
```
editor/
├── src/
│   ├── components/
│   │   ├── UIManager.js          ✅
│   │   ├── NodeGraph.js          🚧 (needs connection fixes)
│   │   ├── PropertiesPanel.js    ✅
│   │   ├── NodePalette.js        ✅
│   │   ├── Connection.js         ❌ (to be created)
│   │   ├── Port.js               ❌ (to be created)
│   │   └── ShaderEditor.js       ❌ (to be created)
│   ├── core/
│   │   ├── EditorState.js        ✅
│   │   ├── CommandManager.js     ❌ (for undo/redo)
│   │   └── EventBus.js           ❌ (for decoupling)
│   ├── minigl-bridge/
│   │   └── MiniGLBridge.js       ✅
│   └── app.js                    ✅
├── style.css                     ✅
├── index.html                    ✅
└── test-minigl.html             ✅

lib/miniGL/
└── miniGL.js                     ✅ (patched with render method)
```

## Success Metrics

### Week 1 Goals
- [ ] Users can create texture → shader → output pipeline visually
- [ ] Shader parameters update in real-time
- [ ] Graph can be saved and loaded from JSON
- [ ] No console errors during normal operation

### Week 2 Goals
- [ ] Full CRUD operations on nodes and connections
- [ ] Undo/redo for all operations
- [ ] Keyboard shortcuts implemented
- [ ] Multi-selection working

### Week 3 Goals
- [ ] All miniGL node types supported
- [ ] Shader editor with error highlighting
- [ ] Performance stays above 30fps with 50+ nodes
- [ ] Custom shaders can be created and saved

### Week 4 Goals
- [ ] Polish and bug fixes complete
- [ ] Documentation and examples ready
- [ ] Mobile/touch support functional
- [ ] Ready for community feedback

## Risk Mitigation

### Identified Risks
1. **Connection System Complexity**
   - Risk: Bezier curve calculations and hit detection
   - Mitigation: Use established algorithms, add connection preview

2. **miniGL API Limitations**
   - Risk: Some operations may not be exposed
   - Mitigation: Contribute patches upstream, add wrapper methods

3. **Performance with Large Graphs**
   - Risk: SVG rendering may slow down
   - Mitigation: Implement viewport culling, use CSS transforms

4. **Shader Compilation Errors**
   - Risk: Poor error messages from WebGL
   - Mitigation: Pre-validation, better error formatting

## Next Immediate Actions

1. **Debug Connection Rendering** (2-3 hours)
   - Check SVG path generation in NodeGraph.renderConnections()
   - Verify connection data in EditorState
   - Add console logging for connection updates

2. **Implement Connection Dragging** (3-4 hours)
   - Add mouse event handlers to output ports
   - Create temporary connection during drag
   - Validate and create connection on valid drop

3. **Fix miniGL Integration** (2-3 hours)
   - Ensure proper node connection in miniGL
   - Debug why blur shader isn't applying
   - Add logging to track data flow

4. **Test Basic Pipeline** (1 hour)
   - Create texture → shader → output
   - Verify each step processes correctly
   - Document any remaining issues

---

This updated plan reflects the current state of implementation and provides a clear path forward to complete the shader graph functionality.