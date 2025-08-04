// Main application entry point
import editorState from './core/EditorState.js';
import miniGLBridge from './minigl-bridge/MiniGLBridge.js';
import { UIManager } from './components/UIManager.js';
import { NodeGraph } from './components/NodeGraph.js';
import { PropertiesPanel } from './components/PropertiesPanel.js';
import { NodePalette } from './components/NodePalette.js';
import { Console } from './components/Console.js';

class MiniGLEditor {
    constructor() {
        this.uiManager = new UIManager();
        this.nodeGraph = new NodeGraph();
        this.propertiesPanel = new PropertiesPanel();
        this.nodePalette = new NodePalette();
        this.console = new Console();
        
        // Bind update callback
        editorState.onUpdate = () => this.updateUI();
    }
    
    async initialize() {
        console.log('Initializing MiniGL Editor...');
        
        // Get preview canvas
        const previewCanvas = document.getElementById('preview');
        if (!previewCanvas) {
            console.error('Preview canvas not found');
            return false;
        }
        
        console.log('Preview canvas found:', previewCanvas);
        console.log('Canvas dimensions:', previewCanvas.width, 'x', previewCanvas.height);
        console.log('Canvas display style:', window.getComputedStyle(previewCanvas).display);
        
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
        window.miniGLEditor.togglePause = () => this.togglePause();
        window.miniGLEditor.resetTime = () => this.resetTime();
        
        // Initialize with some default nodes ONLY if miniGL is available
        if (miniGLBridge.minigl) {
            console.log('miniGL is available, initializing default nodes');
            // Add a delay to ensure miniGL is fully ready
            setTimeout(() => {
                this.initializeDefaultNodes();
            }, 500);
        } else {
            console.log('miniGL not available yet, skipping default nodes');
        }
        
        // Initial UI update
        this.updateUI();
        
        console.log('MiniGL Editor initialized successfully');
        return true;
    }
    
    initializeDefaultNodes() {
        // Start with a simple shader node
        const shaderNode = editorState.addNode('Shader', null, {x: 100, y: 100});
        
        // Set a simple gradient shader
        if (shaderNode) {
            shaderNode.shader = `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;

in vec2 glCoord;
in vec2 glUV;
out vec4 fragColor;

void main() {
    // Simple animated gradient using UV coordinates
    vec2 uv = glUV;
    vec3 col = 0.5 + 0.5 * cos(glTime * 0.001 + uv.xyx + vec3(0, 2, 4));
    fragColor = vec4(col, 1.0);
}`;
            
            // Recreate the miniGL node with the shader
            const miniglNode = editorState.miniglNodes.get(shaderNode.id);
            if (miniglNode) {
                editorState.miniglNodes.delete(shaderNode.id);
                editorState.createMiniGLNode(shaderNode);
            }
        }
        
        // Wait a bit then set as output
        setTimeout(() => {
            if (shaderNode) {
                // Set shader as selected node
                editorState.selectNode(shaderNode.id);
                
                // Set shader as output node
                editorState.setOutputNode(shaderNode.id);
            }
        }, 100);
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
        if (miniGLBridge.minigl) {
            const isRunning = miniGLBridge.minigl.isRunning();
            console.log('Toggle pause, isRunning:', isRunning, '_animationId:', miniGLBridge.minigl._animationId);
            
            if (isRunning) {
                // Pause
                miniGLBridge.minigl.stop();
                miniGLBridge.isPaused = true;
                if (pauseBtn) pauseBtn.textContent = 'play';
                console.log('Paused render');
            } else {
                // Resume
                miniGLBridge.minigl.start();
                miniGLBridge.isPaused = false;
                if (pauseBtn) pauseBtn.textContent = 'pause';
                console.log('Resumed render');
            }
        } else {
            console.error('miniGL not available for pause/resume');
        }
    }
    
    resetTime() {
        if (miniGLBridge.minigl) {
            console.log('Resetting time...');
            const wasRunning = miniGLBridge.minigl.isRunning();
            
            // Stop the render loop
            miniGLBridge.minigl.stop();
            
            // Reset the internal clock
            miniGLBridge.minigl.clock = 0;
            miniGLBridge.minigl.frameId = 0;
            console.log('Clock reset to 0');
            
            // Reset UI frame counter
            this.uiManager.frameCount = 0;
            const frameCountEl = document.getElementById('frameCount');
            if (frameCountEl) frameCountEl.textContent = '0';
            
            // Force a single render to show the reset state
            if (miniGLBridge.minigl.renderToScreen) {
                miniGLBridge.minigl.renderToScreen();
            }
            
            // Restart if it was running and not paused
            if (wasRunning && !miniGLBridge.isPaused) {
                setTimeout(() => {
                    miniGLBridge.minigl.start();
                    console.log('Restarted render after reset');
                }, 50);
            }
        } else {
            console.error('miniGL not available for reset');
        }
    }
    
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const editor = new MiniGLEditor();
    window.miniGLEditor = editor; // Make available globally for debugging
    
    const success = await editor.initialize();
    if (!success) {
        console.error('Failed to initialize editor');
    }
    
    // Make console available globally
    window.miniGLEditor.console = editor.console;
});

export default MiniGLEditor;