// Galaxy view logic
import { API } from '../api.js';
import { formatNumber } from '../utils.js';
import { showConfirm, showPrompt } from './modals.js';
import { Notifications } from '../notifications.js';
import { SHIPS, calculateFleetFuelCost, calculateFleetSurvivalNeeds, calculateCargoCapacity } from '../../../shared/ships.js';
import { calculateDistance } from '../../../shared/formulas.js';
import { SCALING, MISSION_TYPES } from '../../../shared/constants.js';
import { setupModalCloseHandlers } from './details.js';

let currentGalaxy = 1;
let currentSystem = 1;
let currentGameState = null;
let lastRenderedGalaxy = null;
let lastRenderedSystem = null;

/**
 * Open a generic mission modal
 */
async function openMissionModal(missionType, targetCoords) {
    const planetId = window.getCurrentPlanetId();
    const planet = window.getCurrentPlanet();
    
    if (!planet) {
        Notifications.showError('No origin planet selected');
        return;
    }

    // Check if planet has any ships
    const hasShips = Object.values(planet.ships || {}).some(count => count > 0);
    if (!hasShips) {
        Notifications.showError('No ships available on this planet');
        return;
    }

    // Create modal for ship and resource selection
    const modal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('details-modal-title');
    const modalBody = document.getElementById('details-modal-body');

    const typeLabel = missionType.charAt(0).toUpperCase() + missionType.slice(1);
    modalTitle.innerHTML = `🚀 ${typeLabel} Mission [${targetCoords.join(':')}]`;
    
    let html = '<div class="expedition-ship-selection">';
    
    // --- Ship Selection Section ---
    html += '<div class="mission-section">';
    html += '<h4>🚢 Select Ships</h4>';
    html += '<div class="expedition-ships-list">';
    
    for (const [shipKey, count] of Object.entries(planet.ships)) {
        if (count > 0) {
            const shipName = shipKey.replace(/([A-Z])/g, ' $1').trim();
            html += `
                <div class="expedition-ship-item">
                    <div class="ship-info">
                        <span class="ship-name">${shipName}</span>
                        <span class="ship-available">(Avail: ${formatNumber(count)})</span>
                    </div>
                    <div class="ship-input">
                        <input type="number" class="exp-qty-input ship-qty-input" data-ship="${shipKey}" min="0" max="${count}" value="0">
                        <button class="btn-max" onclick="this.previousElementSibling.value=${count}; window.updateMissionCalculations();">MAX</button>
                    </div>
                </div>
            `;
        }
    }
    html += '</div></div>';

    // --- Resource Selection Section (Only for transport or if ships have cargo) ---
    if (missionType === MISSION_TYPES.TRANSPORT || missionType === MISSION_TYPES.DEPLOY) {
        html += '<div class="mission-section" style="margin-top: 20px;">';
        html += '<h4>📦 Select Resources</h4>';
        html += '<div id="cargo-status" style="margin-bottom: 10px; font-weight: bold; color: var(--accent-blue);">Cargo: 0 / 0</div>';
        html += '<div class="mission-resources-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';
        
        const resourceKeys = ['metal', 'crystal', 'deuterium', 'water', 'food'];
        for (const res of resourceKeys) {
            const amount = Math.floor(planet.resources[res] || 0);
            const resIcon = { metal: '⚙️', crystal: '💎', deuterium: '🛢️', water: '💦', food: '🍞' }[res];
            html += `
                <div class="mission-res-item" style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="font-size: 0.85rem; margin-bottom: 5px;">${resIcon} ${res.charAt(0).toUpperCase() + res.slice(1)}: ${formatNumber(amount)}</div>
                    <div style="display: flex; gap: 5px;">
                        <input type="number" class="exp-qty-input res-qty-input" data-res="${res}" min="0" max="${amount}" value="0" style="flex: 1;">
                        <button class="btn-max" style="padding: 2px 6px; font-size: 0.7rem;" onclick="window.maxResource('${res}', ${amount})">MAX</button>
                    </div>
                </div>
            `;
        }
        html += '</div></div>';
    }

    // --- Summary & Action Section ---
    html += `
        <div id="mission-calc-summary" style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px solid var(--border-color);">
            <!-- Stats like travel time, fuel, crew, etc will be shown here -->
        </div>
        
        <div class="modal-footer" style="margin-top: 20px;">
            <button class="btn btn-secondary" onclick="window.closeDetailsModal()">Cancel</button>
            <button class="btn btn-primary" onclick="window.submitMission()">Launch Fleet</button>
        </div>
    </div>`;

    modalBody.innerHTML = html;
    modal.style.display = 'block';
    setupModalCloseHandlers(modal);

    // Global helpers for this modal
    window.maxResource = function(res, maxAmount) {
        const inputs = document.querySelectorAll('.res-qty-input');
        const input = Array.from(inputs).find(i => i.dataset.res === res);
        if (input) {
            // We need to check remaining cargo capacity
            const currentTotal = Array.from(inputs)
                .filter(i => i.dataset.res !== res)
                .reduce((sum, i) => sum + (parseInt(i.value) || 0), 0);
            
            const currentShips = {};
            document.querySelectorAll('.ship-qty-input').forEach(i => {
                const qty = parseInt(i.value) || 0;
                if (qty > 0) currentShips[i.dataset.ship] = qty;
            });
            
            const totalCapacity = calculateCargoCapacity(currentShips);
            const remaining = Math.max(0, totalCapacity - currentTotal);
            
            input.value = Math.min(maxAmount, remaining);
            window.updateMissionCalculations();
        }
    };

    window.updateMissionCalculations = function() {
        const shipsToSend = {};
        let totalCrew = 0;
        
        document.querySelectorAll('.ship-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                const shipKey = input.dataset.ship;
                shipsToSend[shipKey] = qty;
                const shipDef = SHIPS[shipKey];
                if (shipDef) totalCrew += (shipDef.populationRequired || 0) * qty;
            }
        });

        const cargoCapacity = calculateCargoCapacity(shipsToSend);
        
        const resourcesToSend = {};
        let totalCargo = 0;
        document.querySelectorAll('.res-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                resourcesToSend[input.dataset.res] = qty;
                totalCargo += qty;
            }
        });

        const cargoStatus = document.getElementById('cargo-status');
        if (cargoStatus) {
            cargoStatus.innerHTML = `Cargo: ${formatNumber(totalCargo)} / ${formatNumber(cargoCapacity)}`;
            cargoStatus.style.color = totalCargo > cargoCapacity ? 'var(--accent-red)' : 'var(--accent-blue)';
        }

        // Stats
        const distance = calculateDistance(planet.coordinates, targetCoords);
        const fuelCost = calculateFleetFuelCost(shipsToSend, distance);
        
        // Simplified travel time (300s each way for now)
        const travelTimeSeconds = 300; 
        const totalDurationSeconds = travelTimeSeconds * 2;
        const survivalNeeds = calculateFleetSurvivalNeeds(totalCrew, totalDurationSeconds);

        const summary = document.getElementById('mission-calc-summary');
        if (summary) {
            summary.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem;">
                    <div>👥 Crew: <strong>${totalCrew}</strong></div>
                    <div>🛢️ Fuel: <strong>${formatNumber(fuelCost)}</strong></div>
                    <div>🍞 Food: <strong>${formatNumber(survivalNeeds.food)}</strong></div>
                    <div>💦 Water: <strong>${formatNumber(survivalNeeds.water)}</strong></div>
                </div>
            `;
        }
    };

    window.submitMission = async function() {
        const shipsToSend = {};
        let totalShips = 0;
        document.querySelectorAll('.ship-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                shipsToSend[input.dataset.ship] = qty;
                totalShips += qty;
            }
        });

        if (totalShips === 0) {
            Notifications.showError('No ships selected');
            return;
        }

        const resourcesToSend = {};
        let totalCargo = 0;
        document.querySelectorAll('.res-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                resourcesToSend[input.dataset.res] = qty;
                totalCargo += qty;
            }
        });

        const cargoCapacity = calculateCargoCapacity(shipsToSend);
        if (totalCargo > cargoCapacity) {
            Notifications.showError('Cargo exceeds fleet capacity');
            return;
        }

        try {
            const response = await fetch('/api/game/galaxy/mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    missionType,
                    targetCoords,
                    ships: shipsToSend,
                    resources: resourcesToSend,
                    originPlanetId: planet.id
                })
            });

            const result = await response.json();
            if (result.success) {
                Notifications.showSuccess(`${typeLabel} fleet launched!`);
                window.closeDetailsModal();
                if (window.loadGameState) await window.loadGameState();
            } else {
                Notifications.showError(`Failed: ${result.error}`);
            }
        } catch (error) {
            Notifications.showError(`Error: ${error.message}`);
        }
    };

    // Listeners
    document.querySelectorAll('.ship-qty-input, .res-qty-input').forEach(el => {
        el.addEventListener('input', window.updateMissionCalculations);
    });

    window.updateMissionCalculations();
}

window.transportToPlanetFromGalaxy = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    openMissionModal(MISSION_TYPES.TRANSPORT, coords);
};

window.deployToPlanetFromGalaxy = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    openMissionModal(MISSION_TYPES.DEPLOY, coords);
};

/**
 * Update galaxy view with current system data
 */
export async function updateGalaxyView(gameState) {
    const container = document.getElementById('galaxy-view');
    
    if (!gameState?.planets || gameState.planets.length === 0) {
        container.innerHTML = '<p>No planets available</p>';
        return;
    }
    
    currentGameState = gameState;
    
    // Get the first planet's galaxy and system coordinates
    const firstPlanet = gameState.planets[0];
    const [galaxy, system] = firstPlanet.coordinates;
    
    currentGalaxy = galaxy;
    currentSystem = system;
    
    // Only render if not already viewing this system
    if (lastRenderedGalaxy !== galaxy || lastRenderedSystem !== system) {
        await loadAndRenderGalaxy(container, galaxy, system, gameState);
    }
}

/**
 * Load and render a specific galaxy/system
 */
async function loadAndRenderGalaxy(container, galaxy, system, gameState) {
    try {
        const galaxyData = await API.getGalaxyView(galaxy, system);
        renderOGameGalaxyTable(container, galaxyData, gameState, galaxy, system);
        lastRenderedGalaxy = galaxy;
        lastRenderedSystem = system;
    } catch (error) {
        console.error('Failed to load galaxy view:', error);
        container.innerHTML = `<p class="error">Failed to load galaxy: ${error.message}</p>`;
    }
}

/**
 * Render OGame-style table galaxy view
 */
function renderOGameGalaxyTable(container, galaxyData, gameState, galaxy, system) {
    const { planets } = galaxyData;
    
    // Create a map of planets by position for quick lookup
    const planetMap = new Map();
    planets.forEach(p => planetMap.set(p.position, p));
    
    // Create a set of player planet positions
    const playerPlanetPositions = new Set();
    if (gameState?.planets) {
        gameState.planets.forEach(planet => {
            const [pGalaxy, pSystem, pPosition] = planet.coordinates;
            if (pGalaxy === galaxy && pSystem === system) {
                playerPlanetPositions.add(pPosition);
            }
        });
    }
    
    let html = `
        <div class="ogame-galaxy-view">
            <div class="galaxy-controls">
                <div class="nav-section">
                    <button class="nav-btn" onclick="window.navigateGalaxySystem(${galaxy}, ${system - 1})" ${system === 1 ? 'disabled' : ''}>← Previous Sector</button>
                    <span class="current-coords">Galaxy ${galaxy} : System ${system}</span>
                    <button class="nav-btn" onclick="window.navigateGalaxySystem(${galaxy}, ${system + 1})">Next Sector →</button>
                </div>
                
                <div class="quick-travel">
                    <div class="travel-input-group">
                        <label>Galaxy:</label>
                        <button class="travel-btn-decrease" onclick="window.changeGalaxyValue(-1)" title="Decrease galaxy">−</button>
                        <input type="number" id="galaxy-input" class="travel-input-field" min="1" max="10" value="${galaxy}" 
                               onchange="window.navigateToGalaxy(this.value)" onkeypress="if(event.key==='Enter') window.navigateToGalaxy(this.value)">
                        <button class="travel-btn-increase" onclick="window.changeGalaxyValue(1)" title="Increase galaxy">+</button>
                    </div>
                    <div class="travel-input-group">
                        <label>System:</label>
                        <button class="travel-btn-decrease" onclick="window.changeSystemValue(-1)" title="Decrease system">−</button>
                        <input type="number" id="system-input" class="travel-input-field" min="1" max="499" value="${system}"
                               onchange="window.navigateToSystem(this.value)" onkeypress="if(event.key==='Enter') window.navigateToSystem(this.value)">
                        <button class="travel-btn-increase" onclick="window.changeSystemValue(1)" title="Increase system">+</button>
                    </div>
                </div>
            </div>
            
            <div class="ogame-table-wrapper">
                <table class="ogame-system-table">
                    <thead>
                        <tr>
                            <th class="pos-col">Pos</th>
                            <th class="planet-col">Planet</th>
                            <th class="player-col">Player</th>
                            <th class="status-col">Status</th>
                            <th class="action-col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Generate table rows for all 15 positions
    for (let position = 1; position <= 15; position++) {
        const planet = planetMap.get(position);
        const isPlayerPlanet = playerPlanetPositions.has(position);
        
        if (planet) {
            html += renderOGameTableRow(planet, position, isPlayerPlanet);
        } else {
            html += renderOGameEmptyRow(position);
        }
    }

    // Add Position 16 for Expedition
    html += renderExpeditionRow(16);
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Store references for navigation functions
    window.currentGalaxy = galaxy;
    window.currentSystem = system;
    window.currentGameState = gameState;
}

