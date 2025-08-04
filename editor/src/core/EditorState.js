// Core Editor State Management
export class EditorState {
    constructor() {
        this.selectedNode = null;
        this.isShaderPanelOpen = false;
        this.isRecording = false;
        this.frameCount = 0;
        this.nodes = new Map();
        this.connections = [];
        this.outputNode = null;
        this.minigl = null; // Will be initialized with miniGL instance
        this.miniglNodes = new Map(); // Maps editor node IDs to miniGL nodes
        
        // Bind methods
        this.addNode = this.addNode.bind(this);
        this.removeNode = this.removeNode.bind(this);
        this.selectNode = this.selectNode.bind(this);
        this.connectNodes = this.connectNodes.bind(this);
        this.updateUI = this.updateUI.bind(this);
    }
    
    // Initialize with miniGL instance
    initializeMiniGL(canvas) {
        // Dynamic import to handle miniGL
        return import('../../lib/miniGL/miniGL.js').then(module => {
            const MiniGL = module.default || module.MiniGL;
            this.minigl = new MiniGL(canvas);
            return this.minigl;
        });
    }
    
    // Node management
    addNode(type, name, position = {x: 100, y: 100}) {
        const id = 'node_' + Date.now();
        const node = {
            id,
            type,
            name: name || type,
            position,
            uniforms: this.getDefaultUniforms(type),
            shader: this.getDefaultShader(type),
            inputs: [],
            outputs: type !== 'Output' ? ['output'] : []
        };
        
        this.nodes.set(id, node);
        
        // Create corresponding miniGL node
        if (this.minigl) {
            this.createMiniGLNode(node);
        }
        
        this.updateUI();
        return node;
    }
    
    createMiniGLNode(editorNode) {
        if (!this.minigl) {
            console.warn('Cannot create miniGL node - minigl instance not available');
            return null;
        }
        
        let miniglNode = null;
        
        switch (editorNode.type) {
            case 'Texture':
                // Use image() method for textures
                miniglNode = this.minigl.image(editorNode.url || 'https://picsum.photos/512/512', {
                    width: editorNode.width || 512,
                    height: editorNode.height || 512,
                    fitting: 'cover'
                });
                break;
                
            case 'Video':
                // Use video() method
                miniglNode = this.minigl.video(editorNode.url || '', {
                    width: editorNode.width || 512,
                    height: editorNode.height || 512,
                    loop: true,
                    autoplay: true
                });
                break;
                
            case 'Canvas':
                // Create canvas node with draw function
                let drawFunction;
                try {
                    if (editorNode.canvasCode) {
                        drawFunction = new Function('ctx', 'width', 'height', 'frame', editorNode.canvasCode);
                    } else {
                        drawFunction = (ctx, w, h, frame) => {
                            ctx.fillStyle = '#333';
                            ctx.fillRect(0, 0, w, h);
                            ctx.fillStyle = '#fff';
                            ctx.font = '24px monospace';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText('Canvas', w/2, h/2);
                        };
                    }
                } catch (error) {
                    console.error('Error creating canvas draw function:', error);
                    drawFunction = (ctx, w, h, frame) => {
                        ctx.fillStyle = '#f00';
                        ctx.fillRect(0, 0, w, h);
                    };
                }
                    
                miniglNode = this.minigl.canvas2D(drawFunction, {
                    width: editorNode.width || 512,
                    height: editorNode.height || 512
                });
                break;
                
            case 'Shader':
                // Create shader with uniforms
                const uniforms = {};
                Object.entries(editorNode.uniforms || {}).forEach(([name, uniform]) => {
                    if (uniform.type === 'slider' || uniform.type === 'constant') {
                        uniforms[name] = uniform.value;
                    }
                });
                
                // Use the actual shader code or default
                const shaderCode = editorNode.shader || this.getDefaultShader('Shader');
                
                miniglNode = this.minigl.shader(
                    shaderCode,
                    uniforms,
                    {
                        width: editorNode.width || 512,
                        height: editorNode.height || 512
                    }
                );
                break;
                
            case 'Blend':
                // Create blend node with proper uniforms
                miniglNode = this.minigl.blend({
                    glOpacity: editorNode.opacity || 1.0
                }, {
                    mode: editorNode.blendMode || 'normal',
                    width: editorNode.width || 512,
                    height: editorNode.height || 512
                });
                break;
                
            case 'Feedback':
                // Create feedback/pingpong node with shader
                miniglNode = this.minigl.pingpong(
                    editorNode.shader || this.getDefaultShader('Feedback'),
                    editorNode.uniforms || {},
                    {
                        width: editorNode.width || 512,
                        height: editorNode.height || 512
                    }
                );
                break;
        }
        
        if (miniglNode) {
            this.miniglNodes.set(editorNode.id, miniglNode);
        }
        
        return miniglNode;
    }
    
    removeNode(id) {
        const miniglNode = this.miniglNodes.get(id);
        if (miniglNode && miniglNode.dispose) {
            miniglNode.dispose();
        }
        
        this.nodes.delete(id);
        this.miniglNodes.delete(id);
        this.connections = this.connections.filter(c => c.from !== id && c.to !== id);
        
        if (this.outputNode === id) {
            this.outputNode = null;
        }
        
        this.updateUI();
    }
    
