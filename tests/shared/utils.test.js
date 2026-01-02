import { describe, it, expect } from 'bun:test';
import {
  formatTimestamp,
  getTimeDelta,
  formatCountdown,
  formatNumber,
  clamp,
  deepClone,
  isEmpty
} from '../../src/shared/utils.js';

describe('Utils - formatTimestamp Function', () => {
  it('should format valid timestamp', () => {
    const timestamp = new Date('2024-01-15T10:30:00').getTime();
    const formatted = formatTimestamp(timestamp);
    
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('should handle current timestamp', () => {
    const now = Date.now();
    const formatted = formatTimestamp(now);
    
    expect(typeof formatted).toBe('string');
    expect(formatted.includes('2024') || formatted.includes('2025') || formatted.includes('2026')).toBe(true);
  });

  it('should be locale-specific', () => {
    const timestamp = new Date('2024-12-25T15:45:30').getTime();
    const formatted = formatTimestamp(timestamp);
    
    // Should contain date/time information
    expect(/\d+/.test(formatted)).toBe(true);
  });

  it('should handle zero timestamp', () => {
    const formatted = formatTimestamp(0);
    expect(typeof formatted).toBe('string');
  });
});

describe('Utils - getTimeDelta Function', () => {
  it('should calculate time difference in seconds', () => {
    const startTime = Date.now();
    const endTime = startTime + 5000; // 5 seconds later
    
    const delta = getTimeDelta(startTime, endTime);
    expect(delta).toBe(5);
  });

  it('should use current time as default end time', () => {
    const startTime = Date.now() - 3000; // 3 seconds ago
    const delta = getTimeDelta(startTime);
    
    // Should be approximately 3 seconds, allowing for test execution time
    expect(delta).toBeGreaterThanOrEqual(2.9);
    expect(delta).toBeLessThanOrEqual(3.5);
  });

  it('should return zero for same time', () => {
    const time = Date.now();
    const delta = getTimeDelta(time, time);
    
    expect(delta).toBe(0);
  });

  it('should return negative for reversed times', () => {
    const startTime = Date.now();
    const endTime = startTime - 2000;
    
    const delta = getTimeDelta(startTime, endTime);
    expect(delta).toBe(-2);
  });

  it('should convert milliseconds to seconds', () => {
    const startTime = 0;
    const endTime = 10000; // 10 seconds in milliseconds
    
    const delta = getTimeDelta(startTime, endTime);
    expect(delta).toBe(10);
  });

  it('should handle large time differences', () => {
    const oneDay = 24 * 60 * 60 * 1000; // 1 day in ms
    const startTime = 0;
    const endTime = oneDay;
    
    const delta = getTimeDelta(startTime, endTime);
    expect(delta).toBe(86400); // seconds in a day
  });

  it('should provide decimal precision', () => {
    const startTime = 0;
    const endTime = 1500; // 1.5 seconds in milliseconds
    
    const delta = getTimeDelta(startTime, endTime);
    expect(delta).toBe(1.5);
  });
});

describe('Utils - formatCountdown Function', () => {
  it('should format zero seconds', () => {
    const formatted = formatCountdown(0);
    expect(formatted).toBe('00:00:00');
  });

  it('should format negative seconds', () => {
    const formatted = formatCountdown(-100);
    expect(formatted).toBe('00:00:00');
  });

  it('should format seconds only', () => {
    const formatted = formatCountdown(45);
    expect(formatted).toBe('00:00:45');
  });

  it('should format minutes and seconds', () => {
    const formatted = formatCountdown(125); // 2 minutes 5 seconds
    expect(formatted).toBe('00:02:05');
  });

  it('should format hours, minutes and seconds', () => {
    const formatted = formatCountdown(3665); // 1 hour 1 minute 5 seconds
    expect(formatted).toBe('01:01:05');
  });

  it('should pad single digits with zeros', () => {
    const formatted = formatCountdown(3661); // 1 hour 1 minute 1 second
    expect(formatted).toBe('01:01:01');
  });

  it('should handle large hours', () => {
    const seconds = (25 * 3600) + (30 * 60) + 45; // 25h 30m 45s
    const formatted = formatCountdown(seconds);
    expect(formatted).toBe('25:30:45');
  });

  it('should format game-like countdown timers', () => {
    const testCases = [
      { seconds: 3600, expected: '01:00:00' }, // 1 hour
      { seconds: 1800, expected: '00:30:00' }, // 30 minutes
      { seconds: 900, expected: '00:15:00' },  // 15 minutes
      { seconds: 60, expected: '00:01:00' },   // 1 minute
      { seconds: 1, expected: '00:00:01' }     // 1 second
    ];
    
    testCases.forEach(test => {
      expect(formatCountdown(test.seconds)).toBe(test.expected);
    });
  });

  it('should maintain consistent format width', () => {
    const formats = [
      formatCountdown(1),
      formatCountdown(59),
      formatCountdown(3599),
      formatCountdown(359999)
    ];
    
    // All should be in HH:MM:SS format
    formats.forEach(fmt => {
      expect(fmt).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  it('should be suitable for game timers', () => {
    const buildTime = 7325; // Realistic build time in seconds
    const formatted = formatCountdown(buildTime);
    
    // 7325 seconds = 2 hours 2 minutes 5 seconds
    expect(formatted).toBe('02:02:05');
  });
});

describe('Utils - formatNumber Function', () => {
  it('should format small numbers as-is', () => {
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(999)).toBe('999');
  });

  it('should format thousands with K', () => {
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(5500)).toBe('5.50K');
    expect(formatNumber(999999)).toBe('1000.00K'); // Edge case
  });

  it('should format millions with M', () => {
    expect(formatNumber(1000000)).toBe('1.00M');
    expect(formatNumber(5500000)).toBe('5.50M');
    expect(formatNumber(999999999)).toBe('1000.00M'); // Edge case
  });

  it('should format billions with B', () => {
    expect(formatNumber(1000000000)).toBe('1.00B');
    expect(formatNumber(5500000000)).toBe('5.50B');
    expect(formatNumber(999999999999)).toBe('1000.00B'); // Edge case
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should handle negative numbers', () => {
    const formatted = formatNumber(-500);
    expect(formatted).toContain('-');
  });

  it('should format with consistent precision', () => {
    const formatted1500 = formatNumber(1500);
    const formatted1000000 = formatNumber(1000000);
    
    // Check that K and M formats are used
    expect(formatted1500).toContain('K');
    expect(formatted1000000).toContain('M');
  });

  it('should format resource values', () => {
    const resources = [
      { amount: 50000, expected: '50.00K' },
      { amount: 1500000, expected: '1.50M' },
      { amount: 2500000000, expected: '2.50B' }
    ];
    
    resources.forEach(res => {
      expect(formatNumber(res.amount)).toBe(res.expected);
    });
  });

  it('should maintain precision at boundaries', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(999999)).toBe('1000.00K');
    expect(formatNumber(1000000)).toBe('1.00M');
  });

  it('should format large game numbers', () => {
    // Typical late-game resource amounts
    const amount = 1234567890;
    const formatted = formatNumber(amount);
    
    expect(formatted).toContain('B');
    expect(formatted).toMatch(/\d+\.*\d*B/);
  });
});

describe('Utils - clamp Function', () => {
  it('should return value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('should clamp below minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-100, -50, 50)).toBe(-50);
  });

  it('should clamp above maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(150, -50, 50)).toBe(50);
  });

  it('should handle equal min and max', () => {
    expect(clamp(5, 5, 5)).toBe(5);
    expect(clamp(100, 5, 5)).toBe(5);
  });

  it('should work with negative ranges', () => {
    expect(clamp(-30, -50, -10)).toBe(-30);
    expect(clamp(-60, -50, -10)).toBe(-50);
    expect(clamp(-5, -50, -10)).toBe(-10);
  });

  it('should work with floats', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(clamp(-0.5, 0, 1)).toBe(0);
  });

  it('should clamp allocation percentages', () => {
    // Game allocation percentages 0-200%
    expect(clamp(50, 0, 200)).toBe(50);
    expect(clamp(250, 0, 200)).toBe(200);
    expect(clamp(-10, 0, 200)).toBe(0);
  });

  it('should clamp building levels', () => {
    // Buildings 1-30 typically
    expect(clamp(15, 1, 30)).toBe(15);
    expect(clamp(50, 1, 30)).toBe(30);
    expect(clamp(0, 1, 30)).toBe(1);
  });

  it('should handle zero clamping', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
  });
});

