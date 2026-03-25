#!/usr/bin/env node
/**
 * Contract Template System Demo
 *
 * Demonstrates all major features of the contract template system:
 * - Contract generation with different types
 * - Risk assessment and fairness scoring
 * - Contract comparison
 * - Clause management
 * - Portfolio risk analysis
 */

const ContractTemplateSystem = require('./index.js');
const fs = require('fs');
const path = require('path');

async function runDemo() {
    console.log('🚀 Contract Template System Demo\n');

    const system = new ContractTemplateSystem();

    try {
        // Demo 1: Generate different contract types
        console.log('📋 Demo 1: Contract Generation\n');

        const fixedPriceContract = await system.generateContract('fixed-price', {
            client: 'TechStartup Inc',
            freelancer: 'Jane Developer',
            project: 'Mobile App Development',
            value: '25000',
            currency: 'USD',
            paymentTerms: 'Net 15 days',
            jurisdiction: 'California, USA'
        });

        console.log(`✅ Generated: ${fixedPriceContract.filename}`);
        console.log(`📍 Location: ${fixedPriceContract.path}\n`);

        const hourlyContract = await system.generateContract('hourly', {
            client: 'Consulting Corp',
            freelancer: 'John Expert',
            project: 'Technical Advisory Services',
            value: '200',
            currency: 'USD'
        });

        console.log(`✅ Generated: ${hourlyContract.filename}`);
        console.log(`📍 Location: ${hourlyContract.path}\n`);

        // Demo 2: Risk Assessment
        console.log('🔍 Demo 2: Risk Assessment\n');

        const analysis = await system.analyzeContract(fixedPriceContract.path);
        console.log(`📊 Fairness Score: ${analysis.fairnessScore}/100`);
        console.log(`⚠️  Risk Factors: ${analysis.riskFactors.length}`);
        console.log(`❌ Missing Clauses: ${analysis.missingClauses.join(', ') || 'None'}`);

        if (analysis.riskFactors.length > 0) {
            console.log('\n🚨 Risk Factors Found:');
            analysis.riskFactors.slice(0, 3).forEach((risk, i) => {
                console.log(`${i + 1}. [${risk.severity}] ${risk.message}`);
            });
        }

        if (analysis.suggestions.length > 0) {
            console.log('\n💡 Suggestions:');
            analysis.suggestions.forEach((suggestion, i) => {
                console.log(`${i + 1}. [${suggestion.priority}] ${suggestion.message}`);
            });
        }

        console.log('');

        // Demo 3: Contract Comparison
        console.log('📈 Demo 3: Contract Comparison\n');

        // Create a modified version for comparison
        const modifiedContent = fixedPriceContract.content.replace(
            'Net 15 days',
            'Net 30 days'
        ).replace(
            '50% upfront payment',
            '25% upfront payment'
        );

        const modifiedPath = path.join(system.outputDir, 'modified-contract.md');
        fs.writeFileSync(modifiedPath, modifiedContent);

        const comparison = await system.compareContracts(fixedPriceContract.path, modifiedPath);
        console.log(`📈 Total Changes: ${comparison.summary.totalChanges}`);
        console.log(`➕ Added Lines: ${comparison.summary.added}`);
        console.log(`➖ Removed Lines: ${comparison.summary.removed}`);
        console.log(`🔄 Modified Lines: ${comparison.summary.modified}`);
        console.log(`📝 Word Count Change: ${comparison.wordCountDiff}\n`);

        // Demo 4: Clause Management
        console.log('⚖️ Demo 4: Clause Management\n');

        // Add custom clauses
        await system.addClause('payment', 'demo-express', {
            title: 'Express Payment Terms',
            content: 'Payment due within 7 days. 5% discount for same-day payment.',
            riskLevel: 'very-low'
        });

        await system.addClause('liability', 'demo-limited', {
            title: 'Demo Liability Cap',
            content: 'Liability limited to 50% of contract value for demonstration purposes.',
            riskLevel: 'low'
        });

        console.log('✅ Added custom payment clause: demo-express');
        console.log('✅ Added custom liability clause: demo-limited\n');

        // List payment clauses
        const paymentClauses = await system.listClauses('payment');
        console.log('💰 Available Payment Clauses:');
        Object.entries(paymentClauses).forEach(([id, clause]) => {
            console.log(`  • ${id}: ${clause.title} [${clause.riskLevel}]`);
        });
        console.log('');

        // Demo 5: Generate Contract with Custom Clauses
        console.log('🎯 Demo 5: Contract with Custom Clauses\n');

        const enhancedContract = await system.generateContract('fixed-price', {
            client: 'Premium Client LLC',
            freelancer: 'Expert Freelancer',
            project: 'Enterprise Software Development',
            value: '50000',
            currency: 'USD',
            clauses: ['demo-express', 'demo-limited', 'ip-transfer-on-payment']
        });

        console.log(`✅ Generated enhanced contract: ${enhancedContract.filename}`);
        console.log('📋 Included clauses: demo-express, demo-limited, ip-transfer-on-payment\n');

        // Demo 6: Portfolio Risk Assessment
        console.log('📊 Demo 6: Portfolio Risk Assessment\n');

        const contractPaths = [
            fixedPriceContract.path,
            hourlyContract.path,
            enhancedContract.path
        ];

        const portfolioSummary = await system.getRiskSummary(contractPaths);
        console.log('📁 Portfolio Summary:');
        console.log(`  📄 Total Contracts: ${portfolioSummary.totalContracts}`);
        console.log(`  ⭐ Average Fairness: ${portfolioSummary.averageFairnessScore}/100`);

        if (Object.keys(portfolioSummary.commonRisks).length > 0) {
            console.log('  ⚠️  Common Risks:');
            Object.entries(portfolioSummary.commonRisks).forEach(([risk, count]) => {
                console.log(`     • ${risk}: ${count} contracts`);
            });
        }

        if (portfolioSummary.recommendations.length > 0) {
            console.log('  💡 Portfolio Recommendations:');
            portfolioSummary.recommendations.forEach((rec, i) => {
                console.log(`     ${i + 1}. [${rec.priority}] ${rec.message}`);
            });
        }

        console.log('');

        // Demo 7: Show Generated Files
        console.log('📁 Demo 7: Generated Files\n');
        console.log('Generated contracts in:', system.outputDir);

        const generatedFiles = fs.readdirSync(system.outputDir);
        generatedFiles.forEach(file => {
            const filePath = path.join(system.outputDir, file);
            const stats = fs.statSync(filePath);
            console.log(`  📄 ${file} (${stats.size} bytes)`);
        });

        console.log('\n🎉 Demo completed successfully!');
        console.log('\n📖 Next Steps:');
        console.log('  • Review generated contracts in the output directory');
        console.log('  • Try the CLI commands shown in the README');
        console.log('  • Run the test suite with: npm test');
        console.log('  • Integrate with your CRM system');
        console.log('\n💡 Pro Tips:');
        console.log('  • Always have contracts reviewed by a qualified attorney');
        console.log('  • Customize clause library for your specific needs');
        console.log('  • Set up automated risk monitoring for contract portfolio');
        console.log('  • Use version control for contract templates');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Interactive demo mode
async function interactiveDemo() {
    console.log('🎮 Interactive Contract Demo\n');

    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => {
        rl.question(prompt, resolve);
    });

    try {
        const system = new ContractTemplateSystem();

        console.log('Let\'s create a custom contract for you!\n');

        const client = await question('👤 Client name: ');
        const project = await question('📋 Project description: ');
        const value = await question('💰 Project value: ');
        const currency = await question('💱 Currency (USD): ') || 'USD';

        console.log('\n📋 Available contract types:');
        system.contractTypes.forEach((type, i) => {
            console.log(`  ${i + 1}. ${type}`);
        });

        const typeChoice = await question('\n🔢 Choose contract type (1-6): ');
        const contractType = system.contractTypes[parseInt(typeChoice) - 1];

        if (!contractType) {
            throw new Error('Invalid contract type selection');
        }

        console.log('\n🔄 Generating your contract...\n');

        const contract = await system.generateContract(contractType, {
            client,
            project,
            value,
            currency,
            freelancer: 'Your Name Here'
        });

        console.log(`✅ Contract generated: ${contract.filename}`);

        const analysis = await system.analyzeContract(contract.path);
        console.log(`📊 Fairness Score: ${analysis.fairnessScore}/100`);

        const showContent = await question('\n📄 Show contract content? (y/n): ');
        if (showContent.toLowerCase() === 'y') {
            console.log('\n📄 Contract Content:\n');
            console.log('='.repeat(50));
            console.log(contract.content);
            console.log('='.repeat(50));
        }

        rl.close();

        console.log(`\n💾 Your contract has been saved to: ${contract.path}`);
        console.log('🎉 Thank you for trying the Contract Template System!');

    } catch (error) {
        console.error('❌ Interactive demo failed:', error.message);
        rl.close();
    }
}

// CLI argument handling
const args = process.argv.slice(2);

if (args.includes('--interactive') || args.includes('-i')) {
    interactiveDemo();
} else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Contract Template System Demo

Usage:
  node demo.js [options]

Options:
  --interactive, -i    Run interactive demo
  --help, -h          Show this help

Examples:
  node demo.js                    # Run full feature demo
  node demo.js --interactive      # Run interactive contract creator
    `);
} else {
    runDemo();
}