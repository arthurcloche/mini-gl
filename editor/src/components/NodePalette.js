import editorState from '../core/EditorState.js';

export class NodePalette {
    constructor() {
        this.maxNodes = 16; // Prototype limit
    }
    
    initialize() {
        console.log('Initializing Node Palette...');
        
        // Initialize add node buttons
        this.initializeAddButtons();
        
        // Initialize drag and drop
        this.initializeDragAndDrop();
    }
    
    initializeAddButtons() {
        // Use event delegation for add buttons
        document.querySelector('.node-palette')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-node-btn')) {
                e.stopPropagation();
                
                const nodeItem = e.target.closest('.node-item');
                const nodeType = nodeItem?.getAttribute('data-node-type');
                
                if (!nodeType) return;
                
                // Check node limit
                if (editorState.nodes.size >= this.maxNodes) {
                    alert(`Maximum of ${this.maxNodes} nodes allowed in prototype`);
                    return;
                }
                
                console.log('Adding node of type:', nodeType);
                
                // Add node at a random position to avoid overlap
                const x = 50 + Math.random() * 400;
                const y = 50 + Math.random() * 200;
                
                editorState.addNode(nodeType, null, { x, y });
                
                // Visual feedback
                e.target.style.background = '#4a90e2';
                setTimeout(() => {
                    e.target.style.background = '';
                }, 200);
            }
        });
    }
    
    initializeDragAndDrop() {
        const nodeItems = document.querySelectorAll('.node-item[draggable="true"]');
        const graphCanvas = document.querySelector('.graph-canvas');
        
        if (!graphCanvas) return;
        
        nodeItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const nodeType = item.getAttribute('data-node-type');
                e.dataTransfer.setData('text/plain', nodeType);
                item.style.opacity = '0.5';
            });
            
            item.addEventListener('dragend', () => {
                item.style.opacity = '';
            });
        });
        
        // Graph canvas drop zone
        graphCanvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            graphCanvas.style.background = 'rgba(74, 144, 226, 0.1)';
        });
        
        graphCanvas.addEventListener('dragleave', () => {
            graphCanvas.style.background = '';
        });
        
        graphCanvas.addEventListener('drop', (e) => {
            e.preventDefault();
            graphCanvas.style.background = '';
            
            const nodeType = e.dataTransfer.getData('text/plain');
            if (!nodeType) return;
            
            // Check node limit
            if (editorState.nodes.size >= this.maxNodes) {
                alert(`Maximum of ${this.maxNodes} nodes allowed in prototype`);
                return;
            }
            
            const rect = graphCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left - 60; // Center node at cursor
            const y = e.clientY - rect.top - 40;
            
            // Add the node
            editorState.addNode(nodeType, nodeType, { x, y });
            
            // Visual feedback
            this.showDropFeedback(e.clientX - rect.left, e.clientY - rect.top, nodeType);
        });
    }
    
    showDropFeedback(x, y, nodeType) {
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
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.textContent = `${nodeType} node created`;
        
        document.querySelector('.graph-canvas')?.appendChild(feedback);
        
        // Animate and remove
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translate(-50%, -70%)';
            feedback.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                feedback.remove();
            }, 300);
        }, 1000);
    }
}