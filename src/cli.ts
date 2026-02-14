import { Command } from 'commander';
import {
  ProfileStore,
  ProfileResolver,
  ShellAdapter,
  StateManager,
  SystemEnvWriter,
  TemplateEngine,
  DotenvBridge,
  OutputFormatter,
} from './core/index.js';
import {
  createHookCommand,
  createUseCommand,
  createAddCommand,
  createUnuseCommand,
  createResetCommand,
  createRefreshCommand,
  createStatusCommand,
  createWhichCommand,
  createLsCommand,
  createCreateCommand,
  createEditCommand,
  createRmCommand,
  createInitCommand,
  createTemplatesCommand,
  createExplainCommand,
  createImportCommand,
  createExportCommand,
} from './commands/index.js';

const program = new Command();

// Initialize core components
const formatter = new OutputFormatter();
const store = new ProfileStore();
const resolver = new ProfileResolver(store);
const stateManager = new StateManager();
const shellAdapter = new ShellAdapter();
const systemEnvWriter = new SystemEnvWriter();
const templateEngine = new TemplateEngine();
const dotenvBridge = new DotenvBridge(store);

program
  .name('envize')
  .description('A CLI tool for developers to easily switch environment variables using composable profiles')
  .version('1.0.0')
  .option('--json', 'Output in JSON format')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) {
      formatter.setJsonMode(true);
    }
  });

// Register all commands
program.addCommand(createHookCommand());

program.addCommand(createUseCommand(
  formatter,
  store,
  resolver,
  stateManager,
  shellAdapter,
  systemEnvWriter
));

program.addCommand(createAddCommand(
  formatter,
  store,
  resolver,
  stateManager,
  shellAdapter,
  systemEnvWriter
));

program.addCommand(createUnuseCommand(
  formatter,
  store,
  resolver,
  stateManager,
  shellAdapter,
  systemEnvWriter
));

program.addCommand(createResetCommand(
  formatter,
  stateManager,
  shellAdapter,
  systemEnvWriter
));

program.addCommand(createRefreshCommand(
  formatter,
  store,
  resolver,
  stateManager,
  shellAdapter
));

program.addCommand(createStatusCommand(formatter, stateManager));
program.addCommand(createWhichCommand(formatter, stateManager));
program.addCommand(createLsCommand(formatter, store));
program.addCommand(createCreateCommand(formatter, store));
program.addCommand(createEditCommand(formatter, store));
program.addCommand(createRmCommand(formatter, store, stateManager));
program.addCommand(createInitCommand(formatter, store, templateEngine));
program.addCommand(createTemplatesCommand(formatter, templateEngine));
program.addCommand(createExplainCommand(formatter, stateManager));
program.addCommand(createImportCommand(formatter, store, dotenvBridge));
program.addCommand(createExportCommand(formatter, store, stateManager, dotenvBridge));

// Parse and execute
program.parse();
