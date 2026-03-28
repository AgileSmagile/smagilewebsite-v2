import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBoard5Card } from './businessmap';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('businessmap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, BUSINESSMAP_API_KEY: 'test-api-key' };
  });

  it('returns card_id on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ card_id: 42 }] }),
    });

    const result = await createBoard5Card('Test title', 'Test description');

    expect(result).toBe(42);
  });

  it('returns null when API key is missing', async () => {
    delete process.env.BUSINESSMAP_API_KEY;

    const result = await createBoard5Card('Title', 'Desc');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable Entity',
    });

    const result = await createBoard5Card('Title', 'Desc');

    expect(result).toBeNull();
  });

  it('returns null when response has no card_id', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const result = await createBoard5Card('Title', 'Desc');

    expect(result).toBeNull();
  });

  it('sends correct request body with board_id, workflow_id, column_id, lane_id', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ card_id: 99 }] }),
    });

    await createBoard5Card('My Title', 'My Description');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/cards'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          board_id: 5,
          workflow_id: 9,
          column_id: 74,
          lane_id: 10,
          title: 'My Title',
          description: 'My Description',
        }),
      }),
    );
  });
});
