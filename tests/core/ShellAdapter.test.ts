import { describe, it, expect } from 'vitest';
import { ShellAdapter } from '../../src/core/ShellAdapter.js';

describe('ShellAdapter', () => {
  describe('generateExport', () => {
    it('should generate bash export', () => {
      const adapter = new ShellAdapter('bash');
      const result = adapter.generateExport('KEY', 'value');
      expect(result).toBe("export KEY='value'");
    });

    it('should generate zsh export', () => {
      const adapter = new ShellAdapter('zsh');
      const result = adapter.generateExport('KEY', 'value');
      expect(result).toBe("export KEY='value'");
    });

    it('should generate fish export', () => {
      const adapter = new ShellAdapter('fish');
      const result = adapter.generateExport('KEY', 'value');
      expect(result).toBe("set -gx KEY 'value'");
    });

    it('should escape single quotes in values', () => {
      const adapter = new ShellAdapter('bash');
      const result = adapter.generateExport('KEY', "value'with'quotes");
      expect(result).toBe("export KEY='value'\\''with'\\''quotes'");
    });
  });

  describe('generateUnset', () => {
    it('should generate bash unset', () => {
      const adapter = new ShellAdapter('bash');
      const result = adapter.generateUnset('KEY');
      expect(result).toBe('unset KEY');
    });

    it('should generate fish unset', () => {
      const adapter = new ShellAdapter('fish');
      const result = adapter.generateUnset('KEY');
      expect(result).toBe('set -e KEY');
    });
  });

  describe('generateExports', () => {
    it('should generate multiple exports', () => {
      const adapter = new ShellAdapter('bash');
      const result = adapter.generateExports({ KEY1: 'v1', KEY2: 'v2' });
      expect(result).toContain("export KEY1='v1'");
      expect(result).toContain("export KEY2='v2'");
    });
  });

  describe('generateUnsets', () => {
    it('should generate multiple unsets', () => {
      const adapter = new ShellAdapter('bash');
      const result = adapter.generateUnsets(['KEY1', 'KEY2']);
      expect(result).toContain('unset KEY1');
      expect(result).toContain('unset KEY2');
    });
  });

  describe('generateCommands', () => {
    it('should generate combined set and unset', () => {
      const adapter = new ShellAdapter('bash');
      const result = adapter.generateCommands(
        { NEW: 'value' },
        ['OLD']
      );
      expect(result).toContain('unset OLD');
      expect(result).toContain("export NEW='value'");
    });
  });

  describe('getShellWrapper', () => {
    it('should return bash wrapper for bash', () => {
      const adapter = new ShellAdapter('bash');
      const wrapper = adapter.getShellWrapper();
      expect(wrapper).toContain('envize()');
      expect(wrapper).toContain('eval "$output"');
      expect(wrapper).toContain('source "$HOME/.envize/active.sh"');
    });

    it('should return fish wrapper for fish', () => {
      const adapter = new ShellAdapter('fish');
      const wrapper = adapter.getShellWrapper();
      expect(wrapper).toContain('function envize');
      expect(wrapper).toContain('eval $output');
      expect(wrapper).toContain('source "$HOME/.envize/active.fish"');
    });
  });

  describe('wrapper installation', () => {
    it('should detect installed wrapper', () => {
      const adapter = new ShellAdapter('bash');
      const content = `some stuff
${adapter.getMarkerStart()}
wrapper code
${adapter.getMarkerEnd()}
more stuff`;
      expect(adapter.isWrapperInstalled(content)).toBe(true);
    });

    it('should not detect wrapper when not present', () => {
      const adapter = new ShellAdapter('bash');
      expect(adapter.isWrapperInstalled('some other content')).toBe(false);
    });

    it('should add wrapper to content', () => {
      const adapter = new ShellAdapter('bash');
      const content = 'existing content\n';
      const result = adapter.addWrapper(content);
      expect(result).toContain('existing content');
      expect(result).toContain(adapter.getMarkerStart());
      expect(result).toContain(adapter.getMarkerEnd());
    });

    it('should remove wrapper from content', () => {
      const adapter = new ShellAdapter('bash');
      const content = `before
${adapter.getMarkerStart()}
wrapper
${adapter.getMarkerEnd()}
after`;
      const result = adapter.removeWrapper(content);
      expect(result).toContain('before');
      expect(result).toContain('after');
      expect(result).not.toContain(adapter.getMarkerStart());
    });
  });
});
