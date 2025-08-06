// miniGL Editor Prototype - Basic Interactions

// Global State Management
window.EditorState = {
    selectedNode: null,
    isShaderPanelOpen: false,
    isRecording: false,
    frameCount: 0,
    nodes: new Map(),
    connections: [],
    outputNode: 'blur',
    
    // Node management
    addNode: function(type, name, position = {x: 100, y: 100}) {
        const id = 'node_' + Date.now();
        const node = {
            id,
            type,
            name: name || type,
            position,
            uniforms: this.getDefaultUniforms(type),
            shader: this.getDefaultShader(type)
        };
        this.nodes.set(id, node);
        this.updateUI();
        return node;
    },
    
    removeNode: function(id) {
        this.nodes.delete(id);
        this.connections = this.connections.filter(c => c.from !== id && c.to !== id);
        this.updateUI();
    },
    
    selectNode: function(id) {
        this.selectedNode = id;
        this.updateUI();
    },
    
    getDefaultUniforms: function(type) {
        const defaults = {
            'Shader': { uTime: { type: 'constant', value: 0 }, uMouse: { type: 'constant', value: [0, 0] } },
            'Feedback': { uTime: { type: 'constant', value: 0 }, uMouse: { type: 'constant', value: [0, 0] } },
            'Blur': { uRadius: { type: 'slider', value: 2, min: 0, max: 10 } },
            'Blend': {},
            'Texture': {},
            'Video': {},
            'Canvas': {}
        };
        return defaults[type] || {};
    },
    
    getDefaultCanvasCode: function() {
        return `// Canvas drawing code
// Available variables: ctx, width, height, frame

// Clear canvas
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, width, height);

// Draw something
ctx.fillStyle = '#fff';
ctx.font = '48px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Canvas ' + frame, width/2, height/2);

// Draw animated circle
ctx.beginPath();
ctx.arc(
    width/2 + Math.sin(frame * 0.05) * 100, 
    height/2 + Math.cos(frame * 0.05) * 100, 
    20, 
    0, 
    Math.PI * 2
);
ctx.fillStyle = '#4a90e2';
ctx.fill();`;
    },
    
    getDefaultShader: function(type) {
        const shaders = {
            'Shader': `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform vec3 glMouse;
uniform sampler2D uTexture;

in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 uv = glUV;
    fragColor = texture(uTexture, uv);
}`,
            'Feedback': `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform vec3 glMouse;
uniform sampler2D uTexture;

in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 uv = glUV;
    vec4 current = texture(uTexture, uv);
    fragColor = current * 0.95;
}`
        };
        return shaders[type] || '';
    },
    
    updateUI: function() {
        this.updateSceneGraph();
        this.updateNodeGraph();
        this.updateProperties();
        this.updateOutputDropdown();
    },
    
    updateSceneGraph: function() {
        // Update scene graph display
        const sceneContent = document.querySelector('.scene-content');
        const outputNodeName = this.getNodeName(this.outputNode) || 'None';
        
        sceneContent.innerHTML = `
            <div class="scene-node">
                <span class="node-icon">📊</span>
                <span class="node-name editable" contenteditable="false">Main Output: ${outputNodeName}</span>
                <div class="node-actions">
                    <button class="action-btn" title="Rename">✏️</button>
                    <button class="action-btn" title="Copy">📋</button>
                    <button class="action-btn" title="Delete">🗑️</button>
                </div>
            </div>
        ` + Array.from(this.nodes.values()).map(node => `
            <div class="scene-node indent ${this.selectedNode === node.id ? 'selected' : ''}" data-node-id="${node.id}">
                <span class="node-icon">${this.getNodeIcon(node.type)}</span>
                <span class="node-name editable" contenteditable="false">${node.name}</span>
                <div class="node-actions">
                    <button class="action-btn" title="Rename">✏️</button>
                    <button class="action-btn" title="Copy">📋</button>
                    <button class="action-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
        
        this.initializeSceneActions();
    },
    
    updateNodeGraph: function() {
        const svg = document.querySelector('.graph-svg');
        const nodes = Array.from(this.nodes.values());
        
        // Clear and redraw
        svg.innerHTML = nodes.map((node, index) => `
            <g class="graph-node draggable ${this.selectedNode === node.id ? 'selected' : ''}" 
               transform="translate(${node.position.x}, ${node.position.y})" 
               data-node-id="${node.id}"
               data-node-type="${node.type}">
                <rect class="node-body" width="120" height="80" rx="4" />
                <text class="node-title" x="60" y="20">${node.name}</text>
                <text class="node-type" x="60" y="35">${node.type}</text>
                ${this.hasInput(node.type) ? '<circle class="node-input" cx="5" cy="40" r="4" />' : ''}
                ${this.hasOutput(node.type) ? '<circle class="node-output" cx="115" cy="40" r="4" />' : ''}
            </g>
        `).join('') + this.renderConnections();
        
        this.initializeNodeDragging();
        this.initializeNodeSelection();
    },
    
    hasInput: function(type) {
        return ['Shader', 'Blend', 'Feedback'].includes(type);
    },
    
    hasOutput: function(type) {
        return ['Texture', 'Video', 'Canvas', 'Shader', 'Blend', 'Feedback'].includes(type);
    },
    
    updateProperties: function() {
        const propertiesPanel = document.getElementById('nodeProperties');
        const propertiesHeader = document.querySelector('.properties-panel h3');
        
        if (!this.selectedNode) {
            // Show documentation when no node is selected
            propertiesHeader.textContent = 'Documentation';
            this.showDocumentation();
            return;
        }
        
        const node = this.nodes.get(this.selectedNode);
        if (!node) return;
        
        propertiesHeader.textContent = `${node.name} Properties`;
        
        // Update properties content based on node type
        const propertiesContent = document.querySelector('.properties-content');
        
        if (node.type === 'Texture' || node.type === 'Video') {
            // Special UI for texture/video nodes
            propertiesContent.innerHTML = `
                <div class="property-group">
                    <h4>${node.type} Source</h4>
                    <div class="property-item">
                        <label>URL</label>
                        <input type="text" class="text-input url-input" placeholder="${node.type === 'Texture' ? 'https://example.com/image.jpg' : 'https://example.com/video.mp4'}" value="${node.url || ''}">
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
                
                <div class="property-group">
                    <h4 class="collapsible-header">Advanced <span class="toggle">+</span></h4>
                    <div class="collapsible-content" style="display: none;">
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
        } else if (node.type === 'Canvas') {
            // Special UI for canvas nodes
            propertiesContent.innerHTML = `
                <div class="property-group">
                    <h4>Canvas Settings</h4>
                    <div class="property-item">
                        <label>Width</label>
                        <input type="number" class="number-input canvas-width" value="${node.width || 512}" min="1" max="4096">
                    </div>
                    <div class="property-item">
                        <label>Height</label>
                        <input type="number" class="number-input canvas-height" value="${node.height || 512}" min="1" max="4096">
                    </div>
                    <button class="match-canvas-btn">Match WebGL Canvas</button>
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
                const editBtn = document.querySelector('.edit-code-btn');
                const matchBtn = document.querySelector('.match-canvas-btn');
                
                if (editBtn) {
                    editBtn.addEventListener('click', () => {
                        EditorState.currentCanvasNodeId = node.id;
                        toggleCanvasEditor();
                    });
                }
                
                if (matchBtn) {
                    matchBtn.addEventListener('click', () => {
                        const preview = document.getElementById('preview');
                        if (preview) {
                            document.querySelector('.canvas-width').value = preview.width;
                            document.querySelector('.canvas-height').value = preview.height;
                        }
                    });
                }
            }, 0);
            
        } else if (node.type === 'Blend') {
            // Special UI for blend nodes
            propertiesContent.innerHTML = `
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
                            ${Array.from(this.nodes.values()).map(n => 
                                `<option value="${n.id}">${n.name}</option>`
                            ).join('')}
                        </select>
                        <button class="remove-input">✕</button>
                    </div>
                    <div class="input-item">
                        <label>Blend</label>
                        <select class="input-source">
                            <option value="">None</option>
                            ${Array.from(this.nodes.values()).map(n => 
                                `<option value="${n.id}">${n.name}</option>`
                            ).join('')}
                        </select>
                        <button class="remove-input">✕</button>
                    </div>
                </div>
            `;
        } else {
            // Regular uniform-based properties for other node types
            propertiesContent.innerHTML = `
                <div class="property-group">
                    <h4>Uniforms</h4>
                    ${Object.entries(node.uniforms).map(([name, uniform]) => `
                        <div class="property-item">
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
                                    `<input type="range" min="${uniform.min || 0}" max="${uniform.max || 1}" step="0.1" value="${uniform.value}" class="slider">
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
                            ${Array.from(this.nodes.values()).map(n => 
                                `<option value="${n.id}">${n.name}</option>`
                            ).join('')}
                        </select>
                        <button class="remove-input">✕</button>
                    </div>
                    <button class="add-input-btn">+ Add Input</button>
                </div>
                
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
        
        // Reinitialize collapsible headers
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const toggle = this.querySelector('.toggle');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggle.textContent = '−';
                } else {
                    content.style.display = 'none';
                    toggle.textContent = '+';
                }
            });
        });
    },
    
    updateOutputDropdown: function() {
        const dropdown = document.querySelector('.output-dropdown');
        dropdown.innerHTML = Array.from(this.nodes.values()).map(node => 
            `<option value="${node.id}" ${this.outputNode === node.id ? 'selected' : ''}>${node.name}</option>`
        ).join('');
    },
    
    getNodeName: function(id) {
        const node = this.nodes.get(id);
        return node ? node.name : 'Unknown';
    },
    
    getNodeIcon: function(type) {
        const icons = {
            'Texture': '🖼️',
            'Video': '📹', 
            'Canvas': '📊',
            'Shader': '⚡',
            'Blend': '🎨',
            'Feedback': '🔄',
            'Blur': '🌸',
            'Bloom': '✨'
        };
        return icons[type] || '⚡';
    },
    
    renderConnections: function() {
        return this.connections.map(conn => {
            const fromNode = this.nodes.get(conn.from);
            const toNode = this.nodes.get(conn.to);
            if (!fromNode || !toNode) return '';
            
            const x1 = fromNode.position.x + 115;
            const y1 = fromNode.position.y + 40;
            const x2 = toNode.position.x + 5;
            const y2 = toNode.position.y + 40;
            
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="connection-line" />`;
        }).join('');
    },
    
    showDocumentation: function() {
        // Show documentation when no node selected
        const propertiesContent = document.querySelector('.properties-content');
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
                    </div>
                </div>
            </div>
        `;
        
        // Add toggle functionality
        document.querySelectorAll('.doc-header').forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const toggle = this.querySelector('.toggle');
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggle.textContent = '−';
                } else {
                    content.style.display = 'none';
                    toggle.textContent = '+';
                }
            });
        });
    },
    
    initializeSceneActions: function() {
        document.querySelectorAll('.scene-node').forEach(node => {
            node.addEventListener('click', (e) => {
                const nodeId = node.getAttribute('data-node-id');
                if (nodeId) this.selectNode(nodeId);
            });
        });
        
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('title').toLowerCase();
                const sceneNode = btn.closest('.scene-node');
                const nodeId = sceneNode.getAttribute('data-node-id');
                
                switch(action) {
                    case 'rename':
                        const nameSpan = sceneNode.querySelector('.node-name');
                        nameSpan.contentEditable = true;
                        nameSpan.focus();
                        nameSpan.addEventListener('blur', () => {
                            nameSpan.contentEditable = false;
                            if (nodeId) {
                                const node = this.nodes.get(nodeId);
                                if (node) {
                                    node.name = nameSpan.textContent;
                                    this.updateUI();
                                }
                            }
                        });
                        break;
                    case 'copy':
                        if (nodeId) {
                            const original = this.nodes.get(nodeId);
                            const copy = {...original};
                            copy.name = original.name + ' Copy';
                            copy.position = {x: original.position.x + 140, y: original.position.y};
                            this.addNode(copy.type, copy.name, copy.position);
                        }
                        break;
                    case 'delete':
                        if (nodeId && confirm('Delete this node?')) {
                            this.removeNode(nodeId);
                        }
                        break;
                }
            });
        });
    },
    
    initializeNodeDragging: function() {
        // Will be implemented in next update
    },
    
    initializeNodeSelection: function() {
        document.querySelectorAll('.graph-node').forEach(node => {
            node.addEventListener('click', (e) => {
                const nodeId = node.getAttribute('data-node-id');
                this.selectNode(nodeId);
            });
            
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const nodeId = node.getAttribute('data-node-id');
                const nodeData = this.nodes.get(nodeId);
                if (nodeData) {
                    if (nodeData.type === 'Shader' || nodeData.type === 'Feedback') {
                        toggleShaderPanel();
                    } else if (nodeData.type === 'Canvas') {
                        this.currentCanvasNodeId = nodeId;
                        toggleCanvasEditor();
                    }
                }
            });
        });
    }
};

