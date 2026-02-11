import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { ProfileStore } from '../core/ProfileStore.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createEditCommand(
  formatter: OutputFormatter,
  store: ProfileStore
): Command {
  return new Command('edit')
    .description('Edit an existing profile (opens in $EDITOR)')
    .argument('<name>', 'Profile name to edit')
    .action(async (name: string) => {
      try {
        const profile = store.loadProfile(name);
        
        if (!profile) {
          console.error(formatter.formatError(`Profile not found: ${name}`));
          process.exit(1);
        }

        const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
        
        if (formatter['jsonMode']) {
          // In JSON mode, just output the path
          console.log(JSON.stringify({
            action: 'edit',
            name,
            path: profile.path,
            editor,
          }, null, 2));
          return;
        }

        console.log(formatter.formatInfo(`Opening ${profile.path} in ${editor}...`));

        // Spawn editor
        const child = spawn(editor, [profile.path], {
          stdio: 'inherit',
          shell: true,
        });

        child.on('error', (error) => {
          console.error(formatter.formatError(`Failed to open editor: ${error.message}`));
          process.exit(1);
        });

        child.on('exit', (code) => {
          if (code === 0) {
            console.log(formatter.formatSuccess(`Edited profile: ${name}`));
          } else {
            console.error(formatter.formatError(`Editor exited with code ${code}`));
            process.exit(code ?? 1);
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
