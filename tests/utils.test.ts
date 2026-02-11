import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  maskValue,
  detectShell,
  getGlobalDir,
  getLocalDir,
  ensureDir,
  sanitizeForShell,
  fileExists,
  readFile,
  writeFile,
  deleteFile,
  listFiles,
} from '../src/utils.js';

describe('utils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envize-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('maskValue', () => {
    it('should mask value showing first 4 chars', () => {
      expect(maskValue('supersecretkey')).toBe('supe****');
    });

    it('should mask short values completely', () => {
      expect(maskValue('abc')).toBe('***');
    });

    it('should use custom reveal chars', () => {
      expect(maskValue('supersecret', 2)).toBe('su****');
    });

    it('should handle empty string', () => {
      expect(maskValue('')).toBe('');
    });
  });

  describe('detectShell', () => {
    const originalShell = process.env.SHELL;

    afterEach(() => {
      if (originalShell !== undefined) {
        process.env.SHELL = originalShell;
      } else {
        delete process.env.SHELL;
      }
    });

    it('should detect bash', () => {
      process.env.SHELL = '/bin/bash';
      expect(detectShell()).toBe('bash');
    });

    it('should detect zsh', () => {
      process.env.SHELL = '/bin/zsh';
      expect(detectShell()).toBe('zsh');
    });

    it('should detect fish', () => {
      process.env.SHELL = '/usr/bin/fish';
      expect(detectShell()).toBe('fish');
    });

    it('should return unknown for unrecognized shell', () => {
      process.env.SHELL = '/bin/unknown';
      expect(detectShell()).toBe('unknown');
    });

    it('should return unknown when SHELL is not set', () => {
      delete process.env.SHELL;
      expect(detectShell()).toBe('unknown');
    });
  });

  describe('getGlobalDir', () => {
    it('should return path in home directory', () => {
      const globalDir = getGlobalDir();
      expect(globalDir).toContain(os.homedir());
      expect(globalDir).toContain('.envize');
    });
  });

  describe('getLocalDir', () => {
    it('should return path in current directory', () => {
      const localDir = getLocalDir();
      expect(localDir).toContain(process.cwd());
      expect(localDir).toContain('.envize');
    });
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', () => {
      const newDir = path.join(tempDir, 'new', 'nested', 'dir');
      ensureDir(newDir);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      expect(() => ensureDir(tempDir)).not.toThrow();
    });
  });

  describe('sanitizeForShell', () => {
    it('should escape single quotes', () => {
      expect(sanitizeForShell("it's")).toBe("it'\\''s");
    });

    it('should leave safe values unchanged', () => {
      expect(sanitizeForShell('safe_value')).toBe('safe_value');
    });

    it('should escape multiple single quotes', () => {
      expect(sanitizeForShell("a'b'c")).toBe("a'\\''b'\\''c");
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'content');
      expect(fileExists(filePath)).toBe(true);
    });

    it('should return false for non-existing file', () => {
      expect(fileExists(path.join(tempDir, 'nonexistent.txt'))).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file contents', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'test content');
      expect(readFile(filePath)).toBe('test content');
    });
  });

  describe('writeFile', () => {
    it('should write file contents', () => {
      const filePath = path.join(tempDir, 'output.txt');
      writeFile(filePath, 'written content');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('written content');
    });

    it('should create parent directories', () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'output.txt');
      writeFile(filePath, 'content');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', () => {
      const filePath = path.join(tempDir, 'todelete.txt');
      fs.writeFileSync(filePath, 'content');
      deleteFile(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw for non-existing file', () => {
      expect(() => deleteFile(path.join(tempDir, 'nonexistent.txt'))).not.toThrow();
    });
  });

  describe('listFiles', () => {
    it('should list files with matching extension', () => {
      fs.writeFileSync(path.join(tempDir, 'file1.env'), '');
      fs.writeFileSync(path.join(tempDir, 'file2.env'), '');
      fs.writeFileSync(path.join(tempDir, 'file3.txt'), '');

      const files = listFiles(tempDir, '.env');

      expect(files).toHaveLength(2);
      expect(files.every(f => f.endsWith('.env'))).toBe(true);
    });

    it('should return empty array for non-existing directory', () => {
      const files = listFiles(path.join(tempDir, 'nonexistent'), '.env');
      expect(files).toEqual([]);
    });
  });
});