// Legacy variables for compatibility
let selectedNode = null;
let isShaderPanelOpen = false;
let draggingNode = null;
let dragOffset = { x: 0, y: 0 };

// Initialize the prototype
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with some default nodes
    EditorState.addNode('Texture', 'Source Texture', {x: 20, y: 40});
    EditorState.addNode('Shader', 'Blur Effect', {x: 260, y: 60});
    EditorState.addNode('Blend', 'Final Output', {x: 460, y: 100});
    
    initializeCanvas();
    initializeInteractions();
    initializeNodePalette();
    initializeTabs();
    initializeSettings();
    updateFrameCounter();
    
    // Show documentation by default
    EditorState.showDocumentation();
});

// Initialize the preview canvas with a simple gradient
function initializeCanvas() {
    const canvas = document.getElementById('preview');
    const ctx = canvas.getContext('2d');
    
    // Create animated gradient effect
    function animate() {
        const time = Date.now() * 0.001;
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, `hsl(${(time * 20) % 360}, 50%, 30%)`);
        gradient.addColorStop(0.5, `hsl(${(time * 30 + 60) % 360}, 60%, 20%)`);
        gradient.addColorStop(1, `hsl(${(time * 25 + 120) % 360}, 40%, 25%)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some animated circles for visual interest
        for (let i = 0; i < 3; i++) {
            const x = canvas.width * 0.5 + Math.sin(time + i) * 100;
            const y = canvas.height * 0.5 + Math.cos(time * 0.7 + i) * 60;
            const radius = 20 + Math.sin(time * 2 + i) * 10;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${(time * 40 + i * 120) % 360}, 70%, 50%, 0.3)`;
            ctx.fill();
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// Setup basic interactions
function initializeInteractions() {
    // Graph controls
    const graphControls = document.querySelectorAll('.graph-controls .control-btn');
    graphControls.forEach(btn => {
        btn.addEventListener('click', function() {
            // Add visual feedback
            btn.style.background = '#4a90e2';
            setTimeout(() => btn.style.background = '', 200);
        });
    });
    
    // Preview controls
    const previewControls = document.querySelectorAll('.preview-controls .control-btn');
    previewControls.forEach(btn => {
        btn.addEventListener('click', function() {
            btn.style.background = '#4a90e2';
            setTimeout(() => btn.style.background = '', 200);
        });
    });
    
    // Property sliders
    const sliders = document.querySelectorAll('.slider');
    sliders.forEach(slider => {
        const valueSpan = slider.parentElement.querySelector('.value');
        
        if (valueSpan) {
            slider.addEventListener('input', function() {
                valueSpan.textContent = parseFloat(this.value).toFixed(1);
            });
        }
    });
    
    // Search input was removed, no longer needed
}

// Node selection handling
function initializeNodeSelection() {
    const graphNodes = document.querySelectorAll('.graph-node');
    const nodeProperties = document.getElementById('nodeProperties');
    
    graphNodes.forEach(node => {
        node.addEventListener('click', function(e) {
            if (draggingNode) return; // Don't select while dragging
            
            // Remove previous selection
            graphNodes.forEach(n => n.classList.remove('selected'));
            
            // Add selection to clicked node
            this.classList.add('selected');
            
            // Show node properties
            nodeProperties.style.display = 'block';
            
            selectedNode = this.getAttribute('data-node-id') || 'selected-node';
            updatePropertyPanel(selectedNode);
        });
        
        // Right-click to open shader panel or canvas editor
        node.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            
            const nodeType = this.querySelector('.node-type').textContent;
            const nodeId = this.getAttribute('data-node-id');
            
            if (nodeType === 'Shader' || nodeType === 'Feedback') {
                toggleShaderPanel();
            } else if (nodeType === 'Canvas') {
                EditorState.currentCanvasNodeId = nodeId;
                toggleCanvasEditor();
            }
        });
    });
    
    // Click outside to deselect
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.graph-node') && !e.target.closest('.right-panel')) {
            graphNodes.forEach(n => n.classList.remove('selected'));
            selectedNode = null;
            EditorState.selectedNode = null;
            EditorState.updateProperties(); // This will show documentation
        }
    });
}

