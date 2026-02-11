import { Command } from 'commander';
import { ProfileStore } from '../core/ProfileStore.js';
import { StateManager } from '../core/StateManager.js';
import { DotenvBridge } from '../core/DotenvBridge.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createExportCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  stateManager: StateManager,
  dotenvBridge: DotenvBridge
): Command {
  return new Command('export')
    .description('Export active state as a .env file')
    .option('--dotenv', 'Output in .env format (default)')
    .option('--reveal', 'Show full values (not masked)')
    .option('--profiles <names>', 'Export specific profiles (comma-separated)')
    .option('-o, --output <file>', 'Write to file instead of stdout')
    .action(async (options) => {
      try {
        let content: string;

        if (options.profiles) {
          // Export specific profiles
          const profileNames = options.profiles.split(',').map((p: string) => p.trim());
          
          // Validate profiles exist
          for (const name of profileNames) {
            if (!store.profileExists(name)) {
              console.error(formatter.formatError(`Profile not found: ${name}`));
              process.exit(1);
            }
          }

          content = dotenvBridge.exportProfiles(profileNames, {
            reveal: options.reveal,
            outputPath: options.output,
          });
        } else {
          // Export active state
          const state = stateManager.load();
          
          if (Object.keys(state.variables).length === 0) {
            if (!options.output) {
              console.error(formatter.formatInfo('No active variables to export'));
            }
            return;
          }

          content = dotenvBridge.export(state.variables, {
            reveal: options.reveal,
            outputPath: options.output,
          });
        }

        if (!options.output) {
          // Output to stdout
          console.log(content);
        } else {
          if (formatter['jsonMode']) {
            console.log(JSON.stringify({
              action: 'export',
              output: options.output,
              reveal: options.reveal ?? false,
            }, null, 2));
          } else {
            console.error(formatter.formatSuccess(`Exported to: ${options.output}`));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
