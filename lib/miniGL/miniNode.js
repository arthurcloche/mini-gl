/**
 * MiniNode - Base class for custom effect nodes in miniGL
 * Handles the common patterns for node interface, uniform routing, and internal node management
 */

export class MiniNode {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.minigl = null; // Will be set when added to miniGL

    // Standard node interface
    this.inputs = new Map();
    this.outputs = new Set();
    this.id =
      options.id ||
      `${this.constructor.name.toLowerCase()}_${Date.now()}_${Math.floor(
        Math.random() * 1000
      )}`;
    this.name = options.name || this.constructor.name;

    // Node configuration
    this.uniforms = options.uniforms || {};
    this.width = options.width || gl.canvas?.width || 512;
    this.height = options.height || gl.canvas?.height || 512;

    // Internal node management
    this.nodes = {};
    this.outputNode = null;

    // Configuration maps (to be defined by subclasses)
    this.inputRouting = new Map(); // Maps input names to internal node targets
    this.uniformBindings = new Map(); // Maps uniform names to arrays of internal node targets
    this.nodeDefinitions = []; // Array of node definitions for complex nodes
    this.nodeConnections = []; // Array of internal connections

    // Initialize if we have minigl reference
    if (options.minigl) {
      this.setMiniGL(options.minigl);
    }
  }

  // Called by miniGL when adding the node
  setMiniGL(minigl) {
    this.minigl = minigl;
    this.initializeInternalNodes();
    this.updateAllBindings();
  }

  // Initialize internal nodes - override in subclasses for complex nodes
  initializeInternalNodes() {
    // For simple nodes, create a single shader node
    if (this.fragmentShader && !this.nodeDefinitions.length) {
      this.nodes.main = this.minigl.shader(this.fragmentShader, {
        name: `${this.name}_Main`,
        uniforms: this.uniforms,
        ...this.shaderOptions,
      });
      this.outputNode = "main";
      return;
    }

    // For complex nodes, create all defined internal nodes
    for (const def of this.nodeDefinitions) {
      this.nodes[def.key] = this.createInternalNode(def);
    }

    // Make internal connections
    for (const conn of this.nodeConnections) {
      if (this.nodes[conn.source] && this.nodes[conn.target]) {
        this.nodes[conn.target].connect(conn.input, this.nodes[conn.source]);
      }
    }
  }

  // Create an internal node based on definition
  createInternalNode(def) {
    const nodeUniforms = this.getNodeUniforms(def.key);
    const options = {
      name: `${this.name}_${def.name}`,
      uniforms: nodeUniforms,
      ...def.options,
    };

    switch (def.type) {
      case "shader":
        return this.minigl.shader(def.fragmentShader, options);
      case "pingpong":
        return this.minigl.pingpong(def.fragmentShader, options);
      case "blend":
        return this.minigl.blend({ ...def.options, ...options });
      default:
        throw new Error(`Unknown internal node type: ${def.type}`);
    }
  }

  // Get uniforms for a specific internal node
  getNodeUniforms(nodeKey) {
    const nodeUniforms = {};
    for (const [uniformKey, targetNodes] of this.uniformBindings) {
      if (
        targetNodes.includes(nodeKey) &&
        this.uniforms[uniformKey] !== undefined
      ) {
        nodeUniforms[uniformKey] = this.uniforms[uniformKey];
      }
    }
    return nodeUniforms;
  }

  // Update a uniform and propagate to bound nodes
  updateUniform(key, value) {
    if (this.uniforms.hasOwnProperty(key)) {
      this.uniforms[key] = value;

      // Propagate to bound internal nodes
      const targetNodes = this.uniformBindings.get(key);
      if (targetNodes) {
        targetNodes.forEach((nodeKey) => {
          if (this.nodes[nodeKey]) {
            this.nodes[nodeKey].updateUniform(key, value);
          }
        });
      }
    }
    return this;
  }

  // Update all uniform bindings
  updateAllBindings() {
    for (const [uniformKey, targetNodes] of this.uniformBindings) {
      targetNodes.forEach((nodeKey) => {
        if (this.nodes[nodeKey] && this.uniforms[uniformKey] !== undefined) {
          this.nodes[nodeKey].updateUniform(
            uniformKey,
            this.uniforms[uniformKey]
          );
        }
      });
    }
  }

  // Standard node interface methods
  connect(inputName, sourceNode, outputName = "default") {
    this.inputs.set(inputName, { node: sourceNode, output: outputName });
    sourceNode.outputs.add(this);

    // Route to internal nodes
    const targetNodeKey = this.inputRouting.get(inputName);
    if (targetNodeKey && this.nodes[targetNodeKey]) {
      this.nodes[targetNodeKey].connect(inputName, sourceNode, outputName);
    }

    return this;
  }

  disconnect(inputName) {
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);

      // Disconnect from internal nodes
      const targetNodeKey = this.inputRouting.get(inputName);
      if (targetNodeKey && this.nodes[targetNodeKey]) {
        this.nodes[targetNodeKey].disconnect(inputName);
      }
    }
    return this;
  }

  // Return the output (delegate to internal output node)
  output(outputName = "default") {
    if (!this.nodes || !this.outputNode || !this.nodes[this.outputNode]) {
      return { texture: this.gl.TransparentPixel || null, width: 1, height: 1 };
    }
    return this.nodes[this.outputNode].output(outputName);
  }

  // Process method - handle internal node processing
  process(time) {
    if (!this.nodes) return;

    // For simple nodes, just process the main node
    if (this.nodes.main && this.outputNode === "main") {
      this.nodes.main.process(time);
      return;
    }

    // For complex nodes, process in dependency order
    // This is a simple approach - could be more sophisticated with actual topological sort
    for (const nodeKey of Object.keys(this.nodes)) {
      this.nodes[nodeKey].process(time);
    }
  }

  // Size method
  size() {
    if (!this.nodes || !this.outputNode || !this.nodes[this.outputNode]) {
      return [this.width, this.height];
    }
    return this.nodes[this.outputNode].size();
  }

  // Resize method
  resize(width, height) {
    this.width = width;
    this.height = height;

    // Resize all internal nodes
    for (const node of Object.values(this.nodes)) {
      if (node.resize) {
        node.resize(width, height);
      }
    }

    return this;
  }

  // Dispose method
  dispose() {
    for (const node of Object.values(this.nodes)) {
      if (node.dispose) {
        node.dispose();
      }
    }
    this.nodes = {};
  }
}

export default MiniNode;
