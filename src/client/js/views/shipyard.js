// Shipyard view logic
import { API } from '../api.js';
import { formatNumber, formatCountdown } from '../utils.js';
import { RESOURCE_ICONS, BUILDING_SPEED_MULTIPLIER, CONFIG } from '../../../shared/constants.js';
import { BUILDINGS } from '../../../shared/buildings.js';
import { isEmpty } from '../../../shared/utils.js';
import { calculateBaseTime } from '../../../shared/time.js';
import { getCurrentPlanetId } from '../main.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';

import { renderDetailsModal, closeDetailsModal } from './details.js';
import { SHIPS } from '../../../shared/ships.js';
import { DEFENSES } from '../../../shared/defenses.js';

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
                <div class="shipyard-container">
                    <div class="shipyard-header">
                        <h3>⚙️ ${isDefenses ? 'Defenses' : 'Shipyard'} Level ${shipyardLevel}</h3>
                    </div>
                    <div class="shipyard-content">
                        <div class="shipyard-queue-container"></div>
                        <div class="shipyard-list-container"></div>
                    </div>
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
        
        html += `<div class="shipyard-section">
            <div class="queue-header" onclick="window.toggleCategory('ships-${category}')">
                <h3>${data.label}</h3>
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${isLocked ? `<span class="lock-icon">🔒 Level ${data.minLevel}</span>` : ''}
                    <span class="toggle-icon">${isCollapsed ? '▶️' : '▼️'}</span>
                </div>
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
        <div class="research-card ${isLocked ? 'locked' : ''} ${blueprint ? 'custom-active' : ''}" id="variant-${identifier}">
            <div class="card-corner-top"></div>
            <div class="card-header" title="${ship.description}">
                <div class="header-main">
                    <div class="title-row">
                        <span class="name">${ship.icon} ${name}</span>
                    </div>
                    <div class="blueprint-row">
                        <span class="level-indicator">${count} IN DOCK</span>
                    </div>
                </div>
                <div class="header-actions">
                    <button class="btn-info" onclick="window.showShipDetails('${shipKey}', '${identifier}')" title="Technical Data">ℹ️</button>
                </div>
            </div>
            <div class="card-body">
                <div class="diagnostic-section">
                    <div class="section-tag">Specifications</div>
                    <div class="ship-stats-grid">
                        <div class="stat-item"><span class="stat-label">ATTACK</span><span class="stat-val">${ship.attack}</span></div>
                        <div class="stat-item"><span class="stat-label">SHIELD</span><span class="stat-val">${ship.shield}</span></div>
                        <div class="stat-item"><span class="stat-label">HULL</span><span class="stat-val">${ship.hull}</span></div>
                        <div class="stat-item"><span class="stat-label">SPEED</span><span class="stat-val">${formatNumber(ship.speed || 0)}</span></div>
                    </div>
                </div>
                
                <div class="diagnostic-section">
                    <div class="section-tag">Requisition</div>
                    <div class="tech-costs" id="cost-${identifier}">
                        <div class="cost-item">⚙️ ${formatNumber(cost.metal)}</div>
                        <div class="cost-item">💎 ${formatNumber(cost.crystal)}</div>
                        ${cost.deuterium > 0 ? `<div class="cost-item">🛢️ ${formatNumber(cost.deuterium)}</div>` : ''}
                    </div>
                    <div class="build-time" id="time-${identifier}" style="margin-top: 8px; font-size: 0.75rem;">🕐 ${formatCountdown(buildTime)}</div>
                </div>
            </div>
            <div class="building-actions">
                ${isLocked ? `
                    <div class="locked-message" style="width: 100%; text-align: center; font-family: 'Share Tech Mono', monospace; font-size: 0.7rem; color: var(--accent-red); padding: 10px;">
                        LOCKED: SHIPYARD LVL ${shipyardLevel}
                    </div>
                ` : `
                    <div class="action-group" style="width: 100%; height: 38px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <input type="text" inputmode="numeric" pattern="[0-9]*" class="ship-quantity" id="qty-${identifier}" placeholder="QTY" min="1" max="100" data-id="${identifier}" 
                               style="flex: 0 0 100px; background: rgba(0,0,0,0.3); border: none; border-right: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0 10px; font-family: 'Share Tech Mono', monospace; font-size: 0.85rem; text-align: center; height: 100%;">
                        <button class="btn upgrade-btn" 
                                style="flex: 1; padding: 0 !important; font-size: 0.75rem !important; height: 100%; border: none !important; border-radius: 0 !important; background: rgba(56, 189, 248, 0.08) !important;"
                                id="btn-${identifier}"
                                ${!canBuild ? 'disabled' : ''} 
                                onclick="window.buildShip('${identifier}', '${name}')">
                            CONSTRUCT
                        </button>
                    </div>
                `}
            </div>
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
    
    // Use configurable speedMultiplier from building definition
    const shipyardDef = BUILDINGS.shipyard;
    const shipyardSpeedMultiplier = shipyardDef.speedMultiplier || 0.85;
    const shipyardMultiplier = Math.pow(shipyardSpeedMultiplier, shipyardLevel);
    
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
    html += `<div class="queue-header" onclick="window.toggleCategory('defenses')">
        <h3>🛡️ Planetary Defenses</h3>
        <div style="display: flex; gap: 10px; align-items: center;">
            ${isLocked ? `<span class="lock-icon">🔒 Level ${minLevel}</span>` : ''}
            <span class="toggle-icon">${isCollapsed ? '▶️' : '▼️'}</span>
        </div>
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
                <div class="research-card ${isLocked ? 'locked' : ''}" id="variant-${defenseKey}">
                    <div class="card-corner-top"></div>
                    <div class="card-header" title="${defense.description}">
                        <div class="header-main">
                            <div class="title-row">
                                <span class="name">${defense.icon} ${defense.name}</span>
                            </div>
                            <div class="blueprint-row">
                                <span class="level-indicator">${count} ACTIVE</span>
                            </div>
                        </div>
                        <div class="header-actions">
                            <button class="btn-info" onclick="window.showDefenseDetails('${defenseKey}')" title="Technical Data">ℹ️</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="diagnostic-section">
                            <div class="section-tag">Specifications</div>
                            <div class="ship-stats-grid">
                                <div class="stat-item"><span class="stat-label">ATTACK</span><span class="stat-val">${defense.attack}</span></div>
                                <div class="stat-item"><span class="stat-label">SHIELD</span><span class="stat-val">${defense.shield}</span></div>
                                <div class="stat-item"><span class="stat-label">HULL</span><span class="stat-val">${defense.hull}</span></div>
                            </div>
                        </div>
                        
                        <div class="diagnostic-section">
                            <div class="section-tag">Requisition</div>
                            <div class="tech-costs" id="cost-${defenseKey}">
                                <div class="cost-item">⚙️ ${formatNumber(cost.metal)}</div>
                                <div class="cost-item">💎 ${formatNumber(cost.crystal)}</div>
                                ${cost.deuterium > 0 ? `<div class="cost-item">🛢️ ${formatNumber(cost.deuterium)}</div>` : ''}
                            </div>
                            <div class="build-time" id="time-${defenseKey}" style="margin-top: 8px; font-size: 0.75rem;">🕐 ${formatCountdown(buildTime)}</div>
                        </div>
                    </div>
                    <div class="building-actions">
                        ${isLocked ? `
                            <div class="locked-message" style="width: 100%; text-align: center; font-family: 'Share Tech Mono', monospace; font-size: 0.7rem; color: var(--accent-red); padding: 10px;">
                                LOCKED: SHIPYARD LVL ${minLevel}
                            </div>
                        ` : `
                            <div class="action-group" style="width: 100%; height: 38px; border-top: 1px solid rgba(255,255,255,0.1);">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" class="defense-quantity" id="qty-${defenseKey}" placeholder="QTY" min="1" max="100" data-id="${defenseKey}"
                                       style="flex: 0 0 100px; background: rgba(0,0,0,0.3); border: none; border-right: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0 10px; font-family: 'Share Tech Mono', monospace; font-size: 0.85rem; text-align: center; height: 100%;">
                                <button class="btn upgrade-btn" 
                                        style="flex: 1; padding: 0 !important; font-size: 0.75rem !important; height: 100%; border: none !important; border-radius: 0 !important; background: rgba(56, 189, 248, 0.08) !important;"
                                        id="btn-${defenseKey}"
                                        ${!canBuild ? 'disabled' : ''} 
                                        onclick="window.buildDefense('${defenseKey}', '${defense.name}')">
                                    DEPLOY
                                </button>
                            </div>
                        `}
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
    html += `<div class="queue-header" onclick="window.toggleCategory('queue')">
        <h3>📋 Build Queue</h3>
        <span class="toggle-icon">${isCollapsed ? '▶️' : '▼️'}</span>
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
        
        // Use configurable speedMultiplier from building definition
        const shipyardDef = BUILDINGS.shipyard;
        const shipyardSpeedMultiplier = shipyardDef.speedMultiplier || 0.85;
        const shipyardMultiplier = Math.pow(shipyardSpeedMultiplier, currentShipyardData.shipyardLevel);
        
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
            <div class="cost-item">⚙️ ${formatNumber(cost.metal)}</div>
            <div class="cost-item">💎 ${formatNumber(cost.crystal)}</div>
            ${cost.deuterium > 0 ? `<div class="cost-item">🛢️ ${formatNumber(cost.deuterium)}</div>` : ''}
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

    // Shipyard level speeds up construction (multiplier^n)
    const shipyardDef = BUILDINGS.shipyard;
    const shipyardSpeedMultiplier = shipyardDef.speedMultiplier || 0.85;
    const shipyardMultiplier = Math.pow(shipyardSpeedMultiplier, shipyardLevel);
    
    const naniteMultiplier = Math.pow(2, naniteLevel);
        const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
    
        return Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier / naniteMultiplier * configMultiplier));
    }
    
    /**
     * Show ship details modal
     */
    window.showShipDetails = function(shipKey, identifier) {
        // Find ship definition (base or blueprint)
        let ship = currentShipyardData.availableShips[shipKey];
        let name = ship?.name || shipKey;
        
        // Check if it's a blueprint
        if (currentShipyardData.shipBlueprints && currentShipyardData.shipBlueprints[shipKey]) {
            const found = currentShipyardData.shipBlueprints[shipKey].find(b => b.id === identifier);
            if (found) {
                ship = found.customDefinition;
                name = found.name;
            }
        }
        
        if (!ship) return;
    
            const stats = [
                { label: 'Attack Power', value: ship.attack, icon: '⚔️' },
                { label: 'Shield Strength', value: ship.shield, icon: '🛡️' },
                { label: 'Hull Integrity', value: ship.hull, icon: '❤️' },
                { label: 'Engine Speed', value: formatNumber(ship.speed), icon: '🚀' },
                { label: 'Cargo Capacity', value: formatNumber(ship.cargoCapacity), icon: '📦' },
                { label: 'Fuel Consumption', value: ship.fuel, icon: '🛢️' },
                { label: 'Crew Required', value: ship.populationRequired, icon: '👥' }
            ];    
        // Rapid Fire AGAINST others
        const rapidFireAgainst = [];
        if (ship.rapidFire) {
            for (const target in ship.rapidFire) {
                const targetName = SHIPS[target]?.name || DEFENSES[target]?.name || target;
                rapidFireAgainst.push({ label: targetName, value: ship.rapidFire[target] });
            }
        }
    
        // Rapid Fire FROM others
        const rapidFireFrom = [];
        // Search all ships
        for (const key in SHIPS) {
            if (SHIPS[key].rapidFire && SHIPS[key].rapidFire[shipKey]) {
                rapidFireFrom.push({ label: SHIPS[key].name, value: SHIPS[key].rapidFire[shipKey] });
            }
        }
        // Search all defenses
        for (const key in DEFENSES) {
            if (DEFENSES[key].rapidFire && DEFENSES[key].rapidFire[shipKey]) {
                rapidFireFrom.push({ label: DEFENSES[key].name, value: DEFENSES[key].rapidFire[shipKey] });
            }
        }
    
        let sections = [];
        
        if (rapidFireAgainst.length > 0) {
            sections.push({
                title: 'Offensive Systems (Rapid Fire)',
                table: {
                    headers: ['Target Unit', 'Multiplier'],
                    rows: rapidFireAgainst.map(rf => [rf.label, `x${rf.value}`])
                }
            });
        }
    
        if (rapidFireFrom.length > 0) {
            sections.push({
                title: 'Defensive Vulnerabilities',
                table: {
                    headers: ['Attacking Unit', 'Vulnerability'],
                    rows: rapidFireFrom.map(rf => [rf.label, `x${rf.value}`])
                }
            });
        }
    
        renderDetailsModal({
            title: `${ship.icon} ${name}`,
            description: ship.description,
            effects: stats,
            sections: sections
        });
    };
    
    /**
     * Show defense details modal
     */
    window.showDefenseDetails = function(defenseKey) {
        const defense = currentShipyardData.availableDefenses[defenseKey];
        if (!defense) return;
    
        const stats = [
            { label: 'Attack Power', value: defense.attack, icon: '⚔️' },
            { label: 'Shield Strength', value: defense.shield, icon: '🛡️' },
            { label: 'Hull Integrity', value: defense.hull, icon: '❤️' }
        ];
    
        // Rapid Fire AGAINST others
        const rapidFireAgainst = [];
        if (defense.rapidFire) {
            for (const target in defense.rapidFire) {
                const targetName = SHIPS[target]?.name || DEFENSES[target]?.name || target;
                rapidFireAgainst.push({ label: targetName, value: defense.rapidFire[target] });
            }
        }
    
        // Rapid Fire FROM others
        const rapidFireFrom = [];
        // Search all ships
        for (const key in SHIPS) {
            if (SHIPS[key].rapidFire && SHIPS[key].rapidFire[defenseKey]) {
                rapidFireFrom.push({ label: SHIPS[key].name, value: SHIPS[key].rapidFire[defenseKey] });
            }
        }
        // Search all defenses
        for (const key in DEFENSES) {
            if (DEFENSES[key].rapidFire && DEFENSES[key].rapidFire[defenseKey]) {
                rapidFireFrom.push({ label: DEFENSES[key].name, value: DEFENSES[key].rapidFire[defenseKey] });
            }
        }
    
        let sections = [];
        
        if (rapidFireAgainst.length > 0) {
            sections.push({
                title: 'Offensive Systems (Rapid Fire)',
                table: {
                    headers: ['Target Unit', 'Multiplier'],
                    rows: rapidFireAgainst.map(rf => [rf.label, `x${rf.value}`])
                }
            });
        }
    
        if (rapidFireFrom.length > 0) {
            sections.push({
                title: 'Vulnerability Analysis',
                table: {
                    headers: ['Attacking Unit', 'Vulnerability'],
                    rows: rapidFireFrom.map(rf => [rf.label, `x${rf.value}`])
                }
            });
        }
    
        renderDetailsModal({
            title: `${defense.icon} ${defense.name}`,
            description: defense.description,
            effects: stats,
            sections: sections
        });
    };/**
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

    // Shipyard level speeds up construction (multiplier^n)
    const shipyardDef = BUILDINGS.shipyard;
    const shipyardSpeedMultiplier = shipyardDef.speedMultiplier || 0.85;
    const shipyardMultiplier = Math.pow(shipyardSpeedMultiplier, shipyardLevel);
    
    const naniteMultiplier = Math.pow(2, naniteLevel);
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
    
    return Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier / naniteMultiplier * configMultiplier));
}
