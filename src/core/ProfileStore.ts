import * as path from 'node:path';
import type { Profile, ProfileMetadata, ProfileListItem } from '../types.js';
import {
  getGlobalProfilesDir,
  getLocalProfilesDir,
  ensureDir,
  fileExists,
  readFile,
  writeFile,
  deleteFile,
  listFiles,
} from '../utils.js';

/**
 * ProfileStore - reads/writes .env profiles from global and local directories
 */
export class ProfileStore {
  private globalDir: string;
  private localDir: string;

  constructor(globalDir?: string, localDir?: string) {
    this.globalDir = globalDir ?? getGlobalProfilesDir();
    this.localDir = localDir ?? getLocalProfilesDir();
  }

  /**
   * Parse metadata from profile content
   */
  parseMetadata(content: string): ProfileMetadata {
    const lines = content.split('\n');
    let description = '';
    const tags: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for @description
      const descMatch = trimmed.match(/^#\s*@description[:\s]+(.+)$/i);
      if (descMatch) {
        description = descMatch[1].trim();
        continue;
      }

      // Check for @tags
      const tagsMatch = trimmed.match(/^#\s*@tags[:\s]+(.+)$/i);
      if (tagsMatch) {
        const tagList = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
        tags.push(...tagList);
        continue;
      }
    }

    return { description, tags };
  }

  /**
   * Parse environment variables from profile content
   */
  parseVariables(content: string): Record<string, string> {
    const lines = content.split('\n');
    const variables: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) {
        variables[key] = value;
      }
    }

    return variables;
  }

  /**
   * Interpolate {{VAR}} placeholders in description
   */
  interpolateDescription(description: string, variables: Record<string, string>): string {
    return description.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] ?? match;
    });
  }

  /**
   * Load a profile by name
   * Local profiles override global profiles with the same name
   */
  loadProfile(name: string): Profile | null {
    // Check local first
    const localPath = path.join(this.localDir, `${name}.env`);
    if (fileExists(localPath)) {
      return this.loadProfileFromPath(localPath, name, true);
    }

    // Check global
    const globalPath = path.join(this.globalDir, `${name}.env`);
    if (fileExists(globalPath)) {
      return this.loadProfileFromPath(globalPath, name, false);
    }

    return null;
  }

  /**
   * Load a profile from a specific path
   */
  loadProfileFromPath(filePath: string, name: string, isLocal: boolean): Profile {
    const content = readFile(filePath);
    const variables = this.parseVariables(content);
    const metadata = this.parseMetadata(content);
    
    // Interpolate description
    metadata.description = this.interpolateDescription(metadata.description, variables);

    return {
      name,
      path: filePath,
      isLocal,
      metadata,
      variables,
    };
  }

  /**
   * List all available profiles
   */
  listProfiles(): ProfileListItem[] {
    const profiles: Map<string, ProfileListItem> = new Map();

    // Load global profiles first
    const globalFiles = listFiles(this.globalDir, '.env');
    for (const filePath of globalFiles) {
      const name = path.basename(filePath, '.env');
      const profile = this.loadProfileFromPath(filePath, name, false);
      profiles.set(name, {
        name,
        path: filePath,
        isLocal: false,
        description: profile.metadata.description,
        tags: profile.metadata.tags,
        variableCount: Object.keys(profile.variables).length,
      });
    }

    // Local profiles override global
    const localFiles = listFiles(this.localDir, '.env');
    for (const filePath of localFiles) {
      const name = path.basename(filePath, '.env');
      const profile = this.loadProfileFromPath(filePath, name, true);
      profiles.set(name, {
        name,
        path: filePath,
        isLocal: true,
        description: profile.metadata.description,
        tags: profile.metadata.tags,
        variableCount: Object.keys(profile.variables).length,
      });
    }

    return Array.from(profiles.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Check if a profile exists
   */
  profileExists(name: string): boolean {
    return this.loadProfile(name) !== null;
  }

  /**
   * Create or update a profile
   */
  saveProfile(name: string, content: string, local: boolean = true): string {
    const dir = local ? this.localDir : this.globalDir;
    ensureDir(dir);
    const filePath = path.join(dir, `${name}.env`);
    writeFile(filePath, content);
    return filePath;
  }

  /**
   * Delete a profile
   */
  deleteProfile(name: string): boolean {
    // Check local first
    const localPath = path.join(this.localDir, `${name}.env`);
    if (fileExists(localPath)) {
      deleteFile(localPath);
      return true;
    }

    // Check global
    const globalPath = path.join(this.globalDir, `${name}.env`);
    if (fileExists(globalPath)) {
      deleteFile(globalPath);
      return true;
    }

    return false;
  }

  /**
   * Get the path where a profile would be saved
   */
  getProfilePath(name: string, local: boolean = true): string {
    const dir = local ? this.localDir : this.globalDir;
    return path.join(dir, `${name}.env`);
  }

  /**
   * Generate profile content from metadata and variables
   */
  generateProfileContent(
    metadata: ProfileMetadata,
    variables: Record<string, string>
  ): string {
    const lines: string[] = [];

    // Add metadata
    if (metadata.description) {
      lines.push(`# @description: ${metadata.description}`);
    }
    if (metadata.tags.length > 0) {
      lines.push(`# @tags: ${metadata.tags.join(', ')}`);
    }

    // Add blank line between metadata and variables
    if (lines.length > 0) {
      lines.push('');
    }

    // Add variables
    for (const [key, value] of Object.entries(variables)) {
      // Quote values that contain spaces or special characters
      if (value.includes(' ') || value.includes('"') || value.includes("'")) {
        lines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}=${value}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}
