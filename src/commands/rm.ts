import { Command } from 'commander';
import * as readline from 'node:readline';
import { ProfileStore } from '../core/ProfileStore.js';
import { StateManager } from '../core/StateManager.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createRmCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  stateManager: StateManager
): Command {
  return new Command('rm')
    .description('Delete a profile')
    .argument('<name>', 'Profile name to delete')
    .option('-f, --force', 'Skip confirmation')
    .action(async (name: string, options) => {
      try {
        const profile = store.loadProfile(name);
        
        if (!profile) {
          console.error(formatter.formatError(`Profile not found: ${name}`));
          process.exit(1);
        }

        // Check if profile is currently active
        const activeProfiles = stateManager.getActiveProfiles();
        if (activeProfiles.includes(name)) {
          console.error(formatter.formatWarning(`Profile "${name}" is currently active.`));
          console.error(formatter.formatInfo('Run "envize remove ' + name + '" first to deactivate it.'));
          
          if (!options.force) {
            process.exit(1);
          }
        }

        // Confirm deletion
        if (!options.force && process.stdin.isTTY) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const confirmed = await new Promise<boolean>((resolve) => {
            rl.question(`Delete profile "${name}" at ${profile.path}? [y/N] `, (answer) => {
              rl.close();
              resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
          });

          if (!confirmed) {
            console.log(formatter.formatInfo('Cancelled'));
            return;
          }
        }

        // Delete the profile
        const deleted = store.deleteProfile(name);

        if (deleted) {
          if (formatter['jsonMode']) {
            console.log(JSON.stringify({
              action: 'rm',
              name,
              path: profile.path,
              deleted: true,
            }, null, 2));
          } else {
            console.log(formatter.formatSuccess(`Deleted profile: ${name}`));
          }
        } else {
          console.error(formatter.formatError(`Failed to delete profile: ${name}`));
          process.exit(1);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
