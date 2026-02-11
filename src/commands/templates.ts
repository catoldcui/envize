import { Command } from 'commander';
import { TemplateEngine } from '../core/TemplateEngine.js';
import { OutputFormatter } from '../core/OutputFormatter.js';

export function createTemplatesCommand(
  formatter: OutputFormatter,
  templateEngine: TemplateEngine
): Command {
  return new Command('templates')
    .description('List available industry templates')
    .action(async () => {
      try {
        const templates = templateEngine.list();

        if (formatter['jsonMode']) {
          console.log(JSON.stringify(templates.map(t => ({
            name: t.name,
            description: t.description,
            tags: t.tags,
          })), null, 2));
        } else {
          console.log(formatter.formatTemplates(templates));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatter.formatError(message));
        process.exit(1);
      }
    });
}
