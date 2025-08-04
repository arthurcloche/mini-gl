export class Console {
    constructor() {
        this.messages = [];
        this.isOpen = false;
        this.errorCount = 0;
    }
    
    initialize() {
        // Add console button handler
        const consoleBtn = document.getElementById('consoleBtn');
        if (consoleBtn) {
            consoleBtn.addEventListener('click', () => this.toggle());
        }
        
        // Create console panel
        this.createConsolePanel();
        
        // Override console methods to capture errors
        this.interceptConsole();
    }
    
    createConsolePanel() {
        const panel = document.createElement('div');
        panel.className = 'console-panel';
        panel.id = 'consolePanel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="console-header">
                <h3>Console</h3>
                <button class="close-btn" onclick="window.miniGLEditor?.console?.toggle()">✕</button>
            </div>
            <div class="console-content" id="consoleContent"></div>
            <div class="console-footer">
                <button class="control-btn" onclick="window.miniGLEditor?.console?.clear()">clear</button>
            </div>
        `;
        
        // Add to node graph area
        const nodeGraph = document.getElementById('nodeGraph');
        if (nodeGraph) {
            nodeGraph.appendChild(panel);
        }
    }
    
    interceptConsole() {
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.error = (...args) => {
            this.addMessage('error', args.join(' '));
            originalError.apply(console, args);
        };
        
        console.warn = (...args) => {
            this.addMessage('warning', args.join(' '));
            originalWarn.apply(console, args);
        };
    }
    
    addMessage(type, message) {
        this.messages.push({ type, message, timestamp: new Date() });
        
        if (type === 'error') {
            this.errorCount++;
            this.updateConsoleButton(true);
        }
        
        this.updateDisplay();
    }
    
    updateConsoleButton(hasErrors) {
        const consoleBtn = document.getElementById('consoleBtn');
        if (consoleBtn) {
            if (hasErrors) {
                consoleBtn.classList.add('has-errors');
            } else {
                consoleBtn.classList.remove('has-errors');
            }
        }
    }
    
    updateDisplay() {
        const content = document.getElementById('consoleContent');
        if (!content) return;
        
        content.innerHTML = this.messages.map(msg => `
            <div class="console-message ${msg.type}">
                <span class="console-time">${msg.timestamp.toLocaleTimeString()}</span>
                <span class="console-text">${msg.message}</span>
            </div>
        `).join('');
        
        // Scroll to bottom
        content.scrollTop = content.scrollHeight;
    }
    
    toggle() {
        const panel = document.getElementById('consolePanel');
        if (!panel) return;
        
        this.isOpen = !this.isOpen;
        panel.style.display = this.isOpen ? 'block' : 'none';
    }
    
    clear() {
        this.messages = [];
        this.errorCount = 0;
        this.updateConsoleButton(false);
        this.updateDisplay();
    }
    
    logShaderError(error) {
        // Extract meaningful error message from shader compilation error
        let message = 'Shader compilation failed';
        if (error && error.message) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        }
        
        this.addMessage('error', `[Shader] ${message}`);
        
        // Auto-open console on shader error
        if (!this.isOpen) {
            this.toggle();
        }
    }
    
    logShaderWarning(warning) {
        this.addMessage('warning', `[Shader] ${warning}`);
    }
}