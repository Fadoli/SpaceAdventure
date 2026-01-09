import { API } from '../api.js';
import { formatNumber } from '../utils.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';
import { MISSION_TYPES } from '../../../shared/constants.js';
import { SHIPS, calculateFleetFuelCost, calculateFleetSurvivalNeeds, calculateCargoCapacity } from '../../../shared/ships.js';
import { calculateDistance } from '../../../shared/formulas.js';

let lastRenderedGalaxy = null;
let lastRenderedSystem = null;
let currentGameState = null;
let currentGalaxy = null;
let currentSystem = null;

/**
 * Setup modal close handlers
 */
function setupModalCloseHandlers(modal) {
    const closeBtn = modal.querySelector('.close-button');
    if (closeBtn) {
        closeBtn.onclick = () => window.closeDetailsModal();
    }
    window.onclick = (event) => {
        if (event.target === modal) window.closeDetailsModal();
    };
}

/**
 * Open unified mission modal
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

    // Store target for calculations
    window.lastTargetCoords = targetCoords;

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
            // FILTER: If spying, ONLY show espionage probes
            if (missionType === MISSION_TYPES.ESPIONAGE && shipKey !== 'espionageProbe') {
                continue;
            }

            const shipName = shipKey.replace(/([A-Z])/g, ' $1').trim();
            // Pre-selection logic
            let initialValue = 0;
            if (missionType === MISSION_TYPES.HARVEST && shipKey === 'recycler') {
                initialValue = Math.min(count, 1);
            } else if (missionType === MISSION_TYPES.ESPIONAGE && shipKey === 'espionageProbe') {
                initialValue = Math.min(count, 1);
            } else if (missionType === MISSION_TYPES.ATTACK && SHIPS[shipKey]?.type === 'military') {
                initialValue = 0; // Highlighting but not auto-selecting
            }
            
            html += `
                <div class="expedition-ship-item dense">
                    <span class="ship-name">${shipName}</span>
                    <span class="ship-available">Avail: ${formatNumber(count)}</span>
                    <div class="ship-input">
                        <input type="number" class="exp-qty-input ship-qty-input" data-ship="${shipKey}" min="0" max="${count}" value="${initialValue}">
                        <button class="btn-max" onclick="this.previousElementSibling.value=${count}; window.updateMissionCalculations();">MAX</button>
                    </div>
                </div>
            `;
        }
    }
    html += '</div></div>';

    // --- Resource Selection Section ---
    if (missionType === MISSION_TYPES.TRANSPORT || missionType === MISSION_TYPES.DEPLOY) {
        html += '<div class="mission-section" style="margin-top: 15px;">';
        html += '<h4>📦 Select Resources</h4>';
        html += '<div id="cargo-status" style="margin-bottom: 8px; font-weight: bold; color: var(--accent-blue);">Cargo: 0 / 0</div>';
        html += '<div class="mission-resources-list dense-grid">';
        
        const resourceKeys = ['metal', 'crystal', 'deuterium', 'water', 'food'];
        for (const res of resourceKeys) {
            const amount = Math.floor(planet.resources[res] || 0);
            const resIcon = { metal: '⚙️', crystal: '💎', deuterium: '🛢️', water: '💦', food: '🍞' }[res];
            html += `
                <div class="mission-res-item-dense">
                    <div class="res-info">
                        <span class="res-icon">${resIcon}</span>
                        <span class="res-name">${res.charAt(0).toUpperCase()}</span>
                        <span class="res-avail">${formatNumber(amount)}</span>
                    </div>
                    <div class="res-input-group">
                        <input type="number" class="exp-qty-input res-qty-input" data-res="${res}" min="0" max="${amount}" value="0">
                        <button class="btn-max" onclick="window.maxResource('${res}', ${amount})">M</button>
                    </div>
                </div>
            `;
        }
        html += '</div></div>';
    }

    // --- Special Section for Expedition (Stay Time) ---
    if (missionType === MISSION_TYPES.EXPEDITION) {
        html += `
            <div class="mission-section expedition-duration-selector" style="margin-top: 15px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold; color: var(--accent-yellow);">⌚ Exploration Duration:</label>
                <select id="exp-stay-time" class="modal-input" style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: white; border-radius: 4px;">
                    <option value="1" selected>1 Hour (Normal chance)</option>
                    <option value="2">2 Hours (Increased chance)</option>
                    <option value="4">4 Hours (High chance)</option>
                    <option value="8">8 Hours (Very high chance, high risk)</option>
                </select>
            </div>
        `;
    }

    // --- Stats & Costs Summary Section ---
    html += `
        <div id="mission-calc-summary" style="margin-top: 15px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 6px; border: 1px solid var(--border-color);">
            <!-- Stats will be rendered here -->
        </div>
    `;

    // --- Footer ---
    html += `
        <div class="modal-footer" style="margin-top: 20px;">
            <button class="btn btn-secondary" onclick="window.closeDetailsModal()">Cancel</button>
            <button class="btn btn-primary" onclick="window.submitMission('${missionType}', [${targetCoords.join(',')}])">Launch Fleet</button>
        </div>
    </div>`;

    modalBody.innerHTML = html;
    modal.style.display = 'block';
    setupModalCloseHandlers(modal);

    // Attach listeners
    document.querySelectorAll('.exp-qty-input, #exp-stay-time').forEach(el => {
        el.addEventListener('input', window.updateMissionCalculations);
    });

    // Update initial view
    window.updateMissionCalculations();
}

/**
 * Shared calculation logic for mission modal
 */
