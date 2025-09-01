export class AIAssistant {
  constructor(editorState) {
    this.editorState = editorState;
    this.initialized = false;
    this.contextHistory = [];
    this.maxContextHistory = 10;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Wait for Quick AI to be available
    await this.waitForQuickAI();
    this.initialized = true;
  }

  waitForQuickAI() {
    return new Promise((resolve) => {
      const checkQuick = () => {
        if (typeof quick !== 'undefined' && quick.ai) {
          resolve();
        } else {
          setTimeout(checkQuick, 100);
        }
      };
      checkQuick();
    });
  }

  // Get system prompt for the AI
  getSystemPrompt() {
    return `You are an AI assistant for the miniGL Node Editor - a visual shader editor for WebGL.
    
Your capabilities:
1. Help users write GLSL shader code
2. Create nodes based on descriptions
3. Build node graphs from prompts
4. Debug shader errors
5. Explain shader concepts

Available node types:
- Texture: Load images from URLs
- Text: Render text overlays
- Shader: Custom GLSL fragment shaders
- Blend: Blend two inputs with different modes
- Feedback: Create feedback loops with pingpong buffers
- Grayscale: Convert to grayscale
- Blur: Apply directional blur
- LensDistortion: Apply lens distortion effect

GLSL Context:
- Version: #version 300 es
- Built-in uniforms: glResolution (vec2), glTime (float), glMouse (vec3)
- Built-in varyings: glUV (vec2, 0-1), glCoord (vec2, pixel coords)
- Output: fragColor (vec4)

When creating shaders:
- Always use #version 300 es
- Use 'in' for varyings, 'out' for fragment output
- Texture sampling: texture(sampler, uv)
- Keep animations smooth with small time multipliers (glTime * 0.01)

Response format:
- For shader code: Return valid GLSL code
- For node creation: Return JSON with node properties
- For debugging: Explain the issue and provide a fix`;
  }

  // Build context from current editor state
  buildContext() {
    const context = {
      nodes: Array.from(this.editorState.nodes.values()).map(node => ({
        id: node.id,
        type: node.type,
        name: node.name,
        hasShader: !!node.shader,
        uniforms: Object.keys(node.uniforms || {})
      })),
      connections: this.editorState.connections,
      selectedNode: this.editorState.selectedNode ? 
        this.editorState.getNode(this.editorState.selectedNode) : null
    };
    
    return `Current editor state:
- Nodes: ${context.nodes.length}
- Selected: ${context.selectedNode ? `${context.selectedNode.name} (${context.selectedNode.type})` : 'None'}
- Connections: ${context.connections.length}`;
  }

  // Main prompting interface for editor features
  async promptInEditor(prompt, selectedCode = null) {
    try {
      const context = this.buildContext();
      const fullPrompt = selectedCode ? 
        `${prompt}\n\nSelected code:\n\`\`\`glsl\n${selectedCode}\n\`\`\`\n\n${context}` :
        `${prompt}\n\n${context}`;
      
      const response = await quick.ai.askWithSystem(
        this.getSystemPrompt(),
        fullPrompt
      );
      
      // Add to context history
      this.contextHistory.push({ prompt, response, timestamp: Date.now() });
      if (this.contextHistory.length > this.maxContextHistory) {
        this.contextHistory.shift();
      }
      
      return response;
    } catch (error) {
      console.error('AI prompt error:', error);
      throw error;
    }
  }

  // Create a node from a natural language description
  async createNodeFromPrompt(description) {
    const prompt = `Create a GLSL shader node with this behavior: "${description}"
    
Return a JSON object with:
{
  "type": "Shader",
  "name": "descriptive name",
  "shader": "complete GLSL code",
  "uniforms": { "uniformName": { "type": "slider", "value": default, "min": min, "max": max } }
}

Only include uniforms that are actually used in the shader.
Make sure the shader is visually interesting and animated if appropriate.`;

    try {
      const response = await this.promptInEditor(prompt);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse node definition from AI response');
      }
      
      const nodeData = JSON.parse(jsonMatch[0]);
      
      // Create the node
      const node = this.editorState.addNode(
        nodeData.type || 'Shader',
        nodeData.name || 'AI Generated',
        { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }
      );
      
      // Apply shader and uniforms
      if (nodeData.shader) {
        node.shader = nodeData.shader;
      }
      if (nodeData.uniforms) {
        node.uniforms = { ...node.uniforms, ...nodeData.uniforms };
      }
      
      // Recreate miniGL node with new properties
      this.editorState.recreateMiniGLNode(node);
      
      return node;
    } catch (error) {
      console.error('Error creating node from prompt:', error);
      throw error;
    }
  }

  // Create a complete graph from a description
  async createGraphFromPrompt(description) {
    const prompt = `Create a complete node graph for: "${description}"
    
Return a JSON object with:
{
  "nodes": [
    {
      "id": "unique_id",
      "type": "NodeType",
      "name": "Node Name",
      "position": { "x": number, "y": number },
      "shader": "GLSL code if type is Shader",
      "uniforms": { ... },
      "url": "image URL if type is Texture"
    }
  ],
  "connections": [
    { "from": "node_id", "to": "node_id" }
  ],
  "outputNode": "node_id"
}

Create an interesting, visually appealing graph with 3-5 nodes.
Position nodes logically from left to right.`;

    try {
      const response = await this.promptInEditor(prompt);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse graph definition from AI response');
      }
      
      const graphData = JSON.parse(jsonMatch[0]);
      
      // Clear existing graph
      this.editorState.nodes.clear();
      this.editorState.miniglNodes.clear();
      this.editorState.connections = [];
      this.editorState.outputNode = null;
      
      // Create nodes
      const nodeMap = {};
      for (const nodeData of graphData.nodes) {
        const node = this.editorState.addNode(
          nodeData.type,
          nodeData.name,
          nodeData.position
        );
        
        // Apply properties
        if (nodeData.shader) node.shader = nodeData.shader;
        if (nodeData.uniforms) node.uniforms = { ...node.uniforms, ...nodeData.uniforms };
        if (nodeData.url) node.url = nodeData.url;
        
        nodeMap[nodeData.id] = node.id;
        
        // Recreate miniGL node
        this.editorState.recreateMiniGLNode(node);
      }
      
      // Create connections
      for (const conn of graphData.connections) {
        const fromId = nodeMap[conn.from];
        const toId = nodeMap[conn.to];
        if (fromId && toId) {
          this.editorState.connectNodes(fromId, toId);
        }
      }
      
      // Set output node
      if (graphData.outputNode && nodeMap[graphData.outputNode]) {
        this.editorState.setOutputNode(nodeMap[graphData.outputNode]);
      }
      
      this.editorState.updateUI();
      
      return graphData;
    } catch (error) {
      console.error('Error creating graph from prompt:', error);
      throw error;
    }
  }

  // Debug shader code
  async debugShader(shaderCode, errorMessage = null) {
    const prompt = `Debug this GLSL shader code:
    
\`\`\`glsl
${shaderCode}
\`\`\`

${errorMessage ? `Error message: ${errorMessage}` : 'Check for any issues or improvements.'}

Provide:
1. The issue (if any)
2. The fixed code
3. Brief explanation`;

    try {
      const response = await this.promptInEditor(prompt);
      return response;
    } catch (error) {
      console.error('Error debugging shader:', error);
      throw error;
    }
  }

  // Optimize shader code
  async optimizeShader(shaderCode) {
    const prompt = `Optimize this GLSL shader for better performance while maintaining the same visual output:
    
\`\`\`glsl
${shaderCode}
\`\`\`

Provide the optimized version with brief notes on what was improved.`;

    try {
      const response = await this.promptInEditor(prompt);
      return response;
    } catch (error) {
      console.error('Error optimizing shader:', error);
      throw error;
    }
  }

  // Explain shader concept
  async explainConcept(concept) {
    const prompt = `Explain the GLSL/shader concept: "${concept}"
    
Provide:
1. Simple explanation
2. Common use cases
3. Example code snippet
Keep it concise and practical.`;

    try {
      const response = await quick.ai.ask(prompt);
      return response;
    } catch (error) {
      console.error('Error explaining concept:', error);
      throw error;
    }
  }

  // Generate shader variations
  async generateVariation(shaderCode, variationType = 'creative') {
    const prompt = `Create a ${variationType} variation of this shader:
    
\`\`\`glsl
${shaderCode}
\`\`\`

Maintain the general structure but create a visually distinct variation.
Return only the complete modified shader code.`;

    try {
      const response = await this.promptInEditor(prompt);
      
      // Extract shader code from response
      const codeMatch = response.match(/```(?:glsl)?\n([\s\S]*?)```/);
      if (codeMatch) {
        return codeMatch[1].trim();
      }
      
      return response;
    } catch (error) {
      console.error('Error generating variation:', error);
      throw error;
    }
  }

  // Add recreateMiniGLNode helper to EditorState
  recreateMiniGLNode(node) {
    // This should be added to EditorState class
    // For now, we'll handle it here
    const miniglNode = this.editorState.miniglNodes.get(node.id);
    if (miniglNode && miniglNode.dispose) {
      miniglNode.dispose();
    }
    this.editorState.miniglNodes.delete(node.id);
    this.editorState.createMiniGLNode(node);
  }
}