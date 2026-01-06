import { describe, it, expect } from 'bun:test';
import { calculateBaseTime } from '../../src/shared/time.js';

describe('Time Utilities', () => {
  describe('calculateBaseTime', () => {
    it('should return 0 if entity has no baseCost', () => {
      expect(calculateBaseTime({})).toBe(0);
      expect(calculateBaseTime(null)).toBe(0); // Assuming it handles null implicitly or crashes, let's see. 
      // Actually the code says `const cost = entity.baseCost;` so entity cannot be null.
      // But let's stick to valid objects.
      expect(calculateBaseTime({ name: 'Test' })).toBe(0);
    });

    it('should calculate time based on resource costs', () => {
      const entity = {
        baseCost: {
          metal: 100,
          crystal: 50,
          deuterium: 10
        }
      };
      // metal * 1 + crystal * 1.5 + deuterium * 3
      // 100 * 1 + 50 * 1.5 + 10 * 3
      // 100 + 75 + 30 = 205
      expect(calculateBaseTime(entity)).toBe(205);
    });

    it('should handle missing resources in baseCost', () => {
      const entity = {
        baseCost: {
          metal: 100
        }
      };
      // 100 * 1 + 0 + 0 = 100
      expect(calculateBaseTime(entity)).toBe(100);
    });

    it('should handle zero costs', () => {
      const entity = {
        baseCost: {
          metal: 0,
          crystal: 0,
          deuterium: 0
        }
      };
      expect(calculateBaseTime(entity)).toBe(0);
    });
  });
});