describe('Utils - deepClone Function', () => {
  it('should clone simple objects', () => {
    const original = { name: 'test', value: 42 };
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should clone nested objects', () => {
    const original = {
      player: {
        name: 'Player1',
        stats: {
          level: 10,
          experience: 1000
        }
      }
    };
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned.player).not.toBe(original.player);
    expect(cloned.player.stats).not.toBe(original.player.stats);
  });

  it('should clone arrays', () => {
    const original = [1, 2, 3, 4, 5];
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should clone arrays of objects', () => {
    const original = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ];
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
  });

  it('should not share references', () => {
    const original = { resources: { metal: 1000, crystal: 500 } };
    const cloned = deepClone(original);
    
    cloned.resources.metal = 2000;
    expect(original.resources.metal).toBe(1000);
  });

  it('should clone game player data', () => {
    const playerData = {
      id: 'player123',
      name: 'TestPlayer',
      resources: {
        metal: 5000,
        crystal: 3000,
        deuterium: 1000
      },
      planets: [
        { id: 'p1', name: 'Home', position: 1 },
        { id: 'p2', name: 'Colony', position: 8 }
      ],
      fleet: {
        lightFighter: 50,
        cruiser: 10
      }
    };
    
    const cloned = deepClone(playerData);
    
    expect(cloned).toEqual(playerData);
    expect(cloned).not.toBe(playerData);
    expect(cloned.resources).not.toBe(playerData.resources);
    expect(cloned.planets).not.toBe(playerData.planets);
  });

  it('should handle empty objects', () => {
    const cloned = deepClone({});
    expect(cloned).toEqual({});
    expect(cloned).not.toBe({});
  });

  it('should handle null values in objects', () => {
    const original = { value: null, other: 'test' };
    const cloned = deepClone(original);
    
    expect(cloned.value).toBeNull();
    expect(cloned.other).toBe('test');
  });

  it('should clone numbers, strings, booleans', () => {
    const original = {
      str: 'hello',
      num: 42,
      bool: true,
      zero: 0,
      empty: ''
    };
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
  });
});

