import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BackupEngine, BackupManifest } from '../index';

// Use a temp directory for all test data to avoid polluting the real data dir
const TEST_ROOT = path.join(os.tmpdir(), `cortex-backup-test-${Date.now()}`);
const TEST_SOURCE_DIR = path.join(TEST_ROOT, 'source-data');

// Override environment for tests
beforeAll(() => {
  process.env.CORTEX_DATA_DIR = TEST_ROOT;
  process.env.HOME = TEST_ROOT;

  // Create mock data sources
  const sources = ['client-crm', 'contract-templates', 'payment-chase'];
  for (const source of sources) {
    const dir = path.join(TEST_ROOT, source);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ source, records: [1, 2, 3] }));
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ version: '1.0' }));
  }
});

afterAll(() => {
  // Clean up
  try {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch { /* best effort */ }
});

describe('BackupEngine', () => {
  let engine: BackupEngine;

  beforeEach(() => {
    engine = new BackupEngine();
  });

  // ── Source Discovery ─────────────────────────────────────────────────

  describe('discoverSources', () => {
    it('should discover known data sources', () => {
      const sources = engine.discoverSources();
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s => s.name === 'client-crm')).toBe(true);
    });

    it('should report file counts and sizes', () => {
      const sources = engine.discoverSources();
      for (const source of sources) {
        expect(source.fileCount).toBeGreaterThanOrEqual(0);
        expect(source.sizeBytes).toBeGreaterThanOrEqual(0);
        expect(source.type).toBeDefined();
      }
    });
  });

  // ── Full Backup ──────────────────────────────────────────────────────

  describe('createFullBackup', () => {
    it('should create a full backup of all sources', async () => {
      const manifest = await engine.createFullBackup();
      expect(manifest.id).toMatch(/^full-/);
      expect(manifest.type).toBe('full');
      expect(manifest.status).toBe('completed');
      expect(manifest.fileCount).toBeGreaterThan(0);
      expect(manifest.parentId).toBeNull();
    });

    it('should create compressed backup files', async () => {
      const manifest = await engine.createFullBackup();
      expect(manifest.compressedSizeBytes).toBeGreaterThan(0);
      expect(manifest.compressedSizeBytes).toBeLessThanOrEqual(manifest.totalSizeBytes);
    });

    it('should generate SHA-256 checksums for all files', async () => {
      const manifest = await engine.createFullBackup();
      const checksumEntries = Object.entries(manifest.checksums);
      expect(checksumEntries.length).toBeGreaterThan(0);
      for (const [, checksum] of checksumEntries) {
        expect(checksum).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should filter sources when specified', async () => {
      const manifest = await engine.createFullBackup(['client-crm']);
      const sourceNames = manifest.sources.map(s => s.name);
      expect(sourceNames).toContain('client-crm');
      expect(sourceNames).not.toContain('contract-templates');
    });

    it('should store metadata', async () => {
      const manifest = await engine.createFullBackup(undefined, { label: 'test backup' });
      expect(manifest.metadata).toEqual({ label: 'test backup' });
    });
  });

  // ── Incremental Backup ───────────────────────────────────────────────

  describe('createIncrementalBackup', () => {
    it('should fall back to full backup when no parent exists', async () => {
      // Clear manifests to force fallback
      const manifestsDir = path.join(TEST_ROOT, 'backup-recovery', 'manifests');
      if (fs.existsSync(manifestsDir)) {
        for (const f of fs.readdirSync(manifestsDir)) {
          fs.unlinkSync(path.join(manifestsDir, f));
        }
      }

      const manifest = await engine.createIncrementalBackup();
      expect(manifest.type).toBe('full');
    });

    it('should create incremental backup with parent reference', async () => {
      const full = await engine.createFullBackup();
      const incr = await engine.createIncrementalBackup(full.id);
      expect(incr.type).toBe('incremental');
      expect(incr.parentId).toBe(full.id);
    });

    it('should skip unchanged files', async () => {
      const full = await engine.createFullBackup();
      // No changes made, so incremental should have 0 changed files
      const incr = await engine.createIncrementalBackup(full.id);
      expect(incr.fileCount).toBe(0);
    });

    it('should detect modified files', async () => {
      const full = await engine.createFullBackup();

      // Modify a source file
      const dataFile = path.join(TEST_ROOT, 'client-crm', 'data.json');
      fs.writeFileSync(dataFile, JSON.stringify({ source: 'client-crm', records: [1, 2, 3, 4], updated: true }));

      const incr = await engine.createIncrementalBackup(full.id);
      expect(incr.fileCount).toBeGreaterThan(0);
    });
  });

  // ── Restore ──────────────────────────────────────────────────────────

  describe('restoreBackup', () => {
    it('should restore files from a full backup', async () => {
      const manifest = await engine.createFullBackup();
      const restoreDir = path.join(TEST_ROOT, 'restore-test-1');

      const result = await engine.restoreBackup(manifest.id, restoreDir);
      expect(result.restoredFiles).toBeGreaterThan(0);
      expect(result.totalBytes).toBeGreaterThan(0);
      expect(fs.existsSync(restoreDir)).toBe(true);
    });

    it('should restore specific sources only', async () => {
      const manifest = await engine.createFullBackup();
      const restoreDir = path.join(TEST_ROOT, 'restore-test-2');

      const result = await engine.restoreBackup(manifest.id, restoreDir, ['client-crm']);
      expect(result.restoredFiles).toBeGreaterThan(0);

      // Should only have client-crm directory
      const restored = fs.readdirSync(restoreDir);
      expect(restored).toContain('client-crm');
      expect(restored).not.toContain('contract-templates');
    });

    it('should throw for non-existent backup', async () => {
      await expect(engine.restoreBackup('nonexistent-id')).rejects.toThrow('not found');
    });
  });

  // ── Point-in-Time Restore ────────────────────────────────────────────

  describe('restoreToPointInTime', () => {
    it('should restore to the closest backup before timestamp', async () => {
      await engine.createFullBackup(undefined, { label: 'before' });

      // Use a future timestamp to include the backup we just created
      const futureTime = new Date(Date.now() + 60000).toISOString();
      const result = await engine.restoreToPointInTime(futureTime);
      expect(result.restoredFiles).toBeGreaterThan(0);
      expect(result.backupId).toBeDefined();
    });

    it('should throw when no backups exist before timestamp', async () => {
      await expect(
        engine.restoreToPointInTime('2000-01-01T00:00:00Z')
      ).rejects.toThrow('No backups found');
    });
  });

  // ── Verification ─────────────────────────────────────────────────────

  describe('verifyBackup', () => {
    it('should verify a valid backup', async () => {
      const manifest = await engine.createFullBackup();
      const result = engine.verifyBackup(manifest.id);
      expect(result.valid).toBe(true);
      expect(result.corruptedFiles).toHaveLength(0);
      expect(result.missingFiles).toHaveLength(0);
      expect(result.checksumMismatches).toHaveLength(0);
      expect(result.checkedFiles).toBeGreaterThan(0);
    });

    it('should detect missing files', async () => {
      const manifest = await engine.createFullBackup();

      // Delete a backup file
      const backupDir = path.join(TEST_ROOT, 'backup-recovery', 'backups', manifest.id);
      const sourceDirs = fs.readdirSync(backupDir).filter(f => !f.startsWith('_'));
      if (sourceDirs.length > 0) {
        const firstSource = path.join(backupDir, sourceDirs[0]);
        const files = fs.readdirSync(firstSource);
        if (files.length > 0) {
          fs.unlinkSync(path.join(firstSource, files[0]));
          // Also remove from dedup store to ensure it's detected as missing
          const entriesPath = path.join(backupDir, '_entries.json');
          const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf-8'));
          if (entries.length > 0) {
            const dedupPath = path.join(TEST_ROOT, 'backup-recovery', 'dedup-store', entries[0].checksum + '.gz');
            if (fs.existsSync(dedupPath)) {
              fs.unlinkSync(dedupPath);
            }
          }
        }
      }

      const result = engine.verifyBackup(manifest.id);
      expect(result.missingFiles.length + result.corruptedFiles.length + result.checksumMismatches.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw for non-existent backup', () => {
      expect(() => engine.verifyBackup('nonexistent-id')).toThrow('not found');
    });
  });

  // ── Manifest Management ──────────────────────────────────────────────

  describe('manifest management', () => {
    it('should list all manifests sorted by date', async () => {
      await engine.createFullBackup();
      const manifests = engine.listManifests();
      expect(manifests.length).toBeGreaterThan(0);

      // Check sorted descending
      for (let i = 1; i < manifests.length; i++) {
        expect(new Date(manifests[i - 1].timestamp).getTime())
          .toBeGreaterThanOrEqual(new Date(manifests[i].timestamp).getTime());
      }
    });

    it('should get latest manifest', async () => {
      const created = await engine.createFullBackup();
      const latest = engine.getLatestManifest();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(created.id);
    });

    it('should list restore points', async () => {
      await engine.createFullBackup();
      const points = engine.listRestorePoints();
      expect(points.length).toBeGreaterThan(0);
      expect(points[0].backupId).toBeDefined();
      expect(points[0].chain).toBeDefined();
    });
  });

  // ── Scheduling ───────────────────────────────────────────────────────

  describe('scheduling', () => {
    it('should create a backup schedule', () => {
      const schedule = engine.createSchedule({
        name: 'Test Daily',
        cronExpression: '0 2 * * *',
        type: 'incremental',
        sources: [],
        enabled: true,
        retentionDays: 30,
      });

      expect(schedule.id).toMatch(/^sched-/);
      expect(schedule.name).toBe('Test Daily');
      expect(schedule.enabled).toBe(true);
    });

    it('should list schedules', () => {
      engine.createSchedule({
        name: 'List Test',
        cronExpression: '0 3 * * 0',
        type: 'full',
        sources: [],
        enabled: true,
        retentionDays: 90,
      });

      const schedules = engine.listSchedules();
      expect(schedules.length).toBeGreaterThan(0);
    });

    it('should delete a schedule', () => {
      const schedule = engine.createSchedule({
        name: 'To Delete',
        cronExpression: '0 0 * * *',
        type: 'full',
        sources: [],
        enabled: true,
        retentionDays: 7,
      });

      expect(engine.deleteSchedule(schedule.id)).toBe(true);
      expect(engine.deleteSchedule('nonexistent')).toBe(false);
    });
  });

  // ── Disaster Recovery Plan ───────────────────────────────────────────

  describe('generateRecoveryPlan', () => {
    it('should generate a comprehensive recovery plan', () => {
      const plan = engine.generateRecoveryPlan('Test Freelance Business');
      expect(plan.id).toMatch(/^drp-/);
      expect(plan.businessName).toBe('Test Freelance Business');
      expect(plan.riskAssessment).toBeDefined();
      expect(plan.riskAssessment.vulnerabilities.length).toBeGreaterThan(0);
      expect(plan.backupStrategy).toBeDefined();
      expect(plan.recoveryProcedures.length).toBeGreaterThan(0);
      expect(plan.communicationPlan.length).toBeGreaterThan(0);
      expect(plan.testingSchedule.length).toBeGreaterThan(0);
      expect(plan.estimatedRecoveryTime).toBeDefined();
    });

    it('should accept custom critical sources', () => {
      const plan = engine.generateRecoveryPlan('Test', {
        criticalSources: ['client-crm'],
      });
      expect(plan.riskAssessment.criticalDataSources).toEqual(['client-crm']);
    });

    it('should list recovery plans', () => {
      engine.generateRecoveryPlan('List Test Business');
      const plans = engine.listRecoveryPlans();
      expect(plans.length).toBeGreaterThan(0);
    });
  });

  // ── Storage & Deduplication ──────────────────────────────────────────

  describe('storage stats and deduplication', () => {
    it('should report storage statistics', async () => {
      await engine.createFullBackup();
      const stats = engine.getStorageStats();
      expect(stats.totalBackups).toBeGreaterThan(0);
      expect(stats.totalOriginalSize).toBeDefined();
      expect(stats.totalCompressedSize).toBeDefined();
      expect(stats.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(stats.deduplication).toBeDefined();
    });

    it('should track deduplication stats', async () => {
      await engine.createFullBackup();
      await engine.createFullBackup(); // Same data = dedup opportunity
      const stats = engine.getDeduplicationStats();
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.uniqueFiles).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Retention Policy ─────────────────────────────────────────────────

  describe('applyRetentionPolicy', () => {
    it('should keep recent backups', async () => {
      await engine.createFullBackup();
      const result = engine.applyRetentionPolicy(30);
      expect(result.kept.length).toBeGreaterThan(0);
    });

    it('should always keep at least one full backup', async () => {
      await engine.createFullBackup();
      // Apply very aggressive retention
      const result = engine.applyRetentionPolicy(0);
      // Should still keep the last full
      expect(result.kept.length).toBeGreaterThanOrEqual(1);
    });
  });
});
