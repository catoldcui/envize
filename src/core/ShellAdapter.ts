import type { ShellType } from '../types.js';
import { detectShell, sanitizeForShell } from '../utils.js';

/**
 * ShellAdapter - generates shell-specific export/unset commands
 */
export class ShellAdapter {
  private shell: ShellType;

  constructor(shell?: ShellType) {
    this.shell = shell ?? detectShell();
  }

  /**
   * Get the current shell type
   */
  getShell(): ShellType {
    return this.shell;
  }

  /**
   * Generate export commands for the given variables
   */
  generateExports(variables: Record<string, string>): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(variables)) {
      lines.push(this.generateExport(key, value));
    }

    return lines.join('\n');
  }

  /**
   * Generate a single export command
   */
  generateExport(key: string, value: string): string {
    const sanitized = sanitizeForShell(value);

    switch (this.shell) {
      case 'fish':
        return `set -gx ${key} '${sanitized}'`;
      case 'bash':
      case 'zsh':
      default:
        return `export ${key}='${sanitized}'`;
    }
  }

  /**
   * Generate unset commands for the given variable names
   */
  generateUnsets(variables: string[]): string {
    const lines: string[] = [];

    for (const key of variables) {
      lines.push(this.generateUnset(key));
    }

    return lines.join('\n');
  }

  /**
   * Generate a single unset command
   */
  generateUnset(key: string): string {
    switch (this.shell) {
      case 'fish':
        return `set -e ${key}`;
      case 'bash':
      case 'zsh':
      default:
        return `unset ${key}`;
    }
  }

  /**
   * Generate combined export and unset commands
   */
  generateCommands(
    toSet: Record<string, string>,
    toUnset: string[]
  ): string {
    const parts: string[] = [];

    if (toUnset.length > 0) {
      parts.push(this.generateUnsets(toUnset));
    }

    if (Object.keys(toSet).length > 0) {
      parts.push(this.generateExports(toSet));
    }

    return parts.join('\n');
  }

  /**
   * Get the shell function wrapper for installation
   */
  getShellWrapper(): string {
    switch (this.shell) {
      case 'fish':
        return this.getFishWrapper();
      case 'bash':
      case 'zsh':
      default:
        return this.getBashZshWrapper();
    }
  }

  /**
   * Bash/Zsh function wrapper
   */
  private getBashZshWrapper(): string {
    return `
# envize shell function wrapper
envize() {
  case "$1" in
    use|add|remove|reset)
      local output
      output="$(command envize "$@" --emit-shell 2>/dev/null)"
      if [ $? -eq 0 ]; then
        eval "$output"
        command envize "$@" --emit-human 1>&2
      else
        command envize "$@" 1>&2
      fi
      ;;
    *)
      command envize "$@"
      ;;
  esac
}

# Source persisted env vars if they exist
if [ -f "$HOME/.envize/active.sh" ]; then
  source "$HOME/.envize/active.sh"
fi
`.trim();
  }

  /**
   * Fish function wrapper
   */
  private getFishWrapper(): string {
    return `
# envize shell function wrapper
function envize
  switch $argv[1]
    case use add remove reset
      set -l output (command envize $argv --emit-shell 2>/dev/null)
      if test $status -eq 0
        eval $output
        command envize $argv --emit-human 1>&2
      else
        command envize $argv 1>&2
      end
    case '*'
      command envize $argv
  end
end

# Source persisted env vars if they exist
if test -f "$HOME/.envize/active.fish"
  source "$HOME/.envize/active.fish"
end
`.trim();
  }

  /**
   * Get the marker comments for finding the wrapper in rc files
   */
  getMarkerStart(): string {
    return '# >>> envize initialize >>>';
  }

  getMarkerEnd(): string {
    return '# <<< envize initialize <<<';
  }

  /**
   * Get the full wrapper block with markers
   */
  getFullWrapperBlock(): string {
    return `${this.getMarkerStart()}
${this.getShellWrapper()}
${this.getMarkerEnd()}`;
  }

  /**
   * Check if the wrapper is already installed in content
   */
  isWrapperInstalled(content: string): boolean {
    return content.includes(this.getMarkerStart());
  }

  /**
   * Remove the wrapper from content
   */
  removeWrapper(content: string): string {
    const startMarker = this.getMarkerStart();
    const endMarker = this.getMarkerEnd();

    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
      return content;
    }

    const endIndex = content.indexOf(endMarker);
    if (endIndex === -1) {
      return content;
    }

    // Remove the block including markers and surrounding newlines
    const before = content.slice(0, startIndex).replace(/\n+$/, '');
    const after = content.slice(endIndex + endMarker.length).replace(/^\n+/, '');

    return before + (before && after ? '\n\n' : '') + after;
  }

  /**
   * Add the wrapper to content
   */
  addWrapper(content: string): string {
    // Remove existing wrapper first
    const cleaned = this.removeWrapper(content);
    
    // Add wrapper at the end
    const separator = cleaned.endsWith('\n') ? '\n' : '\n\n';
    return cleaned + separator + this.getFullWrapperBlock() + '\n';
  }
}
