import editorState from "../core/EditorState.js";
import miniGLBridge from "../minigl-bridge/MiniGLBridge.js";

export class PropertiesPanel {
  constructor() {
    this.currentNodeId = null;
  }

  initialize() {
    // Set up documentation button
    const docsBtn = document.getElementById("docsBtn");
    if (docsBtn) {
      docsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.miniGLEditor && window.miniGLEditor.showDocs) {
          window.miniGLEditor.showDocs();
        }
      });
    }
  }

  update() {
    const propertiesPanel = document.getElementById("nodeProperties");
    const propertiesHeader = propertiesPanel?.querySelector(".panel-header h3");

    if (!propertiesPanel || !propertiesHeader) return;

    // Always use the selected node from editor state
    const nodeId = editorState.selectedNode;

    if (!nodeId) {
      // Show empty panel when no node is selected
      propertiesHeader.textContent = "Node Properties";
      this.showEmptyPanel();
      this.currentNodeId = null;
      return;
    }

    const node = editorState.getNode(nodeId);
    if (!node) return;

    // Update currentNodeId to track the current node
    this.currentNodeId = node.id;
    propertiesHeader.textContent = `${node.name} Properties`;

    // Update properties content based on node type
    const propertiesContent = document.querySelector(".properties-content");
    if (!propertiesContent) return;

    switch (node.type) {
      case "Texture":
        this.renderMediaProperties(propertiesContent, node);
        break;
      case "Canvas":
        this.renderCanvasProperties(propertiesContent, node);
        break;
      case "Text":
        this.renderTextProperties(propertiesContent, node);
        break;
      case "Blend":
        this.renderBlendProperties(propertiesContent, node);
        break;
      default:
        this.renderShaderProperties(propertiesContent, node);
    }

    // Re-initialize collapsibles and other interactions
    this.initializePropertyInteractions();
  }

  renderMediaProperties(container, node) {
    const loadingClass = node.loadingState === 'loading' ? 'loading' : '';
    const errorClass = node.loadingState === 'error' ? 'error' : '';
    
    container.innerHTML = `
            <div class="property-group">
                <h4>Image Source</h4>
                <div class="property-item">
                    <label>URL ${node.loadingState === 'loading' ? '<span style="color: #4a90e2; font-size: 11px;">⏳ Loading...</span>' : ''}</label>
                    <input type="text" class="text-input url-input ${loadingClass} ${errorClass}" 
                        placeholder="https://picsum.photos/800/600" 
                        value="${node.url || ""}"
                        data-node-id="${node.id}"
                        ${node.loadingState === 'loading' ? 'disabled' : ''}>
                </div>
                ${node.loadingState === 'error' ? '<div class="property-item" style="color: #ff6b6b; font-size: 11px;">❌ Failed to load image. This may be a CORS issue if using an external URL. Try Lorem Picsum or upload a local file.</div>' : ''}
                ${node.loadingState === 'loading' ? '<div class="property-item" style="color: #4a90e2; font-size: 10px; opacity: 0.8;">⏳ Wait for image to load. The hourglass will disappear when ready.</div>' : ''}
                ${node.loadingState === 'error' ? '' : node.loadingState !== 'loading' ? '<div class="property-item" style="color: #51cf66; font-size: 10px; opacity: 0.8;">✓ Image loaded successfully</div>' : ''}
                <div class="property-item">
                    <div style="display: flex; gap: 8px;">
                        <input type="file" class="file-input" accept="image/*" style="display: none;" data-node-id="${
                          node.id
                        }">
                        <button class="control-btn upload-btn" style="flex: 1; padding: 6px 12px; background: #2a2a3a; border: 1px solid #3a3a4a; border-radius: 4px; color: #888; font-size: 11px; cursor: pointer; transition: all 0.2s;">Upload</button>
                        <button class="control-btn random-btn" style="flex: 1; padding: 6px 12px; background: #2a2a3a; border: 1px solid #3a3a4a; border-radius: 4px; color: #888; font-size: 11px; cursor: pointer; transition: all 0.2s;">Random</button>
                    </div>
                </div>
                <div class="property-item">
                    <label>Fit Mode</label>
                    <select class="dropdown size-mode-select" data-value="${
                      node.sizeMode || "cover"
                    }">
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="stretch">Stretch</option>
                    </select>
                </div>
            </div>
        `;

    // Add event handlers
    setTimeout(() => {
      const urlInput = container.querySelector(".url-input");

      if (urlInput) {
        urlInput.addEventListener("change", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            miniGLBridge.updateNodeProperty(
              currentNode.id,
              "url",
              e.target.value
            );
          }
        });

        // Drag and drop support
        urlInput.addEventListener("dragover", (e) => {
          e.preventDefault();
          urlInput.style.background = "#2a4a2a";
        });

        urlInput.addEventListener("dragleave", (e) => {
          urlInput.style.background = "";
        });

        urlInput.addEventListener("drop", (e) => {
          e.preventDefault();
          urlInput.style.background = "";

          const files = e.dataTransfer.files;
          if (files.length > 0 && files[0].type.startsWith("image/")) {
            const objectUrl = URL.createObjectURL(files[0]);
            urlInput.value = objectUrl;
            urlInput.dispatchEvent(new Event("change"));
          }
        });
      }

      // Add upload button handler
      const uploadBtn = container.querySelector(".upload-btn");
      const fileInput = container.querySelector(".file-input");

      if (uploadBtn && fileInput) {
        uploadBtn.addEventListener("click", () => {
          fileInput.click();
        });

        fileInput.addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (file && file.type.startsWith("image/")) {
            const objectUrl = URL.createObjectURL(file);
            if (urlInput) {
              urlInput.value = objectUrl;
              urlInput.dispatchEvent(new Event("change"));
            }
          }
        });
      }

      // Add random button handler
      const randomBtn = container.querySelector(".random-btn");
      if (randomBtn) {
        randomBtn.addEventListener("click", () => {
          // Use the curated list from EditorState
          const randomUrl = editorState.getRandomPicsumUrl();
          if (urlInput) {
            urlInput.value = randomUrl;
            urlInput.dispatchEvent(new Event("change"));
          }
        });
      }

      // Add size mode handler with proper selection
      const sizeModeSelect = container.querySelector(".size-mode-select");
      if (sizeModeSelect) {
        // Set initial value
        const initialValue = sizeModeSelect.getAttribute("data-value");
        if (initialValue) {
          sizeModeSelect.value = initialValue;
        }

        sizeModeSelect.addEventListener("change", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.sizeMode = e.target.value;
            miniGLBridge.updateNodeProperty(
              currentNode.id,
              "sizeMode",
              e.target.value
            );

            // Force a render to show the size mode change immediately
            if (miniGLBridge.minigl?.renderToScreen) {
              miniGLBridge.minigl.renderToScreen();
            }
          }
        });
      }
    }, 0);
  }

  renderCanvasProperties(container, node) {
    const hasError = node.hasError;
    container.innerHTML = `
            <div class="property-group">
                <h4>Canvas Settings ${
                  hasError
                    ? '<span style="color: #ff6b6b;">⚠️ Error</span>'
                    : ""
                }</h4>
                <div class="property-item">
                    <label>Size Mode</label>
                    <select class="dropdown size-mode-select" data-node-id="${node.id}">
                        <option value="responsive" ${node.sizeMode === 'responsive' || !node.sizeMode ? 'selected' : ''}>Responsive</option>
                        <option value="fixed" ${node.sizeMode === 'fixed' ? 'selected' : ''}>Fixed</option>
                    </select>
                </div>
                <div class="property-item" ${node.sizeMode === 'responsive' || !node.sizeMode ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                    <label>Width</label>
                    <input type="number" class="number-input canvas-width" 
                        value="${
                          node.width || 512
                        }" min="64" max="4096" step="64">
                </div>
                <div class="property-item" ${node.sizeMode === 'responsive' || !node.sizeMode ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                    <label>Height</label>
                    <input type="number" class="number-input canvas-height" 
                        value="${
                          node.height || 512
                        }" min="64" max="4096" step="64">
                </div>
                <div class="canvas-buttons">
                    <button class="match-canvas-btn" onclick="matchWebGLCanvas()">Match WebGL</button>
                    <button class="edit-code-btn">Edit Code</button>
                </div>
            </div>
            
            <div class="property-group">
                <h4 class="collapsible-header">Advanced <span class="toggle">+</span></h4>
                <div class="collapsible-content" style="display: none;">
                    <div class="property-item">
                        <label>Frame Rate</label>
                        <select class="dropdown fps-select">
                            <option value="60">60 FPS</option>
                            <option value="30">30 FPS</option>
                            <option value="24">24 FPS</option>
                            <option value="12">12 FPS</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>Image Smoothing</label>
                        <input type="checkbox" class="checkbox image-smoothing" checked>
                    </div>
                </div>
            </div>
        `;

    // Add canvas event handlers
    setTimeout(() => {
      const editBtn = container.querySelector(".edit-code-btn");
      const widthInput = container.querySelector(".canvas-width");
      const heightInput = container.querySelector(".canvas-height");
      const sizeModeSelect = container.querySelector(".size-mode-select");

      if (sizeModeSelect) {
        sizeModeSelect.addEventListener("change", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.sizeMode = e.target.value;
            
            // If switching to responsive, update size immediately
            if (currentNode.sizeMode === 'responsive') {
              const canvas = document.getElementById('preview');
              if (canvas) {
                const dpr = Math.max(2, window.devicePixelRatio || 1);
                currentNode.width = canvas.width;
                currentNode.height = canvas.height;
                this.updateCanvasNode(currentNode);
              }
            }
            
            // Re-render properties panel to update disabled state
            this.update();
          }
        });
      }

      if (editBtn) {
        editBtn.addEventListener("click", () => {
          window.toggleCanvasEditor?.(node.id);
        });
      }

      if (widthInput) {
        widthInput.addEventListener("change", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode && currentNode.sizeMode === 'fixed') {
            currentNode.width = parseInt(e.target.value);
            this.updateCanvasNode(currentNode);
          }
        });
      }

      if (heightInput) {
        heightInput.addEventListener("change", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode && currentNode.sizeMode === 'fixed') {
            currentNode.height = parseInt(e.target.value);
            this.updateCanvasNode(currentNode);
          }
        });
      }
    }, 0);
  }

  renderTextProperties(container, node) {
    const googleFonts = [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Georgia",
      "Verdana",
      "Open Sans",
      "Roboto",
      "Lato",
      "Montserrat",
      "Source Sans Pro",
      "Oswald",
      "Raleway",
      "Poppins",
      "Merriweather",
      "Playfair Display",
    ];

    container.innerHTML = `
            <div class="property-group">
                <h4>Text Content</h4>
                <div class="property-item">
                    <label>Text</label>
                    <textarea class="text-input text-content" 
                        placeholder="Enter your text here...
Line breaks are supported"
                        rows="4"
                        data-node-id="${node.id}">${
      node.text || "Hello World\nMultiple lines\nsupported!"
    }</textarea>
                </div>
            </div>
            
            <div class="property-group">
                <h4>Typography</h4>
                <div class="property-item">
                    <label>Font Size</label>
                    <div class="slider-container">
                        <input type="range" class="slider font-size-slider" 
                            min="8" max="72" step="1" 
                            value="${node.fontSize || 24}"
                            data-node-id="${node.id}">
                        <span class="value">${node.fontSize || 24}px</span>
                    </div>
                </div>
                <div class="property-item">
                    <label>Font Family</label>
                    <select class="dropdown font-family-select" data-node-id="${
                      node.id
                    }">
                        ${googleFonts
                          .map(
                            (font) =>
                              `<option value="${font}" ${
                                (node.fontFamily || "Arial") === font
                                  ? "selected"
                                  : ""
                              }>${font}</option>`
                          )
                          .join("")}
                    </select>
                </div>
                <div class="property-item">
                    <label>Font Color</label>
                    <input type="color" class="color-input font-color-picker" 
                        value="${node.fontColor || "#ffffff"}"
                        data-node-id="${node.id}">
                </div>
            </div>
            
            <div class="property-group">
                <h4>Position</h4>
                <div class="property-item">
                    <label>Position X</label>
                    <input type="range" class="slider text-pos-x" 
                        value="${
                          node.posX || 0
                        }" min="-1" max="1" step="0.01">
                    <span class="value">${(node.posX || 0).toFixed(2)}</span>
                </div>
                <div class="property-item">
                    <label>Position Y</label>
                    <input type="range" class="slider text-pos-y" 
                        value="${
                          node.posY || 0
                        }" min="-1" max="1" step="0.01">
                    <span class="value">${(node.posY || 0).toFixed(2)}</span>
                </div>
            </div>
        `;

    // Add text property event handlers
    setTimeout(() => {
      const textContent = container.querySelector(".text-content");
      const fontSizeSlider = container.querySelector(".font-size-slider");
      const fontFamilySelect = container.querySelector(".font-family-select");
      const fontColorPicker = container.querySelector(".font-color-picker");
      const posXSlider = container.querySelector(".text-pos-x");
      const posYSlider = container.querySelector(".text-pos-y");

      // Text content handler
      if (textContent) {
        textContent.addEventListener("input", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.text = e.target.value;
            this.updateTextNode(currentNode);
          }
        });
      }

      // Font size handler
      if (fontSizeSlider) {
        fontSizeSlider.addEventListener("input", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.fontSize = parseInt(e.target.value);
            // Update slider value display
            const valueSpan = container.querySelector(
              ".font-size-slider + .value"
            );
            if (valueSpan) valueSpan.textContent = `${currentNode.fontSize}px`;
            this.updateTextNode(currentNode);
          }
        });
      }

      // Font family handler
      if (fontFamilySelect) {
        fontFamilySelect.addEventListener("change", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.fontFamily = e.target.value;
            this.loadGoogleFont(e.target.value);
            this.updateTextNode(currentNode);
          }
        });

        // Load the initial font
        this.loadGoogleFont(node.fontFamily || "Arial");
      }

      // Font color handler
      if (fontColorPicker) {
        fontColorPicker.addEventListener("change", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.fontColor = e.target.value;
            this.updateTextNode(currentNode);
          }
        });
      }

      // Position handlers
      if (posXSlider) {
        posXSlider.addEventListener("input", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.posX = parseFloat(e.target.value);
            // Update slider value display
            const valueSpan = container.querySelector(
              ".text-pos-x + .value"
            );
            if (valueSpan) valueSpan.textContent = currentNode.posX.toFixed(2);
            this.updateTextNode(currentNode);
          }
        });
      }

      if (posYSlider) {
        posYSlider.addEventListener("input", (e) => {
          const currentNode = editorState.getNode(node.id);
          if (currentNode) {
            currentNode.posY = parseFloat(e.target.value);
            // Update slider value display
            const valueSpan = container.querySelector(
              ".text-pos-y + .value"
            );
            if (valueSpan) valueSpan.textContent = currentNode.posY.toFixed(2);
            this.updateTextNode(currentNode);
          }
        });
      }
    }, 0);
  }

  loadGoogleFont(fontFamily) {
    // Only load Google Fonts (not system fonts)
    const systemFonts = [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Georgia",
      "Verdana",
    ];
    if (systemFonts.includes(fontFamily)) {
      return;
    }

    // Check if font is already loaded
    const existingLink = document.querySelector(
      `link[href*="${fontFamily.replace(" ", "+")}"]`
    );
    if (existingLink) {
      return;
    }

    // Create link element for Google Fonts
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(
      " ",
      "+"
    )}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }

  updateTextNode(node) {
    // Recreate the miniGL node with updated properties
    const miniglNode = editorState.miniglNodes.get(node.id);
    if (miniglNode && editorState.minigl) {
      // Remove old node
      editorState.miniglNodes.delete(node.id);

      // Create new node with updated properties
      const newMiniglNode = editorState.createMiniGLNode(node);

      // If this is the output node, update the output
      if (editorState.outputNode === node.id && newMiniglNode) {
        editorState.minigl.output(newMiniglNode);

        // Force a render
        setTimeout(() => {
          if (editorState.minigl.renderToScreen) {
            editorState.minigl.renderToScreen();
          }
        }, 50);
      }
    }
  }

  updateCanvasNode(node) {
    // Update the miniGL node with new properties
    const miniglNode = editorState.miniglNodes.get(node.id);
    if (miniglNode && editorState.minigl) {
      // If the node has a resize method, use it
      if (miniglNode.resize && typeof miniglNode.resize === 'function') {
        miniglNode.resize(node.width, node.height);
        miniglNode.dirty = true;
      } else {
        // Fallback: recreate the node
        editorState.miniglNodes.delete(node.id);
        editorState.createMiniGLNode(node);
      }
      
      // Mark all dependent nodes as dirty to force reprocessing
      editorState.connections
        .filter(c => c.from === node.id)
        .forEach(conn => {
          const toMiniGL = editorState.miniglNodes.get(conn.to);
          if (toMiniGL && toMiniGL.dirty !== undefined) {
            toMiniGL.dirty = true;
          }
        });

      // Force a render
      if (editorState.minigl.renderToScreen) {
        editorState.minigl.renderToScreen();
      }
    }
  }

  renderBlendProperties(container, node) {
    const nodes = Array.from(editorState.nodes.values());

    // Find connections to this blend node
    const connections = editorState.connections.filter((c) => c.to === node.id);
    const baseNodeId = connections[0]?.from || "";
    const blendNodeId = connections[1]?.from || "";

    container.innerHTML = `
            <div class="property-group">
                <h4>Blend Mode</h4>
                <div class="property-item">
                    <label>Mode</label>
                    <select class="dropdown blend-mode-select">
                        <option value="screen" ${
                          node.blendMode === "screen" ? "selected" : ""
                        }>Screen</option>
                        <option value="multiply" ${
                          node.blendMode === "multiply" ? "selected" : ""
                        }>Multiply</option>
                        <option value="overlay" ${
                          node.blendMode === "overlay" ? "selected" : ""
                        }>Overlay</option>
                    </select>
                </div>
            </div>
            
            <div class="property-group">
                <h4>Inputs</h4>
                <div class="input-item">
                    <label>Base</label>
                    <select class="input-source blend-input" data-input-index="0">
                        <option value="">None</option>
                        ${nodes
                          .filter((n) => n.id !== node.id)
                          .map(
                            (n) =>
                              `<option value="${n.id}" ${
                                n.id === baseNodeId ? "selected" : ""
                              }>${n.name || n.id}</option>`
                          )
                          .join("")}
                    </select>
                    <button class="remove-input">✕</button>
                </div>
                <div class="input-item">
                    <label>Blend</label>
                    <select class="input-source blend-input" data-input-index="1">
                        <option value="">None</option>
                        ${nodes
                          .filter((n) => n.id !== node.id)
                          .map(
                            (n) =>
                              `<option value="${n.id}" ${
                                n.id === blendNodeId ? "selected" : ""
                              }>${n.name || n.id}</option>`
                          )
                          .join("")}
                    </select>
                    <button class="remove-input">✕</button>
                </div>
            </div>
        `;

    // Add event listener for blend mode changes
    setTimeout(() => {
      const blendModeSelect = container.querySelector(".blend-mode-select");
      if (blendModeSelect) {
        blendModeSelect.addEventListener("change", (e) => {
          miniGLBridge.updateNodeProperty(node.id, "blendMode", e.target.value);

          // Force a render to show the blend mode change immediately
          if (window.miniGLEditor?.miniGLBridge?.minigl?.renderToScreen) {
            window.miniGLEditor.miniGLBridge.minigl.renderToScreen();
          }
        });
      }

      // Add event listeners for blend input dropdowns
      container.querySelectorAll(".blend-input").forEach((select) => {
        select.addEventListener("change", (e) => {
          const inputIndex = parseInt(select.getAttribute("data-input-index"));
          const newSourceId = e.target.value;

          // Remove existing connection at this index
          const existingConnections = editorState.connections.filter(
            (c) => c.to === node.id
          );
          if (existingConnections[inputIndex]) {
            editorState.disconnectNodes(
              existingConnections[inputIndex].from,
              node.id
            );
          }

          // Add new connection if a source was selected
          if (newSourceId) {
            editorState.connectNodes(newSourceId, node.id);
          }

          // Force a render to show the connection change
          if (window.miniGLEditor?.miniGLBridge?.minigl?.renderToScreen) {
            window.miniGLEditor.miniGLBridge.minigl.renderToScreen();
          }
        });
      });
    }, 0);
  }

  renderShaderProperties(container, node) {
    const nodes = Array.from(editorState.nodes.values());

    container.innerHTML = `
            <div class="property-group">
                <h4>Uniforms</h4>
                ${Object.entries(node.uniforms || {})
                  .map(
                    ([name, uniform]) => `
                    <div class="property-item" data-uniform="${name}">
                        <input type="text" class="text-input uniform-name" value="${name}" style="width: 100px; margin-right: 8px;">
                        <div class="uniform-controls">
                            <select class="uniform-type">
                                <option value="slider" ${
                                  uniform.type === "slider" ? "selected" : ""
                                }>Slider</option>
                                <option value="constant" ${
                                  uniform.type === "constant" ? "selected" : ""
                                }>Constant</option>
                                <option value="sine" ${
                                  uniform.type === "sine" ? "selected" : ""
                                }>Sine</option>
                                <option value="toggle" ${
                                  uniform.type === "toggle" ? "selected" : ""
                                }>Toggle</option>
                            </select>
                            ${
                              uniform.type === "toggle"
                                ? `<input type="checkbox" ${
                                    uniform.value ? "checked" : ""
                                  } class="checkbox uniform-toggle">`
                                : uniform.type === "constant"
                                ? `<input type="text" value="${uniform.value}" class="text-input uniform-constant">`
                                : `<input type="range" min="${
                                    uniform.min || 0
                                  }" max="${uniform.max || 1}" 
                                    step="0.01" value="${
                                      uniform.value
                                    }" class="slider uniform-slider">
                                 <span class="value">${uniform.value}</span>`
                            }
                            <button class="remove-input" data-uniform="${name}" style="margin-left: 8px;">✕</button>
                        </div>
                    </div>
                `
                  )
                  .join("")}
                <button class="add-uniform-btn">+ Add Uniform</button>
            </div>
            
            <div class="property-group">
                <h4>Inputs</h4>
                ${(node.inputs || ["uTexture"])
                  .slice(0, 4)
                  .map((inputName, inputIndex) => {
                    // Find connections to this input
                    const connections = editorState.connections.filter(
                      (c) => c.to === node.id
                    );
                    const connectedNodeId = connections[inputIndex]?.from || "";

                    return `
                    <div class="input-item" data-input="${inputName}">
                        <input type="text" class="text-input input-name" value="${inputName}" style="width: 100px; margin-right: 8px;">
                        <select class="input-source" data-input="${inputName}">
                            <option value="">None</option>
                            ${nodes
                              .filter((n) => n.id !== node.id)
                              .map(
                                (n) =>
                                  `<option value="${n.id}" ${
                                    n.id === connectedNodeId ? "selected" : ""
                                  }>${n.name || n.id}</option>`
                              )
                              .join("")}
                        </select>
                        <button class="remove-input" data-input="${inputName}">✕</button>
                    </div>
                    `;
                  })
                  .join("")}
                ${
                  (node.inputs || []).length < 4
                    ? '<button class="add-input-btn">+ Add Input</button>'
                    : ""
                }
            </div>
            
            ${this.renderAdvancedSection()}
        `;

    // Add event listeners for uniforms
    container.querySelectorAll(".uniform-constant").forEach((input) => {
      input.addEventListener("change", (e) => {
        const uniformName = input
          .closest("[data-uniform]")
          ?.getAttribute("data-uniform");
        if (uniformName && node.uniforms[uniformName]) {
          const value = parseFloat(e.target.value) || 0;
          node.uniforms[uniformName].value = value;

          // Update the miniGL node uniform in real-time
          miniGLBridge.updateNodeProperty(this.currentNodeId, "uniform", {
            name: uniformName,
            value: value,
          });
        }
      });
    });

    // Add event listeners for uniform toggles
    container.querySelectorAll(".uniform-toggle").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const uniformName = checkbox
          .closest("[data-uniform]")
          ?.getAttribute("data-uniform");
        if (uniformName && node.uniforms[uniformName]) {
          const value = e.target.checked ? 1.0 : 0.0;
          node.uniforms[uniformName].value = value;

          // Update the miniGL node uniform in real-time
          miniGLBridge.updateNodeProperty(this.currentNodeId, "uniform", {
            name: uniformName,
            value: value,
          });
        }
      });
    });

    // Add event listeners for uniform type changes
    container.querySelectorAll(".uniform-type").forEach((select) => {
      select.addEventListener("change", (e) => {
        const uniformName = select
          .closest("[data-uniform]")
          ?.getAttribute("data-uniform");
        if (uniformName && node.uniforms[uniformName]) {
          node.uniforms[uniformName].type = e.target.value;
          // Re-render properties to update UI
          this.update();
        }
      });
    });

    // Add event listeners for uniform name changes
    container.querySelectorAll(".uniform-name").forEach((input) => {
      input.addEventListener("change", (e) => {
        const oldName = input
          .closest("[data-uniform]")
          ?.getAttribute("data-uniform");
        const newName = e.target.value.trim();

        if (!oldName || !newName || oldName === newName) return;

        const node = editorState.getNode(this.currentNodeId);
        if (node && node.uniforms && node.uniforms[oldName]) {
          // Check if new name already exists
          if (node.uniforms[newName]) {
            alert("A uniform with this name already exists");
            e.target.value = oldName;
            return;
          }

          // Rename the uniform
          node.uniforms[newName] = node.uniforms[oldName];
          delete node.uniforms[oldName];

          // Update the UI
          this.update();

          // Update the miniGL node
          miniGLBridge.updateNodeProperty(
            this.currentNodeId,
            "uniforms",
            node.uniforms
          );
        }
      });
    });

    // Add event listeners for removing uniforms
    container.querySelectorAll(".remove-input[data-uniform]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const uniformName = btn.getAttribute("data-uniform");
        const node = editorState.getNode(this.currentNodeId);

        if (node && node.uniforms && node.uniforms[uniformName]) {
          if (confirm(`Remove uniform "${uniformName}"?`)) {
            delete node.uniforms[uniformName];

            // Update the UI
            this.update();

            // Update the miniGL node
            miniGLBridge.updateNodeProperty(
              this.currentNodeId,
              "uniforms",
              node.uniforms
            );
          }
        }
      });
    });

    // Add event listeners for input name changes
    container.querySelectorAll(".input-name").forEach((input) => {
      input.addEventListener("change", (e) => {
        const oldName = input
          .closest("[data-input]")
          ?.getAttribute("data-input");
        const newName = e.target.value.trim();

        if (!oldName || !newName || oldName === newName) return;

        const node = editorState.getNode(this.currentNodeId);
        if (node && node.inputs) {
          const index = node.inputs.indexOf(oldName);
          if (index !== -1) {
            // Check if new name already exists
            if (node.inputs.includes(newName)) {
              alert("An input with this name already exists");
              e.target.value = oldName;
              return;
            }

            // Rename the input
            node.inputs[index] = newName;

            // Update the UI
            this.update();
          }
        }
      });
    });

    // Add event listeners for removing inputs
    container.querySelectorAll(".remove-input[data-input]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const inputName = btn.getAttribute("data-input");
        const node = editorState.getNode(this.currentNodeId);

        if (node && node.inputs) {
          if (confirm(`Remove input "${inputName}"?`)) {
            const index = node.inputs.indexOf(inputName);
            if (index !== -1) {
              node.inputs.splice(index, 1);

              // Update the UI
              this.update();
            }
          }
        }
      });
    });

    // Add event listeners for input source dropdowns
    container.querySelectorAll(".input-source").forEach((select) => {
      select.addEventListener("change", (e) => {
        const inputName = select.getAttribute("data-input");
        const newSourceId = e.target.value;
        const node = editorState.getNode(this.currentNodeId);

        if (!node || !inputName) return;

        // Find the input index
        const inputIndex = node.inputs.indexOf(inputName);
        if (inputIndex === -1) return;

        // Remove existing connection to this input
        const existingConnections = editorState.connections.filter(
          (c) => c.to === this.currentNodeId
        );
        if (existingConnections[inputIndex]) {
          editorState.disconnectNodes(
            existingConnections[inputIndex].from,
            this.currentNodeId
          );
        }

        // Add new connection if a source was selected
        if (newSourceId) {
          editorState.connectNodes(newSourceId, this.currentNodeId);
        }

        // Force a render to show the connection change
        if (window.miniGLEditor?.miniGLBridge?.minigl?.renderToScreen) {
          window.miniGLEditor.miniGLBridge.minigl.renderToScreen();
        }
      });
    });

    container.querySelectorAll(".uniform-slider").forEach((slider) => {
      const valueSpan = slider.nextElementSibling;
      slider.addEventListener("input", (e) => {
        if (valueSpan) valueSpan.textContent = e.target.value;
        // Update node uniform value
        const uniformName = slider
          .closest("[data-uniform]")
          ?.getAttribute("data-uniform");
        if (uniformName && node.uniforms[uniformName]) {
          const value = parseFloat(e.target.value);
          node.uniforms[uniformName].value = value;

          // Update the miniGL node uniform in real-time
          miniGLBridge.updateNodeProperty(this.currentNodeId, "uniform", {
            name: uniformName,
            value: value,
          });

          // Force a render to ensure the changes are visible immediately
          if (window.miniGLEditor?.miniGLBridge?.minigl?.renderToScreen) {
            window.miniGLEditor.miniGLBridge.minigl.renderToScreen();
          }
        }
      });
    });
  }

  renderAdvancedSection() {
    return `
            <div class="property-group">
                <h4 class="collapsible-header">Advanced <span class="toggle">+</span></h4>
                <div class="collapsible-content" style="display: none;">
                    <div class="property-item">
                        <label>Precision</label>
                        <select class="dropdown">
                            <option value="float">Float</option>
                            <option value="unsigned">Unsigned</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>Min Filter</label>
                        <select class="dropdown">
                            <option value="linear">Linear</option>
                            <option value="nearest">Nearest</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>Mag Filter</label>
                        <select class="dropdown">
                            <option value="linear">Linear</option>
                            <option value="nearest">Nearest</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>Mipmaps</label>
                        <input type="checkbox" checked class="checkbox">
                    </div>
                    <div class="property-item">
                        <label>Clamping</label>
                        <select class="dropdown">
                            <option value="clamp">Clamp</option>
                            <option value="repeat">Repeat</option>
                            <option value="mirror">Mirror</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
  }

  showDocumentation() {
    const propertiesContent = document.querySelector(".properties-content");
    if (!propertiesContent) return;

    propertiesContent.innerHTML = `
            <div class="documentation">
                <div class="doc-section">
                    <h4 class="doc-header">Built-in Uniforms <span class="toggle">−</span></h4>
                    <div class="doc-content">
                        <div class="doc-item"><code>glResolution</code> - Canvas size (vec2)</div>
                        <div class="doc-item"><code>glTime</code> - Animation time (float)</div>
                        <div class="doc-item"><code>glMouse</code> - Mouse position + click (vec3)</div>
                        <div class="doc-item"><code>glCoord</code> - Normalized coordinates (-1 to 1, aspect-corrected)</div>
                        <div class="doc-item"><code>glUV</code> - Raw texture coordinates</div>
                    </div>
                </div>
                <div class="doc-section">
                    <h4 class="doc-header">Node Types <span class="toggle">−</span></h4>
                    <div class="doc-content">
                        <div class="doc-item"><strong>Shader:</strong> Custom fragment shader</div>
                        <div class="doc-item"><strong>Blend:</strong> Compositing operations</div>
                        <div class="doc-item"><strong>Feedback:</strong> Temporal effects</div>
                        <div class="doc-item"><strong>Texture:</strong> Static image input</div>
                        <div class="doc-item"><strong>Video:</strong> Video file input</div>
                        <div class="doc-item"><strong>Canvas:</strong> Programmatic 2D drawing</div>
                    </div>
                </div>
            </div>
        `;

    this.initializeDocToggle();
  }

  showEmptyPanel() {
    const propertiesContent = document.querySelector(".properties-content");
    if (!propertiesContent) return;

    propertiesContent.innerHTML = `
            <div class="empty-panel">
                <p>Select a node to view its properties</p>
            </div>
        `;
  }


  toggleDocumentation() {
    const propertiesContent = document.querySelector(".properties-content");
    if (!propertiesContent) return;

    // Check if documentation is currently shown
    if (propertiesContent.querySelector(".documentation")) {
      // If documentation is shown, restore previous content
      if (this.currentNodeId) {
        // If there's a selected node, show its properties
        this.update();
      } else {
        // Otherwise show empty panel
        this.showEmptyPanel();
      }
    } else {
      // Show documentation
      this.showDocumentation();
    }
  }

  initializePropertyInteractions() {
    // Collapsible headers are handled by UIManager
    
    // Add uniform button
    const addUniformBtn = document.querySelector(".add-uniform-btn");
    if (addUniformBtn) {
      addUniformBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const node = editorState.getNode(this.currentNodeId);
        if (!node) return;

        // Generate a unique uniform name
        let uniformCount = Object.keys(node.uniforms || {}).length;
        let uniformName = `uCustom${uniformCount}`;

        // Make sure the name is unique
        while (node.uniforms && node.uniforms[uniformName]) {
          uniformCount++;
          uniformName = `uCustom${uniformCount}`;
        }

        // Add the uniform with default values
        if (!node.uniforms) node.uniforms = {};
        node.uniforms[uniformName] = {
          type: "slider",
          value: 0.5,
          min: 0,
          max: 1,
        };

        // Ensure the node stays selected
        editorState.selectedNode = this.currentNodeId;

        // Update the properties panel to show the new uniform
        this.update();

        // Update the miniGL node if it exists
        const miniglNode = editorState.miniglNodes.get(this.currentNodeId);
        if (miniglNode) {
          // Recreate the node with new uniforms
          miniGLBridge.updateNodeProperty(
            this.currentNodeId,
            "uniforms",
            node.uniforms
          );
        }
      });
    }

    // Add input button
    const addInputBtn = document.querySelector(".add-input-btn");
    if (addInputBtn) {
      addInputBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const node = editorState.getNode(this.currentNodeId);
        if (!node) return;

        // Limit to 4 texture inputs
        const currentInputs = node.inputs || [];
        if (currentInputs.length >= 4) {
          alert("Maximum of 4 texture inputs allowed");
          return;
        }

        // Generate a unique input name
        let inputCount = currentInputs.length;
        let inputName = `uTexture${inputCount}`;

        // Make sure the name is unique
        while (currentInputs.includes(inputName)) {
          inputCount++;
          inputName = `uTexture${inputCount}`;
        }

        // Add the input
        if (!node.inputs) node.inputs = [];
        node.inputs.push(inputName);

        // Ensure the node stays selected
        editorState.selectedNode = this.currentNodeId;

        // Update the properties panel to show the new input
        this.update();

        // Note: Texture connections are handled through the node graph UI
      });
    }
  }

  initializeDocToggle() {
    document.querySelectorAll(".doc-header").forEach((header) => {
      header.addEventListener("click", function () {
        const content = this.nextElementSibling;
        const toggle = this.querySelector(".toggle");
        if (content && toggle) {
          if (content.style.display === "none") {
            content.style.display = "block";
            toggle.textContent = "−";
          } else {
            content.style.display = "none";
            toggle.textContent = "+";
          }
        }
      });
    });
  }

  validateMediaUrl(url, statusElement, nodeType) {
    if (!url.trim()) {
      statusElement.textContent = "📁";
      statusElement.title = "No source selected";
      return;
    }

    // Check for data URLs (embedded images)
    if (url.startsWith("data:")) {
      statusElement.textContent = "✅";
      statusElement.title = "Embedded image data";
      return;
    }

    // Check for blob URLs (drag & drop files)
    if (url.startsWith("blob:")) {
      statusElement.textContent = "✅";
      statusElement.title = "Local file loaded";
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      statusElement.textContent = "❌";
      statusElement.title = "Invalid URL format";
      return;
    }

    // For external URLs, show loading but don't validate due to CORS
    // Let miniGL handle the actual loading
    if (url.startsWith("http://") || url.startsWith("https://")) {
      statusElement.textContent = "🌐";
      statusElement.title = "External URL - loading handled by miniGL";
      return;
    }

    // For relative URLs or other protocols, try to validate
    statusElement.textContent = "⏳";
    statusElement.title = "Loading...";

    if (nodeType === "Texture") {
      const img = new Image();
      img.onload = () => {
        statusElement.textContent = "✅";
        statusElement.title = `Image loaded (${img.width}x${img.height})`;
      };
      img.onerror = () => {
        statusElement.textContent = "❌";
        statusElement.title = "Failed to load image";
      };
      img.src = url;
    }
  }

  getCanvasTemplate(template) {
    const templates = {
      gradient: `// Animated Gradient
const time = frame * 0.02;
const gradient = ctx.createLinearGradient(0, 0, width, height);
gradient.addColorStop(0, \`hsl(\${time * 50 % 360}, 70%, 40%)\`);
gradient.addColorStop(0.5, \`hsl(\${(time * 50 + 120) % 360}, 70%, 60%)\`);
gradient.addColorStop(1, \`hsl(\${(time * 50 + 240) % 360}, 70%, 40%)\`);
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);`,

      particles: `// Particle System
ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
ctx.fillRect(0, 0, width, height);

const time = frame * 0.05;
for (let i = 0; i < 50; i++) {
    const x = (width/2) + Math.sin(time + i * 0.3) * (100 + i * 3);
    const y = (height/2) + Math.cos(time + i * 0.2) * (60 + i * 2);
    const size = 2 + Math.sin(time * 2 + i) * 1;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = \`hsl(\${(i * 10 + time * 100) % 360}, 80%, 60%)\`;
    ctx.fill();
}`,

      clock: `// Analog Clock
ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, width, height);

const centerX = width / 2;
const centerY = height / 2;
const radius = Math.min(width, height) * 0.4;
const time = frame * 0.01;

// Clock face
ctx.beginPath();
ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
ctx.strokeStyle = '#fff';
ctx.lineWidth = 2;
ctx.stroke();

// Hour markers
for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const x1 = centerX + Math.cos(angle) * (radius * 0.9);
    const y1 = centerY + Math.sin(angle) * (radius * 0.9);
    const x2 = centerX + Math.cos(angle) * (radius * 0.8);
    const y2 = centerY + Math.sin(angle) * (radius * 0.8);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// Clock hands
const hourAngle = time * 0.1;
const minuteAngle = time;

// Hour hand
ctx.beginPath();
ctx.moveTo(centerX, centerY);
ctx.lineTo(
    centerX + Math.cos(hourAngle - Math.PI/2) * radius * 0.5,
    centerY + Math.sin(hourAngle - Math.PI/2) * radius * 0.5
);
ctx.lineWidth = 4;
ctx.stroke();

// Minute hand
ctx.beginPath();
ctx.moveTo(centerX, centerY);
ctx.lineTo(
    centerX + Math.cos(minuteAngle - Math.PI/2) * radius * 0.7,
    centerY + Math.sin(minuteAngle - Math.PI/2) * radius * 0.7
);
ctx.lineWidth = 2;
ctx.stroke();`,

      noise: `// Animated Noise Pattern
const time = frame * 0.03;
const imageData = ctx.createImageData(width, height);
const data = imageData.data;

for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % width;
    const y = Math.floor((i / 4) / width);
    
    // Simple noise function
    const noise = Math.sin(x * 0.1 + time) * Math.cos(y * 0.1 + time) * 127 + 128;
    
    data[i] = noise;     // Red
    data[i + 1] = noise * 0.8; // Green
    data[i + 2] = noise * 0.6; // Blue
    data[i + 3] = 255;   // Alpha
}

ctx.putImageData(imageData, 0, 0);`,
    };

    return templates[template] || editorState.getDefaultCanvasCode();
  }
}
