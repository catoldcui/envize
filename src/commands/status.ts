import { Command } from 'commander';
import { StateManager } from '../core/StateManager.js';
import { OutputFormatter } from '../core/OutputFormatter.js';
import type { StatusOutput } from '../types.js';

export function createStatusCommand(
  formatter: OutputFormatter,
  stateManager: StateManager
): Command {
  return new Command('status')
    .description('Show active profiles and all set variables with source')
    .option('--reveal', 'Show full variable values (not masked)')
    .action(async (options) => {
      try {
        const state = stateManager.load();
        
        const status: StatusOutput = {
          active_profiles: state.active_profiles,
          variables: state.variables,
          applied_at: state.applied_at,
        };

        if (formatter['jsonMode']) {
          // In JSON mode, optionally mask values
          const output = options.reveal ? status : {
            ...status,
            variables: Object.fromEntries(
              Object.entries(status.variables).map(([key, envVar]) => [
                key,
                {
                  ...envVar,
                  value: options.reveal ? envVar.value : maskValue(envVar.value),
                },
              ])
            ),
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(formatter.formatStatus(status, options.reveal));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}

function maskValue(value: string, revealChars: number = 4): string {
  if (value.length <= revealChars) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, revealChars) + '****';
}
