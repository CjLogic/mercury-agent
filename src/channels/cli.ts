import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { ChannelMessage } from '../types/channel.js';
import { BaseChannel } from './base.js';
import { logger } from '../utils/logger.js';
import { renderMarkdown } from '../utils/markdown.js';
import { selectWithArrowKeys, type ArrowSelectOption } from '../utils/arrow-select.js';

export class CLIChannel extends BaseChannel {
  readonly type = 'cli' as const;
  private rl: readline.Interface | null = null;
  private agentName: string;
  private menuDepth = 0;

  constructor(agentName: string = 'Mercury') {
    super();
    this.agentName = agentName;
  }

  setAgentName(name: string): void {
    this.agentName = name;
  }

  async start(): Promise<void> {
    this.createInterface();
    this.ready = true;
    this.showPrompt();
    logger.info('CLI channel started');
  }

  private createInterface(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '  You: ',
    });

    this.rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.showPrompt();
        return;
      }

      const msg: ChannelMessage = {
        id: Date.now().toString(36),
        channelId: 'cli',
        channelType: 'cli',
        senderId: 'owner',
        content: trimmed,
        timestamp: Date.now(),
      };
      this.emit(msg);
    });
  }

  async stop(): Promise<void> {
    this.rl?.close();
    this.rl = null;
    this.ready = false;
  }

  async send(content: string, _targetId?: string, elapsedMs?: number): Promise<void> {
    const timeStr = elapsedMs != null ? chalk.dim(` (${(elapsedMs / 1000).toFixed(1)}s)`) : '';
    const rendered = renderMarkdown(content);
    console.log('');
    console.log(chalk.cyan(`  ${this.agentName}:`) + timeStr);
    const indented = rendered
      .split('\n')
      .map((line: string) => `  ${line}`)
      .join('\n');
    console.log(indented);
    console.log('');
    if (this.menuDepth === 0) {
      this.showPrompt();
    }
  }

  async sendFile(filePath: string, _targetId?: string): Promise<void> {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      console.log(chalk.red(`  File not found: ${filePath}`));
      return;
    }
    const stat = fs.statSync(resolved);
    const sizeStr = stat.size > 1024 * 1024
      ? `${(stat.size / (1024 * 1024)).toFixed(1)}MB`
      : stat.size > 1024
        ? `${(stat.size / 1024).toFixed(1)}KB`
        : `${stat.size}B`;
    console.log('');
    console.log(chalk.cyan(`  ${this.agentName}:`) + chalk.dim(' (file)'));
    console.log(chalk.dim(`  path: ${resolved}`));
    console.log(chalk.dim(`  size: ${sizeStr}`));
    console.log('');
    if (this.menuDepth === 0) {
      this.showPrompt();
    }
  }

  async stream(content: AsyncIterable<string>, _targetId?: string): Promise<string> {
    console.log('');
    process.stdout.write(chalk.cyan(`  ${this.agentName}: `));
    let full = '';
    for await (const chunk of content) {
      process.stdout.write(chunk);
      full += chunk;
    }
    console.log('\n');
    if (this.menuDepth === 0) {
      this.showPrompt();
    }
    return full;
  }

  async typing(_targetId?: string): Promise<void> {
    process.stdout.write(chalk.dim(`  ${this.agentName} is thinking...\r`));
  }

  showPrompt(): void {
    if (this.rl) {
      this.rl.setPrompt('  You: ');
      this.rl.prompt();
    }
  }

  async withMenu<T>(runner: (select: (title: string, options: ArrowSelectOption[]) => Promise<string>) => Promise<T>): Promise<T> {
    this.menuDepth += 1;
    this.suspendPrompt();

    try {
      return await runner((title, options) => selectWithArrowKeys(title, options));
    } finally {
      this.menuDepth = Math.max(0, this.menuDepth - 1);
      if (this.menuDepth === 0) {
        this.resumePrompt();
        this.showPrompt();
      }
    }
  }

  private suspendPrompt(): void {
    if (!this.rl) return;
    process.stdout.write('\n');
    this.rl.close();
    this.rl = null;
  }

  private resumePrompt(): void {
    if (!this.ready || this.rl) return;
    this.createInterface();
  }

  async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl?.question(question, (answer) => resolve(answer.trim()));
    });
  }

  async askPermission(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      console.log('');
      console.log(chalk.yellow(`  ⚠ ${prompt}`));
      this.rl?.question(chalk.yellow('  > '), (answer) => {
        resolve(answer.trim());
      });
    });
  }
}