window.updateMissionCalculations = function() {
    const planet = window.getCurrentPlanet();
    const targetCoords = window.lastTargetCoords || [1, 1, 1];
    
    const shipsToSend = {};
    const resourcesToTransport = {};
    let totalCrew = 0;
    let totalCargoCapacity = 0;
    let totalTransported = 0;

    // Get ships
    document.querySelectorAll('.ship-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            const key = input.dataset.ship;
            shipsToSend[key] = qty;
            const def = SHIPS[key];
            if (def) {
                totalCrew += (def.populationRequired || 0) * qty;
                totalCargoCapacity += (def.cargoCapacity || 0) * qty;
            }
        }
    });

    // Get resources
    document.querySelectorAll('.res-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            resourcesToTransport[input.dataset.res] = qty;
            totalTransported += qty;
        }
    });

    // Update cargo status if visible
    const cargoStatus = document.getElementById('cargo-status');
    if (cargoStatus) {
        cargoStatus.textContent = `Cargo: ${formatNumber(totalTransported)} / ${formatNumber(totalCargoCapacity)}`;
        cargoStatus.style.color = totalTransported > totalCargoCapacity ? 'var(--accent-red)' : 'var(--accent-blue)';
    }

    // Calculate costs
    const distance = planet ? calculateDistance(planet.coordinates, targetCoords) : 0;
    const fuelCost = calculateFleetFuelCost(shipsToSend, distance);
    
    // Survival needs calculation
    const stayTime = document.getElementById('exp-stay-time') ? parseInt(document.getElementById('exp-stay-time').value) : 0;
    const travelTimeSeconds = 600; // estimate
    const totalDurationSeconds = (travelTimeSeconds * 2) + (stayTime * 3600);
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

window.submitMission = async function(missionType, targetCoords) {
    const planetId = window.getCurrentPlanetId();
    if (!planetId) return;

    const shipsToSend = {};
    const resourcesToSend = {};
    let totalShips = 0;
    const stayTime = document.getElementById('exp-stay-time') ? parseInt(document.getElementById('exp-stay-time').value) : 0;

    document.querySelectorAll('.ship-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            shipsToSend[input.dataset.ship] = qty;
            totalShips += qty;
        }
    });

    if (totalShips === 0) {
        Notifications.showError('You must select at least one ship');
        return;
    }

    document.querySelectorAll('.res-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            resourcesToSend[input.dataset.res] = qty;
        }
    });

    try {
        const response = await fetch('/api/game/galaxy/mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                missionType,
                targetCoords,
                ships: shipsToSend,
                resources: resourcesToSend,
                originPlanetId: planetId,
                stayTime
            })
        });

        const result = await response.json();
        if (result.success) {
            Notifications.showSuccess(`${missionType.charAt(0).toUpperCase() + missionType.slice(1)} mission launched!`);
            window.closeDetailsModal();
            if (window.loadGameState) await window.loadGameState();
        } else {
            Notifications.showError(`Failed: ${result.error}`);
        }
    } catch (error) {
        Notifications.showError(`Error: ${error.message}`);
    }
};

