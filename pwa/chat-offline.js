// CFX-030: Offline Chat Enhancement
// Handles message queueing, conversation caching, and offline UI

class OfflineChatManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.messageQueue = [];
    this.currentConversation = null;
    this.offlineMessageId = 0;
    
    this.init();
  }

  async init() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Initialize UI
    this.setupOfflineUI();
    
    // Load conversation from URL or storage
    await this.loadConversation();
    
    // Setup message queue processing
    await this.loadMessageQueue();
    
    // Listen for service worker messages
    this.setupServiceWorkerCommunication();
    
    // Check if we're offline on startup
    if (!this.isOnline) {
      this.handleOffline();
    }
  }

  setupOfflineUI() {
    // Add offline status indicator to chat header
    const header = document.querySelector('.chat-header');
    if (header) {
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'chat-connection-status';
      statusIndicator.id = 'connectionStatus';
      header.appendChild(statusIndicator);
      
      this.updateConnectionStatus();
    }

    // Add offline styles
    const style = document.createElement('style');
    style.textContent = `
      .chat-connection-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.8rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        transition: all 0.3s ease;
      }
      
      .status-online {
        background: rgba(0, 255, 136, 0.1);
        color: #00ff88;
        border: 1px solid rgba(0, 255, 136, 0.2);
      }
      
      .status-offline {
        background: rgba(255, 136, 68, 0.1);
        color: #ff8844;
        border: 1px solid rgba(255, 136, 68, 0.2);
        animation: pulse-orange 2s ease-in-out infinite;
      }
      
      @keyframes pulse-orange {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }
      
      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      
      .message-queued {
        background: rgba(255, 136, 68, 0.05) !important;
        border-left: 3px solid #ff8844 !important;
        position: relative;
      }
      
      .message-queued::after {
        content: "⏳ Queued";
        position: absolute;
        bottom: 0.5rem;
        right: 1rem;
        font-size: 0.7rem;
        color: #ff8844;
        background: rgba(255, 136, 68, 0.1);
        padding: 0.2rem 0.5rem;
        border-radius: 100px;
        font-weight: 600;
      }
      
      .message-sending {
        background: rgba(0, 255, 136, 0.05) !important;
        border-left: 3px solid #00ff88 !important;
      }
      
      .message-sending::after {
        content: "📤 Sending";
        position: absolute;
        bottom: 0.5rem;
        right: 1rem;
        font-size: 0.7rem;
        color: #00ff88;
        background: rgba(0, 255, 136, 0.1);
        padding: 0.2rem 0.5rem;
        border-radius: 100px;
        font-weight: 600;
      }
      
      .offline-banner {
        background: rgba(255, 136, 68, 0.1);
        border: 1px solid rgba(255, 136, 68, 0.2);
        border-radius: 12px;
        padding: 1rem;
        margin: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.85rem;
        color: #ff8844;
        transform: translateY(-20px);
        opacity: 0;
        transition: all 0.4s ease;
      }
      
      .offline-banner.show {
        transform: translateY(0);
        opacity: 1;
      }
      
      .offline-banner-icon {
        font-size: 1.2rem;
      }
      
      .offline-banner-text {
        flex: 1;
        line-height: 1.4;
      }
      
      .offline-banner-action {
        background: rgba(255, 136, 68, 0.2);
        border: 1px solid rgba(255, 136, 68, 0.3);
        color: #ff8844;
        padding: 0.4rem 0.8rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
      }
      
      .offline-banner-action:hover {
        background: rgba(255, 136, 68, 0.3);
        transform: translateY(-1px);
      }
      
      .queue-status {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        background: rgba(17, 17, 17, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        font-size: 0.8rem;
        color: #b0b0b0;
        display: none;
        z-index: 1000;
        max-width: 250px;
      }
      
      .queue-status.show {
        display: block;
      }
      
      .queue-count {
        color: #ff8844;
        font-weight: 600;
      }
      
      @media (max-width: 768px) {
        .chat-connection-status {
          font-size: 0.65rem;
          padding: 0.3rem 0.6rem;
        }
        
        .queue-status {
          bottom: 0.5rem;
          right: 0.5rem;
          left: 0.5rem;
          max-width: none;
        }
      }
    `;
    
    if (!document.getElementById('offline-chat-styles')) {
      style.id = 'offline-chat-styles';
      document.head.appendChild(style);
    }
  }

  updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    
    if (this.isOnline) {
      statusEl.className = 'chat-connection-status status-online';
      statusEl.innerHTML = '<div class="status-dot"></div>Online';
    } else {
      statusEl.className = 'chat-connection-status status-offline';
      statusEl.innerHTML = '<div class="status-dot"></div>Offline';
    }
  }

  async handleOnline() {
    console.log('Chat: Back online');
    this.isOnline = true;
    this.updateConnectionStatus();
    this.hideOfflineBanner();
    
    // Process queued messages
    await this.processMessageQueue();
    
    // Update queue status
    this.updateQueueStatus();
  }

  handleOffline() {
    console.log('Chat: Gone offline');
    this.isOnline = false;
    this.updateConnectionStatus();
    this.showOfflineBanner();
    
    // Update queue status
    this.updateQueueStatus();
  }

  showOfflineBanner() {
    let banner = document.querySelector('.offline-banner');
    if (banner) return;
    
    banner = document.createElement('div');
    banner.className = 'offline-banner';
    banner.innerHTML = `
      <div class="offline-banner-icon">📡</div>
      <div class="offline-banner-text">
        <strong>You're offline.</strong> Messages will be sent when your connection returns.
      </div>
      <button class="offline-banner-action" onclick="location.reload()">
        Retry
      </button>
    `;
    
    const messages = document.getElementById('chat-messages');
    if (messages) {
      messages.insertBefore(banner, messages.firstChild);
      setTimeout(() => banner.classList.add('show'), 100);
    }
  }

  hideOfflineBanner() {
    const banner = document.querySelector('.offline-banner');
    if (banner) {
      banner.classList.remove('show');
      setTimeout(() => {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 400);
    }
  }

  async loadConversation() {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation') || this.generateConversationId();
    
    this.currentConversation = conversationId;
    
    // Try to load from service worker cache
    try {
      const serviceWorker = await navigator.serviceWorker.ready;
      
      if (serviceWorker.active) {
        // Request cached conversation
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          const messages = event.data;
          if (messages && messages.length > 0) {
            this.loadCachedMessages(messages);
          }
        };
        
        serviceWorker.active.postMessage({
          type: 'GET_CONVERSATION',
          conversationId: conversationId
        }, [messageChannel.port2]);
      }
    } catch (error) {
      console.log('Could not load cached conversation:', error);
    }
  }

  loadCachedMessages(messages) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    // Clear existing messages
    messagesContainer.innerHTML = '';
    
    // Add cached messages
    messages.forEach(message => {
      this.addMessageToUI(message, false);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async sendMessage(content, isRetry = false) {
    const message = {
      id: this.generateMessageId(),
      content: content,
      timestamp: Date.now(),
      isUser: true,
      status: this.isOnline ? 'sending' : 'queued'
    };
    
    // Add to UI immediately
    this.addMessageToUI(message, true);
    
    if (this.isOnline) {
      // Try to send immediately
      try {
        await this.sendToAPI(message);
        this.updateMessageStatus(message.id, 'sent');
      } catch (error) {
        console.log('Failed to send message:', error);
        message.status = 'queued';
        this.addToQueue(message);
        this.updateMessageStatus(message.id, 'queued');
      }
    } else {
      // Add to queue
      this.addToQueue(message);
    }
    
    // Save conversation
    await this.saveConversation();
    this.updateQueueStatus();
  }

  async sendToAPI(message) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.content,
        conversationId: this.currentConversation,
        messageId: message.id
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Add AI response to UI
    if (result.response) {
      const aiMessage = {
        id: this.generateMessageId(),
        content: result.response,
        timestamp: Date.now(),
        isUser: false,
        status: 'received'
      };
      
      this.addMessageToUI(aiMessage, true);
      await this.saveConversation();
    }
    
    return result;
  }

  addToQueue(message) {
    this.messageQueue.push({
      ...message,
      queuedAt: Date.now(),
      retries: 0
    });
    
    this.saveMessageQueue();
  }

  async processMessageQueue() {
    if (!this.isOnline || this.messageQueue.length === 0) return;
    
    const failedMessages = [];
    
    for (const queuedMessage of [...this.messageQueue]) {
      try {
        this.updateMessageStatus(queuedMessage.id, 'sending');
        
        await this.sendToAPI(queuedMessage);
        
        // Remove from queue
        this.messageQueue = this.messageQueue.filter(m => m.id !== queuedMessage.id);
        
        this.updateMessageStatus(queuedMessage.id, 'sent');
        
      } catch (error) {
        console.log(`Failed to send queued message ${queuedMessage.id}:`, error);
        
        queuedMessage.retries = (queuedMessage.retries || 0) + 1;
        
        if (queuedMessage.retries >= 3) {
          failedMessages.push(queuedMessage);
          this.updateMessageStatus(queuedMessage.id, 'failed');
        } else {
          this.updateMessageStatus(queuedMessage.id, 'queued');
        }
      }
    }
    
    // Remove failed messages from queue
    this.messageQueue = this.messageQueue.filter(m => !failedMessages.includes(m));
    
    await this.saveMessageQueue();
    this.updateQueueStatus();
  }

  addMessageToUI(message, animate = false) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.isUser ? 'user' : 'assistant'}`;
    messageEl.setAttribute('data-message-id', message.id);
    
    messageEl.innerHTML = `
      <div class="message-content">${this.formatMessageContent(message.content)}</div>
      <div class="message-meta">
        ${new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
      </div>
    `;
    
    // Apply status class
    if (message.status) {
      this.updateMessageStatus(message.id, message.status, messageEl);
    }
    
    messagesContainer.appendChild(messageEl);
    
    if (animate) {
      messageEl.style.opacity = '0';
      messageEl.style.transform = 'translateY(10px)';
      
      requestAnimationFrame(() => {
        messageEl.style.transition = 'all 0.3s ease';
        messageEl.style.opacity = '1';
        messageEl.style.transform = 'translateY(0)';
      });
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  updateMessageStatus(messageId, status, messageEl = null) {
    if (!messageEl) {
      messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    }
    
    if (!messageEl) return;
    
    // Remove old status classes
    messageEl.classList.remove('message-queued', 'message-sending', 'message-failed');
    
    // Add new status class
    switch (status) {
      case 'queued':
        messageEl.classList.add('message-queued');
        break;
      case 'sending':
        messageEl.classList.add('message-sending');
        break;
      case 'failed':
        messageEl.classList.add('message-failed');
        break;
      case 'sent':
        // No special styling for sent messages
        break;
    }
  }

  formatMessageContent(content) {
    // Basic formatting - expand as needed
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  async saveConversation() {
    try {
      const messages = this.getMessagesFromUI();
      
      const serviceWorker = await navigator.serviceWorker.ready;
      
      if (serviceWorker.active) {
        serviceWorker.active.postMessage({
          type: 'SAVE_CONVERSATION',
          data: {
            conversationId: this.currentConversation,
            messages: messages
          }
        });
      }
    } catch (error) {
      console.log('Could not save conversation:', error);
    }
  }

  getMessagesFromUI() {
    const messageElements = document.querySelectorAll('.chat-message');
    const messages = [];
    
    messageElements.forEach(el => {
      const content = el.querySelector('.message-content')?.innerText || '';
      const isUser = el.classList.contains('user');
      const messageId = el.getAttribute('data-message-id');
      
      if (content) {
        messages.push({
          id: messageId,
          content: content,
          isUser: isUser,
          timestamp: Date.now() // Simplified - could parse from UI
        });
      }
    });
    
    return messages;
  }

  async loadMessageQueue() {
    try {
      const saved = localStorage.getItem('cortex_message_queue');
      if (saved) {
        this.messageQueue = JSON.parse(saved);
      }
    } catch (error) {
      console.log('Could not load message queue:', error);
      this.messageQueue = [];
    }
  }

  async saveMessageQueue() {
    try {
      localStorage.setItem('cortex_message_queue', JSON.stringify(this.messageQueue));
    } catch (error) {
      console.log('Could not save message queue:', error);
    }
  }

  setupServiceWorkerCommunication() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        if (type === 'queue-updated') {
          this.updateQueueStatus(data);
        }
      });
    }
  }

  updateQueueStatus(queueData = null) {
    let statusEl = document.querySelector('.queue-status');
    
    const pendingCount = queueData?.pending || this.messageQueue.length;
    const failedCount = queueData?.failed || 0;
    
    if (pendingCount === 0 && failedCount === 0) {
      if (statusEl) {
        statusEl.classList.remove('show');
        setTimeout(() => {
          if (statusEl && statusEl.parentNode) {
            statusEl.parentNode.removeChild(statusEl);
          }
        }, 300);
      }
      return;
    }
    
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.className = 'queue-status';
      document.body.appendChild(statusEl);
    }
    
    const totalCount = pendingCount + failedCount;
    let statusText = '';
    
    if (pendingCount > 0 && failedCount === 0) {
      statusText = `<span class="queue-count">${pendingCount}</span> message${pendingCount !== 1 ? 's' : ''} queued`;
    } else if (failedCount > 0 && pendingCount === 0) {
      statusText = `<span class="queue-count">${failedCount}</span> message${failedCount !== 1 ? 's' : ''} failed`;
    } else if (pendingCount > 0 && failedCount > 0) {
      statusText = `<span class="queue-count">${pendingCount}</span> queued, <span class="queue-count">${failedCount}</span> failed`;
    }
    
    statusEl.innerHTML = statusText;
    statusEl.classList.add('show');
  }

  generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateMessageId() {
    return 'msg_' + Date.now() + '_' + (++this.offlineMessageId);
  }
}

// Initialize offline chat manager
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.offlineChatManager = new OfflineChatManager();
  });
} else {
  window.offlineChatManager = new OfflineChatManager();
}

// Export for use in other scripts
window.OfflineChatManager = OfflineChatManager;