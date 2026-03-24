/**
 * Loading State Manager for Cortex Freelancer
 * CFX-031: Advanced loading states with progress, connection health, and user feedback
 */
class LoadingStateManager {
    constructor(options = {}) {
        this.options = {
            containerSelector: options.containerSelector || '.chat-container',
            progressSelector: options.progressSelector || '.loading-progress',
            statusSelector: options.statusSelector || '.loading-status',
            connectionSelector: options.connectionSelector || '.connection-indicator',
            cancelSelector: options.cancelSelector || '.cancel-button',
            timeoutWarning: options.timeoutWarning || 30000, // 30 seconds
            estimatedResponseTime: options.estimatedResponseTime || 5000, // 5 seconds
            ...options
        };

        this.state = {
            isLoading: false,
            progress: 0,
            status: 'idle',
            connectionHealth: 'good', // 'good', 'degraded', 'poor'
            startTime: null,
            requestId: null,
            cancelCallback: options.onCancel || null,
            timeoutWarningShown: false
        };

        this.statusMessages = {
            connecting: "Connecting to Cortex...",
            thinking: "AI is thinking...",
            generating: "Generating response...",
            streaming: "Receiving response...",
            almost_done: "Almost done...",
            timeout_warning: "Still working on your request...",
            error: "Something went wrong",
            cancelled: "Request cancelled",
            complete: "Done"
        };

        this.init();
    }

    init() {
        this.createLoadingElements();
        this.bindEvents();
        this.initConnectionMonitor();
    }