window.sendExpeditionFromGalaxy = function() {
    const coords = [window.currentGalaxy, window.currentSystem, 16];
    openMissionModal(MISSION_TYPES.EXPEDITION, coords);
};

window.spyOnPlanetFromGalaxy = async function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    openMissionModal(MISSION_TYPES.ESPIONAGE, coords);
};

window.colonizePlanetFromGalaxy = async function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    // Check if player has a colony ship on this planet
    const planet = window.getCurrentPlanet();
    if (!planet || (planet.ships.colonyShip || 0) <= 0) {
        Notifications.showError('You need a colony ship on this planet to colonize!');
        return;
    }
    
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
    openMissionModal(MISSION_TYPES.ATTACK, coords);
};

window.transportToPlanetFromGalaxy = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    openMissionModal(MISSION_TYPES.TRANSPORT, coords);
};

window.deployToPlanetFromGalaxy = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    openMissionModal(MISSION_TYPES.DEPLOY, coords);
};

window.harvestDebrisFromGalaxy = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    openMissionModal(MISSION_TYPES.HARVEST, coords);
};

// Galaxy Navigation Functions
window.navigateGalaxy = function(delta) {
    let val = (currentGalaxy || 1) + delta;
    if (val < 1) val = 1;
    if (val > 9) val = 9;
    window.navigateToCoords(val, currentSystem || 1);
};

window.navigateSystem = function(delta) {
    let val = (currentSystem || 1) + delta;
    if (val < 1) val = 499; // Loop around
    if (val > 499) val = 1;
    window.navigateToCoords(currentGalaxy || 1, val);
};

