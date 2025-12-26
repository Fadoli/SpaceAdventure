// Shipyard view logic
import { API } from '../api.js';
import { formatNumber, formatCountdown } from '../utils.js';
import { RESOURCE_ICONS } from '../../../shared/constants.js';

let currentShipyardData = null;
let currentPlanetId = null;

/**
 * Update shipyard view with planet data
 */
export async function updateShipyardView(planet) {
    currentPlanetId = planet.id;
    
    try {
        const shipyardData = await API.getShipyardDetails(planet.id);
        currentShipyardData = shipyardData;
        
        const container = document.getElementById('shipyard-view');
        
        // Shipyard header
        const shipyardLevel = shipyardData.shipyardLevel || 0;
        const shipyardHeader = `
            <div class="shipyard-header">
                <h3>⚙️ Shipyard Level ${shipyardLevel}</h3>
                ${shipyardLevel < 12 ? `
                    <p>Upgrade to Level ${shipyardLevel + 1} to improve production speed</p>
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
 * Render ships list
 */
function renderShipsList(planet, shipyardData) {
    const { ships, availableShips } = shipyardData;
    
    const shipCategories = {
        civilian: { label: '📦 Civilian Ships', ships: {} },
        military: { label: '⚔️ Military Ships', ships: {} }
    };
    
    // Organize ships by category
    for (const [shipKey, ship] of Object.entries(availableShips)) {
        const category = ship.type;
        if (shipCategories[category]) {
            shipCategories[category].ships[shipKey] = ship;
        }
    }
    
    let html = '<div class="shipyard-section">';
    html += '<h3>🛰️ Ships</h3>';
    
    for (const [category, data] of Object.entries(shipCategories)) {
        if (Object.keys(data.ships).length === 0) continue;
        
        html += `<div class="ships-category">
            <h4>${data.label}</h4>
            <div class="ships-grid">`;
        
        for (const [shipKey, ship] of Object.entries(data.ships)) {
            const count = ships[shipKey] || 0;
            const cost = calculateShipCost(shipKey, 1, shipyardData.shipyardLevel);
            const buildTime = calculateShipBuildTime(shipKey, 1, shipyardData.shipyardLevel);
            
            const canBuild = planet.resources.metal >= cost.metal &&
                           planet.resources.crystal >= cost.crystal &&
                           planet.resources.deuterium >= cost.deuterium;
            
            html += `
                <div class="ship-card">
                    <div class="ship-header">
                        <h5>${ship.icon} ${ship.name}</h5>
                        <span class="ship-count">${count}</span>
                    </div>
                    <p class="ship-description">${ship.description}</p>
                    <div class="ship-stats">
                        <div>⚔️ Attack: ${ship.attack}</div>
                        <div>🛡️ Shield: ${ship.shield}</div>
                        <div>❤️ Hull: ${ship.hull}</div>
                        ${ship.cargoCapacity > 0 ? `<div>📦 Cargo: ${formatNumber(ship.cargoCapacity)}</div>` : ''}
                    </div>
                    <div class="ship-cost">
                        <div>⚙️${formatNumber(cost.metal)}</div>
                        <div>💎${formatNumber(cost.crystal)}</div>
                        ${cost.deuterium > 0 ? `<div>🛢️${formatNumber(cost.deuterium)}</div>` : ''}
                    </div>
                    <div class="build-time">🕐 ${formatCountdown(buildTime)}</div>
                    <input type="number" class="ship-quantity" id="qty-${shipKey}" value="1" min="1" max="100">
                    <button class="btn btn-sm ${canBuild ? 'btn-success' : ''}" 
                            ${!canBuild ? 'disabled' : ''} 
                            onclick="window.buildShip('${shipKey}')">
                        Build
                    </button>
                </div>
            `;
        }
        
        html += '</div></div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * Render defenses list
 */
function renderDefensesList(planet, shipyardData) {
    const { defenses, availableDefenses } = shipyardData;
    
    let html = '<div class="shipyard-section">';
    html += '<h3>🛡️ Planetary Defenses</h3>';
    html += '<div class="defenses-grid">';
    
    for (const [defenseKey, defense] of Object.entries(availableDefenses)) {
        const count = defenses[defenseKey] || 0;
        const cost = calculateDefenseCost(defenseKey, 1);
        const buildTime = calculateDefenseBuildTime(defenseKey, 1);
        
        const canBuild = planet.resources.metal >= cost.metal &&
                       planet.resources.crystal >= cost.crystal &&
                       planet.resources.deuterium >= cost.deuterium;
        
        html += `
            <div class="defense-card">
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
                <input type="number" class="defense-quantity" id="qty-${defenseKey}" value="1" min="1" max="100">
                <button class="btn btn-sm ${canBuild ? 'btn-success' : ''}" 
                        ${!canBuild ? 'disabled' : ''} 
                        onclick="window.buildDefense('${defenseKey}')">
                    Build
                </button>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}

/**
 * Render build queue
 */
function renderBuildQueue(shipyardData) {
    const allQueue = [...(shipyardData.shipQueue || []), ...(shipyardData.defenseQueue || [])];
    const availableShips = shipyardData.availableShips || {};
    const availableDefenses = shipyardData.availableDefenses || {};
    
    if (allQueue.length === 0) {
        return '<div class="shipyard-section"><p>No items in build queue</p></div>';
    }
    
    let html = '<div class="shipyard-section">';
    html += '<h3>📋 Build Queue</h3>';
    html += '<div class="queue-items">';
    
    for (const item of allQueue) {
        const isActive = item.queuePosition === 1;
        const timeRemaining = Math.max(0, item.timeRemaining || 0) / 1000; // Convert to seconds
        
        let itemName = '';
        let itemDetails = '';
        
        if (item.ships && Object.keys(item.ships).length > 0) {
            itemDetails = Object.entries(item.ships)
                .map(([key, qty]) => `${qty}x ${availableShips[key]?.name || key}`)
                .join(', ');
        }
        
        if (item.defenses && Object.keys(item.defenses).length > 0) {
            itemDetails = Object.entries(item.defenses)
                .map(([key, qty]) => `${qty}x ${availableDefenses[key]?.name || key}`)
                .join(', ');
        }
        
        html += `
            <div class="queue-item ${isActive ? 'active' : ''}">
                <div class="queue-position">${item.queuePosition}</div>
                <div class="queue-content">
                    <div class="queue-name">${itemDetails}</div>
                    <div class="queue-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${isActive ? Math.max(0, 100 - (timeRemaining / item.buildTime * 100)) : 0}%"></div>
                        </div>
                    </div>
                </div>
                <div class="queue-time">
                    ${isActive ? `⏳ ${formatCountdown(timeRemaining)}` : '⏳ Waiting'}
                </div>
                <button class="btn btn-danger btn-sm" onclick="window.cancelShipyardBuild('${item.id}')">✕</button>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}

/**
 * Attach event listeners
 */
function attachShipyardListeners(planet, shipyardData) {
    window.buildShip = async function(shipKey) {
        const qty = parseInt(document.getElementById(`qty-${shipKey}`).value) || 1;
        
        try {
            const response = await API.buildShips(planet.id, { [shipKey]: qty });
            console.log('Ship build queued:', response);
            
            // Refresh shipyard view
            updateShipyardView(planet);
        } catch (error) {
            alert(`Failed to build ship: ${error.message}`);
        }
    };
    
    window.buildDefense = async function(defenseKey) {
        const qty = parseInt(document.getElementById(`qty-${defenseKey}`).value) || 1;
        
        try {
            const response = await API.buildDefenses(planet.id, { [defenseKey]: qty });
            console.log('Defense build queued:', response);
            
            // Refresh shipyard view
            updateShipyardView(planet);
        } catch (error) {
            alert(`Failed to build defense: ${error.message}`);
        }
    };
    
    window.cancelShipyardBuild = async function(queueId) {
        try {
            const response = await API.cancelShipyardProduction(planet.id, queueId);
            console.log('Build cancelled:', response);
            
            // Refresh shipyard view
            updateShipyardView(planet);
        } catch (error) {
            alert(`Failed to cancel build: ${error.message}`);
        }
    };
}

/**
 * Calculate ship cost (client-side estimate)
 */
function calculateShipCost(shipKey, quantity, shipyardLevel) {
    const ship = currentShipyardData.availableShips[shipKey];
    if (!ship) return { metal: 0, crystal: 0, deuterium: 0 };
    
    const levelMultiplier = Math.pow(1.05, shipyardLevel - 1);
    
    return {
        metal: Math.floor(ship.baseCost.metal * quantity * levelMultiplier),
        crystal: Math.floor(ship.baseCost.crystal * quantity * levelMultiplier),
        deuterium: Math.floor(ship.baseCost.deuterium * quantity * levelMultiplier)
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
    
    let baseTime = ship.buildTime * quantity * Math.pow(1.1, quantity - 1);
    const shipyardMultiplier = 1 / (1 + (shipyardLevel * 0.05));
    
    return Math.floor(baseTime * shipyardMultiplier);
}

/**
 * Calculate defense build time (client-side estimate)
 */
function calculateDefenseBuildTime(defenseKey, quantity) {
    const defense = currentShipyardData.availableDefenses[defenseKey];
    if (!defense) return 0;
    
    let baseTime = defense.buildTime * quantity * Math.pow(1.05, quantity - 1);
    
    return Math.floor(baseTime);
}
