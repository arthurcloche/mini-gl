/**
 * ProxyNode - A wrapper class that creates a full Node interface around internal node graphs
 * Perfect for factory functions that need to encapsulate complex multi-node effects
 */
export class ProxyNode {
  constructor(gl, outputNode, options = {}) {
    this.gl = gl;
    this.outputNode = outputNode; // The final node in the internal chain
    this.internalNodes = options.internalNodes || [outputNode]; // All internal nodes for processing

    // Node interface properties (required for graph integration)
    this.inputs = new Map();
    this.outputs = new Set();
    this.id =
      options.id || `proxy_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.name = options.name || "Proxy Node";
    this.isProcessing = false;
    this.lastUpdateTime = 0;
    this._lastFrame = -1;
    this._lastOutput = null;

    // Input routing configuration
    this.inputRouting = new Map(); // Maps proxy input names to {node, input} objects
    this.uniformMappings = new Map(); // Maps external uniform names to {node, uniform} objects

    // Register with miniGL
    gl.nodes.set(this.id, this);
  }

  // Configure how external inputs map to specific internal nodes and their inputs
  mapInput(
    externalInputName,
    targetNode,
    internalInputName = externalInputName
  ) {
    // If only two params provided, assume it's for the output node
    if (typeof targetNode === "string") {
      internalInputName = targetNode;
      targetNode = this.outputNode;
    }
    this.inputRouting.set(externalInputName, {
      node: targetNode,
      input: internalInputName,
    });
    return this;
  }

  // Configure how external uniform names map to specific internal nodes and their uniforms
  mapUniform(externalName, targetNode, internalUniformName = externalName) {
    // If only two params provided, assume it's for the output node
    if (typeof targetNode === "string") {
      internalUniformName = targetNode;
      targetNode = this.outputNode;
    }
    this.uniformMappings.set(externalName, {
      node: targetNode,
      uniform: internalUniformName,
    });
    return this;
  }

  // Core Node interface methods - process all internal nodes
  process(time) {
    // Process all internal nodes (they should be in dependency order)
    for (const node of this.internalNodes) {
      if (node.process) {
        node.process(time);
      }
    }
  }

  update(time, frameId) {
    // Implement frame-based caching like core Node class
    if (this._lastFrame === frameId) return this._lastOutput;
    this._lastFrame = frameId;

    // Update inputs first (topological sort handles this, but for safety)
    for (const [inputName, connection] of this.inputs) {
      connection.node.update?.(time, frameId);
    }

    // Process this node
    this.process(time);
    this.lastUpdateTime = time;

    // Cache output
    this._lastOutput = this.output();
    return this._lastOutput;
  }

  output(outputName = "default") {
    return this.outputNode.output ? this.outputNode.output(outputName) : null;
  }

  size() {
    return this.outputNode.size ? this.outputNode.size() : [512, 512];
  }

  resize(width, height) {
    // Resize all internal nodes
    for (const node of this.internalNodes) {
      if (node.resize) {
        node.resize(width, height);
      }
    }
    return this;
  }

  // Connection methods with optional custom routing
  connect(inputName, sourceNode, outputName = "default") {
    // Track the connection for graph integration
    this.inputs.set(inputName, { node: sourceNode, output: outputName });
    sourceNode.outputs.add(this);

    // Route to specific internal node using mapping or default to output node
    const routing = this.inputRouting.get(inputName);
    if (routing) {
      routing.node.connect(routing.input, sourceNode, outputName);
    } else {
      // Default: connect to output node with same input name
      this.outputNode.connect(inputName, sourceNode, outputName);
    }

    // Call custom connection handler if defined
    if (this.onConnect) {
      this.onConnect(inputName, sourceNode, outputName);
    }

    return this;
  }

  disconnect(inputName) {
    // Remove from tracking
    const connection = this.inputs.get(inputName);
    if (connection) {
      connection.node.outputs.delete(this);
      this.inputs.delete(inputName);
    }

    // Disconnect from specific internal node
    const routing = this.inputRouting.get(inputName);
    if (routing) {
      routing.node.disconnect(routing.input);
    } else {
      // Default: disconnect from output node
      this.outputNode.disconnect(inputName);
    }

    // Call custom disconnection handler if defined
    if (this.onDisconnect) {
      this.onDisconnect(inputName);
    }

    return this;
  }

  // Uniform management with specific node targeting
  updateUniform(key, value) {
    // Route to specific node if mapped
    const mapping = this.uniformMappings.get(key);
    if (mapping) {
      mapping.node.updateUniform(mapping.uniform, value);
    } else {
      // Default: update on output node
      if (this.outputNode.updateUniform) {
        this.outputNode.updateUniform(key, value);
      }
    }

    // Call custom uniform handler if defined
    if (this.onUniformUpdate) {
      this.onUniformUpdate(key, value, mapping);
    }

    return this;
  }

  // Cleanup
  dispose() {
    // Clean up connections
    for (const connection of this.inputs.values()) {
      connection.node.outputs.delete(this);
    }
    this.inputs.clear();

    for (const outputNode of this.outputs) {
      if (outputNode.disconnect) {
        outputNode.disconnect(this);
      }
    }
    this.outputs.clear();

    // Remove from miniGL registry
    this.gl.nodes.delete(this.id);

    // Dispose all internal nodes
    for (const node of this.internalNodes) {
      if (node.dispose) {
        node.dispose();
      }
    }
  }

  // Helper methods for common patterns
  addHelperMethod(name, fn) {
    this[name] = fn.bind(this);
    return this;
  }

  // Set custom handlers
  setConnectionHandler(onConnect, onDisconnect = null) {
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    return this;
  }

  setUniformHandler(onUniformUpdate) {
    this.onUniformUpdate = onUniformUpdate;
    return this;
  }
}

export default ProxyNode;