// Shader panel toggle
function toggleShaderPanel() {
    const shaderOverlay = document.getElementById('shaderOverlay');
    
    isShaderPanelOpen = !isShaderPanelOpen;
    
    if (isShaderPanelOpen) {
        shaderOverlay.style.display = 'flex';
    } else {
        shaderOverlay.style.display = 'none';
    }
}

// Basic drag and drop for node palette
function setupDragAndDrop() {
    const nodeItems = document.querySelectorAll('.node-item');
    const graphCanvas = document.querySelector('.graph-canvas');
    
    nodeItems.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            const nodeType = this.querySelector('.node-name').textContent;
            e.dataTransfer.setData('text/plain', nodeType);
            this.style.opacity = '0.5';
        });
        
        item.addEventListener('dragend', function() {
            this.style.opacity = '';
        });
    });
    
    // Graph canvas drop zone
    graphCanvas.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.background = 'rgba(74, 144, 226, 0.1)';
    });
    
    graphCanvas.addEventListener('dragleave', function() {
        this.style.background = '';
    });
    
    graphCanvas.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.background = '';
        
        const nodeType = e.dataTransfer.getData('text/plain');
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Visual feedback for drop
        showDropFeedback(x, y, nodeType);
    });
}

// Show visual feedback when dropping a node
function showDropFeedback(x, y, nodeType) {
    const feedback = document.createElement('div');
    feedback.style.position = 'absolute';
    feedback.style.left = x + 'px';
    feedback.style.top = y + 'px';
    feedback.style.background = 'rgba(74, 144, 226, 0.8)';
    feedback.style.color = 'white';
    feedback.style.padding = '4px 8px';
    feedback.style.borderRadius = '3px';
    feedback.style.fontSize = '11px';
    feedback.style.pointerEvents = 'none';
    feedback.style.zIndex = '1000';
    feedback.textContent = `${nodeType} node created`;
    
    document.querySelector('.graph-canvas').appendChild(feedback);
    
    // Animate and remove
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateY(-20px)';
        feedback.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            feedback.remove();
        }, 300);
    }, 1000);
}

