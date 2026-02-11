import { Command } from 'commander';
import { ProfileStore } from '../core/ProfileStore.js';
import { ProfileResolver } from '../core/ProfileResolver.js';
import { ShellAdapter } from '../core/ShellAdapter.js';
import { StateManager } from '../core/StateManager.js';
import { SystemEnvWriter } from '../core/SystemEnvWriter.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createAddCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  resolver: ProfileResolver,
  stateManager: StateManager,
  shellAdapter: ShellAdapter,
  systemEnvWriter: SystemEnvWriter
): Command {
  return new Command('add')
    .description('Add profiles to the currently active set')
    .argument('<profiles...>', 'Profile names to add')
    .option('--global', 'Apply globally across all shell sessions')
    .option('--emit-shell', 'Output shell commands for eval')
    .option('--emit-human', 'Output human-readable confirmation')
    .action(async (profileNames: string[], options) => {
      try {
        // Validate all profiles exist
        for (const name of profileNames) {
          if (!store.profileExists(name)) {
            if (options.emitShell) {
              process.exit(1);
            }
            console.error(formatter.formatError(`Profile not found: ${name}`));
            process.exit(1);
          }
        }

        // Get current state
        const currentState = stateManager.load();
        const currentProfiles = currentState.active_profiles;

        // Filter out already active profiles
        const newProfiles = profileNames.filter(p => !currentProfiles.includes(p));
        
        if (newProfiles.length === 0) {
          if (options.emitShell) {
            // Nothing to do
            console.log('');
            return;
          }
          console.log(formatter.formatInfo('All specified profiles are already active'));
          return;
        }

        // Combine with current profiles
        const allProfiles = [...currentProfiles, ...newProfiles];
        
        // Resolve all profiles
        const resolved = resolver.resolve(allProfiles);

        // Compute what to set (only new variables or changed values)
        const toSet: Record<string, string> = {};
        for (const [key, envVar] of Object.entries(resolved.variables)) {
          const current = currentState.variables[key];
          if (!current || current.value !== envVar.value) {
            toSet[key] = envVar.value;
          }
        }

        // Output mode handling
        if (options.emitShell) {
          const commands = shellAdapter.generateExports(toSet);
          console.log(commands);
          
          // Update state
          stateManager.addProfiles(newProfiles, resolved.variables);
          
          if (options.global) {
            systemEnvWriter.update(toSet, []);
          }
          
          return;
        }

        if (options.emitHuman) {
          const message = formatter.formatAdd(
            newProfiles,
            allProfiles,
            Object.keys(toSet).length
          );
          console.error(message);
          return;
        }

        // Default mode
        stateManager.addProfiles(newProfiles, resolved.variables);

        if (options.global) {
          systemEnvWriter.update(toSet, []);
        }

        if (formatter['jsonMode']) {
          const output = {
            action: 'add',
            added_profiles: newProfiles,
            active_profiles: allProfiles,
            new_variables: toSet,
            global: options.global ?? false,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(formatter.formatAdd(
            newProfiles,
            allProfiles,
            Object.keys(toSet).length
          ));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
