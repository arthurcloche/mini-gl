// Main application entry point
import editorState from './core/EditorState.js';
import miniGLBridge from './minigl-bridge/MiniGLBridge.js';
import { UIManager } from './components/UIManager.js';
import { NodeGraph } from './components/NodeGraph.js';
import { PropertiesPanel } from './components/PropertiesPanel.js';
import { NodePalette } from './components/NodePalette.js';
import { Console } from './components/Console.js';
import { SessionManager } from './core/SessionManager.js';
import { SessionBrowser } from './components/SessionBrowser.js';
import { AIAssistant } from './core/AIAssistant.js';
import { AIPanel } from './components/AIPanel.js';

class MiniGLEditor {
    constructor() {
        this.uiManager = new UIManager();
        this.nodeGraph = new NodeGraph();
        this.propertiesPanel = new PropertiesPanel();
        this.nodePalette = new NodePalette();
        this.console = new Console();
        
        // Initialize session management
        this.sessionManager = new SessionManager(editorState);
        this.sessionBrowser = new SessionBrowser(this.sessionManager);
        
        // Initialize AI features
        this.aiAssistant = new AIAssistant(editorState);
        this.aiPanel = new AIPanel(this.aiAssistant);
        
        // Bind update callback
        editorState.onUpdate = () => this.updateUI();
    }
    
    async initialize() {
        // Initialize session manager first
        await this.sessionManager.initialize();
        
        // Initialize AI assistant
        await this.aiAssistant.initialize();
        
        // Get preview canvas
        const previewCanvas = document.getElementById('preview');
        if (!previewCanvas) {
            console.error('Preview canvas not found');
            return false;
        }
        
        // Set up canvas with proper DPR
        const dpr = Math.max(2, window.devicePixelRatio || 1);
        const displaySize = 512;
        
        // Set canvas pixel dimensions (actual resolution)
        previewCanvas.width = displaySize * dpr;
        previewCanvas.height = displaySize * dpr;
        
        // Set canvas display dimensions (CSS size)
        previewCanvas.style.width = displaySize + 'px';
        previewCanvas.style.height = displaySize + 'px';
        
        
        // Initialize MiniGL bridge with the preview canvas
        miniGLBridge.canvas = previewCanvas;
        const initialized = await miniGLBridge.initialize();
        
        if (!initialized) {
            console.error('Failed to initialize MiniGL');
            return false;
        }
        
        // Set editorState's minigl reference
        editorState.minigl = miniGLBridge.minigl;
        
        // Initialize UI components
        this.uiManager.initialize();
        this.nodeGraph.initialize();
        this.propertiesPanel.initialize();
        this.nodePalette.initialize();
        this.console.initialize();
        
        // Set up global functions for HTML onclick handlers
        window.toggleShaderPanel = () => this.uiManager.toggleShaderPanel();
        window.toggleCanvasEditor = () => this.uiManager.toggleCanvasEditor();
        window.exportGraphAsJSON = () => this.exportGraph();
        window.matchWebGLCanvas = () => this.matchWebGLCanvas();
        window.forceRenderAll = () => this.forceRenderAll();
        window.showForceRender = () => this.showForceRender();
        
        // Make properties panel globally accessible
        window.propertiesPanel = this.propertiesPanel;
        
        // Check if we should load a session from URL
        const loadedFromURL = await this.sessionManager.loadSessionFromURL();
        
        // Initialize with some default nodes ONLY if miniGL is available and no session was loaded
        if (!loadedFromURL && miniGLBridge.minigl) {
            // Add a delay to ensure miniGL is fully ready
            setTimeout(() => {
                this.initializeDefaultNodes();
            }, 500);
        } else if (loadedFromURL) {
            this.updateSaveButton();
        }
        
        // Initial UI update
        this.updateUI();
        
        return true;
    }
    
