// Define the custom element before the class definition
if (!customElements.get("shader-node")) {
  class ShaderNode extends HTMLElement {
    constructor() {
      super();
      this.isDragging = false;
      this.position = { x: 0, y: 0 };
      this.mouseOffset = { x: 0, y: 0 };
      this.connections = [];
      this.type = "";
      this.title = "";
      this.inputs = [];
      this.outputs = [];
      this.shaderSource = "";

      // Bind methods
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onMouseUp = this.onMouseUp.bind(this);
      this.setType = this.setType.bind(this);
      this.setTitle = this.setTitle.bind(this);
      this.setInputs = this.setInputs.bind(this);
      this.setOutputs = this.setOutputs.bind(this);
      this.setShaderSource = this.setShaderSource.bind(this);
      this.setPosition = this.setPosition.bind(this);
    }

    connectedCallback() {
      this.classList.add("node");
      this.render();
      this.initDragBehavior();
    }

    initDragBehavior() {
      const header = this.querySelector(".node-header");
      header.addEventListener("mousedown", this.onMouseDown);
    }

    onMouseDown(e) {
      this.isDragging = true;
      const rect = this.getBoundingClientRect();
      this.mouseOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      document.addEventListener("mousemove", this.onMouseMove);
      document.addEventListener("mouseup", this.onMouseUp);

      // Bring to front
      this.style.zIndex = "10";
    }

    onMouseMove(e) {
      if (!this.isDragging) return;

      const canvas = this.parentElement;
      const canvasRect = canvas.getBoundingClientRect();

      this.position = {
        x: e.clientX - canvasRect.left - this.mouseOffset.x,
        y: e.clientY - canvasRect.top - this.mouseOffset.y,
      };

      // Clamp to canvas bounds
      this.position.x = Math.max(
        0,
        Math.min(this.position.x, canvasRect.width - this.offsetWidth)
      );
      this.position.y = Math.max(
        0,
        Math.min(this.position.y, canvasRect.height - this.offsetHeight)
      );

      this.style.left = `${this.position.x}px`;
      this.style.top = `${this.position.y}px`;

      // Update connections
      this.dispatchEvent(
        new CustomEvent("node-moved", {
          bubbles: true,
          detail: { node: this, position: this.position },
        })
      );
    }

    onMouseUp() {
      this.isDragging = false;
      document.removeEventListener("mousemove", this.onMouseMove);
      document.removeEventListener("mouseup", this.onMouseUp);
      this.style.zIndex = "1";
    }

    setPosition(x, y) {
      this.position = { x, y };
      this.style.left = `${x}px`;
      this.style.top = `${y}px`;
    }

    setType(type) {
      this.type = type;
      this.setAttribute("data-type", type);
    }

    setTitle(title) {
      this.title = title;
      const headerEl = this.querySelector(".node-header");
      if (headerEl) {
        headerEl.textContent = title;
      }
    }

    setShaderSource(source) {
      this.shaderSource = source;
    }

    setInputs(inputs) {
      this.inputs = inputs;
      this.renderPorts();
    }

    setOutputs(outputs) {
      this.outputs = outputs;
      this.renderPorts();
    }

    renderPorts() {
      const inputsContainer = this.querySelector(".node-inputs");
      const outputsContainer = this.querySelector(".node-outputs");

      if (inputsContainer) {
        inputsContainer.innerHTML = "";
        this.inputs.forEach((input) => {
          const port = document.createElement("div");
          port.classList.add("port", "port-in");
          port.innerHTML = `
            <div class="port-dot" data-port="${input.name}" data-type="input"></div>
            <span class="port-label">${input.name}</span>
          `;
          inputsContainer.appendChild(port);

          // Add port click handler for connections
          const dot = port.querySelector(".port-dot");
          dot.addEventListener("mousedown", (e) => {
            e.stopPropagation(); // Prevent node dragging
            this.dispatchEvent(
              new CustomEvent("port-clicked", {
                bubbles: true,
                detail: {
                  node: this,
                  port: input.name,
                  type: "input",
                  element: dot,
                },
              })
            );
          });
        });
      }

      if (outputsContainer) {
        outputsContainer.innerHTML = "";
        this.outputs.forEach((output) => {
          const port = document.createElement("div");
          port.classList.add("port", "port-out");
          port.innerHTML = `
            <span class="port-label">${output.name}</span>
            <div class="port-dot" data-port="${output.name}" data-type="output"></div>
          `;
          outputsContainer.appendChild(port);

          // Add port click handler for connections
          const dot = port.querySelector(".port-dot");
          dot.addEventListener("mousedown", (e) => {
            e.stopPropagation(); // Prevent node dragging
            this.dispatchEvent(
              new CustomEvent("port-clicked", {
                bubbles: true,
                detail: {
                  node: this,
                  port: output.name,
                  type: "output",
                  element: dot,
                },
              })
            );
          });
        });
      }
    }

    render() {
      this.innerHTML = `
        <div class="node-header">${this.title || "Node"}</div>
        <div class="node-content">
          <div class="node-ports">
            <div class="node-inputs"></div>
            <div class="node-outputs"></div>
          </div>
        </div>
      `;
      this.renderPorts();
    }
  }

  // Define the custom element
  customElements.define("shader-node", ShaderNode);
}

// Export the custom element constructor
export default customElements.get("shader-node");
