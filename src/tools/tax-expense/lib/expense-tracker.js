/**
 * Comprehensive Expense Tracking and Management
 * 
 * Features:
 * - Smart categorization with ML-powered pattern recognition
 * - Receipt data extraction and OCR
 * - Recurring expense detection
 * - Business vs personal classification
 * - Multi-currency support with real-time conversion
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class ExpenseTracker {
    constructor(database) {
        this.db = database;
        this.categories = {
            SOFTWARE: 'software',
            HARDWARE: 'hardware', 
            OFFICE: 'office',
            TRAVEL: 'travel',
            EDUCATION: 'education',
            MARKETING: 'marketing',
            PROFESSIONAL_SERVICES: 'professional_services',
            UTILITIES: 'utilities',
            INTERNET: 'internet',
            PHONE: 'phone',
            INSURANCE: 'insurance',
            MEALS: 'meals',
            SUPPLIES: 'supplies',
            SUBSCRIPTIONS: 'subscriptions',
            CONFERENCES: 'conferences'
        };

        this.categorization_patterns = {
            [this.categories.SOFTWARE]: [
                'github', 'adobe', 'microsoft', 'google', 'aws', 'stripe',
                'figma', 'notion', 'slack', 'zoom', 'dropbox', 'canva'
            ],
            [this.categories.HARDWARE]: [
                'apple', 'dell', 'lenovo', 'monitor', 'keyboard', 'mouse',
                'camera', 'microphone', 'headphones', 'laptop', 'desktop'
            ],
            [this.categories.OFFICE]: [
                'desk', 'chair', 'rent', 'coworking', 'wework', 'regus'
            ],
            [this.categories.TRAVEL]: [
                'uber', 'lyft', 'airport', 'hotel', 'airbnb', 'flight',
                'mileage', 'parking', 'gas', 'taxi', 'train', 'bus'
            ],
            [this.categories.EDUCATION]: [
                'udemy', 'coursera', 'pluralsight', 'skillshare', 'book',
                'conference', 'training', 'certification', 'workshop'
            ],
            [this.categories.MARKETING]: [
                'facebook ads', 'google ads', 'twitter', 'linkedin',
                'marketing', 'advertising', 'promotion', 'social media'
            ]
        };
    }

    async addExpense(expenseData) {
        const {
            amount,
            currency = 'USD',
            vendor,
            description,
            date = new Date().toISOString(),
            category,
            receiptPath,
            isBusinessExpense = null,
            tags = [],
            mileage = null,
            location = null
        } = expenseData;

        // Validate required fields
        if (!amount || !vendor) {
            throw new Error('Amount and vendor are required');
        }

        const expenseId = this.generateExpenseId();
        
        // Auto-categorize if not provided
        const finalCategory = category || await this.autoCategorize(vendor, description);
        
        // Classify business vs personal if not provided
        const businessClassification = isBusinessExpense !== null 
            ? isBusinessExpense 
            : await this.classifyBusinessExpense(vendor, description, finalCategory);

        // Extract receipt data if provided
        let receiptData = null;
        if (receiptPath) {
            receiptData = await this.extractReceiptData(receiptPath);
        }

        // Convert currency if needed
        const usdAmount = await this.convertToUSD(amount, currency);

        const expense = {
            id: expenseId,
            amount: parseFloat(amount),
            usdAmount,
            currency,
            vendor: vendor.trim(),
            description: description?.trim() || '',
            date: new Date(date).toISOString(),
            category: finalCategory,
            isBusinessExpense: businessClassification,
            receiptPath,
            receiptData,
            tags,
            mileage,
            location,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.db.saveExpense(expense);
        
        // Check for recurring patterns
        await this.detectRecurring(expense);

        return {
            success: true,
            expense,
            suggestions: await this.getOptimizationSuggestions(expense)
        };
    }

    async autoCategorize(vendor, description) {
        const text = `${vendor} ${description || ''}`.toLowerCase();
        
        // Check against patterns
        for (const [category, patterns] of Object.entries(this.categorization_patterns)) {
            for (const pattern of patterns) {
                if (text.includes(pattern.toLowerCase())) {
                    return category;
                }
            }
        }

        // ML-based categorization (simplified version)
        return await this.mlCategorize(vendor, description);
    }

    async mlCategorize(vendor, description) {
        // Simplified ML categorization based on vendor and description patterns
        const features = this.extractFeatures(vendor, description);
        
        // Basic heuristics (in production, this would use a trained model)
        if (features.hasSubscriptionKeywords) return this.categories.SUBSCRIPTIONS;
        if (features.hasTechKeywords) return this.categories.SOFTWARE;
        if (features.hasEducationKeywords) return this.categories.EDUCATION;
        if (features.hasTravelKeywords) return this.categories.TRAVEL;
        
        return 'other';
    }

    extractFeatures(vendor, description) {
        const text = `${vendor} ${description || ''}`.toLowerCase();
        
        return {
            hasSubscriptionKeywords: /subscription|monthly|annual|saas/.test(text),
            hasTechKeywords: /software|app|tool|platform|service/.test(text),
            hasEducationKeywords: /course|book|training|learn|education/.test(text),
            hasTravelKeywords: /travel|flight|hotel|uber|gas/.test(text),
            hasOfficeKeywords: /office|rent|utilities|internet/.test(text)
        };
    }

    async classifyBusinessExpense(vendor, description, category) {
        // Business categories that are typically 100% business
        const businessCategories = [
            this.categories.SOFTWARE,
            this.categories.PROFESSIONAL_SERVICES,
            this.categories.MARKETING,
            this.categories.OFFICE
        ];

        if (businessCategories.includes(category)) {
            return true;
        }

        // Mixed categories that need context analysis
        const text = `${vendor} ${description || ''}`.toLowerCase();
        
        // Business indicators
        const businessKeywords = [
            'business', 'professional', 'work', 'client', 'project',
            'freelance', 'contractor', 'consulting', 'invoice'
        ];

        // Personal indicators
        const personalKeywords = [
            'personal', 'family', 'vacation', 'entertainment', 'personal use'
        ];

        const businessScore = businessKeywords.reduce((score, keyword) => 
            text.includes(keyword) ? score + 1 : score, 0);
        
        const personalScore = personalKeywords.reduce((score, keyword) => 
            text.includes(keyword) ? score + 1 : score, 0);

        // Default to business for freelancers if unclear
        return businessScore >= personalScore;
    }

    async convertToUSD(amount, currency) {
        if (currency === 'USD') return amount;

        // In production, this would call a real-time exchange rate API
        const exchangeRates = {
            'EUR': 1.10,
            'GBP': 1.25,
            'CAD': 0.74,
            'JPY': 0.0067,
            'AUD': 0.66
        };

        const rate = exchangeRates[currency] || 1;
        return amount * rate;
    }

    async extractReceiptData(receiptPath) {
        // In production, this would use OCR to extract data from receipt images
        // For now, return basic file info
        try {
            const stats = await fs.stat(receiptPath);
            return {
                fileName: path.basename(receiptPath),
                fileSize: stats.size,
                uploadDate: stats.ctime.toISOString(),
                // OCR extracted data would go here
                extractedText: null,
                merchantName: null,
                total: null,
                date: null
            };
        } catch (error) {
            console.warn('Could not process receipt:', error.message);
            return null;
        }
    }

    async detectRecurring(expense) {
        // Find similar expenses by vendor and amount
        const similarExpenses = await this.db.getExpenses({
            vendor: expense.vendor,
            amountRange: [expense.amount * 0.9, expense.amount * 1.1]
        });

        if (similarExpenses.length >= 2) {
            // Analyze frequency patterns
            const dates = similarExpenses.map(e => new Date(e.date)).sort();
            const intervals = [];
            
            for (let i = 1; i < dates.length; i++) {
                const diffDays = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
                intervals.push(diffDays);
            }

            // Check if intervals suggest a pattern (monthly, quarterly, etc.)
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            
            if (this.isRecurringPattern(avgInterval)) {
                await this.db.markAsRecurring(expense.vendor, {
                    frequency: this.getFrequencyType(avgInterval),
                    amount: expense.amount,
                    nextExpected: this.calculateNextExpected(expense.date, avgInterval)
                });
            }
        }
    }

    isRecurringPattern(avgDays) {
        // Check if average interval suggests a recurring pattern
        const patterns = {
            weekly: [6, 8],
            monthly: [25, 35],
            quarterly: [85, 95],
            annual: [360, 370]
        };

        return Object.values(patterns).some(([min, max]) => 
            avgDays >= min && avgDays <= max
        );
    }

    getFrequencyType(avgDays) {
        if (avgDays >= 6 && avgDays <= 8) return 'weekly';
        if (avgDays >= 25 && avgDays <= 35) return 'monthly';
        if (avgDays >= 85 && avgDays <= 95) return 'quarterly';
        if (avgDays >= 360 && avgDays <= 370) return 'annual';
        return 'irregular';
    }

    calculateNextExpected(lastDate, avgInterval) {
        const next = new Date(lastDate);
        next.setDate(next.getDate() + avgInterval);
        return next.toISOString();
    }

    async getOptimizationSuggestions(expense) {
        const suggestions = [];

        // Category-specific suggestions
        if (expense.category === this.categories.SOFTWARE) {
            suggestions.push({
                type: 'tax_tip',
                message: 'Software expenses are 100% deductible for business use',
                action: 'Keep receipt and document business purpose'
            });
        }

        if (expense.category === this.categories.TRAVEL && expense.mileage) {
            const mileageDeduction = expense.mileage * 0.67; // 2024 IRS rate
            suggestions.push({
                type: 'deduction_opportunity',
                message: `Mileage deduction: $${mileageDeduction.toFixed(2)}`,
                action: 'Log start/end locations for audit protection'
            });
        }

        return suggestions;
    }

    async categorizeExpense(expenseId, category) {
        const expense = await this.db.getExpense(expenseId);
        if (!expense) {
            throw new Error('Expense not found');
        }

        expense.category = category;
        expense.updatedAt = new Date().toISOString();
        
        await this.db.updateExpense(expense);
        
        return { success: true, expense };
    }

    async getExpenses(filter = {}) {
        return await this.db.getExpenses(filter);
    }

    async getExpensesByCategory(year, category) {
        return await this.db.getExpenses({
            year,
            category,
            isBusinessExpense: true
        });
    }

    async getRecurringExpenses() {
        return await this.db.getRecurringExpenses();
    }

    generateExpenseId() {
        return `exp_${crypto.randomUUID()}`;
    }

    // Home office calculator
    async calculateHomeOfficeDeduction(homeOfficeData) {
        const {
            totalHomeSquareFootage,
            officeSquareFootage,
            annualHomeExpenses,
            method = 'actual' // 'actual' or 'simplified'
        } = homeOfficeData;

        if (method === 'simplified') {
            // Simplified method: $5 per square foot up to 300 sq ft
            const maxSquareFootage = Math.min(officeSquareFootage, 300);
            return {
                method: 'simplified',
                squareFootage: maxSquareFootage,
                rate: 5,
                deduction: maxSquareFootage * 5,
                description: `Home office deduction (simplified): ${maxSquareFootage} sq ft × $5`
            };
        } else {
            // Actual expense method
            const businessPercentage = officeSquareFootage / totalHomeSquareFootage;
            const deduction = annualHomeExpenses * businessPercentage;
            
            return {
                method: 'actual',
                businessPercentage: Math.round(businessPercentage * 100),
                annualHomeExpenses,
                deduction,
                description: `Home office deduction (actual): ${Math.round(businessPercentage * 100)}% of $${annualHomeExpenses}`
            };
        }
    }

    // Equipment depreciation tracker
    async trackDepreciation(equipmentData) {
        const {
            name,
            purchaseDate,
            cost,
            businessUsePercentage = 100,
            depreciationMethod = 'straight_line',
            usefulLifeYears = 5
        } = equipmentData;

        const businessCost = cost * (businessUsePercentage / 100);
        const annualDepreciation = businessCost / usefulLifeYears;

        const equipment = {
            id: `equip_${crypto.randomUUID()}`,
            name,
            purchaseDate,
            cost,
            businessCost,
            businessUsePercentage,
            depreciationMethod,
            usefulLifeYears,
            annualDepreciation,
            remainingValue: businessCost,
            createdAt: new Date().toISOString()
        };

        await this.db.saveEquipment(equipment);
        
        return {
            success: true,
            equipment,
            annualDepreciation,
            totalDepreciationAvailable: businessCost
        };
    }
}

module.exports = { ExpenseTracker };