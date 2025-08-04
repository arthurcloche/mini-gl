import editorState from '../core/EditorState.js';
import miniGLBridge from '../minigl-bridge/MiniGLBridge.js';

export class PropertiesPanel {
    constructor() {
        this.currentNodeId = null;
    }
    
    initialize() {
        console.log('Initializing Properties Panel...');
    }
    
    update() {
        const propertiesPanel = document.getElementById('nodeProperties');
        const propertiesHeader = propertiesPanel?.querySelector('.panel-header h3');
        
        if (!propertiesPanel || !propertiesHeader) return;
        
        // If we have a currentNodeId, use that (happens when updating uniforms/textures)
        const nodeId = this.currentNodeId || editorState.selectedNode;
        
        if (!nodeId) {
            // Show documentation when no node is selected
            propertiesHeader.textContent = 'Documentation';
            this.showDocumentation();
            return;
        }
        
        const node = editorState.getNode(nodeId);
        if (!node) return;
        
        this.currentNodeId = node.id;
        propertiesHeader.textContent = `${node.name} Properties`;
        
        // Update properties content based on node type
        const propertiesContent = document.querySelector('.properties-content');
        if (!propertiesContent) return;
        
        switch (node.type) {
            case 'Texture':
            case 'Video':
                this.renderMediaProperties(propertiesContent, node);
                break;
            case 'Canvas':
                this.renderCanvasProperties(propertiesContent, node);
                break;
            case 'Blend':
                this.renderBlendProperties(propertiesContent, node);
                break;
            default:
                this.renderShaderProperties(propertiesContent, node);
        }
        
        // Re-initialize collapsibles and other interactions
        this.initializePropertyInteractions();
    }
    
    renderMediaProperties(container, node) {
        container.innerHTML = `
            <div class="property-group">
                <h4>${node.type} Source</h4>
                <div class="property-item">
                    <label>URL</label>
                    <input type="text" class="text-input url-input" 
                        placeholder="${node.type === 'Texture' ? 'https://example.com/image.jpg' : 'https://example.com/video.mp4'}" 
                        value="${node.url || ''}"
                        data-node-id="${node.id}">
                </div>
                <div class="property-item">
                    <label>Size Mode</label>
                    <select class="dropdown size-mode-select">
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="stretch">Stretch</option>
                        <option value="original">Original</option>
                    </select>
                </div>
                ${node.type === 'Video' ? `
                    <div class="property-item">
                        <label>Auto Loop</label>
                        <input type="checkbox" class="checkbox video-loop" checked>
                    </div>
                    <div class="property-item">
                        <label>Muted</label>
                        <input type="checkbox" class="checkbox video-muted" checked>
                    </div>
                ` : ''}
            </div>
            
            ${this.renderAdvancedSection()}
        `;
        
        // Add URL input handler
        setTimeout(() => {
            const urlInput = container.querySelector('.url-input');
            if (urlInput) {
                urlInput.addEventListener('change', (e) => {
                    const node = editorState.getNode(node.id);
                    if (node) {
                        node.url = e.target.value;
                        miniGLBridge.updateNodeProperty(node.id, 'url', e.target.value);
                    }
                });
            }
        }, 0);
    }
    
