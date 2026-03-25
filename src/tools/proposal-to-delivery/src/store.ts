/**
 * File-based Workflow Store
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Workflow, WorkflowStore } from './types';

export interface StoreConfig {
  baseDir?: string;
  fileName?: string;
}

export class FileWorkflowStore {
  private dir: string;
  private file: string;

  constructor(config: StoreConfig = {}) {
    this.dir = config.baseDir || path.join(os.homedir(), '.cortex-freelancer', 'p2d');
    this.file = path.join(this.dir, config.fileName || 'workflows.json');
    this.ensure();
  }

  private ensure(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }

    if (!fs.existsSync(this.file)) {
      const initial: WorkflowStore = {
        workflows: {},
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(this.file, JSON.stringify(initial, null, 2));
    }
  }

  load(): WorkflowStore {
    this.ensure();
    const raw = fs.readFileSync(this.file, 'utf-8');
    return JSON.parse(raw) as WorkflowStore;
  }

  save(store: WorkflowStore): void {
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.file, JSON.stringify(store, null, 2));
  }

  getAll(): Workflow[] {
    const store = this.load();
    return Object.values(store.workflows);
  }

  get(id: string): Workflow | undefined {
    const store = this.load();
    return store.workflows[id];
  }

  upsert(workflow: Workflow): Workflow {
    const store = this.load();
    store.workflows[workflow.id] = workflow;
    this.save(store);
    return workflow;
  }

  delete(id: string): boolean {
    const store = this.load();
    if (!store.workflows[id]) return false;
    delete store.workflows[id];
    this.save(store);
    return true;
  }
}
