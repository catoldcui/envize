import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutputFormatter } from '../../src/core/OutputFormatter.js';

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;

  beforeEach(() => {
    formatter = new OutputFormatter(false);
  });

  describe('setJsonMode', () => {
    it('should enable JSON mode', () => {
      formatter.setJsonMode(true);
      expect(formatter['jsonMode']).toBe(true);
    });
  });

  describe('formatActivation', () => {
    it('should format activation message', () => {
      const result = formatter.formatActivation(
        ['profile1', 'profile2'],
        { KEY: { value: 'value', source: 'profile1' } },
        []
      );

      expect(result).toContain('Activated');
      expect(result).toContain('profile1, profile2');
      expect(result).toContain('1 variable(s) set');
    });

    it('should show conflicts', () => {
      const result = formatter.formatActivation(
        ['profile1', 'profile2'],
        { KEY: { value: 'value', source: 'profile2' } },
        [{ variable: 'KEY', profiles: ['profile1', 'profile2'], winner: 'profile2' }]
      );

      expect(result).toContain('Conflicts');
      expect(result).toContain('KEY');
      expect(result).toContain('profile1 → profile2');
    });
  });

  describe('formatProfileList', () => {
    it('should format profile list', () => {
      const profiles = [
        {
          name: 'test',
          path: '/path/test.env',
          isLocal: true,
          description: 'Test profile',
          tags: ['test'],
          variableCount: 3,
        },
      ];

      const result = formatter.formatProfileList(profiles, false);

      expect(result).toContain('test');
      expect(result).toContain('[local]');
      expect(result).toContain('3 vars');
    });

    it('should show verbose details', () => {
      const profiles = [
        {
          name: 'test',
          path: '/path/test.env',
          isLocal: false,
          description: 'Test profile description',
          tags: ['test', 'demo'],
          variableCount: 3,
        },
      ];

      const result = formatter.formatProfileList(profiles, true);

      expect(result).toContain('Test profile description');
      expect(result).toContain('Tags: test, demo');
      expect(result).toContain('Variables: 3');
    });

    it('should handle empty list', () => {
      const result = formatter.formatProfileList([], false);
      expect(result).toContain('No profiles found');
    });
  });

  describe('formatStatus', () => {
    it('should format status output', () => {
      const status = {
        active_profiles: ['profile1'],
        variables: { KEY: { value: 'secretvalue', source: 'profile1' } },
        applied_at: '2024-01-01T00:00:00Z',
      };

      const result = formatter.formatStatus(status, false);

      expect(result).toContain('Active profiles');
      expect(result).toContain('profile1');
      expect(result).toContain('KEY=secr****');
      expect(result).not.toContain('secretvalue');
    });

    it('should reveal values with reveal option', () => {
      const status = {
        active_profiles: ['profile1'],
        variables: { KEY: { value: 'secretvalue', source: 'profile1' } },
        applied_at: null,
      };

      const result = formatter.formatStatus(status, true);

      expect(result).toContain('secretvalue');
    });

    it('should handle no active profiles', () => {
      const status = {
        active_profiles: [],
        variables: {},
        applied_at: null,
      };

      const result = formatter.formatStatus(status);

      expect(result).toContain('No active profiles');
    });
  });

  describe('formatWhich', () => {
    it('should format which output', () => {
      const which = {
        variable: 'KEY',
        value: 'secretvalue',
        source: 'profile1',
        masked_value: 'secr****',
      };

      const result = formatter.formatWhich(which, false);

      expect(result).toContain('KEY=secr****');
      expect(result).toContain('Set by: profile1');
    });

    it('should handle null which', () => {
      const result = formatter.formatWhich(null, false);
      expect(result).toContain('Variable not set by envize');
    });
  });

  describe('formatReset', () => {
    it('should format reset confirmation', () => {
      const result = formatter.formatReset(5, 2);

      expect(result).toContain('Environment reset');
      expect(result).toContain('5 variable(s) unset');
      expect(result).toContain('2 variable(s) restored');
    });
  });

  describe('formatExplain', () => {
    it('should format explain output for LLM', () => {
      const status = {
        active_profiles: ['claude', 'aws'],
        variables: {
          CLAUDE_MODEL: { value: 'opus', source: 'claude' },
          AWS_REGION: { value: 'us-east-1', source: 'aws' },
        },
        applied_at: '2024-01-01T00:00:00Z',
      };

      const result = formatter.formatExplain(status);

      expect(result).toContain('# Current Environment State');
      expect(result).toContain('Active profiles: claude, aws');
      expect(result).toContain('CLAUDE_MODEL');
      expect(result).toContain('from claude');
    });

    it('should handle no active profiles', () => {
      const status = {
        active_profiles: [],
        variables: {},
        applied_at: null,
      };

      const result = formatter.formatExplain(status);

      expect(result).toContain('No envize profiles are currently active');
    });
  });

  describe('formatTemplates', () => {
    it('should format template list', () => {
      const templates = [
        { name: 'claude', description: 'Claude API', tags: ['ai'] },
        { name: 'aws', description: 'AWS Config', tags: ['cloud'] },
      ];

      const result = formatter.formatTemplates(templates);

      expect(result).toContain('Available templates');
      expect(result).toContain('claude');
      expect(result).toContain('Claude API');
      expect(result).toContain('Tags: ai');
    });
  });

  describe('format helpers', () => {
    it('should format error', () => {
      const result = formatter.formatError('Something went wrong');
      expect(result).toContain('Something went wrong');
    });

    it('should format success', () => {
      const result = formatter.formatSuccess('Done!');
      expect(result).toContain('Done!');
    });

    it('should format warning', () => {
      const result = formatter.formatWarning('Be careful');
      expect(result).toContain('Be careful');
    });

    it('should format info', () => {
      const result = formatter.formatInfo('FYI');
      expect(result).toContain('FYI');
    });
  });
});
