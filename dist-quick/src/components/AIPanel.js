export class AIPanel {
  constructor(aiAssistant) {
    this.aiAssistant = aiAssistant;
    this.isOpen = false;
    this.element = null;
    this.createUI();
  }

  createUI() {
    // Create panel container
    this.element = document.createElement('div');
    this.element.className = 'ai-panel';
    this.element.innerHTML = `
      <div class="ai-panel-header">
        <h3>AI Assistant</h3>
        <button class="ai-panel-toggle" title="Toggle AI Panel">🤖</button>
      </div>
      
      <div class="ai-panel-content" style="display: none;">
        <div class="ai-tabs">
          <button class="ai-tab active" data-tab="create">Create</button>
          <button class="ai-tab" data-tab="debug">Debug</button>
          <button class="ai-tab" data-tab="learn">Learn</button>
        </div>
        
        <div class="ai-tab-content">
          <!-- Create Tab -->
          <div class="ai-tab-panel active" data-panel="create">
            <div class="ai-input-group">
              <label>Create from description:</label>
              <textarea class="ai-prompt-input" placeholder="Describe what you want to create...
Examples:
- 'A colorful plasma effect'
- 'Rippling water surface'
- 'Retro CRT TV effect'"></textarea>
              <div class="ai-action-buttons">
                <button class="ai-btn ai-create-node">Create Node</button>
                <button class="ai-btn ai-create-graph">Create Graph</button>
              </div>
            </div>
          </div>
          
          <!-- Debug Tab -->
          <div class="ai-tab-panel" data-panel="debug">
            <div class="ai-input-group">
              <label>Paste shader code to debug:</label>
              <textarea class="ai-debug-input" placeholder="Paste your GLSL shader code here..."></textarea>
              <div class="ai-action-buttons">
                <button class="ai-btn ai-debug-code">Debug</button>
                <button class="ai-btn ai-optimize-code">Optimize</button>
                <button class="ai-btn ai-variation-code">Generate Variation</button>
              </div>
            </div>
          </div>
          
          <!-- Learn Tab -->
          <div class="ai-tab-panel" data-panel="learn">
            <div class="ai-input-group">
              <label>Ask about shader concepts:</label>
              <input type="text" class="ai-concept-input" placeholder="e.g., 'noise functions', 'ray marching', 'color mixing'">
              <button class="ai-btn ai-explain">Explain</button>
            </div>
            
            <div class="ai-quick-tips">
              <h4>Quick Tips:</h4>
              <button class="ai-tip" data-concept="noise">Noise Functions</button>
              <button class="ai-tip" data-concept="sdf">Distance Fields</button>
              <button class="ai-tip" data-concept="fractals">Fractals</button>
              <button class="ai-tip" data-concept="color">Color Theory</button>
              <button class="ai-tip" data-concept="blending">Blending Modes</button>
              <button class="ai-tip" data-concept="post-processing">Post Processing</button>
            </div>
          </div>
        </div>
        
        <div class="ai-response" style="display: none;">
          <div class="ai-response-header">
            <span>AI Response</span>
            <button class="ai-response-close">×</button>
          </div>
          <div class="ai-response-content"></div>
          <div class="ai-response-actions" style="display: none;">
            <button class="ai-apply-response">Apply to Selected Node</button>
            <button class="ai-copy-response">Copy</button>
          </div>
        </div>
      </div>
    `;

    // Add to right panel
    const rightPanel = document.querySelector('.right-panel');
    if (rightPanel) {
      rightPanel.insertBefore(this.element, rightPanel.firstChild);
    } else {
      document.body.appendChild(this.element);
    }

    this.attachEventListeners();
    this.addStyles();
  }

  attachEventListeners() {
    // Toggle panel
    this.element.querySelector('.ai-panel-toggle').addEventListener('click', () => {
      this.togglePanel();
    });

    // Tab switching
    this.element.querySelectorAll('.ai-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Create actions
    this.element.querySelector('.ai-create-node').addEventListener('click', () => {
      this.handleCreateNode();
    });

    this.element.querySelector('.ai-create-graph').addEventListener('click', () => {
      this.handleCreateGraph();
    });

    // Debug actions
    this.element.querySelector('.ai-debug-code').addEventListener('click', () => {
      this.handleDebugCode();
    });

    this.element.querySelector('.ai-optimize-code').addEventListener('click', () => {
      this.handleOptimizeCode();
    });

    this.element.querySelector('.ai-variation-code').addEventListener('click', () => {
      this.handleVariationCode();
    });

    // Learn actions
    this.element.querySelector('.ai-explain').addEventListener('click', () => {
      this.handleExplainConcept();
    });

    // Quick tips
    this.element.querySelectorAll('.ai-tip').forEach(tip => {
      tip.addEventListener('click', (e) => {
        this.handleQuickTip(e.target.dataset.concept);
      });
    });

    // Response actions
    this.element.querySelector('.ai-response-close').addEventListener('click', () => {
      this.hideResponse();
    });

    this.element.querySelector('.ai-apply-response').addEventListener('click', () => {
      this.applyResponseToNode();
    });

    this.element.querySelector('.ai-copy-response').addEventListener('click', () => {
      this.copyResponse();
    });
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    const content = this.element.querySelector('.ai-panel-content');
    content.style.display = this.isOpen ? 'block' : 'none';
    
    const toggle = this.element.querySelector('.ai-panel-toggle');
    toggle.classList.toggle('active', this.isOpen);
  }

  switchTab(tab) {
    // Update tab buttons
    this.element.querySelectorAll('.ai-tab').forEach(tabBtn => {
      tabBtn.classList.toggle('active', tabBtn.dataset.tab === tab);
    });

    // Update tab panels
    this.element.querySelectorAll('.ai-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === tab);
    });
  }

  async handleCreateNode() {
    const input = this.element.querySelector('.ai-prompt-input');
    const description = input.value.trim();
    
    if (!description) {
      alert('Please enter a description');
      return;
    }

    this.showLoading('Creating node...');
    
    try {
      const node = await this.aiAssistant.createNodeFromPrompt(description);
      this.showResponse(`Created node: ${node.name}`, 'success');
      input.value = '';
    } catch (error) {
      this.showResponse(`Error: ${error.message}`, 'error');
    }
  }

  async handleCreateGraph() {
    const input = this.element.querySelector('.ai-prompt-input');
    const description = input.value.trim();
    
    if (!description) {
      alert('Please enter a description');
      return;
    }

    this.showLoading('Creating graph...');
    
    try {
      const graph = await this.aiAssistant.createGraphFromPrompt(description);
      this.showResponse(`Created graph with ${graph.nodes.length} nodes`, 'success');
      input.value = '';
    } catch (error) {
      this.showResponse(`Error: ${error.message}`, 'error');
    }
  }

  async handleDebugCode() {
    const input = this.element.querySelector('.ai-debug-input');
    const code = input.value.trim();
    
    if (!code) {
      alert('Please paste shader code to debug');
      return;
    }

    this.showLoading('Debugging shader...');
    
    try {
      const response = await this.aiAssistant.debugShader(code);
      this.showResponse(response, 'code');
    } catch (error) {
      this.showResponse(`Error: ${error.message}`, 'error');
    }
  }

  async handleOptimizeCode() {
    const input = this.element.querySelector('.ai-debug-input');
    const code = input.value.trim();
    
    if (!code) {
      alert('Please paste shader code to optimize');
      return;
    }

    this.showLoading('Optimizing shader...');
    
    try {
      const response = await this.aiAssistant.optimizeShader(code);
      this.showResponse(response, 'code');
    } catch (error) {
      this.showResponse(`Error: ${error.message}`, 'error');
    }
  }

  async handleVariationCode() {
    const input = this.element.querySelector('.ai-debug-input');
    const code = input.value.trim();
    
    if (!code) {
      // Try to get code from selected node
      const selectedNode = this.aiAssistant.editorState.selectedNode;
      if (selectedNode) {
        const node = this.aiAssistant.editorState.getNode(selectedNode);
        if (node && node.shader) {
          input.value = node.shader;
        }
      }
    }
    
    const finalCode = input.value.trim();
    if (!finalCode) {
      alert('Please paste shader code or select a shader node');
      return;
    }

    this.showLoading('Generating variation...');
    
    try {
      const response = await this.aiAssistant.generateVariation(finalCode);
      this.showResponse(response, 'code');
      this.lastGeneratedCode = response;
    } catch (error) {
      this.showResponse(`Error: ${error.message}`, 'error');
    }
  }

  async handleExplainConcept() {
    const input = this.element.querySelector('.ai-concept-input');
    const concept = input.value.trim();
    
    if (!concept) {
      alert('Please enter a concept to explain');
      return;
    }

    this.showLoading('Explaining concept...');
    
    try {
      const response = await this.aiAssistant.explainConcept(concept);
      this.showResponse(response, 'text');
    } catch (error) {
      this.showResponse(`Error: ${error.message}`, 'error');
    }
  }

  async handleQuickTip(concept) {
    const conceptMap = {
      'noise': 'Perlin and Simplex noise functions in GLSL',
      'sdf': 'Signed Distance Fields for 2D shapes',
      'fractals': 'Creating fractals with GLSL',
      'color': 'Color spaces and color manipulation',
      'blending': 'Blend modes and compositing',
      'post-processing': 'Post-processing effects in shaders'
    };

    this.showLoading('Loading tip...');
    
    try {
      const response = await this.aiAssistant.explainConcept(conceptMap[concept] || concept);
      this.showResponse(response, 'text');
    } catch (error) {
      this.showResponse(`Error: ${error.message}`, 'error');
    }
  }

  showLoading(message) {
    const responseDiv = this.element.querySelector('.ai-response');
    const contentDiv = this.element.querySelector('.ai-response-content');
    const actionsDiv = this.element.querySelector('.ai-response-actions');
    
    responseDiv.style.display = 'block';
    contentDiv.innerHTML = `<div class="ai-loading">${message}</div>`;
    actionsDiv.style.display = 'none';
  }

  showResponse(response, type = 'text') {
    const responseDiv = this.element.querySelector('.ai-response');
    const contentDiv = this.element.querySelector('.ai-response-content');
    const actionsDiv = this.element.querySelector('.ai-response-actions');
    
    responseDiv.style.display = 'block';
    
    if (type === 'code') {
      // Check if response contains code blocks
      const codeMatch = response.match(/```(?:glsl)?\n([\s\S]*?)```/);
      if (codeMatch) {
        contentDiv.innerHTML = `<pre class="ai-code">${this.escapeHtml(codeMatch[1])}</pre>`;
        actionsDiv.style.display = 'block';
        this.lastGeneratedCode = codeMatch[1];
      } else {
        contentDiv.innerHTML = `<pre class="ai-code">${this.escapeHtml(response)}</pre>`;
        actionsDiv.style.display = 'block';
        this.lastGeneratedCode = response;
      }
    } else if (type === 'success') {
      contentDiv.innerHTML = `<div class="ai-success">${response}</div>`;
      actionsDiv.style.display = 'none';
    } else if (type === 'error') {
      contentDiv.innerHTML = `<div class="ai-error">${response}</div>`;
      actionsDiv.style.display = 'none';
    } else {
      // Format text response with markdown-like styling
      const formatted = response
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      contentDiv.innerHTML = `<div class="ai-text">${formatted}</div>`;
      actionsDiv.style.display = 'none';
    }
  }

  hideResponse() {
    const responseDiv = this.element.querySelector('.ai-response');
    responseDiv.style.display = 'none';
  }

  applyResponseToNode() {
    if (!this.lastGeneratedCode) return;
    
    const selectedNode = this.aiAssistant.editorState.selectedNode;
    if (!selectedNode) {
      alert('Please select a shader node first');
      return;
    }
    
    const node = this.aiAssistant.editorState.getNode(selectedNode);
    if (!node || node.type !== 'Shader') {
      alert('Please select a shader node');
      return;
    }
    
    // Apply the generated code to the node
    node.shader = this.lastGeneratedCode;
    
    // Recreate miniGL node
    const miniglNode = this.aiAssistant.editorState.miniglNodes.get(node.id);
    if (miniglNode && miniglNode.dispose) {
      miniglNode.dispose();
    }
    this.aiAssistant.editorState.miniglNodes.delete(node.id);
    this.aiAssistant.editorState.createMiniGLNode(node);
    
    this.aiAssistant.editorState.updateUI();
    
    alert('Code applied to selected node');
  }

  copyResponse() {
    if (!this.lastGeneratedCode) return;
    
    navigator.clipboard.writeText(this.lastGeneratedCode).then(() => {
      const btn = this.element.querySelector('.ai-copy-response');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ai-panel {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 4px;
        margin-bottom: 16px;
      }
      
      .ai-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid #333;
      }
      
      .ai-panel-header h3 {
        margin: 0;
        font-size: 14px;
        color: #fff;
      }
      
      .ai-panel-toggle {
        background: #2a2a2a;
        border: 1px solid #444;
        color: #999;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      }
      
      .ai-panel-toggle:hover, .ai-panel-toggle.active {
        background: #3a3a3a;
        color: #4a90e2;
      }
      
      .ai-panel-content {
        padding: 12px;
      }
      
      .ai-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .ai-tab {
        background: #2a2a2a;
        border: 1px solid #444;
        color: #999;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .ai-tab:hover {
        background: #3a3a3a;
      }
      
      .ai-tab.active {
        background: #4a90e2;
        color: white;
        border-color: #4a90e2;
      }
      
      .ai-tab-panel {
        display: none;
      }
      
      .ai-tab-panel.active {
        display: block;
      }
      
      .ai-input-group {
        margin-bottom: 12px;
      }
      
      .ai-input-group label {
        display: block;
        color: #999;
        font-size: 11px;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      
      .ai-prompt-input, .ai-debug-input {
        width: 100%;
        background: #2a2a2a;
        border: 1px solid #444;
        color: #fff;
        padding: 8px;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 12px;
        min-height: 80px;
        resize: vertical;
      }
      
      .ai-concept-input {
        width: 100%;
        background: #2a2a2a;
        border: 1px solid #444;
        color: #fff;
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        margin-bottom: 8px;
      }
      
      .ai-action-buttons {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      
      .ai-btn {
        background: #4a90e2;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        flex: 1;
      }
      
      .ai-btn:hover {
        background: #357abd;
      }
      
      .ai-quick-tips {
        margin-top: 16px;
      }
      
      .ai-quick-tips h4 {
        color: #999;
        font-size: 11px;
        margin: 0 0 8px 0;
        text-transform: uppercase;
      }
      
      .ai-tip {
        background: #2a2a2a;
        border: 1px solid #444;
        color: #999;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        margin: 0 4px 4px 0;
      }
      
      .ai-tip:hover {
        background: #3a3a3a;
        color: #fff;
      }
      
      .ai-response {
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        margin-top: 16px;
      }
      
      .ai-response-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid #444;
      }
      
      .ai-response-header span {
        color: #999;
        font-size: 11px;
        text-transform: uppercase;
      }
      
      .ai-response-close {
        background: none;
        border: none;
        color: #999;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
      }
      
      .ai-response-close:hover {
        color: #fff;
      }
      
      .ai-response-content {
        padding: 12px;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .ai-loading {
        color: #4a90e2;
        text-align: center;
        padding: 20px;
      }
      
      .ai-success {
        color: #51cf66;
      }
      
      .ai-error {
        color: #ff6b6b;
      }
      
      .ai-text {
        color: #ccc;
        line-height: 1.6;
      }
      
      .ai-text strong {
        color: #fff;
      }
      
      .ai-text code {
        background: #1a1a1a;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 11px;
      }
      
      .ai-code {
        background: #1a1a1a;
        color: #fff;
        padding: 12px;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 11px;
        overflow-x: auto;
      }
      
      .ai-response-actions {
        padding: 8px 12px;
        border-top: 1px solid #444;
        display: flex;
        gap: 8px;
      }
      
      .ai-response-actions button {
        background: #3a3a3a;
        border: 1px solid #444;
        color: #ccc;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      }
      
      .ai-response-actions button:hover {
        background: #4a4a4a;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }
}