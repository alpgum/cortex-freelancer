"use strict";
/**
 * File-based Workflow Store
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWorkflowStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class FileWorkflowStore {
    constructor(config = {}) {
        this.dir = config.baseDir || path.join(os.homedir(), '.cortex-freelancer', 'p2d');
        this.file = path.join(this.dir, config.fileName || 'workflows.json');
        this.ensure();
    }
    ensure() {
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true });
        }
        if (!fs.existsSync(this.file)) {
            const initial = {
                workflows: {},
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
            };
            fs.writeFileSync(this.file, JSON.stringify(initial, null, 2));
        }
    }
    load() {
        this.ensure();
        const raw = fs.readFileSync(this.file, 'utf-8');
        return JSON.parse(raw);
    }
    save(store) {
        store.lastUpdated = new Date().toISOString();
        fs.writeFileSync(this.file, JSON.stringify(store, null, 2));
    }
    getAll() {
        const store = this.load();
        return Object.values(store.workflows);
    }
    get(id) {
        const store = this.load();
        return store.workflows[id];
    }
    upsert(workflow) {
        const store = this.load();
        store.workflows[workflow.id] = workflow;
        this.save(store);
        return workflow;
    }
    delete(id) {
        const store = this.load();
        if (!store.workflows[id])
            return false;
        delete store.workflows[id];
        this.save(store);
        return true;
    }
}
exports.FileWorkflowStore = FileWorkflowStore;
//# sourceMappingURL=store.js.map