import { Command } from 'commander';
import { ProfileStore } from '../core/ProfileStore.js';
import { ProfileResolver } from '../core/ProfileResolver.js';
import { ShellAdapter } from '../core/ShellAdapter.js';
import { StateManager } from '../core/StateManager.js';
import { SystemEnvWriter } from '../core/SystemEnvWriter.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createRemoveCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  resolver: ProfileResolver,
  stateManager: StateManager,
  shellAdapter: ShellAdapter,
  systemEnvWriter: SystemEnvWriter
): Command {
  return new Command('remove')
    .description('Remove profiles from the currently active set')
    .argument('<profiles...>', 'Profile names to remove')
    .option('--global', 'Also remove from global (cross-session) state')
    .option('--emit-shell', 'Output shell commands for eval')
    .option('--emit-human', 'Output human-readable confirmation')
    .action(async (profileNames: string[], options) => {
      try {
        // Get current state
        const currentState = stateManager.load();
        const currentProfiles = currentState.active_profiles;

        // Filter to only profiles that are actually active
        const toRemove = profileNames.filter(p => currentProfiles.includes(p));
        
        if (toRemove.length === 0) {
          if (options.emitShell) {
            console.log('');
            return;
          }
          console.log(formatter.formatInfo('None of the specified profiles are active'));
          return;
        }

        // Compute remaining profiles
        const remainingProfiles = currentProfiles.filter(p => !toRemove.includes(p));

        // Compute what to unset and what to keep
        const { toUnset, toKeep } = resolver.computeRemoval(
          currentState.variables,
          remainingProfiles
        );

        // Compute what to set (variables that need to be updated to values from remaining profiles)
        const toSet: Record<string, string> = {};
        for (const [key, envVar] of Object.entries(toKeep)) {
          const current = currentState.variables[key];
          if (current && current.value !== envVar.value) {
            toSet[key] = envVar.value;
          }
        }

        // Output mode handling
        if (options.emitShell) {
          const commands = shellAdapter.generateCommands(toSet, toUnset);
          console.log(commands);
          
          // Update state
          stateManager.removeProfiles(toRemove, toKeep, toUnset);
          
          if (options.global) {
            systemEnvWriter.update(toSet, toUnset);
          }
          
          return;
        }

        if (options.emitHuman) {
          const message = formatter.formatRemove(
            toRemove,
            remainingProfiles,
            toUnset.length
          );
          console.error(message);
          return;
        }

        // Default mode
        stateManager.removeProfiles(toRemove, toKeep, toUnset);

        if (options.global) {
          systemEnvWriter.update(toSet, toUnset);
        }

        if (formatter['jsonMode']) {
          const output = {
            action: 'remove',
            removed_profiles: toRemove,
            remaining_profiles: remainingProfiles,
            unset_variables: toUnset,
            global: options.global ?? false,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(formatter.formatRemove(
            toRemove,
            remainingProfiles,
            toUnset.length
          ));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
