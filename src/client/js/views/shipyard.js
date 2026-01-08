// Shipyard view logic
import { API } from '../api.js';
import { formatNumber, formatCountdown } from '../utils.js';
import { RESOURCE_ICONS, BUILDING_SPEED_MULTIPLIER, CONFIG } from '../../../shared/constants.js';
import { isEmpty } from '../../../shared/utils.js';
import { calculateBaseTime } from '../../../shared/time.js';
import { getCurrentPlanetId } from '../main.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';

let currentShipyardData = null;
let collapsedSections = {}; // Track collapsed state
let lastStructuralHash = null;

/**
 * Calculate structural hash (planet, subview, levels)
 */
function calculateStructuralHash(shipyardData, planet, subView) {
    return JSON.stringify({
        planetId: planet.id,
        subView,
        shipyardLevel: shipyardData.shipyardLevel,
        roboticsLevel: shipyardData.roboticsLevel,
        naniteLevel: shipyardData.naniteLevel
    });
}

/**
 * Calculate content hash (ships counts and queue structure)
 */
function calculateContentHash(shipyardData) {
    const queue = [...(shipyardData.shipQueue || []), ...(shipyardData.defenseQueue || [])].map(q => ({
        id: q.id,
        ships: q.ships,
        defenses: q.defenses,
        pos: q.queuePosition
    }));
    
    return JSON.stringify({
        ships: shipyardData.ships,
        queue: queue
    });
}

/**
 * Calculate a hash of the shipyard state to detect changes
 */
function calculateShipyardStateHash(shipyardData, planet, subView) {
    // Legacy hash for backward compatibility if needed, 
    // but we will primarily use the specific ones below
    return calculateStructuralHash(shipyardData, planet, subView) + calculateContentHash(shipyardData);
}

let lastContentHash = null;

/**
 * Update shipyard view with planet data
 */
export async function updateShipyardView(planet, subView = 'ships') {
    try {
        const shipyardData = await API.getShipyardDetails(planet.id);
        currentShipyardData = shipyardData;

        const containerId = subView === 'defenses' ? 'defenses-view' : 'shipyard-view';
        const container = document.getElementById(containerId);
        if (!container) return;

        // 1. Initialize structural layout if needed
        const structuralHash = calculateStructuralHash(shipyardData, planet, subView);
        if (structuralHash !== lastStructuralHash || !container.querySelector('.shipyard-content')) {
            const shipyardLevel = shipyardData.shipyardLevel || 0;
            const isDefenses = subView === 'defenses';
            
            container.innerHTML = `
                <div class="shipyard-header">
                    <h3>⚙️ ${isDefenses ? 'Defenses' : 'Shipyard'} Level ${shipyardLevel}</h3>
                </div>
                <div class="shipyard-content">
                    <div class="shipyard-queue-container"></div>
                    <div class="shipyard-list-container"></div>
                </div>
            `;
            lastStructuralHash = structuralHash;
            lastContentHash = null; // Force content update on structural change
        }

        const shipyardContent = container.querySelector('.shipyard-content');
        const queueContainer = shipyardContent.querySelector('.shipyard-queue-container');
        const listContainer = shipyardContent.querySelector('.shipyard-list-container');

        // 2. Update Content (Queue and Lists)
        const contentHash = calculateContentHash(shipyardData);
        if (contentHash !== lastContentHash) {
            // Update Queue (ALWAYS ON TOP)
            queueContainer.innerHTML = renderBuildQueue(shipyardData);
            
            // Update Ships/Defenses list
            // Note: We only update the list if the counts or availability change.
            // This is where user input is preserved.
            const isDefenses = subView === 'defenses';
            listContainer.innerHTML = isDefenses 
                ? renderDefensesList(planet, shipyardData)
                : renderShipsList(planet, shipyardData);
            
            lastContentHash = contentHash;
            
            // Re-attach listeners after content update
            attachShipyardListeners(planet, shipyardData);
        }
        
    } catch (error) {
        console.error('Failed to load shipyard details:', error);
        const containerId = subView === 'defenses' ? 'defenses-view' : 'shipyard-view';
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = `<p class="error">Failed to load shipyard: ${error.message}</p>`;
    }
}

