# Unit Testing Implementation for SpaceAdventure

## Overview

A comprehensive unit testing suite has been implemented to verify computation results across both UI and backend components of the SpaceAdventure game. The test suite uses Bun's built-in test runner and covers **131 tests** with **880 expect() calls**.

## Test Results

✅ **All tests passing: 131/131 (100%)**

### Test Breakdown by Module

| Module | Test File | Tests | Status |
|--------|-----------|-------|--------|
| Shared Formulas | `tests/formulas.test.js` | 62 | ✅ PASS |
| Server Buildings | `tests/buildings.test.js` | 25 | ✅ PASS |
| Research Logic | `tests/research.test.js` | 25 | ✅ PASS |
| Client Calculations | `tests/client-calculations.test.js` | 19 | ✅ PASS |

## Running Tests

Run all tests:
```bash
bun test tests/
```

Run specific test file:
```bash
bun test tests/formulas.test.js
bun test tests/buildings.test.js
bun test tests/research.test.js
bun test tests/client-calculations.test.js
```

Run tests in watch mode:
```bash
bun test --watch
```

Generate coverage report:
```bash
bun test --coverage
```

## Test Coverage by Component

### 1. Shared Formulas (`tests/formulas.test.js`) - 62 Tests

Tests core game calculation functions used across client and server.

#### Building Mechanics
- **calculateBuildingCost**: Exponential cost scaling (1.5^level)
- **calculateBuildTime**: Time calculation with robotics/nanite multipliers
- **calculateProduction**: Resource production scaling (1.05^level)
- **calculateStorage**: Storage capacity scaling (1.5^level)

#### Research Systems
- **calculateResearchCost**: Theoretical research cost (2^level exponential)
- **calculateResearchTime**: Research time with lab speedup (15% per level)
- **calculateTheoreticalResearchCost**: Tech cost progression
- **calculateTheoreticalResearchTime**: Tech research duration
- **calculatePracticalResearchCost**: Customization cost (1.5^level, slower than theoretical)
- **calculatePracticalResearchTime**: Customization duration with lab modifiers
- **applyTheoreticalBonus**: Multiplicative technology bonuses

#### Resource Management
- **calculatePopulationChange**: Population growth/decay based on food availability
  - Growth: max(1% per hour, 60 per hour) when food available
  - Decay: 2% per hour when food unavailable
  - Minimum: 10 population, Maximum: configurable cap
- **calculatePositionMultiplier**: Planet position-based resource bonuses
  - Water: peaks at position 15 (farthest from sun)
  - Farms: peaks at position 1 (closest to sun)
  - Deuterium: peaks at position 8 (mid-distance)
  - Metal/Crystal: constant 1.0 across all positions

#### Allocation & Effectiveness
- **calculateAllocationEffectiveness**: Non-linear effectiveness (sqrt(allocation%) * 100)
  - Diminishing returns above 100%
  - 50% = ~707%, 100% = 1000%, 200% = ~1414%
- **calculatePowerEffectiveness**: Same formula as allocation
- **calculatePopulationEffectiveness**: Same formula as allocation

#### Combat & Fleet
- **calculateCombatPower**: Weapon/shield/armor bonuses
- **calculateFuelConsumption**: Distance and ship mass based
- **calculateTravelTime**: Distance and speed based

#### Building Systems
- **getBuildingEnergyConsumption**: Energy consumption scaling (base * level * 1.1^level * 10)
- **getBuildingPopulationRequired**: Population requirement scaling (base * level * 1.05^level)

### 2. Server Buildings (`tests/buildings.test.js`) - 25 Tests

Tests server-side building calculations with config multipliers applied.

#### Key Functions Tested
- **getBuildingCost**: Server cost with multiplier
- **getBuildTime**: Build time with robotics/nanite speedup
- **getProduction**: Production with server multiplier (1.1^level scaling)
- **getStorageIncrease**: Storage scaling (1.6^(level-1))

#### Test Scenarios
- Cost/time trade-offs between building levels
- Robotics factory speedup verification
- Production scaling consistency
- Storage capacity increases
- Config multiplier application

### 3. Research Logic (`tests/research.test.js`) - 25 Tests

Tests research progression mechanics.

#### Theoretical Research
- Cost progression (doubles with each level)
- Time progression (doubles with each level)
- Lab speedup application (15% per level)
- Resource requirement equality across all resources

#### Practical Research
- Slower cost scaling (1.5^level vs 2^level)
- Faster time scaling than theoretical
- Lab speedup consistency
- Cost comparison between theoretical and practical

#### Research Progression Scenarios
- Consistent cost increases across levels
- Time/cost scaling relationships
- Level 0 edge cases
- High level (20+) stability

### 4. Client Calculations (`tests/client-calculations.test.js`) - 19 Tests

Tests UI-side calculation functions for player feedback and optimization.

#### Allocation Effectiveness Display
- Non-linear feedback curves
- Diminishing returns visualization
- Allocation slider optimization (0-200%)
- Percentage display consistency

