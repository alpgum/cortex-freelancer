#!/usr/bin/env node

/**
 * Tax & Expense CLI Entry Point
 * 
 * Usage: ./cli.js [command] [options]
 * Example: ./cli.js expense add --amount 49.99 --vendor "GitHub"
 */

const { TaxExpenseManager } = require('./index');

async function main() {
    try {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log('Tax & Expense Management Tool');
            console.log('Usage: tax [command] [options]');
            console.log('Run "tax help" for detailed usage information');
            process.exit(0);
        }

        const manager = await new TaxExpenseManager().initialize();
        const result = await manager.handleCommand(args);
        
        if (result) {
            // Pretty print JSON results
            if (typeof result === 'object') {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(result);
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        
        if (process.env.NODE_ENV === 'development') {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
    console.log('\nOperation cancelled by user');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\nOperation terminated');
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

if (require.main === module) {
    main();
}

module.exports = { main };