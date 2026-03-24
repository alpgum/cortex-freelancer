// CFX-030: Smart PWA Install Prompt
// Shows install banner for returning users and handles install flow

class PWAInstallPrompt {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.installBanner = null;
    this.isInstalled = false;
    this.hasBeenPrompted = false;
    
    this.init();
  }

  async init() {
    // Check if already installed
    this.checkInstallStatus();
    
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.checkShouldShowPrompt();
    });
    
    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.hideInstallPrompt();
      this.trackInstall('automatic');
    });
    
    // Check for iOS Safari
    if (this.isIOS() && !this.isInstalledOnIOS()) {
      this.showIOSInstructions();
    }
    
    // Listen for user engagement
    this.trackUserEngagement();
  }

  checkInstallStatus() {
    // Check if running as PWA
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true ||
                      document.referrer.includes('android-app://');
    
    // Check if install prompt was already dismissed
    this.hasBeenPrompted = localStorage.getItem('cortex_install_prompted') === 'true';
    
    // For testing - remove in production
    // localStorage.removeItem('cortex_install_prompted');
  }

  checkShouldShowPrompt() {
    if (this.isInstalled || this.hasBeenPrompted || !this.deferredPrompt) {
      return;
    }
    
    // Show prompt based on user engagement
    const visitCount = parseInt(localStorage.getItem('cortex_visit_count') || '0');
    const hasUsedTools = localStorage.getItem('cortex_used_tools') === 'true';
    const timeSpent = parseInt(localStorage.getItem('cortex_time_spent') || '0');
    
    // Show if user has visited 3+ times OR used tools OR spent 5+ minutes
    if (visitCount >= 3 || hasUsedTools || timeSpent >= 300) {
      setTimeout(() => this.showInstallPrompt(), 2000);
    }
  }

  showInstallPrompt() {
    if (this.installBanner) return;
    
    this.installBanner = this.createInstallBanner();
    document.body.appendChild(this.installBanner);
    
    // Animate in
    setTimeout(() => {
      this.installBanner.classList.add('show');
    }, 100);
    
    // Auto-hide after 15 seconds
    setTimeout(() => {
      if (this.installBanner && this.installBanner.parentNode) {
        this.hideInstallPrompt();
      }
    }, 15000);
    
    this.trackEvent('install_prompt_shown');
  }

  createInstallBanner() {
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="install-content">
        <div class="install-icon">⚡</div>
        <div class="install-text">
          <div class="install-title">Install Cortex Freelancer</div>
          <div class="install-subtitle">Quick access from your home screen</div>
        </div>
        <div class="install-actions">
          <button class="install-btn-primary" id="installButton">
            📱 Install
          </button>
          <button class="install-btn-close" id="installClose">
            ✕
          </button>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .pwa-install-banner {
        position: fixed;
        bottom: -100px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: rgba(17, 17, 17, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 136, 68, 0.3);
        border-radius: 16px;
        padding: 1.2rem 1.5rem;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: calc(100vw - 2rem);
        width: 400px;
      }
      
      .pwa-install-banner.show {
        bottom: 2rem;
      }
      
      .install-content {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      
      .install-icon {
        font-size: 2rem;
        animation: pulse 2s ease-in-out infinite;
      }
      
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      
      .install-text {
        flex: 1;
      }
      
      .install-title {
        font-weight: 700;
        color: #f0f0f0;
        font-size: 1rem;
        margin-bottom: 0.25rem;
      }
      
      .install-subtitle {
        color: #b0b0b0;
        font-size: 0.85rem;
      }
      
      .install-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      
      .install-btn-primary {
        background: linear-gradient(135deg, #ff8844, #ff6622);
        color: #000;
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: 100px;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
      }
      
      .install-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(255, 136, 68, 0.3);
      }
      
      .install-btn-close {
        background: none;
        border: none;
        color: #666666;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        transition: all 0.2s;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
      }
      
      .install-btn-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #b0b0b0;
      }
      
      @media (max-width: 480px) {
        .pwa-install-banner {
          bottom: -120px;
          width: calc(100vw - 1rem);
          left: 50%;
          padding: 1rem;
        }
        
        .install-content {
          flex-direction: column;
          text-align: center;
          gap: 1rem;
        }
        
        .install-actions {
          width: 100%;
          justify-content: space-between;
        }
        
        .install-btn-primary {
          flex: 1;
          max-width: 200px;
        }
      }
    `;
    
    if (!document.getElementById('pwa-install-styles')) {
      style.id = 'pwa-install-styles';
      document.head.appendChild(style);
    }
    
    // Add event listeners
    banner.querySelector('#installButton').addEventListener('click', () => {
      this.triggerInstall();
    });
    
    banner.querySelector('#installClose').addEventListener('click', () => {
      this.hideInstallPrompt();
      this.markAsPrompted();
    });
    
    return banner;
  }

  async triggerInstall() {
    if (!this.deferredPrompt) {
      this.trackEvent('install_not_available');
      return;
    }
    
    try {
      this.deferredPrompt.prompt();
      const result = await this.deferredPrompt.userChoice;
      
      this.trackEvent('install_choice', { outcome: result.outcome });
      
      if (result.outcome === 'accepted') {
        this.trackInstall('user_choice');
      }
      
      this.markAsPrompted();
      this.hideInstallPrompt();
      this.deferredPrompt = null;
    } catch (error) {
      console.log('Install prompt error:', error);
      this.trackEvent('install_error', { error: error.message });
    }
  }

  hideInstallPrompt() {
    if (this.installBanner) {
      this.installBanner.classList.remove('show');
      setTimeout(() => {
        if (this.installBanner && this.installBanner.parentNode) {
          this.installBanner.parentNode.removeChild(this.installBanner);
          this.installBanner = null;
        }
      }, 400);
    }
  }

  markAsPrompted() {
    localStorage.setItem('cortex_install_prompted', 'true');
    this.hasBeenPrompted = true;
  }

  showIOSInstructions() {
    // Only show for Safari on iOS, not Chrome/Firefox
    if (!this.isSafari()) return;
    
    const hasSeenInstructions = localStorage.getItem('cortex_ios_instructions_shown');
    if (hasSeenInstructions) return;
    
    // Show after some engagement
    setTimeout(() => {
      this.showIOSModal();
    }, 5000);
  }

  showIOSModal() {
    const modal = document.createElement('div');
    modal.className = 'ios-install-modal';
    modal.innerHTML = `
      <div class="ios-modal-content">
        <div class="ios-modal-header">
          <h3>Install Cortex Freelancer</h3>
          <button class="ios-modal-close">✕</button>
        </div>
        <div class="ios-modal-body">
          <p>Add this app to your home screen for the best experience:</p>
          <div class="ios-instructions">
            <div class="ios-step">
              <span class="ios-icon">⬆️</span>
              <span>Tap the Share button</span>
            </div>
            <div class="ios-step">
              <span class="ios-icon">➕</span>
              <span>Tap "Add to Home Screen"</span>
            </div>
          </div>
        </div>
      </div>
      <div class="ios-modal-backdrop"></div>
    `;
    
    // Add iOS modal styles
    const iosStyle = document.createElement('style');
    iosStyle.textContent = `
      .ios-install-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      
      .ios-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
      }
      
      .ios-modal-content {
        position: relative;
        background: #1a1a1a;
        border-radius: 16px;
        padding: 0;
        max-width: 350px;
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
      }
      
      .ios-modal-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .ios-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
        color: #f0f0f0;
      }
      
      .ios-modal-close {
        background: none;
        border: none;
        color: #666;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0.5rem;
        font-family: inherit;
      }
      
      .ios-modal-body {
        padding: 1.5rem;
      }
      
      .ios-modal-body p {
        margin: 0 0 1.5rem;
        color: #b0b0b0;
        line-height: 1.6;
      }
      
      .ios-instructions {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      
      .ios-step {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .ios-icon {
        font-size: 1.5rem;
        width: 2rem;
        text-align: center;
      }
      
      .ios-step span:last-child {
        color: #f0f0f0;
        font-weight: 500;
      }
    `;
    
    document.head.appendChild(iosStyle);
    document.body.appendChild(modal);
    
    // Close handlers
    const closeModal = () => {
      modal.remove();
      iosStyle.remove();
      localStorage.setItem('cortex_ios_instructions_shown', 'true');
    };
    
    modal.querySelector('.ios-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.ios-modal-backdrop').addEventListener('click', closeModal);
    
    this.trackEvent('ios_instructions_shown');
  }

  trackUserEngagement() {
    // Track visits
    const visitCount = parseInt(localStorage.getItem('cortex_visit_count') || '0') + 1;
    localStorage.setItem('cortex_visit_count', visitCount.toString());
    
    // Track time spent
    const startTime = Date.now();
    const updateTimeSpent = () => {
      const currentTime = parseInt(localStorage.getItem('cortex_time_spent') || '0');
      const sessionTime = Math.floor((Date.now() - startTime) / 1000);
      localStorage.setItem('cortex_time_spent', (currentTime + sessionTime).toString());
    };
    
    window.addEventListener('beforeunload', updateTimeSpent);
    setInterval(updateTimeSpent, 30000); // Update every 30 seconds
    
    // Track tool usage
    if (window.location.pathname.includes('/app/tools/')) {
      localStorage.setItem('cortex_used_tools', 'true');
    }
  }

  trackInstall(method) {
    this.trackEvent('pwa_installed', { method });
    
    // Reset engagement tracking after install
    localStorage.removeItem('cortex_visit_count');
    localStorage.removeItem('cortex_time_spent');
    localStorage.removeItem('cortex_used_tools');
  }

  trackEvent(eventName, properties = {}) {
    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, properties);
    }
    
    console.log('PWA Event:', eventName, properties);
  }

  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  isInstalledOnIOS() {
    return window.navigator.standalone === true;
  }

  isSafari() {
    return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  }

  // Public methods for manual triggering
  showPrompt() {
    if (this.deferredPrompt && !this.isInstalled) {
      this.showInstallPrompt();
    }
  }

  hidePrompt() {
    this.hideInstallPrompt();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.cortexInstaller = new PWAInstallPrompt();
  });
} else {
  window.cortexInstaller = new PWAInstallPrompt();
}

// Export for manual use
window.PWAInstallPrompt = PWAInstallPrompt;