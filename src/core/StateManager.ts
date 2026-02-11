import type { StateData, EnvVariable } from '../types.js';
import { getStatePath, ensureDir, fileExists, readFile, writeFile } from '../utils.js';
import * as path from 'node:path';

/**
 * StateManager - reads/writes ~/.envize/state.json
 */
export class StateManager {
  private statePath: string;

  constructor(statePath?: string) {
    this.statePath = statePath ?? getStatePath();
  }

  /**
   * Get the default empty state
   */
  getEmptyState(): StateData {
    return {
      active_profiles: [],
      variables: {},
      snapshot: {},
      applied_at: new Date().toISOString(),
    };
  }

  /**
   * Load the current state
   */
  load(): StateData {
    if (!fileExists(this.statePath)) {
      return this.getEmptyState();
    }

    try {
      const content = readFile(this.statePath);
      const data = JSON.parse(content) as StateData;
      return data;
    } catch {
      // Return empty state on parse error
      return this.getEmptyState();
    }
  }

  /**
   * Save the state
   */
  save(state: StateData): void {
    ensureDir(path.dirname(this.statePath));
    const content = JSON.stringify(state, null, 2);
    writeFile(this.statePath, content);
  }

  /**
   * Update state with new active profiles and variables
   * Captures snapshot of current env values before overwriting
   */
  update(
    profiles: string[],
    variables: Record<string, EnvVariable>
  ): StateData {
    const currentState = this.load();
    
    // Capture snapshot of current env values for any new variables
    const snapshot: Record<string, string | null> = { ...currentState.snapshot };
    
    for (const key of Object.keys(variables)) {
      // Only capture if we haven't already captured this variable
      if (!(key in snapshot)) {
        const currentValue = process.env[key];
        snapshot[key] = currentValue ?? null;
      }
    }

    const newState: StateData = {
      active_profiles: profiles,
      variables,
      snapshot,
      applied_at: new Date().toISOString(),
    };

    this.save(newState);
    return newState;
  }

  /**
   * Clear the state (for reset)
   */
  clear(): StateData {
    const emptyState = this.getEmptyState();
    this.save(emptyState);
    return emptyState;
  }

  /**
   * Get the snapshot values for reset
   */
  getSnapshot(): Record<string, string | null> {
    const state = this.load();
    return state.snapshot;
  }

  /**
   * Get the current active profiles
   */
  getActiveProfiles(): string[] {
    const state = this.load();
    return state.active_profiles;
  }

  /**
   * Get the current variables
   */
  getVariables(): Record<string, EnvVariable> {
    const state = this.load();
    return state.variables;
  }

  /**
   * Check if any profiles are active
   */
  hasActiveProfiles(): boolean {
    return this.getActiveProfiles().length > 0;
  }

  /**
   * Add profiles to the active set
   */
  addProfiles(
    profilesToAdd: string[],
    newVariables: Record<string, EnvVariable>
  ): StateData {
    const currentState = this.load();
    
    // Merge profiles (avoid duplicates)
    const profiles = [...currentState.active_profiles];
    for (const profile of profilesToAdd) {
      if (!profiles.includes(profile)) {
        profiles.push(profile);
      }
    }

    // Update snapshot for new variables
    const snapshot: Record<string, string | null> = { ...currentState.snapshot };
    for (const key of Object.keys(newVariables)) {
      if (!(key in snapshot)) {
        const currentValue = process.env[key];
        snapshot[key] = currentValue ?? null;
      }
    }

    // Merge variables (new variables override)
    const variables: Record<string, EnvVariable> = {
      ...currentState.variables,
      ...newVariables,
    };

    const newState: StateData = {
      active_profiles: profiles,
      variables,
      snapshot,
      applied_at: new Date().toISOString(),
    };

    this.save(newState);
    return newState;
  }

  /**
   * Remove profiles from the active set
   */
  removeProfiles(
    profilesToRemove: string[],
    remainingVariables: Record<string, EnvVariable>,
    variablesToUnset: string[]
  ): StateData {
    const currentState = this.load();
    
    // Remove profiles
    const profiles = currentState.active_profiles.filter(
      p => !profilesToRemove.includes(p)
    );

    // Remove unset variables from snapshot
    const snapshot: Record<string, string | null> = { ...currentState.snapshot };
    for (const key of variablesToUnset) {
      delete snapshot[key];
    }

    const newState: StateData = {
      active_profiles: profiles,
      variables: remainingVariables,
      snapshot,
      applied_at: new Date().toISOString(),
    };

    this.save(newState);
    return newState;
  }
}
