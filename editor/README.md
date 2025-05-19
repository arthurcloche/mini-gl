# MiniGL Node Graph Shader Editor

A simple, web-based node graph editor for creating and visualizing WebGL shaders. This editor demonstrates a visual programming interface for shaders that integrates with the MiniGL library.

## Features

- Visual node-based interface for creating shader graphs
- Drag-and-drop node positioning
- Connect node inputs and outputs to create shader pipelines
- Real-time WebGL preview of the shader graph
- No dependencies (uses native Web Components)

## Usage

1. Open the `index.html` file in a modern browser
2. Use the buttons to add different node types:
   - Noise Generator: Creates procedural noise
   - Color Mapper: Maps noise values to colors
   - Output: Displays the final result
3. Connect nodes by clicking on output ports (red dots) and then input ports (blue dots)
4. The WebGL preview on the right will update automatically

## Architecture

The editor is built with the following components:

- **ShaderNode**: A Web Component for shader nodes with draggable behavior
- **ConnectionManager**: Handles connections between nodes
- **NodeEditor**: Main controller that ties the UI to the WebGL renderer
- **miniGL**: The WebGL library used for rendering the shaders

Each node represents a shader, and connections represent texture inputs/outputs between shaders.

## Extending

To add new node types:

1. Add a new shader definition in `shader-definitions.js`
2. Define inputs, outputs, and the GLSL shader code
3. Add a button in the HTML for the new node type

## Limitations

- Basic implementation with limited features
- No custom uniforms or property editors
- No saving/loading of shader graphs
- Limited error handling 