// Fleet view logic
import { API } from '../api.js';
import { escapeHtml, formatNumber } from '../utils.js';
import { RESOURCE_ICONS } from '../../../shared/constants.js';

let lastStructuralHash = null;
let lastContentHash = null;
let cachedFleetData = null;

/**
 * Calculate structural hash (number of planets, names)
 */
function calculateStructuralHash(gameState) {
    return JSON.stringify(gameState.planets.map(p => ({ id: p.id, name: p.name })));
}

/**
 * Calculate content hash (total counts and per-planet units)
 */
function calculateContentHash(fleetData) {
    return JSON.stringify(fleetData.map(f => ({
        id: f.planetId,
        ships: f.ships,
        defenses: f.defenses
    })));
}

/**
 * Update fleet view with player data
 */
export async function updateFleetView(gameState) {
    const container = document.getElementById('fleet-view');
    if (!container) return;
    
    if (!gameState?.planets || gameState.planets.length === 0) {
        container.innerHTML = '<p>No planets available</p>';
        return;
    }
    
    // 1. Structural update check
    const structuralHash = calculateStructuralHash(gameState);
    if (structuralHash !== lastStructuralHash || !container.querySelector('.fleets-container')) {
        container.innerHTML = `
            <h2>🛰️ Fleet Overview</h2>
            <div class="fleet-summary" id="fleet-summary-stats">
                <div class="fleet-stats">
                    <div class="stat-card">
                        <span>Total Ships</span>
                        <div class="stat-value" id="total-ships-val">0</div>
                    </div>
                    <div class="stat-card">
                        <span>Total Defenses</span>
                        <div class="stat-value" id="total-defenses-val">0</div>
                    </div>
                </div>
            </div>
            <div class="fleets-container">
                ${gameState.planets.map(p => `<div id="planet-fleet-card-${p.id}" class="fleet-card"></div>`).join('')}
            </div>
        `;
        lastStructuralHash = structuralHash;
        lastContentHash = null; // Force data refresh
    }

    try {
        // Fetch fresh details for each planet
        const fleetData = await Promise.all(
            gameState.planets.map(planet => 
                API.getFleetDetails(planet.id)
                    .then(fleet => ({ ...fleet, planetName: planet.name, planetId: planet.id }))
                    .catch(() => ({ ships: {}, defenses: {}, planetName: planet.name, planetId: planet.id }))
            )
        );
        
        cachedFleetData = fleetData;

        // 2. Dynamic content update check
        const contentHash = calculateContentHash(fleetData);
        if (contentHash !== lastContentHash) {
            updateFleetDataGranular(fleetData);
            lastContentHash = contentHash;
        }
        
    } catch (error) {
        console.error('Failed to load fleet details:', error);
        // Only show error if we have no cached data
        if (!cachedFleetData) {
            container.innerHTML = `<p class="error">Failed to load fleet: ${escapeHtml(error.message)}</p>`;
        }
    }
}

function updateFleetDataGranular(fleetData) {
    let totalShips = 0;
    let totalDefenses = 0;

    fleetData.forEach(fleet => {
        // Update per-planet card
        const card = document.getElementById(`planet-fleet-card-${fleet.planetId}`);
        if (card) {
            const html = renderPlanetFleetContent(fleet);
            if (card.innerHTML !== html) card.innerHTML = html;
        }

        // Aggregate totals
        for (const k in (fleet.ships || {})) totalShips += fleet.ships[k];
        for (const k in (fleet.defenses || {})) totalDefenses += fleet.defenses[k];
    });

    // Update summary totals
    const shipsVal = document.getElementById('total-ships-val');
    const defsVal = document.getElementById('total-defenses-val');
    
    if (shipsVal && shipsVal.textContent !== String(totalShips)) {
        shipsVal.textContent = formatNumber(totalShips);
    }
    if (defsVal && defsVal.textContent !== String(totalDefenses)) {
        defsVal.textContent = formatNumber(totalDefenses);
    }
}

/**
 * Render inner content of a single planet's fleet card
 */
export function renderPlanetFleetContent(fleet) {
    const shipNames = {
        lightFighter: 'Light Fighter',
        heavyFighter: 'Heavy Fighter',
        cruiser: 'Cruiser',
        battleship: 'Battleship',
        destroyer: 'Destroyer',
        bomber: 'Bomber',
        smallCargo: 'Small Cargo',
        largeCargo: 'Large Cargo',
        colonyShip: 'Colony Ship',
        recycler: 'Recycler',
        espionageProbe: 'Espionage Probe'
    };

    const defenseNames = {
        rocketLauncher: 'Rocket Launcher',
        laserCannon: 'Laser Cannon',
        particleBeam: 'Particle Beam',
        shield: 'Planetary Shield',
        interceptor: 'Interceptor Missile',
        antiAirMissile: 'Anti-Air Missile',
        plasmaTurret: 'Plasma Turret',
        ionCannon: 'Ion Cannon'
    };

    let shipHtml = '';
    for (const key in (fleet.ships || {})) {
        if (fleet.ships[key] > 0) {
            shipHtml += `
                <div class="fleet-item">
                    <span class="fleet-item-name">${shipNames[key] || key}</span>
                    <span class="fleet-item-count">${formatNumber(fleet.ships[key])}</span>
                </div>`;
        }
    }

    let defenseHtml = '';
    for (const key in (fleet.defenses || {})) {
        if (fleet.defenses[key] > 0) {
            defenseHtml += `
                <div class="fleet-item">
                    <span class="fleet-item-name">${defenseNames[key] || key}</span>
                    <span class="fleet-item-count">${formatNumber(fleet.defenses[key])}</span>
                </div>`;
        }
    }

    let html = `<h3>🪐 ${escapeHtml(fleet.planetName)}</h3>`;
    
    if (!shipHtml && !defenseHtml) {
        html += '<p class="empty-text">No ships or defenses detected</p>';
    } else {
        html += '<div class="fleet-details">';
        if (shipHtml) {
            html += `<div class="fleet-section"><h4>⚔️ Ships</h4><div class="ship-list">${shipHtml}</div></div>`;
        }
        if (defenseHtml) {
            html += `<div class="fleet-section"><h4>🛡️ Defenses</h4><div class="defense-list">${defenseHtml}</div></div>`;
        }
        html += '</div>';
    }
    
    return html;
}