    renderCanvasProperties(container, node) {
        container.innerHTML = `
            <div class="property-group">
                <h4>Canvas Settings</h4>
                <div class="property-item">
                    <label>Width</label>
                    <input type="number" class="number-input canvas-width" 
                        value="${node.width || 512}" min="1" max="4096">
                </div>
                <div class="property-item">
                    <label>Height</label>
                    <input type="number" class="number-input canvas-height" 
                        value="${node.height || 512}" min="1" max="4096">
                </div>
                <button class="match-canvas-btn" onclick="matchWebGLCanvas()">Match WebGL Canvas</button>
                <button class="edit-code-btn">Edit Canvas Code</button>
            </div>
            
            <div class="property-group">
                <h4 class="collapsible-header">Advanced <span class="toggle">+</span></h4>
                <div class="collapsible-content" style="display: none;">
                    <div class="property-item">
                        <label>DPR (Device Pixel Ratio)</label>
                        <input type="number" class="number-input" value="1" min="0.5" max="2" step="0.1">
                    </div>
                    <div class="property-item">
                        <label>Font URL</label>
                        <input type="text" class="text-input" placeholder="https://example.com/font.ttf">
                    </div>
                    <div class="property-item">
                        <label>Image URL</label>
                        <input type="text" class="text-input" placeholder="https://example.com/image.jpg">
                    </div>
                    <div class="property-item">
                        <label>Image Name</label>
                        <input type="text" class="text-input" placeholder="myImage">
                    </div>
                </div>
            </div>
        `;
        
        // Add canvas code editor button handler
        setTimeout(() => {
            const editBtn = container.querySelector('.edit-code-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    window.toggleCanvasEditor?.();
                });
            }
        }, 0);
    }
    
    renderBlendProperties(container, node) {
        const nodes = Array.from(editorState.nodes.values());
        
        container.innerHTML = `
            <div class="property-group">
                <h4>Blend Mode</h4>
                <div class="property-item">
                    <label>Mode</label>
                    <select class="dropdown blend-mode-select">
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="soft-light">Soft Light</option>
                        <option value="hard-light">Hard Light</option>
                        <option value="color-dodge">Color Dodge</option>
                        <option value="color-burn">Color Burn</option>
                        <option value="darken">Darken</option>
                        <option value="lighten">Lighten</option>
                        <option value="difference">Difference</option>
                        <option value="exclusion">Exclusion</option>
                    </select>
                </div>
            </div>
            
            <div class="property-group">
                <h4>Inputs</h4>
                <div class="input-item">
                    <label>Base</label>
                    <select class="input-source">
                        <option value="">None</option>
                        ${nodes.map(n => 
                            `<option value="${n.id}">${n.name}</option>`
                        ).join('')}
                    </select>
                    <button class="remove-input">✕</button>
                </div>
                <div class="input-item">
                    <label>Blend</label>
                    <select class="input-source">
                        <option value="">None</option>
                        ${nodes.map(n => 
                            `<option value="${n.id}">${n.name}</option>`
                        ).join('')}
                    </select>
                    <button class="remove-input">✕</button>
                </div>
            </div>
        `;
    }
    
    renderShaderProperties(container, node) {
        const nodes = Array.from(editorState.nodes.values());
        
        container.innerHTML = `
            <div class="property-group">
                <h4>Uniforms</h4>
                ${Object.entries(node.uniforms || {}).map(([name, uniform]) => `
                    <div class="property-item" data-uniform="${name}">
                        <input type="text" class="text-input uniform-name" value="${name}" style="width: 100px; margin-right: 8px;">
                        <div class="uniform-controls">
                            <select class="uniform-type">
                                <option value="slider" ${uniform.type === 'slider' ? 'selected' : ''}>Slider</option>
                                <option value="constant" ${uniform.type === 'constant' ? 'selected' : ''}>Constant</option>
                                <option value="sine" ${uniform.type === 'sine' ? 'selected' : ''}>Sine</option>
                                <option value="toggle" ${uniform.type === 'toggle' ? 'selected' : ''}>Toggle</option>
                            </select>
                            ${uniform.type === 'toggle' ? 
                                `<input type="checkbox" ${uniform.value ? 'checked' : ''} class="checkbox uniform-toggle">` :
                                uniform.type === 'constant' ?
                                `<input type="text" value="${uniform.value}" class="text-input uniform-constant">` :
                                `<input type="range" min="${uniform.min || 0}" max="${uniform.max || 1}" 
                                    step="0.01" value="${uniform.value}" class="slider uniform-slider">
                                 <span class="value">${uniform.value}</span>`
                            }
                            <button class="remove-input" data-uniform="${name}" style="margin-left: 8px;">✕</button>
                        </div>
                    </div>
                `).join('')}
                <button class="add-uniform-btn">+ Add Uniform</button>
            </div>
            
            <div class="property-group">
                <h4>Inputs</h4>
                ${(node.inputs || ['uTexture']).slice(0, 4).map(inputName => `
                    <div class="input-item" data-input="${inputName}">
                        <input type="text" class="text-input input-name" value="${inputName}" style="width: 100px; margin-right: 8px;">
                        <select class="input-source" data-input="${inputName}">
                            <option value="">None</option>
                            ${nodes.filter(n => n.id !== node.id).map(n => 
                                `<option value="${n.id}">${n.name}</option>`
                            ).join('')}
                        </select>
                        <button class="remove-input" data-input="${inputName}">✕</button>
                    </div>
                `).join('')}
                ${(node.inputs || []).length < 4 ? '<button class="add-input-btn">+ Add Input</button>' : ''}
            </div>
            
            ${this.renderAdvancedSection()}
        `;
        
        // Add event listeners for uniforms
        container.querySelectorAll('.uniform-constant').forEach(input => {
            input.addEventListener('change', (e) => {
                const uniformName = input.closest('[data-uniform]')?.getAttribute('data-uniform');
                if (uniformName && node.uniforms[uniformName]) {
                    node.uniforms[uniformName].value = parseFloat(e.target.value) || 0;
                }
            });
        });
        
        // Add event listeners for uniform type changes
        container.querySelectorAll('.uniform-type').forEach(select => {
            select.addEventListener('change', (e) => {
                const uniformName = select.closest('[data-uniform]')?.getAttribute('data-uniform');
                if (uniformName && node.uniforms[uniformName]) {
                    node.uniforms[uniformName].type = e.target.value;
                    // Re-render properties to update UI
                    this.update();
                }
            });
        });
        
        // Add event listeners for uniform name changes
        container.querySelectorAll('.uniform-name').forEach(input => {
            input.addEventListener('change', (e) => {
                const oldName = input.closest('[data-uniform]')?.getAttribute('data-uniform');
                const newName = e.target.value.trim();
                
                if (!oldName || !newName || oldName === newName) return;
                
                const node = editorState.getNode(this.currentNodeId);
                if (node && node.uniforms && node.uniforms[oldName]) {
                    // Check if new name already exists
                    if (node.uniforms[newName]) {
                        alert('A uniform with this name already exists');
                        e.target.value = oldName;
                        return;
                    }
                    
                    // Rename the uniform
                    node.uniforms[newName] = node.uniforms[oldName];
                    delete node.uniforms[oldName];
                    
                    // Update the UI
                    this.update();
                    
                    // Update the miniGL node
                    miniGLBridge.updateNodeProperty(this.currentNodeId, 'uniforms', node.uniforms);
                }
            });
        });
        
        // Add event listeners for removing uniforms
        container.querySelectorAll('.remove-input[data-uniform]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uniformName = btn.getAttribute('data-uniform');
                const node = editorState.getNode(this.currentNodeId);
                
                if (node && node.uniforms && node.uniforms[uniformName]) {
                    if (confirm(`Remove uniform "${uniformName}"?`)) {
                        delete node.uniforms[uniformName];
                        
                        // Update the UI
                        this.update();
                        
                        // Update the miniGL node
                        miniGLBridge.updateNodeProperty(this.currentNodeId, 'uniforms', node.uniforms);
                    }
                }
            });
        });
        
        // Add event listeners for input name changes
        container.querySelectorAll('.input-name').forEach(input => {
            input.addEventListener('change', (e) => {
                const oldName = input.closest('[data-input]')?.getAttribute('data-input');
                const newName = e.target.value.trim();
                
                if (!oldName || !newName || oldName === newName) return;
                
                const node = editorState.getNode(this.currentNodeId);
                if (node && node.inputs) {
                    const index = node.inputs.indexOf(oldName);
                    if (index !== -1) {
                        // Check if new name already exists
                        if (node.inputs.includes(newName)) {
                            alert('An input with this name already exists');
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
        container.querySelectorAll('.remove-input[data-input]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inputName = btn.getAttribute('data-input');
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
        
        container.querySelectorAll('.uniform-slider').forEach(slider => {
            const valueSpan = slider.nextElementSibling;
            slider.addEventListener('input', (e) => {
                if (valueSpan) valueSpan.textContent = e.target.value;
                // Update node uniform value
                const uniformName = slider.closest('[data-uniform]')?.getAttribute('data-uniform');
                if (uniformName && node.uniforms[uniformName]) {
                    node.uniforms[uniformName].value = parseFloat(e.target.value);
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
        const propertiesContent = document.querySelector('.properties-content');
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
    
    initializePropertyInteractions() {
        // Collapsible headers are handled by UIManager
        
        // Add uniform button
        const addUniformBtn = document.querySelector('.add-uniform-btn');
        if (addUniformBtn) {
            addUniformBtn.addEventListener('click', () => {
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
                    type: 'slider',
                    value: 0.5,
                    min: 0,
                    max: 1
                };
                
                // Update the properties panel to show the new uniform
                this.update();
                
                // Update the miniGL node if it exists
                const miniglNode = editorState.miniglNodes.get(this.currentNodeId);
                if (miniglNode) {
                    // Recreate the node with new uniforms
                    miniGLBridge.updateNodeProperty(this.currentNodeId, 'uniforms', node.uniforms);
                }
            });
        }
        
        // Add input button
        const addInputBtn = document.querySelector('.add-input-btn');
        if (addInputBtn) {
            addInputBtn.addEventListener('click', () => {
                const node = editorState.getNode(this.currentNodeId);
                if (!node) return;
                
                // Limit to 4 texture inputs
                const currentInputs = node.inputs || [];
                if (currentInputs.length >= 4) {
                    alert('Maximum of 4 texture inputs allowed');
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
                
                // Update the properties panel to show the new input
                this.update();
                
                // Note: Texture connections are handled through the node graph UI
                console.log(`Added texture input: ${inputName}`);
            });
        }
    }
    
    initializeDocToggle() {
        document.querySelectorAll('.doc-header').forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const toggle = this.querySelector('.toggle');
                if (content && toggle) {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggle.textContent = '−';
                    } else {
                        content.style.display = 'none';
                        toggle.textContent = '+';
                    }
                }
            });
        });
    }
}