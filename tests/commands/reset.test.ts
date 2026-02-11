import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProfileStore } from '../../src/core/ProfileStore.js';
import { ProfileResolver } from '../../src/core/ProfileResolver.js';
import { StateManager } from '../../src/core/StateManager.js';
import { ShellAdapter } from '../../src/core/ShellAdapter.js';
import { SystemEnvWriter } from '../../src/core/SystemEnvWriter.js';
import { OutputFormatter } from '../../src/core/OutputFormatter.js';

describe('reset command integration', () => {
  let tempDir: string;
  let globalDir: string;
  let localDir: string;
  let statePath: string;
  let activeShPath: string;
  let store: ProfileStore;
  let resolver: ProfileResolver;
  let stateManager: StateManager;
  let shellAdapter: ShellAdapter;
  let systemEnvWriter: SystemEnvWriter;
  let formatter: OutputFormatter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envize-test-'));
    globalDir = path.join(tempDir, 'global', 'profiles');
    localDir = path.join(tempDir, 'local', 'profiles');
    statePath = path.join(tempDir, 'state.json');
    activeShPath = path.join(tempDir, 'active.sh');

    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(localDir, { recursive: true });

    store = new ProfileStore(globalDir, localDir);
    resolver = new ProfileResolver(store);
    stateManager = new StateManager(statePath);
    shellAdapter = new ShellAdapter('bash');
    systemEnvWriter = new SystemEnvWriter(activeShPath, 'bash');
    formatter = new OutputFormatter(false);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should clear state when reset is called', () => {
    // Setup: create and activate a profile
    fs.writeFileSync(path.join(globalDir, 'test.env'), 'KEY=value');
    const resolved = resolver.resolve(['test']);
    stateManager.update(['test'], resolved.variables);

    // Verify state is populated
    let state = stateManager.load();
    expect(state.active_profiles).toEqual(['test']);
    expect(state.variables.KEY).toBeDefined();

    // Reset
    stateManager.clear();

    // Verify state is cleared
    state = stateManager.load();
    expect(state.active_profiles).toEqual([]);
    expect(state.variables).toEqual({});
    expect(state.snapshot).toEqual({});
  });

  it('should clear global file when reset --global is called with active profiles', () => {
    // Setup: create profile and write to global file
    fs.writeFileSync(path.join(globalDir, 'test.env'), 'KEY=value');
    const resolved = resolver.resolve(['test']);
    stateManager.update(['test'], resolved.variables);
    systemEnvWriter.write({ KEY: 'value' });

    // Verify global file exists
    expect(fs.existsSync(activeShPath)).toBe(true);

    // Reset with --global
    stateManager.clear();
    systemEnvWriter.clear();

    // Verify global file is deleted
    expect(fs.existsSync(activeShPath)).toBe(false);
  });

  it('should clear global file when reset --global is called WITHOUT active profiles', () => {
    // Setup: create global file without any active state
    // This simulates the case where state.json was already cleared
    // but active.sh still exists from a previous session
    systemEnvWriter.write({ KEY: 'value' });

    // Verify global file exists
    expect(fs.existsSync(activeShPath)).toBe(true);

    // Verify no active profiles
    const state = stateManager.load();
    expect(state.active_profiles).toEqual([]);

    // Reset with --global (this is the bug fix)
    systemEnvWriter.clear();

    // Verify global file is deleted even without active profiles
    expect(fs.existsSync(activeShPath)).toBe(false);
  });

  it('should not fail when clearing non-existent global file', () => {
    // Verify no global file exists
    expect(fs.existsSync(activeShPath)).toBe(false);

    // Should not throw
    expect(() => systemEnvWriter.clear()).not.toThrow();

    // Still should not exist
    expect(fs.existsSync(activeShPath)).toBe(false);
  });

  it('should generate unset commands for variables that did not exist before', () => {
    // Setup profile with variables that didn't exist before
    fs.writeFileSync(path.join(globalDir, 'test.env'), 'NEW_VAR=value');
    const resolved = resolver.resolve(['test']);

    // Simulate that NEW_VAR didn't exist before (snapshot is null)
    const state = stateManager.update(['test'], resolved.variables);

    // Verify snapshot captured null for NEW_VAR
    expect(state.snapshot.NEW_VAR).toBe(null);

    // Generate unset commands
    const unsetCommands = shellAdapter.generateUnsets(['NEW_VAR']);
    expect(unsetCommands).toContain('unset NEW_VAR');
  });

  it('should generate restore commands for variables that existed before', () => {
    // Simulate existing env variable
    const originalValue = 'original';

    // Setup: create state with a snapshot of the original value
    fs.writeFileSync(path.join(globalDir, 'test.env'), 'KEY=new_value');
    const resolved = resolver.resolve(['test']);

    // Manually set snapshot to simulate KEY had a previous value
    const state = stateManager.load();
    state.snapshot['KEY'] = originalValue;
    state.active_profiles = ['test'];
    state.variables = resolved.variables;
    stateManager.save(state);

    // Generate restore commands
    const restoreCommands = shellAdapter.generateExports({ KEY: originalValue });
    expect(restoreCommands).toContain("export KEY='original'");
  });
});
