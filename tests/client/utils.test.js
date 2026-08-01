import { describe, it, expect } from 'bun:test';
import { hashPassword, formatNumber, formatCountdown, formatTime, escapeHtml, parseNumberShorthand } from '../../src/client/js/utils.js';

describe('Client Utils', () => {
  describe('hashPassword', () => {
    it('should hash password using fallback SHA-256', async () => {
      // Known SHA-256 hash for 'password'
      const expected = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
      const hash = await hashPassword('password');
      expect(hash).toBe(expected);
    });

    it('should produce different hashes for different inputs', async () => {
      const h1 = await hashPassword('abc');
      const h2 = await hashPassword('abd');
      expect(h1).not.toBe(h2);
    });

    it('should hash Unicode passwords', async () => {
      expect(await hashPassword('pässwörd🚀')).toBe('715190877d316079f2f72308f10e334bc7c00296394a9c7ab9848a7725604676');
    });
  });

  describe('formatNumber', () => {
    it('should format small numbers as is', () => {
      expect(formatNumber(123)).toBe('123');
    });

    it('should preserve fractional small values', () => {
      expect(formatNumber(1.1)).toBe((1.1).toLocaleString());
    });
    
    it('should format thousands with K', () => {
      expect(formatNumber(1500)).toBe('1.50K');
    });

    it('should format millions with M', () => {
      expect(formatNumber(1500000)).toBe('1.50M');
    });

    it('should format billions with B', () => {
      expect(formatNumber(1500000000)).toBe('1.50B');
    });
  });

  describe('formatCountdown', () => {
    it('should format HH:MM:SS', () => {
      expect(formatCountdown(3661)).toBe('01:01:01');
    });

    it('should handle zero or negative', () => {
      expect(formatCountdown(0)).toBe('00:00:00');
      expect(formatCountdown(-5)).toBe('00:00:00');
    });
  });

  describe('formatTime', () => {
    it('should return - for empty timestamp', () => {
      expect(formatTime(null)).toBe('-');
    });

    it('should format timestamp', () => {
      const time = new Date('2023-01-01T12:00:00').getTime();
      const formatted = formatTime(time);
      // Locale might vary, but usually contains AM/PM or :
      expect(formatted).toContain(':');
    });
  });

  it('escapes text before HTML rendering', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });

  describe('parseNumberShorthand', () => {
    it('parses plain and abbreviated quantities', () => {
      expect(parseNumberShorthand('125')).toBe(125);
      expect(parseNumberShorthand('1.5m')).toBe(1_500_000);
      expect(parseNumberShorthand('.5K')).toBe(500);
      expect(parseNumberShorthand('1.5')).toBe(1);
    });

    it('rejects malformed and non-finite quantities', () => {
      expect(parseNumberShorthand('12abc')).toBe(0);
      expect(parseNumberShorthand('1.2.3m')).toBe(0);
      expect(parseNumberShorthand(Infinity)).toBe(0);
      expect(parseNumberShorthand('999999999999999999q')).toBe(0);
    });
  });
});
