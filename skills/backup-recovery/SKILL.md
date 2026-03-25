# Backup & Recovery System — OpenClaw Skill

> **CFX-100** - Comprehensive backup and recovery system for freelancer data with incremental backups, point-in-time restore, integrity verification, and disaster recovery planning.

---

## Core Capabilities

The Backup & Recovery System provides end-to-end data protection for freelancer businesses:

- **Full & Incremental Backups** — Automated backup of all freelancer data (clients, proposals, contracts, invoices, projects, portfolios)
- **Point-in-Time Restore** — Recover data to any previous backup snapshot
- **Integrity Verification** — SHA-256 checksum validation for every backed-up file
- **Storage Optimization** — Gzip compression and content-addressable deduplication
- **Disaster Recovery Planning** — Auto-generated recovery plans tailored to your business
- **Backup Scheduling** — Configurable schedules with retention policies
- **Cortex Ecosystem Integration** — Automatic discovery of all Cortex Freelancer data sources

## Usage Patterns

### Quick Full Backup
```javascript
const { BackupRecoverySkill } = require('./src/tools/backup-recovery/skill');
const backup = new BackupRecoverySkill();

// Back up everything
const result = await backup.createFullBackup({ label: 'Weekly backup' });
console.log(`Backup ${result.backupId}: ${result.files} files (${result.compressedSize})`);
```

### Incremental Backup (Changed Files Only)
```javascript
// Only backs up files changed since the last backup
const result = await backup.createIncrementalBackup({ label: 'Daily incremental' });
console.log(`Incremental: ${result.files} changed files backed up`);
```

### Selective Source Backup
```javascript
// Back up only specific data sources
const result = await backup.createFullBackup({
  sources: ['client-crm', 'contract-templates', 'payment-chase'],
  label: 'Critical data backup'
});
```

### Restore from Backup
```javascript
// Restore from a specific backup
const restored = await backup.restore('full-abc123', {
  target: '/tmp/restore-test'
});
console.log(`Restored ${restored.restoredFiles} files to ${restored.targetDir}`);

// Restore the latest backup
const latest = await backup.restoreLatest();

// Restore to a specific point in time
const pitRestore = await backup.restoreToPointInTime('2026-03-20T14:00:00Z');
console.log(`Restored from backup ${pitRestore.backupId}`);
```

### Verify Backup Integrity
```javascript
// Verify a specific backup
const verification = await backup.verify('full-abc123');
console.log(`Valid: ${verification.valid}, Checked: ${verification.checkedFiles} files`);

// Verify all backups
const allResults = await backup.verify();
```

### Disaster Recovery Plan
```javascript
// Generate a tailored disaster recovery plan
const plan = await backup.generateRecoveryPlan('Acme Freelance Studio', {
  criticalSources: ['client-crm', 'contract-templates', 'payment-chase']
});

console.log(`Risk Level: ${plan.riskAssessment.riskLevel}`);
console.log(`Recovery Time: ${plan.estimatedRecoveryTime}`);
console.log(`Procedures: ${plan.recoveryProcedures.length} scenarios covered`);
```

### Backup Scheduling
```javascript
// Create a daily incremental backup schedule
const schedule = await backup.createSchedule({
  name: 'Daily Incremental',
  cron: '0 2 * * *',       // 2 AM daily
  type: 'incremental',
  sources: [],               // all sources
  retention: 30              // keep for 30 days
});

// Create a weekly full backup schedule
await backup.createSchedule({
  name: 'Weekly Full',
  cron: '0 3 * * 0',        // 3 AM every Sunday
  type: 'full',
  retention: 90
});

// List schedules
const schedules = await backup.listSchedules();
```

### Storage Statistics
```javascript
const stats = await backup.getStats();
console.log(`Total Backups: ${stats.totalBackups}`);
console.log(`Compression: ${stats.compressionRatio}% saved`);
console.log(`Dedup Ratio: ${stats.deduplication.deduplicationRatio}%`);
console.log(`Storage: ${stats.totalCompressedSize} (from ${stats.totalOriginalSize})`);
```

### Retention Policy
```javascript
// Remove backups older than 60 days (keeps at least one full backup)
const result = await backup.applyRetention(60);
console.log(`Removed: ${result.removed.length}, Kept: ${result.kept.length}`);
```

## CLI Command Reference

### Backup Commands
```bash
# Full backup of all sources
npx ts-node index.ts backup [--label "description"]

# Incremental backup (only changed files)
npx ts-node index.ts backup --incremental

# Back up specific sources only
npx ts-node index.ts backup --source client-crm,contract-templates
```

