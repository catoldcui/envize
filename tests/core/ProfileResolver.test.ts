import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProfileStore } from '../../src/core/ProfileStore.js';
import { ProfileResolver } from '../../src/core/ProfileResolver.js';

describe('ProfileResolver', () => {
  let tempDir: string;
  let globalDir: string;
  let localDir: string;
  let store: ProfileStore;
  let resolver: ProfileResolver;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envize-test-'));
    globalDir = path.join(tempDir, 'global', 'profiles');
    localDir = path.join(tempDir, 'local', 'profiles');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(localDir, { recursive: true });
    
    store = new ProfileStore(globalDir, localDir);
    resolver = new ProfileResolver(store);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('resolve', () => {
    it('should resolve single profile', () => {
      fs.writeFileSync(path.join(globalDir, 'test.env'), 'KEY=value\nKEY2=value2');
      
      const resolved = resolver.resolve(['test']);
      
      expect(resolved.variables.KEY.value).toBe('value');
      expect(resolved.variables.KEY.source).toBe('test');
      expect(resolved.variables.KEY2.value).toBe('value2');
      expect(resolved.conflicts).toHaveLength(0);
    });

    it('should merge multiple profiles in order', () => {
      fs.writeFileSync(path.join(globalDir, 'profile1.env'), 'KEY1=value1\nSHARED=from1');
      fs.writeFileSync(path.join(globalDir, 'profile2.env'), 'KEY2=value2\nSHARED=from2');
      
      const resolved = resolver.resolve(['profile1', 'profile2']);
      
      expect(resolved.variables.KEY1.value).toBe('value1');
      expect(resolved.variables.KEY2.value).toBe('value2');
      expect(resolved.variables.SHARED.value).toBe('from2');
      expect(resolved.variables.SHARED.source).toBe('profile2');
    });

    it('should detect conflicts', () => {
      fs.writeFileSync(path.join(globalDir, 'profile1.env'), 'SHARED=from1');
      fs.writeFileSync(path.join(globalDir, 'profile2.env'), 'SHARED=from2');
      
      const resolved = resolver.resolve(['profile1', 'profile2']);
      
      expect(resolved.conflicts).toHaveLength(1);
      expect(resolved.conflicts[0].variable).toBe('SHARED');
      expect(resolved.conflicts[0].profiles).toEqual(['profile1', 'profile2']);
      expect(resolved.conflicts[0].winner).toBe('profile2');
    });

    it('should throw for non-existent profile', () => {
      expect(() => resolver.resolve(['nonexistent'])).toThrow('Profile not found: nonexistent');
    });
  });

  describe('resolveProfiles', () => {
    it('should resolve profiles directly', () => {
      const profiles = [
        {
          name: 'p1',
          path: '/fake/path',
          isLocal: false,
          metadata: { description: '', tags: [] },
          variables: { KEY1: 'v1' },
        },
        {
          name: 'p2',
          path: '/fake/path',
          isLocal: false,
          metadata: { description: '', tags: [] },
          variables: { KEY2: 'v2' },
        },
      ];

      const resolved = resolver.resolveProfiles(profiles);
      
      expect(resolved.variables.KEY1.value).toBe('v1');
      expect(resolved.variables.KEY2.value).toBe('v2');
    });
  });

  describe('diff', () => {
    it('should compute variables to set and unset', () => {
      const current = {
        KEEP: { value: 'keep', source: 'p1' },
        CHANGE: { value: 'old', source: 'p1' },
        REMOVE: { value: 'remove', source: 'p1' },
      };
      const next = {
        KEEP: { value: 'keep', source: 'p1' },
        CHANGE: { value: 'new', source: 'p2' },
        ADD: { value: 'add', source: 'p2' },
      };

      const diff = resolver.diff(current, next);
      
      expect(diff.toSet).toEqual({ CHANGE: 'new', ADD: 'add' });
      expect(diff.toUnset).toEqual(['REMOVE']);
    });
  });

  describe('computeRemoval', () => {
    it('should compute what to unset when removing profiles', () => {
      fs.writeFileSync(path.join(globalDir, 'profile1.env'), 'KEY1=value1\nSHARED=shared');
      fs.writeFileSync(path.join(globalDir, 'profile2.env'), 'KEY2=value2\nSHARED=shared2');

      const currentVars = {
        KEY1: { value: 'value1', source: 'profile1' },
        KEY2: { value: 'value2', source: 'profile2' },
        SHARED: { value: 'shared2', source: 'profile2' },
      };

      const result = resolver.computeRemoval(currentVars, ['profile1']);
      
      // KEY2 should be unset, SHARED should be kept from profile1
      expect(result.toUnset).toEqual(['KEY2']);
      expect(result.toKeep.KEY1).toBeDefined();
      expect(result.toKeep.SHARED.value).toBe('shared');
    });

    it('should unset all when no remaining profiles', () => {
      const currentVars = {
        KEY1: { value: 'value1', source: 'profile1' },
        KEY2: { value: 'value2', source: 'profile2' },
      };

      const result = resolver.computeRemoval(currentVars, []);
      
      expect(result.toUnset.sort()).toEqual(['KEY1', 'KEY2']);
      expect(Object.keys(result.toKeep)).toHaveLength(0);
    });
  });
});