    createLoadingElements() {
        const container = document.querySelector(this.options.containerSelector);
        if (!container) {
            console.warn('Loading container not found:', this.options.containerSelector);
            return;
        }

        // Create loading overlay if it doesn't exist
        if (!container.querySelector('.loading-overlay')) {
            const loadingHTML = `
                <div class="loading-overlay" aria-live="polite" aria-atomic="true">
                    <div class="loading-content">
                        <!-- Connection Indicator -->
                        <div class="connection-indicator" aria-label="Connection status">
                            <div class="connection-dot"></div>
                            <span class="connection-text">Connected</span>
                        </div>

                        <!-- Skeleton Loading -->
                        <div class="skeleton-container" style="display: none;">
                            <div class="skeleton-message">
                                <div class="skeleton-avatar"></div>
                                <div class="skeleton-content">
                                    <div class="skeleton-line skeleton-line-1"></div>
                                    <div class="skeleton-line skeleton-line-2"></div>
                                    <div class="skeleton-line skeleton-line-3"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Progress Indicators -->
                        <div class="loading-progress" style="display: none;">
                            <!-- Typing Indicator -->
                            <div class="typing-indicator">
                                <span class="typing-dot"></span>
                                <span class="typing-dot"></span>
                                <span class="typing-dot"></span>
                            </div>

                            <!-- Progress Bar -->
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill"></div>
                                </div>
                                <div class="progress-text">
                                    <span class="progress-percentage">0%</span>
                                    <span class="progress-eta"></span>
                                </div>
                            </div>

                            <!-- Token Counter (for streaming) -->
                            <div class="token-counter" style="display: none;">
                                <span class="token-count">0</span> tokens generated
                            </div>
                        </div>

                        <!-- Status Messages -->
                        <div class="loading-status">
                            <span class="status-text">Ready</span>
                        </div>

                        <!-- Cancel Button -->
                        <button class="cancel-button" type="button" style="display: none;" 
                                aria-label="Cancel current request">
                            <span class="cancel-icon">✖</span>
                            Cancel Request
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', loadingHTML);
        }
    }

    bindEvents() {
        const cancelBtn = document.querySelector(this.options.cancelSelector);
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelRequest());
        }

        // Listen for reduced motion preference
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            mediaQuery.addListener(() => this.updateAnimations());
            this.updateAnimations();
        }
    }

    initConnectionMonitor() {
        // Monitor connection health based on response times
        this.connectionMetrics = {
            responseTimings: [],
            lastPingTime: Date.now(),
            pingInterval: null
        };

        // Start connection health monitoring
        this.startConnectionHealthCheck();
    }

    startConnectionHealthCheck() {
        if (this.connectionMetrics.pingInterval) {
            clearInterval(this.connectionMetrics.pingInterval);
        }

        this.connectionMetrics.pingInterval = setInterval(() => {
            this.pingConnection();
        }, 10000); // Check every 10 seconds
    }

    async pingConnection() {
        const startTime = Date.now();
        try {
            // Simple connectivity test - adjust endpoint as needed
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('/api/health', {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeout);

            const responseTime = Date.now() - startTime;
            this.updateConnectionHealth(responseTime, response.ok);
        } catch (error) {
            this.updateConnectionHealth(5000, false);
        }
    }

    updateConnectionHealth(responseTime, success) {
        this.connectionMetrics.responseTimings.push(responseTime);
        if (this.connectionMetrics.responseTimings.length > 10) {
            this.connectionMetrics.responseTimings.shift();
        }

        const avgResponseTime = this.connectionMetrics.responseTimings.reduce((a, b) => a + b, 0) 
                                / this.connectionMetrics.responseTimings.length;

        let newHealth;
        if (!success || avgResponseTime > 3000) {
            newHealth = 'poor';
        } else if (avgResponseTime > 1000) {
            newHealth = 'degraded';
        } else {
            newHealth = 'good';
        }

        if (newHealth !== this.state.connectionHealth) {
            this.state.connectionHealth = newHealth;
            this.updateConnectionIndicator();
        }
    }

    updateConnectionIndicator() {
        const indicator = document.querySelector(this.options.connectionSelector);
        if (!indicator) return;

        const dot = indicator.querySelector('.connection-dot');
        const text = indicator.querySelector('.connection-text');

        if (dot && text) {
            // Remove existing health classes
            dot.className = 'connection-dot';
            
            // Add current health class
            dot.classList.add(`connection-${this.state.connectionHealth}`);

            // Update text
            const statusTexts = {
                good: 'Connected',
                degraded: 'Slow Connection',
                poor: 'Connection Issues'
            };
            text.textContent = statusTexts[this.state.connectionHealth];

            // Update aria-label
            indicator.setAttribute('aria-label', `Connection status: ${statusTexts[this.state.connectionHealth]}`);
        }
    }

    startLoading(options = {}) {
        this.state.isLoading = true;
        this.state.startTime = Date.now();
        this.state.requestId = options.requestId || Date.now().toString();
        this.state.cancelCallback = options.onCancel || null;
        this.state.timeoutWarningShown = false;

        this.showLoadingOverlay();
        this.updateStatus('connecting');
        this.startProgressSimulation();
        this.startTimeoutWarning();

        // Show skeleton loading initially
        if (options.showSkeleton !== false) {
            this.showSkeletonLoading();
        }

        return this.state.requestId;
    }

    updateProgress(progress, options = {}) {
        if (!this.state.isLoading) return;

        this.state.progress = Math.min(100, Math.max(0, progress));
        
        const progressFill = document.querySelector('.progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');
        
        if (progressFill) {
            progressFill.style.width = `${this.state.progress}%`;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(this.state.progress)}%`;
        }

        // Update ETA if provided
        if (options.eta) {
            const etaElement = document.querySelector('.progress-eta');
            if (etaElement) {
                etaElement.textContent = `~${options.eta}s remaining`;
            }
        }

        // Update status based on progress
        if (progress >= 90) {
            this.updateStatus('almost_done');
        } else if (progress >= 50) {
            this.updateStatus('generating');
        } else if (progress >= 20) {
            this.updateStatus('thinking');
        }
    }

    updateStatus(status, customMessage = null) {
        this.state.status = status;
        const statusElement = document.querySelector('.status-text');
        
        if (statusElement) {
            const message = customMessage || this.statusMessages[status] || status;
            statusElement.textContent = message;
        }

        // Show/hide appropriate loading elements
        if (status === 'streaming') {
            this.showTokenCounter();
            this.hideSkeletonLoading();
        } else if (status === 'generating') {
            this.hideSkeletonLoading();
            this.showProgressBar();
        }
    }

    updateTokenCount(count) {
        const tokenCounter = document.querySelector('.token-count');
        if (tokenCounter) {
            tokenCounter.textContent = count.toLocaleString();
        }
        this.showTokenCounter();
    }