// Update performance indicator
function updatePerformanceIndicator() {
    const nodeCount = document.querySelectorAll('.graph-node').length;
    const statValue = document.querySelector('.stat-value.medium');
    const performanceLevel = nodeCount < 5 ? 'low' : nodeCount < 10 ? 'medium' : 'high';
    
    statValue.className = `stat-value ${performanceLevel}`;
    statValue.textContent = performanceLevel.charAt(0).toUpperCase() + performanceLevel.slice(1);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 's':
                e.preventDefault();
                console.log('Save project');
                break;
            case 'z':
                e.preventDefault();
                console.log('Undo');
                break;
            case 'y':
                e.preventDefault();
                console.log('Redo');
                break;
        }
    }
    
    // Escape to close shader panel
    if (e.key === 'Escape' && isShaderPanelOpen) {
        toggleShaderPanel();
    }
});

// Node dragging functionality
function initializeNodeDragging() {
    const graphNodes = document.querySelectorAll('.graph-node.draggable');
    const graphCanvas = document.querySelector('.graph-canvas');
    
    graphNodes.forEach(node => {
        node.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return; // Only left mouse button
            
            draggingNode = this;
            const rect = graphCanvas.getBoundingClientRect();
            const transform = this.getAttribute('transform');
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
            const currentX = parseFloat(match[1]);
            const currentY = parseFloat(match[2]);
            
            dragOffset.x = e.clientX - rect.left - currentX;
            dragOffset.y = e.clientY - rect.top - currentY;
            
            e.preventDefault();
        });
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!draggingNode) return;
        
        const rect = graphCanvas.getBoundingClientRect();
        let newX = e.clientX - rect.left - dragOffset.x;
        let newY = e.clientY - rect.top - dragOffset.y;
        
        // Simple AABB collision prevention (brutal approach)
        const nodeWidth = 120;
        const nodeHeight = 80;
        
        // Keep within canvas bounds
        newX = Math.max(0, Math.min(newX, rect.width - nodeWidth));
        newY = Math.max(0, Math.min(newY, rect.height - nodeHeight));
        
        // Check collision with other nodes
        const otherNodes = document.querySelectorAll('.graph-node.draggable');
        otherNodes.forEach(otherNode => {
            if (otherNode === draggingNode) return;
            
            const otherTransform = otherNode.getAttribute('transform');
            const otherMatch = otherTransform.match(/translate\\(([^,]+),([^)]+)\\)/);
            const otherX = parseFloat(otherMatch[1]);
            const otherY = parseFloat(otherMatch[2]);
            
            // Simple AABB collision detection
            if (newX < otherX + nodeWidth &&
                newX + nodeWidth > otherX &&
                newY < otherY + nodeHeight &&
                newY + nodeHeight > otherY) {
                return; // Skip this position if collision
            }
        });
        
        draggingNode.setAttribute('transform', `translate(${newX}, ${newY})`);
    });
    
    document.addEventListener('mouseup', function() {
        draggingNode = null;
    });
}