    connectNodes(fromId, toId, fromPort = 'output', toPort = 'input') {
        // Validate connection
        const fromNode = this.nodes.get(fromId);
        const toNode = this.nodes.get(toId);
        
        if (!fromNode || !toNode) {
            console.error('One or both nodes not found');
            return false;
        }
        
        // Check if connection already exists
        const exists = this.connections.some(c => 
            c.from === fromId && c.to === toId
        );
        
        if (exists) {
            return false;
        }
        
        // Add connection
        this.connections.push({ from: fromId, to: toId, fromPort, toPort });
        
        // Update miniGL connections
        const fromMiniGL = this.miniglNodes.get(fromId);
        const toMiniGL = this.miniglNodes.get(toId);
        
        if (fromMiniGL && toMiniGL) {
            try {
                // Use miniGL's connect method
                if (toNode.type === 'Blend') {
                    // Blend nodes have base and blend inputs
                    const existingConnections = this.connections.filter(c => c.to === toId);
                    if (existingConnections.length === 1) {
                        toMiniGL.connect('glBase', fromMiniGL);
                    } else {
                        toMiniGL.connect('glBlend', fromMiniGL);
                    }
                } else if (toNode.type === 'Shader' || toNode.type === 'Feedback') {
                    // Shader nodes use glTexture input
                    toMiniGL.connect('glTexture', fromMiniGL);
                } else {
                    // Generic input connection
                    toMiniGL.input(fromMiniGL);
                }
            } catch (error) {
                console.error('Error connecting miniGL nodes:', error);
            }
        }
        
        this.updateUI();
        return true;
    }
    
    disconnectNodes(fromId, toId) {
        this.connections = this.connections.filter(c => 
            !(c.from === fromId && c.to === toId)
        );
        
        // TODO: Handle miniGL disconnection (may need to recreate nodes)
        this.updateUI();
    }
    
    selectNode(id) {
        this.selectedNode = id;
        this.updateUI();
    }
    
    setOutputNode(id) {
        this.outputNode = id;
        const miniglNode = this.miniglNodes.get(id);
        const node = this.nodes.get(id);
        
        if (miniglNode && this.minigl) {
            try {
                console.log('Setting output to:', node?.type, miniglNode);
                // Use miniGL's output method
                this.minigl.output(miniglNode);
            } catch (error) {
                console.error('Error setting miniGL output:', error);
            }
        } else {
            console.warn('Cannot set output - miniglNode:', miniglNode, 'minigl:', this.minigl);
        }
        
        this.updateUI();
    }
    
    getDefaultUniforms(type) {
        const defaults = {
            'Shader': { 
                uTime: { type: 'slider', value: 0, min: 0, max: 10 },
                uMouse: { type: 'constant', value: [0, 0] }
            },
            'Feedback': { 
                uDecay: { type: 'slider', value: 0.95, min: 0, max: 1 }
            },
            'Blur': { 
                uRadius: { type: 'slider', value: 2, min: 0, max: 10 } 
            },
            'Blend': { 
                uMix: { type: 'slider', value: 0.5, min: 0, max: 1 }
            },
            'Texture': {},
            'Video': {},
            'Canvas': {}
        };
        return defaults[type] || {};
    }
    
    getDefaultShader(type) {
        const shaders = {
            'Shader': `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform vec3 glMouse;
uniform sampler2D glTexture;
uniform float uTime;

in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 uv = glUV;
    vec4 color = texture(glTexture, uv);
    
    // Simple effect: rotate hue over time
    float hue = uTime * 0.1;
    color.rgb = vec3(
        color.r * cos(hue) - color.g * sin(hue),
        color.r * sin(hue) + color.g * cos(hue),
        color.b
    );
    
    fragColor = color;
}`,
            'Feedback': `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;
uniform sampler2D glTexture;
uniform sampler2D glPrevious;
uniform float uDecay;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 uv = glUV;
    vec4 current = texture(glTexture, uv);
    vec4 previous = texture(glPrevious, uv);
    fragColor = mix(current, previous, uDecay);
}`
        };
        return shaders[type] || '';
    }
    
    getDefaultCanvasCode() {
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
    }
    
    // Utility methods
    getNodeIcon(type) {
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
    }
    
    hasInput(type) {
        return ['Shader', 'Blend', 'Feedback'].includes(type);
    }
    
    hasOutput(type) {
        return ['Texture', 'Video', 'Canvas', 'Shader', 'Blend', 'Feedback'].includes(type);
    }
    
    exportGraph() {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
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
            connections: this.connections,
            outputNode: this.outputNode
        };
    }
    
    importGraph(data) {
        // Clear existing
        this.nodes.clear();
        this.miniglNodes.clear();
        this.connections = [];
        
        // Import nodes
        data.nodes.forEach(nodeData => {
            const node = {
                id: nodeData.id,
                type: nodeData.type,
                name: nodeData.name,
                position: nodeData.position,
                uniforms: nodeData.uniforms || this.getDefaultUniforms(nodeData.type),
                shader: nodeData.shader,
                canvasCode: nodeData.canvasCode,
                url: nodeData.url,
                width: nodeData.width,
                height: nodeData.height,
                blendMode: nodeData.blendMode
            };
            
            this.nodes.set(node.id, node);
            
            if (this.minigl) {
                this.createMiniGLNode(node);
            }
        });
        
        // Import connections
        data.connections.forEach(conn => {
            this.connectNodes(conn.from, conn.to, conn.fromPort, conn.toPort);
        });
        
        // Set output
        if (data.outputNode) {
            this.setOutputNode(data.outputNode);
        }
        
        this.updateUI();
    }
    
    // UI update stub - will be implemented by UI components
    updateUI() {
        // This will be overridden by the UI system
        if (this.onUpdate) {
            this.onUpdate();
        }
    }
    
    // Helper methods for UI components
    getNode(id) {
        return this.nodes.get(id);
    }
    
    triggerUpdate() {
        this.updateUI();
    }
}

// Create singleton instance
export const editorState = new EditorState();
export default editorState;