/**
 * Metadata parsed from profile header comments
 */
export interface ProfileMetadata {
  description: string;
  tags: string[];
}

/**
 * A single environment variable with its source
 */
export interface EnvVariable {
  value: string;
  source: string;
}

/**
 * A profile containing env variables and metadata
 */
export interface Profile {
  name: string;
  path: string;
  isLocal: boolean;
  metadata: ProfileMetadata;
  variables: Record<string, string>;
}

/**
 * Resolved environment map from merged profiles
 */
export interface ResolvedEnv {
  variables: Record<string, EnvVariable>;
  conflicts: Conflict[];
}

/**
 * Conflict when multiple profiles set the same variable
 */
export interface Conflict {
  variable: string;
  profiles: string[];
  winner: string;
}

/**
 * Persisted state data
 */
export interface StateData {
  active_profiles: string[];
  variables: Record<string, EnvVariable>;
  snapshot: Record<string, string | null>;
  applied_at: string;
}

/**
 * Output mode for CLI commands
 */
export type OutputMode = 'human' | 'json' | 'emit-shell' | 'emit-human';

/**
 * Supported shell types
 */
export type ShellType = 'bash' | 'zsh' | 'fish' | 'unknown';

/**
 * Profile listing item for ls command
 */
export interface ProfileListItem {
  name: string;
  path: string;
  isLocal: boolean;
  description: string;
  tags: string[];
  variableCount: number;
}

/**
 * Status output structure
 */
export interface StatusOutput {
  active_profiles: string[];
  variables: Record<string, EnvVariable>;
  applied_at: string | null;
}

/**
 * Which command output
 */
export interface WhichOutput {
  variable: string;
  value: string;
  source: string;
  masked_value: string;
}

/**
 * Template definition
 */
export interface Template {
  name: string;
  description: string;
  tags: string[];
  content: string;
}