// Tab switching functionality
function initializeTabs() {
    console.log('Initializing tabs...');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const settingsTab = document.getElementById('settingsTab');
    const exportTab = document.getElementById('exportTab');
    
    console.log('Found tabs:', tabBtns.length, 'Settings tab:', !!settingsTab, 'Export tab:', !!exportTab);
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            console.log('Switching to tab:', tabName);
            
            // Update active tab
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Show/hide content
            if (tabName === 'settings') {
                if (settingsTab) settingsTab.style.display = 'block';
                if (exportTab) exportTab.style.display = 'none';
            } else if (tabName === 'export') {
                if (settingsTab) settingsTab.style.display = 'none';
                if (exportTab) exportTab.style.display = 'block';
            }
        });
    });
    
    console.log('Tabs initialized');
}

// Scene graph actions
function initializeSceneActions() {
    const actionBtns = document.querySelectorAll('.action-btn');
    
    actionBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.getAttribute('title').toLowerCase();
            const nodeName = this.parentElement.parentElement.querySelector('.node-name');
            
            switch(action) {
                case 'rename':
                    nodeName.contentEditable = true;
                    nodeName.focus();
                    nodeName.addEventListener('blur', function() {
                        this.contentEditable = false;
                    });
                    nodeName.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') {
                            this.blur();
                        }
                    });
                    break;
                case 'copy':
                    console.log('Copy node:', nodeName.textContent);
                    break;
                case 'delete':
                    if (confirm(`Delete ${nodeName.textContent}?`)) {
                        console.log('Delete node:', nodeName.textContent);
                    }
                    break;
            }
        });
    });
}

