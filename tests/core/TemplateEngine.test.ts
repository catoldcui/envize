import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TemplateEngine } from '../../src/core/TemplateEngine.js';
import { ProfileStore } from '../../src/core/ProfileStore.js';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('built-in templates', () => {
    it('should have claude template', () => {
      expect(engine.has('claude')).toBe(true);
      const template = engine.get('claude');
      expect(template?.description).toContain('Claude');
      expect(template?.tags).toContain('ai');
    });

    it('should have openai template', () => {
      expect(engine.has('openai')).toBe(true);
      const template = engine.get('openai');
      expect(template?.content).toContain('OPENAI_API_KEY');
    });

    it('should have aws template', () => {
      expect(engine.has('aws')).toBe(true);
      const template = engine.get('aws');
      expect(template?.content).toContain('AWS_ACCESS_KEY_ID');
    });

    it('should have supabase template', () => {
      expect(engine.has('supabase')).toBe(true);
      const template = engine.get('supabase');
      expect(template?.content).toContain('SUPABASE_URL');
    });

    it('should have stripe template', () => {
      expect(engine.has('stripe')).toBe(true);
      const template = engine.get('stripe');
      expect(template?.content).toContain('STRIPE_SECRET_KEY');
    });

    it('should have vercel template', () => {
      expect(engine.has('vercel')).toBe(true);
      const template = engine.get('vercel');
      expect(template?.content).toContain('VERCEL_TOKEN');
    });
  });

  describe('list', () => {
    it('should list all templates', () => {
      const templates = engine.list();
      expect(templates.length).toBeGreaterThanOrEqual(6);
      const names = templates.map(t => t.name);
      expect(names).toContain('claude');
      expect(names).toContain('openai');
      expect(names).toContain('aws');
    });
  });

  describe('register', () => {
    it('should register custom template', () => {
      engine.register({
        name: 'custom',
        description: 'Custom template',
        tags: ['custom'],
        content: 'KEY=value',
      });

      expect(engine.has('custom')).toBe(true);
      const template = engine.get('custom');
      expect(template?.description).toBe('Custom template');
    });
  });

  describe('getPlaceholders', () => {
    it('should extract placeholders from template', () => {
      const placeholders = engine.getPlaceholders('claude');
      expect(placeholders).toContain('<your-api-key-here>');
    });

    it('should return empty array for non-existent template', () => {
      const placeholders = engine.getPlaceholders('nonexistent');
      expect(placeholders).toEqual([]);
    });

    it('should not return duplicate placeholders', () => {
      engine.register({
        name: 'test',
        description: 'Test',
        tags: [],
        content: 'KEY1=<placeholder>\nKEY2=<placeholder>',
      });

      const placeholders = engine.getPlaceholders('test');
      expect(placeholders).toHaveLength(1);
    });
  });

  describe('init', () => {
    let tempDir: string;
    let store: ProfileStore;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envize-test-'));
      const globalDir = path.join(tempDir, 'global', 'profiles');
      const localDir = path.join(tempDir, 'local', 'profiles');
      fs.mkdirSync(globalDir, { recursive: true });
      fs.mkdirSync(localDir, { recursive: true });
      store = new ProfileStore(globalDir, localDir);
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create profile from template', () => {
      const profilePath = engine.init('claude', store, true);
      
      expect(fs.existsSync(profilePath)).toBe(true);
      const content = fs.readFileSync(profilePath, 'utf-8');
      expect(content).toContain('ANTHROPIC_API_KEY');
    });

    it('should throw for non-existent template', () => {
      expect(() => engine.init('nonexistent', store, true))
        .toThrow('Template not found: nonexistent');
    });
  });
});
