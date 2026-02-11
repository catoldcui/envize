import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProfileStore } from '../../src/core/ProfileStore.js';

describe('ProfileStore', () => {
  let tempDir: string;
  let globalDir: string;
  let localDir: string;
  let store: ProfileStore;

  beforeEach(() => {
    // Create temp directories
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envize-test-'));
    globalDir = path.join(tempDir, 'global', 'profiles');
    localDir = path.join(tempDir, 'local', 'profiles');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(localDir, { recursive: true });
    
    store = new ProfileStore(globalDir, localDir);
  });

  afterEach(() => {
    // Clean up temp directories
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseMetadata', () => {
    it('should parse description from content', () => {
      const content = `# @description: Test profile
KEY=value`;
      const metadata = store.parseMetadata(content);
      expect(metadata.description).toBe('Test profile');
    });

    it('should parse tags from content', () => {
      const content = `# @tags: ai, claude, llm
KEY=value`;
      const metadata = store.parseMetadata(content);
      expect(metadata.tags).toEqual(['ai', 'claude', 'llm']);
    });

    it('should handle missing metadata', () => {
      const content = `KEY=value`;
      const metadata = store.parseMetadata(content);
      expect(metadata.description).toBe('');
      expect(metadata.tags).toEqual([]);
    });
  });

  describe('parseVariables', () => {
    it('should parse simple KEY=VALUE', () => {
      const content = `KEY=value`;
      const variables = store.parseVariables(content);
      expect(variables).toEqual({ KEY: 'value' });
    });

    it('should parse quoted values', () => {
      const content = `KEY="value with spaces"
KEY2='single quoted'`;
      const variables = store.parseVariables(content);
      expect(variables.KEY).toBe('value with spaces');
      expect(variables.KEY2).toBe('single quoted');
    });

    it('should skip comments and empty lines', () => {
      const content = `# comment
KEY=value

# another comment
KEY2=value2`;
      const variables = store.parseVariables(content);
      expect(variables).toEqual({ KEY: 'value', KEY2: 'value2' });
    });
  });

  describe('interpolateDescription', () => {
    it('should interpolate variables in description', () => {
      const description = 'Using {{MODEL}} for {{TASK}}';
      const variables = { MODEL: 'claude', TASK: 'coding' };
      const result = store.interpolateDescription(description, variables);
      expect(result).toBe('Using claude for coding');
    });

    it('should leave unmatched placeholders', () => {
      const description = 'Using {{MODEL}}';
      const variables = {};
      const result = store.interpolateDescription(description, variables);
      expect(result).toBe('Using {{MODEL}}');
    });
  });

  describe('loadProfile', () => {
    it('should load profile from global directory', () => {
      const profileContent = `# @description: Test profile
# @tags: test

API_KEY=secret123`;
      fs.writeFileSync(path.join(globalDir, 'test.env'), profileContent);

      const profile = store.loadProfile('test');
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('test');
      expect(profile?.isLocal).toBe(false);
      expect(profile?.variables.API_KEY).toBe('secret123');
    });

    it('should prefer local over global profiles', () => {
      fs.writeFileSync(path.join(globalDir, 'test.env'), 'KEY=global');
      fs.writeFileSync(path.join(localDir, 'test.env'), 'KEY=local');

      const profile = store.loadProfile('test');
      expect(profile?.isLocal).toBe(true);
      expect(profile?.variables.KEY).toBe('local');
    });

    it('should return null for non-existent profile', () => {
      const profile = store.loadProfile('nonexistent');
      expect(profile).toBeNull();
    });
  });

  describe('listProfiles', () => {
    it('should list all profiles', () => {
      fs.writeFileSync(path.join(globalDir, 'global1.env'), '# @description: Global 1\nK=v');
      fs.writeFileSync(path.join(localDir, 'local1.env'), '# @description: Local 1\nK=v');

      const profiles = store.listProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles.map(p => p.name).sort()).toEqual(['global1', 'local1']);
    });

    it('should override global with local profiles of same name', () => {
      fs.writeFileSync(path.join(globalDir, 'test.env'), '# @description: Global\nK=v');
      fs.writeFileSync(path.join(localDir, 'test.env'), '# @description: Local\nK=v');

      const profiles = store.listProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].isLocal).toBe(true);
      expect(profiles[0].description).toBe('Local');
    });
  });

  describe('saveProfile', () => {
    it('should save profile to local directory', () => {
      const content = '# @description: New profile\nKEY=value';
      const savedPath = store.saveProfile('new', content, true);
      
      expect(fs.existsSync(savedPath)).toBe(true);
      expect(savedPath).toContain('local');
    });

    it('should save profile to global directory', () => {
      const content = '# @description: New profile\nKEY=value';
      const savedPath = store.saveProfile('new', content, false);
      
      expect(fs.existsSync(savedPath)).toBe(true);
      expect(savedPath).toContain('global');
    });
  });

  describe('deleteProfile', () => {
    it('should delete existing profile', () => {
      fs.writeFileSync(path.join(localDir, 'test.env'), 'KEY=value');
      
      const deleted = store.deleteProfile('test');
      expect(deleted).toBe(true);
      expect(fs.existsSync(path.join(localDir, 'test.env'))).toBe(false);
    });

    it('should return false for non-existent profile', () => {
      const deleted = store.deleteProfile('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('generateProfileContent', () => {
    it('should generate valid profile content', () => {
      const metadata = { description: 'Test profile', tags: ['test', 'demo'] };
      const variables = { KEY: 'value', API_KEY: 'secret' };
      
      const content = store.generateProfileContent(metadata, variables);
      
      expect(content).toContain('# @description: Test profile');
      expect(content).toContain('# @tags: test, demo');
      expect(content).toContain('KEY=value');
      expect(content).toContain('API_KEY=secret');
    });
  });
});
