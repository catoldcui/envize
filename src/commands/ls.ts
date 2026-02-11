import { Command } from 'commander';
import { ProfileStore } from '../core/ProfileStore.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createLsCommand(
  formatter: OutputFormatter,
  store: ProfileStore
): Command {
  return new Command('ls')
    .description('List all available profiles (global + local)')
    .option('--verbose', 'Show descriptions and tags')
    .action(async (options) => {
      try {
        const profiles = store.listProfiles();

        if (formatter['jsonMode']) {
          console.log(JSON.stringify(profiles, null, 2));
        } else {
          console.log(formatter.formatProfileList(profiles, options.verbose));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
