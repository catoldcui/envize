import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProfileStore } from '../../src/core/ProfileStore.js';
import { ProfileResolver } from '../../src/core/ProfileResolver.js';
import { StateManager } from '../../src/core/StateManager.js';
import { ShellAdapter } from '../../src/core/ShellAdapter.js';
import { SystemEnvWriter } from '../../src/core/SystemEnvWriter.js';
import { OutputFormatter } from '../../src/core/OutputFormatter.js';

describe('use command integration', () => {
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

  it('should resolve and apply a single profile', () => {
    // Setup profile
    fs.writeFileSync(
      path.join(globalDir, 'claude.env'),
      '# @description: Claude config\nCLAUDE_MODEL=opus\nAPI_KEY=secret'
    );

    // Resolve
    const resolved = resolver.resolve(['claude']);
    
    // Update state
    stateManager.update(['claude'], resolved.variables);

    // Verify
    expect(resolved.variables.CLAUDE_MODEL.value).toBe('opus');
    expect(resolved.variables.API_KEY.value).toBe('secret');
    
    const state = stateManager.load();
    expect(state.active_profiles).toEqual(['claude']);
  });

  it('should merge multiple profiles with conflict detection', () => {
    fs.writeFileSync(path.join(globalDir, 'p1.env'), 'KEY=from_p1\nUNIQUE1=v1');
    fs.writeFileSync(path.join(globalDir, 'p2.env'), 'KEY=from_p2\nUNIQUE2=v2');

    const resolved = resolver.resolve(['p1', 'p2']);

    expect(resolved.variables.KEY.value).toBe('from_p2');
    expect(resolved.variables.KEY.source).toBe('p2');
    expect(resolved.variables.UNIQUE1.value).toBe('v1');
    expect(resolved.variables.UNIQUE2.value).toBe('v2');
    expect(resolved.conflicts).toHaveLength(1);
    expect(resolved.conflicts[0].variable).toBe('KEY');
  });

  it('should generate correct shell commands', () => {
    fs.writeFileSync(path.join(globalDir, 'test.env'), 'KEY=value');

    const resolved = resolver.resolve(['test']);
    const commands = shellAdapter.generateExports(
      Object.fromEntries(
        Object.entries(resolved.variables).map(([k, v]) => [k, v.value])
      )
    );

    expect(commands).toContain("export KEY='value'");
  });

  it('should write to persist file when persist option is used', () => {
    fs.writeFileSync(path.join(globalDir, 'test.env'), 'KEY=value');

    const resolved = resolver.resolve(['test']);
    systemEnvWriter.write(
      Object.fromEntries(
        Object.entries(resolved.variables).map(([k, v]) => [k, v.value])
      )
    );

    expect(fs.existsSync(activeShPath)).toBe(true);
    const content = fs.readFileSync(activeShPath, 'utf-8');
    expect(content).toContain("export KEY='value'");
  });

  it('should replace active profiles on subsequent use', () => {
    fs.writeFileSync(path.join(globalDir, 'p1.env'), 'KEY1=v1');
    fs.writeFileSync(path.join(globalDir, 'p2.env'), 'KEY2=v2');

    // First use
    let resolved = resolver.resolve(['p1']);
    stateManager.update(['p1'], resolved.variables);

    let state = stateManager.load();
    expect(state.active_profiles).toEqual(['p1']);
    expect(state.variables.KEY1).toBeDefined();

    // Second use (replaces)
    resolved = resolver.resolve(['p2']);
    stateManager.update(['p2'], resolved.variables);

    state = stateManager.load();
    expect(state.active_profiles).toEqual(['p2']);
    expect(state.variables.KEY2).toBeDefined();
    expect(state.variables.KEY1).toBeUndefined();
  });

  it('should handle profile with special characters in values', () => {
    fs.writeFileSync(
      path.join(globalDir, 'test.env'),
      "KEY=\"value with spaces and 'quotes'\""
    );

    const resolved = resolver.resolve(['test']);
    const commands = shellAdapter.generateExport('KEY', resolved.variables.KEY.value);

    // Should be properly escaped
    expect(commands).toContain("export KEY=");
    expect(commands).toContain("'\\''");
  });
});
