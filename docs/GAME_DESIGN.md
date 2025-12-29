# Game Design Document - Space Adventure

## Game Concept

Space Adventure is a browser-based space strategy game where players build and manage their space empire in a persistent universe, focusing on PVE gameplay against AI opponents.

## Core Gameplay Loop

1. **Resource Generation**: Buildings produce resources over time
2. **Construction**: Use resources to build structures and research technologies
3. **Fleet Building**: Construct ships for exploration and combat
4. **PVE Combat**: Attack AI-controlled planets and defend against AI raids
5. **Expansion**: Colonize new planets to increase production
6. **Research**: Unlock new technologies and customize buildings/ships

## Resources

### Primary Resources
- **Metal**: Basic construction material, mines slowly
- **Crystal**: Advanced technology component, mines moderately
- **Deuterium**: Fuel for ships and energy, mines slowly but valuable
- **Energy**: Powers buildings and production

### Secondary Resources
- **Dark Matter**: Premium resource for special features (future)

## Buildings

### Resource Production
1. **Metal Mine**: Produces metal over time (levels 1-30)
2. **Crystal Mine**: Produces crystal over time (levels 1-30)
3. **Deuterium Synthesizer**: Produces deuterium (levels 1-30)
4. **Solar Plant**: Generates energy (levels 1-30)
5. **Fusion Reactor**: Advanced energy generation (requires research)

### Infrastructure
1. **Robotics Factory**: Speeds up construction (levels 1-10)
2. **Shipyard**: Allows ship construction (levels 1-12)
3. **Research Lab**: Enables technology research (levels 1-12)
4. **Storage Facilities**: Increases resource storage capacity
5. **Nanite Factory**: Dramatically speeds up construction (levels 1-5, very expensive)

## Research System

### Theoretical Research
- Unlocks new technologies and capabilities
- Provides permanent bonuses to game mechanics
- Examples: Energy Technology, Weapons Technology

### Practical Research
- Customizes buildings and ships with specific focuses
- Examples: Increasing output, reducing manpower requirements

### Integration
- Research Lab required for all research activities
- Research progress visible in the Research tab
- Bonuses and customizations applied automatically upon completion

## Ships

### Civilian
1. **Small Cargo**: Basic transport (capacity: 5,000)
2. **Large Cargo**: Heavy transport (capacity: 25,000)
3. **Colony Ship**: Colonizes new planets (single-use)
4. **Recycler**: Collects debris from battles

### Military
1. **Light Fighter**: Fast, cheap attack ship
2. **Heavy Fighter**: Stronger fighter with better armor
3. **Cruiser**: Medium combat ship, good against fighters
4. **Battleship**: Heavy combat ship, high damage
5. **Destroyer**: Anti-capital ship
6. **Bomber**: Specialized for destroying defenses

### Special
1. **Espionage Probe**: Gathers intelligence on targets
2. **Solar Satellite**: Orbital energy generation

## Combat System

### Battle Mechanics
- **Turn-based calculation**: Combat resolved in rounds
- **Weapon vs Shield**: Weapons must overcome shields first
- **Shield vs Hull**: After shields, damage goes to hull
- **Rapid Fire**: Some ships get multiple shots against specific targets
- **Debris Field**: 30% of destroyed ships become debris (metal/crystal)

### Combat Formula
```
Base Damage = Ship Weapons * Weapons Tech Multiplier
Shield Strength = Base Shield * Shielding Tech Multiplier
Hull Strength = Base Hull * Armor Tech Multiplier

If Damage > Shield: Damage -= Shield, apply remaining to Hull
Combat continues until one side is destroyed or retreats
```

### AI Combat Behavior
1. **Defensive AI**: Protects planets, doesn't attack unless provoked
2. **Balanced AI**: Mix of defense and opportunistic attacks
3. **Aggressive AI**: Actively seeks to attack player colonies
4. **Raider AI**: Small, frequent raids on weak targets

## Progression System

### Early Game (Levels 1-10)
- Focus on building mines and energy
- Research basic technologies
- Build small fleet of fighters
- Learn combat against weak AI

### Mid Game (Levels 10-20)
- Optimize resource production
- Build diverse fleet compositions
- Research advanced technologies
- Colonize 2nd and 3rd planets
- Face stronger AI opponents

### Late Game (Levels 20+)
- Massive resource production
- Capital ship fleets
- Multiple colonies
- Complex AI strategies
- Optimization and efficiency focus

## AI System

### AI Types

1. **Tutorial AI**: Weak, predictable, helps players learn
   - Small fleets
   - Minimal defenses
   - Abundant resources

2. **Standard AI**: Normal difficulty
   - Balanced economy
   - Moderate defenses
   - Responds to threats

3. **Advanced AI**: Challenging
   - Optimized builds
   - Strong defenses
   - Counterattacks
   - Adapts to player strategy

4. **Elite AI**: End-game challenge
   - Maximum efficiency
   - Powerful fleets
   - Coordinated attacks
   - Unpredictable strategies

### AI Behavior Patterns
- **Economy Management**: AI builds mines and researches tech
- **Fleet Production**: AI builds ships based on strategy type
- **Target Selection**: AI chooses targets based on risk/reward
- **Defense Response**: AI reinforces defenses after attacks
- **Resource Management**: AI prioritizes spending based on needs

## User Interface

### Main Screens

1. **Overview**: Dashboard with resource status, ongoing activities
2. **Buildings**: Construct and upgrade buildings
3. **Research**: Technology tree and research queue
4. **Shipyard**: Build ships and defenses
5. **Fleet**: Manage and deploy fleets
6. **Galaxy**: View AI planets and select targets
7. **Messages**: Combat reports, system notifications

### Real-time Elements
- Resource counters (updated per second)
- Construction/research timers
- Fleet movement timers
- Event notifications

## Balancing

### Resource Production
- Metal: Most abundant, used for everything
- Crystal: 2x rarer than metal, tech-focused
- Deuterium: 3x rarer than metal, strategic importance

### Construction Times
- Early buildings: Seconds to minutes
- Mid-game buildings: Minutes to hours
- Late-game buildings: Hours to days
- Ships: Seconds to minutes depending on quantity

### Combat Balance
- Rock-paper-scissors for ship types
- No single "best" fleet composition
- Counter-strategies available for all AI types

## Monetization (Future Consideration)
- Free to play, no pay-to-win
- Optional cosmetics
- Time acceleration (non-essential)
- This version focuses on core gameplay first
