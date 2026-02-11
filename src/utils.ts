import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ShellType } from './types.js';

/**
 * Mask a sensitive value for display
 * Shows first few chars and masks the rest with asterisks
 */
export function maskValue(value: string, revealChars: number = 4): string {
  if (value.length <= revealChars) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, revealChars) + '****';
}

/**
 * Detect the current shell type from environment
 */
export function detectShell(): ShellType {
  const shell = process.env.SHELL || '';
  
  if (shell.includes('fish')) {
    return 'fish';
  }
  if (shell.includes('zsh')) {
    return 'zsh';
  }
  if (shell.includes('bash')) {
    return 'bash';
  }
  
  return 'unknown';
}

/**
 * Get the global envize directory path
 */
export function getGlobalDir(): string {
  return path.join(os.homedir(), '.envize');
}

/**
 * Get the global profiles directory path
 */
export function getGlobalProfilesDir(): string {
  return path.join(getGlobalDir(), 'profiles');
}

/**
 * Get the local envize directory path (project-specific)
 */
export function getLocalDir(): string {
  return path.join(process.cwd(), '.envize');
}

/**
 * Get the local profiles directory path
 */
export function getLocalProfilesDir(): string {
  return path.join(getLocalDir(), 'profiles');
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the state file path
 */
export function getStatePath(): string {
  return path.join(getGlobalDir(), 'state.json');
}

/**
 * Get the active.sh file path for persist mode
 */
export function getActiveShPath(): string {
  return path.join(getGlobalDir(), 'active.sh');
}

/**
 * Get shell rc file path
 */
export function getShellRcPath(shell: ShellType): string | null {
  const home = os.homedir();
  
  switch (shell) {
    case 'bash':
      // Check for .bashrc first, then .bash_profile
      const bashrc = path.join(home, '.bashrc');
      const bashProfile = path.join(home, '.bash_profile');
      if (fs.existsSync(bashrc)) {
        return bashrc;
      }
      return bashProfile;
    case 'zsh':
      return path.join(home, '.zshrc');
    case 'fish':
      return path.join(home, '.config', 'fish', 'config.fish');
    default:
      return null;
  }
}

/**
 * Sanitize a value for safe shell usage (single-quoted)
 * Escapes single quotes by ending the string, adding escaped quote, and starting new string
 */
export function sanitizeForShell(value: string): string {
  // Replace ' with '\'' (end quote, escaped quote, start quote)
  return value.replace(/'/g, "'\\''");
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read file contents
 */
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Write file contents
 */
export function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Delete a file
 */
export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * List files in a directory with a specific extension
 */
export function listFiles(dirPath: string, extension: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  return fs.readdirSync(dirPath)
    .filter(file => file.endsWith(extension))
    .map(file => path.join(dirPath, file));
}
