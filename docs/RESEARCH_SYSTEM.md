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

### Implementation Details
- **File**: `src/shared/research.js`
- **Functions**: `startTheoreticalResearch`, `completeTheoreticalResearch`, `cancelTheoreticalResearch`

## Practical Research

### Definition
Practical research allows players to customize buildings and ships with specific focuses, such as improving output, reducing manpower, or enhancing energy efficiency.

### Key Characteristics
- **Focus Types**: Output, Manpower, Energy, Cost
- **Customization**: Players can create unique variants for buildings and ships
- **Cost Scaling**: Costs increase at a slower rate (1.5x per level)
- **Time Scaling**: Research time increases at a slower rate (1.5x per level)

### Available Focuses
- **Output**: Increases production/efficiency
- **Manpower**: Reduces workforce requirements
- **Energy**: Improves energy efficiency
- **Cost**: Reduces construction costs

### Implementation Details
- **File**: `src/shared/research.js`
- **Functions**: `startPracticalResearch`, `completePracticalResearch`, `getActiveBuildingVariant`, `getActiveShipVariant`

---

**Last Updated**: December 29, 2025
**Status**: ✅ Complete and Production-Ready
