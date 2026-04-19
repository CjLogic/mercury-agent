import type { Tool } from 'ai';
import { PermissionManager } from './permissions.js';
import { createReadFileTool } from './filesystem/read-file.js';
import { createWriteFileTool } from './filesystem/write-file.js';
import { createCreateFileTool } from './filesystem/create-file.js';
import { createListDirTool } from './filesystem/list-dir.js';
import { createDeleteFileTool } from './filesystem/delete-file.js';
import { createRunCommandTool } from './shell/run-command.js';
import { logger } from '../utils/logger.js';

export class CapabilityRegistry {
  readonly permissions: PermissionManager;
  private tools: Record<string, Tool> = {};

  constructor() {
    this.permissions = new PermissionManager();
    this.registerAll();
  }

  private registerAll(): void {
    const manifest = this.permissions.getManifest();

    if (manifest.capabilities.filesystem.enabled) {
      this.tools.read_file = createReadFileTool(this.permissions);
      this.tools.write_file = createWriteFileTool(this.permissions);
      this.tools.create_file = createCreateFileTool(this.permissions);
      this.tools.list_dir = createListDirTool(this.permissions);
      this.tools.delete_file = createDeleteFileTool(this.permissions);
      logger.info('Filesystem tools registered');
    }

    if (manifest.capabilities.shell.enabled) {
      this.tools.run_command = createRunCommandTool(this.permissions);
      logger.info('Shell tool registered');
    }
  }

  getTools(): Record<string, Tool> {
    return this.tools;
  }

  getToolNames(): string[] {
    return Object.keys(this.tools);
  }
}