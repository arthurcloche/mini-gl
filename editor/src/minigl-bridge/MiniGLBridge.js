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
                // Canvas dimensions should already be set with DPR by app.js
                // Use the existing canvas dimensions
                const width = this.canvas.width;
                const height = this.canvas.height;
                
                // Create MiniGL instance with canvas - enable antialiasing explicitly
                this.minigl = new miniGLClass(this.canvas, { 
                    fps: 60,
                    width: width,
                    height: height,
                    contextOptions: {
                        antialias: true,
                        powerPreference: "high-performance",
                        preserveDrawingBuffer: true,
                        premultipliedAlpha: true,
                        alpha: true
                    }
                });
                editorState.minigl = this.minigl;
                
                // Set up ResizeObserver for panel resizing
                this.setupResizeObserver();
                
                // Trigger initial resize to ensure proper canvas dimensions
                this.triggerInitialResize();
                
                // Verify WebGL context 
                const gl = this.minigl.gl;
                if (!gl) {
                    console.error('miniGL WebGL2 context not available');
                    this.startPlaceholderAnimation();
                    return;
                }
                
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
                    
                    // Try to set it as output and render
                    this.minigl.output(testShader);
                    
                    // Check if render actually starts
                    const renderResult = this.minigl.render();
                    
                    // Force a manual render to test
                    setTimeout(() => {
                        if (this.minigl.renderToScreen) {
                            this.minigl.renderToScreen();
                        }
                    }, 100);
                    
                } catch (e) {
                    console.error('Failed to create test shader:', e);
                    console.error('Error details:', e.message, e.stack);
                }
                
                // Start render loop
                this.startRenderLoop();
                
            } else {
                // Fallback to placeholder
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
    }
    
    startPlaceholderAnimation() {
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
        
        
        // Don't start render here, let it start when output is set
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
                if (node.type === 'Texture') {
                    // Store the old miniGL node reference
                    const oldMiniglNode = editorState.miniglNodes.get(nodeId);
                    
                    // Set loading state
                    node.loadingState = 'loading';
                    editorState.triggerUpdate();
                    
                    // Preload the new image first
                    const testImg = new Image();
                    
                    // Check if URL is same-origin
                    let isSameOrigin = false;
                    try {
                        const urlObj = new URL(value, window.location.href);
                        isSameOrigin = urlObj.origin === window.location.origin;
                    } catch (e) {
                        // Relative URLs are same-origin
                        isSameOrigin = true;
                    }
                    
                    // Set crossOrigin for external URLs (same as MiniGL does)
                    if (!isSameOrigin) {
                        testImg.crossOrigin = "anonymous";
                    }
                    
                    testImg.onload = () => {
                        console.log('New image loaded successfully:', value);
                        
                        // Now that image is loaded, update the node
                        node.url = value;
                        node.loadingState = 'loaded';
                        
                        // Delete old node and create new one with loaded image
                        editorState.miniglNodes.delete(nodeId);
                        const newMiniglNode = editorState.createMiniGLNode(node);
                        
                        // Reconnect connections
                        editorState.connections.forEach(conn => {
                            if (conn.from === nodeId || conn.to === nodeId) {
                                const fromMiniGL = editorState.miniglNodes.get(conn.from);
                                const toMiniGL = editorState.miniglNodes.get(conn.to);
                                if (fromMiniGL && toMiniGL) {
                                    const toNode = editorState.getNode(conn.to);
                                    if (toNode.type === 'Shader' || toNode.type === 'Feedback') {
                                        toMiniGL.connect('glTexture', fromMiniGL);
                                    } else if (toNode.type === 'Blend') {
                                        // Handle Blend node connections
                                        const existingConnections = editorState.connections.filter(c => c.to === conn.to);
                                        if (existingConnections.length === 1) {
                                            toMiniGL.connect('glBase', fromMiniGL);
                                        } else {
                                            toMiniGL.connect('glBlend', fromMiniGL);
                                        }
                                    }
                                }
                            }
                        });
                        
                        // Update output if needed
                        if (editorState.outputNode === nodeId) {
                            editorState.setOutputNode(nodeId);
                        }
                        
                        editorState.triggerUpdate();
                    };
                    
                    testImg.onerror = (error) => {
                        console.error('Failed to load image:', value);
                        
                        // Provide helpful error message
                        if (!isSameOrigin) {
                            console.error('This might be a CORS issue. The image server needs to send proper Access-Control-Allow-Origin headers.');
                            console.info('Try using a CORS-enabled image service like Lorem Picsum (https://picsum.photos/800/600) or upload a local file.');
                        }
                        
                        node.loadingState = 'error';
                        
                        // Keep the old texture node if new image fails
                        if (oldMiniglNode) {
                            console.log('Keeping previous texture due to load failure');
                        }
                        
                        editorState.triggerUpdate();
                    };
                    
                    // Start loading the image
                    testImg.src = value;
                }
                break;
                
            case 'shader':
                if (node.type === 'Shader' || node.type === 'Feedback' || 
                    node.type === 'Grayscale' || node.type === 'Blur' || 
                    node.type === 'LensDistortion') {
                    // Store existing connections before recreating
                    const connectionsToRestore = editorState.connections.filter(conn => 
                        conn.from === nodeId || conn.to === nodeId
                    );
                    
                    // For shader nodes, we need to recreate with new shader
                    editorState.miniglNodes.delete(nodeId);
                    const newMiniglNode = editorState.createMiniGLNode(node);
                    
                    // Reconnect using the proper input names
                    connectionsToRestore.forEach(conn => {
                        const fromMiniGL = editorState.miniglNodes.get(conn.from);
                        const toMiniGL = editorState.miniglNodes.get(conn.to);
                        
                        if (fromMiniGL && toMiniGL) {
                            if (conn.to === nodeId) {
                                // This node is receiving input
                                const toNode = editorState.getNode(nodeId);
                                const inputConnections = connectionsToRestore.filter(c => c.to === nodeId);
                                const inputIndex = inputConnections.indexOf(conn);
                                
                                if (toNode.inputs && toNode.inputs[inputIndex]) {
                                    toMiniGL.connect(toNode.inputs[inputIndex], fromMiniGL);
                                } else {
                                    toMiniGL.connect('glTexture', fromMiniGL);
                                }
                            } else if (conn.from === nodeId) {
                                // This node is providing output to another
                                const toNode = editorState.getNode(conn.to);
                                const inputConnections = editorState.connections.filter(c => c.to === conn.to);
                                const inputIndex = inputConnections.indexOf(conn);
                                
                                if (toNode.inputs && toNode.inputs[inputIndex]) {
                                    toMiniGL.connect(toNode.inputs[inputIndex], fromMiniGL);
                                } else if (toNode.type === 'Blend') {
                                    if (inputConnections.length === 1) {
                                        toMiniGL.connect('glBase', fromMiniGL);
                                    } else {
                                        toMiniGL.connect('glBlend', fromMiniGL);
                                    }
                                } else {
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
                if (node.type === 'Canvas') {
                    // For canvas code changes, we need to recreate the node
                    editorState.miniglNodes.delete(nodeId);
                    node.canvasCode = value;
                    const newMiniglNode = editorState.createMiniGLNode(node);
                    
                    // Update output if this was the output node
                    if (editorState.outputNode === nodeId) {
                        editorState.setOutputNode(nodeId);
                    }
                }
                break;
                
            case 'uniform':
                // value should be {name: string, value: any}
                if (miniglNode.updateUniform) {
                    miniglNode.updateUniform(value.name, value.value);
                    if (node.uniforms[value.name]) {
                        node.uniforms[value.name].value = value.value;
                    }
                    
                    // Force a render to show the uniform change immediately
                    if (this.minigl && this.minigl.renderToScreen) {
                        this.minigl.renderToScreen();
                    }
                }
                break;
                
            case 'blendMode':
                if (node.type === 'Blend') {
                    // Update the blend mode uniform
                    const blendModes = {
                        screen: 0,
                        multiply: 1,
                        overlay: 2
                    };
                    
                    const modeValue = blendModes[value] || 0;
                    node.blendMode = value;
                    
                    // Update the uniform directly
                    if (miniglNode.updateUniform) {
                        miniglNode.updateUniform('glBlendMode', modeValue);
                    } else if (miniglNode.uniforms) {
                        miniglNode.uniforms.glBlendMode = modeValue;
                    }
                    
                    // Force a render
                    if (this.minigl && this.minigl.renderToScreen) {
                        this.minigl.renderToScreen();
                    }
                }
                break;
                
            case 'sizeMode':
                if (node.type === 'Texture') {
                    // For size mode changes, we need to recreate the node
                    node.sizeMode = value;
                    editorState.miniglNodes.delete(nodeId);
                    editorState.createMiniGLNode(node);
                    
                    // Reconnect connections
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
                    
                    // Update output if needed
                    if (editorState.outputNode === nodeId) {
                        editorState.setOutputNode(nodeId);
                    }
                }
                break;
                
            case 'animate':
                if (node.type === 'Canvas') {
                    // Store animate state on the node
                    node.animate = value;
                    
                    console.log('Animation toggled:', {
                        nodeId: nodeId,
                        animate: value,
                        miniglNodeExists: !!miniglNode
                    });
                    
                    // The animation logic is now handled in the update override
                    // which checks node.animate dynamically, so just ensure render loop is running
                    if (value && this.minigl && !this.minigl.isRunning()) {
                        console.log('Starting render loop for animation');
                        this.minigl.render();
                    }
                }
                break;
                
            case 'canvasSize':
                if (node.type === 'Canvas') {
                    // For canvas size changes, we need to recreate the node
                    editorState.miniglNodes.delete(nodeId);
                    const newMiniglNode = editorState.createMiniGLNode(node);
                    
                    // Update output if this was the output node
                    if (editorState.outputNode === nodeId) {
                        editorState.setOutputNode(nodeId);
                    }
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
        
        let resizeTimeout;
        this.resizeObserver = new ResizeObserver((entries) => {
            // Debounce resize events
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                for (const entry of entries) {
                    // Responsive mode: fill the entire container
                    const containerRect = entry.contentRect;
                    let width = Math.floor(containerRect.width);
                    let height = Math.floor(containerRect.height);
                    
                    // Ensure minimum size
                    width = Math.max(256, width);
                    height = Math.max(256, height);
                    
                    // Get device pixel ratio with minimum of 2
                    const dpr = Math.max(2, window.devicePixelRatio || 1);
                    
                    // Update canvas dimensions with DPR
                    this.canvas.width = width * dpr;
                    this.canvas.height = height * dpr;
                    
                    // Update CSS to display size (not pixel size)
                    this.canvas.style.width = width + 'px';
                    this.canvas.style.height = height + 'px';
                    this.canvas.style.position = 'absolute';
                    this.canvas.style.left = '50%';
                    this.canvas.style.top = '50%';
                    this.canvas.style.transform = 'translate(-50%, -50%)';
                    
                    // Update miniGL resolution - resize() reads from canvas dimensions
                    if (this.minigl) {
                        // Store the DPR-adjusted dimensions
                        const actualWidth = this.canvas.width;
                        const actualHeight = this.canvas.height;
                        
                        // MiniGL's resize() method reads dimensions from the canvas
                        // and automatically resizes ALL nodes to match canvas dimensions
                        if (this.minigl.resize) {
                            this.minigl.resize();
                        }
                        
                        // Ensure canvas dimensions weren't overridden
                        if (this.canvas.width !== actualWidth || this.canvas.height !== actualHeight) {
                            console.warn('Canvas dimensions were overridden by miniGL.resize(), restoring DPR dimensions');
                            this.canvas.width = actualWidth;
                            this.canvas.height = actualHeight;
                        }
                        
                        // Force immediate render after resize
                        if (this.minigl.renderToScreen) {
                            this.minigl.renderToScreen();
                        }
                    }
                }
            }, 100);
        });
        
        this.resizeObserver.observe(container);
    }
    
    triggerInitialResize() {
        const container = this.canvas?.parentElement;
        if (!container) return;
        
        // Responsive mode: fill the entire container
        const containerRect = container.getBoundingClientRect();
        let width = Math.floor(containerRect.width);
        let height = Math.floor(containerRect.height);
        
        // Ensure minimum size
        width = Math.max(256, width);
        height = Math.max(256, height);
        
        // Get device pixel ratio with minimum of 2
        const dpr = Math.max(2, window.devicePixelRatio || 1);
        
        // Update canvas dimensions with DPR
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        
        // Update CSS to display size (not pixel size)
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '50%';
        this.canvas.style.top = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)';
        
        // Update miniGL resolution - resize() reads from canvas dimensions
        if (this.minigl) {
            // Store the DPR-adjusted dimensions
            const actualWidth = this.canvas.width;
            const actualHeight = this.canvas.height;
            
            // MiniGL's resize() method reads dimensions from the canvas
            // and automatically resizes ALL nodes to match canvas dimensions
            if (this.minigl.resize) {
                this.minigl.resize();
            }
            
            // Ensure canvas dimensions weren't overridden
            if (this.canvas.width !== actualWidth || this.canvas.height !== actualHeight) {
                console.warn('Canvas dimensions were overridden by miniGL.resize(), restoring DPR dimensions');
                this.canvas.width = actualWidth;
                this.canvas.height = actualHeight;
            }
            
            
            // Force immediate render after resize
            if (this.minigl.renderToScreen) {
                this.minigl.renderToScreen();
            }
        }
    }
    
    resizeCanvasNodes(width, height) {
        // Validate inputs to prevent NaN
        if (!width || !height || isNaN(width) || isNaN(height)) {
            console.warn('Invalid dimensions for resizeCanvasNodes:', width, height);
            return;
        }
        
        const dpr = Math.max(2, window.devicePixelRatio || 1);
        const actualWidth = Math.round(width * dpr);
        const actualHeight = Math.round(height * dpr);
        
        // Prevent resize if dimensions haven't changed
        if (this._lastResizeWidth === actualWidth && this._lastResizeHeight === actualHeight) {
            return;
        }
        this._lastResizeWidth = actualWidth;
        this._lastResizeHeight = actualHeight;
        
        // Update nodes based on their sizeMode setting
        editorState.nodes.forEach((node, nodeId) => {
            // Default Canvas and Text nodes to responsive, Texture nodes must opt-in
            const isResponsive = node.sizeMode === 'responsive' || 
                (node.sizeMode === undefined && (node.type === 'Canvas' || node.type === 'Text'));
            
            if (isResponsive && (node.type === 'Canvas' || node.type === 'Text' || node.type === 'Texture')) {
                
                // Update node dimensions
                node.width = actualWidth;
                node.height = actualHeight;
                
                // Get the existing miniGL node
                const oldMiniglNode = editorState.miniglNodes.get(nodeId);
                if (oldMiniglNode && editorState.minigl) {
                    // If the node has a resize method, use it instead of recreating
                    if (oldMiniglNode.resize && typeof oldMiniglNode.resize === 'function') {
                        oldMiniglNode.resize(actualWidth, actualHeight);
                        oldMiniglNode.dirty = true;
                        
                        // Force process the node
                        if (oldMiniglNode.process && typeof oldMiniglNode.process === 'function') {
                            oldMiniglNode.process(performance.now());
                        }
                    } else {
                        // Need to recreate the node
                        // Preserve the drawCallback if it exists
                        if (oldMiniglNode._originalDrawCallback) {
                            node._drawFunction = oldMiniglNode._originalDrawCallback;
                        }
                        
                        // Remove old node
                        editorState.miniglNodes.delete(nodeId);
                        
                        // Create new node with updated dimensions
                        const newMiniglNode = editorState.createMiniGLNode(node);
                        
                        // If this is the output node, update the output
                        if (editorState.outputNode === nodeId && newMiniglNode) {
                            editorState.minigl.output(newMiniglNode);
                        }
                        
                        // Handle connections - reconnect all inputs to this node
                        const connections = editorState.connections.filter(c => c.to === nodeId);
                        connections.forEach(conn => {
                            const fromMiniGL = editorState.miniglNodes.get(conn.from);
                            if (fromMiniGL && newMiniglNode) {
                                try {
                                    newMiniglNode.input(fromMiniGL);
                                } catch (error) {
                                    console.error('Error reconnecting node after resize:', error);
                                }
                            }
                        });
                        
                        // Also reconnect outputs from this node
                        const outputConnections = editorState.connections.filter(c => c.from === nodeId);
                        outputConnections.forEach(conn => {
                            const toMiniGL = editorState.miniglNodes.get(conn.to);
                            if (toMiniGL && newMiniglNode) {
                                try {
                                    const toNode = editorState.getNode(conn.to);
                                    if (toNode.type === 'Blend') {
                                        const inputConnections = editorState.connections.filter(c => c.to === conn.to);
                                        if (inputConnections.indexOf(conn) === 0) {
                                            toMiniGL.connect('glBase', newMiniglNode);
                                        } else {
                                            toMiniGL.connect('glBlend', newMiniglNode);
                                        }
                                    } else if (toNode.type === 'Shader' || toNode.type === 'Feedback') {
                                        toMiniGL.connect('glTexture', newMiniglNode);
                                    }
                                } catch (error) {
                                    console.error('Error reconnecting outputs after resize:', error);
                                }
                            }
                        });
                    }
                }
            }
        });
        
        // Mark all nodes in the pipeline as dirty to force full re-render
        editorState.miniglNodes.forEach((miniglNode) => {
            if (miniglNode.dirty !== undefined) {
                miniglNode.dirty = true;
            }
        });
        
        // Force immediate render after resize
        if (this.minigl && this.minigl.renderToScreen) {
            this.minigl.renderToScreen();
        }
        
        // Also update the properties panel to reflect new sizes
        setTimeout(() => {
            const propertiesPanel = window.propertiesPanel;
            if (propertiesPanel) {
                propertiesPanel.update();
            }
        }, 100);
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