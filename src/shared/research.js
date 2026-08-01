// Research system definitions
// Two types of research: Theoretical (unlocks) and Practical (customization)

export const THEORETICAL_RESEARCH = {
    // Energy Technologies
    energyTech: {
        name: 'Energy Technology',
        category: 'Core',
        icon: '⚡',
        description: 'Improves energy production and efficiency across all buildings.',
        detailedDescription: 'Energy Technology is the cornerstone of all advanced planetary infrastructure.\n\nIt covers the mastery of high-density power generation, superconducting transmission, and localized grid optimization. As scientists delve deeper into quantum energetics and zero-point fluctuations, they unlock the ability to construct Fusion Reactors, which harness the power of artificial suns.\n\nHigher levels of this research not only unlock new energy structures but also improve the efficiency of existing ones, making it easier to power a rapidly growing colony without constant blackouts.',
        baseCost: {
            metal: 200,
            crystal: 100,
            deuterium: 50
        },
        unlocks: ['fusionReactor', 'energyTech'],
        bonuses: {
            buildingEnergyProduction: 0.1, // 10% per level
            buildingEnergyEfficiency: 0.01 // 1% per level
        }
    },

    computerTech: {
        name: 'Computer Technology',
        category: 'Core',
        icon: '💻',
        description: 'Accelerates research and improves fleet efficiency.',
        detailedDescription: 'From localized AI sub-routines to massive planet-wide neural networks, Computer Technology governs the processing power available to your empire.\n\nAdvanced computing allows for more efficient management of complex research simulations and the coordination of vast robotic workforces. Strategically, this is one of the most critical technologies to advance early, as its "research speed" bonus applies to every other technological field.\n\nIt is also a fundamental requirement for advanced defensive systems and the sophisticated navigation computers required for deep-space combat vessels.',
        baseCost: {
            metal: 400,
            crystal: 600,
            deuterium: 200
        },
        unlocks: ['researchLab', 'weaponsTech', 'shieldingTech'],
        bonuses: {
            globalResearchSpeed: 0.1, // 10% per level
            globalFleetCommand: 0.05
        },
        requirements: {
            researchLab: 1
        }
    },

    weaponsTech: {
        name: 'Weapons Technology',
        category: 'Military',
        icon: '⚔️',
        description: 'Increases attack power of all units.',
        detailedDescription: 'In a galaxy full of potential threats, superior firepower is the ultimate deterrent.\n\nWeapons Technology encompasses research into high-energy laser focal points, railgun acceleration, and focused antimatter warheads. By refining the destructive potential of your fleet\'s primary armaments, this technology increases the damage output of every ship and planetary defense turret in your arsenal.\n\nCommanders who neglect Weapons Tech often find their fleets outmatched by smaller, more specialized forces that hit harder and more precisely.',
        baseCost: {
            metal: 800,
            crystal: 200,
            deuterium: 100
        },
        prerequisites: ['computerTech'],
        unlocks: ['heavyFighter', 'cruiser', 'battleship'],
        bonuses: {
            unitAttackPower: 0.2 // 20% per level
        },
        requirements: {
            researchLab: 4
        }
    },

    shieldingTech: {
        name: 'Shielding Technology',
        category: 'Military',
        icon: '🛡️',
        description: 'Improves shield strength and defense.',
        detailedDescription: 'Shielding Technology focuses on the generation and stabilization of high-frequency gravitic and electromagnetic barriers.\n\nThese shields are designed to absorb and redistribute the energy from incoming attacks, protecting the underlying hull from damage. As this research progresses, shield generators become more resilient and faster to cycle, significantly increasing the survivability of your ships.\n\nHigh levels of shielding are also required to construct the massive planetary shield domes that can withstand prolonged orbital bombardments.',
        baseCost: {
            metal: 200,
            crystal: 600,
            deuterium: 0
        },
        prerequisites: ['computerTech'],
        unlocks: ['defenses'],
        bonuses: {
            unitShieldStrength: 0.2 // 20% per level
        },
        requirements: {
            researchLab: 6
        }
    },

    armorTech: {
        name: 'Armor Technology',
        category: 'Military',
        icon: '🔒',
        description: 'Strengthens hull armor of ships.',
        detailedDescription: 'When shields fail, only the cold, hard metal of the hull stands between your crew and the vacuum of space.\n\nArmor Technology focuses on the development of multi-layered composite alloys and structural reinforcement techniques that can withstand extreme heat and kinetic impacts. This research directly increases the maximum hull integrity of all units, allowing them to remain in the fight long after their counterparts would have been reduced to space dust.\n\nIt is essential for the construction of massive Battleships and heavily armored planetary bunkers.',
        baseCost: {
            metal: 1000,
            crystal: 0,
            deuterium: 500
        },
        unlocks: ['battleship'],
        bonuses: {
            unitHullStrength: 0.15 // 15% per level
        },
        requirements: {
            researchLab: 2
        }
    },

    combustionDrive: {
        name: 'Combustion Drive',
        category: 'Propulsion',
        icon: '🚀',
        description: 'Enables basic spaceship travel.',
        detailedDescription: 'The fundamental propulsion system for any interstellar civilization.\n\nCombustion Drives utilize high-efficiency chemical reactions to generate the massive thrust needed to exit a planet\'s gravity well and travel between nearby celestial bodies. While lacking the sheer speed of advanced fusion or hyperspace drives, the Combustion Drive is reliable, cost-effective, and forms the backbone of early transport and trade fleets.\n\nMastering this tech is the first step toward exploring the stars and establishing your first colonies.',
        baseCost: {
            metal: 400,
            crystal: 150,
            deuterium: 100
        },
        unlocks: ['smallCargo', 'largeCargo'],
        bonuses: {
            shipCombustionSpeed: 0.2 // 20% per level
        },
        requirements: {
            researchLab: 1
        }
    },

    impulseDrive: {
        name: 'Impulse Drive',
        category: 'Propulsion',
        icon: '🌠',
        description: 'Faster interplanetary travel.',
        detailedDescription: 'Impulse Drives represent a significant leap over basic chemical rockets.\n\nBy utilizing localized fusion reactions to accelerate plasma to relativistic speeds, these drives provide a massive increase in sub-light velocity and maneuverability. Ships equipped with Impulse Drives can cross entire solar systems in a fraction of the time required by combustion-based vessels.\n\nThis technology is vital for rapid response fleets and is a prerequisite for the construction of agile Light Fighters and more capable combat vessels.',
        baseCost: {
            metal: 2000,
            crystal: 4000,
            deuterium: 600
        },
        prerequisites: ['combustionDrive'],
        unlocks: ['lightFighter', 'heavyFighter'],
        bonuses: {
            shipImpulseSpeed: 0.3 // 30% per level
        },
        requirements: {
            researchLab: 2
        }
    },

    hyperspaceDrive: {
        name: 'Hyperspace Drive',
        category: 'Propulsion',
        icon: '🌌',
        description: 'Enables intergalactic travel.',
        detailedDescription: 'The pinnacle of propulsion technology.\n\nHyperspace Drives function by creating a localized tear in the fabric of space-time, allowing a ship to enter a "sub-space" dimension where the speed of light is not a barrier. This allows for near-instantaneous travel across vast distances that would otherwise take centuries to cross.\n\nThe Hyperspace Drive is the lifeblood of a sprawling intergalactic empire, enabling the rapid deployment of massive battle-fleets and the efficient coordination of far-flung colonies. It is required for the construction of the most powerful capital ships.',
        baseCost: {
            metal: 10000,
            crystal: 20000,
            deuterium: 6000
        },
        prerequisites: ['impulseDrive', 'computerTech'],
        unlocks: ['cruiser', 'battleship', 'destroyer', 'dreadnought', 'carrier'],
        bonuses: {
            shipHyperSpeed: 0.5 // 50% per level
        },
        requirements: {
            researchLab: 7
        }
    },

    espionageTech: {
        name: 'Espionage Technology',
        category: 'Military',
        icon: '🕵️',
        description: 'Enables espionage missions and improves intelligence gathering.',
        detailedDescription: 'In the dark reaches of space, information is often more valuable than gold.\n\nEspionage Technology focuses on the development of ultra-sensitive long-range scanners, advanced encryption algorithms, and stealth-coatings for probes. Advancing this tech allows your empire to gain detailed insights into enemy planet infrastructure and fleet movements while simultaneously making your own systems much harder to penetrate.\n\nHigh-level espionage is essential for planning successful attacks and avoiding costly ambushes.',
        baseCost: {
            metal: 1000,
            crystal: 1000,
            deuterium: 600
        },
        prerequisites: ['computerTech'],
        unlocks: ['espionageProbe'],
        bonuses: {
            unitEspionageAbility: 0.1 // 10% per level
        },
        requirements: {
            researchLab: 3
        }
    },

    astrophysics: {
        name: 'Astrophysics',
        category: 'Engineering',
        icon: '🔭',
        description: 'Unlocks additional galaxy slots and colony expansion.',
        detailedDescription: 'The study of the cosmos and the formation of star systems.\n\nAdvanced knowledge of Astrophysics is required to identify and exploit habitable worlds across the galaxy. This research directly determines the maximum number of planets your empire can colonize and manage effectively.\n\nIt also covers the logistical challenges of maintaining distant outposts, ensuring your colonists have the life-support and communications systems needed to survive in the most remote corners of the universe. Every level expands your reach and your influence.',
        baseCost: {
            metal: 4000,
            crystal: 8000,
            deuterium: 4000
        },
        prerequisites: ['computerTech'],
        unlocks: ['colonyShip'],
        bonuses: {
            playerGalaxySlots: 1, // Adds 1 galaxy slot per level
            unitColonistCapacity: 0.2 // 20% more colonists per level
        },
        requirements: {
            researchLab: 3
        },
        costScaling: 2.0
    },

    housingTech: {
        name: 'Housing Improvement',
        category: 'Engineering',
        icon: '🏘️',
        description: 'Significantly improves housing capacity and efficiency.',
        detailedDescription: 'Housing Improvement focuses on the architectural and life-support optimizations required to sustain dense populations in hostile environments.\n\nBy developing modular living units, advanced waste recycling, and psychology-aware habitat designs, this technology drastically increases the base capacity of Housing structures. It also provides a scaling bonus that makes every level of Housing more effective as your population grows.',
        baseCost: {
            metal: 1000,
            crystal: 1000,
            deuterium: 0
        },
        prerequisites: ['energyTech'],
        bonuses: {
            housingScalingBonus: 0.01  // +0.01 scaling factor per level
        },
        requirements: {
            researchLab: 1
        }
    },

    laserTech: {
        name: 'Laser Technology',
        category: 'Military',
        icon: '🔫',
        description: 'Focuses on coherent light amplification for weaponry.',
        detailedDescription: 'Laser Technology is the first step into advanced energy weapons. By focusing light into a coherent beam, it allows for high-precision strikes that travel at the speed of light.\n\nThis technology is the foundation for Laser Cannons and is essential for the development of modern combat ships.',
        baseCost: {
            metal: 200,
            crystal: 100,
            deuterium: 0
        },
        prerequisites: ['energyTech'],
        unlocks: ['laserCannon'],
        requirements: {
            researchLab: 1
        }
    },

    ionTech: {
        name: 'Ion Technology',
        category: 'Military',
        icon: '⚡',
        description: 'Focuses on charged particle beams.',
        detailedDescription: 'Ion Technology harnesses the power of accelerated ions to disrupt enemy systems. \n\nWeapons based on this technology are particularly effective against shields and electronic systems. It is a key requirement for the construction of Ion Cannons and advanced Cruisers.',
        baseCost: {
            metal: 1000,
            crystal: 300,
            deuterium: 100
        },
        prerequisites: ['computerTech', 'energyTech', 'laserTech'],
        unlocks: ['ionCannon'],
        requirements: {
            researchLab: 4
        }
    },

    plasmaTech: {
        name: 'Plasma Technology',
        category: 'Military',
        icon: '🌋',
        description: 'Focuses on superheated gas containment.',
        detailedDescription: 'The ultimate in destructive technology. Plasma Technology allows for the containment and projection of superheated ionized gas.\n\nPlasma weapons deal catastrophic damage to hull plating and armor. Mastering this technology unlocks the terrifying Plasma Turret and is required for the most advanced bombers.',
        baseCost: {
            metal: 2000,
            crystal: 4000,
            deuterium: 1000
        },
        prerequisites: ['energyTech', 'laserTech', 'ionTech'],
        unlocks: ['plasmaTurret', 'bomber'],
        requirements: {
            researchLab: 5
        }
    },

    resourceEfficiency: {
        name: 'Resource Efficiency',
        category: 'Engineering',
        icon: '♻️',
        description: 'Reduces the construction cost of buildings, defenses, and ships.',
        detailedDescription: 'Resource Efficiency focus on minimizing waste and optimizing the use of raw materials during construction.\n\nBy implementing advanced recycling protocols and structural optimization algorithms, your engineers can build larger structures and more complex vessels with fewer resources. Each level reduces the Metal, Crystal, and Deuterium cost of all buildings, ships, and defenses by 0.5%.',
        baseCost: {
            metal: 2000,
            crystal: 4000,
            deuterium: 1000
        },
        prerequisites: ['energyTech'],
        bonuses: {
            globalCostReduction: 0.005 // 0.5% per level
        }
    },

    modularConstruction: {
        name: 'Modular Construction',
        category: 'Engineering',
        icon: '🏗️',
        description: 'Reduces the construction time of all structures and units.',
        detailedDescription: 'Modular Construction utilizes standardized structural components and pre-fabricated modules to streamline the assembly process.\n\nInstead of building from scratch, your robotics and shipyard crews can simply snap together tested and verified sections. Each level of this research reduces the base time required to build buildings, ships, and defenses by 1%.',
        baseCost: {
            metal: 5000,
            crystal: 2000,
            deuterium: 500
        },
        prerequisites: ['computerTech', 'energyTech'],
        bonuses: {
            globalTimeReduction: 0.01 // 1% per level
        }
    }
};

