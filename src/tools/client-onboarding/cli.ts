/**
 * Client Onboarding CLI
 *
 * Commands:
 *  - onboarding create
 *  - onboarding sequence
 *  - onboarding track
 *  - onboarding funnel
 *  - onboarding optimize
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { ClientOnboardingSystem } from './index';
import { OnboardingSequenceBuilder } from './sequences';
import { ConversionFunnelTracker } from './funnel';
import { MetricsTracker } from './metrics';
import { TemplateLibrary, ClientType } from './templates';
import { IntakeAutomation } from './intake';

export class CLI {
  private program: Command;
  private system: ClientOnboardingSystem;
  private dataDir: string;

  // Lightweight persistence for sequences (demo-grade)
  private sequencesFile: string;

  constructor(system?: ClientOnboardingSystem, dataDir?: string) {
    this.system = system || new ClientOnboardingSystem();
    this.dataDir = dataDir || process.env.CORTEX_ONBOARDING_DATA || path.join(process.cwd(), 'data', 'onboarding');
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.sequencesFile = path.join(this.dataDir, 'sequences.json');

    this.program = new Command();
    this.buildCommands();
  }

  getProgram(): Command {
    return this.program;
  }

  async run(argv: string[] = process.argv): Promise<void> {
    await this.program.parseAsync(argv);
  }

  private buildCommands(): void {
    this.program
      .name('cortex-onboarding')
      .description('Cortex Freelancer — Client Onboarding Automation')
      .version('1.0.0');

    // onboarding create
    this.program
      .command('create')
      .description('Create a new onboarding flow for a client')
      .requiredOption('-n, --name <name>', 'Client name')
      .requiredOption('-e, --email <email>', 'Client email')
      .option('-t, --type <type>', 'Client type: enterprise|smb|individual|startup|agency', 'smb')
      .option('-p, --project <projectType>', 'Project type', 'general')
      .option('-b, --budget <budget>', 'Estimated budget (number)')
      .option('--timezone <tz>', 'Client timezone', 'America/New_York')
      .action(async (opts) => {
        const intake = new IntakeAutomation();
        const clientProfile = await intake.processClient({
          name: opts.name,
          email: opts.email,
          projectType: opts.project,
          budget: opts.budget ? Number(opts.budget) : undefined,
          timezone: opts.timezone,
          type: opts.type
        });

        // Force requested type if provided
        const type = (opts.type || 'smb').toLowerCase();
        const normalizedType = (Object.values(ClientType) as string[]).includes(type) ? (type as ClientType) : ClientType.SMB;
        (clientProfile as any).type = normalizedType;

        const templates = new TemplateLibrary();
        const template = templates.getTemplateForClient(normalizedType, opts.project);

        const builder = new OnboardingSequenceBuilder();
        const sequence = builder.buildStandardSequence(clientProfile);
        sequence.templateId = template.id;
        sequence.name = `${opts.name} — ${template.name}`;

        this.saveSequence(sequence);

        console.log(JSON.stringify({ ok: true, sequenceId: sequence.id, name: sequence.name }, null, 2));
      });

    // onboarding sequence
    this.program
      .command('sequence')
      .description('Show a sequence and its steps')
      .requiredOption('-i, --id <sequenceId>', 'Sequence id')
      .action(async (opts) => {
        const seq = this.loadSequence(opts.id);
        if (!seq) {
          console.error('Sequence not found');
          process.exit(1);
        }
        console.log(JSON.stringify(seq, null, 2));
      });

    // onboarding track
    this.program
      .command('track')
      .description('Track an event in the onboarding pipeline')
      .requiredOption('-i, --id <sequenceId>', 'Sequence id')
      .requiredOption('-s, --step <stepName>', 'Step name (e.g., "Contract Signing")')
      .requiredOption('--event <type>', 'Event type: started|completed|dropped_off')
      .option('--minutes <n>', 'Time spent minutes')
      .action(async (opts) => {
        const seq = this.loadSequence(opts.id);
        if (!seq) {
          console.error('Sequence not found');
          process.exit(1);
        }

        const tracker = new MetricsTracker(this.dataDir);
        tracker.trackEvent({
          sequenceId: seq.id,
          clientId: seq.clientId,
          name: opts.step,
          type: opts.event,
          at: new Date(),
          timeSpentMinutes: opts.minutes ? Number(opts.minutes) : undefined
        });

        console.log(JSON.stringify({ ok: true }, null, 2));
      });

    // onboarding funnel
    this.program
      .command('funnel')
      .description('Analyze conversion funnel for onboarding')
      .action(async () => {
        // In this module version, funnel uses in-memory events; metrics has persisted events.
        // We convert persisted events into a simplified funnel output.
        const tracker = new MetricsTracker(this.dataDir);
        const metrics = await tracker.getMetrics();
        console.log(JSON.stringify({
          completionRate: metrics.completionRate,
          dropoffByStep: metrics.dropoffByStep,
          averageTimeToKickoffDays: metrics.averageTimeToKickoff,
          averageTimeToFirstDeliverableDays: metrics.averageTimeToFirstDeliverable
        }, null, 2));
      });

    // onboarding optimize
    this.program
      .command('optimize')
      .description('Get recommendations to improve onboarding conversion and speed')
      .action(async () => {
        const tracker = new MetricsTracker(this.dataDir);
        const recs = await tracker.recommendImprovements();
        console.log(JSON.stringify({ recommendations: recs }, null, 2));
      });
  }

  private loadSequences(): any[] {
    if (!fs.existsSync(this.sequencesFile)) return [];
    return JSON.parse(fs.readFileSync(this.sequencesFile, 'utf8'));
  }

  private loadSequence(id: string): any | null {
    const seqs = this.loadSequences();
    return seqs.find((s: any) => s.id === id) || null;
  }

  private saveSequence(sequence: any): void {
    const seqs = this.loadSequences();
    const next = [...seqs.filter((s: any) => s.id !== sequence.id), sequence];
    fs.writeFileSync(this.sequencesFile, JSON.stringify(next, null, 2));
  }
}

export function createCLI(system?: ClientOnboardingSystem, dataDir?: string): Command {
  const cli = new CLI(system, dataDir);
  return cli.getProgram();
}