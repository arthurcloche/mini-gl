export class SessionBrowser {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.isOpen = false;
    this.activeTab = 'my-sessions';
    this.element = null;
    this.createUI();
  }

  createUI() {
    // Create main container
    this.element = document.createElement('div');
    this.element.className = 'session-browser';
    this.element.style.display = 'none';
    this.element.innerHTML = `
      <div class="session-browser-overlay"></div>
      <div class="session-browser-modal">
        <div class="session-browser-header">
          <h2>Sessions</h2>
          <button class="session-browser-close">×</button>
        </div>
        
        <div class="session-browser-tabs">
          <button class="session-tab active" data-tab="my-sessions">My Sessions</button>
          <button class="session-tab" data-tab="public-sessions">Explore</button>
        </div>
        
        <div class="session-browser-content">
          <div class="session-browser-toolbar">
            <button class="session-new-btn">+ New Session</button>
            <div class="session-info">
              <span class="session-count">0/24 sessions</span>
            </div>
          </div>
          
          <div class="session-grid" id="session-grid">
            <!-- Sessions will be inserted here -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);
    this.attachEventListeners();
    this.addStyles();
  }

  attachEventListeners() {
    // Close button
    this.element.querySelector('.session-browser-close').addEventListener('click', () => {
      this.close();
    });

    // Overlay click to close
    this.element.querySelector('.session-browser-overlay').addEventListener('click', () => {
      this.close();
    });

    // Tab switching
    this.element.querySelectorAll('.session-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // New session button
    this.element.querySelector('.session-new-btn').addEventListener('click', () => {
      this.createNewSession();
    });

    // Update when sessions change
    this.sessionManager.onUpdate = () => {
      if (this.isOpen) {
        this.refresh();
      }
    };
  }

  async open() {
    this.isOpen = true;
    this.element.style.display = 'block';
    await this.refresh();
  }

  close() {
    this.isOpen = false;
    this.element.style.display = 'none';
  }

  async switchTab(tab) {
    this.activeTab = tab;
    
    // Update tab buttons
    this.element.querySelectorAll('.session-tab').forEach(tabBtn => {
      tabBtn.classList.toggle('active', tabBtn.dataset.tab === tab);
    });

    // Update toolbar visibility
    const toolbar = this.element.querySelector('.session-browser-toolbar');
    toolbar.style.display = tab === 'my-sessions' ? 'flex' : 'none';

    await this.refresh();
  }

  async refresh() {
    const grid = this.element.querySelector('#session-grid');
    grid.innerHTML = '<div class="loading">Loading sessions...</div>';

    try {
      let sessions = [];
      
      if (this.activeTab === 'my-sessions') {
        sessions = await this.sessionManager.getUserSessions();
        
        // Update count
        const countEl = this.element.querySelector('.session-count');
        countEl.textContent = `${sessions.length}/24 sessions`;
      } else {
        sessions = await this.sessionManager.getAllPublicSessions();
      }

      if (sessions.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📂</div>
            <p>${this.activeTab === 'my-sessions' ? 'No sessions yet' : 'No public sessions available'}</p>
            ${this.activeTab === 'my-sessions' ? '<p class="empty-hint">Create your first session to get started</p>' : ''}
          </div>
        `;
      } else {
        grid.innerHTML = sessions.map(session => this.renderSessionCard(session)).join('');
        
        // Attach card event listeners
        grid.querySelectorAll('.session-card').forEach(card => {
          const sessionId = card.dataset.sessionId;
          
          card.addEventListener('click', (e) => {
            if (!e.target.closest('.session-card-actions')) {
              this.loadSession(sessionId);
            }
          });
        });
        
        // Attach action button listeners
        grid.querySelectorAll('.session-action').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const sessionId = btn.closest('.session-card').dataset.sessionId;
            this.handleSessionAction(action, sessionId);
          });
        });
      }
    } catch (error) {
      console.error('Error refreshing sessions:', error);
      grid.innerHTML = '<div class="error">Failed to load sessions</div>';
    }
  }

  renderSessionCard(session) {
    const isOwner = session.userId === this.sessionManager.currentUserId;
    const timeAgo = this.getTimeAgo(new Date(session.updated_at));
    
    return `
      <div class="session-card" data-session-id="${session.id}">
        <div class="session-thumbnail">
          ${session.thumbnail ? 
            `<img src="${session.thumbnail}" alt="${session.name}">` : 
            '<div class="session-thumbnail-placeholder">🎨</div>'
          }
        </div>
        <div class="session-info">
          <h3 class="session-name">${session.name}</h3>
          <p class="session-meta">
            ${isOwner ? 'You' : session.userId?.split('@')[0] || 'Anonymous'} • ${timeAgo}
          </p>
        </div>
        <div class="session-card-actions">
          ${isOwner ? `
            <button class="session-action" data-action="share" title="Share">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
              </svg>
            </button>
            <button class="session-action" data-action="delete" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/>
              </svg>
            </button>
          ` : `
            <button class="session-action" data-action="clone" title="Clone">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
          `}
        </div>
      </div>
    `;
  }

  async handleSessionAction(action, sessionId) {
    try {
      switch (action) {
        case 'delete':
          if (confirm('Are you sure you want to delete this session?')) {
            await this.sessionManager.deleteSession(sessionId);
            await this.refresh();
          }
          break;
          
        case 'share':
          const shareUrl = await this.sessionManager.shareSession(sessionId);
          this.showShareDialog(shareUrl);
          break;
          
        case 'clone':
          const cloned = await this.sessionManager.cloneSession(sessionId);
          await this.loadSession(cloned.id);
          break;
      }
    } catch (error) {
      console.error(`Error performing action ${action}:`, error);
      alert(`Failed to ${action} session: ${error.message}`);
    }
  }

  async loadSession(sessionId) {
    try {
      await this.sessionManager.loadSession(sessionId);
      this.close();
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Failed to load session');
    }
  }

  async createNewSession() {
    try {
      // Clear current graph
      this.sessionManager.editorState.nodes.clear();
      this.sessionManager.editorState.miniglNodes.clear();
      this.sessionManager.editorState.connections = [];
      this.sessionManager.editorState.outputNode = null;
      this.sessionManager.editorState.updateUI();
      
      // Clear current session
      this.sessionManager.currentSession = null;
      this.sessionManager.clearURLSessionId();
      
      this.close();
    } catch (error) {
      console.error('Error creating new session:', error);
    }
  }

  showShareDialog(shareUrl) {
    const dialog = document.createElement('div');
    dialog.className = 'share-dialog';
    dialog.innerHTML = `
      <div class="share-dialog-content">
        <h3>Share Session</h3>
        <p>Your session is now public. Share this link:</p>
        <div class="share-url-container">
          <input type="text" class="share-url-input" value="${shareUrl}" readonly>
          <button class="share-copy-btn">Copy</button>
        </div>
        <button class="share-close-btn">Close</button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const input = dialog.querySelector('.share-url-input');
    input.select();
    
    dialog.querySelector('.share-copy-btn').addEventListener('click', () => {
      input.select();
      document.execCommand('copy');
      dialog.querySelector('.share-copy-btn').textContent = 'Copied!';
      setTimeout(() => {
        dialog.querySelector('.share-copy-btn').textContent = 'Copy';
      }, 2000);
    });
    
    dialog.querySelector('.share-close-btn').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .session-browser {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
      }
      
      .session-browser-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
      }
      
      .session-browser-modal {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 900px;
        height: 80vh;
        background: #1a1a1a;
        border-radius: 12px;
        border: 1px solid #333;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .session-browser-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #333;
      }
      
      .session-browser-header h2 {
        margin: 0;
        color: #fff;
        font-size: 20px;
      }
      
      .session-browser-close {
        background: none;
        border: none;
        color: #999;
        font-size: 28px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .session-browser-close:hover {
        color: #fff;
      }
      
      .session-browser-tabs {
        display: flex;
        padding: 0 20px;
        border-bottom: 1px solid #333;
      }
      
      .session-tab {
        background: none;
        border: none;
        color: #999;
        padding: 12px 20px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: all 0.2s;
      }
      
      .session-tab:hover {
        color: #fff;
      }
      
      .session-tab.active {
        color: #4a90e2;
        border-bottom-color: #4a90e2;
      }
      
      .session-browser-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .session-browser-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #333;
      }
      
      .session-new-btn {
        background: #4a90e2;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }
      
      .session-new-btn:hover {
        background: #357abd;
      }
      
      .session-count {
        color: #999;
        font-size: 14px;
      }
      
      .session-grid {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      
      .session-card {
        background: #2a2a2a;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid #333;
      }
      
      .session-card:hover {
        transform: translateY(-2px);
        border-color: #4a90e2;
      }
      
      .session-thumbnail {
        width: 100%;
        height: 150px;
        background: #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .session-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .session-thumbnail-placeholder {
        font-size: 48px;
      }
      
      .session-info {
        padding: 12px;
      }
      
      .session-name {
        margin: 0 0 4px 0;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .session-meta {
        margin: 0;
        color: #999;
        font-size: 12px;
      }
      
      .session-card-actions {
        display: flex;
        gap: 8px;
        padding: 0 12px 12px;
      }
      
      .session-action {
        background: #333;
        border: none;
        color: #999;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .session-action:hover {
        background: #444;
        color: #fff;
      }
      
      .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
      }
      
      .empty-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }
      
      .empty-state p {
        color: #999;
        margin: 8px 0;
      }
      
      .empty-hint {
        font-size: 14px;
        color: #666;
      }
      
      .loading, .error {
        grid-column: 1 / -1;
        text-align: center;
        padding: 40px;
        color: #999;
      }
      
      .error {
        color: #ff6b6b;
      }
      
      .share-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
      }
      
      .share-dialog-content {
        background: #2a2a2a;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
      }
      
      .share-dialog-content h3 {
        margin: 0 0 12px 0;
        color: #fff;
      }
      
      .share-dialog-content p {
        color: #999;
        margin: 0 0 16px 0;
      }
      
      .share-url-container {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .share-url-input {
        flex: 1;
        background: #1a1a1a;
        border: 1px solid #333;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
      }
      
      .share-copy-btn, .share-close-btn {
        background: #4a90e2;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .share-copy-btn:hover, .share-close-btn:hover {
        background: #357abd;
      }
    `;
    document.head.appendChild(style);
  }
}