/**
 * Practical research focuses - modifiers for customized buildings/ships
 */
export const PRACTICAL_FOCUS_TYPES = {
    OUTPUT: 'output',          // Increases production/efficiency
    AUTOMATION: 'automation',  // Reduces workforce requirement through automation
    ENERGY: 'energy',          // Improves energy efficiency
    COST: 'cost'               // Reduces construction cost
};

/**
 * Shared focus modifier templates for buildings and ships
 */
const PRODUCTION_BUILDING_MODIFIERS = {
    output: {
        productionMultiplier: 1.02,      // 2% base effect with diminishing returns
        timeMultiplier: 0.99,             // 1% base effect with diminishing returns
        costMultiplier: 1.015,            // 1.5% base effect with diminishing returns
        energyMultiplier: 1.015,          // 1.5% base effect with diminishing returns
        populationMultiplier: 1.0075      // 0.75% base effect with diminishing returns
    },
    automation: {
        populationMultiplier: 0.985,      // 1.5% base effect with diminishing returns
        costMultiplier: 1.015,            // 1.5% base effect with diminishing returns
        energyMultiplier: 1.015,          // 1.5% base effect with diminishing returns
        productionMultiplier: 0.999       // 0.1% base effect with diminishing returns
    },
    energy: {
        energyMultiplier: 0.985,          // 1.5% base effect with diminishing returns
        costMultiplier: 1.01,             // 1% base effect with diminishing returns
        productionMultiplier: 0.999,      // 0.1% base effect with diminishing returns
        populationMultiplier: 1.0075       // 0.75% base effect with diminishing returns
    },
    cost: {
        costMultiplier: 0.985,            // 1.5% base effect with diminishing returns
        productionMultiplier: 0.999,       // 0.1% base effect with diminishing returns
        energyMultiplier: 1.001,           // 0.1% base effect with diminishing returns
        populationMultiplier: 1.001        // 0.1% base effect with diminishing returns
    }
};

