// Fleet view logic
import { API } from '../api.js';
import { formatNumber } from '../utils.js';
import { RESOURCE_ICONS } from '../../../shared/constants.js';

/**
 * Update fleet view with player data
 */
export async function updateFleetView(gameState) {
    const container = document.getElementById('fleet-view');
    
    if (!gameState?.planets || gameState.planets.length === 0) {
        container.innerHTML = '<p>No planets available</p>';
        return;
    }
    
    try {
        const fleetData = await Promise.all(
            gameState.planets.map(planet => 
                API.getFleetDetails(planet.id)
                    .then(fleet => ({ ...fleet, planetName: planet.name, planetId: planet.id }))
                    .catch(() => ({ ships: {}, defenses: {}, planetName: planet.name, planetId: planet.id }))
            )
        );
        
        let html = '<h2>🛰️ Fleet Overview</h2>';
        html += '<div class="fleet-summary">';
        
        // Calculate total fleet stats
        let totalShips = 0;
        let totalDefenses = 0;
        
        for (const fleet of fleetData) {
            let shipsCount = 0;
            for (const key in (fleet.ships || {})) {
                shipsCount += fleet.ships[key];
            }
            totalShips += shipsCount;
            
            let defensesCount = 0;
            for (const key in (fleet.defenses || {})) {
                defensesCount += fleet.defenses[key];
            }
            totalDefenses += defensesCount;
        }
        
        html += `
            <div class="fleet-stats">
                <div class="stat-card">
                    <span>Total Ships</span>
                    <div class="stat-value">${formatNumber(totalShips)}</div>
                </div>
                <div class="stat-card">
                    <span>Total Defenses</span>
                    <div class="stat-value">${formatNumber(totalDefenses)}</div>
                </div>
            </div>
        `;
        
        html += '</div><div class="fleets-container">';
        
        // Show each planet's fleet
        for (const fleet of fleetData) {
            html += renderPlanetFleet(fleet);
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Failed to load fleet details:', error);
        container.innerHTML = `<p class="error">Failed to load fleet: ${error.message}</p>`;
    }
}

/**
 * Render a single planet's fleet
 */
function renderPlanetFleet(fleet) {
    let hasShips = false;
    for (const key in (fleet.ships || {})) {
        if (fleet.ships[key] > 0) {
            hasShips = true;
            break;
        }
    }
    
    let hasDefenses = false;
    for (const key in (fleet.defenses || {})) {
        if (fleet.defenses[key] > 0) {
            hasDefenses = true;
            break;
        }
    }
    
    let html = `<div class="fleet-card">
        <h3>🪐 ${fleet.planetName}</h3>`;
    
    if (!hasShips && !hasDefenses) {
        html += '<p>No ships or defenses</p>';
    } else {
        html += '<div class="fleet-details">';
        
        if (hasShips) {
            html += `<div class="fleet-section">
                <h4>⚔️ Ships</h4>
                <div class="ship-list">`;
            
            for (const shipKey in (fleet.ships || {})) {
                const count = fleet.ships[shipKey];
                if (count > 0) {
                    // Get ship name from SHIPS constant (would need to import)
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
                    
                    const shipName = shipNames[shipKey] || shipKey;
                    
                    html += `
                        <div class="fleet-item">
                            <span class="fleet-item-name">${shipName}</span>
                            <span class="fleet-item-count">${formatNumber(count)}</span>
                        </div>
                    `;
                }
            }
            
            html += '</div></div>';
        }
        
        if (hasDefenses) {
            html += `<div class="fleet-section">
                <h4>🛡️ Defenses</h4>
                <div class="defense-list">`;
            
            for (const defenseKey in (fleet.defenses || {})) {
                const count = fleet.defenses[defenseKey];
                if (count > 0) {
                    // Get defense name from DEFENSES constant
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
                    
                    const defenseName = defenseNames[defenseKey] || defenseKey;
                    
                    html += `
                        <div class="fleet-item">
                            <span class="fleet-item-name">${defenseName}</span>
                            <span class="fleet-item-count">${formatNumber(count)}</span>
                        </div>
                    `;
                }
            }
            
            html += '</div></div>';
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}