window.navigateToCoords = async function(galaxy, system, position = null) {
    const container = document.getElementById('galaxy-view');
    if (!container) return;
    
    const g = parseInt(galaxy, 10);
    const s = parseInt(system, 10);
    
    if (isNaN(g) || isNaN(s)) return;

    // Update module variables
    currentGalaxy = g;
    currentSystem = s;
    
    // Update window objects for legacy/external compatibility
    window.currentGalaxy = g;
    window.currentSystem = s;
    
    await loadAndRenderGalaxy(container, g, s, currentGameState);
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
 * Render the galaxy table
 */
function renderOGameGalaxyTable(container, galaxyData, gameState, galaxy, system) {
    // Map of position -> planet data
    const planetMap = new Map();
    galaxyData.planets.forEach(p => {
        planetMap.set(p.position, p);
    });
    
    // Positions of current player's planets
    const playerPlanetPositions = new Set();
    gameState.planets.forEach(p => {
        const [pg, ps, pp] = p.coordinates;
        if (pg === galaxy && ps === system) {
            playerPlanetPositions.add(pp);
        }
    });

    let html = `
        <div class="ogame-galaxy-view">
            <div class="galaxy-nav-panel">
                <div class="nav-item-group">
                    <span class="nav-item-label">Galaxy</span>
                    <button class="nav-arrow-btn" onclick="window.navigateGalaxy(-1)">◀</button>
                    <input type="number" id="galaxy-input" class="nav-coord-input" value="${galaxy}" min="1" max="9">
                    <button class="nav-arrow-btn" onclick="window.navigateGalaxy(1)">▶</button>
                </div>
                
                <div class="nav-item-group">
                    <span class="nav-item-label">System</span>
                    <button class="nav-arrow-btn" onclick="window.navigateSystem(-1)">◀</button>
                    <input type="number" id="system-input" class="nav-coord-input" value="${system}" min="1" max="499">
                    <button class="nav-arrow-btn" onclick="window.navigateSystem(1)">▶</button>
                </div>
                
                <button class="btn btn-primary btn-small nav-show-btn" onclick="window.navigateToCoords(document.getElementById('galaxy-input').value, document.getElementById('system-input').value)">Show</button>
            </div>
            
            <div class="ogame-table-wrapper">
                <table class="ogame-system-table">
                    <thead>
                        <tr>
                            <th class="pos-col">Pos</th>
                            <th class="planet-col">Planet</th>
                            <th class="debris-col">Debris</th>
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
            // Find debris field for this empty slot if any
            const debris = galaxyData.planets.find(p => p.position === position && !p.player)?.debris || null;
            html += renderOGameEmptyRow(position, debris);
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
    
    // Attach change listeners to inputs for manual entry
    const gInput = document.getElementById('galaxy-input');
    const sInput = document.getElementById('system-input');
    
    if (gInput) {
        gInput.addEventListener('change', () => {
            let val = parseInt(gInput.value) || 1;
            val = Math.max(1, Math.min(9, val));
            gInput.value = val;
            window.navigateToCoords(val, window.currentSystem);
        });
    }
    
    if (sInput) {
        sInput.addEventListener('change', () => {
            let val = parseInt(sInput.value) || 1;
            val = Math.max(1, Math.min(499, val));
            sInput.value = val;
            window.navigateToCoords(window.currentGalaxy, val);
        });
    }
    
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

    // Debris info
    let debrisHtml = '-';
    if (planet.debris) {
        const { metal, crystal } = planet.debris;
        debrisHtml = `
            <div class="debris-info" title="M: ${formatNumber(metal)} | C: ${formatNumber(crystal)}">
                <span class="debris-icon">♻️</span>
                <small>${formatNumber(metal + crystal)}</small>
            </div>
        `;
    }

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
            <td class="debris-col">${debrisHtml}</td>
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
                        <button class="action-btn transport-btn" onclick="window.transportToPlanetFromGalaxy(${position})" title="Transport Resources" ${isCurrentPlanet ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>🚚</button>
                        <button class="action-btn deploy-btn" onclick="window.deployToPlanetFromGalaxy(${position})" title="Deploy Fleet" ${isCurrentPlanet ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>🪂</button>
                    ` : `
                        <button class="action-btn info-btn" onclick="window.spyOnPlanetFromGalaxy(${position})" title="Spy">🕵️</button>
                        <button class="action-btn transport-btn" onclick="window.transportToPlanetFromGalaxy(${position})" title="Transport Resources">🚚</button>
                        <button class="action-btn attack-btn" onclick="window.attackPlanetFromGalaxy(${position})" title="Attack">⚔️</button>
                    `}
                    ${planet.debris ? `<button class="action-btn harvest-btn" onclick="window.harvestDebrisFromGalaxy(${position})" title="Recycle Debris">♻️</button>` : ''}
                </div>
            </td>
        </tr>
    `;
}

/**
 * Render a table row for an empty position
 */
function renderOGameEmptyRow(position, debris = null) {
    let debrisHtml = '-';
    if (debris) {
        debrisHtml = `
            <div class="debris-info" title="M: ${formatNumber(debris.metal)} | C: ${formatNumber(debris.crystal)}">
                <span class="debris-icon">♻️</span>
                <small>${formatNumber(debris.metal + debris.crystal)}</small>
            </div>
        `;
    }

    return `
        <tr class="empty-row">
            <td class="pos-col"><strong>${position}</strong></td>
            <td class="planet-col empty-cell">-</td>
            <td class="debris-col">${debrisHtml}</td>
            <td class="player-col empty-cell">-</td>
            <td class="status-col empty-cell">-</td>
            <td class="action-col empty-cell">
                <div class="action-buttons">
                    <button class="action-btn colonize-btn" onclick="window.colonizePlanetFromGalaxy(${position})" title="Colonize this position">🏗️</button>
                    ${debris ? `<button class="action-btn harvest-btn" onclick="window.harvestDebrisFromGalaxy(${position})" title="Recycle Debris">♻️</button>` : ''}
                </div>
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
            <td class="planet-col" colspan="4" style="text-align: center; color: var(--accent-blue); font-weight: bold; letter-spacing: 2px;">
                🌌 DEEP SPACE
            </td>
            <td class="action-col">
                <button class="action-btn expedition-btn" onclick="window.sendExpeditionFromGalaxy()" title="Launch Expedition" style="background: var(--accent-blue); color: white;">🚀</button>
            </td>
        </tr>
    `;
}