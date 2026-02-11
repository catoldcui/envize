import chalk from 'chalk';
import type { 
  EnvVariable, 
  ProfileListItem, 
  StatusOutput, 
  WhichOutput,
  Conflict,
  OutputMode 
} from '../types.js';
import { maskValue } from '../utils.js';

/**
 * OutputFormatter - handles human-readable and JSON output
 */
export class OutputFormatter {
  private jsonMode: boolean;

  constructor(jsonMode: boolean = false) {
    this.jsonMode = jsonMode;
  }

  /**
   * Set JSON mode
   */
  setJsonMode(enabled: boolean): void {
    this.jsonMode = enabled;
  }

  /**
   * Output data - JSON or human-readable
   */
  output(data: unknown, humanFormat: () => string): void {
    if (this.jsonMode) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(humanFormat());
    }
  }

  /**
   * Output to stderr (for human messages alongside shell output)
   */
  outputHuman(message: string): void {
    if (!this.jsonMode) {
      console.error(message);
    }
  }

  /**
   * Format profile activation success
   */
  formatActivation(
    profiles: string[],
    variables: Record<string, EnvVariable>,
    conflicts: Conflict[]
  ): string {
    const lines: string[] = [];
    
    lines.push(chalk.green('✓ ') + chalk.bold(`Activated: ${profiles.join(', ')}`));
    lines.push(chalk.dim(`  ${Object.keys(variables).length} variable(s) set`));

    if (conflicts.length > 0) {
      lines.push('');
      lines.push(chalk.yellow('⚠ Conflicts (last profile wins):'));
      for (const conflict of conflicts) {
        lines.push(chalk.yellow(`  ${conflict.variable}: ${conflict.profiles.join(' → ')}`));
      }
    }

    return lines.join('\n');
  }

  /**
   * Format profile list
   */
  formatProfileList(profiles: ProfileListItem[], verbose: boolean = false): string {
    if (profiles.length === 0) {
      return chalk.dim('No profiles found');
    }

    const lines: string[] = [];

    for (const profile of profiles) {
      const location = profile.isLocal ? chalk.blue('[local]') : chalk.gray('[global]');
      
      if (verbose) {
        lines.push(`${chalk.bold(profile.name)} ${location}`);
        if (profile.description) {
          lines.push(chalk.dim(`  ${profile.description}`));
        }
        if (profile.tags.length > 0) {
          lines.push(chalk.cyan(`  Tags: ${profile.tags.join(', ')}`));
        }
        lines.push(chalk.dim(`  Variables: ${profile.variableCount}`));
        lines.push('');
      } else {
        lines.push(`${chalk.bold(profile.name)} ${location} ${chalk.dim(`(${profile.variableCount} vars)`)}`);
      }
    }

    return lines.join('\n').trim();
  }

  /**
   * Format status output
   */
  formatStatus(status: StatusOutput, reveal: boolean = false): string {
    const lines: string[] = [];

    if (status.active_profiles.length === 0) {
      return chalk.dim('No active profiles');
    }

    lines.push(chalk.bold('Active profiles:'));
    for (const profile of status.active_profiles) {
      lines.push(chalk.green(`  • ${profile}`));
    }

    lines.push('');
    lines.push(chalk.bold('Variables:'));

    const sortedVars = Object.entries(status.variables).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, envVar] of sortedVars) {
      const value = reveal ? envVar.value : maskValue(envVar.value);
      lines.push(`  ${chalk.cyan(key)}=${value} ${chalk.dim(`(${envVar.source})`)}`);
    }

    if (status.applied_at) {
      lines.push('');
      lines.push(chalk.dim(`Applied: ${new Date(status.applied_at).toLocaleString()}`));
    }

    return lines.join('\n');
  }

  /**
   * Format which command output
   */
  formatWhich(which: WhichOutput | null, reveal: boolean = false): string {
    if (!which) {
      return chalk.dim('Variable not set by envize');
    }

    const value = reveal ? which.value : which.masked_value;
    return `${chalk.cyan(which.variable)}=${value}\n${chalk.dim(`Set by: ${which.source}`)}`;
  }

  /**
   * Format reset confirmation
   */
  formatReset(unsetCount: number, restoredCount: number): string {
    const lines: string[] = [];
    lines.push(chalk.green('✓ ') + chalk.bold('Environment reset'));
    lines.push(chalk.dim(`  ${unsetCount} variable(s) unset`));
    if (restoredCount > 0) {
      lines.push(chalk.dim(`  ${restoredCount} variable(s) restored to previous values`));
    }
    return lines.join('\n');
  }

  /**
   * Format add profiles confirmation
   */
  formatAdd(
    addedProfiles: string[],
    totalProfiles: string[],
    newVarsCount: number
  ): string {
    const lines: string[] = [];
    lines.push(chalk.green('✓ ') + chalk.bold(`Added: ${addedProfiles.join(', ')}`));
    lines.push(chalk.dim(`  Active profiles: ${totalProfiles.join(', ')}`));
    lines.push(chalk.dim(`  ${newVarsCount} new variable(s) set`));
    return lines.join('\n');
  }

  /**
   * Format remove profiles confirmation
   */
  formatRemove(
    removedProfiles: string[],
    remainingProfiles: string[],
    unsetCount: number
  ): string {
    const lines: string[] = [];
    lines.push(chalk.green('✓ ') + chalk.bold(`Removed: ${removedProfiles.join(', ')}`));
    if (remainingProfiles.length > 0) {
      lines.push(chalk.dim(`  Active profiles: ${remainingProfiles.join(', ')}`));
    } else {
      lines.push(chalk.dim('  No active profiles'));
    }
    lines.push(chalk.dim(`  ${unsetCount} variable(s) unset`));
    return lines.join('\n');
  }

  /**
   * Format explain output (plain text for LLM context)
   */
  formatExplain(status: StatusOutput): string {
    const lines: string[] = [];

    lines.push('# Current Environment State (envize)');
    lines.push('');

    if (status.active_profiles.length === 0) {
      lines.push('No envize profiles are currently active.');
      return lines.join('\n');
    }

    lines.push(`Active profiles: ${status.active_profiles.join(', ')}`);
    lines.push('');
    lines.push('Environment variables set by envize:');

    const sortedVars = Object.entries(status.variables).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, envVar] of sortedVars) {
      const maskedValue = maskValue(envVar.value);
      lines.push(`- ${key}=${maskedValue} (from ${envVar.source})`);
    }

    if (status.applied_at) {
      lines.push('');
      lines.push(`Last applied: ${status.applied_at}`);
    }

    return lines.join('\n');
  }

  /**
   * Format template list
   */
  formatTemplates(templates: Array<{ name: string; description: string; tags: string[] }>): string {
    if (templates.length === 0) {
      return chalk.dim('No templates available');
    }

    const lines: string[] = [];
    lines.push(chalk.bold('Available templates:'));
    lines.push('');

    for (const template of templates) {
      lines.push(`  ${chalk.green(template.name)}`);
      lines.push(chalk.dim(`    ${template.description}`));
      if (template.tags.length > 0) {
        lines.push(chalk.cyan(`    Tags: ${template.tags.join(', ')}`));
      }
    }

    return lines.join('\n');
  }

  /**
   * Format error message
   */
  formatError(message: string): string {
    return chalk.red('✗ ') + message;
  }

  /**
   * Format success message
   */
  formatSuccess(message: string): string {
    return chalk.green('✓ ') + message;
  }

  /**
   * Format warning message
   */
  formatWarning(message: string): string {
    return chalk.yellow('⚠ ') + message;
  }

  /**
   * Format info message
   */
  formatInfo(message: string): string {
    return chalk.blue('ℹ ') + message;
  }
}