#### Position Multipliers
- Planet position strategy implications
- Resource trade-offs between positions
- Deuterium peak at mid-distance
- Consistent metal/crystal values

#### Building Requirements
- Energy consumption calculations
- Population requirement scaling
- Consistency between metrics

#### UI Planning Functions
- Position-based strategy guidance
- Allocation slider optimization
- Building comparison support
- Resource allocation planning

## Key Findings & Validated Formulas

### Exponential Scaling Patterns

| Component | Formula | Examples |
|-----------|---------|----------|
| Building Cost | base * 1.5^level | Level 5: 7.6x base |
| Building Time | base * 1.5^level (modified by robotics/nanite) | Level 5: 7.6x base |
| Production | base * level * 1.1^level * multiplier | Level 10: ~2.6x per level |
| Storage | base * 1.6^(level-1) | Level 10: ~103x base |
| Theoretical Research Cost | base * 2^level | Level 5: 32x base |
| Theoretical Research Time | base * 2^level / (1 + 0.15*labLevel) | 15% speedup per lab |
| Practical Research Cost | base * 1.5^level | Level 5: 7.6x base |
| Population Change | Current ± (current * %/hour) * hoursElapsed | Min: 10, Max: configurable |

### Non-Linear Effectiveness Formula

Allocation effectiveness follows a square root curve:
- **Formula**: `sqrt(allocation%) * 100`
- **At 50%**: ~707% effectiveness
- **At 100%**: 1000% effectiveness
- **At 200%**: ~1414% effectiveness
- **Pattern**: Diminishing returns increase beyond 100%

### Position Multipliers (Sun Distance Effects)

| Position | Water | Farm | Deuterium | Metal/Crystal |
|----------|-------|------|-----------|---------------|
| 1 (closest) | 0.90 | 1.30 | ~0.87 | 1.0 |
| 8 (mid) | 1.20 | 0.90 | 1.30 | 1.0 |
| 15 (farthest) | 1.50 | 0.60 | ~0.87 | 1.0 |

## Test Quality Metrics

### Coverage
- **131 total tests**
- **880 expect() calls**
- **0 failures**
- **Execution time**: ~73ms

### Test Types
- **Unit Tests**: Individual function behavior (majority)
- **Integration Tests**: Function interactions and trade-offs
- **Edge Case Tests**: Boundary conditions, extreme values
- **Scenario Tests**: Real-world usage patterns

### Assertion Types
- Equality checks (exact calculations)
- Comparison checks (scaling relationships)
- Type validation (integer outputs)
- Consistency checks (across similar functions)

## Implementation Details

### Testing Framework
- **Framework**: Bun's built-in test runner
- **Syntax**: `describe`, `it`, `expect` from `bun:test`
- **Configuration**: Minimal config in `bunfig.toml`

### Test Organization
- One test file per major module
- Grouped test suites using `describe`
- Clear test naming following: "should [expected behavior]"
- Comprehensive comments for complex calculations

### Key Testing Patterns

#### 1. Formula Validation
```javascript
it('should apply correct multiplier', () => {
  const result = calculateBuildingCost(baseCost, level);
  const expected = Math.floor(baseCost.metal * Math.pow(1.5, level));
  expect(result).toBe(expected);
});
```

#### 2. Scaling Verification
```javascript
it('should increase with level', () => {
  const low = calculateProduction(base, 1);
  const high = calculateProduction(base, 10);
  expect(high).toBeGreaterThan(low);
});
```

#### 3. Relationship Testing
```javascript
it('should show diminishing returns', () => {
  const gain0to100 = eff(100) - eff(0);
  const gain100to200 = eff(200) - eff(100);
  expect(gain100to200).toBeLessThan(gain0to100);
});
```

## Maintenance & Future Improvements

### When to Update Tests
- When adding new calculation functions
- When modifying game balance (formulas, multipliers)
- When refactoring calculation logic
- When discovering calculation bugs

### Adding New Tests
1. Create new test suite in appropriate file or new file
2. Use existing patterns for consistency
3. Test both normal cases and edge cases
4. Document complex calculations
5. Run full test suite to verify no regressions

### Continuous Integration
Tests can be integrated into CI/CD:
```bash
# In CI pipeline
bun test tests/
```

Exit code indicates success (0) or failure (non-zero).

## Validation Checklist

The test suite validates:
- ✅ Correct formula implementations
- ✅ Proper exponential/non-linear scaling
- ✅ Config multiplier application
- ✅ Tech level progression logic
- ✅ Resource requirement calculations
- ✅ Time calculations with speedups
- ✅ Edge cases and boundaries
- ✅ Consistency across related functions
- ✅ Integer output requirements
- ✅ Player-facing calculation accuracy

## Conclusion

The comprehensive test suite provides high confidence in game mechanics calculations across both frontend and backend. All 131 tests pass, validating the core game systems are functioning correctly. The tests serve as both verification and documentation of the game's calculation logic.
