import editorState from '../core/EditorState.js';
import miniGLBridge from '../minigl-bridge/MiniGLBridge.js';

export class UIManager {
    constructor() {
        this.isShaderPanelOpen = false;
        this.isRecording = false;
        this.frameCount = 0;
        this.frameInterval = null;
    }
    
    initialize() {
        console.log('Initializing UI Manager...');
        
        // Initialize tabs
        this.initializeTabs();
        
        // Initialize settings
        this.initializeSettings();
        
        // Initialize frame counter
        this.startFrameCounter();
        
        // Initialize action buttons
        this.initializeSceneActions();
        
        // Initialize collapsible headers
        this.initializeCollapsibles();
    }
    
    initializeTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const settingsTab = document.getElementById('settingsTab');
        const exportTab = document.getElementById('exportTab');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                
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
    }
    
    initializeSettings() {
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
            });
        }
        
        // Record button
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => {
                if (this.isRecording) {
                    // Stop recording
                    this.isRecording = false;
                    recordBtn.classList.remove('recording');
                    recordBtn.textContent = 'record';
                } else {
                    // Start recording
                    this.isRecording = true;
                    recordBtn.classList.add('recording');
                    recordBtn.textContent = 'recording';
                    
                    // Switch to export tab
                    const exportTab = document.querySelector('[data-tab="export"]');
                    if (exportTab) exportTab.click();
                    
                    // Auto-stop after duration
                    const recordDuration = document.getElementById('recordDuration');
                    const duration = recordDuration ? parseInt(recordDuration.value) * 1000 : 5000;
                    setTimeout(() => {
                        if (this.isRecording) {
                            this.isRecording = false;
                            recordBtn.classList.remove('recording');
                            recordBtn.textContent = 'record';
                        }
                    }, duration);
                }
            });
        }
        
        // Output dropdown change
        const outputDropdown = document.querySelector('.output-dropdown');
        if (outputDropdown) {
            outputDropdown.addEventListener('change', function() {
                editorState.setOutputNode(this.value);
            });
        }
    }
    
    startFrameCounter() {
        this.frameInterval = setInterval(() => {
            this.frameCount++;
            const frameCountEl = document.getElementById('frameCount');
            const loopCheckbox = document.getElementById('loopCheckbox');
            const loopDuration = document.getElementById('loopDuration');
            
            if (frameCountEl) {
                let displayText = this.frameCount.toString();
                
                // Add loop frame info if looping is enabled
                if (loopCheckbox && loopCheckbox.checked && loopDuration) {
                    const loopFrames = parseInt(loopDuration.value) * 60; // 60fps
                    const currentLoopFrame = this.frameCount % loopFrames;
                    displayText = `${currentLoopFrame}/${loopFrames}`;
                }
                
                frameCountEl.textContent = displayText;
            }
        }, 16); // ~60fps
    }
    
    initializeSceneActions() {
        // Use event delegation for dynamic content
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-btn')) {
                e.stopPropagation();
                const action = e.target.getAttribute('title')?.toLowerCase();
                const sceneNode = e.target.closest('.scene-node');
                const nodeId = sceneNode?.getAttribute('data-node-id');
                
                if (!action || !nodeId) return;
                
                switch(action) {
                    case 'rename':
                        this.handleRename(sceneNode);
                        break;
                    case 'copy':
                        this.handleCopy(nodeId);
                        break;
                    case 'delete':
                        this.handleDelete(nodeId);
                        break;
                }
            }
        });
    }
    
    handleRename(sceneNode) {
        const nameSpan = sceneNode.querySelector('.node-name');
        if (!nameSpan) return;
        
        nameSpan.contentEditable = true;
        nameSpan.focus();
        
        const finishEdit = () => {
            nameSpan.contentEditable = false;
            const nodeId = sceneNode.getAttribute('data-node-id');
            const node = editorState.getNode(nodeId);
            if (node) {
                node.name = nameSpan.textContent;
                editorState.triggerUpdate();
            }
        };
        
        nameSpan.addEventListener('blur', finishEdit, { once: true });
        nameSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameSpan.blur();
            }
        });
    }
    
    handleCopy(nodeId) {
        const original = editorState.getNode(nodeId);
        if (!original) return;
        
        const copy = {
            type: original.type,
            name: original.name + ' Copy',
            position: { 
                x: original.position.x + 140, 
                y: original.position.y 
            }
        };
        
        editorState.addNode(copy.type, copy.name, copy.position);
    }
    
    handleDelete(nodeId) {
        if (confirm('Delete this node?')) {
            editorState.removeNode(nodeId);
        }
    }
    
    initializeCollapsibles() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('collapsible-header') || 
                e.target.parentElement?.classList.contains('collapsible-header')) {
                const header = e.target.classList.contains('collapsible-header') ? 
                    e.target : e.target.parentElement;
                const content = header.nextElementSibling;
                const toggle = header.querySelector('.toggle');
                
                if (content && toggle) {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggle.textContent = '−';
                    } else {
                        content.style.display = 'none';
                        toggle.textContent = '+';
                    }
                }
            }
        });
    }
    
    updateSceneGraph() {
        const sceneContent = document.querySelector('.scene-content');
        if (!sceneContent) return;
        
        const nodes = Array.from(editorState.nodes.values());
        const outputNodeName = editorState.outputNode ? 
            editorState.getNode(editorState.outputNode)?.name || 'None' : 'None';
        
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
        ` + nodes.map(node => `
            <div class="scene-node indent ${editorState.selectedNode === node.id ? 'selected' : ''}" 
                data-node-id="${node.id}">
                <span class="node-icon">${this.getNodeIcon(node.type)}</span>
                <span class="node-name editable" contenteditable="false">${node.name}</span>
                <div class="node-actions">
                    <button class="action-btn" title="Rename">✏️</button>
                    <button class="action-btn" title="Copy">📋</button>
                    <button class="action-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
        
        // Add click handlers for scene nodes
        document.querySelectorAll('.scene-node[data-node-id]').forEach(node => {
            node.addEventListener('click', (e) => {
                if (!e.target.classList.contains('action-btn')) {
                    const nodeId = node.getAttribute('data-node-id');
                    editorState.selectNode(nodeId);
                }
            });
        });
    }
    
    updateStats() {
        // Update FPS
        const fpsIndicator = document.querySelector('.fps-indicator');
        if (fpsIndicator) {
            // This would be updated by the actual render loop
            fpsIndicator.textContent = '60 FPS';
        }
        
        // Update performance stats
        const nodeCount = editorState.nodes.size;
        const loadLevel = nodeCount < 5 ? 'low' : nodeCount < 10 ? 'medium' : 'high';
        
        const loadIndicator = document.querySelector('.stat-value.medium');
        if (loadIndicator) {
            loadIndicator.className = `stat-value ${loadLevel}`;
            loadIndicator.textContent = loadLevel.charAt(0).toUpperCase() + loadLevel.slice(1);
        }
    }
    
    toggleShaderPanel() {
        const shaderOverlay = document.getElementById('shaderOverlay');
        if (!shaderOverlay) return;
        
        this.isShaderPanelOpen = !this.isShaderPanelOpen;
        shaderOverlay.style.display = this.isShaderPanelOpen ? 'flex' : 'none';
        
        if (this.isShaderPanelOpen && editorState.selectedNode) {
            const node = editorState.getNode(editorState.selectedNode);
            if (node && (node.type === 'Shader' || node.type === 'Feedback')) {
                const codeEditor = shaderOverlay.querySelector('.code-editor');
                const headerTitle = shaderOverlay.querySelector('.panel-header h3');
                
                if (codeEditor) codeEditor.value = node.shader || editorState.getDefaultShader(node.type);
                if (headerTitle) headerTitle.textContent = `${node.name} - Fragment Shader Editor`;
                
                // Add event listeners for run/test buttons if not already added
                this.initializeShaderEditorButtons(node.id);
            }
        }
    }
    
    initializeShaderEditorButtons(nodeId) {
        const runBtn = document.querySelector('.run-btn');
        const testBtn = document.querySelector('.test-btn');
        const codeEditor = document.querySelector('.code-editor');
        
        if (runBtn && !runBtn.hasAttribute('data-initialized')) {
            runBtn.setAttribute('data-initialized', 'true');
            runBtn.addEventListener('click', () => {
                if (codeEditor) {
                    const node = editorState.getNode(nodeId);
                    if (node) {
                        // Update shader code
                        node.shader = codeEditor.value;
                        
                        // Update miniGL node
                        miniGLBridge.updateNodeProperty(nodeId, 'shader', codeEditor.value);
                        
                        // Close panel
                        this.toggleShaderPanel();
                    }
                }
            });
        }
        
        if (testBtn && !testBtn.hasAttribute('data-initialized')) {
            testBtn.setAttribute('data-initialized', 'true');
            testBtn.addEventListener('click', () => {
                if (codeEditor) {
                    // Test shader compilation
                    try {
                        // Just validate the shader syntax for now
                        console.log('Testing shader...');
                        // TODO: Add actual shader validation
                    } catch (error) {
                        console.error('Shader error:', error);
                    }
                }
            });
        }
    }
    
    toggleCanvasEditor() {
        const shaderOverlay = document.getElementById('shaderOverlay');
        if (!shaderOverlay || !editorState.selectedNode) return;
        
        const node = editorState.getNode(editorState.selectedNode);
        if (node && node.type === 'Canvas') {
            const codeEditor = shaderOverlay.querySelector('.code-editor');
            const headerTitle = shaderOverlay.querySelector('.panel-header h3');
            
            if (codeEditor) codeEditor.value = node.canvasCode || editorState.getDefaultCanvasCode();
            if (headerTitle) headerTitle.textContent = 'Canvas Code Editor';
            
            shaderOverlay.style.display = 'flex';
            this.isShaderPanelOpen = true;
            
            // Initialize canvas editor buttons
            this.initializeCanvasEditorButtons(node.id);
        }
    }
    
    initializeCanvasEditorButtons(nodeId) {
        const runBtn = document.querySelector('.run-btn');
        const codeEditor = document.querySelector('.code-editor');
        
        // Remove old listeners and add new ones
        const newRunBtn = runBtn.cloneNode(true);
        runBtn.parentNode.replaceChild(newRunBtn, runBtn);
        
        newRunBtn.addEventListener('click', () => {
            if (codeEditor) {
                const node = editorState.getNode(nodeId);
                if (node) {
                    // Update canvas code
                    node.canvasCode = codeEditor.value;
                    
                    // Update miniGL node
                    miniGLBridge.updateNodeProperty(nodeId, 'canvasCode', codeEditor.value);
                    
                    // Close panel
                    this.toggleShaderPanel();
                }
            }
        });
    }
    
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
}