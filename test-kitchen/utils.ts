import { execFile as execFileCallback, ExecFileOptions } from 'child_process';
import { promisify } from 'util';
import { mkdtempSync } from 'fs';
import path from 'path';
import os from 'os';

export const promisifyExecFile = promisify(execFileCallback);

export async function execFile(file: string, args: string[], opts: ExecFileOptions = {}) {
  try {
    const { stdout, stderr } = await promisifyExecFile(file, args, opts);
    return { stdout, stderr };
  } catch (error: any) {
    throw new Error(`${error.message}\nstderr: ${error.stderr}\nstdout: ${error.stdout}`);
  }
}

export function createTempDir(prefix: string = 'atlas-test'): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

export function countActions(text: string): number {
  const actionKeywords = [
    'navigate',
    'click',
    'type',
    'scroll',
    'press',
    'wait',
    'hover',
    'drag',
  ];
  return actionKeywords.reduce((count, keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    return count + (text.match(regex) || []).length;
  }, 0);
}

