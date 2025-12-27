# Research System Documentation

## Overview

The research system in Space Adventure has two distinct types of research:

1. **Theoretical Research** - Technology unlocks that grant permanent bonuses to game mechanics
2. **Practical Research** - Customization system that allows players to specialize buildings and ships with different focuses

## Theoretical Research

### Definition
Theoretical research represents scientific breakthroughs that unlock new technologies and capabilities. Each technology has multiple levels that can be researched sequentially.

### Key Characteristics
- **Progression**: Each level unlocks the next level (level 1 → level 2 → level 3, etc.)
- **Prerequisites**: Some technologies require others to be researched first
- **Bonuses**: Each level provides incremental bonuses to specific game mechanics
- **Cost Scaling**: Costs double with each level (exponential growth)
- **Time Scaling**: Research time doubles with each level

### Available Technologies

#### Energy Category
- **Energy Technology** (⚡)
  - Improves energy production and efficiency
  - Bonus: +10% energy production, +5% energy efficiency per level

#### Computing Category
- **Computer Technology** (💻)
  - Accelerates research and improves fleet efficiency
  - Prerequisite: None
  - Bonus: +10% research speed, +5% computer science per level

#### Military Category
- **Weapons Technology** (⚔️)
  - Increases attack power of all units
  - Prerequisite: Computer Technology
  - Bonus: +20% attack power per level

- **Shielding Technology** (🛡️)
  - Improves shield strength and defense
  - Prerequisite: Computer Technology
  - Bonus: +20% shield strength per level

- **Armor Technology** (🔒)
  - Strengthens hull armor of ships
  - Bonus: +15% hull strength per level

#### Propulsion Category
- **Combustion Drive** (🚀)
  - Enables basic spaceship travel
  - Unlocks: Small Cargo, Large Cargo
  - Bonus: +20% ship speed per level

- **Impulse Drive** (🌠)
  - Faster interplanetary travel
  - Prerequisite: Combustion Drive
  - Unlocks: Light Fighter, Heavy Fighter
  - Bonus: +30% ship speed per level

- **Hyperspace Drive** (🌌)
  - Enables intergalactic travel
  - Prerequisite: Impulse Drive + Computer Technology
  - Unlocks: Cruiser, Battleship
  - Bonus: +50% ship speed per level

#### Other Categories
- **Espionage Technology** (🕵️)
  - Enables espionage missions
  - Prerequisite: Computer Technology
  - Unlocks: Espionage Probe
  - Bonus: +10% espionage ability per level

- **Astrophysics** (🔭)
  - Unlocks additional galaxy slots and colony expansion
  - Prerequisite: Computer Technology
  - Unlocks: Colony Ship
  - Bonus: +1 galaxy slot per level, +20% colonist capacity per level

### Research Mechanics

#### Cost Calculation
```javascript
cost = baseCost * 2^level
```

#### Time Calculation
```javascript
time = baseTime * 2^level / (1 + labLevel * 0.15)
```

Research labs increase speed by 15% per level.

### UI/UX
- Theoretical research is displayed in the Research System tab organized by category
- Shows current level, cost, time estimate, and prerequisites
- Players can queue multiple research items to run sequentially
- Progress bar shows completion percentage and time remaining

---

## Practical Research (Level-Based Customization System)

### Definition
Practical research allows players to customize buildings and ships through an open-ended progression system. Players invest research levels into different focus areas, and each research completion distributes a level across the four focus areas in a rotating pattern for balanced growth.

### Four Focus Types

#### 1. Output (📈)
- **Effect**: Increases production/efficiency of the building or ship
- **Side Effects**: Increases cost and energy consumption
- **Use Case**: When you want maximum resource production regardless of cost

#### 2. Automation (🤖) [formerly Manpower]
- **Effect**: Reduces workforce/automation requirements
- **Side Effects**: Increases cost (machinery) and energy consumption
- **Use Case**: When population is limited but resources are abundant

