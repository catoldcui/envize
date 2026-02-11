import { Command } from 'commander';
import * as readline from 'node:readline';
import { ProfileStore } from '../core/ProfileStore.js';
import { OutputFormatter } from '../core/OutputFormatter.js';
import type { ProfileMetadata } from '../types.js';

export function createCreateCommand(
  formatter: OutputFormatter,
  store: ProfileStore
): Command {
  return new Command('create')
    .description('Create a new profile interactively')
    .argument('<name>', 'Profile name')
    .option('--local', 'Create in local .envize/profiles/ (default)')
    .option('--global', 'Create in global ~/.envize/profiles/')
    .option('--description <desc>', 'Profile description')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (name: string, options) => {
      try {
        // Check if profile already exists
        if (store.profileExists(name)) {
          console.error(formatter.formatError(`Profile already exists: ${name}`));
          process.exit(1);
        }

        const isLocal = !options.global;
        let description = options.description ?? '';
        let tags: string[] = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];

        // Interactive mode if no description provided
        if (!options.description && process.stdin.isTTY) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const question = (prompt: string): Promise<string> => {
            return new Promise((resolve) => {
              rl.question(prompt, resolve);
            });
          };

          description = await question('Description: ');
          const tagsInput = await question('Tags (comma-separated): ');
          tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

          rl.close();
        }

        const metadata: ProfileMetadata = {
          description: description || `Profile ${name}`,
          tags,
        };

        // Create empty profile with metadata
        const content = store.generateProfileContent(metadata, {});
        const profilePath = store.saveProfile(name, content, isLocal);

        if (formatter['jsonMode']) {
          console.log(JSON.stringify({
            action: 'create',
            name,
            path: profilePath,
            local: isLocal,
          }, null, 2));
        } else {
          console.log(formatter.formatSuccess(`Created profile: ${name}`));
          console.log(formatter.formatInfo(`Path: ${profilePath}`));
          console.log('');
          console.log(formatter.formatInfo('Add variables by editing the file or use:'));
          console.log(`  envize edit ${name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
