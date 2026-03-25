#!/usr/bin/env node
/**
 * Cortex Freelancer — Backup & Recovery System (CFX-100)
 *
 * Comprehensive backup and recovery system for freelancer data:
 *  - Automated & incremental backups for all freelancer data
 *  - Point-in-time restore with integrity verification
 *  - Storage optimization (compression, deduplication)
 *  - Disaster recovery plan generation
 *  - Integration with the Cortex Freelancer tool ecosystem
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ── Types ──────────────────────────────────────────────────────────────────

export interface BackupManifest {
  id: string;
  timestamp: string;
  type: 'full' | 'incremental';
  parentId: string | null;
  sources: BackupSource[];
  fileCount: number;
  totalSizeBytes: number;
  compressedSizeBytes: number;
  checksums: Record<string, string>;
  metadata: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'verified';
  version: string;
}

export interface BackupSource {
  name: string;
  path: string;
  type: 'clients' | 'proposals' | 'contracts' | 'invoices' | 'projects' | 'portfolios' | 'analytics' | 'config' | 'custom';
  fileCount: number;
  sizeBytes: number;
}

export interface BackupEntry {
  relativePath: string;
  checksum: string;
  sizeBytes: number;
  compressedSizeBytes: number;
  modifiedAt: string;
  isNew: boolean;
  isModified: boolean;
}

export interface RestorePoint {
  backupId: string;
  timestamp: string;
  type: 'full' | 'incremental';
  chain: string[];
  totalFiles: number;
  description: string;
}

export interface VerificationResult {
  backupId: string;
  valid: boolean;
  checkedFiles: number;
  corruptedFiles: string[];
  missingFiles: string[];
  checksumMismatches: string[];
  verifiedAt: string;
}

export interface RecoveryPlan {
  id: string;
  createdAt: string;
  businessName: string;
  riskAssessment: RiskAssessment;
  backupStrategy: BackupStrategy;
  recoveryProcedures: RecoveryProcedure[];
  communicationPlan: CommunicationStep[];
  testingSchedule: TestSchedule[];
  estimatedRecoveryTime: string;
}

export interface RiskAssessment {
  criticalDataSources: string[];
  vulnerabilities: string[];
  impactAnalysis: Record<string, string>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface BackupStrategy {
  fullBackupFrequency: string;
  incrementalFrequency: string;
  retentionPolicy: string;
  storageLocations: string[];
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
}

export interface RecoveryProcedure {
  scenario: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  steps: string[];
  estimatedTime: string;
  dataAtRisk: string[];
}

export interface CommunicationStep {
  trigger: string;
  audience: string;
  channel: string;
  template: string;
}

export interface TestSchedule {
  testType: string;
  frequency: string;
  lastRun: string | null;
  nextRun: string;
}

export interface BackupSchedule {
  id: string;
  name: string;
  cronExpression: string;
  type: 'full' | 'incremental';
  sources: string[];
  enabled: boolean;
  lastRun: string | null;
  nextRun: string;
  retentionDays: number;
}

export interface DeduplicationStats {
  totalFiles: number;
  uniqueFiles: number;
  duplicateFiles: number;
  savedBytes: number;
  deduplicationRatio: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.CORTEX_DATA_DIR || path.join(process.env.HOME || '~', '.cortex-freelancer'),
  'backup-recovery'
);
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const MANIFESTS_DIR = path.join(DATA_DIR, 'manifests');
const SCHEDULES_DIR = path.join(DATA_DIR, 'schedules');
const PLANS_DIR = path.join(DATA_DIR, 'recovery-plans');
const DEDUP_DIR = path.join(DATA_DIR, 'dedup-store');

const CORTEX_ROOT = process.env.CORTEX_DATA_DIR || path.join(process.env.HOME || '~', '.cortex-freelancer');

const KNOWN_SOURCES: Record<string, BackupSource['type']> = {
  'client-crm': 'clients',
  'proposals': 'proposals',
  'contract-templates': 'contracts',
  'payment-chase': 'invoices',
  'project-lifecycle': 'projects',
  'portfolio-optimizer': 'portfolios',
  'analytics': 'analytics',
  'config': 'config',
};

const VERSION = '1.0.0';

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateId(prefix: string = 'bak'): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${ts}-${rand}`;
}

function checksumFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function checksumBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function walkDir(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...walkDir(fullPath, baseDir));
    } else {
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results;
}

// ── Backup Engine ──────────────────────────────────────────────────────────

export class BackupEngine {
  constructor() {
    ensureDir(BACKUPS_DIR);
    ensureDir(MANIFESTS_DIR);
    ensureDir(SCHEDULES_DIR);
    ensureDir(PLANS_DIR);
    ensureDir(DEDUP_DIR);
  }

  // ── Source Discovery ───────────────────────────────────────────────────

  discoverSources(): BackupSource[] {
    const sources: BackupSource[] = [];

    for (const [dirName, sourceType] of Object.entries(KNOWN_SOURCES)) {
      const sourcePath = path.join(CORTEX_ROOT, dirName);
      if (fs.existsSync(sourcePath)) {
        const files = walkDir(sourcePath, sourcePath);
        let totalSize = 0;
        for (const file of files) {
          try {
            const stat = fs.statSync(path.join(sourcePath, file));
            totalSize += stat.size;
          } catch { /* skip inaccessible */ }
        }
        sources.push({
          name: dirName,
          path: sourcePath,
          type: sourceType,
          fileCount: files.length,
          sizeBytes: totalSize,
        });
      }
    }

    return sources;
  }

  // ── Full Backup ────────────────────────────────────────────────────────

  async createFullBackup(
    sourceFilter?: string[],
    metadata: Record<string, unknown> = {}
  ): Promise<BackupManifest> {
    const backupId = generateId('full');
    const backupDir = path.join(BACKUPS_DIR, backupId);
    ensureDir(backupDir);

    let sources = this.discoverSources();
    if (sourceFilter && sourceFilter.length > 0) {
      sources = sources.filter(s => sourceFilter.includes(s.name) || sourceFilter.includes(s.type));
    }

    const checksums: Record<string, string> = {};
    const entries: BackupEntry[] = [];
    let totalSize = 0;
    let compressedTotal = 0;
    let fileCount = 0;

    for (const source of sources) {
      const files = walkDir(source.path, source.path);
      const sourceBackupDir = path.join(backupDir, source.name);
      ensureDir(sourceBackupDir);

      for (const relPath of files) {
        const fullPath = path.join(source.path, relPath);
        try {
          const content = fs.readFileSync(fullPath);
          const checksum = checksumBuffer(content);
          const compressed = await gzip(content);

          const destPath = path.join(sourceBackupDir, relPath + '.gz');
          ensureDir(path.dirname(destPath));
          fs.writeFileSync(destPath, compressed);

          // Store in dedup index
          this.storeDedupEntry(checksum, compressed);

          checksums[`${source.name}/${relPath}`] = checksum;
          entries.push({
            relativePath: `${source.name}/${relPath}`,
            checksum,
            sizeBytes: content.length,
            compressedSizeBytes: compressed.length,
            modifiedAt: fs.statSync(fullPath).mtime.toISOString(),
            isNew: true,
            isModified: false,
          });

          totalSize += content.length;
          compressedTotal += compressed.length;
          fileCount++;
        } catch (err) {
          // Log but continue
          console.error(`Warning: Could not backup ${fullPath}: ${(err as Error).message}`);
        }
      }
    }

    const manifest: BackupManifest = {
      id: backupId,
      timestamp: new Date().toISOString(),
      type: 'full',
      parentId: null,
      sources,
      fileCount,
      totalSizeBytes: totalSize,
      compressedSizeBytes: compressedTotal,
      checksums,
      metadata,
      status: 'completed',
      version: VERSION,
    };

    // Save manifest
    fs.writeFileSync(
      path.join(MANIFESTS_DIR, `${backupId}.json`),
      JSON.stringify(manifest, null, 2)
    );

    // Save entries index
    fs.writeFileSync(
      path.join(backupDir, '_entries.json'),
      JSON.stringify(entries, null, 2)
    );

    return manifest;
  }

  // ── Incremental Backup ─────────────────────────────────────────────────

  async createIncrementalBackup(
    parentId?: string,
    sourceFilter?: string[],
    metadata: Record<string, unknown> = {}
  ): Promise<BackupManifest> {
    // Find parent (latest full or incremental)
    const parent = parentId
      ? this.getManifest(parentId)
      : this.getLatestManifest();

    if (!parent) {
      // No parent found — fall back to full backup
      return this.createFullBackup(sourceFilter, metadata);
    }

    const backupId = generateId('incr');
    const backupDir = path.join(BACKUPS_DIR, backupId);
    ensureDir(backupDir);

    let sources = this.discoverSources();
    if (sourceFilter && sourceFilter.length > 0) {
      sources = sources.filter(s => sourceFilter.includes(s.name) || sourceFilter.includes(s.type));
    }

    const parentChecksums = parent.checksums;
    const checksums: Record<string, string> = {};
    const entries: BackupEntry[] = [];
    let totalSize = 0;
    let compressedTotal = 0;
    let fileCount = 0;

    for (const source of sources) {
      const files = walkDir(source.path, source.path);
      const sourceBackupDir = path.join(backupDir, source.name);

      for (const relPath of files) {
        const key = `${source.name}/${relPath}`;
        const fullPath = path.join(source.path, relPath);

        try {
          const content = fs.readFileSync(fullPath);
          const checksum = checksumBuffer(content);

          // Skip if unchanged from parent
          if (parentChecksums[key] === checksum) {
            checksums[key] = checksum;
            continue;
          }

          const compressed = await gzip(content);
          ensureDir(sourceBackupDir);
          const destPath = path.join(sourceBackupDir, relPath + '.gz');
          ensureDir(path.dirname(destPath));
          fs.writeFileSync(destPath, compressed);

          this.storeDedupEntry(checksum, compressed);

          const isNew = !parentChecksums[key];
          checksums[key] = checksum;
          entries.push({
            relativePath: key,
            checksum,
            sizeBytes: content.length,
            compressedSizeBytes: compressed.length,
            modifiedAt: fs.statSync(fullPath).mtime.toISOString(),
            isNew,
            isModified: !isNew,
          });

          totalSize += content.length;
          compressedTotal += compressed.length;
          fileCount++;
        } catch (err) {
          console.error(`Warning: Could not backup ${fullPath}: ${(err as Error).message}`);
        }
      }
    }

    const manifest: BackupManifest = {
      id: backupId,
      timestamp: new Date().toISOString(),
      type: 'incremental',
      parentId: parent.id,
      sources,
      fileCount,
      totalSizeBytes: totalSize,
      compressedSizeBytes: compressedTotal,
      checksums,
      metadata,
      status: 'completed',
      version: VERSION,
    };

    fs.writeFileSync(
      path.join(MANIFESTS_DIR, `${backupId}.json`),
      JSON.stringify(manifest, null, 2)
    );

    fs.writeFileSync(
      path.join(backupDir, '_entries.json'),
      JSON.stringify(entries, null, 2)
    );

    return manifest;
  }

  // ── Restore ────────────────────────────────────────────────────────────

  async restoreBackup(
    backupId: string,
    targetDir?: string,
    sourceFilter?: string[]
  ): Promise<{ restoredFiles: number; totalBytes: number; targetDir: string }> {
    const chain = this.resolveBackupChain(backupId);
    if (chain.length === 0) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const restoreDir = targetDir || path.join(DATA_DIR, 'restore', `restore-${Date.now()}`);
    ensureDir(restoreDir);

    // Build merged file map from chain (full -> incrementals in order)
    const fileMap = new Map<string, { backupId: string; checksum: string }>();
    for (const manifest of chain) {
      for (const [key, checksum] of Object.entries(manifest.checksums)) {
        fileMap.set(key, { backupId: manifest.id, checksum });
      }
    }

    let restoredFiles = 0;
    let totalBytes = 0;

    for (const [relPath, { backupId: srcBackupId }] of fileMap) {
      if (sourceFilter && sourceFilter.length > 0) {
        const sourceName = relPath.split('/')[0];
        if (!sourceFilter.includes(sourceName)) continue;
      }

      const compressedPath = path.join(BACKUPS_DIR, srcBackupId, relPath + '.gz');
      if (!fs.existsSync(compressedPath)) {
        // Try dedup store
        const manifest = chain.find(m => m.id === srcBackupId);
        if (manifest && manifest.checksums[relPath]) {
          const dedupPath = path.join(DEDUP_DIR, manifest.checksums[relPath] + '.gz');
          if (fs.existsSync(dedupPath)) {
            const compressed = fs.readFileSync(dedupPath);
            const content = await gunzip(compressed);
            const destPath = path.join(restoreDir, relPath);
            ensureDir(path.dirname(destPath));
            fs.writeFileSync(destPath, content);
            restoredFiles++;
            totalBytes += content.length;
            continue;
          }
        }
        console.error(`Warning: Missing backup file for ${relPath}`);
        continue;
      }

      const compressed = fs.readFileSync(compressedPath);
      const content = await gunzip(compressed);
      const destPath = path.join(restoreDir, relPath);
      ensureDir(path.dirname(destPath));
      fs.writeFileSync(destPath, content);
      restoredFiles++;
      totalBytes += content.length;
    }

    return { restoredFiles, totalBytes, targetDir: restoreDir };
  }

  // ── Point-in-Time Restore ──────────────────────────────────────────────

  async restoreToPointInTime(
    timestamp: string,
    targetDir?: string,
    sourceFilter?: string[]
  ): Promise<{ restoredFiles: number; totalBytes: number; targetDir: string; backupId: string }> {
    const targetTime = new Date(timestamp).getTime();
    const manifests = this.listManifests()
      .filter(m => new Date(m.timestamp).getTime() <= targetTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (manifests.length === 0) {
      throw new Error(`No backups found before ${timestamp}`);
    }

    const closest = manifests[0];
    const result = await this.restoreBackup(closest.id, targetDir, sourceFilter);
    return { ...result, backupId: closest.id };
  }

  // ── Verification ───────────────────────────────────────────────────────

  verifyBackup(backupId: string): VerificationResult {
    const manifest = this.getManifest(backupId);
    if (!manifest) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const backupDir = path.join(BACKUPS_DIR, backupId);
    const corruptedFiles: string[] = [];
    const missingFiles: string[] = [];
    const checksumMismatches: string[] = [];
    let checkedFiles = 0;

    // For incremental backups, only check files that were actually backed up
    const entriesPath = path.join(backupDir, '_entries.json');
    let entriesToCheck: BackupEntry[] = [];

    if (fs.existsSync(entriesPath)) {
      entriesToCheck = JSON.parse(fs.readFileSync(entriesPath, 'utf-8'));
    } else {
      // Fall back to checking all checksums in manifest
      for (const [relPath, checksum] of Object.entries(manifest.checksums)) {
        entriesToCheck.push({
          relativePath: relPath,
          checksum,
          sizeBytes: 0,
          compressedSizeBytes: 0,
          modifiedAt: '',
          isNew: false,
          isModified: false,
        });
      }
    }

    for (const entry of entriesToCheck) {
      const compressedPath = path.join(backupDir, entry.relativePath + '.gz');
      checkedFiles++;

      if (!fs.existsSync(compressedPath)) {
        // Check dedup store as fallback
        const dedupPath = path.join(DEDUP_DIR, entry.checksum + '.gz');
        if (!fs.existsSync(dedupPath)) {
          missingFiles.push(entry.relativePath);
          continue;
        }
      }

      try {
        const filePath = fs.existsSync(compressedPath)
          ? compressedPath
          : path.join(DEDUP_DIR, entry.checksum + '.gz');
        const compressed = fs.readFileSync(filePath);
        const content = zlib.gunzipSync(compressed);
        const actualChecksum = checksumBuffer(content);

        if (actualChecksum !== entry.checksum) {
          checksumMismatches.push(entry.relativePath);
        }
      } catch {
        corruptedFiles.push(entry.relativePath);
      }
    }

    const valid = corruptedFiles.length === 0 && missingFiles.length === 0 && checksumMismatches.length === 0;

    // Update manifest status
    manifest.status = valid ? 'verified' : 'failed';
    fs.writeFileSync(
      path.join(MANIFESTS_DIR, `${backupId}.json`),
      JSON.stringify(manifest, null, 2)
    );

    return {
      backupId,
      valid,
      checkedFiles,
      corruptedFiles,
      missingFiles,
      checksumMismatches,
      verifiedAt: new Date().toISOString(),
    };
  }

  // ── Deduplication ──────────────────────────────────────────────────────

  private storeDedupEntry(checksum: string, compressed: Buffer): void {
    const dedupPath = path.join(DEDUP_DIR, checksum + '.gz');
    if (!fs.existsSync(dedupPath)) {
      fs.writeFileSync(dedupPath, compressed);
    }
  }

  getDeduplicationStats(): DeduplicationStats {
    const manifests = this.listManifests();
    const allChecksums: string[] = [];
    const uniqueChecksums = new Set<string>();
    let totalSize = 0;

    for (const manifest of manifests) {
      for (const [, checksum] of Object.entries(manifest.checksums)) {
        allChecksums.push(checksum);
        uniqueChecksums.add(checksum);
      }
      totalSize += manifest.totalSizeBytes;
    }

    const dedupFiles = fs.existsSync(DEDUP_DIR)
      ? fs.readdirSync(DEDUP_DIR).length
      : 0;

    let dedupSize = 0;
    if (fs.existsSync(DEDUP_DIR)) {
      for (const file of fs.readdirSync(DEDUP_DIR)) {
        dedupSize += fs.statSync(path.join(DEDUP_DIR, file)).size;
      }
    }

    const duplicateCount = allChecksums.length - uniqueChecksums.size;
    const savedBytes = totalSize > 0 ? totalSize - dedupSize : 0;

    return {
      totalFiles: allChecksums.length,
      uniqueFiles: dedupFiles,
      duplicateFiles: duplicateCount,
      savedBytes: Math.max(0, savedBytes),
      deduplicationRatio: allChecksums.length > 0
        ? Number(((1 - uniqueChecksums.size / allChecksums.length) * 100).toFixed(2))
        : 0,
    };
  }

  // ── Backup Scheduling ──────────────────────────────────────────────────

  createSchedule(schedule: Omit<BackupSchedule, 'id' | 'lastRun' | 'nextRun'> & { nextRun?: string }): BackupSchedule {
    const newSchedule: BackupSchedule = {
      ...schedule,
      id: generateId('sched'),
      lastRun: null,
      nextRun: schedule.nextRun || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    fs.writeFileSync(
      path.join(SCHEDULES_DIR, `${newSchedule.id}.json`),
      JSON.stringify(newSchedule, null, 2)
    );

    return newSchedule;
  }

  listSchedules(): BackupSchedule[] {
    if (!fs.existsSync(SCHEDULES_DIR)) return [];
    return fs.readdirSync(SCHEDULES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(SCHEDULES_DIR, f), 'utf-8')));
  }

  deleteSchedule(scheduleId: string): boolean {
    const filePath = path.join(SCHEDULES_DIR, `${scheduleId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // ── Disaster Recovery Plan ─────────────────────────────────────────────

  generateRecoveryPlan(businessName: string, options: {
    criticalSources?: string[];
    backupFrequency?: string;
    additionalRisks?: string[];
  } = {}): RecoveryPlan {
    const sources = this.discoverSources();
    const sourceNames = sources.map(s => s.name);
    const criticalSources = options.criticalSources || sourceNames;
    const totalDataSize = sources.reduce((sum, s) => sum + s.sizeBytes, 0);

    const riskAssessment: RiskAssessment = {
      criticalDataSources: criticalSources,
      vulnerabilities: [
        'Local storage failure (disk corruption, hardware failure)',
        'Accidental data deletion or overwrite',
        'Software bugs causing data corruption',
        'Ransomware or malware attack',
        ...(options.additionalRisks || []),
      ],
      impactAnalysis: {
        'Client data loss': 'Loss of client contact info, history, and relationship data — impacts ongoing projects and future business',
        'Contract/proposal loss': 'Legal and financial risk — inability to reference agreed terms',
        'Invoice/payment loss': 'Revenue tracking disruption — potential lost income and tax complications',
        'Portfolio loss': 'Marketing and business development setback — lost showcase materials',
        'Project files loss': 'Work delivery failure — direct financial and reputational damage',
      },
      riskLevel: totalDataSize > 100 * 1024 * 1024 ? 'high'
        : totalDataSize > 10 * 1024 * 1024 ? 'medium'
        : 'low',
    };

    const backupStrategy: BackupStrategy = {
      fullBackupFrequency: options.backupFrequency || 'weekly',
      incrementalFrequency: 'daily',
      retentionPolicy: '30 days for incremental, 90 days for full backups',
      storageLocations: [
        'Local backup directory (~/.cortex-freelancer/backup-recovery/)',
        'Recommended: External drive or NAS (configure CORTEX_BACKUP_EXTERNAL_DIR)',
        'Recommended: Cloud storage sync (Dropbox, Google Drive, or S3)',
      ],
      encryptionEnabled: false,
      compressionEnabled: true,
    };

    const recoveryProcedures: RecoveryProcedure[] = [
      {
        scenario: 'Accidental file deletion',
        priority: 'high',
        steps: [
          'Identify which files were deleted and when',
          'Run: backup-recovery restore --latest --source <affected-source>',
          'Verify restored files with: backup-recovery verify <backup-id>',
          'Confirm data integrity by inspecting restored files',
        ],
        estimatedTime: '5-15 minutes',
        dataAtRisk: ['Recently modified files since last backup'],
      },
      {
        scenario: 'Complete data loss (disk failure)',
        priority: 'critical',
        steps: [
          'Obtain replacement storage medium',
          'Locate latest verified backup from external/cloud storage',
          'Run: backup-recovery restore <backup-id> --target <new-path>',
          'Verify all restored sources: backup-recovery verify --all',
          'Update tool configurations to point to restored data paths',
          'Run integration checks across all Cortex tools',
        ],
        estimatedTime: '30 minutes to 2 hours',
        dataAtRisk: ['All data since last off-site backup'],
      },
      {
        scenario: 'Data corruption (partial)',
        priority: 'high',
        steps: [
          'Identify corrupted files by running verification',
          'Determine last known good backup: backup-recovery list --verified',
          'Restore only affected sources: backup-recovery restore <id> --source <name>',
          'Cross-reference with working data to minimize data loss',
        ],
        estimatedTime: '15-45 minutes',
        dataAtRisk: ['Corrupted files since last verified backup'],
      },
      {
        scenario: 'Ransomware/malware attack',
        priority: 'critical',
        steps: [
          'Disconnect from network immediately',
          'Do NOT run any Cortex tools until system is clean',
          'Boot from clean media or use a separate clean machine',
          'Locate offline/air-gapped backup copy',
          'Scan backup files for malware before restoring',
          'Restore to clean system: backup-recovery restore <id> --target <clean-path>',
          'Verify all restored data integrity',
          'Update all passwords and API keys used by Cortex tools',
        ],
        estimatedTime: '2-8 hours',
        dataAtRisk: ['All data if no offline backup exists'],
      },
    ];

    const communicationPlan: CommunicationStep[] = [
      {
        trigger: 'Data loss affecting active projects',
        audience: 'Active clients',
        channel: 'Email (priority) + messaging platform',
        template: 'Notify of potential delay, reassure that work is being recovered, provide updated timeline',
      },
      {
        trigger: 'Invoice/payment data loss',
        audience: 'Accountant / tax advisor',
        channel: 'Email with documentation',
        template: 'Request duplicate records, provide last known payment state, coordinate reconciliation',
      },
      {
        trigger: 'Extended downtime (>24 hours)',
        audience: 'All stakeholders',
        channel: 'Email + social media update',
        template: 'Status update with expected recovery timeline and contingency arrangements',
      },
    ];

    const testingSchedule: TestSchedule[] = [
      {
        testType: 'Backup integrity verification',
        frequency: 'Weekly',
        lastRun: null,
        nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        testType: 'Full restore drill',
        frequency: 'Monthly',
        lastRun: null,
        nextRun: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        testType: 'Disaster recovery simulation',
        frequency: 'Quarterly',
        lastRun: null,
        nextRun: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const plan: RecoveryPlan = {
      id: generateId('drp'),
      createdAt: new Date().toISOString(),
      businessName,
      riskAssessment,
      backupStrategy,
      recoveryProcedures,
      communicationPlan,
      testingSchedule,
      estimatedRecoveryTime: 'Partial: 5-45 min | Full: 30 min - 2 hrs | Disaster: 2-8 hrs',
    };

    fs.writeFileSync(
      path.join(PLANS_DIR, `${plan.id}.json`),
      JSON.stringify(plan, null, 2)
    );

    return plan;
  }

  listRecoveryPlans(): RecoveryPlan[] {
    if (!fs.existsSync(PLANS_DIR)) return [];
    return fs.readdirSync(PLANS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(PLANS_DIR, f), 'utf-8')));
  }

  // ── Manifest Management ────────────────────────────────────────────────

  getManifest(backupId: string): BackupManifest | null {
    const manifestPath = path.join(MANIFESTS_DIR, `${backupId}.json`);
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  getLatestManifest(type?: 'full' | 'incremental'): BackupManifest | null {
    const manifests = this.listManifests();
    const filtered = type ? manifests.filter(m => m.type === type) : manifests;
    if (filtered.length === 0) return null;
    return filtered.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }

  listManifests(): BackupManifest[] {
    if (!fs.existsSync(MANIFESTS_DIR)) return [];
    return fs.readdirSync(MANIFESTS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, f), 'utf-8')))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  listRestorePoints(): RestorePoint[] {
    const manifests = this.listManifests();
    return manifests.map(m => ({
      backupId: m.id,
      timestamp: m.timestamp,
      type: m.type,
      chain: this.resolveBackupChain(m.id).map(c => c.id),
      totalFiles: Object.keys(m.checksums).length,
      description: `${m.type} backup — ${m.fileCount} files (${formatBytes(m.compressedSizeBytes)} compressed)`,
    }));
  }

  // ── Retention Policy ───────────────────────────────────────────────────

  applyRetentionPolicy(retentionDays: number = 30): { removed: string[]; kept: string[] } {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const manifests = this.listManifests();
    const removed: string[] = [];
    const kept: string[] = [];

    // Always keep at least one full backup
    const fullBackups = manifests.filter(m => m.type === 'full')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    for (const manifest of manifests) {
      const isOld = new Date(manifest.timestamp).getTime() < cutoff;
      const isLastFull = fullBackups.length === 1 && manifest.id === fullBackups[0].id;

      if (isOld && !isLastFull) {
        // Remove backup data
        const backupDir = path.join(BACKUPS_DIR, manifest.id);
        if (fs.existsSync(backupDir)) {
          fs.rmSync(backupDir, { recursive: true });
        }
        // Remove manifest
        const manifestPath = path.join(MANIFESTS_DIR, `${manifest.id}.json`);
        if (fs.existsSync(manifestPath)) {
          fs.unlinkSync(manifestPath);
        }
        removed.push(manifest.id);
      } else {
        kept.push(manifest.id);
      }
    }

    return { removed, kept };
  }

  // ── Storage Stats ──────────────────────────────────────────────────────

  getStorageStats(): {
    totalBackups: number;
    fullBackups: number;
    incrementalBackups: number;
    totalOriginalSize: string;
    totalCompressedSize: string;
    compressionRatio: number;
    deduplication: DeduplicationStats;
    oldestBackup: string | null;
    newestBackup: string | null;
  } {
    const manifests = this.listManifests();
    const fullCount = manifests.filter(m => m.type === 'full').length;
    const totalOriginal = manifests.reduce((s, m) => s + m.totalSizeBytes, 0);
    const totalCompressed = manifests.reduce((s, m) => s + m.compressedSizeBytes, 0);

    return {
      totalBackups: manifests.length,
      fullBackups: fullCount,
      incrementalBackups: manifests.length - fullCount,
      totalOriginalSize: formatBytes(totalOriginal),
      totalCompressedSize: formatBytes(totalCompressed),
      compressionRatio: totalOriginal > 0
        ? Number(((1 - totalCompressed / totalOriginal) * 100).toFixed(2))
        : 0,
      deduplication: this.getDeduplicationStats(),
      oldestBackup: manifests.length > 0 ? manifests[manifests.length - 1].timestamp : null,
      newestBackup: manifests.length > 0 ? manifests[0].timestamp : null,
    };
  }

  // ── Backup Chain Resolution ────────────────────────────────────────────

  private resolveBackupChain(backupId: string): BackupManifest[] {
    const chain: BackupManifest[] = [];
    let current = this.getManifest(backupId);

    while (current) {
      chain.unshift(current);
      if (current.type === 'full' || !current.parentId) break;
      current = this.getManifest(current.parentId);
    }

    return chain;
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const engine = new BackupEngine();

  function getFlag(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  function hasFlag(name: string): boolean {
    return args.includes(`--${name}`);
  }

  const format = getFlag('format') || 'text';

  function output(data: unknown): void {
    if (format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  try {
    switch (command) {
      case 'backup': {
        const type = hasFlag('incremental') ? 'incremental' : 'full';
        const sources = getFlag('source')?.split(',');
        const label = getFlag('label') || '';

        console.log(`Starting ${type} backup...`);
        const manifest = type === 'incremental'
          ? await engine.createIncrementalBackup(undefined, sources, { label })
          : await engine.createFullBackup(sources, { label });

        output({
          status: 'success',
          backupId: manifest.id,
          type: manifest.type,
          files: manifest.fileCount,
          originalSize: formatBytes(manifest.totalSizeBytes),
          compressedSize: formatBytes(manifest.compressedSizeBytes),
          timestamp: manifest.timestamp,
        });
        break;
      }

      case 'restore': {
        const backupId = args[1] || (hasFlag('latest') ? engine.getLatestManifest()?.id : undefined);
        const timestamp = getFlag('point-in-time');
        const target = getFlag('target');
        const sources = getFlag('source')?.split(',');

        if (timestamp) {
          const result = await engine.restoreToPointInTime(timestamp, target, sources);
          output({
            status: 'success',
            backupId: result.backupId,
            restoredFiles: result.restoredFiles,
            totalSize: formatBytes(result.totalBytes),
            targetDir: result.targetDir,
          });
        } else if (backupId) {
          const result = await engine.restoreBackup(backupId, target, sources);
          output({
            status: 'success',
            restoredFiles: result.restoredFiles,
            totalSize: formatBytes(result.totalBytes),
            targetDir: result.targetDir,
          });
        } else {
          console.error('Usage: restore <backup-id> | --latest | --point-in-time <timestamp>');
          process.exit(1);
        }
        break;
      }

      case 'verify': {
        if (hasFlag('all')) {
          const manifests = engine.listManifests();
          const results = manifests.map(m => engine.verifyBackup(m.id));
          output(results);
        } else {
          const backupId = args[1];
          if (!backupId) {
            console.error('Usage: verify <backup-id> | --all');
            process.exit(1);
          }
          output(engine.verifyBackup(backupId));
        }
        break;
      }

      case 'list': {
        if (hasFlag('restore-points')) {
          output(engine.listRestorePoints());
        } else if (hasFlag('schedules')) {
          output(engine.listSchedules());
        } else if (hasFlag('plans')) {
          output(engine.listRecoveryPlans());
        } else {
          const manifests = engine.listManifests();
          output(manifests.map(m => ({
            id: m.id,
            type: m.type,
            timestamp: m.timestamp,
            files: m.fileCount,
            size: formatBytes(m.compressedSizeBytes),
            status: m.status,
          })));
        }
        break;
      }

      case 'sources': {
        output(engine.discoverSources());
        break;
      }

      case 'stats': {
        output(engine.getStorageStats());
        break;
      }

      case 'schedule': {
        const action = args[1];
        if (action === 'create') {
          const name = getFlag('name') || 'Default Schedule';
          const cron = getFlag('cron') || '0 2 * * *';
          const type = (getFlag('type') as 'full' | 'incremental') || 'incremental';
          const sources = getFlag('source')?.split(',') || [];
          const retention = parseInt(getFlag('retention') || '30', 10);

          const schedule = engine.createSchedule({
            name,
            cronExpression: cron,
            type,
            sources,
            enabled: true,
            retentionDays: retention,
          });
          output(schedule);
        } else if (action === 'delete') {
          const id = args[2];
          if (!id) {
            console.error('Usage: schedule delete <schedule-id>');
            process.exit(1);
          }
          output({ deleted: engine.deleteSchedule(id) });
        } else {
          output(engine.listSchedules());
        }
        break;
      }

      case 'recovery-plan': {
        const businessName = args[1] || getFlag('business') || 'My Freelance Business';
        const criticalSources = getFlag('critical')?.split(',');
        const plan = engine.generateRecoveryPlan(businessName, { criticalSources });
        output(plan);
        break;
      }

      case 'retention': {
        const days = parseInt(getFlag('days') || '30', 10);
        const result = engine.applyRetentionPolicy(days);
        output(result);
        break;
      }

      case 'help':
      default:
        console.log(`
Cortex Freelancer — Backup & Recovery System (CFX-100)

COMMANDS:
  backup [--incremental] [--source name1,name2] [--label "desc"]
      Create a full or incremental backup

  restore <backup-id> [--target dir] [--source name]
  restore --latest [--target dir] [--source name]
  restore --point-in-time <ISO-timestamp> [--target dir]
      Restore data from a backup or point in time

  verify <backup-id>
  verify --all
      Verify backup integrity (checksums)

  list [--restore-points] [--schedules] [--plans]
      List backups, restore points, schedules, or recovery plans

  sources
      Discover available data sources for backup

  stats
      Show storage statistics and compression ratios

  schedule create --name "Name" --cron "0 2 * * *" --type incremental
  schedule delete <schedule-id>
  schedule
      Manage backup schedules

  recovery-plan [business-name] [--critical source1,source2]
      Generate a disaster recovery plan

  retention --days 30
      Apply retention policy (remove old backups)

OPTIONS:
  --format json|text    Output format (default: text)
  --source name         Filter by source name
  --target dir          Restore target directory
  --label "desc"        Backup description label
`);
        break;
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});

export default BackupEngine;
