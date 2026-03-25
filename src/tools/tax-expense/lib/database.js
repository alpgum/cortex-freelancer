/**
 * Database Manager for Tax & Expense Data
 * 
 * Simple file-based database for storing expense, tax, and financial data
 * In production, this could be replaced with a proper database
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DatabaseManager {
    constructor() {
        this.dataDir = path.join(process.env.HOME || process.cwd(), '.cortex-freelancer', 'tax-expense');
        this.files = {
            expenses: path.join(this.dataDir, 'expenses.json'),
            equipment: path.join(this.dataDir, 'equipment.json'),
            recurring: path.join(this.dataDir, 'recurring.json'),
            homeOffice: path.join(this.dataDir, 'home-office.json'),
            settings: path.join(this.dataDir, 'settings.json')
        };
    }

    async initialize() {
        // Create data directory if it doesn't exist
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            // Directory might already exist, ignore error
        }
        
        // Initialize empty files if they don't exist
        for (const [key, filePath] of Object.entries(this.files)) {
            try {
                await fs.access(filePath);
            } catch (error) {
                // File doesn't exist, create it
                await this.saveData(key, []);
            }
        }
    }

    async saveData(type, data) {
        const filePath = this.files[type];
        if (!filePath) {
            throw new Error(`Unknown data type: ${type}`);
        }
        
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    async loadData(type) {
        const filePath = this.files[type];
        if (!filePath) {
            throw new Error(`Unknown data type: ${type}`);
        }
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.warn(`Could not load ${type} data:`, error.message);
            return [];
        }
    }

    // Expense Management

    async saveExpense(expense) {
        const expenses = await this.loadData('expenses');
        
        // Check if expense already exists (update vs create)
        const existingIndex = expenses.findIndex(e => e.id === expense.id);
        
        if (existingIndex >= 0) {
            expenses[existingIndex] = expense;
        } else {
            expenses.push(expense);
        }
        
        await this.saveData('expenses', expenses);
        return expense;
    }

    async updateExpense(expense) {
        return await this.saveExpense(expense);
    }

    async getExpense(expenseId) {
        const expenses = await this.loadData('expenses');
        return expenses.find(e => e.id === expenseId);
    }

    async getExpenses(filter = {}) {
        const expenses = await this.loadData('expenses');
        
        return expenses.filter(expense => {
            // Filter by year
            if (filter.year) {
                const expenseYear = new Date(expense.date).getFullYear();
                if (expenseYear !== filter.year) return false;
            }
            
            // Filter by month
            if (filter.month) {
                const expenseMonth = new Date(expense.date).getMonth() + 1;
                if (expenseMonth !== filter.month) return false;
            }
            
            // Filter by quarter
            if (filter.quarter) {
                const expenseMonth = new Date(expense.date).getMonth() + 1;
                const expenseQuarter = Math.ceil(expenseMonth / 3);
                if (expenseQuarter !== filter.quarter) return false;
            }
            
            // Filter by end month (for YTD calculations)
            if (filter.endMonth) {
                const expenseMonth = new Date(expense.date).getMonth() + 1;
                if (expenseMonth > filter.endMonth) return false;
            }
            
            // Filter by category
            if (filter.category && expense.category !== filter.category) {
                return false;
            }
            
            // Filter by vendor
            if (filter.vendor && !expense.vendor.toLowerCase().includes(filter.vendor.toLowerCase())) {
                return false;
            }
            
            // Filter by business expense status
            if (filter.isBusinessExpense !== undefined && expense.isBusinessExpense !== filter.isBusinessExpense) {
                return false;
            }
            
            // Filter by amount range
            if (filter.amountRange) {
                const [min, max] = filter.amountRange;
                if (expense.amount < min || expense.amount > max) {
                    return false;
                }
            }
            
            // Filter by minimum amount
            if (filter.minAmount && expense.usdAmount < filter.minAmount) {
                return false;
            }
            
            // Filter by maximum amount
            if (filter.maxAmount && expense.usdAmount > filter.maxAmount) {
                return false;
            }
            
            return true;
        });
    }

    async deleteExpense(expenseId) {
        const expenses = await this.loadData('expenses');
        const filteredExpenses = expenses.filter(e => e.id !== expenseId);
        
        if (filteredExpenses.length === expenses.length) {
            throw new Error('Expense not found');
        }
        
        await this.saveData('expenses', filteredExpenses);
        return true;
    }

    // Equipment Management

    async saveEquipment(equipment) {
        const equipmentList = await this.loadData('equipment');
        
        const existingIndex = equipmentList.findIndex(e => e.id === equipment.id);
        
        if (existingIndex >= 0) {
            equipmentList[existingIndex] = equipment;
        } else {
            equipmentList.push(equipment);
        }
        
        await this.saveData('equipment', equipmentList);
        return equipment;
    }

    async getEquipment(year = null) {
        const equipmentList = await this.loadData('equipment');
        
        if (!year) return equipmentList;
        
        return equipmentList.filter(equipment => {
            const purchaseYear = new Date(equipment.purchaseDate).getFullYear();
            return purchaseYear === year;
        });
    }

    // Recurring Expenses

    async markAsRecurring(vendor, recurringData) {
        const recurringExpenses = await this.loadData('recurring');
        
        const existing = recurringExpenses.find(r => r.vendor === vendor);
        
        if (existing) {
            Object.assign(existing, recurringData);
            existing.updatedAt = new Date().toISOString();
        } else {
            recurringExpenses.push({
                id: `recurring_${crypto.randomUUID()}`,
                vendor,
                ...recurringData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        
        await this.saveData('recurring', recurringExpenses);
    }

    async getRecurringExpenses() {
        return await this.loadData('recurring');
    }

    // Home Office Data

    async saveHomeOfficeData(homeOfficeData) {
        const data = await this.loadData('homeOffice');
        
        const year = homeOfficeData.year || new Date().getFullYear();
        const existingIndex = data.findIndex(d => d.year === year);
        
        const record = {
            ...homeOfficeData,
            year,
            updatedAt: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            data[existingIndex] = record;
        } else {
            data.push(record);
        }
        
        await this.saveData('homeOffice', data);
        return record;
    }

    async getHomeOfficeData(year) {
        const data = await this.loadData('homeOffice');
        return data.find(d => d.year === year);
    }

    // Settings Management

    async getSetting(key) {
        const settings = await this.loadData('settings');
        const setting = settings.find(s => s.key === key);
        return setting ? setting.value : null;
    }

    async setSetting(key, value) {
        const settings = await this.loadData('settings');
        const existingIndex = settings.findIndex(s => s.key === key);
        
        const setting = {
            key,
            value,
            updatedAt: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            settings[existingIndex] = setting;
        } else {
            settings.push(setting);
        }
        
        await this.saveData('settings', settings);
        return setting;
    }

    // Data Export/Import

    async exportData() {
        const allData = {};
        
        for (const [type, filePath] of Object.entries(this.files)) {
            allData[type] = await this.loadData(type);
        }
        
        return {
            exportDate: new Date().toISOString(),
            version: '1.0',
            data: allData
        };
    }

    async importData(exportData) {
        if (!exportData.data) {
            throw new Error('Invalid export data format');
        }
        
        // Backup current data before import
        const backupDir = path.join(this.dataDir, 'backups', new Date().toISOString().split('T')[0]);
        await fs.mkdir(backupDir, { recursive: true });
        
        for (const [type, filePath] of Object.entries(this.files)) {
            const backupPath = path.join(backupDir, path.basename(filePath));
            try {
                await fs.copyFile(filePath, backupPath);
            } catch (error) {
                console.warn(`Could not backup ${type}:`, error.message);
            }
        }
        
        // Import new data
        for (const [type, data] of Object.entries(exportData.data)) {
            if (this.files[type]) {
                await this.saveData(type, data);
            }
        }
        
        return {
            success: true,
            backupLocation: backupDir,
            importedTypes: Object.keys(exportData.data)
        };
    }

    // Database Maintenance

    async vacuum() {
        // Clean up orphaned records and optimize storage
        const stats = {};
        
        for (const [type, filePath] of Object.entries(this.files)) {
            const data = await this.loadData(type);
            const originalSize = JSON.stringify(data).length;
            
            // Remove any corrupted or invalid records
            let cleanedData = data;
            
            if (type === 'expenses') {
                cleanedData = data.filter(e => e.id && e.amount && e.vendor);
            } else if (type === 'equipment') {
                cleanedData = data.filter(e => e.id && e.name && e.cost);
            }
            
            await this.saveData(type, cleanedData);
            
            stats[type] = {
                originalRecords: data.length,
                cleanedRecords: cleanedData.length,
                sizeBefore: originalSize,
                sizeAfter: JSON.stringify(cleanedData).length
            };
        }
        
        return {
            success: true,
            cleanupDate: new Date().toISOString(),
            stats
        };
    }

    async getStats() {
        const stats = {};
        
        for (const [type, filePath] of Object.entries(this.files)) {
            const data = await this.loadData(type);
            const fileStats = await fs.stat(filePath);
            
            stats[type] = {
                recordCount: data.length,
                fileSizeBytes: fileStats.size,
                lastModified: fileStats.mtime
            };
        }
        
        return stats;
    }
}

module.exports = { DatabaseManager };