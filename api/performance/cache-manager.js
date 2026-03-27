/**
 * Cache Manager for Cortex Freelancer
 * High-performance caching with Redis-style operations using memory/file system
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CacheManager {
    constructor(options = {}) {
        this.cacheDir = options.cacheDir || path.join(__dirname, '../../cache');
        this.memoryCache = new Map();
        this.defaultTTL = options.defaultTTL || 3600; // 1 hour
        this.maxMemoryItems = options.maxMemoryItems || 1000;
        this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
        
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            this.startCleanupTimer();
            console.log('🚀 Cache Manager initialized');
        } catch (error) {
            console.error('❌ Cache Manager initialization failed:', error);
        }
    }

    /**
     * Get cached value with fallback to disk
     */
    async get(key) {
        try {
            // Check memory cache first
            if (this.memoryCache.has(key)) {
                const item = this.memoryCache.get(key);
                
                if (!this.isExpired(item)) {
                    return item.value;
                } else {
                    this.memoryCache.delete(key);
                }
            }

            // Check disk cache
            const diskItem = await this.getDiskCache(key);
            if (diskItem && !this.isExpired(diskItem)) {
                // Promote to memory cache if there's space
                if (this.memoryCache.size < this.maxMemoryItems) {
                    this.memoryCache.set(key, diskItem);
                }
                return diskItem.value;
            }

            return null;
        } catch (error) {
            console.error('❌ Cache get error:', error);
            return null;
        }
    }

    /**
     * Set cached value in both memory and disk
     */
    async set(key, value, ttl = null) {
        try {
            const expiresAt = Date.now() + ((ttl || this.defaultTTL) * 1000);
            const item = {
                value,
                expiresAt,
                createdAt: Date.now()
            };

            // Set in memory cache
            this.memoryCache.set(key, item);

            // Enforce memory limits
            if (this.memoryCache.size > this.maxMemoryItems) {
                this.evictOldest();
            }

            // Set in disk cache
            await this.setDiskCache(key, item);

            return true;
        } catch (error) {
            console.error('❌ Cache set error:', error);
            return false;
        }
    }

    /**
     * Delete cached value
     */
    async delete(key) {
        try {
            this.memoryCache.delete(key);
            await this.deleteDiskCache(key);
            return true;
        } catch (error) {
            console.error('❌ Cache delete error:', error);
            return false;
        }
    }

    /**
     * Get or set pattern - fetch from cache or compute and cache
     */
    async getOrSet(key, computeFunction, ttl = null) {
        try {
            let value = await this.get(key);
            
            if (value === null) {
                value = await computeFunction();
                await this.set(key, value, ttl);
            }
            
            return value;
        } catch (error) {
            console.error('❌ Cache getOrSet error:', error);
            return await computeFunction();
        }
    }

    /**
     * Cache with refresh-ahead pattern
     */
    async getWithRefresh(key, computeFunction, ttl = null, refreshThreshold = 0.8) {
        try {
            const cached = await this.getCachedItem(key);
            
            if (cached) {
                const age = Date.now() - cached.createdAt;
                const maxAge = (ttl || this.defaultTTL) * 1000;
                
                // If cache is getting stale, refresh in background
                if (age > maxAge * refreshThreshold) {
                    setImmediate(async () => {
                        try {
                            const freshValue = await computeFunction();
                            await this.set(key, freshValue, ttl);
                        } catch (error) {
                            console.error('❌ Background refresh failed:', error);
                        }
                    });
                }
                
                return cached.value;
            }

            // Not cached, compute and cache
            const value = await computeFunction();
            await this.set(key, value, ttl);
            return value;
        } catch (error) {
            console.error('❌ Cache getWithRefresh error:', error);
            return await computeFunction();
        }
    }

    /**
     * Batch operations
     */
    async mget(keys) {
        const results = {};
        
        await Promise.all(keys.map(async (key) => {
            results[key] = await this.get(key);
        }));
        
        return results;
    }

    async mset(keyValuePairs, ttl = null) {
        const promises = Object.entries(keyValuePairs).map(([key, value]) => 
            this.set(key, value, ttl)
        );
        
        const results = await Promise.all(promises);
        return results.every(result => result === true);
    }

    /**
     * Clear all cache
     */
    async clear() {
        try {
            this.memoryCache.clear();
            
            const files = await fs.readdir(this.cacheDir);
            await Promise.all(
                files.map(file => fs.unlink(path.join(this.cacheDir, file)))
            );
            
            return true;
        } catch (error) {
            console.error('❌ Cache clear error:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            memoryItems: this.memoryCache.size,
            maxMemoryItems: this.maxMemoryItems,
            memoryUtilization: (this.memoryCache.size / this.maxMemoryItems * 100).toFixed(1) + '%',
            cleanupInterval: this.cleanupInterval,
            defaultTTL: this.defaultTTL
        };
    }

    /**
     * Cache warming - preload frequently accessed data
     */
    async warm(warmupConfig) {
        console.log('🔥 Starting cache warm-up...');
        
        const promises = warmupConfig.map(async (config) => {
            try {
                const { key, computeFunction, ttl } = config;
                await this.getOrSet(key, computeFunction, ttl);
                console.log(`✅ Warmed cache key: ${key}`);
            } catch (error) {
                console.error(`❌ Failed to warm cache key: ${config.key}`, error);
            }
        });
        
        await Promise.all(promises);
        console.log('🔥 Cache warm-up complete');
    }

    // Internal methods

    async getCachedItem(key) {
        // Check memory first
        if (this.memoryCache.has(key)) {
            const item = this.memoryCache.get(key);
            return !this.isExpired(item) ? item : null;
        }

        // Check disk
        const diskItem = await this.getDiskCache(key);
        return diskItem && !this.isExpired(diskItem) ? diskItem : null;
    }

    async getDiskCache(key) {
        try {
            const filePath = this.getFilePath(key);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    async setDiskCache(key, item) {
        try {
            const filePath = this.getFilePath(key);
            await fs.writeFile(filePath, JSON.stringify(item), 'utf8');
        } catch (error) {
            console.error('❌ Disk cache write error:', error);
        }
    }

    async deleteDiskCache(key) {
        try {
            const filePath = this.getFilePath(key);
            await fs.unlink(filePath);
        } catch (error) {
            // Ignore if file doesn't exist
        }
    }

    getFilePath(key) {
        const hash = crypto.createHash('sha256').update(key).digest('hex');
        return path.join(this.cacheDir, `${hash}.json`);
    }

    isExpired(item) {
        return Date.now() > item.expiresAt;
    }

    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.memoryCache.entries()) {
            if (item.createdAt < oldestTime) {
                oldestTime = item.createdAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.memoryCache.delete(oldestKey);
        }
    }

    startCleanupTimer() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    async cleanup() {
        try {
            // Clean memory cache
            const now = Date.now();
            const expiredKeys = [];

            for (const [key, item] of this.memoryCache.entries()) {
                if (now > item.expiresAt) {
                    expiredKeys.push(key);
                }
            }

            expiredKeys.forEach(key => this.memoryCache.delete(key));

            // Clean disk cache
            const files = await fs.readdir(this.cacheDir);
            const cleanupPromises = files.map(async (file) => {
                try {
                    const filePath = path.join(this.cacheDir, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const item = JSON.parse(data);
                    
                    if (now > item.expiresAt) {
                        await fs.unlink(filePath);
                    }
                } catch (error) {
                    // Remove corrupted files
                    try {
                        await fs.unlink(path.join(this.cacheDir, file));
                    } catch (e) {}
                }
            });

            await Promise.all(cleanupPromises);

            if (expiredKeys.length > 0) {
                console.log(`🧹 Cleaned ${expiredKeys.length} expired cache entries`);
            }
        } catch (error) {
            console.error('❌ Cache cleanup error:', error);
        }
    }
}

// Specialized cache instances
class JobsCache extends CacheManager {
    constructor() {
        super({
            cacheDir: path.join(__dirname, '../../cache/jobs'),
            defaultTTL: 1800, // 30 minutes
            maxMemoryItems: 500
        });
    }

    async cacheJobSearchResults(query, results, platform = 'all') {
        const key = `jobs:${platform}:${this.hashQuery(query)}`;
        await this.set(key, results, 1800); // 30 minutes
        return key;
    }

    async getCachedJobSearch(query, platform = 'all') {
        const key = `jobs:${platform}:${this.hashQuery(query)}`;
        return await this.get(key);
    }

    hashQuery(query) {
        return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
    }
}

class UserCache extends CacheManager {
    constructor() {
        super({
            cacheDir: path.join(__dirname, '../../cache/users'),
            defaultTTL: 7200, // 2 hours
            maxMemoryItems: 200
        });
    }

    async cacheUserProfile(userId, profile) {
        await this.set(`user:${userId}:profile`, profile, 7200);
    }

    async getCachedUserProfile(userId) {
        return await this.get(`user:${userId}:profile`);
    }

    async cacheUserPreferences(userId, preferences) {
        await this.set(`user:${userId}:preferences`, preferences, 86400); // 24 hours
    }

    async getCachedUserPreferences(userId) {
        return await this.get(`user:${userId}:preferences`);
    }
}

class AnalyticsCache extends CacheManager {
    constructor() {
        super({
            cacheDir: path.join(__dirname, '../../cache/analytics'),
            defaultTTL: 600, // 10 minutes
            maxMemoryItems: 100
        });
    }

    async cacheDashboardMetrics(timeRange, metrics) {
        const key = `dashboard:${timeRange}:${Date.now().toString().slice(-6)}`; // Cache key with time component
        await this.set(key, metrics, 600);
        return key;
    }

    async getCachedDashboardMetrics(timeRange) {
        // Get most recent cache for this time range
        const pattern = `dashboard:${timeRange}:`;
        // Simple implementation - in production would use more sophisticated pattern matching
        return null; // Implementation would search for most recent matching key
    }
}

module.exports = {
    CacheManager,
    JobsCache,
    UserCache,
    AnalyticsCache
};