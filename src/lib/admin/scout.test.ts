import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
  },
}));

vi.mock('node:crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-uuid-1234'),
  },
}));

import fs from 'node:fs';
import { getInsights, addInsight, deleteInsight } from './scout';

describe('scout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
  });

  describe('getInsights', () => {
    it('returns empty array when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = getInsights();

      expect(result).toEqual([]);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('addInsight', () => {
    it('creates an insight with correct fields', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const input = {
        sourceUrl: 'https://example.com',
        selectedText: 'Some selected text',
        companyName: 'Acme Corp',
        notes: 'Interesting lead',
      };

      const result = addInsight(input);

      expect(result).toEqual({
        id: 'test-uuid-1234',
        sourceUrl: 'https://example.com',
        selectedText: 'Some selected text',
        companyName: 'Acme Corp',
        notes: 'Interesting lead',
        timestamp: '2026-01-15T10:00:00.000Z',
      });
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalled();
    });

    it('prepends to existing list', () => {
      const existing = [
        {
          id: 'old-id',
          sourceUrl: 'https://old.com',
          selectedText: 'Old text',
          companyName: 'Old Corp',
          notes: 'Old notes',
          timestamp: '2025-12-01T00:00:00.000Z',
        },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existing));

      const input = {
        sourceUrl: 'https://new.com',
        selectedText: 'New text',
        companyName: 'New Corp',
        notes: 'New notes',
      };

      addInsight(input);

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(writtenData).toHaveLength(2);
      expect(writtenData[0].id).toBe('test-uuid-1234');
      expect(writtenData[1].id).toBe('old-id');
    });
  });

  describe('deleteInsight', () => {
    it('removes by id and returns true', () => {
      const existing = [
        { id: 'keep-me', sourceUrl: '', selectedText: '', companyName: '', notes: '', timestamp: '' },
        { id: 'delete-me', sourceUrl: '', selectedText: '', companyName: '', notes: '', timestamp: '' },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existing));

      const result = deleteInsight('delete-me');

      expect(result).toBe(true);
      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0].id).toBe('keep-me');
    });

    it('returns false for non-existent id', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([]));

      const result = deleteInsight('does-not-exist');

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
