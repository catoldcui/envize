import type { Template } from '../types.js';
import { ProfileStore } from './ProfileStore.js';

/**
 * TemplateEngine - provides built-in templates for common services
 */
export class TemplateEngine {
  private templates: Map<string, Template>;

  constructor() {
    this.templates = new Map();
    this.registerBuiltinTemplates();
  }

  /**
   * Register all built-in templates
   */
  private registerBuiltinTemplates(): void {
    this.register({
      name: 'claude',
      description: 'Anthropic Claude API configuration',
      tags: ['ai', 'anthropic', 'llm'],
      content: `# @description: Claude API configuration using {{CLAUDE_MODEL}}
# @tags: ai, anthropic, llm

ANTHROPIC_API_KEY=<your-api-key-here>
CLAUDE_MODEL=claude-sonnet-4-20250514
`,
    });

    this.register({
      name: 'openai',
      description: 'OpenAI API configuration',
      tags: ['ai', 'openai', 'llm'],
      content: `# @description: OpenAI API configuration using {{OPENAI_MODEL}}
# @tags: ai, openai, llm

OPENAI_API_KEY=<your-api-key-here>
OPENAI_MODEL=gpt-4o
OPENAI_ORG_ID=<your-org-id-here>
`,
    });

    this.register({
      name: 'aws',
      description: 'AWS credentials and region configuration',
      tags: ['cloud', 'aws'],
      content: `# @description: AWS credentials for {{AWS_PROFILE}} profile
# @tags: cloud, aws

AWS_ACCESS_KEY_ID=<your-access-key-here>
AWS_SECRET_ACCESS_KEY=<your-secret-key-here>
AWS_REGION=us-east-1
AWS_PROFILE=default
`,
    });

    this.register({
      name: 'supabase',
      description: 'Supabase project configuration',
      tags: ['database', 'supabase', 'backend'],
      content: `# @description: Supabase configuration for {{SUPABASE_PROJECT_ID}}
# @tags: database, supabase, backend

SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-here>
SUPABASE_PROJECT_ID=<your-project-id>
`,
    });

    this.register({
      name: 'stripe',
      description: 'Stripe payment processing configuration',
      tags: ['payments', 'stripe'],
      content: `# @description: Stripe {{STRIPE_MODE}} mode configuration
# @tags: payments, stripe

STRIPE_SECRET_KEY=<your-secret-key-here>
STRIPE_PUBLISHABLE_KEY=<your-publishable-key-here>
STRIPE_WEBHOOK_SECRET=<your-webhook-secret-here>
STRIPE_MODE=test
`,
    });

    this.register({
      name: 'vercel',
      description: 'Vercel deployment configuration',
      tags: ['deployment', 'vercel', 'hosting'],
      content: `# @description: Vercel deployment configuration
# @tags: deployment, vercel, hosting

VERCEL_TOKEN=<your-vercel-token-here>
VERCEL_ORG_ID=<your-org-id-here>
VERCEL_PROJECT_ID=<your-project-id-here>
`,
    });

    this.register({
      name: 'qwen',
      description: 'Qwen AI API configuration',
      tags: ['ai', 'qwen', 'llm'],
      content: `# @description: Qwen AI API configuration using {{QWEN_MODEL}}
# @tags: ai, qwen, llm

QWEN_API_KEY=<your-api-key-here>
QWEN_MODEL=qwen-max
QWEN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
`,
    });
  }

  /**
   * Register a template
   */
  register(template: Template): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get a template by name
   */
  get(name: string): Template | undefined {
    return this.templates.get(name);
  }

  /**
   * List all available templates
   */
  list(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Check if a template exists
   */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Initialize a profile from a template
   */
  init(templateName: string, profileStore: ProfileStore, local: boolean = true): string {
    const template = this.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Save the template content as a new profile
    const profilePath = profileStore.saveProfile(templateName, template.content, local);
    return profilePath;
  }

  /**
   * Get placeholders that need to be filled in a template
   */
  getPlaceholders(templateName: string): string[] {
    const template = this.get(templateName);
    if (!template) {
      return [];
    }

    const placeholders: string[] = [];
    const regex = /<[^>]+>/g;
    let match;

    while ((match = regex.exec(template.content)) !== null) {
      if (!placeholders.includes(match[0])) {
        placeholders.push(match[0]);
      }
    }

    return placeholders;
  }
}
