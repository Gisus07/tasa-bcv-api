import { describe, it, expect } from 'vitest';
import {
  generatePlainKey,
  hashKey,
  visiblePrefix,
  KEY_PREFIX,
} from './apiKeys.service.js';

describe('apiKeys.service crypto primitives', () => {
  describe('generatePlainKey', () => {
    it('produces keys with the canonical "tbk_" prefix', () => {
      const k = generatePlainKey();
      expect(k.startsWith(KEY_PREFIX)).toBe(true);
    });

    it('produces 48-hex-char random bodies (24 random bytes)', () => {
      const k = generatePlainKey();
      const body = k.slice(KEY_PREFIX.length);
      expect(body).toMatch(/^[0-9a-f]{48}$/);
    });

    it('emits a different key on each call (entropy sanity)', () => {
      const keys = new Set(Array.from({ length: 50 }, () => generatePlainKey()));
      expect(keys.size).toBe(50);
    });
  });

  describe('hashKey', () => {
    it('returns a 64-char hex SHA-256 digest', () => {
      const h = hashKey('tbk_test');
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
      const a = hashKey('tbk_same');
      const b = hashKey('tbk_same');
      expect(a).toBe(b);
    });

    it('produces a different hash for any tiny change', () => {
      expect(hashKey('tbk_abc')).not.toBe(hashKey('tbk_abd'));
    });
  });

  describe('visiblePrefix', () => {
    it('keeps the first 12 characters', () => {
      expect(visiblePrefix('tbk_a1b2c3d4e5f6789012345678abcdef')).toBe('tbk_a1b2c3d4');
    });

    it('handles keys exactly at the threshold', () => {
      expect(visiblePrefix('tbk_a1b2c3d4').length).toBe(12);
    });
  });
});