#### 3. Energy (⚡)
- **Effect**: Improves energy efficiency and reduces consumption
- **Side Effects**: Increases cost for efficiency tech, slightly increases workforce needs
- **Use Case**: When energy is your bottleneck

#### 4. Cost (💰)
- **Effect**: Reduces construction/build costs
- **Side Effects**: Decreases efficiency and increases workforce needs
- **Use Case**: When you want to build quickly with limited resources

### Research Mechanics

#### Level Progression
- Players can research the same building/ship multiple times
- Each research completes one "level" of advancement
- Total focus level = sum of all focus levels for that building/ship
- Each successive level costs more and takes longer

#### Cost Calculation
```javascript
costMultiplier = 1 + (totalFocusLevel * 0.5)  // Cost increases exponentially
cost = baseCost * costMultiplier
```

When total focus level is 0: cost = baseCost × 1.0 (100%)
When total focus level is 1: cost = baseCost × 1.5 (150%)
When total focus level is 2: cost = baseCost × 2.0 (200%)

#### Time Calculation
```javascript
levelMultiplier = 1 + (totalFocusLevel * 0.2)  // 20% longer per research level
researchLabBonus = 1 + (researchLabLevel * 0.1)  // 10% faster per lab level
time = Math.floor((baseTime * levelMultiplier) / researchLabBonus)
Minimum: 60 seconds
```

#### Focus Distribution
When a research completes, the focus level is distributed in a rotating pattern:
- Level 1 → Output
- Level 2 → Automation
- Level 3 → Energy
- Level 4 → Cost
- Level 5 → Output (cycle repeats)

This ensures balanced progression across all focus areas.

### Available Practical Research

#### Buildings
- Metal Mine (⚙️) - baseType: metalMine
- Crystal Mine (💎) - baseType: crystalMine  
- Solar Plant (☀️) - baseType: solarPlant
- (More buildings can be added following the same pattern)

#### Ships
- Small Cargo (📦) - baseType: smallCargo
- Light Fighter (🛩️) - baseType: lightFighter
- (More ships can be added following the same pattern)

### Focus Modifiers (per focus level)

#### Building Modifiers

**Output Focus:**
- Production: +15% per level
- Cost: +5% per level
- Energy: +8% per level
- Population: -3% per level

**Automation Focus:**
- Population: -15% per level (reduces workforce needs)
- Cost: +12% per level (machinery investment)
- Energy: +15% per level (automation uses power)
- Production: -5% per level (automation is less efficient)

**Energy Focus:**
- Energy consumption: -15% per level (improved efficiency)
- Cost: +8% per level (efficiency tech)
- Production: +2% per level (better power = slight improvement)
- Population: +5% per level (tech needs expertise)

**Cost Focus:**
- Cost: -12% per level (economical design)
- Production: -8% per level (simpler design is less efficient)
- Energy: +5% per level (older tech less efficient)
- Population: +3% per level (simpler needs more workers)

#### Ship Modifiers

**Output Focus:**
- Cargo: +15% per level (for cargo ships)
- Attack: +15% per level (for military ships)
- Hull: +10% per level
- Cost: +8% per level
- Speed: -8% per level (heavier payload)

**Automation Focus:**
- Crew requirement: -10% per level
- Cost: +10% per level
- Fuel: +12% per level
- Cargo/Attack: -5% per level

**Energy Focus:**
- Fuel efficiency: -12% per level
- Cost: +10% per level
- Speed: +8% per level
- Cargo/Attack: +3% per level

**Cost Focus:**
- Cost: -12% per level
- Cargo/Attack: -8% per level
- Fuel: +5% per level
- Speed: +4% per level

**Cost Focus:**
- Cost: -12%
- Production: -8%
- Energy: +5%
- Population: +3%

#### Ship Focus Modifiers (per level increase)

**Output Focus:**
- Cargo: +15% (for cargo ships)
- Attack: +15% (for military ships)
- Hull: +10%
- Cost: +8%
- Speed: -8%

