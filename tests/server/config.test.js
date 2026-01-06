import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockFs = {
  existsSync: mock(() => false),
  readFile: mock(async () => JSON.stringify({
    gameSpeed: { resourceProduction: 2.0 },
    balancing: { resourceCostMultiplier: 0.5 },
    gameplay: { buildQueueSize: 5 }
  }))
};

mock.module('fs', () => ({
  existsSync: mockFs.existsSync
}));

mock.module('fs/promises', () => ({
  readFile: mockFs.readFile
}));

// Import module under test
import * as configModule from '../../src/server/config.js';

describe('Server Configuration', () => {
  beforeEach(() => {
    // Reset mocks
    mockFs.existsSync.mockClear();
    mockFs.readFile.mockClear();
    // Reset config module state (if possible? It uses a local let variable).
    // The `config` variable in config.js is module-scoped. 
    // We can't reset it directly from here unless we expose a reset function or reload the module.
    // However, `loadConfig` overwrites it. So calling `loadConfig` resets it.
  });

  it('should return default config if file does not exist', async () => {
    mockFs.existsSync.mockReturnValue(false);
    
    const config = await configModule.loadConfig();
    
    expect(config.gameSpeed.resourceProduction).toBe(1.0);
    expect(mockFs.existsSync).toHaveBeenCalled();
  });

  it('should load config from file if exists', async () => {
    mockFs.existsSync.mockReturnValue(true);
    
    const config = await configModule.loadConfig();
    
    expect(config.gameSpeed.resourceProduction).toBe(2.0);
    expect(mockFs.readFile).toHaveBeenCalled();
  });

  it('should provide accessor functions for config values', async () => {
    // Ensure config is loaded
    mockFs.existsSync.mockReturnValue(true);
    await configModule.loadConfig();
    
    expect(configModule.getResourceProductionMultiplier()).toBe(2.0);
    expect(configModule.getResourceCostMultiplier()).toBe(0.5);
    expect(configModule.getBuildQueueSize()).toBe(5);
    
    // Check defaults for missing values in mocked file
    expect(configModule.getResearchTimeMultiplier()).toBe(1.0); // Was not in mock file, should use fallback or undefined?
    // Wait, the logic is: `return getConfig().gameSpeed.researchTime || 1.0;`
    // If loaded config doesn't have it, `getConfig().gameSpeed.researchTime` is undefined.
    // So it returns 1.0. Correct.
  });

  it('should handle malformed config file', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFile.mockRejectedValue(new Error('Invalid JSON'));
    
    const config = await configModule.loadConfig();
    
    // Should fallback to default
    expect(config.gameSpeed.resourceProduction).toBe(1.0);
  });
});
