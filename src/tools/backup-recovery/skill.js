#!/usr/bin/env node
/**
 * Backup & Recovery — OpenClaw Skill Module (CFX-100)
 *
 * Integrates the Backup & Recovery System with OpenClaw.
 * Provides simple JavaScript interface for skill usage.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execAsync = util.promisify(exec);

class BackupRecoverySkill {
  constructor() {
    this.toolPath = path.join(__dirname, 'index.ts');
    this.dataDir = path.join(
      process.env.CORTEX_DATA_DIR || path.join(process.env.HOME || '~', '.cortex-freelancer'),
      'backup-recovery'
    );

    // Ensure data directories exist
    for (const sub of ['backups', 'manifests', 'schedules', 'recovery-plans', 'dedup-store']) {
      const dir = path.join(this.dataDir, sub);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Run a CLI command and return parsed output
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object|string>} Parsed JSON or raw output
   */
  async runCommand(args) {
    const fullArgs = [this.toolPath, ...args, '--format', 'json'];
    const cmd = `npx ts-node ${fullArgs.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: __dirname,
        timeout: 120000,
      });

      if (stderr && !stderr.includes('Warning:')) {
        console.error(stderr);
      }

      try {
        return JSON.parse(stdout.trim());
      } catch {
        return stdout.trim();
      }
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Create a full backup of all or selected sources
   * @param {Object} options - Backup options
   * @param {string[]} [options.sources] - Source names to back up
   * @param {string} [options.label] - Descriptive label
   * @returns {Promise<Object>} Backup manifest summary
   */
  async createFullBackup(options = {}) {
    const args = ['backup'];
    if (options.sources) args.push('--source', options.sources.join(','));
    if (options.label) args.push('--label', options.label);
    return this.runCommand(args);
  }

  /**
   * Create an incremental backup (only changed files)
   * @param {Object} options - Backup options
   * @param {string[]} [options.sources] - Source names to back up
   * @param {string} [options.label] - Descriptive label
   * @returns {Promise<Object>} Backup manifest summary
   */
  async createIncrementalBackup(options = {}) {
    const args = ['backup', '--incremental'];
    if (options.sources) args.push('--source', options.sources.join(','));
    if (options.label) args.push('--label', options.label);
    return this.runCommand(args);
  }

  /**
   * Restore data from a specific backup
   * @param {string} backupId - Backup ID to restore from
   * @param {Object} options - Restore options
   * @param {string} [options.target] - Target directory for restore
   * @param {string[]} [options.sources] - Filter by source names
   * @returns {Promise<Object>} Restore result
   */
  async restore(backupId, options = {}) {
    const args = ['restore', backupId];
    if (options.target) args.push('--target', options.target);
    if (options.sources) args.push('--source', options.sources.join(','));
    return this.runCommand(args);
  }

  /**
   * Restore from the most recent backup
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result
   */
  async restoreLatest(options = {}) {
    const args = ['restore', '--latest'];
    if (options.target) args.push('--target', options.target);
    if (options.sources) args.push('--source', options.sources.join(','));
    return this.runCommand(args);
  }

  /**
   * Restore to a specific point in time
   * @param {string} timestamp - ISO timestamp to restore to
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result with matched backup
   */
  async restoreToPointInTime(timestamp, options = {}) {
    const args = ['restore', '--point-in-time', timestamp];
    if (options.target) args.push('--target', options.target);
    if (options.sources) args.push('--source', options.sources.join(','));
    return this.runCommand(args);
  }

  /**
   * Verify backup integrity
   * @param {string} [backupId] - Specific backup ID, or omit for all
   * @returns {Promise<Object>} Verification results
   */
  async verify(backupId) {
    if (backupId) {
      return this.runCommand(['verify', backupId]);
    }
    return this.runCommand(['verify', '--all']);
  }

  /**
   * List all backups
   * @returns {Promise<Object[]>} Array of backup summaries
   */
  async listBackups() {
    return this.runCommand(['list']);
  }

  /**
   * List available restore points
   * @returns {Promise<Object[]>} Array of restore points
   */
  async listRestorePoints() {
    return this.runCommand(['list', '--restore-points']);
  }

  /**
   * Discover available data sources
   * @returns {Promise<Object[]>} Array of discovered sources
   */
  async discoverSources() {
    return this.runCommand(['sources']);
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats with compression and dedup info
   */
  async getStats() {
    return this.runCommand(['stats']);
  }

  /**
   * Create a backup schedule
   * @param {Object} schedule - Schedule configuration
   * @returns {Promise<Object>} Created schedule
   */
  async createSchedule(schedule) {
    const args = ['schedule', 'create'];
    if (schedule.name) args.push('--name', schedule.name);
    if (schedule.cron) args.push('--cron', schedule.cron);
    if (schedule.type) args.push('--type', schedule.type);
    if (schedule.sources) args.push('--source', schedule.sources.join(','));
    if (schedule.retention) args.push('--retention', String(schedule.retention));
    return this.runCommand(args);
  }

  /**
   * Delete a backup schedule
   * @param {string} scheduleId - Schedule ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSchedule(scheduleId) {
    return this.runCommand(['schedule', 'delete', scheduleId]);
  }

  /**
   * List all backup schedules
   * @returns {Promise<Object[]>} Array of schedules
   */
  async listSchedules() {
    return this.runCommand(['list', '--schedules']);
  }

  /**
   * Generate a disaster recovery plan
   * @param {string} businessName - Name of the freelance business
   * @param {Object} options - Plan options
   * @param {string[]} [options.criticalSources] - Critical data sources
   * @returns {Promise<Object>} Generated recovery plan
   */
  async generateRecoveryPlan(businessName, options = {}) {
    const args = ['recovery-plan', businessName];
    if (options.criticalSources) {
      args.push('--critical', options.criticalSources.join(','));
    }
    return this.runCommand(args);
  }

  /**
   * Apply retention policy to remove old backups
   * @param {number} [days=30] - Retention period in days
   * @returns {Promise<Object>} Retention result with removed/kept lists
   */
  async applyRetention(days = 30) {
    return this.runCommand(['retention', '--days', String(days)]);
  }
}

module.exports = { BackupRecoverySkill };