**Manpower Focus:**
- Crew requirement: -10%
- Cost: +10%
- Fuel: +12%
- Cargo/Attack: -5%

**Energy Focus:**
- Fuel efficiency: -12%
- Cost: +10%
- Speed: +8%
- Cargo/Attack: +3%

**Cost Focus:**
- Cost: -12%
- Cargo/Attack: -8%
- Fuel: +5%
- Speed: +4%

### Available Practical Research

#### Buildings
- Metal Mine (⚙️)
- Crystal Mine (💎)
- Solar Plant (☀️)
- (More buildings can be added following the same pattern)

#### Ships
- Small Cargo (📦)
- Light Fighter (🛩️)
- (More ships can be added following the same pattern)

### Custom Variants

Once a player researches practical customizations, they can create custom variants by selecting focus levels.

#### Structure
```javascript
{
  baseType: 'metalMine',
  focusLevels: {
    output: 5,
    manpower: 2,
    energy: 1,
    cost: 0
  },
  modifiers: {
    productionMultiplier: 0.65,  // Calculated from all focuses
    costMultiplier: 0.15,
    energyMultiplier: 0.12,
    populationMultiplier: -0.09
  },
  customDefinition: { /* Modified building/ship stats */ }
}
```

#### Selection
- Players can have one active variant per building type per planet
- Ship variants are global (shared across all planets)
- Switching variants requires just one API call
- Base definition is used if no variant is selected

### Customization Mechanics

#### Cost Calculation
```javascript
cost = baseCost * 1.5^level  // Slower growth than theoretical
```

#### Time Calculation
```javascript
time = baseTime * 1.5^level / (1 + labLevel * 0.15)
```

#### Modifier Application
Modifiers are applied as multipliers to base stats:
```javascript
newValue = baseValue * (1 + totalModifier)
```

Multiple focuses stack their effects:
```javascript
totalModifier = (outputMod * outputLevel) + (manpowerMod * manpowerLevel) + ...
```

---

## Data Structures

### Player Research State

```javascript
{
  // Theoretical research levels
  research: {
    energyTech: 3,
    computerTech: 2,
    weaponsTech: 0,
    // ... other technologies
  },

  // Theoretical research queue
  researchQueue: [
    {
      id: 'queue-123',
      type: 'theoretical',
      techKey: 'energyTech',
      level: 4,
      startTime: 1640000000000,
      duration: 5000000,  // milliseconds
      endTime: 1640005000000,
      planetId: 'planet-1',
      cost: { metal: 1600, crystal: 800, deuterium: 400 },
      progress: 45
    }
  ],

  // Practical research progress
  practicalResearch: {
    metalMine: {
      output: 5,
      manpower: 2,
      energy: 1,
      cost: 0
    },
    crystalMine: {
      output: 3,
      manpower: 0,
      energy: 2,
      cost: 1
    }
    // ... other buildings/ships
  },

  // Practical research queue
  practicalResearchQueue: [
    {
      id: 'queue-456',
      type: 'practical',
      baseType: 'metalMine',
      itemType: 'building',
      level: 6,                    // Total research level (1-based, incremented each completion)
      startTime: 1640000000000,
      duration: 2000000,           // milliseconds
      endTime: 1640002000000,
      planetId: 'planet-1',
      cost: { metal: 300, crystal: 150, deuterium: 75 },
      progress: 67
    }
  ],

  // Custom building variants per planet
  customBuildingVariants: {
    'planet-1': {
      metalMine: {
        focusLevels: { output: 5, manpower: 2, energy: 1, cost: 0 },
        modifiers: { /* ... */ },
        customDefinition: { /* Modified building definition */ }
      }
    }
  },

  // Custom ship variants (global)
  customShipVariants: {
    smallCargo: {
      focusLevels: { output: 3, manpower: 0, energy: 2, cost: 0 },
      modifiers: { /* ... */ },
      customDefinition: { /* Modified ship definition */ }
    }
  }
}
```

---

## API Endpoints

