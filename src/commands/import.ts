import { Command } from 'commander';
import * as path from 'node:path';
import { ProfileStore } from '../core/ProfileStore.js';
import { DotenvBridge } from '../core/DotenvBridge.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createImportCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  dotenvBridge: DotenvBridge
): Command {
  return new Command('import')
    .description('Import a .env file as a new profile')
    .argument('<file>', '.env file to import')
    .option('--name <name>', 'Profile name (defaults to filename without .env)')
    .option('--description <desc>', 'Profile description')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--global', 'Import to global ~/.envize/profiles/')
    .action(async (file: string, options) => {
      try {
        // Determine profile name
        const defaultName = path.basename(file, path.extname(file))
          .replace(/^\./, '')  // Remove leading dot
          .replace(/\.env$/, '');  // Remove trailing .env
        const profileName = options.name ?? defaultName;

        // Check if profile already exists
        if (store.profileExists(profileName)) {
          console.error(formatter.formatError(`Profile already exists: ${profileName}`));
          process.exit(1);
        }

        const tags = options.tags 
          ? options.tags.split(',').map((t: string) => t.trim()) 
          : undefined;

        const result = dotenvBridge.import(file, profileName, {
          local: !options.global,
          description: options.description,
          tags,
        });

        if (formatter['jsonMode']) {
          console.log(JSON.stringify({
            action: 'import',
            source: file,
            name: profileName,
            path: result.path,
            variableCount: result.variableCount,
          }, null, 2));
        } else {
          console.log(formatter.formatSuccess(`Imported: ${profileName}`));
          console.log(formatter.formatInfo(`Path: ${result.path}`));
          console.log(formatter.formatInfo(`Variables: ${result.variableCount}`));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
