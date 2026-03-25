#!/usr/bin/env node
/**
 * Cortex Freelancer — Wellness CLI
 *
 * Quick-access commands for burnout prevention and work-life balance.
 * Wraps the burnout-prevention module with freelancer-friendly shortcuts.
 *
 * Usage:
 *   cortex-wellness dashboard          # Quick status overview
 *   cortex-wellness log -d 2026-03-20 -s 09:00 -e 17:00
 *   cortex-wellness risk               # Burnout risk score
 *   cortex-wellness balance             # Work-life balance report
 *   cortex-wellness checkin --energy 4 --stress 2 --sleep 4 --motivation 4 --physical 4
 *   cortex-wellness boundaries          # Your work boundaries
 *   cortex-wellness patterns            # Historical pattern analysis
 *   cortex-wellness workload            # Client distribution
 *   cortex-wellness client -i c1 -n "Acme Corp" -h 15
 *   cortex-wellness recovery -s 2026-03-15 -e 2026-03-17
 *   cortex-wellness config              # View/update config
 *   cortex-wellness weekly              # Weekly check-in prompt
 */

import { createCLI } from '../tools/burnout-prevention/index';

const program = createCLI();

// Override name for the wellness context
program.name('cortex-wellness');
program.description('Cortex Freelancer — Wellness & Burnout Prevention');

program.parse(process.argv);
