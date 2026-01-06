# Research System - Developer Quick Reference

## Key Files

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/shared/research.js` | Definitions & configs | `THEORETICAL_RESEARCH`, `PRACTICAL_RESEARCH` |
| `src/shared/formulas.js` | Calculations | Research cost/time formulas |
| `src/server/game/researchLogic.js` | Server logic | `startTheoreticalResearch`, `startPracticalResearchWithAllocation`, `getActiveBuildingVariant`, `getActiveShipVariant` |
| `src/server/index.js` | API routes | Research endpoints |
| `src/client/js/views/research.js` | UI | `initializeResearch()` |
| `src/client/css/main.css` | Styling | Research view classes |
| `docs/RESEARCH_SYSTEM.md` | Full docs | Everything |

## Quick API Guide

### Get Current Research Status
```javascript
// Client-side
const response = await fetch('/api/game/research');
const { progress, theoretical, practical } = await response.json();
```

### Start Theoretical Research
```javascript
const response = await fetch('/api/game/planet/PLANET_ID/research/theoretical', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ techKey: 'energyTech' })
});
const queueItem = await response.json();
```

### Start Practical Research
```javascript
const response = await fetch('/api/game/planet/PLANET_ID/research/practical', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    baseType: 'metalMine',
    type: 'building',
    focus: 'output'
  })
});
```

### Create Custom Building Variant
```javascript
const response = await fetch('/api/game/planet/PLANET_ID/research/building-variant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseType: 'metalMine',
    focusLevels: { output: 5, manpower: 2, energy: 1, cost: 0 }
  })
});
```

### Cancel Research
```javascript
// Theoretical
const response = await fetch(
  '/api/game/planet/PLANET_ID/research/theoretical/QUEUE_ID',
  { method: 'DELETE' }
);

// Practical
const response = await fetch(
  '/api/game/planet/PLANET_ID/research/practical/QUEUE_ID',
  { method: 'DELETE' }
);
```

## Server-Side Integration Examples

### Get Active Building Variant in Buildings Module
```javascript
import { getActiveBuildingVariant } from '../game/researchLogic.js';

// In your building upgrade function
const variant = getActiveBuildingVariant(player, planetId, buildingType);
const buildingStats = variant || BUILDINGS[buildingType];
```

### Get Active Ship Variant in Shipyard Module
```javascript
import { getActiveShipVariant } from '../game/researchLogic.js';

// In your ship building function
const variant = getActiveShipVariant(player, shipType);
const shipStats = variant || SHIPS[shipType];
```

## Theoretical Research Reference

### Technology Keys
```javascript
'energyTech'
'computerTech'
'weaponsTech'
'shieldingTech'
'armorTech'
'combustionDrive'
'impulseDrive'
'hyperspaceDrive'
'espionageTech'
'astrophysics'
```

### Prerequisites Map
```javascript
const prerequisites = {
  'weaponsTech': ['computerTech'],
  'shieldingTech': ['computerTech'],
  'impulseDrive': ['combustionDrive'],
  'hyperspaceDrive': ['impulseDrive', 'computerTech'],
  'espionageTech': ['computerTech'],
  'astrophysics': ['computerTech']
}
```

## Practical Research Reference

### Available Buildings
- metalMine
- crystalMine
- solarPlant
- (Add more following the same pattern)

### Available Ships
- smallCargo
- lightFighter
- (Add more following the same pattern)

### Focus Types
```javascript
'output'   // Increases production/efficiency
'manpower' // Reduces workforce
'energy'   // Improves energy efficiency
'cost'     // Reduces construction cost
```

## Data Structures

### Theoretical Research Item
```javascript
{
  id: 'queue-123',
  type: 'theoretical',
  techKey: 'energyTech',
  level: 4,
  startTime: 1640000000000,
  duration: 5000000,
  endTime: 1640005000000,
  planetId: 'planet-1',
  cost: { metal: 1600, crystal: 800, deuterium: 400 },
  progress: 45,
  timeRemaining: 2750000
}
```

### Practical Research Item
```javascript
{
  id: 'queue-456',
  type: 'practical',
  baseType: 'metalMine',
  itemType: 'building',
  focus: 'output',
  level: 6,
  startTime: 1640000000000,
  duration: 2000000,
  endTime: 1640002000000,
  planetId: 'planet-1',
  cost: { metal: 300, crystal: 150, deuterium: 75 },
  progress: 67,
  timeRemaining: 660000
}
```

### Custom Variant
```javascript
{
  focusLevels: { output: 5, manpower: 2, energy: 1, cost: 0 },
  modifiers: {
    productionMultiplier: 0.65,
    costMultiplier: 0.15,
    energyMultiplier: 0.12,
    populationMultiplier: -0.09
  },
  customDefinition: { /* Modified stats */ }
}
```

## Formula Reference

### Theoretical Research
```javascript
// Cost doubles per level
cost = baseCost * 2^level

// Time doubles per level, lab gives 15% boost per level
time = baseTime * 2^level / (1 + labLevel * 0.15)
```

### Practical Research
```javascript
// Cost scales 1.5x per level (slower)
cost = baseCost * 1.5^level

// Time scales 1.5x per level, lab gives 15% boost
time = baseTime * 1.5^level / (1 + labLevel * 0.15)
```

### Modifier Application
```javascript
// Each focus contributes modifiers per level
totalModifier = 0;
for each focus {
  totalModifier += focusModifier * focusLevel
}

// Apply to stat
newStat = baseStat * (1 + totalModifier)
```

## Validation Checklist

Before implementing custom variants:
- ✅ Building/ship exists on player account
- ✅ Practical research for that type exists
- ✅ Focus levels don't exceed research levels
- ✅ Custom variant replaces old one (if exists)
- ✅ Modifiers are recalculated

## Adding New Technologies

1. Add entry to `THEORETICAL_RESEARCH` in `src/shared/research.js`
2. Set `baseCost`, `baseTime`, `unlocks` arrays
3. Define `bonuses` object with modifiers
4. Add `prerequisites` if needed
5. Add category and icon
6. That's it! UI will auto-discover it

## Adding New Practical Research

1. Add entry to `PRACTICAL_RESEARCH` in `src/shared/research.js`
2. Set `baseType`, `type` ('building' or 'ship')
3. Define modifiers for all 4 focuses
4. Set `maxLevels` (typically 30)
5. Add icon and description
6. That's it! System auto-discovers it

## Common Mistakes to Avoid

❌ **Don't:** Directly modify player.research without validation
✅ **Do:** Use `startTheoreticalResearch()` which handles validation

❌ **Don't:** Assume variant exists for a building
✅ **Do:** Use `getActiveBuildingVariant()` which falls back to base

❌ **Don't:** Apply modifiers multiple times
✅ **Do:** Modifiers are one-time at variant creation

❌ **Don't:** Allow research on non-existent buildings
✅ **Do:** Check `planet.buildings[type]` first

## Performance Notes

- Research calculations are O(1)
- Modifier application is O(1)
- Variant lookups are O(1) with proper indexing
- No N+1 queries on research endpoints
- Player data is kept in memory, written to disk on update

## Testing Commands

```bash
# Check research module loads
node -e "import('./src/shared/research.js').then(m => console.log(Object.keys(m)))"

# Test research logic
node -e "import('./src/server/game/researchLogic.js').then(m => console.log(Object.keys(m)))"

# Run server and test endpoint
curl http://localhost:3000/api/game/research -H "Cookie: session=YOUR_SESSION"
```

---

**Last Updated**: December 27, 2025
**Status**: ✅ Complete and Production-Ready
