import type { Profile, ResolvedEnv, EnvVariable, Conflict } from '../types.js';
import { ProfileStore } from './ProfileStore.js';

/**
 * ProfileResolver - merges multiple profiles with conflict detection
 */
export class ProfileResolver {
  private store: ProfileStore;

  constructor(store: ProfileStore) {
    this.store = store;
  }

  /**
   * Resolve multiple profiles into a merged environment
   * Last profile wins on conflicts
   */
  resolve(profileNames: string[]): ResolvedEnv {
    const variables: Record<string, EnvVariable> = {};
    const conflicts: Conflict[] = [];
    const variableSources: Map<string, string[]> = new Map();

    // Load and merge profiles in order
    for (const name of profileNames) {
      const profile = this.store.loadProfile(name);
      if (!profile) {
        throw new Error(`Profile not found: ${name}`);
      }

      this.mergeProfile(profile, variables, variableSources);
    }

    // Detect conflicts (variables set by multiple profiles)
    for (const [variable, sources] of variableSources) {
      if (sources.length > 1) {
        conflicts.push({
          variable,
          profiles: sources,
          winner: sources[sources.length - 1],
        });
      }
    }

    return { variables, conflicts };
  }

  /**
   * Resolve profiles directly (without loading from store)
   */
  resolveProfiles(profiles: Profile[]): ResolvedEnv {
    const variables: Record<string, EnvVariable> = {};
    const conflicts: Conflict[] = [];
    const variableSources: Map<string, string[]> = new Map();

    for (const profile of profiles) {
      this.mergeProfile(profile, variables, variableSources);
    }

    // Detect conflicts
    for (const [variable, sources] of variableSources) {
      if (sources.length > 1) {
        conflicts.push({
          variable,
          profiles: sources,
          winner: sources[sources.length - 1],
        });
      }
    }

    return { variables, conflicts };
  }

  /**
   * Merge a single profile into the variables map
   */
  private mergeProfile(
    profile: Profile,
    variables: Record<string, EnvVariable>,
    variableSources: Map<string, string[]>
  ): void {
    for (const [key, value] of Object.entries(profile.variables)) {
      // Track which profiles set this variable
      const sources = variableSources.get(key) || [];
      sources.push(profile.name);
      variableSources.set(key, sources);

      // Last profile wins
      variables[key] = {
        value,
        source: profile.name,
      };
    }
  }

  /**
   * Compute the difference between two resolved environments
   * Returns variables to add/update and variables to unset
   */
  diff(
    current: Record<string, EnvVariable>,
    next: Record<string, EnvVariable>
  ): { toSet: Record<string, string>; toUnset: string[] } {
    const toSet: Record<string, string> = {};
    const toUnset: string[] = [];

    // Variables in next that are new or changed
    for (const [key, envVar] of Object.entries(next)) {
      if (!current[key] || current[key].value !== envVar.value) {
        toSet[key] = envVar.value;
      }
    }

    // Variables in current that are not in next
    for (const key of Object.keys(current)) {
      if (!next[key]) {
        toUnset.push(key);
      }
    }

    return { toSet, toUnset };
  }

  /**
   * Compute what to unset when removing profiles from active set
   * Only unsets variables that were uniquely provided by removed profiles
   */
  computeRemoval(
    currentVariables: Record<string, EnvVariable>,
    remainingProfileNames: string[]
  ): { toUnset: string[]; toKeep: Record<string, EnvVariable> } {
    const toUnset: string[] = [];
    const toKeep: Record<string, EnvVariable> = {};

    // Resolve remaining profiles
    const remaining = remainingProfileNames.length > 0
      ? this.resolve(remainingProfileNames)
      : { variables: {} as Record<string, EnvVariable> };

    // Check each current variable
    for (const [key, envVar] of Object.entries(currentVariables)) {
      if (remaining.variables[key]) {
        // Variable still provided by remaining profiles
        toKeep[key] = remaining.variables[key];
      } else {
        // Variable was only in removed profiles
        toUnset.push(key);
      }
    }

    return { toUnset, toKeep };
  }
}