// Update property panel based on selected node
function updatePropertyPanel(nodeId) {
    const propertyHeader = document.querySelector('.properties-panel h3');
    
    switch(nodeId) {
        case 'source':
            propertyHeader.textContent = 'Texture Properties';
            // Update to show texture-specific properties
            break;
        case 'blur':
            propertyHeader.textContent = 'Blur Effect Properties';
            // Already shown
            break;
        case 'output':
            propertyHeader.textContent = 'Blend Properties';
            // Update to show blend-specific properties
            break;
        default:
            propertyHeader.textContent = 'Node Properties';
    }
}

// Node palette functionality
function initializeNodePalette() {
    console.log('Initializing node palette...');
    
    // Use event delegation to handle dynamically added buttons
    document.querySelector('.node-palette').addEventListener('click', function(e) {
        if (e.target.classList.contains('add-node-btn')) {
            e.stopPropagation();
            
            const nodeItem = e.target.closest('.node-item');
            const nodeType = nodeItem.getAttribute('data-node-type');
            
            // Check node limit
            if (EditorState.nodes.size >= 16) {
                alert('Maximum of 16 nodes allowed in prototype');
                return;
            }
            
            console.log('Adding node of type:', nodeType);
            
            // Add node at a random position to avoid overlap
            const x = 50 + Math.random() * 400;
            const y = 50 + Math.random() * 200;
            EditorState.addNode(nodeType, nodeType, {x, y});
        }
    });
    
    console.log('Node palette initialized');
}