/**
 * Render a table row for an occupied planet
 */
function renderOGameTableRow(planet, position, isPlayerPlanet) {
    const moonBadge = planet.moon ? '<span class="moon-badge">🌙</span>' : '';
    const playerIcon = planet.playerType === 'player' ? '👨‍💼' : '🤖';
    const rowClass = isPlayerPlanet ? 'my-planet-row' : '';
    const planetTypeClass = planet.playerType === 'player' ? 'player-planet-row' : 'ai-planet-row';
    
    // Check if this is the currently active planet
    const currentPlanet = window.getCurrentPlanet();
    const isCurrentPlanet = currentPlanet && 
                           currentPlanet.coordinates[0] === window.currentGalaxy && 
                           currentPlanet.coordinates[1] === window.currentSystem && 
                           currentPlanet.coordinates[2] === position;

    return `
        <tr class="planet-row ${rowClass} ${planetTypeClass}">
            <td class="pos-col"><strong>${position}</strong></td>
            <td class="planet-col">
                <div class="planet-name-cell">
                    <div class="planet-icon-mini">🌍</div>
                    <div class="planet-details">
                        <div class="planet-name">${planet.planetName}</div>
                        <div class="planet-activity">Last: ${planet.activity}</div>
                    </div>
                    ${moonBadge}
                </div>
            </td>
            <td class="player-col">
                <div class="player-info">
                    ${playerIcon}
                    <span>${planet.player}</span>
                </div>
            </td>
            <td class="status-col">
                <span class="status-badge ${isPlayerPlanet ? 'status-own' : 'status-other'}">
                    ${isPlayerPlanet ? (isCurrentPlanet ? '🏠 Current' : '🏠 Own') : '👾 Other'}
                </span>
            </td>
            <td class="action-col">
                <div class="action-buttons">
                    ${isPlayerPlanet ? `
                        <button class="action-btn view-btn" onclick="window.selectPlanetFromGalaxy('${planet.player}')" title="View planet">👁️</button>
                        <button class="action-btn transport-btn" onclick="window.transportToPlanetFromGalaxy(${position})" title="Transport Resources">🚚</button>
                        <button class="action-btn deploy-btn" onclick="window.deployToPlanetFromGalaxy(${position})" title="Deploy Fleet" ${isCurrentPlanet ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>🪂</button>
                    ` : `
                        <button class="action-btn info-btn" onclick="window.spyOnPlanetFromGalaxy(${position})" title="Spy">🕵️</button>
                        <button class="action-btn transport-btn" onclick="window.transportToPlanetFromGalaxy(${position})" title="Transport Resources">🚚</button>
                        <button class="action-btn attack-btn" onclick="window.attackPlanetFromGalaxy(${position})" title="Attack">⚔️</button>
                    `}
                </div>
            </td>
        </tr>
    `;
}

/**
 * Render a table row for an empty position
 */
function renderOGameEmptyRow(position) {
    return `
        <tr class="empty-row">
            <td class="pos-col"><strong>${position}</strong></td>
            <td class="planet-col empty-cell">-</td>
            <td class="player-col empty-cell">-</td>
            <td class="status-col empty-cell">-</td>
            <td class="action-col empty-cell">
                <button class="action-btn colonize-btn" onclick="window.colonizePlanetFromGalaxy(${position})" title="Colonize this position">🏗️</button>
            </td>
        </tr>
    `;
}

/**
 * Render a table row for deep space (expedition)
 */
function renderExpeditionRow(position) {
    return `
        <tr class="expedition-row" style="background: rgba(74, 144, 226, 0.1);">
            <td class="pos-col"><strong>${position}</strong></td>
            <td class="planet-col" colspan="3" style="text-align: center; color: var(--accent-blue); font-weight: bold; letter-spacing: 2px;">
                🌌 DEEP SPACE
            </td>
            <td class="action-col">
                <button class="action-btn expedition-btn" onclick="window.sendExpeditionFromGalaxy()" title="Launch Expedition" style="background: var(--accent-blue); color: white;">🚀</button>
            </td>
        </tr>
    `;
}

// Mission trigger functions
window.sendExpeditionFromGalaxy = async function() {
    const coords = [window.currentGalaxy, window.currentSystem, 16];
    const planetId = window.getCurrentPlanetId();
    const planet = window.getCurrentPlanet();
    
    if (!planet) {
        Notifications.showError('No origin planet selected');
        return;
    }

    // Check if planet has any ships
    const hasShips = Object.values(planet.ships || {}).some(count => count > 0);
    if (!hasShips) {
        Notifications.showError('No ships available on this planet');
        return;
    }

    // Create modal for ship selection
    const modal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('details-modal-title');
    const modalBody = document.getElementById('details-modal-body');

    modalTitle.innerHTML = `🚀 Launch Expedition [${coords.join(':')}]`;
    
    let shipsHtml = '<div class="expedition-ship-selection">';
    shipsHtml += '<p>Select ships to send on expedition:</p>';
    shipsHtml += '<div class="expedition-ships-list">';
    
    for (const [shipKey, count] of Object.entries(planet.ships)) {
        if (count > 0) {
            const shipName = shipKey.replace(/([A-Z])/g, ' $1').trim();
            shipsHtml += `
                <div class="expedition-ship-item">
                    <div class="ship-info">
                        <span class="ship-name">${shipName}</span>
                        <span class="ship-available">(Avail: ${formatNumber(count)})</span>
                    </div>
                    <div class="ship-input">
                        <input type="number" class="exp-qty-input" data-ship="${shipKey}" min="0" max="${count}" value="0">
                        <button class="btn-max" onclick="this.previousElementSibling.value=${count}; window.updateExpeditionCosts();">MAX</button>
                    </div>
                </div>
            `;
        }
    }
    
    shipsHtml += '</div>';

    // Add duration selector
    shipsHtml += `
        <div class="expedition-duration-selector" style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 6px;">
            <label style="display: block; margin-bottom: 10px; font-weight: bold; color: var(--accent-yellow);">⌚ Exploration Duration:</label>
            <select id="exp-stay-time" class="modal-input" style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: white; border-radius: 4px;">
                <option value="1" selected>1 Hour (Normal chance)</option>
                <option value="2">2 Hours (Increased chance of finding things)</option>
                <option value="4">4 Hours (High chance of finding things)</option>
                <option value="8">8 Hours (Very high chance, but higher risk)</option>
            </select>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px;">Longer duration increases the likelihood of a major discovery, but increases exposure to deep space hazards.</p>
        </div>
        <div id="exp-cost-estimate" style="margin-top: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; border: 1px solid var(--border-color);">
            <!-- Costs will be rendered here -->
        </div>
    `;

    shipsHtml += `
        <div class="modal-footer" style="margin-top: 20px;">
            <button class="btn btn-secondary" onclick="window.closeDetailsModal()">Cancel</button>
            <button class="btn btn-primary" onclick="window.submitExpedition()">Launch Fleet</button>
        </div>
    `;
    shipsHtml += '</div>';

    modalBody.innerHTML = shipsHtml;
    modal.style.display = 'block';
    setupModalCloseHandlers(modal);

    // Store submit function
    window.submitExpedition = async function() {
        const shipsToSend = {};
        let totalShips = 0;
        const stayTime = parseInt(document.getElementById('exp-stay-time').value) || 1;
        
        document.querySelectorAll('.exp-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                const shipKey = input.dataset.ship;
                shipsToSend[shipKey] = qty;
                totalShips += qty;
            }
        });

        if (totalShips === 0) {
            Notifications.showError('You must select at least one ship');
            return;
        }

        try {
            const response = await fetch('/api/game/galaxy/mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    missionType: 'expedition',
                    targetCoords: coords,
                    ships: shipsToSend,
                    originPlanetId: planetId,
                    stayTime: stayTime
                })
            });

            const result = await response.json();
            if (result.success) {
                Notifications.showSuccess(`Expedition fleet launched!`);
                window.closeDetailsModal();
                if (window.loadGameState) await window.loadGameState();
            } else {
                Notifications.showError(`Failed: ${result.error}`);
            }
        } catch (error) {
            Notifications.showError(`Error: ${error.message}`);
        }
    };

    // Add cost estimation logic
    window.updateExpeditionCosts = function() {
        const stayTime = parseInt(document.getElementById('exp-stay-time').value) || 1;
        let totalCrew = 0;
        const shipsToSend = {};
        
        document.querySelectorAll('.exp-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                const shipKey = input.dataset.ship;
                shipsToSend[shipKey] = qty;
                const ship = SHIPS[shipKey];
                if (ship) {
                    totalCrew += (ship.populationRequired || 0) * qty;
                } else {
                    console.warn('Ship definition not found for key:', shipKey);
                }
            }
        });

        // Calculate actual distance
        const originPlanet = window.getCurrentPlanet();
        const targetCoords = [window.currentGalaxy, window.currentSystem, 16];
        const distance = originPlanet ? calculateDistance(originPlanet.coordinates, targetCoords) : 0;
        
        // Calculate fuel cost
        const fuelCost = calculateFleetFuelCost(shipsToSend, distance);

        // Estimate survival needs (Travel both ways + stay time)
        // Simplified travel time estimate: 300s each way if origin planet not fully known for speed
        const travelTimeSeconds = 300; 
        const totalDurationSeconds = (travelTimeSeconds * 2) + (stayTime * 3600);
        const survivalNeeds = calculateFleetSurvivalNeeds(totalCrew, totalDurationSeconds);

        const costDisplay = document.getElementById('exp-cost-estimate');
        if (costDisplay) {
            costDisplay.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem;">
                    <div>👥 Crew: <strong>${totalCrew}</strong></div>
                    <div>🛢️ Deut: <strong>${formatNumber(fuelCost)}</strong></div>
                    <div>🍞 Food: <strong>${formatNumber(survivalNeeds.food)}</strong></div>
                    <div>💦 Water: <strong>${formatNumber(survivalNeeds.water)}</strong></div>
                </div>
            `;
        }
    };

    // Attach listeners to inputs
    document.querySelectorAll('.exp-qty-input, #exp-stay-time').forEach(el => {
        el.addEventListener('input', window.updateExpeditionCosts);
    });
    
    // Initial call
    if (!SHIPS) {
        console.error('SHIPS constant is not loaded in galaxy.js');
    }
    window.updateExpeditionCosts();
};
window.spyOnPlanetFromGalaxy = async function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    const probeCountStr = await showPrompt('Send Espionage Probes', `How many probes to send to ${coords.join(':')}?`, '1');
    if (probeCountStr === null) return;
    
    const probeCount = parseInt(probeCountStr);
    if (isNaN(probeCount) || probeCount <= 0) {
        Notifications.showError('Invalid probe count');
        return;
    }

    try {
        const response = await fetch('/api/game/galaxy/mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                missionType: 'espionage',
                targetCoords: coords,
                ships: { espionageProbe: probeCount }
            })
        });

        const result = await response.json();
        if (result.success) {
            Notifications.showSuccess(`Espionage probe dispatched! Arrival in ${Math.round((result.data.arrivalTime - Date.now()) / 1000)}s`);
        } else {
            Notifications.showError(`Failed: ${result.error}`);
        }
    } catch (error) {
        Notifications.showError(`Error: ${error.message}`);
    }
};

window.colonizePlanetFromGalaxy = async function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    const confirmed = await showConfirm('Send Colony Ship', `Send 1 colony ship to ${coords.join(':')}?`);
    if (!confirmed) return;

    try {
        const response = await fetch('/api/game/galaxy/mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                missionType: 'colonize',
                targetCoords: coords,
                ships: { colonyShip: 1 }
            })
        });

        const result = await response.json();
        if (result.success) {
            Notifications.showSuccess(`Colony ship dispatched! Arrival in ${Math.round((result.data.arrivalTime - Date.now()) / 1000)}s`);
        } else {
            Notifications.showError(`Failed: ${result.error}`);
        }
    } catch (error) {
        Notifications.showError(`Error: ${error.message}`);
    }
};

window.attackPlanetFromGalaxy = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    Notifications.showError("Not implemented yet: Attack planet at " + coords.join(':'));
};