/**
 * Render ships list with foldable categories
 */
function renderShipsList(planet, shipyardData) {
    const { ships, availableShips, shipyardLevel } = shipyardData;
    
    const shipCategories = {
        civilian: { label: '📦 Civilian Ships', minLevel: 1, ships: {} },
        military: { label: '⚔️ Military Ships', minLevel: 2, ships: {} }
    };
    
    // Organize ships by category
    for (const shipKey in availableShips) {
        const ship = availableShips[shipKey];
        const category = ship.type;
        if (shipCategories[category]) {
            shipCategories[category].ships[shipKey] = ship;
        }
    }
    
    let html = '<div class="ship-categories-container">';
    
    for (const category in shipCategories) {
        const data = shipCategories[category];
        if (isEmpty(data.ships)) continue;
        
        const isCollapsed = collapsedSections[`ships-${category}`] || false;
        const isLocked = shipyardLevel < data.minLevel;
        
        html += `<div class="ships-category">
            <div class="category-header" onclick="window.toggleCategory('ships-${category}')">
                <span class="toggle-icon">${isCollapsed ? '▶️' : '▼️'}</span>
                <h4>${data.label}</h4>
                ${isLocked ? `<span class="lock-icon">🔒 Requires Level ${data.minLevel}</span>` : ''}
            </div>`;
        
        if (!isCollapsed) {
            html += '<div class="ships-grid">';
            for (const shipKey in data.ships) {
                const baseShip = data.ships[shipKey];
                
                // Get blueprints for this ship type
                const blueprints = (currentShipyardData.shipBlueprints && currentShipyardData.shipBlueprints[shipKey]) || [];
                
                // Render the Base Model first
                html += renderShipCard(planet, shipKey, baseShip, shipyardLevel, isLocked, null);
                
                // Render each blueprint
                for (const blueprint of blueprints) {
                    html += renderShipCard(planet, shipKey, blueprint.customDefinition, shipyardLevel, isLocked, blueprint);
                }
            }
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function renderShipCard(planet, shipKey, ship, shipyardLevel, isLocked, blueprint = null) {
    const identifier = blueprint ? blueprint.id : shipKey;
    const name = blueprint ? blueprint.name : ship.name;
    const count = currentShipyardData.ships[identifier] || 0; 
    const cost = calculateShipCostForDef(ship, 1);
    const buildTime = calculateShipBuildTimeForDef(ship, 1, shipyardLevel, currentShipyardData.naniteLevel || 0);
    
    const canBuild = !isLocked &&
                   planet.resources.metal >= cost.metal &&
                   planet.resources.crystal >= cost.crystal &&
                   planet.resources.deuterium >= cost.deuterium;

    return `
        <div class="ship-card ${isLocked ? 'locked' : ''} ${blueprint ? 'blueprint-card' : ''}">
            <div class="ship-header">
                <h5>${ship.icon} ${name}</h5>
                <span class="ship-count">${count}</span>
            </div>
            ${blueprint ? `<div class="blueprint-badge">Blueprint</div>` : ''}
            <p class="ship-description">${ship.description}</p>
            <div class="ship-stats">
                <div>⚔️ Atk: ${ship.attack}</div>
                <div>🛡️ Shd: ${ship.shield}</div>
                <div>❤️ Hul: ${ship.hull}</div>
                <div>🚀 Spd: ${formatNumber(ship.speed || 0)}</div>
                ${ship.cargoCapacity > 0 ? `<div>📦 Cgo: ${formatNumber(ship.cargoCapacity)}</div>` : ''}
            </div>
            <div class="ship-cost" id="cost-${identifier}">
                <div class="cost-metal">⚙️${formatNumber(cost.metal)}</div>
                <div class="cost-crystal">💎${formatNumber(cost.crystal)}</div>
                ${cost.deuterium > 0 ? `<div class="cost-deuterium">🛢️${formatNumber(cost.deuterium)}</div>` : ''}
            </div>
            <div class="build-time" id="time-${identifier}">🕐 ${formatCountdown(buildTime)}</div>
            ${isLocked ? `
                <div class="locked-message">🔒 Unlock at Shipyard Level ${shipyardLevel}</div>
            ` : `
                <input type="number" class="ship-quantity" id="qty-${identifier}" placeholder="Quantity" min="1" max="100" data-id="${identifier}">
                <button class="btn btn-sm ${canBuild ? 'btn-success' : ''}" 
                        id="btn-${identifier}"
                        ${!canBuild ? 'disabled' : ''} 
                        onclick="window.buildShip('${identifier}', '${name}')">
                    Build
                </button>
            `}
        </div>
    `;
}

function calculateShipCostForDef(shipDef, quantity) {
    return {
        metal: Math.floor(shipDef.baseCost.metal * quantity),
        crystal: Math.floor(shipDef.baseCost.crystal * quantity),
        deuterium: Math.floor(shipDef.baseCost.deuterium * quantity)
    };
}

function calculateShipBuildTimeForDef(shipDef, quantity, shipyardLevel, naniteLevel = 0) {
    const baseTime = calculateBaseTime(shipDef) * quantity;
    const speedFactor = 2500;
    const timeInSeconds = (baseTime / speedFactor) * 3600;
    const shipyardMultiplier = Math.pow(0.85, shipyardLevel);
    const naniteMultiplier = Math.pow(2, naniteLevel);
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
    return Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier / naniteMultiplier * configMultiplier));
}

/**
 * Render defenses list with foldable section
 */
function renderDefensesList(planet, shipyardData) {
    const { defenses, availableDefenses, shipyardLevel } = shipyardData;
    
    const minLevel = 1;
    const isCollapsed = collapsedSections['defenses'] || false;
    const isLocked = shipyardLevel < minLevel;
    
    let html = '<div class="shipyard-section">';
    html += `<div class="category-header" onclick="window.toggleCategory('defenses')">
        <span class="toggle-icon">${isCollapsed ? '▶️' : '▼️'}</span>
        <h3>🛡️ Planetary Defenses</h3>
        ${isLocked ? `<span class="lock-icon">🔒 Requires Level ${minLevel}</span>` : ''}
    </div>`;
    
    if (!isCollapsed) {
        html += '<div class="defenses-grid">';
        
        for (const defenseKey in availableDefenses) {
            const defense = availableDefenses[defenseKey];
            const count = defenses[defenseKey] || 0;
            const cost = calculateDefenseCost(defenseKey, 1);
            const buildTime = calculateDefenseBuildTime(defenseKey, 1, shipyardLevel, shipyardData.naniteLevel || 0);
            
            const canBuild = !isLocked &&
                           planet.resources.metal >= cost.metal &&
                           planet.resources.crystal >= cost.crystal &&
                           planet.resources.deuterium >= cost.deuterium;
            
            html += `
                <div class="defense-card ${isLocked ? 'locked' : ''}">
                    <div class="defense-header">
                        <h5>${defense.icon} ${defense.name}</h5>
                        <span class="defense-count">${count}</span>
                    </div>
                    <p class="defense-description">${defense.description}</p>
                    <div class="defense-stats">
                        <div>⚔️ Attack: ${defense.attack}</div>
                        <div>🛡️ Shield: ${defense.shield}</div>
                        <div>❤️ Hull: ${defense.hull}</div>
                    </div>
                    <div class="defense-cost" id="cost-${defenseKey}">
                        <div class="cost-metal">⚙️${formatNumber(cost.metal)}</div>
                        <div class="cost-crystal">💎${formatNumber(cost.crystal)}</div>
                        ${cost.deuterium > 0 ? `<div class="cost-deuterium">🛢️${formatNumber(cost.deuterium)}</div>` : ''}
                    </div>
                    <div class="build-time" id="time-${defenseKey}">🕐 ${formatCountdown(buildTime)}</div>
                    ${isLocked ? `
                        <div class="locked-message">🔒 Unlock at Shipyard Level ${minLevel}</div>
                    ` : `
                        <input type="number" class="defense-quantity" id="qty-${defenseKey}" placeholder="Quantity" min="1" max="100" data-id="${defenseKey}">
                        <button class="btn btn-sm ${canBuild ? 'btn-success' : ''}" 
                                id="btn-${defenseKey}"
                                ${!canBuild ? 'disabled' : ''} 
                                onclick="window.buildDefense('${defenseKey}', '${defense.name}')">
                            Build
                        </button>
                    `}
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * Render build queue
 */
function renderBuildQueue(shipyardData) {
    const allQueue = [...(shipyardData.shipQueue || []), ...(shipyardData.defenseQueue || [])];
    const availableShips = shipyardData.availableShips || {};
    const availableDefenses = shipyardData.availableDefenses || {};
    
    const isCollapsed = collapsedSections['queue'] || false;
    
    if (allQueue.length === 0) {
        return '<div class="shipyard-section"><p>No items in build queue</p></div>';
    }
    
    let html = '<div class="shipyard-section">';
    html += `<div class="category-header" onclick="window.toggleCategory('queue')">
        <span class="toggle-icon">${isCollapsed ? '▶️' : '▼️'}</span>
        <h3>📋 Build Queue</h3>
    </div>`;
    
    if (!isCollapsed) {
        html += '<div class="queue-items">';
        
        for (const item of allQueue) {
            const isActive = item.queuePosition === 1;
            const timeRemaining = Math.max(0, item.timeRemaining || 0) / 1000; // Convert to seconds
            
            let itemDetails = '';
            
            if (item.ships && !isEmpty(item.ships)) {
                const shipDetails = [];
                for (const key in item.ships) {
                    shipDetails.push(`${item.ships[key]}x ${availableShips[key]?.name || key}`);
                }
                itemDetails = shipDetails.join(', ');
            }
            
            if (item.defenses && !isEmpty(item.defenses)) {
                const defenseDetails = [];
                for (const key in item.defenses) {
                    defenseDetails.push(`${item.defenses[key]}x ${availableDefenses[key]?.name || key}`);
                }
                itemDetails = defenseDetails.join(', ');
            }
            
            html += `
                <div class="queue-item ${isActive ? 'active' : ''}">
                    <div class="queue-item-row">
                        <span class="q-pos">${item.queuePosition}.</span>
                        <span class="q-name">${itemDetails}</span>
                        <div class="progress-bar-mini">
                            <div class="progress-fill" id="build-progress-${item.queuePosition}" style="width: ${isActive ? Math.max(0, 100 - (timeRemaining / item.buildTime * 100)) : 0}%"></div>
                        </div>
                        <span class="q-time-mini ${isActive ? 'timer' : ''}" 
                              data-finish="${item.finishTime}" 
                              data-start="${item.startTime}" 
                              data-queue-pos="${item.queuePosition}">${isActive ? formatCountdown(timeRemaining) : 'Waiting'}</span>
                        <button class="btn-cancel-small" onclick="window.cancelShipyardBuild('${item.id}')">✕</button>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * Attach event listeners
 */
function attachShipyardListeners(planet, shipyardData) {
    window.buildShip = async function(shipKey, shipName) {
        const planetId = getCurrentPlanetId();
        if (!planetId) return;
        const input = document.getElementById(`qty-${shipKey}`);
        const qty = parseInt(input.value) || 0;
        
        if (qty <= 0) return;

        try {
            const response = await API.buildShips(planetId, { [shipKey]: qty });
            Notifications.showSuccess(`${qty}x ${shipName} added to build queue`);
            input.value = ''; // Clear field
            
            // Refresh shipyard view
            const activePlanet = (await API.getGameState()).planets.find(p => p.id === planetId);
            updateShipyardView(activePlanet, 'ships');
        } catch (error) {
            Notifications.showError(`Failed to build ship: ${error.message}`);
        }
    };
    
    window.buildDefense = async function(defenseKey, defenseName) {
        const planetId = getCurrentPlanetId();
        if (!planetId) return;
        const input = document.getElementById(`qty-${defenseKey}`);
        const qty = parseInt(input.value) || 0;
        
        if (qty <= 0) return;

        try {
            const response = await API.buildDefenses(planetId, { [defenseKey]: qty });
            Notifications.showSuccess(`${qty}x ${defenseName} added to build queue`);
            input.value = ''; // Clear field
            
            // Refresh shipyard view
            const activePlanet = (await API.getGameState()).planets.find(p => p.id === planetId);
            updateShipyardView(activePlanet, 'defenses');
        } catch (error) {
            Notifications.showError(`Failed to build defense: ${error.message}`);
        }
    };
    
    window.cancelShipyardBuild = async function(queueId) {
        const planetId = getCurrentPlanetId();
        if (!planetId) return;
        
        const confirmed = await showConfirm('Cancel Build', 'Cancel this production order? You will get 50% resources back.');
        if (!confirmed) return;

        try {
            const response = await API.cancelShipyardProduction(planetId, queueId);
            
            // Refresh shipyard view
            const activePlanet = (await API.getGameState()).planets.find(p => p.id === planetId);
            const currentSubView = document.getElementById('defenses-view')?.classList.contains('active') ? 'defenses' : 'ships';
            updateShipyardView(activePlanet, currentSubView);
        } catch (error) {
            Notifications.showError(`Failed to cancel build: ${error.message}`);
        }
    };
    
    window.toggleCategory = function(categoryId) {
        collapsedSections[categoryId] = !collapsedSections[categoryId];
        lastContentHash = null; // Force content re-render
        const subView = categoryId.startsWith('ships') ? 'ships' : 'defenses';
        updateShipyardView(planet, subView);
    };

    // Add input listeners for real-time cost updates
    const inputs = document.querySelectorAll('.ship-quantity, .defense-quantity');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const qty = parseInt(e.target.value) || 1;
            const id = e.target.dataset.id;
            const isShip = e.target.classList.contains('ship-quantity');
            updateProductionInfo(isShip ? 'ship' : 'defense', id, qty, planet);
        });
    });
}