### Restore Commands
```bash
# Restore from specific backup
npx ts-node index.ts restore <backup-id> [--target /path/to/restore]

# Restore from latest backup
npx ts-node index.ts restore --latest

# Point-in-time restore
npx ts-node index.ts restore --point-in-time "2026-03-20T14:00:00Z"

# Restore specific sources only
npx ts-node index.ts restore --latest --source client-crm
```

### Verification Commands
```bash
# Verify specific backup integrity
npx ts-node index.ts verify <backup-id>

# Verify all backups
npx ts-node index.ts verify --all
```

### Listing & Discovery Commands
```bash
# List all backups
npx ts-node index.ts list [--format json]

# List restore points
npx ts-node index.ts list --restore-points

# Discover data sources
npx ts-node index.ts sources

# Storage statistics
npx ts-node index.ts stats
```

### Schedule Commands
```bash
# Create a backup schedule
npx ts-node index.ts schedule create --name "Daily" --cron "0 2 * * *" --type incremental

# List schedules
npx ts-node index.ts schedule

# Delete a schedule
npx ts-node index.ts schedule delete <schedule-id>
```

### Recovery & Maintenance Commands
```bash
# Generate disaster recovery plan
npx ts-node index.ts recovery-plan "My Business" [--critical client-crm,contracts]

# Apply retention policy
npx ts-node index.ts retention --days 30
```

## Integration with Cortex Freelancer Ecosystem

### Auto-Discovered Data Sources
The system automatically discovers and backs up data from these Cortex tools:

| Source | Type | Description |
|--------|------|-------------|
| `client-crm` | clients | Client contact info, relationship history, scoring |
| `proposals` | proposals | Proposal drafts, templates, and submission records |
| `contract-templates` | contracts | Contract templates, generated contracts, clauses |
| `payment-chase` | invoices | Invoice tracking, payment chase sequences |
| `project-lifecycle` | projects | Project milestones, deliverables, timelines |
| `portfolio-optimizer` | portfolios | Portfolio data, analytics, A/B tests |
| `analytics` | analytics | Cross-tool analytics and reporting data |
| `config` | config | Tool configurations and settings |

### Automation Workflow
```javascript
// Automated backup + verify + cleanup pipeline
const backup = new BackupRecoverySkill();

// 1. Create incremental backup
const result = await backup.createIncrementalBackup({ label: 'Automated daily' });

// 2. Verify the new backup
const verification = await backup.verify(result.backupId);
if (!verification.valid) {
  console.error('Backup verification failed! Creating full backup...');
  await backup.createFullBackup({ label: 'Recovery full backup' });
}

// 3. Apply retention policy
await backup.applyRetention(30);

// 4. Report stats
const stats = await backup.getStats();
console.log(`Backup health: ${stats.totalBackups} backups, ${stats.totalCompressedSize} stored`);
```

## Data Storage & Security

### File Structure
```
~/.cortex-freelancer/backup-recovery/
├── backups/            # Compressed backup archives (per backup ID)
├── manifests/          # Backup manifests with checksums and metadata
├── schedules/          # Backup schedule configurations
├── recovery-plans/     # Generated disaster recovery plans
└── dedup-store/        # Content-addressable deduplication store
```

### Security Features
- **SHA-256 checksums** for every file — detect corruption or tampering
- **Gzip compression** — reduce storage footprint
- **Content-addressable dedup** — identical files stored only once
- **Retention policies** — automatic cleanup of old backups
- **Chain verification** — incremental backups validated against parent chain

## Quality Assurance

### Comprehensive Testing
- **Unit tests** covering backup engine, restore, verification, scheduling
- **Integration tests** for full backup/restore workflows
- **Edge case coverage** — empty sources, corrupted files, missing parents
- **Jest testing framework** with coverage reporting

### Code Quality
- **TypeScript strict mode** for type safety
- **Comprehensive error handling** — graceful degradation on file access errors
- **Modular architecture** — engine, CLI, and skill wrapper separated

---

## Installation & Setup

1. **Navigate to tool directory**:
   ```bash
   cd src/tools/backup-recovery
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build TypeScript**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Create first backup**:
   ```bash
   npm run backup
   ```

---

**CFX-100 Implementation Complete**

*The Backup & Recovery System provides comprehensive data protection for freelancer businesses with automated backups, point-in-time restore, integrity verification, and disaster recovery planning — fully integrated with the Cortex Freelancer tool ecosystem.*
