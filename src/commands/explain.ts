import { Command } from 'commander';
import { StateManager } from '../core/StateManager.js';
import { OutputFormatter } from '../core/OutputFormatter.js';
import type { StatusOutput } from '../types.js';

export function createExplainCommand(
  formatter: OutputFormatter,
  stateManager: StateManager
): Command {
  return new Command('explain')
    .description('Describe current env state in plain text for LLM context')
    .action(async () => {
      try {
        const state = stateManager.load();
        
        const status: StatusOutput = {
          active_profiles: state.active_profiles,
          variables: state.variables,
          applied_at: state.applied_at,
        };

        if (formatter['jsonMode']) {
          // In JSON mode, still output plain text but wrapped
          console.log(JSON.stringify({
            explain: formatter.formatExplain(status),
          }, null, 2));
        } else {
          console.log(formatter.formatExplain(status));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
