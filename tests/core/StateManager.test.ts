import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateManager } from '../../src/core/StateManager.js';

describe('StateManager', () => {
  let tempDir: string;
  let statePath: string;
  let stateManager: StateManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envize-test-'));
    statePath = path.join(tempDir, 'state.json');
    stateManager = new StateManager(statePath);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should return empty state when file does not exist', () => {
      const state = stateManager.load();
      expect(state.active_profiles).toEqual([]);
      expect(state.variables).toEqual({});
      expect(state.snapshot).toEqual({});
    });

    it('should load existing state', () => {
      const existing = {
        active_profiles: ['profile1'],
        variables: { KEY: { value: 'v', source: 'profile1' } },
        snapshot: { KEY: null },
        applied_at: '2024-01-01T00:00:00Z',
      };
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(existing));

      const state = stateManager.load();
      expect(state.active_profiles).toEqual(['profile1']);
      expect(state.variables.KEY.value).toBe('v');
    });

    it('should return empty state on parse error', () => {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, 'invalid json');

      const state = stateManager.load();
      expect(state.active_profiles).toEqual([]);
    });
  });

  describe('save', () => {
    it('should save state to file', () => {
      const state = {
        active_profiles: ['profile1'],
        variables: { KEY: { value: 'v', source: 'profile1' } },
        snapshot: { KEY: null },
        applied_at: '2024-01-01T00:00:00Z',
      };

      stateManager.save(state);

      expect(fs.existsSync(statePath)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      expect(saved.active_profiles).toEqual(['profile1']);
    });
  });

  describe('update', () => {
    it('should update state with new profiles and variables', () => {
      const variables = {
        KEY: { value: 'value', source: 'profile1' },
      };

      const state = stateManager.update(['profile1'], variables);

      expect(state.active_profiles).toEqual(['profile1']);
      expect(state.variables.KEY.value).toBe('value');
      expect(state.applied_at).toBeDefined();
    });

    it('should capture snapshot of current env values', () => {
      process.env.EXISTING_KEY = 'existing';
      
      const variables = {
        EXISTING_KEY: { value: 'new', source: 'profile1' },
        NEW_KEY: { value: 'new', source: 'profile1' },
      };

      const state = stateManager.update(['profile1'], variables);

      expect(state.snapshot.EXISTING_KEY).toBe('existing');
      expect(state.snapshot.NEW_KEY).toBeNull();

      delete process.env.EXISTING_KEY;
    });
  });

  describe('clear', () => {
    it('should reset state to empty', () => {
      // First set some state
      stateManager.update(['profile1'], { KEY: { value: 'v', source: 'profile1' } });
      
      const clearedState = stateManager.clear();

      expect(clearedState.active_profiles).toEqual([]);
      expect(clearedState.variables).toEqual({});
    });
  });

  describe('getActiveProfiles', () => {
    it('should return active profiles', () => {
      stateManager.update(['p1', 'p2'], {});
      expect(stateManager.getActiveProfiles()).toEqual(['p1', 'p2']);
    });
  });

  describe('hasActiveProfiles', () => {
    it('should return true when profiles are active', () => {
      stateManager.update(['p1'], {});
      expect(stateManager.hasActiveProfiles()).toBe(true);
    });

    it('should return false when no profiles are active', () => {
      expect(stateManager.hasActiveProfiles()).toBe(false);
    });
  });

  describe('addProfiles', () => {
    it('should add profiles to active set', () => {
      stateManager.update(['p1'], { K1: { value: 'v1', source: 'p1' } });
      
      const state = stateManager.addProfiles(['p2'], { K2: { value: 'v2', source: 'p2' } });

      expect(state.active_profiles).toEqual(['p1', 'p2']);
      expect(state.variables.K1).toBeDefined();
      expect(state.variables.K2).toBeDefined();
    });

    it('should not duplicate existing profiles', () => {
      stateManager.update(['p1'], {});
      
      const state = stateManager.addProfiles(['p1', 'p2'], {});

      expect(state.active_profiles).toEqual(['p1', 'p2']);
    });
  });

  describe('removeProfiles', () => {
    it('should remove profiles from active set', () => {
      stateManager.update(['p1', 'p2'], {
        K1: { value: 'v1', source: 'p1' },
        K2: { value: 'v2', source: 'p2' },
      });

      const state = stateManager.removeProfiles(
        ['p2'],
        { K1: { value: 'v1', source: 'p1' } },
        ['K2']
      );

      expect(state.active_profiles).toEqual(['p1']);
      expect(state.variables.K1).toBeDefined();
      expect(state.variables.K2).toBeUndefined();
    });
  });
});