// Initialize settings functionality
function initializeSettings() {
    console.log('Initializing settings...');
    
    // Resolution change
    const resolutionSelect = document.getElementById('resolutionSelect');
    if (resolutionSelect) {
        resolutionSelect.addEventListener('change', function() {
            const [width, height] = this.value.split('x');
            const canvas = document.getElementById('preview');
            if (canvas) {
                canvas.width = parseInt(width);
                canvas.height = parseInt(height);
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.objectFit = 'contain';
            }
        });
    }
    
    // Loop checkbox
    const loopCheckbox = document.getElementById('loopCheckbox');
    const loopDuration = document.getElementById('loopDuration');
    
    if (loopCheckbox && loopDuration) {
        loopCheckbox.addEventListener('change', function() {
            loopDuration.disabled = !this.checked;
            if (this.checked) {
                loopDuration.style.opacity = '1';
                loopDuration.style.cursor = 'pointer';
            } else {
                loopDuration.style.opacity = '0.5';
                loopDuration.style.cursor = 'not-allowed';
            }
        });
    }
    
    // Record button
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
        recordBtn.addEventListener('click', function() {
            if (EditorState.isRecording) {
                // Stop recording
                EditorState.isRecording = false;
                this.classList.remove('recording');
                this.textContent = 'record';
            } else {
                // Start recording - switch to export tab and start
                EditorState.isRecording = true;
                this.classList.add('recording');
                this.textContent = 'recording';
                
                // Switch to export tab
                const exportTab = document.querySelector('[data-tab="export"]');
                if (exportTab) exportTab.click();
                
                // Auto-stop after duration
                const recordDuration = document.getElementById('recordDuration');
                const duration = recordDuration ? parseInt(recordDuration.value) * 1000 : 5000;
                setTimeout(() => {
                    if (EditorState.isRecording) {
                        EditorState.isRecording = false;
                        this.classList.remove('recording');
                        this.textContent = 'record';
                    }
                }, duration);
            }
        });
    }
    
    // Advanced collapsible
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const toggle = this.querySelector('.toggle');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                toggle.textContent = '−';
            } else {
                content.style.display = 'none';
                toggle.textContent = '+';
            }
        });
    });
    
    // Output dropdown change
    const outputDropdown = document.querySelector('.output-dropdown');
    if (outputDropdown) {
        outputDropdown.addEventListener('change', function() {
            EditorState.outputNode = this.value;
            EditorState.updateUI();
        });
    }
    
    console.log('Settings initialized');
}

// Frame counter
function updateFrameCounter() {
    setInterval(() => {
        EditorState.frameCount++;
        const frameCountEl = document.getElementById('frameCount');
        const loopCheckbox = document.getElementById('loopCheckbox');
        const loopDuration = document.getElementById('loopDuration');
        
        if (frameCountEl) {
            let displayText = EditorState.frameCount.toString();
            
            // Add loop frame info if looping is enabled
            if (loopCheckbox && loopCheckbox.checked && loopDuration) {
                const loopFrames = parseInt(loopDuration.value) * 60; // 60fps
                const currentLoopFrame = EditorState.frameCount % loopFrames;
                displayText = `${currentLoopFrame}/${loopFrames}`;
            }
            
            frameCountEl.textContent = displayText;
        }
    }, 16); // ~60fps
}