    initializeDefaultNodes() {
        // Trigger initial resize for responsive nodes
        setTimeout(() => {
            miniGLBridge.triggerInitialResize();
        }, 100);
        
        // Create 4 shader nodes for testing
        const shaderA = editorState.addNode('Feedback', 'Red Circle', {x: 50, y: 50});
        const shaderB = editorState.addNode('Shader', 'Green Circle', {x: 50, y: 200});
        const shaderC = editorState.addNode('Shader', 'Yellow Mix', {x: 300, y: 125});
        const shaderD = editorState.addNode('Shader', 'White Final', {x: 550, y: 125});
        
        // Feedback A - Red circle with fading trails - use default template with uSpeed
        if (shaderA) {
            shaderA.shader = editorState.getDefaultShader('Feedback');
            shaderA.uniforms = editorState.getDefaultUniforms('Feedback');
            editorState.miniglNodes.delete(shaderA.id);
            editorState.createMiniGLNode(shaderA);
        }
        
        // Shader B - Green circle
        if (shaderB) {
            shaderB.shader = `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform vec3 glMouse;
in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    // Convert UV to centered coordinates with aspect correction
    vec2 uv = glUV * 2.0 - 1.0; // Convert from [0,1] to [-1,1]
    float aspect = glResolution.x / glResolution.y;
    uv.x *= aspect;
    
    // Convert mouse position from [0,1] to [-1,1]
    vec2 mousePos = glMouse.xy * 2.0 - 1.0;
    mousePos.x *= aspect;
    
    float radius = 0.4;
    float dist = length(uv - mousePos);
    
    if (dist < radius) {
        fragColor = vec4(0.0, 1.0, 0.0, 1.0); // Green
    } else {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black
    }
}`;
            editorState.miniglNodes.delete(shaderB.id);
            editorState.createMiniGLNode(shaderB);
        }
        
        // Shader C - Mix A and B (should show yellow)
        if (shaderC) {
            shaderC.shader = `#version 300 es
precision highp float;

uniform sampler2D uTextureA;
uniform sampler2D uTextureB;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec4 colorA = texture(uTextureA, glUV);
    vec4 colorB = texture(uTextureB, glUV);
    fragColor = colorA + colorB; // Additive blend
}`;
            shaderC.inputs = ['uTextureA', 'uTextureB'];
            editorState.miniglNodes.delete(shaderC.id);
            editorState.createMiniGLNode(shaderC);
        }
        
        // Shader D - Add blue to C (should show white)
        if (shaderD) {
            shaderD.shader = `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform sampler2D uTextureC;
in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec4 colorC = texture(uTextureC, glUV);
    
    // Convert UV to centered coordinates with aspect correction
    vec2 uv = glUV * 2.0 - 1.0; // Convert from [0,1] to [-1,1]
    float aspect = glResolution.x / glResolution.y;
    uv.x *= aspect;
    
    float radius = 0.4;
    float dist = length(uv);
    
    if (dist < radius) {
        fragColor = colorC + vec4(0.0, 0.0, 1.0, 0.0); // Add blue
    } else {
        fragColor = colorC;
    }
}`;
            shaderD.inputs = ['uTextureC'];
            editorState.miniglNodes.delete(shaderD.id);
            editorState.createMiniGLNode(shaderD);
        }
        
        // Connect nodes after a delay
        setTimeout(() => {
            if (shaderA && shaderB && shaderC && shaderD) {
                // Connect A and B to C
                editorState.connectNodes(shaderA.id, shaderC.id);
                editorState.connectNodes(shaderB.id, shaderC.id);
                
                // Connect C to D
                editorState.connectNodes(shaderC.id, shaderD.id);
                
                // Set D as output
                editorState.setOutputNode(shaderD.id);
                editorState.selectNode(shaderD.id);
            }
        }, 200);
    }
    
    updateUI() {
        // Update all UI components
        this.uiManager.updateSceneGraph();
        this.nodeGraph.update();
        this.propertiesPanel.update();
        this.uiManager.updateStats();
    }
    
