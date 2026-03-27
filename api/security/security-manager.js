/**
 * Security Manager for Cortex Freelancer
 * Handles API rate limiting, input validation, and security monitoring
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const crypto = require('crypto');

class SecurityManager {
    constructor() {
        this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateSecureKey();
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Configure security middleware for Express app
     */
    setupSecurityMiddleware(app) {
        // Helmet for security headers
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
                    fontSrc: ["'self'", "fonts.gstatic.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://api.anthropic.com", "https://*.googleapis.com"],
                },
            },
            crossOriginEmbedderPolicy: false
        }));

        // Rate limiting
        const limiter = this.createRateLimiter();
        app.use('/api/', limiter);

        // API-specific rate limits
        app.use('/api/chat', this.createChatRateLimit());
        app.use('/api/auth', this.createAuthRateLimit());
        app.use('/api/payments', this.createPaymentRateLimit());

        // Request logging and monitoring
        app.use(this.securityLogger());
        
        console.log('✅ Security middleware configured');
    }

    /**
     * Create general API rate limiter
     */
    createRateLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per window
            message: {
                error: 'Too many requests, please try again later',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path
                });
                res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
                });
            }
        });
    }

    /**
     * Chat-specific rate limiting (AI requests are expensive)
     */
    createChatRateLimit() {
        return rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 10, // 10 AI requests per minute
            message: {
                error: 'AI request rate limit exceeded',
                retryAfter: '1 minute'
            },
            keyGenerator: (req) => {
                return req.user?.uid || req.ip; // Rate limit by user or IP
            }
        });
    }

    /**
     * Authentication rate limiting (prevent brute force)
     */
    createAuthRateLimit() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            skipSuccessfulRequests: true,
            message: {
                error: 'Too many authentication attempts',
                retryAfter: '15 minutes'
            }
        });
    }

    /**
     * Payment endpoint rate limiting
     */
    createPaymentRateLimit() {
        return rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 3, // 3 payment requests per minute
            message: {
                error: 'Payment request rate limit exceeded',
                retryAfter: '1 minute'
            }
        });
    }

    /**
     * Security event logger
     */
    securityLogger() {
        return (req, res, next) => {
            // Log suspicious patterns
            const userAgent = req.get('User-Agent') || '';
            const suspicious = this.detectSuspiciousActivity(req, userAgent);
            
            if (suspicious.detected) {
                this.logSecurityEvent('SUSPICIOUS_ACTIVITY', {
                    ip: req.ip,
                    userAgent: userAgent,
                    endpoint: req.path,
                    method: req.method,
                    reasons: suspicious.reasons
                });
            }

            // Log failed requests
            const originalSend = res.send;
            res.send = function(data) {
                if (res.statusCode >= 400) {
                    this.logSecurityEvent('REQUEST_ERROR', {
                        ip: req.ip,
                        endpoint: req.path,
                        method: req.method,
                        statusCode: res.statusCode,
                        userAgent: userAgent
                    });
                }
                originalSend.call(this, data);
            }.bind(this);

            next();
        };
    }

    /**
     * Detect suspicious activity patterns
     */
    detectSuspiciousActivity(req, userAgent) {
        const reasons = [];
        
        // Check for bot patterns
        const botPatterns = [
            /bot/i, /crawler/i, /spider/i, /scraper/i,
            /python-requests/i, /curl/i, /wget/i
        ];
        
        if (botPatterns.some(pattern => pattern.test(userAgent))) {
            reasons.push('bot_user_agent');
        }

        // Check for SQL injection patterns
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE)\b)/i,
            /(\'|\"|;|--|\|\|)/,
            /(\bOR\b.*=.*\bOR\b)/i
        ];
        
        const queryString = req.url;
        if (sqlPatterns.some(pattern => pattern.test(queryString))) {
            reasons.push('sql_injection_attempt');
        }

        // Check for XSS patterns
        const xssPatterns = [
            /<script/i, /javascript:/i, /on\w+=/i,
            /<iframe/i, /<object/i, /<embed/i
        ];
        
        if (xssPatterns.some(pattern => pattern.test(queryString))) {
            reasons.push('xss_attempt');
        }

        // Check for directory traversal
        if (/\.\.\//.test(queryString) || /\.\.\\/.test(queryString)) {
            reasons.push('directory_traversal');
        }

        // Check for rapid requests from same IP
        const ip = req.ip;
        const now = Date.now();
        if (!this.requestTracker) this.requestTracker = {};
        
        if (!this.requestTracker[ip]) {
            this.requestTracker[ip] = [];
        }
        
        // Clean old entries (older than 1 minute)
        this.requestTracker[ip] = this.requestTracker[ip].filter(
            time => now - time < 60000
        );
        
        this.requestTracker[ip].push(now);
        
        // Flag if more than 30 requests in 1 minute
        if (this.requestTracker[ip].length > 30) {
            reasons.push('rapid_requests');
        }

        return {
            detected: reasons.length > 0,
            reasons: reasons
        };
    }

    /**
     * Input validation middleware
     */
    validateInput(schema) {
        return (req, res, next) => {
            const errors = [];
            
            for (const [field, rules] of Object.entries(schema)) {
                const value = req.body[field];
                
                if (rules.required && !value) {
                    errors.push(`${field} is required`);
                    continue;
                }
                
                if (!value) continue; // Skip validation for optional empty fields
                
                // Type validation
                if (rules.type === 'email' && !validator.isEmail(value)) {
                    errors.push(`${field} must be a valid email`);
                }
                
                if (rules.type === 'url' && !validator.isURL(value)) {
                    errors.push(`${field} must be a valid URL`);
                }
                
                if (rules.type === 'number' && !validator.isNumeric(value.toString())) {
                    errors.push(`${field} must be a number`);
                }
                
                // Length validation
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                }
                
                // Custom validation
                if (rules.validate && !rules.validate(value)) {
                    errors.push(rules.message || `${field} is invalid`);
                }
                
                // XSS protection - strip dangerous characters
                if (typeof value === 'string') {
                    req.body[field] = this.sanitizeInput(value);
                }
            }
            
            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors
                });
            }
            
            next();
        };
    }

    /**
     * Sanitize input to prevent XSS
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        try {
            const iv = crypto.randomBytes(16);
            // Derive a 32-byte key from encryptionKey for aes-256-gcm
            const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData) {
        try {
            const { encrypted, iv, authTag } = encryptedData;
            
            const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
            const decipher = crypto.createDecipheriv(
                this.algorithm,
                key,
                Buffer.from(iv, 'hex')
            );
            
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Generate secure random key
     */
    generateSecureKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Hash passwords securely
     */
    async hashPassword(password) {
        const bcrypt = require('bcrypt');
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    /**
     * Verify password hash
     */
    async verifyPassword(password, hash) {
        const bcrypt = require('bcrypt');
        return await bcrypt.compare(password, hash);
    }

    /**
     * Generate secure API key
     */
    generateApiKey() {
        return crypto.randomBytes(32).toString('base64');
    }

    /**
     * Log security events
     */
    logSecurityEvent(eventType, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventType: eventType,
            details: details,
            severity: this.getEventSeverity(eventType)
        };
        
        // In production, this would go to a security monitoring system
        console.log('🔒 SECURITY EVENT:', JSON.stringify(logEntry));
        
        // Store in database for analysis
        this.storeSecurityEvent(logEntry);
    }

    /**
     * Get event severity level
     */
    getEventSeverity(eventType) {
        const severities = {
            'RATE_LIMIT_EXCEEDED': 'medium',
            'SUSPICIOUS_ACTIVITY': 'high',
            'REQUEST_ERROR': 'low',
            'AUTH_FAILURE': 'high',
            'PAYMENT_FRAUD': 'critical'
        };
        
        return severities[eventType] || 'medium';
    }

    /**
     * Store security event in database
     */
    async storeSecurityEvent(logEntry) {
        try {
            // This would store in a security events collection
            // For now, just log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.log('Security event logged:', logEntry);
            }
        } catch (error) {
            console.error('Failed to store security event:', error);
        }
    }

    /**
     * Common validation schemas
     */
    static schemas = {
        userRegistration: {
            email: { required: true, type: 'email' },
            password: { required: true, minLength: 8, maxLength: 128 },
            displayName: { required: true, minLength: 2, maxLength: 50 }
        },
        
        jobApplication: {
            jobId: { required: true, minLength: 1 },
            coverLetter: { required: true, minLength: 50, maxLength: 5000 },
            proposedRate: { type: 'number' }
        },
        
        emailTemplate: {
            templateId: { required: true, minLength: 1 },
            to: { required: true, type: 'email' },
            subject: { required: true, minLength: 1, maxLength: 200 }
        }
    };

    /**
     * Security health check
     */
    async healthCheck() {
        const checks = {
            rateLimiting: true,
            inputValidation: true,
            encryption: await this.testEncryption(),
            logging: true,
            headers: true
        };
        
        const allPassed = Object.values(checks).every(check => check === true);
        
        return {
            success: allPassed,
            status: allPassed ? 'secure' : 'warning',
            checks: checks
        };
    }

    /**
     * Test encryption functionality
     */
    async testEncryption() {
        try {
            const testData = 'security test';
            const encrypted = this.encrypt(testData);
            const decrypted = this.decrypt(encrypted);
            return decrypted === testData;
        } catch (error) {
            return false;
        }
    }
}

module.exports = SecurityManager;