// Fix the node dragging to work with the new system
EditorState.initializeNodeDragging = function() {
    const graphCanvas = document.querySelector('.graph-canvas');
    let isDragging = false;
    let dragPreview = null;
    
    document.querySelectorAll('.graph-node.draggable').forEach(node => {
        node.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            
            draggingNode = this;
            isDragging = false; // Reset drag state
            const nodeId = this.getAttribute('data-node-id');
            const nodeData = EditorState.nodes.get(nodeId);
            if (!nodeData) return;
            
            const rect = graphCanvas.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left - nodeData.position.x;
            dragOffset.y = e.clientY - rect.top - nodeData.position.y;
            
            // Create drag preview rectangle
            const svg = document.querySelector('.graph-svg');
            dragPreview = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            dragPreview.setAttribute('class', 'node-drag-preview');
            dragPreview.setAttribute('width', '120');
            dragPreview.setAttribute('height', '80');
            dragPreview.setAttribute('rx', '4');
            dragPreview.setAttribute('x', nodeData.position.x);
            dragPreview.setAttribute('y', nodeData.position.y);
            svg.appendChild(dragPreview);
            
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!draggingNode) return;
        
        isDragging = true; // Mark as dragging to prevent other actions
        
        const nodeId = draggingNode.getAttribute('data-node-id');
        const nodeData = EditorState.nodes.get(nodeId);
        if (!nodeData) return;
        
        const rect = graphCanvas.getBoundingClientRect();
        let newX = e.clientX - rect.left - dragOffset.x;
        let newY = e.clientY - rect.top - dragOffset.y;
        
        // Keep within bounds
        newX = Math.max(0, Math.min(newX, rect.width - 120));
        newY = Math.max(0, Math.min(newY, rect.height - 80));
        
        // Update preview rectangle position (this shows where node will land)
        if (dragPreview) {
            dragPreview.setAttribute('x', newX);
            dragPreview.setAttribute('y', newY);
        }
        
        // Don't update the actual node position or visual position during drag
        // The node stays in its original position until mouse is released
    });
    
    document.addEventListener('mouseup', function(e) {
        if (draggingNode && isDragging) {
            // Get the final position from mouse
            const nodeId = draggingNode.getAttribute('data-node-id');
            const nodeData = EditorState.nodes.get(nodeId);
            
            if (nodeData) {
                const rect = graphCanvas.getBoundingClientRect();
                let finalX = e.clientX - rect.left - dragOffset.x;
                let finalY = e.clientY - rect.top - dragOffset.y;
                
                // Keep within bounds
                finalX = Math.max(0, Math.min(finalX, rect.width - 120));
                finalY = Math.max(0, Math.min(finalY, rect.height - 80));
                
                // Update node position to final location
                nodeData.position.x = finalX;
                nodeData.position.y = finalY;
            }
            
            // Remove preview rectangle
            if (dragPreview) {
                dragPreview.remove();
                dragPreview = null;
            }
            
            // Update UI with new position
            setTimeout(() => {
                EditorState.updateNodeGraph();
            }, 10);
        } else if (dragPreview) {
            // Clean up preview if drag was cancelled
            dragPreview.remove();
            dragPreview = null;
        }
        draggingNode = null;
        isDragging = false;
    });
    
    // Add graph controls functionality
    document.querySelectorAll('.graph-controls .control-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.textContent;
            
            if (action === 'center' && EditorState.selectedNode) {
                const nodeData = EditorState.nodes.get(EditorState.selectedNode);
                if (nodeData) {
                    // Center the selected node in the view
                    const canvas = document.querySelector('.graph-canvas');
                    const canvasRect = canvas.getBoundingClientRect();
                    const centerX = canvasRect.width / 2 - 60; // Half node width
                    const centerY = canvasRect.height / 2 - 40; // Half node height
                    
                    // Calculate offset to center the node
                    const offsetX = centerX - nodeData.position.x;
                    const offsetY = centerY - nodeData.position.y;
                    
                    // Move all nodes by the offset to center the selected one
                    EditorState.nodes.forEach(node => {
                        node.position.x += offsetX;
                        node.position.y += offsetY;
                        
                        // Keep nodes within bounds after centering
                        node.position.x = Math.max(0, Math.min(node.position.x, canvasRect.width - 120));
                        node.position.y = Math.max(0, Math.min(node.position.y, canvasRect.height - 80));
                    });
                    
                    EditorState.updateNodeGraph();
                }
            }
        });
    });
};

// Canvas editor toggle
function toggleCanvasEditor() {
    const shaderOverlay = document.getElementById('shaderOverlay');
    const codeEditor = shaderOverlay.querySelector('.code-editor');
    const headerTitle = shaderOverlay.querySelector('.panel-header h3');
    
    if (EditorState.currentCanvasNodeId) {
        const node = EditorState.nodes.get(EditorState.currentCanvasNodeId);
        if (node && node.type === 'Canvas') {
            // Update editor for canvas code
            headerTitle.textContent = 'Canvas Code Editor';
            codeEditor.value = node.canvasCode || EditorState.getDefaultCanvasCode();
            shaderOverlay.style.display = 'flex';
            isShaderPanelOpen = true;
        }
    }
}

// Export graph as JSON
function exportGraphAsJSON() {
    const graphData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        nodes: Array.from(EditorState.nodes.entries()).map(([id, node]) => ({
            id,
            type: node.type,
            name: node.name,
            position: node.position,
            uniforms: node.uniforms,
            shader: node.shader,
            canvasCode: node.canvasCode,
            url: node.url,
            width: node.width,
            height: node.height,
            blendMode: node.blendMode
        })),
        connections: EditorState.connections,
        outputNode: EditorState.outputNode,
        settings: {
            resolution: document.getElementById('resolutionSelect')?.value || '512x512',
            loop: document.getElementById('loopCheckbox')?.checked || false,
            loopDuration: document.getElementById('loopDuration')?.value || '4'
        }
    };
    
    // Create and download JSON file
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minigl-graph-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Visual feedback
    const btn = document.querySelector('.json-export-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Exported!';
    btn.style.background = '#2a4a2a';
    btn.style.color = '#51cf66';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
    }, 2000);
}

// Make functions available globally
window.toggleShaderPanel = toggleShaderPanel;
window.toggleCanvasEditor = toggleCanvasEditor;
window.exportGraphAsJSON = exportGraphAsJSON;
window.EditorState = EditorState;