// Shipyard view logic
import { API } from '../api.js';
import { escapeHtml, formatNumber, formatCountdown, formatDuration, parseNumberShorthand } from '../utils.js';
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
export async function updateShipyardView(planet, subView = 'ships', force = false) {
    try {
        const containerId = subView === 'defenses' ? 'defenses-view' : 'shipyard-view';
        const container = document.getElementById(containerId);
        if (!container) return;

        // Fetch data early so it's available for hashes
        const shipyardData = await API.getShipyardDetails(planet.id);
        currentShipyardData = shipyardData;

        const structuralHash = calculateStructuralHash(shipyardData, planet, subView);

        // 1. Initialize structural layout if needed
        if (force || structuralHash !== lastStructuralHash || !container.querySelector('.shipyard-content')) {
            const shipyardLevel = shipyardData.shipyardLevel || 0;
            const isDefenses = subView === 'defenses';
            
            container.innerHTML = `
                <div class="shipyard-container">
                    <div class="view-header-technical">
                        <h2 id="shipyard-title-lvl">${isDefenses ? 'DEFENSIVE BATTERIES' : 'SHIPYARD OPERATIONS'} <span style="font-size: 0.8rem; opacity: 0.6; margin-left: 10px;">LVL ${shipyardLevel}</span></h2>
                        <div class="header-line"></div>
                    </div>
                    <div class="shipyard-content">
                        <div class="shipyard-queue-container"></div>
                        <div class="shipyard-list-container"></div>
                    </div>
                </div>
            `;
            
            const shipyardContent = container.querySelector('.shipyard-content');
            const listContainer = shipyardContent.querySelector('.shipyard-list-container');
            listContainer.innerHTML = isDefenses 
                ? renderDefensesList(planet, shipyardData)
                : renderShipsList(planet, shipyardData);
            
            lastStructuralHash = structuralHash;
            lastContentHash = calculateContentHash(shipyardData);
            attachShipyardListeners(planet, shipyardData);
        }

        const shipyardContent = container.querySelector('.shipyard-content');
        const queueContainer = shipyardContent.querySelector('.shipyard-queue-container');

        // 2. Update Dynamic Content (Queue and Units)
        const contentHash = calculateContentHash(currentShipyardData);
        if (force || contentHash !== lastContentHash) {
            // Update Queue (ALWAYS ON TOP)
            const queueHtml = renderBuildQueue(currentShipyardData);
            if (queueContainer.innerHTML !== queueHtml) queueContainer.innerHTML = queueHtml;
            
            // Update Unit Counts and dynamic data in cards
            updateUnitCardsGranular(planet, currentShipyardData, subView);
            lastContentHash = contentHash;
        } else {
            // Nothing structurally or content-wise changed, just update resource affordance
            updateUnitCardsGranular(planet, currentShipyardData, subView);
        }
        
    } catch (error) {
        console.error('Failed to load shipyard details:', error);
        const containerId = subView === 'defenses' ? 'defenses-view' : 'shipyard-view';
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = `<p class="error">Failed to load shipyard: ${escapeHtml(error.message)}</p>`;
    }
}

/**
 * Granularly update ship/defense cards without full re-render
 */
