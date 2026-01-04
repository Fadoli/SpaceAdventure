// Galaxy view logic
import { API } from '../api.js';
import { formatNumber } from '../utils.js';
import { showConfirm, showPrompt } from './modals.js';

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

// Mission trigger functions
window.spyOnPlanetFromGalaxy = async function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    const confirmed = await showConfirm('Send Espionage Probe', `Send 1 espionage probe to ${coords.join(':')}?`);
    if (!confirmed) return;

    try {
        const response = await fetch('/api/game/galaxy/mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                missionType: 'espionage',
                targetCoords: coords,
                ships: { espionageProbe: 1 }
            })
        });

        const result = await response.json();
        if (result.success) {
            alert(`Espionage probe dispatched! Arrival in ${Math.round((result.data.arrivalTime - Date.now()) / 1000)}s`);
        } else {
            alert(`Failed: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
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
            alert(`Colony ship dispatched! Arrival in ${Math.round((result.data.arrivalTime - Date.now()) / 1000)}s`);
        } else {
            alert(`Failed: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
};

window.attackPlanetFromGalaxy = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    alert("Not implemented yet: Attack planet at " + coords.join(':'));
};