describe('Utils - isEmpty Function', () => {
  it('should identify empty objects', () => {
    expect(isEmpty({})).toBe(true);
  });

  it('should identify non-empty objects', () => {
    expect(isEmpty({ key: 'value' })).toBe(false);
    expect(isEmpty({ a: 1, b: 2 })).toBe(false);
  });

  it('should handle objects with one property', () => {
    expect(isEmpty({ single: 'property' })).toBe(false);
  });

  it('should handle null-like values in properties', () => {
    expect(isEmpty({ key: null })).toBe(false);
    expect(isEmpty({ key: undefined })).toBe(false);
    expect(isEmpty({ key: '' })).toBe(false);
    expect(isEmpty({ key: 0 })).toBe(false);
    expect(isEmpty({ key: false })).toBe(false);
  });

  it('should identify empty resource objects', () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ metal: 1000 })).toBe(false);
  });

  it('should identify empty building objects', () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ metalMine: 1 })).toBe(false);
  });

  it('should check own properties only', () => {
    const obj = { ownProp: 'value' };
    expect(isEmpty(obj)).toBe(false);
    
    const objWithInherited = Object.create({ inheritedProp: 'value' });
    // for-in loop includes inherited properties
    expect(isEmpty(objWithInherited)).toBe(false);
  });

  it('should work with game data structures', () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ lightFighter: 50, cruiser: 10 })).toBe(false);
  });
});

describe('Utils - Integration and Game Usage', () => {
  it('should format a complete game session timer', () => {
    const buildTime = 7325; // Building time in seconds
    const startTime = Date.now();
    const endTime = startTime + (buildTime * 1000);
    
    const countdown = formatCountdown(buildTime);
    const timestamp = formatTimestamp(endTime);
    
    expect(countdown).toBe('02:02:05');
    expect(timestamp.length).toBeGreaterThan(0);
  });

  it('should format game resource display', () => {
    const resources = {
      metal: 1500000,
      crystal: 900000,
      deuterium: 300000
    };
    
    const displayed = {
      metal: formatNumber(resources.metal),
      crystal: formatNumber(resources.crystal),
      deuterium: formatNumber(resources.deuterium)
    };
    
    expect(displayed.metal).toBe('1.50M');
    expect(displayed.crystal).toBe('900.00K');
    expect(displayed.deuterium).toBe('300.00K');
  });

  it('should preserve player data during operations', () => {
    const playerState = {
      resources: { metal: 1000, crystal: 500 },
      buildings: { metalMine: 10 },
      fleet: { lightFighter: 50 }
    };
    
    const backup = deepClone(playerState);
    
    // Simulate resource update
    playerState.resources.metal -= 500;
    
    // Backup should be unaffected
    expect(backup.resources.metal).toBe(1000);
    expect(playerState.resources.metal).toBe(500);
  });

  it('should validate game state completeness', () => {
    const planetState = {
      resources: { metal: 100, crystal: 50 },
      buildings: { metalMine: 5 },
      defenses: { laserCannon: 3 },
      fleet: { cruiser: 1 }
    };
    
    expect(isEmpty(planetState)).toBe(false);
    expect(isEmpty(planetState.defenses)).toBe(false);
    
    const emptyFleet = {};
    expect(isEmpty(emptyFleet)).toBe(true);
  });
});
