import { Command } from 'commander';
import { ShellAdapter } from '../core/ShellAdapter.js';
import { StateManager } from '../core/StateManager.js';
import { SystemEnvWriter } from '../core/SystemEnvWriter.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createResetCommand(
  formatter: OutputFormatter,
  stateManager: StateManager,
  shellAdapter: ShellAdapter,
  systemEnvWriter: SystemEnvWriter
): Command {
  return new Command('reset')
    .description('Restore shell to pre-envize state (removes all)')
    .option('-g, --global', 'Also clear global (cross-session) state')
    .option('--emit-shell', 'Output shell commands for eval')
    .option('--emit-human', 'Output human-readable confirmation')
    .action(async (options) => {
      try {
        const state = stateManager.load();

        if (!stateManager.hasActiveProfiles()) {
          // Still need to clear global file if --global is specified
          if (options.global) {
            systemEnvWriter.clear();
          }

          if (options.emitShell) {
            console.log('');
            return;
          }
          console.log(formatter.formatInfo('No active profiles to reset'));
          return;
        }

        // Collect variables to unset and values to restore
        const toUnset: string[] = [];
        const toRestore: Record<string, string> = {};
        let restoredCount = 0;

        for (const [key, envVar] of Object.entries(state.variables)) {
          const snapshotValue = state.snapshot[key];
          
          if (snapshotValue === null || snapshotValue === undefined) {
            // Variable didn't exist before envize
            toUnset.push(key);
          } else {
            // Variable had a previous value - restore it
            toRestore[key] = snapshotValue;
            restoredCount++;
          }
        }

        // Output mode handling
        if (options.emitShell) {
          // Generate unset commands for variables that should be removed
          const unsetCommands = shellAdapter.generateUnsets(toUnset);
          // Generate export commands for variables that should be restored
          const restoreCommands = shellAdapter.generateExports(toRestore);
          
          const commands = [unsetCommands, restoreCommands].filter(Boolean).join('\n');
          console.log(commands);
          
          // Clear state
          stateManager.clear();
          
          if (options.global) {
            systemEnvWriter.clear();
          }
          
          return;
        }

        if (options.emitHuman) {
          const message = formatter.formatReset(toUnset.length, restoredCount);
          console.error(message);
          return;
        }

        // Default mode
        stateManager.clear();

        if (options.global) {
          systemEnvWriter.clear();
        }

        if (formatter['jsonMode']) {
          const output = {
            action: 'reset',
            unset_variables: toUnset,
            restored_variables: Object.keys(toRestore),
            global: options.global ?? false,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(formatter.formatReset(toUnset.length, restoredCount));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
