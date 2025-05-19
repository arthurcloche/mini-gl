class ConnectionManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.connections = [];
    this.connectionStartNode = null;
    this.connectionStartPort = null;
    this.connectionStartType = null;
    this.connectionStartElement = null;
    this.tempConnection = null;

    // Bind methods
    this.handlePortClick = this.handlePortClick.bind(this);
    this.handleNodeMove = this.handleNodeMove.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    // Setup event listeners
    this.canvas.addEventListener("port-clicked", this.handlePortClick);
    this.canvas.addEventListener("node-moved", this.handleNodeMove);
  }

  handlePortClick(event) {
    const { node, port, type, element } = event.detail;

    if (!this.connectionStartNode) {
      // Start a new connection
      this.startConnection(node, port, type, element);
    } else {
      // Complete a connection
      this.completeConnection(node, port, type, element);
    }
  }

  startConnection(node, port, type, element) {
    // Only outputs can start connections
    if (type === "input") {
      // Check if there's already a connection to this input
      const existingConnection = this.connections.find(
        (conn) => conn.targetNode === node && conn.targetPort === port
      );

      if (existingConnection) {
        // Remove the existing connection
        this.removeConnection(existingConnection);
        return;
      }

      return;
    }

    this.connectionStartNode = node;
    this.connectionStartPort = port;
    this.connectionStartType = type;
    this.connectionStartElement = element;

    // Create temp connection for visual feedback
    this.tempConnection = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    this.tempConnection.classList.add("connection");
    this.tempConnection.style.position = "absolute";
    this.tempConnection.style.left = "0";
    this.tempConnection.style.top = "0";
    this.tempConnection.style.width = "100%";
    this.tempConnection.style.height = "100%";
    this.tempConnection.style.pointerEvents = "none";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke", "#e24a4a");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    this.tempConnection.appendChild(path);

    this.canvas.appendChild(this.tempConnection);

    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mouseup", this.handleMouseUp);

    // Visual feedback for connection start
    element.classList.add("connecting");
  }

  completeConnection(endNode, endPort, endType, endElement) {
    // Clear temporary connection visual
    if (this.tempConnection) {
      this.canvas.removeChild(this.tempConnection);
      this.tempConnection = null;
    }

    // Remove connecting style
    this.connectionStartElement.classList.remove("connecting");

    // Check if the connection is valid (output -> input)
    if (this.connectionStartType === endType) {
      // Both inputs or both outputs - invalid
      this.resetConnectionState();
      return;
    }

    let sourceNode, sourcePort, targetNode, targetPort;

    if (this.connectionStartType === "output") {
      sourceNode = this.connectionStartNode;
      sourcePort = this.connectionStartPort;
      targetNode = endNode;
      targetPort = endPort;
    } else {
      sourceNode = endNode;
      sourcePort = endPort;
      targetNode = this.connectionStartNode;
      targetPort = this.connectionStartPort;
    }

    // Check if there's already a connection to this input
    const existingConnection = this.connections.find(
      (conn) => conn.targetNode === targetNode && conn.targetPort === targetPort
    );

    if (existingConnection) {
      // Remove the existing connection
      this.removeConnection(existingConnection);
    }

    // Create the connection
    this.createConnection(sourceNode, sourcePort, targetNode, targetPort);

    // Reset connection state
    this.resetConnectionState();
  }

  createConnection(sourceNode, sourcePort, targetNode, targetPort) {
    // Create SVG for connection
    const connectionSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    connectionSvg.classList.add("connection");
    connectionSvg.style.position = "absolute";
    connectionSvg.style.left = "0";
    connectionSvg.style.top = "0";
    connectionSvg.style.width = "100%";
    connectionSvg.style.height = "100%";
    connectionSvg.style.pointerEvents = "none";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke", "#e24a4a");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    connectionSvg.appendChild(path);

    this.canvas.appendChild(connectionSvg);

    // Store connection info
    const connection = {
      id: `conn-${Date.now()}`,
      sourceNode,
      sourcePort,
      targetNode,
      targetPort,
      element: connectionSvg,
      path,
    };

    this.connections.push(connection);

    // Update connection path
    this.updateConnectionPath(connection);

    // Notify nodes about the new connection
    this.dispatchConnectionEvent("connection-created", connection);

    return connection;
  }

  removeConnection(connection) {
    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
      if (connection.element && connection.element.parentNode) {
        connection.element.parentNode.removeChild(connection.element);
      }

      this.dispatchConnectionEvent("connection-removed", connection);
    }
  }

  updateConnectionPath(connection) {
    const { sourceNode, sourcePort, targetNode, targetPort, path } = connection;

    const sourcePortElement = sourceNode.querySelector(
      `.port-dot[data-port="${sourcePort}"][data-type="output"]`
    );
    const targetPortElement = targetNode.querySelector(
      `.port-dot[data-port="${targetPort}"][data-type="input"]`
    );

    if (!sourcePortElement || !targetPortElement) return;

    const sourceRect = sourcePortElement.getBoundingClientRect();
    const targetRect = targetPortElement.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();

    const start = {
      x: sourceRect.left + sourceRect.width / 2 - canvasRect.left,
      y: sourceRect.top + sourceRect.height / 2 - canvasRect.top,
    };

    const end = {
      x: targetRect.left + targetRect.width / 2 - canvasRect.left,
      y: targetRect.top + targetRect.height / 2 - canvasRect.top,
    };

    // Calculate control points for a smooth curve
    const dx = Math.abs(end.x - start.x);
    const controlOffsetX = Math.min(dx * 0.5, 80);

    // Create bezier curve path
    const pathString = `M ${start.x} ${start.y} C ${start.x + controlOffsetX} ${
      start.y
    }, ${end.x - controlOffsetX} ${end.y}, ${end.x} ${end.y}`;
    path.setAttribute("d", pathString);
  }

  handleNodeMove(event) {
    // Update connections involving the moved node
    this.connections.forEach((connection) => {
      if (
        connection.sourceNode === event.detail.node ||
        connection.targetNode === event.detail.node
      ) {
        this.updateConnectionPath(connection);
      }
    });
  }

  handleMouseMove(event) {
    if (!this.tempConnection || !this.connectionStartElement) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const sourceRect = this.connectionStartElement.getBoundingClientRect();

    const start = {
      x: sourceRect.left + sourceRect.width / 2 - canvasRect.left,
      y: sourceRect.top + sourceRect.height / 2 - canvasRect.top,
    };

    const end = {
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top,
    };

    // Calculate control points for a smooth curve
    const dx = Math.abs(end.x - start.x);
    const controlOffsetX = Math.min(dx * 0.5, 80);

    // Update the temp connection path
    const path = this.tempConnection.querySelector("path");
    const pathString = `M ${start.x} ${start.y} C ${start.x + controlOffsetX} ${
      start.y
    }, ${end.x - controlOffsetX} ${end.y}, ${end.x} ${end.y}`;
    path.setAttribute("d", pathString);
  }

  handleMouseUp(event) {
    // Cancel the connection if released on empty space
    if (this.tempConnection) {
      this.canvas.removeChild(this.tempConnection);
      this.tempConnection = null;
    }

    if (this.connectionStartElement) {
      this.connectionStartElement.classList.remove("connecting");
    }

    this.resetConnectionState();

    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
  }

  resetConnectionState() {
    this.connectionStartNode = null;
    this.connectionStartPort = null;
    this.connectionStartType = null;
    this.connectionStartElement = null;
  }

  dispatchConnectionEvent(eventType, connection) {
    const event = new CustomEvent(eventType, {
      bubbles: true,
      detail: { connection },
    });

    this.canvas.dispatchEvent(event);
  }

  updateAllConnections() {
    this.connections.forEach((connection) => {
      this.updateConnectionPath(connection);
    });
  }

  getConnectionsByNode(node) {
    return this.connections.filter(
      (conn) => conn.sourceNode === node || conn.targetNode === node
    );
  }

  getConnectionsBySourceNode(node) {
    return this.connections.filter((conn) => conn.sourceNode === node);
  }

  getConnectionsByTargetNode(node) {
    return this.connections.filter((conn) => conn.targetNode === node);
  }

  clear() {
    this.connections.forEach((connection) => {
      if (connection.element && connection.element.parentNode) {
        connection.element.parentNode.removeChild(connection.element);
      }
    });

    this.connections = [];
  }
}

export default ConnectionManager;
