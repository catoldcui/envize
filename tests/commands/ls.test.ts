import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProfileStore } from '../../src/core/ProfileStore.js';
import { OutputFormatter } from '../../src/core/OutputFormatter.js';

describe('ls command integration', () => {
  let tempDir: string;
  let globalDir: string;
  let localDir: string;
  let store: ProfileStore;
  let formatter: OutputFormatter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envize-test-'));
    globalDir = path.join(tempDir, 'global', 'profiles');
    localDir = path.join(tempDir, 'local', 'profiles');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(localDir, { recursive: true });
    
    store = new ProfileStore(globalDir, localDir);
    formatter = new OutputFormatter(false);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should list all available profiles', () => {
    fs.writeFileSync(
      path.join(globalDir, 'global1.env'),
      '# @description: Global profile 1\nKEY=value'
    );
    fs.writeFileSync(
      path.join(localDir, 'local1.env'),
      '# @description: Local profile 1\nKEY=value'
    );

    const profiles = store.listProfiles();

    expect(profiles).toHaveLength(2);
    expect(profiles.map(p => p.name).sort()).toEqual(['global1', 'local1']);
  });

  it('should show local/global indicator', () => {
    fs.writeFileSync(path.join(globalDir, 'global.env'), 'KEY=value');
    fs.writeFileSync(path.join(localDir, 'local.env'), 'KEY=value');

    const profiles = store.listProfiles();
    const globalProfile = profiles.find(p => p.name === 'global');
    const localProfile = profiles.find(p => p.name === 'local');

    expect(globalProfile?.isLocal).toBe(false);
    expect(localProfile?.isLocal).toBe(true);
  });

  it('should local override global with same name', () => {
    fs.writeFileSync(
      path.join(globalDir, 'shared.env'),
      '# @description: Global version\nKEY=global'
    );
    fs.writeFileSync(
      path.join(localDir, 'shared.env'),
      '# @description: Local version\nKEY=local'
    );

    const profiles = store.listProfiles();
    const shared = profiles.find(p => p.name === 'shared');

    expect(profiles).toHaveLength(1);
    expect(shared?.isLocal).toBe(true);
    expect(shared?.description).toBe('Local version');
  });

  it('should include descriptions in verbose output', () => {
    fs.writeFileSync(
      path.join(globalDir, 'test.env'),
      '# @description: Test profile description\n# @tags: test, demo\nKEY=value'
    );

    const profiles = store.listProfiles();
    const output = formatter.formatProfileList(profiles, true);

    expect(output).toContain('Test profile description');
    expect(output).toContain('Tags: test, demo');
    expect(output).toContain('Variables: 1');
  });

  it('should handle empty profile directories', () => {
    const profiles = store.listProfiles();
    const output = formatter.formatProfileList(profiles, false);

    expect(profiles).toHaveLength(0);
    expect(output).toContain('No profiles found');
  });

  it('should count variables correctly', () => {
    fs.writeFileSync(
      path.join(globalDir, 'test.env'),
      'KEY1=v1\nKEY2=v2\nKEY3=v3'
    );

    const profiles = store.listProfiles();
    const test = profiles.find(p => p.name === 'test');

    expect(test?.variableCount).toBe(3);
  });

  it('should support JSON output', () => {
    fs.writeFileSync(
      path.join(globalDir, 'test.env'),
      '# @description: Test\n# @tags: t1, t2\nKEY=value'
    );

    const profiles = store.listProfiles();
    const json = JSON.stringify(profiles, null, 2);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('test');
    expect(parsed[0].description).toBe('Test');
    expect(parsed[0].tags).toEqual(['t1', 't2']);
  });
});
