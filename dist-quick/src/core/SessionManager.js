export class SessionManager {
  constructor(editorState) {
    this.editorState = editorState;
    this.currentSession = null;
    this.currentUserId = null;
    this.sessionsCollection = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Wait for Quick to be available
    await this.waitForQuick();
    
    // Get user info
    this.currentUserId = quick.id.email;
    
    // Initialize database collection
    this.sessionsCollection = quick.db.collection('sessions');
    
    // Subscribe to real-time updates
    this.subscribeToSessions();
    
    this.initialized = true;
  }

  waitForQuick() {
    return new Promise((resolve) => {
      const checkQuick = () => {
        if (typeof quick !== 'undefined' && quick.db && quick.id) {
          resolve();
        } else {
          setTimeout(checkQuick, 100);
        }
      };
      checkQuick();
    });
  }

  subscribeToSessions() {
    if (!this.sessionsCollection) return;
    
    this.unsubscribe = this.sessionsCollection.subscribe({
      onCreate: (doc) => {
        console.log('New session created:', doc.id);
        this.onSessionsChanged();
      },
      onUpdate: (doc) => {
        console.log('Session updated:', doc.id);
        if (this.currentSession && this.currentSession.id === doc.id) {
          this.currentSession = doc;
        }
        this.onSessionsChanged();
      },
      onDelete: (id) => {
        console.log('Session deleted:', id);
        if (this.currentSession && this.currentSession.id === id) {
          this.currentSession = null;
        }
        this.onSessionsChanged();
      }
    });
  }

  async getUserSessions() {
    if (!this.sessionsCollection) return [];
    
    try {
      const sessions = await this.sessionsCollection
        .where({ userId: this.currentUserId })
        .select(['id', 'name', 'thumbnail', 'created_at', 'updated_at'])
        .limit(24)
        .find();
      
      // Sort by updated_at descending
      return sessions.sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      );
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      return [];
    }
  }

  async getAllPublicSessions() {
    if (!this.sessionsCollection) return [];
    
    try {
      const sessions = await this.sessionsCollection
        .where({ public: true })
        .select(['id', 'name', 'thumbnail', 'userId', 'created_at', 'updated_at'])
        .limit(100)
        .find();
      
      return sessions.sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      );
    } catch (error) {
      console.error('Error fetching public sessions:', error);
      return [];
    }
  }

  async saveSession(name = null, makePublic = false) {
    if (!this.sessionsCollection) {
      throw new Error('Session manager not initialized');
    }

    // Generate session data from current editor state
    const graphData = this.editorState.exportGraph();
    
    // Create thumbnail (we'll capture canvas later)
    const thumbnail = await this.captureCanvasThumbnail();
    
    const sessionData = {
      name: name || this.generateSessionName(),
      userId: this.currentUserId,
      public: makePublic,
      thumbnail: thumbnail,
      graph: graphData,
      miniGLVersion: '1.0',
      editorVersion: '2.0-quick'
    };

    try {
      if (this.currentSession && this.currentSession.userId === this.currentUserId) {
        // Update existing session
        const updated = await this.sessionsCollection.update(
          this.currentSession.id, 
          sessionData
        );
        this.currentSession = updated;
        console.log('Session updated:', updated.id);
        return updated;
      } else {
        // Create new session (or clone if current session belongs to someone else)
        const created = await this.sessionsCollection.create(sessionData);
        this.currentSession = created;
        console.log('Session created:', created.id);
        return created;
      }
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }

  async loadSession(sessionId) {
    if (!this.sessionsCollection) {
      throw new Error('Session manager not initialized');
    }

    try {
      const session = await this.sessionsCollection.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Import the graph data into editor
      this.editorState.importGraph(session.graph);
      
      // Set as current session
      this.currentSession = session;
      
      // Update URL with session ID
      this.updateURLWithSessionId(sessionId);
      
      console.log('Session loaded:', session.name);
      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    if (!this.sessionsCollection) {
      throw new Error('Session manager not initialized');
    }

    try {
      // Check if user owns this session
      const session = await this.sessionsCollection.findById(sessionId);
      if (!session || session.userId !== this.currentUserId) {
        throw new Error('Unauthorized to delete this session');
      }

      await this.sessionsCollection.delete(sessionId);
      
      if (this.currentSession && this.currentSession.id === sessionId) {
        this.currentSession = null;
        this.clearURLSessionId();
      }
      
      console.log('Session deleted:', sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  async cloneSession(sessionId, newName = null) {
    if (!this.sessionsCollection) {
      throw new Error('Session manager not initialized');
    }

    try {
      const session = await this.sessionsCollection.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Create a new session with the same graph data
      const clonedData = {
        name: newName || `${session.name} (Copy)`,
        userId: this.currentUserId,
        public: false,
        thumbnail: session.thumbnail,
        graph: session.graph,
        miniGLVersion: session.miniGLVersion,
        editorVersion: session.editorVersion,
        clonedFrom: sessionId
      };

      const created = await this.sessionsCollection.create(clonedData);
      console.log('Session cloned:', created.id);
      return created;
    } catch (error) {
      console.error('Error cloning session:', error);
      throw error;
    }
  }

  async shareSession(sessionId) {
    if (!this.sessionsCollection) {
      throw new Error('Session manager not initialized');
    }

    try {
      const session = await this.sessionsCollection.findById(sessionId);
      
      if (!session || session.userId !== this.currentUserId) {
        throw new Error('Unauthorized to share this session');
      }

      // Make session public
      await this.sessionsCollection.update(sessionId, { public: true });
      
      // Generate shareable URL
      const shareUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
      
      return shareUrl;
    } catch (error) {
      console.error('Error sharing session:', error);
      throw error;
    }
  }

  async captureCanvasThumbnail() {
    try {
      const canvas = document.querySelector('#glcanvas');
      if (!canvas) return null;
      
      // Create a smaller canvas for thumbnail
      const thumbnailCanvas = document.createElement('canvas');
      const ctx = thumbnailCanvas.getContext('2d');
      const maxSize = 256;
      
      const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
      thumbnailCanvas.width = canvas.width * scale;
      thumbnailCanvas.height = canvas.height * scale;
      
      ctx.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
      
      return thumbnailCanvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Error capturing thumbnail:', error);
      return null;
    }
  }

  generateSessionName() {
    const adjectives = ['Vibrant', 'Dynamic', 'Fluid', 'Electric', 'Cosmic', 'Ethereal'];
    const nouns = ['Flow', 'Pattern', 'Wave', 'Pulse', 'Dream', 'Vision'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun}`;
  }

  updateURLWithSessionId(sessionId) {
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    window.history.pushState({}, '', url);
  }

  clearURLSessionId() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.pushState({}, '', url);
  }

  async loadSessionFromURL() {
    const url = new URL(window.location);
    const sessionId = url.searchParams.get('session');
    
    if (sessionId) {
      try {
        await this.loadSession(sessionId);
        return true;
      } catch (error) {
        console.error('Failed to load session from URL:', error);
        this.clearURLSessionId();
      }
    }
    return false;
  }

  onSessionsChanged() {
    // This will be overridden by UI components
    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  isCurrentUserSession() {
    return this.currentSession && this.currentSession.userId === this.currentUserId;
  }

  canEditCurrentSession() {
    return !this.currentSession || this.currentSession.userId === this.currentUserId;
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}