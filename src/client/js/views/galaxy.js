// Galaxy view logic
import { API } from '../api.js';
import { formatNumber } from '../utils.js';
import { showConfirm, showPrompt } from './modals.js';
import { Notifications } from '../notifications.js';

let currentGalaxy = 1;
let currentSystem = 1;
let currentGameState = null;
let lastRenderedGalaxy = null;
let lastRenderedSystem = null;

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
                    ${isPlayerPlanet ? '🏠 Own' : '👾 Other'}
                </span>
            </td>
            <td class="action-col">
                <div class="action-buttons">
                    ${isPlayerPlanet ? `
                        <button class="action-btn view-btn" onclick="window.selectPlanetFromGalaxy('${planet.player}')" title="View planet">👁️</button>
                    ` : `
                        <button class="action-btn info-btn" onclick="window.spyOnPlanetFromGalaxy(${position})" title="Spy">🕵️</button>
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
                        <button class="btn-max" onclick="this.previousElementSibling.value=${count}">MAX</button>
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
