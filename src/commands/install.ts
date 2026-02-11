import { Command } from 'commander';
import { ShellAdapter } from '../core/ShellAdapter.js';
import { OutputFormatter } from '../core/OutputFormatter.js';
import { 
  detectShell, 
  getShellRcPath, 
  fileExists, 
  readFile, 
  writeFile,
  ensureDir,
  getGlobalDir,
  getGlobalProfilesDir,
} from '../utils.js';

export function createInstallCommand(formatter: OutputFormatter): Command {
  return new Command('install')
    .description('One-time setup: injects shell function wrapper into shell config')
    .option('--shell <type>', 'Override shell detection (bash, zsh, fish)')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (options) => {
      const shell = options.shell ?? detectShell();
      
      if (shell === 'unknown') {
        console.error(formatter.formatError('Could not detect shell. Use --shell to specify.'));
        process.exit(1);
      }

      const adapter = new ShellAdapter(shell);
      const rcPath = getShellRcPath(shell);

      if (!rcPath) {
        console.error(formatter.formatError(`Could not determine rc file for ${shell}`));
        process.exit(1);
      }

      // Create global directories
      if (!options.dryRun) {
        ensureDir(getGlobalDir());
        ensureDir(getGlobalProfilesDir());
      }

      // Read existing rc content or start fresh
      let rcContent = '';
      if (fileExists(rcPath)) {
        rcContent = readFile(rcPath);
      }

      // Check if already installed
      if (adapter.isWrapperInstalled(rcContent)) {
        if (options.dryRun) {
          console.log(formatter.formatInfo('Shell wrapper is already installed'));
          console.log(`Would update wrapper in: ${rcPath}`);
        } else {
          // Update the wrapper
          const newContent = adapter.addWrapper(rcContent);
          writeFile(rcPath, newContent);
          console.log(formatter.formatSuccess(`Updated shell wrapper in ${rcPath}`));
        }
      } else {
        if (options.dryRun) {
          console.log(`Would add shell wrapper to: ${rcPath}`);
          console.log('');
          console.log('Wrapper content:');
          console.log(adapter.getFullWrapperBlock());
        } else {
          const newContent = adapter.addWrapper(rcContent);
          writeFile(rcPath, newContent);
          console.log(formatter.formatSuccess(`Installed shell wrapper in ${rcPath}`));
        }
      }

      if (!options.dryRun) {
        console.log('');
        console.log(formatter.formatInfo(`Restart your shell or run: source ${rcPath}`));
      }
    });
}