    showLoadingOverlay() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.setAttribute('aria-hidden', 'false');
        }
    }

    hideLoadingOverlay() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
        }
    }

    showSkeletonLoading() {
        const skeleton = document.querySelector('.skeleton-container');
        const progress = document.querySelector('.loading-progress');
        
        if (skeleton) skeleton.style.display = 'block';
        if (progress) progress.style.display = 'none';
    }

    hideSkeletonLoading() {
        const skeleton = document.querySelector('.skeleton-container');
        const progress = document.querySelector('.loading-progress');
        
        if (skeleton) skeleton.style.display = 'none';
        if (progress) progress.style.display = 'block';
    }

    showProgressBar() {
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
    }

    showTokenCounter() {
        const tokenCounter = document.querySelector('.token-counter');
        if (tokenCounter) {
            tokenCounter.style.display = 'block';
        }
    }

    showCancelButton() {
        const cancelBtn = document.querySelector('.cancel-button');
        if (cancelBtn && this.state.cancelCallback) {
            cancelBtn.style.display = 'inline-flex';
        }
    }

    hideCancelButton() {
        const cancelBtn = document.querySelector('.cancel-button');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
    }

    startProgressSimulation() {
        // Simulate realistic progress for better UX
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
            if (!this.state.isLoading) {
                clearInterval(progressInterval);
                return;
            }

            // Slow down progress as it gets higher (realistic behavior)
            const increment = simulatedProgress < 30 ? 2 : simulatedProgress < 70 ? 1 : 0.5;
            simulatedProgress += increment;

            if (simulatedProgress < 95) { // Don't complete until actually done
                this.updateProgress(simulatedProgress);
            }
        }, 200);

        // Store interval for cleanup
        this.progressInterval = progressInterval;
    }

    startTimeoutWarning() {
        this.timeoutWarningTimeout = setTimeout(() => {
            if (this.state.isLoading && !this.state.timeoutWarningShown) {
                this.updateStatus('timeout_warning');
                this.state.timeoutWarningShown = true;
                this.showCancelButton();
            }
        }, this.options.timeoutWarning);
    }

    cancelRequest() {
        if (this.state.cancelCallback) {
            this.state.cancelCallback(this.state.requestId);
        }
        this.stopLoading('cancelled');
    }

    stopLoading(status = 'complete') {
        this.state.isLoading = false;
        
        // Clear timeouts and intervals
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        if (this.timeoutWarningTimeout) {
            clearTimeout(this.timeoutWarningTimeout);
        }

        // Complete the progress bar
        if (status === 'complete') {
            this.updateProgress(100);
            this.updateStatus('complete', 'Response received');
            
            // Hide loading after brief delay
            setTimeout(() => {
                this.hideLoadingOverlay();
            }, 1000);
        } else {
            this.updateStatus(status);
            setTimeout(() => {
                this.hideLoadingOverlay();
            }, 2000);
        }

        this.hideCancelButton();
    }

    updateAnimations() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.body.classList.toggle('reduce-motion', prefersReducedMotion);
    }

    // Public API methods
    startRequest(options = {}) {
        return this.startLoading(options);
    }

    updateRequestProgress(progress, eta = null) {
        this.updateProgress(progress, { eta });
    }

    setRequestStatus(status, customMessage = null) {
        this.updateStatus(status, customMessage);
    }

    setStreamingTokens(count) {
        this.updateTokenCount(count);
    }

    completeRequest() {
        this.stopLoading('complete');
    }

    failRequest(errorMessage = null) {
        this.updateStatus('error', errorMessage);
        this.stopLoading('error');
    }

    destroy() {
        // Clean up intervals and timeouts
        if (this.connectionMetrics.pingInterval) {
            clearInterval(this.connectionMetrics.pingInterval);
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        if (this.timeoutWarningTimeout) {
            clearTimeout(this.timeoutWarningTimeout);
        }

        // Remove event listeners
        const cancelBtn = document.querySelector(this.options.cancelSelector);
        if (cancelBtn) {
            cancelBtn.removeEventListener('click', () => this.cancelRequest());
        }
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingStateManager;
}

// Global access for direct script usage (browser)
if (typeof window !== 'undefined') {
    window.LoadingStateManager = LoadingStateManager;
}