import { describe, it, expect } from 'vitest';
import { jsonOk, jsonError } from './api-response';

describe('api-response', () => {
  describe('jsonOk', () => {
    it('returns a JSON response with status 200', async () => {
      const res = jsonOk({ message: 'hello' });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json');

      const body = await res.json();
      expect(body).toEqual({ message: 'hello' });
    });

    it('accepts a custom status code', async () => {
      const res = jsonOk({ created: true }, 201);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toEqual({ created: true });
    });

    it('returns valid JSON for arrays', async () => {
      const res = jsonOk([1, 2, 3]);
      const body = await res.json();
      expect(body).toEqual([1, 2, 3]);
    });

    it('returns valid JSON for null', async () => {
      const res = jsonOk(null);
      const body = await res.json();
      expect(body).toBeNull();
    });
  });

  describe('jsonError', () => {
    it('returns a JSON error with status 400', async () => {
      const res = jsonError('Bad request');
      expect(res.status).toBe(400);
      expect(res.headers.get('Content-Type')).toBe('application/json');

      const body = await res.json();
      expect(body).toEqual({ error: 'Bad request' });
    });

    it('accepts a custom status code', async () => {
      const res = jsonError('Not found', 404);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toEqual({ error: 'Not found' });
    });

    it('returns valid JSON body', async () => {
      const res = jsonError('Server error', 500);
      const text = await res.clone().text();
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });
});
