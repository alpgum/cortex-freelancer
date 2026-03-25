#!/usr/bin/env node
/**
 * CLI entry point for Network Builder commands.
 * Delegates to NetworkBuilderCLI from the network-builder tool module.
 *
 * Usage:
 *   cortex-network contact add -n "Alice" -c client
 *   cortex-network referrals
 *   cortex-network scores
 *   cortex-network warm-leads
 *   cortex-network event add -n "Meetup" -d 2026-04-01 -l Berlin
 *   cortex-network event roi
 *   cortex-network intro --from X --to Y --via Z --reason "..."
 *   cortex-network community
 *   cortex-network dashboard
 */

import path from 'path';
import { NetworkBuilderCLI } from '../tools/network-builder/index';

const DATA_DIR = process.env.CORTEX_NETWORK_DATA || path.join(process.cwd(), 'data', 'network');

const cli = new NetworkBuilderCLI(DATA_DIR);
cli.run().catch(error => {
  console.error('Error:', error.message || error);
  process.exit(1);
});
