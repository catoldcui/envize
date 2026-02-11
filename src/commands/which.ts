import { Command } from 'commander';
import { StateManager } from '../core/StateManager.js';
import { OutputFormatter } from '../core/OutputFormatter.js';
import { maskValue } from '../utils.js';
import type { WhichOutput } from '../types.js';

export function createWhichCommand(
  formatter: OutputFormatter,
  stateManager: StateManager
): Command {
  return new Command('which')
    .description('Show which profile set a variable and its value')
    .argument('<variable>', 'Variable name to look up')
    .option('--reveal', 'Show full variable value (not masked)')
    .action(async (variable: string, options) => {
      try {
        const state = stateManager.load();
        const envVar = state.variables[variable];

        if (!envVar) {
          if (formatter['jsonMode']) {
            console.log(JSON.stringify({ variable, found: false }, null, 2));
          } else {
            console.log(formatter.formatWhich(null, options.reveal));
          }
          return;
        }

        const which: WhichOutput = {
          variable,
          value: envVar.value,
          source: envVar.source,
          masked_value: maskValue(envVar.value),
        };

        if (formatter['jsonMode']) {
          console.log(JSON.stringify({
            variable,
            found: true,
            value: options.reveal ? which.value : which.masked_value,
            source: which.source,
          }, null, 2));
        } else {
          console.log(formatter.formatWhich(which, options.reveal));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