    exportGraph() {
        const graphData = editorState.exportGraph();
        
        // Add settings
        graphData.settings = {
            resolution: document.getElementById('resolutionSelect')?.value || '512x512',
            loop: document.getElementById('loopCheckbox')?.checked || false,
            loopDuration: document.getElementById('loopDuration')?.value || '4'
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
        if (btn) {
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
    }
    
    matchWebGLCanvas() {
        const preview = document.getElementById('preview');
        const widthInput = document.querySelector('.canvas-width');
        const heightInput = document.querySelector('.canvas-height');
        
        if (preview && widthInput && heightInput) {
            widthInput.value = preview.width;
            heightInput.value = preview.height;
        }
    }
    
    togglePause() {
        const pauseBtn = document.getElementById('pauseBtn');
        if (!miniGLBridge.minigl) {
            console.error('miniGL not available for pause/resume');
            return;
        }
        
        try {
            const isRunning = miniGLBridge.minigl.isRunning();
            
            if (isRunning) {
                // Pause
                miniGLBridge.minigl.stop();
                miniGLBridge.isPaused = true;
                if (pauseBtn) pauseBtn.textContent = 'play';
                // Stop frame counter
                if (this.uiManager.frameInterval) {
                    clearInterval(this.uiManager.frameInterval);
                    this.uiManager.frameInterval = null;
                }
            } else {
                // Resume
                miniGLBridge.minigl.start();
                miniGLBridge.isPaused = false;
                if (pauseBtn) pauseBtn.textContent = 'pause';
                // Restart frame counter
                this.uiManager.startFrameCounter();
            }
        } catch (error) {
            console.error('Error in togglePause:', error);
        }
    }
    
    forceRenderAll() {
        // Force render all shader nodes by recompiling them
        const nodes = Array.from(editorState.nodes.values());
        
        nodes.forEach(node => {
            // If it's a shader-type node, update and recompile the shader
            if (node.type === 'Shader' || node.type === 'Feedback' || 
                node.type === 'Grayscale' || node.type === 'Blur' || 
                node.type === 'LensDistortion') {
                // Use the same method as the run button - update via bridge
                miniGLBridge.updateNodeProperty(node.id, 'shader', node.shader || editorState.getDefaultShader(node.type));
            }
        });
        
        // Force a render
        if (miniGLBridge.minigl) {
            // Ensure the render loop is running
            if (miniGLBridge.minigl.start) {
                miniGLBridge.minigl.start();
            }
            // Force immediate render
            if (miniGLBridge.minigl.renderToScreen) {
                miniGLBridge.minigl.renderToScreen();
            }
        }
        
        // Hide button and show prompt again after a delay
        const prompt = document.getElementById('force-render-prompt');
        const btn = document.getElementById('force-render-btn');
        if (btn && prompt) {
            // Visual feedback
            btn.style.background = '#3a5a3a';
            setTimeout(() => {
                btn.style.display = 'none';
                prompt.style.display = 'inline';
            }, 500);
        }
    }
    
    showForceRender() {
        // Show the force render button and hide the prompt
        const prompt = document.getElementById('force-render-prompt');
        const btn = document.getElementById('force-render-btn');
        if (prompt && btn) {
            prompt.style.display = 'none';
            btn.style.display = 'inline-block';
            btn.style.background = '#2a4a2a';
        }
    }
    
    resetTime() {
        if (!miniGLBridge.minigl) {
            console.error('miniGL not available for reset');
            return;
        }
        
        try {
            const wasRunning = miniGLBridge.minigl.isRunning();
            
            // Stop the render loop
            miniGLBridge.minigl.stop();
            
            // Reset the internal clock and frame counter
            miniGLBridge.minigl.clock = 0;
            miniGLBridge.minigl.frameId = 0;
            
            // Reset UI frame counter
            this.uiManager.frameCount = 0;
            const frameCountEl = document.getElementById('frameCount');
            if (frameCountEl) frameCountEl.textContent = '0';
            
            // Force a single render to show the reset state
            miniGLBridge.minigl.renderToScreen();
            
            // Restart if it was running
            if (wasRunning) {
                setTimeout(() => {
                    miniGLBridge.minigl.start();
                }, 50);
            }
        } catch (error) {
            console.error('Error in resetTime:', error);
        }
    }
    
    takeSnapshot() {
        // Try multiple ways to get the canvas
        let canvas = document.getElementById('preview');
        if (!canvas) {
            canvas = document.querySelector('#preview');
        }
        if (!canvas) {
            canvas = document.querySelector('canvas#preview');
        }
        if (!canvas && miniGLBridge.canvas) {
            canvas = miniGLBridge.canvas;
        }
        
        if (!canvas) {
            console.error('Canvas not found for snapshot');
            return;
        }
        
        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `minigl-snapshot-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Visual feedback on buttons
            const btns = [document.getElementById('snapshotBtn'), document.getElementById('snapshotBtn2')];
            btns.forEach(btn => {
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Saved!';
                    btn.style.background = '#2a4a2a';
                    btn.style.color = '#51cf66';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 1500);
                }
            });
        }, 'image/png');
    }
    
    toggleRecord() {
        // Get both record buttons
        const recordBtn1 = document.getElementById('recordBtn');
        const recordBtn2 = document.getElementById('recordBtn2');
        
        if (this.uiManager.isRecording) {
            // Stop recording
            this.stopRecording();
        } else {
            // Start recording
            this.startRecording();
        }
        
        // Sync button states
        [recordBtn1, recordBtn2].forEach(btn => {
            if (btn) {
                if (this.uiManager.isRecording) {
                    btn.classList.add('recording');
                    btn.textContent = btn.id === 'recordBtn2' ? 'Stop Recording' : 'recording';
                    btn.style.background = '#4a2a2a';
                    btn.style.color = '#ff6b6b';
                } else {
                    btn.classList.remove('recording');
                    btn.textContent = btn.id === 'recordBtn2' ? 'Start Recording' : 'record';
                    btn.style.background = '';
                    btn.style.color = '';
                }
            }
        });
    }
    
    startRecording() {
        // Try multiple ways to get the canvas
        let canvas = document.getElementById('preview');
        if (!canvas) {
            canvas = document.querySelector('#preview');
        }
        if (!canvas) {
            canvas = document.querySelector('canvas#preview');
        }
        if (!canvas && miniGLBridge.canvas) {
            canvas = miniGLBridge.canvas;
        }
        
        const format = document.getElementById('recordFormat')?.value || 'webm';
        const duration = parseInt(document.getElementById('recordDuration')?.value || '5') * 1000;
        
        if (!canvas) {
            console.error('Canvas not found for recording. Tried multiple selectors.');
            return;
        }
        
        this.uiManager.isRecording = true;
        
        // Simple recording using MediaRecorder API
        const stream = canvas.captureStream(30); // 30 fps
        const recorder = new MediaRecorder(stream, {
            mimeType: format === 'webm' ? 'video/webm' : 'video/mp4'
        });
        
        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: recorder.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `minigl-recording-${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        
        recorder.start();
        this.currentRecorder = recorder;
        
        // Auto-stop after duration
        setTimeout(() => {
            if (this.uiManager.isRecording) {
                this.stopRecording();
            }
        }, duration);
    }
    
    stopRecording() {
        if (this.currentRecorder && this.currentRecorder.state === 'recording') {
            this.currentRecorder.stop();
            this.currentRecorder = null;
        }
        this.uiManager.isRecording = false;
        
        // Update button states directly without calling toggleRecord to avoid loop
        const recordBtn1 = document.getElementById('recordBtn');
        const recordBtn2 = document.getElementById('recordBtn2');
        
        [recordBtn1, recordBtn2].forEach(btn => {
            if (btn) {
                btn.classList.remove('recording');
                btn.textContent = btn.id === 'recordBtn2' ? 'Start Recording' : 'record';
                btn.style.background = '';
                btn.style.color = '';
            }
        });
    }
    
    showHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.style.display = 'block';
            // Add escape key listener
            document.addEventListener('keydown', this.helpEscapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hideHelp();
                }
            });
        }
    }
    
    hideHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.style.display = 'none';
            // Remove escape key listener
            if (this.helpEscapeHandler) {
                document.removeEventListener('keydown', this.helpEscapeHandler);
                this.helpEscapeHandler = null;
            }
        }
    }
    
    showDocs() {
        const docsModal = document.getElementById('docsModal');
        if (docsModal) {
            docsModal.style.display = 'block';
            // Add escape key listener
            document.addEventListener('keydown', this.docsEscapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hideDocs();
                }
            });
        }
    }
    
    hideDocs() {
        const docsModal = document.getElementById('docsModal');
        if (docsModal) {
            docsModal.style.display = 'none';
            // Remove escape key listener
            if (this.docsEscapeHandler) {
                document.removeEventListener('keydown', this.docsEscapeHandler);
                this.docsEscapeHandler = null;
            }
        }
    }
    
    // Session Management Methods
    async openSessionBrowser() {
        await this.sessionBrowser.open();
    }
    
    async saveSession() {
        try {
            // Check if current session belongs to the user
            const saveBtn = document.getElementById('saveBtn');
            const isCloning = !this.sessionManager.canEditCurrentSession();
            
            if (isCloning) {
                // Cloning someone else's session
                const name = prompt('Enter a name for your cloned session:');
                if (name) {
                    await this.sessionManager.saveSession(name, false);
                    this.updateSaveButton();
                    this.showSaveConfirmation('Session cloned!');
                }
            } else {
                // Saving user's own session
                await this.sessionManager.saveSession();
                this.showSaveConfirmation('Session saved!');
            }
        } catch (error) {
            console.error('Error saving session:', error);
            alert('Failed to save session: ' + error.message);
        }
    }
    
    updateSaveButton() {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            const canEdit = this.sessionManager.canEditCurrentSession();
            saveBtn.textContent = canEdit ? 'save' : 'clone';
        }
    }
    
    showSaveConfirmation(message) {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = message;
            saveBtn.style.background = '#2a4a2a';
            saveBtn.style.color = '#51cf66';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
                saveBtn.style.color = '';
            }, 2000);
        }
    }
    
}