/**
 * Practical research definitions - one per base building/ship type
 * Each tracks which focuses a player has invested in
 */
export const PRACTICAL_RESEARCH = {
    // Building customizations
    metalMine: {
        name: 'Metal Mine',
        baseType: 'metalMine',
        type: 'building',
        category: 'Mining',
        icon: '⚙️',
        description: 'Customize metal mine extraction through practical research.',
        baseCost: {
            metal: 20,
            crystal: 10,
            deuterium: 5
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    crystalMine: {
        name: 'Crystal Mine',
        baseType: 'crystalMine',
        type: 'building',
        category: 'Mining',
        icon: '💎',
        description: 'Customize crystal mine extraction through practical research.',
        baseCost: {
            metal: 20,
            crystal: 10,
            deuterium: 5
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    deuteriumSynthesizer: {
        name: 'Deuterium Synthesizer',
        baseType: 'deuteriumSynthesizer',
        type: 'building',
        category: 'Mining',
        icon: '🛢️',
        description: 'Customize deuterium synthesizer extraction through practical research.',
        baseCost: {
            metal: 30,
            crystal: 20,
            deuterium: 10
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    solarPlant: {
        name: 'Solar Plant',
        baseType: 'solarPlant',
        type: 'building',
        category: 'Energy',
        icon: '☀️',
        description: 'Customize solar energy production through practical research.',
        baseCost: {
            metal: 30,
            crystal: 20,
            deuterium: 10
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    fusionReactor: {
        name: 'Fusion Reactor',
        baseType: 'fusionReactor',
        type: 'building',
        category: 'Energy',
        icon: '⚛️',
        description: 'Optimize high-energy fusion output and deuterium consumption.',
        baseCost: {
            metal: 100,
            crystal: 50,
            deuterium: 50
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    roboticsFactory: {
        name: 'Robotics Factory',
        baseType: 'roboticsFactory',
        type: 'building',
        category: 'Infrastructure',
        icon: '🤖',
        description: 'Customize automated construction workflows.',
        baseCost: {
            metal: 50,
            crystal: 30,
            deuterium: 20
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    shipyard: {
        name: 'Shipyard',
        baseType: 'shipyard',
        type: 'building',
        category: 'Infrastructure',
        icon: '🚀',
        description: 'Improve ship assembly protocols and infrastructure.',
        baseCost: {
            metal: 50,
            crystal: 30,
            deuterium: 20
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    researchLab: {
        name: 'Research Lab',
        baseType: 'researchLab',
        type: 'building',
        category: 'Science',
        icon: '🔬',
        description: 'Advanced laboratory tuning for scientific breakthroughs.',
        baseCost: {
            metal: 50,
            crystal: 50,
            deuterium: 50
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    naniteFactory: {
        name: 'Nanite Factory',
        baseType: 'naniteFactory',
        type: 'building',
        category: 'Infrastructure',
        icon: '🔧',
        description: 'Micro-tuning of nanobot swarms and assembly patterns.',
        baseCost: {
            metal: 500,
            crystal: 300,
            deuterium: 200
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    waterExtractor: {
        name: 'Water Extractor',
        baseType: 'waterExtractor',
        type: 'building',
        category: 'Resource',
        icon: '💦',
        description: 'Customize hydrological extraction processes.',
        baseCost: {
            metal: 20,
            crystal: 10,
            deuterium: 0
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    farm: {
        name: 'Farm',
        baseType: 'farm',
        type: 'building',
        category: 'Resource',
        icon: '🍞',
        description: 'Optimize hydroponic growth cycles and yields.',
        baseCost: {
            metal: 20,
            crystal: 10,
            deuterium: 0
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    },

    housing: {
        name: 'Housing',
        baseType: 'housing',
        type: 'building',
        category: 'Infrastructure',
        icon: '🏘️',
        description: 'Improve residential efficiency and power usage.',
        baseCost: {
            metal: 20,
            crystal: 10,
            deuterium: 0
        },
        focusModifiers: PRODUCTION_BUILDING_MODIFIERS
    }
};

/**
 * Calculate total bonus from all researched technologies for a given bonus type
 * @param {Object} playerResearch - Player's research levels { techKey: level }
 * @param {string} bonusKey - The bonus type to sum (e.g., 'costReduction', 'timeReduction')
 */
export function getResearchBonus(playerResearch, bonusKey) {
    if (!playerResearch) return 0;

    let totalBonus = 0;
    for (const techKey in playerResearch) {
        const techLevel = playerResearch[techKey];
        // Handle both old structure (number) and new structure (object with level)
        const level = typeof techLevel === 'object' ? (techLevel.level ?? 0) : (techLevel ?? 0);

        const tech = THEORETICAL_RESEARCH[techKey];
        if (tech && tech.bonuses && tech.bonuses[bonusKey]) {
            totalBonus += level * tech.bonuses[bonusKey];
        }
    }
    return totalBonus;
}

/**
 * Get all theoretical research techs
 */
export function getTheoreticalResearch() {
    return THEORETICAL_RESEARCH;
}

/**
 * Get all practical research options
 */
export function getPracticalResearch() {
    return PRACTICAL_RESEARCH;
}

export function validateFocusLevels(researchConfig, focusLevels, experience = {}) {
    if (!researchConfig?.focusModifiers || !focusLevels || typeof focusLevels !== 'object' || Array.isArray(focusLevels)) {
        throw new Error('Invalid focus levels');
    }

    const entries = Object.entries(focusLevels);
    if (entries.length === 0) throw new Error('Invalid focus levels');

    for (const [focus, level] of entries) {
        if (!Object.hasOwn(researchConfig.focusModifiers, focus)) throw new Error(`Invalid research focus: ${focus}`);
        if (!Number.isSafeInteger(level) || level < 0) throw new Error('Focus levels must be non-negative integers');
        const currentExp = Object.hasOwn(experience, focus) && Number.isFinite(experience[focus]) ? Math.max(0, experience[focus]) : 0;
        const maxLevel = Math.floor(Math.sqrt(currentExp / 100));
        if (level > maxLevel) throw new Error(`Focus level ${level} exceeds research level ${maxLevel}`);
    }

    return Object.fromEntries(entries);
}

/**
 * Check if a theoretical technology is available based on prerequisites
 */
export function canResearchTheoretical(techKey, playerResearch, planetBuildings = {}) {
    const tech = THEORETICAL_RESEARCH[techKey];
    if (!tech) return false;

    // Check prerequisites (other research)
    if (tech.prerequisites && Array.isArray(tech.prerequisites)) {
        const met = tech.prerequisites.every(prereq => {
            const researchEntry = playerResearch[prereq];
            const level = typeof researchEntry === 'object' ? (researchEntry.level ?? 0) : (researchEntry ?? 0);
            return level > 0;
        });
        if (!met) return false;
    }

    // Check building requirements
    if (tech.requirements) {
        for (const building in tech.requirements) {
            const requiredLevel = tech.requirements[building];
            if ((planetBuildings[building] || 0) < requiredLevel) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Get available practical research for a player based on building/ship availability
 */
export function getAvailablePracticalResearch(playerBuildings, playerShips) {
    const available = {};

    // Check which buildings exist
    for (const key in PRACTICAL_RESEARCH) {
        const research = PRACTICAL_RESEARCH[key];
        if (research.type === 'building' && playerBuildings[research.baseType]) {
            available[key] = research;
        }
    }

    return available;
}

/**
 * Get a custom variant of a building based on practical research focus
 * Returns modified stats based on the focus levels
 */
export function getCustomVariant(baseType, focusLevels) {
    // focusLevels = { output: 5, automation: 3, energy: 2, cost: 0 }
    let research = null;
    for (const key in PRACTICAL_RESEARCH) {
        const r = PRACTICAL_RESEARCH[key];
        if (r.baseType === baseType) {
            research = r;
            break;
        }
    }

    if (!research) return null;

    return {
        baseType,
        focusLevels,
        modifiers: calculateFocusModifiers(research, focusLevels)
    };
}

/**
 * Calculate aggregated modifiers with endless, diminishing focus progression.
 * Focus levels already use square-root progression from research experience,
 * so each level keeps the original exponential effect.
 */
export function calculateFocusModifiers(research, focusLevels) {
    const modifiers = {
        productionMultiplier: 1,
        timeMultiplier: 1,
        costMultiplier: 1,
        energyMultiplier: 1,
        populationMultiplier: 1
    };

    // Apply exponential modifiers from each focus
    for (const focus in focusLevels) {
        const level = focusLevels[focus];

        if (level > 0 && research.focusModifiers[focus]) {
            const focusModifiers = research.focusModifiers[focus];
            for (const stat in focusModifiers) {
                const baseMultiplier = focusModifiers[stat];
                if (modifiers.hasOwnProperty(stat)) {
                    const multipliedValue = Math.pow(baseMultiplier, level);
                    modifiers[stat] *= multipliedValue;
                }
            }
        }
    }

    return modifiers;
}

/**
 * Apply practical research modifiers to a building definition
 */
export function applyCustomization(baseDefinition, modifiers) {
    // Deep clone the definition to avoid modifying the original constants
    const customized = JSON.parse(JSON.stringify(baseDefinition));

    // Apply production modifier
    if (modifiers.productionMultiplier !== 1 && customized.production) {
        for (const resource in customized.production) {
            customized.production[resource] *= modifiers.productionMultiplier;
        }
    }

    // Apply time multiplier (for factories, lab, shipyard)
    if (modifiers.timeMultiplier !== 1) {
        if (customized.timeMultiplier === undefined) {
            customized.timeMultiplier = modifiers.timeMultiplier;
        } else {
            customized.timeMultiplier *= modifiers.timeMultiplier;
        }
    }

    // Apply cost modifier
    if (modifiers.costMultiplier !== 1 && customized.baseCost) {
        for (const resource in customized.baseCost) {
            customized.baseCost[resource] *= modifiers.costMultiplier;
        }
    }

    // Apply energy modifier
    if (modifiers.energyMultiplier !== 1 && customized.energyConsumption !== undefined) {
        customized.energyConsumption *= modifiers.energyMultiplier;
    }

    // Apply population modifier
    if (modifiers.populationMultiplier !== 1 && customized.populationRequired !== undefined) {
        customized.populationRequired *= modifiers.populationMultiplier;
    }

    return customized;
}
