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
let lastShipyardStateHash = null;

/**
 * Calculate a hash of the shipyard state to detect changes
 */
function calculateShipyardStateHash(shipyardData, planet) {
    const state = {
        planetId: planet.id,
        ships: shipyardData.ships,
        queue: shipyardData.queue,
        shipyardLevel: shipyardData.shipyardLevel,
        resources: planet.resources
    };
    return JSON.stringify(state);
}

/**
 * Update shipyard view with planet data
 */
export async function updateShipyardView(planet) {
    try {
        const shipyardData = await API.getShipyardDetails(planet.id);
        
        // Check if state has changed
        const currentHash = calculateShipyardStateHash(shipyardData, planet);
        if (currentHash === lastShipyardStateHash) {
            // State hasn't changed, skip re-render
            return;
        }
        lastShipyardStateHash = currentHash;
        
        currentShipyardData = shipyardData;
        
        const container = document.getElementById('shipyard-view');
        
        // Shipyard header
        const shipyardLevel = shipyardData.shipyardLevel || 0;
        const shipyardHeader = `
            <div class="shipyard-header">
                <h3>⚙️ Shipyard Level ${shipyardLevel}</h3>
                ${shipyardLevel < 12 ? `
                    <p>Upgrade to Level ${shipyardLevel + 1} to improve production speed and unlock ships</p>
                ` : '<p>Maximum level reached</p>'}
            </div>
        `;
        
        // Ships section
        const shipsHtml = renderShipsList(planet, shipyardData);
        
        // Defenses section
        const defensesHtml = renderDefensesList(planet, shipyardData);
        
        // Queue section
        const queueHtml = renderBuildQueue(shipyardData);
        
        container.innerHTML = `
            ${shipyardHeader}
            <div class="shipyard-content">
                ${shipsHtml}
                ${defensesHtml}
                ${queueHtml}
            </div>
        `;
        
        // Add event listeners
        attachShipyardListeners(planet, shipyardData);
        
    } catch (error) {
        console.error('Failed to load shipyard details:', error);
        document.getElementById('shipyard-view').innerHTML = `<p class="error">Failed to load shipyard: ${error.message}</p>`;
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
    
    let html = '<div class="shipyard-section">';
    html += '<h3>🛰️ Ships</h3>';
    
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
                const ship = data.ships[shipKey];
                const count = ships[shipKey] || 0;
                const cost = calculateShipCost(shipKey, 1);
                const buildTime = calculateShipBuildTime(shipKey, 1, shipyardLevel);
                
                const canBuild = !isLocked &&
                               planet.resources.metal >= cost.metal &&
                               planet.resources.crystal >= cost.crystal &&
                               planet.resources.deuterium >= cost.deuterium;
                
                html += `
                    <div class="ship-card ${isLocked ? 'locked' : ''}">
                        <div class="ship-header">
                            <h5>${ship.icon} ${ship.name}</h5>
                            <span class="ship-count">${count}</span>
                        </div>
                        <p class="ship-description">${ship.description}</p>
                        <div class="ship-stats">
                            <div>⚔️ Attack: ${ship.attack}</div>
                            <div>🛡️ Shield: ${ship.shield}</div>
                            <div>❤️ Hull: ${ship.hull}</div>
                            <div>🚀 Speed: ${formatNumber(ship.effectiveSpeed)}</div>
                            ${ship.cargoCapacity > 0 ? `<div>📦 Cargo: ${formatNumber(ship.cargoCapacity)}</div>` : ''}
                        </div>
                        <div class="ship-cost">
                            <div>⚙️${formatNumber(cost.metal)}</div>
                            <div>💎${formatNumber(cost.crystal)}</div>
                            ${cost.deuterium > 0 ? `<div>🛢️${formatNumber(cost.deuterium)}</div>` : ''}
                        </div>
                        <div class="build-time">🕐 ${formatCountdown(buildTime)}</div>
                        ${isLocked ? `
                            <div class="locked-message">🔒 Unlock at Shipyard Level ${data.minLevel}</div>
                        ` : `
                            <input type="number" class="ship-quantity" id="qty-${shipKey}" value="1" min="1" max="100">
                            <button class="btn btn-sm ${canBuild ? 'btn-success' : ''}" 
                                    ${!canBuild ? 'disabled' : ''} 
                                    onclick="window.buildShip('${shipKey}')">
                                Build
                            </button>
                        `}
                    </div>
                `;
            }
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
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
            const buildTime = calculateDefenseBuildTime(defenseKey, 1, shipyardLevel);
            
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
                    <div class="defense-cost">
                        <div>⚙️${formatNumber(cost.metal)}</div>
                        <div>💎${formatNumber(cost.crystal)}</div>
                        ${cost.deuterium > 0 ? `<div>🛢️${formatNumber(cost.deuterium)}</div>` : ''}
                    </div>
                    <div class="build-time">🕐 ${formatCountdown(buildTime)}</div>
                    ${isLocked ? `
                        <div class="locked-message">🔒 Unlock at Shipyard Level ${minLevel}</div>
                    ` : `
                        <input type="number" class="defense-quantity" id="qty-${defenseKey}" value="1" min="1" max="100">
                        <button class="btn btn-sm ${canBuild ? 'btn-success' : ''}" 
                                ${!canBuild ? 'disabled' : ''} 
                                onclick="window.buildDefense('${defenseKey}')">
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
                            <div class="progress-fill" style="width: ${isActive ? Math.max(0, 100 - (timeRemaining / item.buildTime * 100)) : 0}%"></div>
                        </div>
                        <span class="q-time-mini">${isActive ? formatCountdown(timeRemaining) : 'Waiting'}</span>
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
    window.buildShip = async function(shipKey) {
        const planetId = getCurrentPlanetId();
        if (!planetId) return;
        const qty = parseInt(document.getElementById(`qty-${shipKey}`).value) || 1;
        
        try {
            const response = await API.buildShips(planetId, { [shipKey]: qty });
            console.log('Ship build queued:', response);
            
            // Refresh shipyard view
            const activePlanet = (await API.getGameState()).planets.find(p => p.id === planetId);
            updateShipyardView(activePlanet);
        } catch (error) {
            Notifications.showError(`Failed to build ship: ${error.message}`);
        }
    };
    
    window.buildDefense = async function(defenseKey) {
        const planetId = getCurrentPlanetId();
        if (!planetId) return;
        const qty = parseInt(document.getElementById(`qty-${defenseKey}`).value) || 1;
        
        try {
            const response = await API.buildDefenses(planetId, { [defenseKey]: qty });
            console.log('Defense build queued:', response);
            
            // Refresh shipyard view
            const activePlanet = (await API.getGameState()).planets.find(p => p.id === planetId);
            updateShipyardView(activePlanet);
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
            console.log('Build cancelled:', response);
            
            // Refresh shipyard view
            const activePlanet = (await API.getGameState()).planets.find(p => p.id === planetId);
            updateShipyardView(activePlanet);
        } catch (error) {
            Notifications.showError(`Failed to cancel build: ${error.message}`);
        }
    };
    
    window.toggleCategory = function(categoryId) {
        collapsedSections[categoryId] = !collapsedSections[categoryId];
        updateShipyardView(planet);
    };
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
function calculateShipBuildTime(shipKey, quantity, shipyardLevel) {
    const ship = currentShipyardData.availableShips[shipKey];
    if (!ship) return 0;
    
    // Base time related to cost
    const baseTime = calculateBaseTime(ship) * quantity;
    
    // Apply build speed factor (converting cost units to seconds)
    const speedFactor = CONFIG.SHIP_BUILD_SPEED || 2500;
    const timeInSeconds = (baseTime / speedFactor) * 3600;

    // Shipyard level speeds up construction (20% per level, multiplier^n)
    const shipyardMultiplier = Math.pow(BUILDING_SPEED_MULTIPLIER, shipyardLevel);
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
    
    return Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier * configMultiplier));
}

/**
 * Calculate defense build time (client-side estimate)
 */
function calculateDefenseBuildTime(defenseKey, quantity, shipyardLevel = 1) {
    const defense = currentShipyardData.availableDefenses[defenseKey];
    if (!defense) return 0;
    
    // Base time related to cost
    const baseTime = calculateBaseTime(defense) * quantity;
    
    // Apply build speed factor (converting cost units to seconds)
    const speedFactor = CONFIG.DEFENSE_BUILD_SPEED || 2500;
    const timeInSeconds = (baseTime / speedFactor) * 3600;

    // Shipyard level speeds up construction (20% per level, multiplier^n)
    const shipyardMultiplier = Math.pow(BUILDING_SPEED_MULTIPLIER, shipyardLevel);
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.shipBuildTime || 1.0;
    
    return Math.max(1, Math.floor(timeInSeconds * shipyardMultiplier * configMultiplier));
}