/**
 * Update cost and time info based on quantity
 */
function updateProductionInfo(type, id, quantity, planet) {
    if (quantity < 1) quantity = 1;
    
    let cost, buildTime, def;
    
    if (type === 'ship') {
        // Find ship definition (base or blueprint)
        def = currentShipyardData.availableShips[id];
        if (!def && currentShipyardData.shipBlueprints) {
             for (const baseKey in currentShipyardData.shipBlueprints) {
                const blueprints = currentShipyardData.shipBlueprints[baseKey];
                const found = blueprints.find(b => b.id === id);
                if (found) {
                    def = found.customDefinition;
                    break;
                }
            }
        }
        
        if (!def) return;
        
        cost = calculateShipCostForDef(def, quantity);
        buildTime = calculateShipBuildTimeForDef(def, quantity, currentShipyardData.shipyardLevel, currentShipyardData.naniteLevel);
    } else {
        // Defense
        def = currentShipyardData.availableDefenses[id];
        if (!def) return;
        
        cost = {
            metal: Math.floor(def.baseCost.metal * quantity),
            crystal: Math.floor(def.baseCost.crystal * quantity),
            deuterium: Math.floor(def.baseCost.deuterium * quantity)
        };
        
        const baseTime = calculateBaseTime(def) * quantity;
        const speedFactor = CONFIG.DEFENSE_BUILD_SPEED || 2500;
        const timeInSeconds = (baseTime / speedFactor) * 3600;
        const shipyardMultiplier = Math.pow(BUILDING_SPEED_MULTIPLIER, currentShipyardData.shipyardLevel);
        const naniteMultiplier = Math.pow(2, currentShipyardData.naniteLevel || 0);
        const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
        
        buildTime = Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier / naniteMultiplier * configMultiplier));
    }
    
    // Update UI
    const costEl = document.getElementById(`cost-${id}`);
    const timeEl = document.getElementById(`time-${id}`);
    const btn = document.getElementById(`btn-${id}`);
    
    if (costEl) {
        costEl.innerHTML = `
            <div class="cost-metal">⚙️${formatNumber(cost.metal)}</div>
            <div class="cost-crystal">💎${formatNumber(cost.crystal)}</div>
            ${cost.deuterium > 0 ? `<div class="cost-deuterium">🛢️${formatNumber(cost.deuterium)}</div>` : ''}
        `;
    }
    
    if (timeEl) {
        timeEl.innerHTML = `🕐 ${formatCountdown(buildTime)}`;
    }
    
    if (btn) {
        const canAfford = planet.resources.metal >= cost.metal &&
                          planet.resources.crystal >= cost.crystal &&
                          planet.resources.deuterium >= cost.deuterium;
        
        btn.disabled = !canAfford;
        if (canAfford) {
            btn.classList.add('btn-success');
        } else {
            btn.classList.remove('btn-success');
        }
    }
}

