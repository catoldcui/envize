import { Command } from 'commander';
import { ProfileStore } from '../core/ProfileStore.js';
import { TemplateEngine } from '../core/TemplateEngine.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createInitCommand(
  formatter: OutputFormatter,
  store: ProfileStore,
  templateEngine: TemplateEngine
): Command {
  return new Command('init')
    .description('Scaffold a profile from an industry template')
    .option('--template <name>', 'Template name (claude, openai, aws, supabase, stripe, vercel)')
    .option('--name <name>', 'Custom profile name (defaults to template name)')
    .option('-g, --global', 'Create in global ~/.envize/profiles/')
    .action(async (options) => {
      try {
        if (!options.template) {
          // List available templates
          console.log(formatter.formatInfo('Available templates:'));
          const templates = templateEngine.list();
          for (const template of templates) {
            console.log(`  ${template.name} - ${template.description}`);
          }
          console.log('');
          console.log(formatter.formatInfo('Usage: envize init --template <name>'));
          return;
        }

        const templateName = options.template;
        const profileName = options.name ?? templateName;
        const isLocal = !options.global;

        // Check if template exists
        if (!templateEngine.has(templateName)) {
          console.error(formatter.formatError(`Template not found: ${templateName}`));
          console.log('');
          console.log(formatter.formatInfo('Available templates:'));
          const templates = templateEngine.list();
          for (const template of templates) {
            console.log(`  ${template.name}`);
          }
          process.exit(1);
        }

        // Check if profile already exists
        if (store.profileExists(profileName)) {
          console.error(formatter.formatError(`Profile already exists: ${profileName}`));
          console.log(formatter.formatInfo(`Use "envize edit ${profileName}" to modify it.`));
          process.exit(1);
        }

        // Create profile from template
        const profilePath = templateEngine.init(templateName, store, isLocal);
        
        // If custom name, rename the file
        if (profileName !== templateName) {
          const template = templateEngine.get(templateName)!;
          store.saveProfile(profileName, template.content, isLocal);
          store.deleteProfile(templateName);
        }

        // Get placeholders that need to be filled
        const placeholders = templateEngine.getPlaceholders(templateName);

        if (formatter['jsonMode']) {
          console.log(JSON.stringify({
            action: 'init',
            template: templateName,
            name: profileName,
            path: store.getProfilePath(profileName, isLocal),
            placeholders,
          }, null, 2));
        } else {
          console.log(formatter.formatSuccess(`Created profile from template: ${profileName}`));
          console.log(formatter.formatInfo(`Path: ${store.getProfilePath(profileName, isLocal)}`));
          
          if (placeholders.length > 0) {
            console.log('');
            console.log(formatter.formatWarning('Fill in the following placeholders:'));
            for (const placeholder of placeholders) {
              console.log(`  ${placeholder}`);
            }
            console.log('');
            console.log(formatter.formatInfo(`Run "envize edit ${profileName}" to add your values.`));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
