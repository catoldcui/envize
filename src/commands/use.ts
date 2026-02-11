import { Command } from 'commander';
import { ProfileStore } from '../core/ProfileStore.js';
import { ProfileResolver } from '../core/ProfileResolver.js';
import { ShellAdapter } from '../core/ShellAdapter.js';
import { StateManager } from '../core/StateManager.js';
import { SystemEnvWriter } from '../core/SystemEnvWriter.js';
import { OutputFormatter } from '../core/OutputFormatter.js';
import type { EnvVariable } from '../types.js';

export function createUseCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  resolver: ProfileResolver,
  stateManager: StateManager,
  shellAdapter: ShellAdapter,
  systemEnvWriter: SystemEnvWriter
): Command {
  return new Command('use')
    .description('Apply one or more profiles to current shell (replaces active set)')
    .argument('<profiles...>', 'Profile names to activate')
    .option('--persist', 'Persist across shell sessions')
    .option('--emit-shell', 'Output shell commands for eval')
    .option('--emit-human', 'Output human-readable confirmation')
    .action(async (profileNames: string[], options) => {
      try {
        // Validate all profiles exist
        for (const name of profileNames) {
          if (!store.profileExists(name)) {
            if (options.emitShell) {
              // Silent fail for shell mode - error will be shown via fallback
              process.exit(1);
            }
            console.error(formatter.formatError(`Profile not found: ${name}`));
            process.exit(1);
          }
        }

        // Resolve profiles
        const resolved = resolver.resolve(profileNames);

        // Get current state for diff
        const currentState = stateManager.load();
        const currentVars = currentState.variables;

        // Compute what to set and unset
        const toSet: Record<string, string> = {};
        for (const [key, envVar] of Object.entries(resolved.variables)) {
          toSet[key] = envVar.value;
        }

        const toUnset: string[] = [];
        for (const key of Object.keys(currentVars)) {
          if (!resolved.variables[key]) {
            toUnset.push(key);
          }
        }

        // Output mode handling
        if (options.emitShell) {
          // Output shell commands for eval
          const commands = shellAdapter.generateCommands(toSet, toUnset);
          console.log(commands);
          
          // Update state
          stateManager.update(profileNames, resolved.variables);
          
          // Handle persist
          if (options.persist) {
            systemEnvWriter.write(toSet);
          }
          
          return;
        }

        if (options.emitHuman) {
          // Output human-readable confirmation to stderr
          const message = formatter.formatActivation(
            profileNames,
            resolved.variables,
            resolved.conflicts
          );
          console.error(message);
          return;
        }

        // Default mode: human-readable output
        // Update state
        stateManager.update(profileNames, resolved.variables);

        // Handle persist
        if (options.persist) {
          systemEnvWriter.write(toSet);
        }

        // Format output
        if (formatter['jsonMode']) {
          const output = {
            action: 'use',
            profiles: profileNames,
            variables: resolved.variables,
            conflicts: resolved.conflicts,
            persisted: options.persist ?? false,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(formatter.formatActivation(
            profileNames,
            resolved.variables,
            resolved.conflicts
          ));

          // Warn about shell function wrapper
          console.log('');
          console.log(formatter.formatWarning(
            'Note: Variables only take effect when using the shell wrapper.'
          ));
          console.log(formatter.formatInfo(
            'Run "envize install" if you haven\'t already.'
          ));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