/**
 * Calculate ship cost (client-side estimate)
 */
function calculateShipCost(shipKey, quantity) {
    const ship = currentShipyardData.availableShips[shipKey];
    if (!ship) return { metal: 0, crystal: 0, deuterium: 0 };
    
    return {
        metal: Math.floor(ship.baseCost.metal * quantity),
        crystal: Math.floor(ship.baseCost.crystal * quantity),
        deuterium: Math.floor(ship.baseCost.deuterium * quantity)
    };
}

/**
 * Calculate defense cost (client-side estimate)
 */
function calculateDefenseCost(defenseKey, quantity) {
    const defense = currentShipyardData.availableDefenses[defenseKey];
    if (!defense) return { metal: 0, crystal: 0, deuterium: 0 };
    
    return {
        metal: Math.floor(defense.baseCost.metal * quantity),
        crystal: Math.floor(defense.baseCost.crystal * quantity),
        deuterium: Math.floor(defense.baseCost.deuterium * quantity)
    };
}

/**
 * Calculate ship build time (client-side estimate)
 */
function calculateShipBuildTime(shipKey, quantity, shipyardLevel, naniteLevel = 0) {
    const ship = currentShipyardData.availableShips[shipKey];
    if (!ship) return 0;
    
    // Base time related to cost
    const baseTime = calculateBaseTime(ship) * quantity;
    
    // Apply build speed factor (converting cost units to seconds)
    const speedFactor = CONFIG.SHIP_BUILD_SPEED || 2500;
    const timeInSeconds = (baseTime / speedFactor) * 3600;

    // Shipyard level speeds up construction (20% per level, multiplier^n)
    const shipyardMultiplier = Math.pow(BUILDING_SPEED_MULTIPLIER, shipyardLevel);
    const naniteMultiplier = Math.pow(2, naniteLevel);
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
    
    return Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier / naniteMultiplier * configMultiplier));
}

/**
 * Calculate defense build time (client-side estimate)
 */
function calculateDefenseBuildTime(defenseKey, quantity, shipyardLevel = 1, naniteLevel = 0) {
    const defense = currentShipyardData.availableDefenses[defenseKey];
    if (!defense) return 0;
    
    // Base time related to cost
    const baseTime = calculateBaseTime(defense) * quantity;
    
    // Apply build speed factor (converting cost units to seconds)
    const speedFactor = CONFIG.DEFENSE_BUILD_SPEED || 2500;
    const timeInSeconds = (baseTime / speedFactor) * 3600;

    // Shipyard level speeds up construction (20% per level, multiplier^n)
    const shipyardMultiplier = Math.pow(BUILDING_SPEED_MULTIPLIER, shipyardLevel);
    const naniteMultiplier = Math.pow(2, naniteLevel);
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
    
    return Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier / naniteMultiplier * configMultiplier));
}