// Create a temporary fallback for early calls
window.miniGLEditor = {
    takeSnapshot: () => {
        console.log('Editor not yet initialized, waiting...');
        setTimeout(() => {
            if (window.miniGLEditor && window.miniGLEditor.takeSnapshot !== arguments.callee) {
                window.miniGLEditor.takeSnapshot();
            }
        }, 500);
    },
    toggleRecord: () => {
        console.log('Editor not yet initialized, waiting...');
        setTimeout(() => {
            if (window.miniGLEditor && window.miniGLEditor.toggleRecord !== arguments.callee) {
                window.miniGLEditor.toggleRecord();
            }
        }, 500);
    },
    showHelp: () => {
        console.log('Editor not yet initialized, waiting...');
        setTimeout(() => {
            if (window.miniGLEditor && window.miniGLEditor.showHelp !== arguments.callee) {
                window.miniGLEditor.showHelp();
            }
        }, 500);
    },
    hideHelp: () => {
        console.log('Editor not yet initialized, waiting...');
        setTimeout(() => {
            if (window.miniGLEditor && window.miniGLEditor.hideHelp !== arguments.callee) {
                window.miniGLEditor.hideHelp();
            }
        }, 500);
    },
    showDocs: () => {
        console.log('Editor not yet initialized, waiting...');
        setTimeout(() => {
            if (window.miniGLEditor && window.miniGLEditor.showDocs !== arguments.callee) {
                window.miniGLEditor.showDocs();
            }
        }, 500);
    },
    hideDocs: () => {
        console.log('Editor not yet initialized, waiting...');
        setTimeout(() => {
            if (window.miniGLEditor && window.miniGLEditor.hideDocs !== arguments.callee) {
                window.miniGLEditor.hideDocs();
            }
        }, 500);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const editor = new MiniGLEditor();
    window.miniGLEditor = editor; // Replace temporary with real instance
    
    const success = await editor.initialize();
    if (!success) {
        console.error('Failed to initialize editor');
    }
    
    // Make console available globally
    window.miniGLEditor.console = editor.console;
});

export default MiniGLEditor;