### Get Research Status
```
GET /api/game/research
Response: { progress: {...}, theoretical: {...}, practical: {...} }
```

### Start Theoretical Research
```
POST /api/game/planet/:planetId/research/theoretical
Body: { techKey: 'energyTech' }
Response: { queue item details }
```

### Cancel Theoretical Research
```
DELETE /api/game/planet/:planetId/research/theoretical/:queueId
Response: { refund: {...}, cancelled: true }
```

### Start Practical Research
```
POST /api/game/planet/:planetId/research/practical
Body: { baseType: 'metalMine', type: 'building', focus: 'output' }
Response: { queue item details }
```

### Cancel Practical Research
```
DELETE /api/game/planet/:planetId/research/practical/:queueId
Response: { refund: {...}, cancelled: true }
```

### Get Available Practical Research
```
GET /api/game/planet/:planetId/research/available
Response: { metalMine: {...}, crystalMine: {...}, ... }
```

### Set Custom Building Variant
```
POST /api/game/planet/:planetId/research/building-variant
Body: { baseType: 'metalMine', focusLevels: { output: 5, manpower: 2, energy: 1, cost: 0 } }
Response: { variant details }
```

### Set Custom Ship Variant
```
POST /api/game/research/ship-variant
Body: { baseType: 'smallCargo', focusLevels: { output: 3, manpower: 0, energy: 2, cost: 0 } }
Response: { variant details }
```

### Get Active Variants
```
GET /api/game/planet/:planetId/research/variants
Response: { building: {...}, ships: {...} }
```

---

## Integration with Game Systems

### Building Upgrades
When upgrading a building, the system checks for active custom variants on the planet:
1. If a custom variant exists for that building, use its modified stats
2. Otherwise, use the base definition

### Ship Production
When building ships, the system checks for active custom variants globally:
1. If a custom variant exists for that ship type, use its modified stats
2. Otherwise, use the base definition

### Energy Calculation
Custom variants affect energy consumption calculations through their modifiers.

### Population Requirements
Custom variants modify workforce requirements for buildings.

### Production Rates
Custom variants modify resource production rates for buildings.

---

## Progression Strategy

### Early Game (First 5-10 hours)
1. Focus on basic theoretical research (Energy, Computer)
2. Start practical research on Metal Mine (Output focus)
3. Unlock basic ships with propulsion drives

### Mid Game (10-50 hours)
1. Specialize practical research based on resource bottlenecks
2. Unlock military technologies
3. Create multiple custom variants for different resource types

### Late Game (50+ hours)
1. Max out practical research on key buildings
2. Fine-tune variants for optimal production chains
3. Experiment with different customization strategies

---

## Strategic Considerations

### Trade-offs
- **Output vs. Cost**: High output builds are expensive
- **Manpower vs. Energy**: Automation increases energy consumption
- **Specialization**: Different planets can focus on different resources

### Optimization
- Combine theoretical bonuses with practical customizations
- Use theoretical research to unlock new buildings/ships
- Use practical research to optimize existing infrastructure

### Variety
- Different customization strategies suit different playstyles
- Military players may focus on Attack power research
- Economic players may focus on Cost/Output research

---

## Files Modified/Created

### New Files
- `src/shared/research.js` - Research definitions and utilities
- `src/server/game/researchLogic.js` - Research game logic
- `src/client/js/views/research.js` - Research UI

### Modified Files
- `src/shared/formulas.js` - Added research formulas
- `src/server/game/player.js` - Added research state to player object
- `src/server/index.js` - Added research API routes
- `src/client/js/main.js` - Integrated research view
- `src/client/css/main.css` - Added research styling

---

## Future Enhancements

1. **Research Combinations**: Special bonuses when combining certain research types
2. **Research Events**: Temporary boosts to research speed
3. **Breakthrough Events**: Random chance to accelerate research
4. **Research Trading**: Ability to trade research progress with other players
5. **Research Branches**: Multiple paths for technology development
6. **Advanced Variants**: Ability to combine multiple custom variants
