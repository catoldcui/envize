import { Command } from 'commander';
import { ShellAdapter } from '../core/ShellAdapter.js';
import { detectShell } from '../utils.js';
import type { ShellType } from '../types.js';

export function createHookCommand(): Command {
  return new Command('hook')
    .description('Output shell hook for eval (add to your shell rc file)')
    .argument('[shell]', 'Shell type (bash, zsh, fish) - auto-detected if not specified')
    .action(async (shell?: string) => {
      const shellType: ShellType = (shell as ShellType) ?? detectShell();

      if (shellType === 'unknown') {
        console.error('Could not detect shell. Please specify: envize hook bash|zsh|fish');
        process.exit(1);
      }

      const adapter = new ShellAdapter(shellType);
      console.log(adapter.getShellWrapper());
    });
}
