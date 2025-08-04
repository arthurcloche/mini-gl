// Main application entry point
import editorState from './core/EditorState.js';
import miniGLBridge from './minigl-bridge/MiniGLBridge.js';
import { UIManager } from './components/UIManager.js';
import { NodeGraph } from './components/NodeGraph.js';
import { PropertiesPanel } from './components/PropertiesPanel.js';
import { NodePalette } from './components/NodePalette.js';

class MiniGLEditor {
    constructor() {
        this.uiManager = new UIManager();
        this.nodeGraph = new NodeGraph();
        this.propertiesPanel = new PropertiesPanel();
        this.nodePalette = new NodePalette();
        
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
        
        // Set up global functions for HTML onclick handlers
        window.toggleShaderPanel = () => this.uiManager.toggleShaderPanel();
        window.toggleCanvasEditor = () => this.uiManager.toggleCanvasEditor();
        window.exportGraphAsJSON = () => this.exportGraph();
        window.matchWebGLCanvas = () => this.matchWebGLCanvas();
        
        // Initialize with some default nodes ONLY if miniGL is available
        if (miniGLBridge.minigl) {
            this.initializeDefaultNodes();
        }
        
        // Initial UI update
        this.updateUI();
        
        console.log('MiniGL Editor initialized successfully');
        return true;
    }
    
    initializeDefaultNodes() {
        // Start with a simple shader node
        const shaderNode = editorState.addNode('Shader', 'Gradient Shader', {x: 100, y: 100});
        
        // Set a simple gradient shader
        if (shaderNode) {
            shaderNode.shader = `#version 300 es
precision highp float;

uniform vec2 glResolution;
uniform float glTime;

in vec2 glUV;
out vec4 fragColor;

void main() {
    // Simple animated gradient
    vec3 col = 0.5 + 0.5 * cos(glTime * 0.001 + glUV.xyx + vec3(0, 2, 4));
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
    
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const editor = new MiniGLEditor();
    window.miniGLEditor = editor; // Make available globally for debugging
    
    const success = await editor.initialize();
    if (!success) {
        console.error('Failed to initialize editor');
    }
});

export default MiniGLEditor;