import editorState from '../core/EditorState.js';

export class NodeGraph {
    constructor() {
        this.draggingNode = null;
        this.dragOffset = { x: 0, y: 0 };
        this.dragPreview = null;
        this.isDragging = false;
        
        // Connection dragging state
        this.draggingConnection = null;
        this.tempConnection = null;
        this.connectionStart = null;
    }
    
    initialize() {
        console.log('Initializing Node Graph...');
        
        // Initialize graph controls
        this.initializeGraphControls();
        
        // Initialize node dragging
        this.initializeNodeDragging();
        
        // Click outside to deselect
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.graph-node') && 
                !e.target.closest('.right-panel') && 
                !e.target.closest('.scene-node')) {
                editorState.selectNode(null);
            }
        });
    }
    
    update() {
        const svg = document.querySelector('.graph-svg');
        if (!svg) return;
        
        const nodes = Array.from(editorState.nodes.values());
        
        // Clear and redraw - connections first (behind), then nodes
        svg.innerHTML = `
            <g class="connections-layer">
                ${this.renderConnections()}
            </g>
            <g class="nodes-layer">
                ${nodes.map((node) => `
                    <g class="graph-node draggable ${editorState.selectedNode === node.id ? 'selected' : ''}" 
                       transform="translate(${node.position.x}, ${node.position.y})" 
                       data-node-id="${node.id}"
                       data-node-type="${node.type}">
                        <rect class="node-body" width="120" height="80" rx="4" />
                        <text class="node-title" x="60" y="20">${node.name}</text>
                        <text class="node-type" x="60" y="35">${node.type}</text>
                        ${this.hasInput(node.type) ? '<circle class="node-input" cx="5" cy="40" r="4" />' : ''}
                        ${this.hasOutput(node.type) ? '<circle class="node-output" cx="115" cy="40" r="4" />' : ''}
                    </g>
                `).join('')}
            </g>
        `;
        
        // Update output dropdown
        this.updateOutputDropdown();
        
        // Re-initialize interactions
        this.initializeNodeSelection();
        this.initializeNodeDragging();
        this.initializeConnectionDragging();
    }
    
    hasInput(type) {
        return ['Shader', 'Blend', 'Feedback'].includes(type);
    }
    
    hasOutput(type) {
        return ['Texture', 'Video', 'Canvas', 'Shader', 'Blend', 'Feedback'].includes(type);
    }
    
    renderConnections() {
        return editorState.connections.map(conn => {
            const fromNode = editorState.getNode(conn.from);
            const toNode = editorState.getNode(conn.to);
            if (!fromNode || !toNode) return '';
            
            const x1 = fromNode.position.x + 115;
            const y1 = fromNode.position.y + 40;
            const x2 = toNode.position.x + 5;
            const y2 = toNode.position.y + 40;
            
            // Calculate control points for bezier curve
            const dx = x2 - x1;
            const cp1x = x1 + dx * 0.5;
            const cp1y = y1;
            const cp2x = x2 - dx * 0.5;
            const cp2y = y2;
            
            return `<path d="M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}" 
                          class="connection-line" fill="none" />`;
        }).join('');
    }
    
    initializeNodeSelection() {
        document.querySelectorAll('.graph-node').forEach(node => {
            node.addEventListener('click', (e) => {
                if (!this.isDragging) {
                    const nodeId = node.getAttribute('data-node-id');
                    editorState.selectNode(nodeId);
                }
            });
            
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const nodeId = node.getAttribute('data-node-id');
                const nodeData = editorState.getNode(nodeId);
                
                if (nodeData) {
                    editorState.selectNode(nodeId);
                    
                    if (nodeData.type === 'Shader' || nodeData.type === 'Feedback') {
                        window.toggleShaderPanel?.();
                    } else if (nodeData.type === 'Canvas') {
                        window.toggleCanvasEditor?.();
                    }
                }
            });
        });
    }
    
    initializeNodeDragging() {
        const graphCanvas = document.querySelector('.graph-canvas');
        if (!graphCanvas) return;
        
        document.querySelectorAll('.graph-node.draggable').forEach(node => {
            node.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                
                this.draggingNode = node;
                this.isDragging = false;
                
                const nodeId = node.getAttribute('data-node-id');
                const nodeData = editorState.getNode(nodeId);
                if (!nodeData) return;
                
                const rect = graphCanvas.getBoundingClientRect();
                this.dragOffset.x = e.clientX - rect.left - nodeData.position.x;
                this.dragOffset.y = e.clientY - rect.top - nodeData.position.y;
                
                // Create drag preview
                const svg = document.querySelector('.graph-svg');
                this.dragPreview = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                this.dragPreview.setAttribute('class', 'node-drag-preview');
                this.dragPreview.setAttribute('width', '120');
                this.dragPreview.setAttribute('height', '80');
                this.dragPreview.setAttribute('rx', '4');
                this.dragPreview.setAttribute('x', nodeData.position.x);
                this.dragPreview.setAttribute('y', nodeData.position.y);
                svg.appendChild(this.dragPreview);
                
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Global mouse move handler
        document.addEventListener('mousemove', (e) => {
            if (!this.draggingNode || !this.dragPreview) return;
            
            this.isDragging = true;
            
            const nodeId = this.draggingNode.getAttribute('data-node-id');
            const nodeData = editorState.getNode(nodeId);
            if (!nodeData) return;
            
            const rect = graphCanvas.getBoundingClientRect();
            let newX = e.clientX - rect.left - this.dragOffset.x;
            let newY = e.clientY - rect.top - this.dragOffset.y;
            
            // Keep within bounds
            newX = Math.max(0, Math.min(newX, rect.width - 120));
            newY = Math.max(0, Math.min(newY, rect.height - 80));
            
            // Update preview position
            this.dragPreview.setAttribute('x', newX);
            this.dragPreview.setAttribute('y', newY);
        });
        
        // Global mouse up handler
        document.addEventListener('mouseup', (e) => {
            if (this.draggingNode && this.isDragging) {
                const nodeId = this.draggingNode.getAttribute('data-node-id');
                const nodeData = editorState.getNode(nodeId);
                
                if (nodeData) {
                    const rect = graphCanvas.getBoundingClientRect();
                    let finalX = e.clientX - rect.left - this.dragOffset.x;
                    let finalY = e.clientY - rect.top - this.dragOffset.y;
                    
                    // Keep within bounds
                    finalX = Math.max(0, Math.min(finalX, rect.width - 120));
                    finalY = Math.max(0, Math.min(finalY, rect.height - 80));
                    
                    // Update node position
                    nodeData.position.x = finalX;
                    nodeData.position.y = finalY;
                    
                    // Trigger update
                    editorState.triggerUpdate();
                }
            }
            
            // Clean up
            if (this.dragPreview) {
                this.dragPreview.remove();
                this.dragPreview = null;
            }
            
            this.draggingNode = null;
            this.isDragging = false;
        });
    }
    
    initializeGraphControls() {
        document.querySelectorAll('.graph-controls .control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.textContent;
                
                if (action === 'center' && editorState.selectedNode) {
                    this.centerSelectedNode();
                } else if (action === 'grid') {
                    this.toggleGrid();
                } else if (action === 'zoom') {
                    this.resetZoom();
                }
                
                // Visual feedback
                btn.style.background = '#4a90e2';
                setTimeout(() => btn.style.background = '', 200);
            });
        });
    }
    
    centerSelectedNode() {
        const nodeData = editorState.getNode(editorState.selectedNode);
        if (!nodeData) return;
        
        const canvas = document.querySelector('.graph-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const centerX = canvasRect.width / 2 - 60; // Half node width
        const centerY = canvasRect.height / 2 - 40; // Half node height
        
        // Calculate offset to center the node
        const offsetX = centerX - nodeData.position.x;
        const offsetY = centerY - nodeData.position.y;
        
        // Move all nodes by the offset
        editorState.nodes.forEach(node => {
            node.position.x += offsetX;
            node.position.y += offsetY;
            
            // Keep nodes within bounds
            node.position.x = Math.max(0, Math.min(node.position.x, canvasRect.width - 120));
            node.position.y = Math.max(0, Math.min(node.position.y, canvasRect.height - 80));
        });
        
        editorState.triggerUpdate();
    }
    
    toggleGrid() {
        const canvas = document.querySelector('.graph-canvas');
        if (canvas.style.backgroundImage) {
            canvas.style.backgroundImage = '';
        } else {
            canvas.style.backgroundImage = 'radial-gradient(circle, #333 1px, transparent 1px)';
        }
    }
    
    resetZoom() {
        // Placeholder for zoom functionality
        console.log('Reset zoom');
    }
    
    updateOutputDropdown() {
        const dropdown = document.querySelector('.output-dropdown');
        if (!dropdown) return;
        
        // Add "None" option first, then all nodes that can have output
        const outputNodes = Array.from(editorState.nodes.values()).filter(node => 
            editorState.hasOutput(node.type)
        );
        
        dropdown.innerHTML = `
            <option value="" ${!editorState.outputNode ? 'selected' : ''}>None</option>
            ${outputNodes.map(node => 
                `<option value="${node.id}" ${editorState.outputNode === node.id ? 'selected' : ''}>${node.name}</option>`
            ).join('')}
        `;
    }
    
    initializeConnectionDragging() {
        const svg = document.querySelector('.graph-svg');
        if (!svg) return;
        
        // Handle output port clicks
        document.querySelectorAll('.node-output').forEach(outputPort => {
            outputPort.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const nodeElement = outputPort.closest('.graph-node');
                const nodeId = nodeElement.getAttribute('data-node-id');
                const transform = nodeElement.getAttribute('transform');
                const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
                
                if (!match) return;
                
                const nodeX = parseFloat(match[1]);
                const nodeY = parseFloat(match[2]);
                
                // Start connection dragging
                this.draggingConnection = true;
                this.connectionStart = {
                    nodeId: nodeId,
                    x: nodeX + 115,
                    y: nodeY + 40
                };
                
                // Create temporary connection line
                this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                this.tempConnection.setAttribute('class', 'connection-line temp-connection');
                this.tempConnection.setAttribute('fill', 'none');
                this.tempConnection.setAttribute('stroke-dasharray', '5,5');
                
                const connectionsLayer = svg.querySelector('.connections-layer');
                if (connectionsLayer) {
                    connectionsLayer.appendChild(this.tempConnection);
                }
                
                this.updateTempConnection(e);
            });
        });
        
        // Handle input port hover
        document.querySelectorAll('.node-input').forEach(inputPort => {
            inputPort.addEventListener('mouseenter', (e) => {
                if (this.draggingConnection) {
                    inputPort.setAttribute('r', '6');
                    inputPort.style.fill = '#4a90e2';
                }
            });
            
            inputPort.addEventListener('mouseleave', (e) => {
                if (this.draggingConnection) {
                    inputPort.setAttribute('r', '4');
                    inputPort.style.fill = '';
                }
            });
            
            inputPort.addEventListener('mouseup', (e) => {
                if (!this.draggingConnection || !this.connectionStart) return;
                
                e.stopPropagation();
                
                const nodeElement = inputPort.closest('.graph-node');
                const toNodeId = nodeElement.getAttribute('data-node-id');
                
                // Create the connection
                if (editorState.connectNodes(this.connectionStart.nodeId, toNodeId)) {
                    console.log('Connection created successfully');
                } else {
                    console.log('Failed to create connection');
                }
                
                this.endConnectionDragging();
            });
        });
        
        // Global mouse move for connection dragging
        document.addEventListener('mousemove', (e) => {
            if (this.draggingConnection && this.tempConnection) {
                this.updateTempConnection(e);
            }
        });
        
        // Global mouse up to cancel connection
        document.addEventListener('mouseup', (e) => {
            if (this.draggingConnection) {
                // Check if we're not over an input port
                if (!e.target.classList.contains('node-input')) {
                    this.endConnectionDragging();
                }
            }
        });
    }
    
    updateTempConnection(e) {
        if (!this.tempConnection || !this.connectionStart) return;
        
        const svg = document.querySelector('.graph-svg');
        const rect = svg.getBoundingClientRect();
        
        const x1 = this.connectionStart.x;
        const y1 = this.connectionStart.y;
        const x2 = e.clientX - rect.left;
        const y2 = e.clientY - rect.top;
        
        // Calculate control points for bezier curve
        const dx = x2 - x1;
        const cp1x = x1 + dx * 0.5;
        const cp1y = y1;
        const cp2x = x2 - dx * 0.5;
        const cp2y = y2;
        
        const path = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
        this.tempConnection.setAttribute('d', path);
    }
    
    endConnectionDragging() {
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
        
        this.draggingConnection = false;
        this.connectionStart = null;
        
        // Reset any highlighted input ports
        document.querySelectorAll('.node-input').forEach(inputPort => {
            inputPort.setAttribute('r', '4');
            inputPort.style.fill = '';
        });
    }
}