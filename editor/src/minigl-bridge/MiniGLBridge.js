// MiniGL Bridge - Handles integration between editor and miniGL
import editorState from '../core/EditorState.js';

export class MiniGLBridge {
    constructor(canvas) {
        this.canvas = canvas;
        this.minigl = null;
        this.isInitialized = false;
        this.animationFrame = null;
    }
    
    async initialize() {
        try {
            // Try to load MiniGL
            const MiniGL = await this.loadMiniGL();
            
            if (MiniGL) {
                // Create MiniGL instance with canvas
                this.minigl = new MiniGL(this.canvas, { fps: 60 });
                editorState.minigl = this.minigl;
                
                // Start render loop
                this.startRenderLoop();
                
                console.log('MiniGL Bridge initialized with real miniGL');
            } else {
                // Fallback to placeholder
                console.log('MiniGL not found, using placeholder mode');
                this.startPlaceholderAnimation();
            }
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize MiniGL:', error);
            // Fallback to placeholder
            this.startPlaceholderAnimation();
            this.isInitialized = true;
            return true;
        }
    }
    
    async loadMiniGL() {
        // Try to load MiniGL from the lib directory
        try {
            // Correct path: go up 2 levels from /editor/src/ to get to root, then to lib
            const module = await import('../../../lib/miniGL/miniGL.js');
            return module.miniGL || module.default || window.miniGL;
        } catch (error) {
            console.warn('Failed to load MiniGL module:', error);
            // Fallback to global miniGL if available
            if (window.miniGL) {
                return window.miniGL;
            }
            return null;
        }
    }
    
    setupDefaultScene() {
        // Don't create default scene - let the app.js handle it
        console.log('MiniGL scene ready for nodes');
    }
    
    startPlaceholderAnimation() {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        
        let frame = 0;
        const animate = () => {
            const time = frame * 0.01;
            
            // Create gradient
            const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
            gradient.addColorStop(0, `hsl(${(time * 20) % 360}, 50%, 30%)`);
            gradient.addColorStop(0.5, `hsl(${(time * 30 + 60) % 360}, 60%, 20%)`);
            gradient.addColorStop(1, `hsl(${(time * 25 + 120) % 360}, 40%, 25%)`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Add text
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '24px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('MiniGL Preview (Placeholder)', this.canvas.width/2, this.canvas.height/2);
            
            // Add some animated circles
            for (let i = 0; i < 3; i++) {
                const x = this.canvas.width * 0.5 + Math.sin(time + i) * 100;
                const y = this.canvas.height * 0.5 + Math.cos(time * 0.7 + i) * 60;
                const radius = 20 + Math.sin(time * 2 + i) * 10;
                
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${(time * 40 + i * 120) % 360}, 70%, 50%, 0.3)`;
                ctx.fill();
            }
            
            frame++;
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    startRenderLoop() {
        if (!this.minigl) return;
        
        // Use miniGL's render method with callback
        if (typeof this.minigl.render === 'function') {
            console.log('Starting render with miniGL nodes:', editorState.miniglNodes.size);
            this.minigl.render((time) => {
                // Update time uniforms for all nodes
                editorState.nodes.forEach((node, id) => {
                    if (node.uniforms && node.uniforms.uTime) {
                        const miniglNode = editorState.miniglNodes.get(id);
                        if (miniglNode && miniglNode.updateUniform) {
                            miniglNode.updateUniform('uTime', time * 0.001);
                        }
                    }
                });
            });
        } else {
            console.error('miniGL.render is not a function, falling back to placeholder');
            this.startPlaceholderAnimation();
        }
    }
    
    stopRenderLoop() {
        if (this.minigl && this.minigl.stop) {
            this.minigl.stop();
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    updateNodeProperty(nodeId, property, value) {
        const node = editorState.nodes.get(nodeId);
        const miniglNode = editorState.miniglNodes.get(nodeId);
        
        if (!node || !miniglNode) return;
        
        switch (property) {
            case 'url':
                if (node.type === 'Texture' || node.type === 'Video') {
                    // For textures and videos, we need to recreate the node with new URL
                    editorState.miniglNodes.delete(nodeId);
                    const newMiniglNode = editorState.createMiniGLNode(node);
                    
                    // Reconnect any existing connections
                    editorState.connections.forEach(conn => {
                        if (conn.from === nodeId || conn.to === nodeId) {
                            const fromMiniGL = editorState.miniglNodes.get(conn.from);
                            const toMiniGL = editorState.miniglNodes.get(conn.to);
                            if (fromMiniGL && toMiniGL) {
                                const toNode = editorState.getNode(conn.to);
                                if (toNode.type === 'Shader' || toNode.type === 'Feedback') {
                                    toMiniGL.connect('glTexture', fromMiniGL);
                                }
                            }
                        }
                    });
                    
                    // Update output if this was the output node
                    if (editorState.outputNode === nodeId) {
                        editorState.setOutputNode(nodeId);
                    }
                }
                break;
                
            case 'shader':
                if (node.type === 'Shader' || node.type === 'Feedback') {
                    // For shader nodes, we need to recreate with new shader
                    editorState.miniglNodes.delete(nodeId);
                    const newMiniglNode = editorState.createMiniGLNode(node);
                    
                    // Reconnect any existing connections
                    editorState.connections.forEach(conn => {
                        if (conn.from === nodeId || conn.to === nodeId) {
                            const fromMiniGL = editorState.miniglNodes.get(conn.from);
                            const toMiniGL = editorState.miniglNodes.get(conn.to);
                            if (fromMiniGL && toMiniGL) {
                                const toNode = editorState.getNode(conn.to);
                                if (toNode.type === 'Shader' || toNode.type === 'Feedback') {
                                    toMiniGL.connect('glTexture', fromMiniGL);
                                }
                            }
                        }
                    });
                    
                    // Update output if this was the output node
                    if (editorState.outputNode === nodeId) {
                        editorState.setOutputNode(nodeId);
                    }
                }
                break;
                
            case 'canvasCode':
                if (node.type === 'Canvas' && miniglNode.update) {
                    try {
                        const updateFunction = new Function('ctx', 'width', 'height', 'frame', value);
                        miniglNode.update(updateFunction);
                        node.canvasCode = value;
                    } catch (error) {
                        console.error('Invalid canvas code:', error);
                    }
                }
                break;
                
            case 'uniform':
                // value should be {name: string, value: any}
                if (miniglNode.uniform) {
                    miniglNode.uniform(value.name, value.value);
                    if (node.uniforms[value.name]) {
                        node.uniforms[value.name].value = value.value;
                    }
                }
                break;
                
            case 'blendMode':
                if (node.type === 'Blend' && miniglNode.mode) {
                    miniglNode.mode(value);
                    node.blendMode = value;
                }
                break;
        }
    }
    
    dispose() {
        this.stopRenderLoop();
        
        if (this.minigl && this.minigl.dispose) {
            this.minigl.dispose();
        }
        
        this.minigl = null;
        this.isInitialized = false;
    }
}

// Export singleton instance
export const miniGLBridge = new MiniGLBridge(null);
export default miniGLBridge;