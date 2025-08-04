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
        
        if (!editorState.selectedNode) {
            // Show documentation when no node is selected
            propertiesHeader.textContent = 'Documentation';
            this.showDocumentation();
            return;
        }
        
        const node = editorState.getNode(editorState.selectedNode);
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
                        <label>${name}</label>
                        <div class="uniform-controls">
                            <select class="uniform-type">
                                <option value="slider" ${uniform.type === 'slider' ? 'selected' : ''}>Slider</option>
                                <option value="constant" ${uniform.type === 'constant' ? 'selected' : ''}>Constant</option>
                                <option value="sine" ${uniform.type === 'sine' ? 'selected' : ''}>Sine</option>
                                <option value="toggle" ${uniform.type === 'toggle' ? 'selected' : ''}>Toggle</option>
                            </select>
                            ${uniform.type === 'toggle' ? 
                                `<input type="checkbox" ${uniform.value ? 'checked' : ''} class="checkbox uniform-toggle">` :
                                `<input type="range" min="${uniform.min || 0}" max="${uniform.max || 1}" 
                                    step="0.1" value="${uniform.value}" class="slider uniform-slider">
                                 <span class="value">${uniform.value}</span>`
                            }
                        </div>
                    </div>
                `).join('')}
                <button class="add-uniform-btn">+ Add Uniform</button>
            </div>
            
            <div class="property-group">
                <h4>Inputs</h4>
                <div class="input-item">
                    <label>uTexture</label>
                    <select class="input-source">
                        <option value="">None</option>
                        ${nodes.map(n => 
                            `<option value="${n.id}">${n.name}</option>`
                        ).join('')}
                    </select>
                    <button class="remove-input">✕</button>
                </div>
                <button class="add-input-btn">+ Add Input</button>
            </div>
            
            ${this.renderAdvancedSection()}
        `;
        
        // Add event listeners for uniforms
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
                        <div class="doc-item"><code>glCoord</code> - Aspect-corrected coordinates</div>
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
                console.log('Add uniform clicked');
                // TODO: Implement add uniform dialog
            });
        }
        
        // Add input button
        const addInputBtn = document.querySelector('.add-input-btn');
        if (addInputBtn) {
            addInputBtn.addEventListener('click', () => {
                console.log('Add input clicked');
                // TODO: Implement add input dialog
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