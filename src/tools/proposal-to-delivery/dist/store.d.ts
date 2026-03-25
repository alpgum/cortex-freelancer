/**
 * File-based Workflow Store
 */
import { Workflow, WorkflowStore } from './types';
export interface StoreConfig {
    baseDir?: string;
    fileName?: string;
}
export declare class FileWorkflowStore {
    private dir;
    private file;
    constructor(config?: StoreConfig);
    private ensure;
    load(): WorkflowStore;
    save(store: WorkflowStore): void;
    getAll(): Workflow[];
    get(id: string): Workflow | undefined;
    upsert(workflow: Workflow): Workflow;
    delete(id: string): boolean;
}
//# sourceMappingURL=store.d.ts.map