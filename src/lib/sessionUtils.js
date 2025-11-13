/**
 * Session utilities for public chat functionality
 * Handles session management without authentication
 */

/**
 * Generate a unique session ID for a new chat session
 * Creates a new session ID on every page refresh
 * @returns {string} Unique session identifier
 */
export function generateSessionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${random}`;
}

/**
 * Generate a browser fingerprint for anonymous user tracking
 * Uses available browser information to create a semi-unique identifier
 * @returns {string} Browser fingerprint
 */
export function generateBrowserFingerprint() {
  if (typeof window === 'undefined') return 'server';
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Browser fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
    canvas.toDataURL()
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Get the current domain for conversation tracking
 * @returns {string} Current domain or 'localhost' for development
 */
export function getCurrentDomain() {
  if (typeof window === 'undefined') return 'server';
  return window.location.hostname || 'localhost';
}

/**
 * Storage utilities for session management
 */
export const sessionStorage = {
  /**
   * Store session data (not persistent across page refreshes by design)
   * @param {string} key Storage key
   * @param {any} value Value to store
   */
  set(key, value) {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Session storage not available:', error);
    }
  },

  /**
   * Retrieve session data
   * @param {string} key Storage key
   * @returns {any} Stored value or null
   */
  get(key) {
    if (typeof window === 'undefined') return null;
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn('Session storage read error:', error);
      return null;
    }
  },

  /**
   * Remove session data
   * @param {string} key Storage key
   */
  remove(key) {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      console.warn('Session storage remove error:', error);
    }
  },

  /**
   * Clear all session data
   */
  clear() {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.clear();
    } catch (error) {
      console.warn('Session storage clear error:', error);
    }
  }
};

/**
 * Chat session manager for public conversations
 */
export class ChatSession {
  constructor(botId) {
    this.botId = botId;
    this.sessionId = generateSessionId(); // New session on each instantiation
    this.userFingerprint = generateBrowserFingerprint();
    this.domain = getCurrentDomain();
  }

  /**
   * Send a message to the bot
   * @param {string} message User message
   * @returns {Promise<Object>} API response
   */
  async sendMessage(message) {
    try {
      const requestData = {
        message,
        sessionId: this.sessionId,
        userFingerprint: this.userFingerprint,
        domain: this.domain,
      };
      
      const response = await fetch(`/api/chat/${this.botId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }

  /**
   * Get conversation history (will be empty for fresh sessions)
   * @returns {Promise<Object>} Conversation history
   */
  async getHistory() {
    try {
      const response = await fetch(`/api/chat/${this.botId}?sessionId=${this.sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get history API error:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history for this session
   * @returns {Promise<Object>} Clear result
   */
  async clearHistory() {
    try {
      const response = await fetch(`/api/chat/${this.botId}?sessionId=${this.sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Clear history API error:', error);
      throw error;
    }
  }

  /**
   * Get session information
   * @returns {Object} Session details
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      botId: this.botId,
      userFingerprint: this.userFingerprint,
      domain: this.domain,
      createdAt: new Date().toISOString(),
    };
  }
}