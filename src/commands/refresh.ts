import { Command } from 'commander';
import { ProfileStore } from '../core/ProfileStore.js';
import { ProfileResolver } from '../core/ProfileResolver.js';
import { ShellAdapter } from '../core/ShellAdapter.js';
import { StateManager } from '../core/StateManager.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createRefreshCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  resolver: ProfileResolver,
  stateManager: StateManager,
  shellAdapter: ShellAdapter
): Command {
  return new Command('refresh')
    .description('Refresh current session with latest profile values from storage')
    .option('--emit-shell', 'Output shell commands for eval')
    .option('--emit-human', 'Output human-readable confirmation')
    .action(async (options) => {
      try {
        // Get current active profiles from state
        const currentState = stateManager.load();
        const profileNames = currentState.active_profiles;

        if (profileNames.length === 0) {
          if (options.emitShell) {
            // Silent exit - nothing to refresh
            process.exit(0);
          }
          console.log(formatter.formatInfo('No active profiles to refresh'));
          return;
        }

        // Verify all profiles still exist
        const missingProfiles: string[] = [];
        for (const name of profileNames) {
          if (!store.profileExists(name)) {
            missingProfiles.push(name);
          }
        }

        if (missingProfiles.length > 0) {
          if (options.emitShell) {
            process.exit(1);
          }
          console.error(formatter.formatError(
            `Some profiles no longer exist: ${missingProfiles.join(', ')}`
          ));
          console.error(formatter.formatInfo(
            'Run "envize reset" to clear state, or "envize use" with valid profiles'
          ));
          process.exit(1);
        }

        // Re-resolve profiles to get latest values
        const resolved = resolver.resolve(profileNames);

        // Compute what to set (all variables from resolved profiles)
        const toSet: Record<string, string> = {};
        for (const [key, envVar] of Object.entries(resolved.variables)) {
          toSet[key] = envVar.value;
        }

        // Compute what to unset (variables in old state but not in new resolution)
        const toUnset: string[] = [];
        for (const key of Object.keys(currentState.variables)) {
          if (!resolved.variables[key]) {
            toUnset.push(key);
          }
        }

        // Output mode handling
        if (options.emitShell) {
          // Output shell commands for eval
          const commands = shellAdapter.generateCommands(toSet, toUnset);
          console.log(commands);

          // Update state with refreshed values
          stateManager.update(profileNames, resolved.variables);

          return;
        }

        if (options.emitHuman) {
          // Output human-readable confirmation to stderr
          const message = formatter.formatRefresh(
            profileNames,
            resolved.variables,
            resolved.conflicts
          );
          console.error(message);
          return;
        }

        // Default mode: human-readable output
        // Update state with refreshed values
        stateManager.update(profileNames, resolved.variables);

        // Format output
        if (formatter['jsonMode']) {
          const output = {
            action: 'refresh',
            profiles: profileNames,
            variables: resolved.variables,
            conflicts: resolved.conflicts,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(formatter.formatRefresh(
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
            'Add eval "$(envize hook)" to your shell rc file.'
          ));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
