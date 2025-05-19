import ShaderNode from "./node-element.js";
import ConnectionManager from "./connection-manager.js";
import { getShaderDefinition } from "./shader-definitions.js";

// Import miniGL
import miniGL from "../lib/miniGL.js";

class NodeEditor {
  constructor() {
    this.canvas = document.getElementById("node-canvas");
    this.glCanvas = document.getElementById("gl-canvas");
    this.nodes = [];
    this.nodeCounter = 0;

    // Initialize the connection manager
    this.connectionManager = new ConnectionManager(this.canvas);

    // Initialize miniGL for WebGL rendering
    this.gl = new miniGL("gl-canvas");

    // Create an object to hold shader nodes
    this.shaderNodes = {};
    this.shaderConnections = {};

    // Setup UI event listeners
    this.setupEventListeners();

    // Setup animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupEventListeners() {
    // Add buttons event listeners
    document
      .getElementById("add-noise-node")
      .addEventListener("click", () => this.addNode("noise"));
    document
      .getElementById("add-color-node")
      .addEventListener("click", () => this.addNode("color"));
    document
      .getElementById("add-output-node")
      .addEventListener("click", () => this.addNode("output"));

    // Listen for connection events
    this.canvas.addEventListener("connection-created", (e) =>
      this.handleConnectionCreated(e.detail.connection)
    );
    this.canvas.addEventListener("connection-removed", (e) =>
      this.handleConnectionRemoved(e.detail.connection)
    );
  }

  addNode(type) {
    const definition = getShaderDefinition(type);
    if (!definition) return;

    // Create a unique ID for the node
    const id = `${type}-${this.nodeCounter++}`;

    // Create DOM node - first create it, then set attributes after appending
    const node = document.createElement("shader-node");
    this.canvas.appendChild(node);

    // Now set ID after the element is in the DOM
    node.setAttribute("id", id);

    // Wait for the custom element to be fully defined
    // This ensures the methods are available
    setTimeout(() => {
      node.setType(type);
      node.setTitle(definition.title);
      node.setInputs(definition.inputs);
      node.setOutputs(definition.outputs);
      node.setShaderSource(definition.shaderSource);

      // Position the node
      const x = 50 + Math.random() * (this.canvas.clientWidth - 230);
      const y = 50 + Math.random() * (this.canvas.clientHeight - 200);
      node.setPosition(x, y);
    }, 0);

    // Store the node
    this.nodes.push(node);

    // Create the shader in WebGL
    if (type === "noise") {
      this.shaderNodes[id] = this.gl.shader(definition.shaderSource, {
        name: id,
      });
    } else if (type === "color") {
      this.shaderNodes[id] = this.gl.shader(definition.shaderSource, {
        name: id,
        uniforms: definition.uniforms || {},
      });
    } else if (type === "output") {
      this.shaderNodes[id] = this.gl.shader(definition.shaderSource, {
        name: id,
      });
      // Set as output if it's an output node
      this.gl.output(this.shaderNodes[id]);
    }

    return node;
  }

  handleConnectionCreated(connection) {
    const sourceId = connection.sourceNode.id;
    const targetId = connection.targetNode.id;
    const sourcePort = connection.sourcePort;
    const targetPort = connection.targetPort;

    console.log(
      `Connection created: ${sourceId}.${sourcePort} -> ${targetId}.${targetPort}`
    );

    // Connect the shaders in WebGL
    if (this.shaderNodes[sourceId] && this.shaderNodes[targetId]) {
      // Store information about the connection
      const connectionId = `${sourceId}-${targetId}-${targetPort}`;
      this.shaderConnections[connectionId] = {
        source: this.shaderNodes[sourceId],
        target: this.shaderNodes[targetId],
        targetPort: targetPort,
      };

      // Connect the shaders
      this.gl.connect(
        this.shaderNodes[sourceId],
        this.shaderNodes[targetId],
        targetPort
      );

      // Re-render
      this.gl.render();
    }
  }

  handleConnectionRemoved(connection) {
    const sourceId = connection.sourceNode.id;
    const targetId = connection.targetNode.id;
    const targetPort = connection.targetPort;

    console.log(`Connection removed: ${sourceId} -> ${targetId}.${targetPort}`);

    // Remove the connection from WebGL
    const connectionId = `${sourceId}-${targetId}-${targetPort}`;
    if (this.shaderConnections[connectionId]) {
      // We don't have a direct way to disconnect in miniGL, but we can
      // handle this by updating the shader to use default values instead
      delete this.shaderConnections[connectionId];

      // Re-render
      this.gl.render();
    }
  }

  removeNode(nodeId) {
    // Find the node
    const nodeIndex = this.nodes.findIndex((node) => node.id === nodeId);
    if (nodeIndex === -1) return;

    const node = this.nodes[nodeIndex];

    // Remove all connections to/from this node
    const connections = this.connectionManager.getConnectionsByNode(node);
    connections.forEach((conn) =>
      this.connectionManager.removeConnection(conn)
    );

    // Remove the node from the DOM
    node.parentNode.removeChild(node);

    // Remove from our array
    this.nodes.splice(nodeIndex, 1);

    // Remove from WebGL (not directly supported in miniGL, but we can stop using it)
    if (this.shaderNodes[nodeId]) {
      // If this was an output node, set null as output
      if (node.type === "output") {
        this.gl.output(null);
      }

      delete this.shaderNodes[nodeId];
    }
  }

  animate() {
    // Update WebGL rendering
    this.gl.render();

    // Continue animation loop
    requestAnimationFrame(this.animate);
  }
}

// Initialize the editor when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const editor = new NodeEditor();

  // For demo purposes, create a basic graph automatically
  setTimeout(() => {
    const noiseNode = editor.addNode("noise");
    const colorNode = editor.addNode("color");
    const outputNode = editor.addNode("output");

    // Position them nicely
    noiseNode.setPosition(100, 100);
    colorNode.setPosition(350, 150);
    outputNode.setPosition(600, 200);
  }, 100);
});