function updateUnitCardsGranular(planet, shipyardData, subView) {
    const isDefenses = subView === 'defenses';
    const units = isDefenses ? shipyardData.defenses : shipyardData.ships;
    const available = isDefenses ? shipyardData.availableDefenses : shipyardData.availableShips;
    
    // Update shipyard title level if needed
    const titleEl = document.getElementById('shipyard-title-lvl');
    if (titleEl) {
        const titleText = isDefenses ? 'DEFENSIVE BATTERIES' : 'SHIPYARD OPERATIONS';
        const expectedHtml = `${titleText} <span style="font-size: 0.8rem; opacity: 0.6; margin-left: 10px;">LVL ${shipyardData.shipyardLevel}</span>`;
        if (titleEl.innerHTML !== expectedHtml) titleEl.innerHTML = expectedHtml;
    }

    for (const key in available) {
        const count = units[key] || 0;
        const card = document.getElementById(`variant-${key}`);
        if (!card) continue;

        // Update In-Dock / Active count
        const levelIndicator = card.querySelector('.level-indicator');
        if (levelIndicator) {
            const countText = `${count} ${isDefenses ? 'ACTIVE' : 'IN DOCK'}`;
            if (levelIndicator.textContent !== countText) levelIndicator.textContent = countText;
        }

        // Update affordance/costs based on current input quantity
        const qtyInput = document.getElementById(`qty-${key}`);
        const quantity = qtyInput ? (parseNumberShorthand(qtyInput.value) || 1) : 1;
        
        const cost = isDefenses ? calculateDefenseCost(key, quantity) : calculateShipCostForDef(available[key], quantity);
        const canAfford = planet.resources.metal >= cost.metal &&
                         planet.resources.crystal >= cost.crystal &&
                         planet.resources.deuterium >= cost.deuterium;
        
        const costEl = document.getElementById(`cost-${key}`);
        if (costEl) {
            const metalItem = costEl.querySelector('.cost-item:nth-child(1)');
            const crystalItem = costEl.querySelector('.cost-item:nth-child(2)');
            const deutItem = costEl.querySelector('.cost-item:nth-child(3)');
            
            if (metalItem) {
                const metalClass = `cost-item ${planet.resources.metal < cost.metal ? 'text-danger' : ''}`;
                if (metalItem.className !== metalClass) metalItem.className = metalClass;
                // Update the text to reflect the total cost for current quantity
                const metalText = `⚙️ ${formatNumber(cost.metal)}`;
                if (metalItem.textContent !== metalText) metalItem.textContent = metalText;
            }
            if (crystalItem) {
                const crystalClass = `cost-item ${planet.resources.crystal < cost.crystal ? 'text-danger' : ''}`;
                if (crystalItem.className !== crystalClass) crystalItem.className = crystalClass;
                const crystalText = `💎 ${formatNumber(cost.crystal)}`;
                if (crystalItem.textContent !== crystalText) crystalItem.textContent = crystalText;
            }
            if (deutItem) {
                const deutClass = `cost-item ${planet.resources.deuterium < cost.deuterium ? 'text-danger' : ''}`;
                if (deutItem.className !== deutClass) deutItem.className = deutClass;
                const deutText = `🛢️ ${formatNumber(cost.deuterium)}`;
                if (deutItem.textContent !== deutText) deutItem.textContent = deutText;
            }
        }

        // Update build time for the quantity
        const timeEl = document.getElementById(`time-${key}`);
        if (timeEl) {
            const buildTime = isDefenses 
                ? calculateDefenseBuildTime(key, quantity, shipyardData.shipyardLevel, shipyardData.naniteLevel)
                : calculateShipBuildTimeForDef(available[key], quantity, shipyardData.shipyardLevel, shipyardData.naniteLevel);
            const timeText = `🕐 ${formatDuration(buildTime * 1000)}`;
            if (timeEl.textContent !== timeText) timeEl.textContent = timeText;
        }
        
        const btn = document.getElementById(`btn-${key}`);
        if (btn) {
            const minLevel = isDefenses ? 1 : (available[key].type === 'military' ? 2 : 1);
            const isDisabled = !canAfford || shipyardData.shipyardLevel < minLevel;
            if (btn.disabled !== isDisabled) btn.disabled = isDisabled;
            
            if (!isDisabled) {
                if (!btn.classList.contains('btn-success')) btn.classList.add('btn-success');
            } else {
                btn.classList.remove('btn-success');
            }
        }
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
        const shipCount = Object.keys(data.ships).length;
        if (shipCount === 0) continue;
        
        const isCollapsed = collapsedSections[`ships-${category}`] || false;
        const isLocked = shipyardLevel < data.minLevel;
        
        html += `<div class="shipyard-section">
            <div class="category-header-technical" onclick="window.toggleCategory('ships-${category}')" style="cursor: pointer; margin-bottom: 15px;">
                <h3>${data.label.toUpperCase()} DIVISION</h3>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span class="category-stats-tag">${shipCount} UNIT MODELS AVAILABLE</span>
                    ${isLocked ? `<span class="lock-icon" style="font-size: 0.7rem; color: var(--accent-red);">🔒 LVL ${data.minLevel}</span>` : ''}
                    <span class="toggle-icon">${isCollapsed ? '▶️' : '▼️'}</span>
                </div>
            </div>`;
        
        if (!isCollapsed) {
            html += '<div class="ships-grid">';
            for (const shipKey in data.ships) {
                const baseShip = data.ships[shipKey];
                html += renderShipCard(planet, shipKey, baseShip, shipyardLevel, isLocked);
            }
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function renderShipCard(planet, shipKey, ship, shipyardLevel, isLocked) {
    const count = currentShipyardData.ships[shipKey] || 0; 
    const cost = calculateShipCostForDef(ship, 1);
    const buildTime = calculateShipBuildTimeForDef(ship, 1, shipyardLevel, currentShipyardData.naniteLevel || 0);
    
    const canBuild = !isLocked &&
                   planet.resources.metal >= cost.metal &&
                   planet.resources.crystal >= cost.crystal &&
                   planet.resources.deuterium >= cost.deuterium;

    return `
        <div class="research-card ${isLocked ? 'locked' : ''}" id="variant-${shipKey}">
            <div class="card-corner-top"></div>
            <div class="card-header" title="${ship.description}">
                <div class="header-main">
                    <div class="title-row">
                        <span class="name">${ship.icon} ${ship.name}</span>
                    </div>
                    <div class="blueprint-row">
                        <span class="level-indicator">${count} IN DOCK</span>
                    </div>
                </div>
                <div class="header-actions">
                    <button class="btn-info" onclick="window.showShipDetails('${shipKey}')" title="Technical Data">ℹ️</button>
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
                        <div class="stat-item"><span class="stat-label">DRIVE</span><span class="stat-val">${(ship.driveType || 'Unknown').toUpperCase()}</span></div>
                    </div>
                </div>
                
                <div class="diagnostic-section">
                    <div class="section-tag">Requisition</div>
                    <div class="tech-costs" id="cost-${shipKey}">
                        <div class="cost-item">⚙️ ${formatNumber(cost.metal)}</div>
                        <div class="cost-item">💎 ${formatNumber(cost.crystal)}</div>
                        ${cost.deuterium > 0 ? `<div class="cost-item">🛢️ ${formatNumber(cost.deuterium)}</div>` : ''}
                    </div>
                    <div class="build-time" id="time-${shipKey}" style="margin-top: 8px; font-size: 0.75rem;">🕐 ${formatDuration(buildTime * 1000)}</div>
                </div>
            </div>
            <div class="building-actions">
                ${isLocked ? `
                    <div class="locked-message">
                        LOCKED: SHIPYARD LVL ${shipyardLevel}
                    </div>
                ` : `
                    <div class="action-group">
                        <input type="text" inputmode="numeric" pattern="[0-9kmKMB tqTQ.]*" class="ship-quantity" id="qty-${shipKey}" placeholder="QTY (e.g. 5m)" data-id="${shipKey}">
                        <button class="btn upgrade-btn" 
                                id="btn-${shipKey}"
                                ${!canBuild ? 'disabled' : ''} 
                                onclick="window.buildShip('${shipKey}', '${ship.name}')">
                            BUILD
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
    const defenseCount = Object.keys(availableDefenses).length;
    
    let html = '<div class="shipyard-section">';
    html += `<div class="category-header-technical" onclick="window.toggleCategory('defenses')" style="cursor: pointer; margin-bottom: 15px;">
        <h3>🛡️ PLANETARY DEFENSE NETWORK</h3>
        <div style="display: flex; gap: 10px; align-items: center;">
            <span class="category-stats-tag">${defenseCount} DEFENSE MODELS AVAILABLE</span>
            ${isLocked ? `<span class="lock-icon" style="font-size: 0.7rem; color: var(--accent-red);">🔒 LVL ${minLevel}</span>` : ''}
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
                            <div class="build-time" id="time-${defenseKey}" style="margin-top: 8px; font-size: 0.75rem;">🕐 ${formatDuration(buildTime * 1000)}</div>
                        </div>
                    </div>
                    <div class="building-actions">
                        ${isLocked ? `
                            <div class="locked-message">
                                LOCKED: SHIPYARD LVL ${minLevel}
                            </div>
                        ` : `
                            <div class="action-group">
                                <input type="text" inputmode="numeric" pattern="[0-9kmKMB tqTQ.]*" class="defense-quantity" id="qty-${defenseKey}" placeholder="QTY (e.g. 5m)" data-id="${defenseKey}">
                                <button class="btn upgrade-btn" 
                                        id="btn-${defenseKey}"
                                        ${!canBuild ? 'disabled' : ''} 
                                        onclick="window.buildDefense('${defenseKey}', '${defense.name}')">
                                    BUILD
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
        return '<div class="shipyard-section"><p style="padding: 15px; opacity: 0.5; font-family: \'Share Tech Mono\', monospace;">NO ACTIVE PRODUCTION ORDERS</p></div>';
    }
    
    let html = '<div class="shipyard-section" style="margin-bottom: 30px;">';
    html += '<div class="card-corner-top"></div>';
    html += `<div class="queue-header" onclick="window.toggleCategory('queue')" style="background: rgba(251, 191, 36, 0.03); border-bottom: 1px solid rgba(251, 191, 36, 0.1);">
        <h3 style="color: var(--accent-yellow);">🔨 PRODUCTION LOG</h3>
        <span class="toggle-icon" style="color: var(--accent-yellow);">${isCollapsed ? '▶️' : '▼️'}</span>
    </div>`;
    
    if (!isCollapsed) {
        html += '<div class="queue-items">';
        
        for (const item of allQueue) {
            const index = allQueue.indexOf(item);
            const isActive = index === 0;
            const timeRemaining = Math.max(0, item.timeRemaining || 0) / 1000; // Convert to seconds
            
            const posLabel = index === 0 ? 'ACTUAL' : (index === 1 ? 'NEXT' : `#${index + 1}`);

            let itemDetails = '';
            
            if (item.ships && !isEmpty(item.ships)) {
                const shipDetails = [];
                for (const key in item.ships) {
                    shipDetails.push(`${formatNumber(item.ships[key])}x ${availableShips[key]?.name || key}`);
                }
                itemDetails = shipDetails.join(', ');
            }
            
            if (item.defenses && !isEmpty(item.defenses)) {
                const defenseDetails = [];
                for (const key in item.defenses) {
                    defenseDetails.push(`${formatNumber(item.defenses[key])}x ${availableDefenses[key]?.name || key}`);
                }
                itemDetails = defenseDetails.join(', ');
            }
            
            html += `
                <div class="queue-item ${isActive ? 'active' : ''}">
                    <div class="queue-item-row">
                        <span class="q-pos" style="width: 60px;">${posLabel}</span>
                        <span class="q-name">${itemDetails}</span>
                        <div class="progress-bar-mini">
                            <div class="progress-fill" id="build-progress-${item.queuePosition}" style="width: ${isActive ? Math.max(0, 100 - (timeRemaining / item.buildTime * 100)) : 0}%"></div>
                        </div>
                        <span class="q-time-mini ${isActive ? 'timer' : ''}" 
                              data-finish="${item.finishTime}" 
                              data-start="${item.startTime}" 
                              data-queue-pos="${item.queuePosition}">${isActive ? formatCountdown(timeRemaining) : 'Waiting'}</span>
                        <button class="btn-cancel-small" onclick="window.cancelShipyardBuild('${item.id}')" title="Terminate Order">✕</button>
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
        const qty = parseNumberShorthand(input.value);
        
        if (qty <= 0) return;

        try {
            const response = await API.buildShips(planetId, { [shipKey]: qty });
            Notifications.showSuccess(`${formatNumber(qty)}x ${shipName} added to build queue`);
            input.value = ''; // Clear field
        } catch (error) {
            Notifications.showError(`Failed to build ship: ${error.message}`);
        }
    };
    
    window.buildDefense = async function(defenseKey, defenseName) {
        const planetId = getCurrentPlanetId();
        if (!planetId) return;
        const input = document.getElementById(`qty-${defenseKey}`);
        const qty = parseNumberShorthand(input.value);
        
        if (qty <= 0) return;

        try {
            const response = await API.buildDefenses(planetId, { [defenseKey]: qty });
            Notifications.showSuccess(`${formatNumber(qty)}x ${defenseName} added to build queue`);
            input.value = ''; // Clear field
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
        } catch (error) {
            Notifications.showError(`Failed to cancel build: ${error.message}`);
        }
    };
    
    window.toggleCategory = function(categoryId) {
        collapsedSections[categoryId] = !collapsedSections[categoryId];
        lastContentHash = null; // Force content re-render
        
        // Find current subview based on DOM visibility
        const isDefenses = !!document.getElementById('defenses-view')?.classList.contains('active');
        const subView = isDefenses ? 'defenses' : 'ships';
        
        const planetId = getCurrentPlanetId();
        const gameState = window.getGameState();
        const currentPlanet = gameState?.planets.find(p => p.id === planetId);
        
        if (currentPlanet) {
            updateShipyardView(currentPlanet, subView);
        }
    };

    // Add input listeners for real-time cost updates
    const inputs = document.querySelectorAll('.ship-quantity, .defense-quantity');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const qty = parseNumberShorthand(e.target.value) || 1;
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
        def = currentShipyardData.availableShips[id];
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
            <div class="cost-item ${planet.resources.metal < cost.metal ? 'text-danger' : ''}">⚙️ ${formatNumber(cost.metal)}</div>
            <div class="cost-item ${planet.resources.crystal < cost.crystal ? 'text-danger' : ''}">💎 ${formatNumber(cost.crystal)}</div>
            ${cost.deuterium > 0 ? `<div class="cost-item ${planet.resources.deuterium < cost.deuterium ? 'text-danger' : ''}">🛢️ ${formatNumber(cost.deuterium)}</div>` : ''}
        `;
    }
    
    if (timeEl) {
        timeEl.innerHTML = `🕐 ${formatDuration(buildTime * 1000)}`;
    }
    
    if (btn) {
        const canAfford = planet.resources.metal >= cost.metal &&
                          planet.resources.crystal >= cost.crystal &&
                          planet.resources.deuterium >= cost.deuterium;
        
        const minLevel = type === 'ship' ? (def.type === 'military' ? 2 : 1) : 1;
        const isDisabled = !canAfford || currentShipyardData.shipyardLevel < minLevel;
        
        if (btn.disabled !== isDisabled) btn.disabled = isDisabled;
        if (!isDisabled) {
            if (!btn.classList.contains('btn-success')) btn.classList.add('btn-success');
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
    window.showShipDetails = function(shipKey) {
        const ship = currentShipyardData.availableShips[shipKey];
        if (!ship) return;
    
            const stats = [
                { label: 'Attack Power', value: ship.attack, icon: '⚔️' },
                { label: 'Shield Strength', value: ship.shield, icon: '🛡️' },
                { label: 'Hull Integrity', value: ship.hull, icon: '❤️' },
                { label: 'Engine Speed', value: formatNumber(ship.speed), icon: '🚀' },
                { label: 'Drive Type', value: (ship.driveType || 'Unknown').toUpperCase(), icon: '⚙️' },
                { label: 'Cargo Capacity', value: formatNumber(ship.cargoCapacity), icon: '📦' },
                { label: 'Fuel Consumption', value: ship.fuel, icon: '🛢️' },
                { label: 'Crew Required', value: ship.populationRequired, icon: '👥' }
            ];    
            // Rapid Fire AGAINST others (Offensive)
            const rapidFireAgainst = [];
            const rfSource = ship.rapidFire || SHIPS[shipKey]?.rapidFire || {};
            for (const target in rfSource) {
                const targetName = SHIPS[target]?.name || DEFENSES[target]?.name || target;
                rapidFireAgainst.push({ label: targetName.toUpperCase(), value: rfSource[target] });
            }
        
            // Rapid Fire FROM others (Defensive Vulnerabilities)
            const rapidFireFrom = [];
            // Search all base ships
            for (const key in SHIPS) {
                if (SHIPS[key].rapidFire && SHIPS[key].rapidFire[shipKey]) {
                    rapidFireFrom.push({ label: SHIPS[key].name.toUpperCase(), value: SHIPS[key].rapidFire[shipKey] });
                }
            }
            // Search all base defenses
            for (const key in DEFENSES) {
                if (DEFENSES[key].rapidFire && DEFENSES[key].rapidFire[shipKey]) {
                    rapidFireFrom.push({ label: DEFENSES[key].name.toUpperCase(), value: DEFENSES[key].rapidFire[shipKey] });
                }
            }
        
            let sections = [];
            
            if (rapidFireAgainst.length > 0) {
                sections.push({
                    title: 'Weapon Systems: Rapid Fire Capability',
                    table: {
                        headers: ['Target Unit', 'Shots/Round'],
                        rows: rapidFireAgainst.map(rf => [rf.label, `x${rf.value}`])
                    }
                });
            }
        
            if (rapidFireFrom.length > 0) {
                sections.push({
                    title: 'Tactical Analysis: Identified Vulnerabilities',
                    table: {
                        headers: ['Hostile Unit', 'Threat Level'],
                        rows: rapidFireFrom.map(rf => [rf.label, `x${rf.value}`])
                    }
                });
            }    
            renderDetailsModal({
                title: `${ship.icon} ${ship.name}`,
                description: ship.description,
                detailedDescription: ship.detailedDescription,
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
            const rfSource = defense.rapidFire || DEFENSES[defenseKey]?.rapidFire || {};
            for (const target in rfSource) {
                const targetName = SHIPS[target]?.name || DEFENSES[target]?.name || target;
                rapidFireAgainst.push({ label: targetName.toUpperCase(), value: rfSource[target] });
            }
        
            // Rapid Fire FROM others
            const rapidFireFrom = [];
            // Search all ships
            for (const key in SHIPS) {
                if (SHIPS[key].rapidFire && SHIPS[key].rapidFire[defenseKey]) {
                    rapidFireFrom.push({ label: SHIPS[key].name.toUpperCase(), value: SHIPS[key].rapidFire[defenseKey] });
                }
            }
            // Search all defenses
            for (const key in DEFENSES) {
                if (DEFENSES[key].rapidFire && DEFENSES[key].rapidFire[defenseKey]) {
                    rapidFireFrom.push({ label: DEFENSES[key].name.toUpperCase(), value: DEFENSES[key].rapidFire[defenseKey] });
                }
            }
        
            let sections = [];
            
            if (rapidFireAgainst.length > 0) {
                sections.push({
                    title: 'Weapon Systems: Rapid Fire Capability',
                    table: {
                        headers: ['Target Unit', 'Shots/Round'],
                        rows: rapidFireAgainst.map(rf => [rf.label, `x${rf.value}`])
                    }
                });
            }
        
            if (rapidFireFrom.length > 0) {
                sections.push({
                    title: 'Tactical Analysis: Identified Vulnerabilities',
                    table: {
                        headers: ['Hostile Unit', 'Threat Level'],
                        rows: rapidFireFrom.map(rf => [rf.label, `x${rf.value}`])
                    }
                });
            }    
            renderDetailsModal({
                title: `${defense.icon} ${defense.name}`,
                description: defense.description,
                detailedDescription: defense.detailedDescription,
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
