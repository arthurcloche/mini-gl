// MiniGL Bridge - Handles integration between editor and miniGL
import editorState from '../core/EditorState.js';

export class MiniGLBridge {
    constructor(canvas) {
        this.canvas = canvas;
        this.minigl = null;
        this.isInitialized = false;
        this.animationFrame = null;
        this.isPaused = false;
    }
    
    async initialize() {
        try {
            // Try to load MiniGL
            const miniGLClass = await this.loadMiniGL();
            
            if (miniGLClass) {
                console.log('Creating MiniGL with canvas:', this.canvas);
                console.log('Canvas tagName:', this.canvas.tagName);
                console.log('Canvas before MiniGL:', {
                    width: this.canvas.width,
                    height: this.canvas.height,
                    clientWidth: this.canvas.clientWidth,
                    clientHeight: this.canvas.clientHeight
                });
                
                // Create MiniGL instance with canvas - disable responsive
                this.minigl = new miniGLClass(this.canvas, { 
                    fps: 60,
                    width: 512,
                    height: 512
                });
                editorState.minigl = this.minigl;
                
                // Set up ResizeObserver for panel resizing
                this.setupResizeObserver();
                
                console.log('Canvas after MiniGL:', {
                    width: this.canvas.width,
                    height: this.canvas.height,
                    clientWidth: this.canvas.clientWidth,
                    clientHeight: this.canvas.clientHeight
                });
                console.log('MiniGL canvas:', this.minigl.canvas);
                console.log('MiniGL canvas same as ours?', this.minigl.canvas === this.canvas);
                console.log('MiniGL instance created:', this.minigl);
                
                // Verify WebGL context 
                const gl = this.minigl.gl;
                if (!gl) {
                    console.error('miniGL WebGL2 context not available');
                    this.startPlaceholderAnimation();
                    return;
                }
                console.log('miniGL WebGL2 context ready');
                
                // Test if we can create and render a simple shader
                try {
                    const testShader = this.minigl.shader(`#version 300 es
                        precision highp float;
                        uniform vec2 glResolution;
                        in vec2 glCoord;
                        out vec4 fragColor;
                        void main() {
                            vec2 uv = glCoord / glResolution;
                            fragColor = vec4(uv.x, uv.y, 0.5, 1.0);
                        }`);
                    console.log('Test shader created successfully:', testShader);
                    console.log('Test shader properties:', Object.keys(testShader));
                    
                    // Try to set it as output and render
                    this.minigl.output(testShader);
                    console.log('Test shader set as output');
                    
                    // Check if render actually starts
                    const renderResult = this.minigl.render();
                    console.log('Render method called, result:', renderResult);
                    console.log('Animation ID after render:', this.minigl._animationId);
                    
                    // Force a manual render to test
                    setTimeout(() => {
                        console.log('Forcing manual render test');
                        if (this.minigl.renderToScreen) {
                            this.minigl.renderToScreen();
                            console.log('Manual render to screen called');
                        }
                    }, 100);
                    
                } catch (e) {
                    console.error('Failed to create test shader:', e);
                    console.error('Error details:', e.message, e.stack);
                }
                
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
            // miniGL class is exported as default
            return module.default || module.miniGL || window.miniGL;
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
        console.log('Starting placeholder animation on canvas:', this.canvas);
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get 2D context for canvas');
            return;
        }
        
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
        
        console.log('miniGL instance:', this.minigl);
        console.log('miniGL methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.minigl)));
        
        // Don't start render here, let it start when output is set
        console.log('Render loop ready to start when output is set');
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
    
    setupResizeObserver() {
        const container = this.canvas?.parentElement;
        if (!container || !window.ResizeObserver) return;
        
        // Disconnect any existing observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Get current aspect ratio from settings
                const resolutionSelect = document.getElementById('resolutionSelect');
                if (!resolutionSelect) return;
                
                const ratio = resolutionSelect.value;
                const [widthRatio, heightRatio] = ratio.split(':').map(Number);
                const aspectRatio = widthRatio / heightRatio;
                
                // Calculate optimal size to fit within container
                const containerRect = entry.contentRect;
                const containerAspect = containerRect.width / containerRect.height;
                let width, height;
                
                if (aspectRatio > containerAspect) {
                    // Canvas is wider than container - fit to width
                    width = Math.floor(containerRect.width);
                    height = Math.floor(width / aspectRatio);
                } else {
                    // Canvas is taller than container - fit to height
                    height = Math.floor(containerRect.height);
                    width = Math.floor(height * aspectRatio);
                }
                
                // Ensure minimum size and make it power of 2 friendly
                width = Math.max(256, Math.round(width / 64) * 64);
                height = Math.max(256, Math.round(height / 64) * 64);
                
                // Update canvas dimensions
                this.canvas.width = width;
                this.canvas.height = height;
                
                // Update CSS to center in container
                this.canvas.style.width = width + 'px';
                this.canvas.style.height = height + 'px';
                this.canvas.style.position = 'absolute';
                this.canvas.style.left = '50%';
                this.canvas.style.top = '50%';
                this.canvas.style.transform = 'translate(-50%, -50%)';
                
                // Update miniGL resolution
                if (this.minigl && this.minigl.resize) {
                    this.minigl.resize(width, height);
                }
            }
        });
        
        this.resizeObserver.observe(container);
    }
    
    dispose() {
        this.stopRenderLoop();
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
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