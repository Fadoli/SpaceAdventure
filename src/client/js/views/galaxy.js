import { API } from '../api.js';
import { formatNumber, parseNumberShorthand } from '../utils.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';
import { MISSION_TYPES } from '../../../shared/constants.js';
import { SHIPS, calculateFleetFuelCost, calculateFleetSurvivalNeeds, calculateCargoCapacity } from '../../../shared/ships.js';
import { calculateDistance, calculateTravelTime } from '../../../shared/formulas.js';

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

    const typeLabel = missionType === MISSION_TYPES.MARKET_TRADE ? 'Commodity Exchange' : (missionType.charAt(0).toUpperCase() + missionType.slice(1));
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

            const shipName = SHIPS[shipKey]?.name || shipKey.replace(/([A-Z])/g, ' $1').trim();
            // Pre-selection logic
            let initialValue = 0;
            if (missionType === MISSION_TYPES.HARVEST && shipKey === 'recycler') {
                initialValue = Math.min(count, 1);
            } else if (missionType === MISSION_TYPES.ESPIONAGE && shipKey === 'espionageProbe') {
                initialValue = Math.min(count, 1);
            } else if (missionType === MISSION_TYPES.MARKET_TRADE && (shipKey === 'smallCargo' || shipKey === 'largeCargo')) {
                initialValue = 0; // User will select
            }
            
            html += `
                <div class="expedition-ship-item dense">
                    <span class="ship-name">${shipName}</span>
                    <span class="ship-available">Avail: ${formatNumber(count)}</span>
                    <div class="ship-input">
                        <input type="text" pattern="[0-9kmKMB tqTQ.]*" class="exp-qty-input ship-qty-input" data-ship="${shipKey}" value="${initialValue}">
                        <button class="btn-max" onclick="this.previousElementSibling.value=${count}; window.updateMissionCalculations();">MAX</button>
                    </div>
                </div>
            `;
        }
    }
    html += '</div></div>';

    // --- Cargo Capacity Status (Universal) ---
    if (missionType !== MISSION_TYPES.ESPIONAGE) {
        html += `
            <div class="mission-section cargo-summary-section" style="margin-top: 10px; padding: 10px; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.1); border-radius: 4px;">
                <div id="cargo-status" style="font-weight: bold; color: var(--accent-blue); font-family: 'Share Tech Mono', monospace;">CARGO CAPACITY: 0 / 0</div>
            </div>
        `;
    }

    // --- Market Trade Section ---
    if (missionType === MISSION_TYPES.MARKET_TRADE) {
        const resourceKeys = ['metal', 'crystal', 'deuterium'];
        html += `
            <div class="mission-section" style="margin-top: 15px;">
                <div class="v-readout-header" style="color: var(--accent-yellow);">COMMODITIES EXCHANGE PROTOCOL</div>
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border: 1px solid rgba(255,255,255,0.05); border-radius: 2px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-family: 'Share Tech Mono', monospace; font-size: 0.75rem;">
                        <span>EXCHANGE RATES:</span>
                        <span>M:3 | C:2 | D:1</span>
                    </div>

                    <div class="available-resources-mini" style="display: flex; gap: 10px; margin-bottom: 15px; padding: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                        ${resourceKeys.map(res => `
                            <div style="flex: 1; font-family: 'Share Tech Mono', monospace; font-size: 0.75rem;">
                                <span style="color: var(--text-secondary);">${res.toUpperCase()}:</span>
                                <span style="color: #fff; font-weight: bold;">${formatNumber(Math.floor(planet.resources[res] || 0))}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="trade-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="trade-side">
                            <h5 style="font-size: 0.65rem; color: var(--text-secondary); margin-bottom: 8px;">SELL ASSETS</h5>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${['metal', 'crystal', 'deuterium'].map(res => `
                                    <div class="res-input-group" style="display: flex; align-items: center; gap: 5px;">
                                        <span style="font-size: 0.8rem; width: 20px;">${{metal:'⚙️',crystal:'💎',deuterium:'🛢️'}[res]}</span>
                                        <input type="text" pattern="[0-9kmKMB tqTQ.]*" class="exp-qty-input sell-qty-input" data-res="${res}" placeholder="0" style="flex: 1; height: 28px;">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="trade-side">
                            <h5 style="font-size: 0.65rem; color: var(--text-secondary); margin-bottom: 8px;">BUY ASSETS</h5>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${['metal', 'crystal', 'deuterium'].map(res => `
                                    <div class="res-input-group" style="display: flex; align-items: center; gap: 5px;">
                                        <span style="font-size: 0.8rem; width: 20px;">${{metal:'⚙️',crystal:'💎',deuterium:'🛢️'}[res]}</span>
                                        <input type="text" pattern="[0-9kmKMB tqTQ.]*" class="exp-qty-input buy-qty-input" data-res="${res}" placeholder="0" style="flex: 1; height: 28px;">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div id="trade-balance-warning" style="margin-top: 15px; font-family: 'Share Tech Mono', monospace; font-size: 0.7rem; text-align: center;">
                        <span id="trade-value-info" style="color: var(--accent-blue);">CREDIT BALANCE: 0</span>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Resource Selection Section (Normal Transport/Deploy) ---
    if (missionType === MISSION_TYPES.TRANSPORT || missionType === MISSION_TYPES.DEPLOY) {
        html += '<div class="mission-section" style="margin-top: 15px;">';
        html += '<h4>📦 Select Resources</h4>';
        html += '<div class="mission-resources-list dense-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">';
        
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
                        <input type="text" pattern="[0-9kmKMB tqTQ.]*" class="exp-qty-input res-qty-input" data-res="${res}" value="0">
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
    modal.style.display = 'flex';
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
    const isMarket = document.querySelector('.sell-qty-input') !== null;
    
    const shipsToSend = {};
    const resourcesToTransport = {};
    let totalCrew = 0;
    let totalShips = 0;
    let totalCargoCapacity = 0;
    let totalTransported = 0;

    // Get ships
    document.querySelectorAll('.ship-qty-input').forEach(input => {
        const qty = parseNumberShorthand(input.value);
        if (qty > 0) {
            const key = input.dataset.ship;
            shipsToSend[key] = qty;
            totalShips += qty;
            const def = SHIPS[key];
            if (def) {
                totalCrew += (def.populationRequired || 0) * qty;
                totalCargoCapacity += (def.cargoCapacity || 0) * qty;
            }
        }
    });

    if (isMarket) {
        // Market Trade Calculation
        const rates = { metal: 1, crystal: 1.5, deuterium: 3 }; // Normalize to metal units
        let totalSellValue = 0;
        let totalBuyValue = 0;
        let totalSellWeight = 0;
        let totalBuyWeight = 0;

        document.querySelectorAll('.sell-qty-input').forEach(input => {
            const qty = parseNumberShorthand(input.value);
            if (qty > 0) {
                totalSellValue += qty * (rates[input.dataset.res] || 1);
                totalSellWeight += qty;
            }
        });

        document.querySelectorAll('.buy-qty-input').forEach(input => {
            const qty = parseNumberShorthand(input.value);
            if (qty > 0) {
                totalBuyValue += qty * (rates[input.dataset.res] || 1);
                totalBuyWeight += qty;
            }
        });

        const balance = totalSellValue - totalBuyValue;
        const infoEl = document.getElementById('trade-value-info');
        const balanceWarning = document.getElementById('trade-balance-warning');
        
        if (infoEl) {
            infoEl.textContent = `CREDIT BALANCE: ${Math.floor(balance)}`;
            infoEl.style.color = balance < 0 ? 'var(--accent-red)' : 'var(--accent-green)';
        }

        // Cargo required is the MAXIMUM of what we send and what we receive
        totalTransported = Math.max(totalSellWeight, totalBuyWeight);
    } else {
        // Get resources (Normal Transport)
        document.querySelectorAll('.res-qty-input').forEach(input => {
            const qty = parseNumberShorthand(input.value);
            if (qty > 0) {
                resourcesToTransport[input.dataset.res] = qty;
                totalTransported += qty;
            }
        });
    }

    // Update cargo status if visible
    const cargoStatus = document.getElementById('cargo-status') || { textContent: '', style: {} };
    if (cargoStatus) {
        const cargoText = `CARGO CAPACITY: ${formatNumber(totalTransported)} / ${formatNumber(totalCargoCapacity)}`;
        if (cargoStatus.textContent !== cargoText) cargoStatus.textContent = cargoText;
        cargoStatus.style.color = totalTransported > totalCargoCapacity ? 'var(--accent-red)' : 'var(--accent-blue)';
    }

    // Calculate costs
    const distance = planet ? calculateDistance(planet.coordinates, targetCoords) : 0;
    const fuelCost = calculateFleetFuelCost(shipsToSend, distance);
    
    // Find slowest ship speed for accurate travel time
    let slowestSpeed = Infinity;
    for (const shipKey in shipsToSend) {
        if (shipsToSend[shipKey] > 0) {
            const speed = SHIPS[shipKey]?.speed || 100;
            if (speed < slowestSpeed) slowestSpeed = speed;
        }
    }
    if (slowestSpeed === Infinity) slowestSpeed = 100;

    // Survival needs calculation using SHARED formula
    const fleetSpeedMultiplier = window.GAME_CONFIG?.gameSpeed?.fleetSpeed || 1.0;
    const travelTimeSeconds = calculateTravelTime(distance, slowestSpeed, fleetSpeedMultiplier);
    const stayTime = document.getElementById('exp-stay-time') ? parseInt(document.getElementById('exp-stay-time').value) : 0;
    
    // Total mission duration (travel both ways + stay time for expeditions)
    const totalDurationSeconds = (travelTimeSeconds * 2) + (stayTime * 3600);
    const survivalNeeds = calculateFleetSurvivalNeeds(totalCrew, totalDurationSeconds);

    const summary = document.getElementById('mission-calc-summary');
    if (summary) {
        summary.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem; font-family: 'Share Tech Mono', monospace;">
                <div>👥 CREW: <strong>${totalCrew}</strong></div>
                <div>🛢️ FUEL: <strong>${formatNumber(fuelCost)}</strong></div>
                <div>🍞 FOOD: <strong>${formatNumber(survivalNeeds.food)}</strong></div>
                <div>💦 WATER: <strong>${formatNumber(survivalNeeds.water)}</strong></div>
            </div>
        `;
    }
    
    // Update launch button state
    const launchBtn = document.querySelector('.modal-footer .btn-primary');
    if (launchBtn) {
        let disabled = totalTransported > totalCargoCapacity || totalShips === 0;
        if (isMarket) {
            const sellInputs = Array.from(document.querySelectorAll('.sell-qty-input')).reduce((s, i) => s + parseNumberShorthand(i.value), 0);
            const buyInputs = Array.from(document.querySelectorAll('.buy-qty-input')).reduce((s, i) => s + parseNumberShorthand(i.value), 0);
            
            // Need some trade to occur, and balance must be non-negative (can't buy more than sell)
            const rates = { metal: 1, crystal: 1.5, deuterium: 3 };
            let totalSellValue = 0;
            let totalBuyValue = 0;
            document.querySelectorAll('.sell-qty-input').forEach(i => totalSellValue += parseNumberShorthand(i.value) * (rates[i.dataset.res]));
            document.querySelectorAll('.buy-qty-input').forEach(i => totalBuyValue += parseNumberShorthand(i.value) * (rates[i.dataset.res]));
            
            disabled = disabled || (sellInputs === 0 && buyInputs === 0) || (totalSellValue < totalBuyValue);
        }
        launchBtn.disabled = disabled;
    }
};

window.maxResource = function(res, maxAmount) {
    const inputs = document.querySelectorAll('.res-qty-input');
    const input = Array.from(inputs).find(i => i.dataset.res === res);
    if (input) {
        // We need to check remaining cargo capacity
        const currentTotal = Array.from(inputs)
            .filter(i => i.dataset.res !== res)
            .reduce((sum, i) => sum + parseNumberShorthand(i.value), 0);
        
        const currentShips = {};
        document.querySelectorAll('.ship-qty-input').forEach(i => {
            const qty = parseNumberShorthand(i.value);
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
    const tradeData = { sell: {}, buy: {} };
    let totalShips = 0;
    const isMarket = missionType === MISSION_TYPES.MARKET_TRADE;
    const stayTime = document.getElementById('exp-stay-time') ? parseInt(document.getElementById('exp-stay-time').value) : 0;

    document.querySelectorAll('.ship-qty-input').forEach(input => {
        const qty = parseNumberShorthand(input.value);
        if (qty > 0) {
            shipsToSend[input.dataset.ship] = qty;
            totalShips += qty;
        }
    });

    if (totalShips === 0) {
        Notifications.showError('You must select at least one ship');
        return;
    }

    if (isMarket) {
        document.querySelectorAll('.sell-qty-input').forEach(input => {
            const qty = parseNumberShorthand(input.value);
            if (qty > 0) tradeData.sell[input.dataset.res] = qty;
        });
        document.querySelectorAll('.buy-qty-input').forEach(input => {
            const qty = parseNumberShorthand(input.value);
            if (qty > 0) tradeData.buy[input.dataset.res] = qty;
        });
    } else {
        document.querySelectorAll('.res-qty-input').forEach(input => {
            const qty = parseNumberShorthand(input.value);
            if (qty > 0) {
                resourcesToSend[input.dataset.res] = qty;
            }
        });
    }

    try {
        const response = await fetch('/api/game/galaxy/mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                missionType,
                targetCoords,
                ships: shipsToSend,
                resources: isMarket ? tradeData.sell : resourcesToSend,
                buyResources: isMarket ? tradeData.buy : null,
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

window.openMarketTrade = function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    openMissionModal(MISSION_TYPES.MARKET_TRADE, coords);
};

window.planAttackFromGalaxy = async function(position) {
    const coords = [window.currentGalaxy, window.currentSystem, position];
    const planetId = window.getCurrentPlanetId();
    
    if (!currentGameState?.allianceId) {
        Notifications.showError('You must be in an alliance to plan a coalition strike.');
        return;
    }

    const confirmed = await showConfirm('Plan Attack', `Establish coalition strike objective at ${coords.join(':')}? \n\nThis will create a tactical plan in your alliance operations center.`);
    if (!confirmed) return;

    try {
        await API.request('/game/alliance/plan/create', {
            method: 'POST',
            body: JSON.stringify({ hostPlanetId: planetId, targetCoords: coords })
        });
        Notifications.showSuccess('Operation objective established. Coordination link active in Alliance tab.');
    } catch (error) {
        Notifications.showError(`Planning failed: ${error.message}`);
    }
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
    
    // Determine target coordinates:
    // 1. If window.currentGalaxy/System are set (e.g. from navigation), use them.
    // 2. Otherwise default to the first planet's location.
    let targetGalaxy = window.currentGalaxy;
    let targetSystem = window.currentSystem;

    if (!targetGalaxy || !targetSystem) {
        const firstPlanet = gameState.planets[0];
        const [g, s] = firstPlanet.coordinates;
        targetGalaxy = g;
        targetSystem = s;
    }
    
    // Update module scope variables
    currentGalaxy = targetGalaxy;
    currentSystem = targetSystem;
    
    // Sync back to window to be safe
    window.currentGalaxy = currentGalaxy;
    window.currentSystem = currentSystem;
    
    // Render if coordinates changed OR if we haven't rendered yet
    // We also force render if the container is empty (e.g. view switch)
    if (lastRenderedGalaxy !== currentGalaxy || 
        lastRenderedSystem !== currentSystem || 
        container.innerHTML.trim() === '') {
        
        await loadAndRenderGalaxy(container, currentGalaxy, currentSystem, gameState);
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
                    <input type="text" inputmode="numeric" pattern="[0-9]*" id="galaxy-input" class="nav-coord-input" value="${galaxy}">
                    <button class="nav-arrow-btn" onclick="window.navigateGalaxy(1)">▶</button>
                </div>
                
                <div class="nav-item-group">
                    <span class="nav-item-label">System</span>
                    <button class="nav-arrow-btn" onclick="window.navigateSystem(-1)">◀</button>
                    <input type="text" inputmode="numeric" pattern="[0-9]*" id="system-input" class="nav-coord-input" value="${system}">
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
    const isGhost = planet.playerType === 'ghost';
    const moonBadge = planet.moon ? '<span class="moon-badge">🌙</span>' : '';
    const playerIcon = isGhost ? '👻' : (planet.playerType === 'player' ? '👨‍💼' : (planet.playerType === 'market' ? '🏛️' : '🤖'));
    const rowClass = isPlayerPlanet ? 'my-planet-row' : (planet.playerType === 'market' ? 'market-row' : (isGhost ? 'ghost-row' : ''));
    const planetTypeClass = isGhost ? 'ghost-planet-row' : (planet.playerType === 'player' ? 'player-planet-row' : (planet.playerType === 'market' ? 'market-planet-row' : 'ai-planet-row'));
    
    // Check relations
    let relation = currentGameState?.relations?.[planet.playerId] || 'none';
    
    // Automatically treat alliance members as friends
    if (relation === 'none' && currentGameState?.allianceId && planet.allianceId === currentGameState.allianceId) {
        relation = 'friend';
    }

    const relationClass = (relation !== 'none' && !isPlayerPlanet && planet.playerType !== 'market' && !isGhost) ? `relation-${relation}` : '';

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
            <div class="debris-scanner-tag" 
                 title="METAL: ${formatNumber(metal)} | CRYSTAL: ${formatNumber(crystal)}\nLEFT CLICK FOR RECOVERY OPTIONS"
                 onclick="window.openDebrisMenu(event, ${position}, ${metal}, ${crystal})">
                <span class="scanner-pulse"></span>
                <span class="debris-val">${formatNumber(metal + crystal)}</span>
            </div>
        `;
    }

    const statusLabel = isPlayerPlanet ? (isCurrentPlanet ? '🏠 Current' : '🏠 Own') : 
                       (planet.playerType === 'market' ? '⚖️ Market' : 
                       (isGhost ? '👻 Echo' : '👾 Other'));
    
    const statusClass = isPlayerPlanet ? 'status-own' : 
                       (planet.playerType === 'market' ? 'status-market' : 
                       (isGhost ? 'status-ghost' : 'status-other'));

    const ghostTierInfo = isGhost ? `<span class="ghost-tier-tag" title="Threat Level ${planet.tier}">T${planet.tier}</span>` : '';

    return `
        <tr class="planet-row ${rowClass} ${planetTypeClass} ${relationClass}">
            <td class="pos-col"><strong>${position}</strong></td>
            <td class="planet-col">
                <div class="planet-name-cell">
                    <div class="planet-icon-mini">${planet.playerType === 'market' ? '⚖️' : (isGhost ? '☄️' : '🌍')}</div>
                    <div class="planet-details">
                        <div class="planet-name">${planet.planetName} ${ghostTierInfo}</div>
                        <div class="planet-activity">Last: ${planet.activity}</div>
                    </div>
                    ${moonBadge}
                </div>
            </td>
            <td class="player-col">
                <div class="player-info ${planet.playerType !== 'market' && !isGhost ? 'clickable' : ''}" 
                     onclick="${planet.playerType !== 'market' && !isGhost ? `window.openRelationMenu(event, '${planet.playerId}', '${planet.player}')` : ''}">
                    ${playerIcon}
                    <span>${planet.allianceTag ? `<span class="galaxy-alliance-tag">[${planet.allianceTag}] </span>` : ''}${planet.player}</span>
                    ${(relation !== 'none' && planet.playerType !== 'market' && !isGhost) ? `<span class="relation-tag">${relation.toUpperCase()}</span>` : ''}
                </div>
            </td>
            <td class="status-col">
                <span class="status-badge ${statusClass}">
                    ${statusLabel}
                </span>
            </td>
            <td class="action-col">
                <div class="action-buttons">
                    ${planet.playerType === 'market' ? `
                        <button class="action-btn market-btn" onclick="window.openMarketTrade('${position}')" title="Trade Commodities">⚖️</button>
                    ` : (isPlayerPlanet ? `
                        <button class="action-btn view-btn" onclick="window.selectPlanetFromGalaxy(${position})" title="View planet">👁️</button>
                        <button class="action-btn transport-btn" onclick="window.transportToPlanetFromGalaxy(${position})" title="Transport Resources" ${isCurrentPlanet ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>🚚</button>
                        <button class="action-btn deploy-btn" onclick="window.deployToPlanetFromGalaxy(${position})" title="Deploy Fleet" ${isCurrentPlanet ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>🪂</button>
                    ` : `
                        <button class="action-btn info-btn" onclick="window.spyOnPlanetFromGalaxy(${position})" title="Spy">🕵️</button>
                        <button class="action-btn transport-btn" onclick="window.transportToPlanetFromGalaxy(${position})" title="Transport Resources">🚚</button>
                        <button class="action-btn attack-btn" onclick="window.attackPlanetFromGalaxy(${position})" title="Attack">⚔️</button>
                        ${currentGameState?.allianceId ? `<button class="action-btn plan-btn" onclick="window.planAttackFromGalaxy(${position})" title="Plan Coalition Strike" style="background: var(--accent-blue); color: white;">🎯</button>` : ''}
                    `)}
                    ${planet.debris ? `<button class="action-btn harvest-btn" onclick="window.harvestDebrisFromGalaxy(${position})" title="Recycle Debris">♻️</button>` : ''}
                </div>
            </td>
        </tr>
    `;
}

window.openRelationMenu = function(event, targetUserId, username) {
    event.preventDefault();
    event.stopPropagation();

    // Close any existing menu
    const existing = document.getElementById('relation-context-menu');
    if (existing) existing.remove();

    const currentRelation = currentGameState?.relations?.[targetUserId] || 'none';

    const menu = document.createElement('div');
    menu.id = 'relation-context-menu';
    menu.className = 'context-menu-scifi';
    
    menu.innerHTML = `
        <div class="menu-header">INTELLIGENCE CLASSIFICATION: ${username.toUpperCase()}</div>
        <button class="menu-item ${currentRelation === 'friend' ? 'active' : ''}" onclick="window.setPlayerRelation('${targetUserId}', 'friend')">
            <span class="indicator friend"></span> TAG AS FRIEND
        </button>
        <button class="menu-item ${currentRelation === 'enemy' ? 'active' : ''}" onclick="window.setPlayerRelation('${targetUserId}', 'enemy')">
            <span class="indicator enemy"></span> TAG AS ENEMY
        </button>
        ${currentRelation !== 'none' ? `
            <button class="menu-item" onclick="window.setPlayerRelation('${targetUserId}', 'none')">
                <span class="indicator clear"></span> REMOVE CLASSIFICATION
            </button>
        ` : ''}
    `;

    document.body.appendChild(menu);

    // Position menu next to mouse
    menu.style.left = `${event.pageX + 10}px`;
    menu.style.top = `${event.pageY + 10}px`;

    // Close handler
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    // Use timeout to avoid immediate close from current click
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
};

window.setPlayerRelation = async function(targetUserId, tag) {
    try {
        const relations = await API.updateRelation(targetUserId, tag);
        if (currentGameState) currentGameState.relations = relations;
        
        // Refresh view
        const container = document.getElementById('galaxy-view');
        if (container) {
            await loadAndRenderGalaxy(container, currentGalaxy, currentSystem, currentGameState);
        }
        
        // Remove menu
        const menu = document.getElementById('relation-context-menu');
        if (menu) menu.remove();
        
        Notifications.showSuccess(`Intelligence updated for subject.`);
    } catch (error) {
        Notifications.showError(`System error: ${error.message}`);
    }
};

/**
 * Render a table row for an empty position
 */
function renderOGameEmptyRow(position, debris = null) {
    let debrisHtml = '-';
    if (debris) {
        debrisHtml = `
            <div class="debris-scanner-tag" 
                 title="METAL: ${formatNumber(debris.metal)} | CRYSTAL: ${formatNumber(debris.crystal)}\nLEFT CLICK FOR RECOVERY OPTIONS"
                 onclick="window.openDebrisMenu(event, ${position}, ${debris.metal}, ${debris.crystal})">
                <span class="scanner-pulse"></span>
                <span class="debris-val">${formatNumber(debris.metal + debris.crystal)}</span>
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

window.openDebrisMenu = function(event, position, metal, crystal) {
    event.preventDefault();
    event.stopPropagation();

    // Close any existing menu
    const existing = document.getElementById('debris-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'debris-context-menu';
    menu.className = 'context-menu-scifi';
    
    const totalDebris = metal + crystal;
    const harvesterCapacity = SHIPS.recycler.cargoCapacity || 20000;
    const harvestersNeeded = Math.ceil(totalDebris / harvesterCapacity);

    menu.innerHTML = `
        <div class="menu-header">DEBRIS RECOVERY PROTOCOL</div>
        <button class="menu-item" onclick="window.quickHarvestDebris(${position}, ${harvestersNeeded})">
            <span class="indicator friend"></span> SIMPLE RECOVERY (${harvestersNeeded}x HARVESTER)
        </button>
        <button class="menu-item" onclick="window.harvestDebrisFromGalaxy(${position})">
            <span class="indicator clear"></span> ADVANCED CALIBRATION
        </button>
    `;

    document.body.appendChild(menu);

    // Position menu next to mouse
    menu.style.left = `${event.pageX + 10}px`;
    menu.style.top = `${event.pageY + 10}px`;

    // Close handler
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
};

window.quickHarvestDebris = async function(position, harvestersNeeded) {
    const planetId = window.getCurrentPlanetId();
    const planet = window.getCurrentPlanet();
    const targetCoords = [window.currentGalaxy, window.currentSystem, position];

    if (!planet) {
        Notifications.showError('No origin planet selected');
        return;
    }

    const availableHarvesters = planet.ships?.recycler || 0;
    const toSend = Math.min(harvestersNeeded, availableHarvesters);

    if (toSend <= 0) {
        Notifications.showError('No Harvester-Utility Vessels available on this planet.');
        return;
    }

    try {
        const response = await fetch('/api/game/galaxy/mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                missionType: MISSION_TYPES.HARVEST,
                targetCoords,
                ships: { recycler: toSend },
                originPlanetId: planetId
            })
        });

        const result = await response.json();
        if (result.success) {
            Notifications.showSuccess(`Simple Recovery initiated: ${toSend}x Harvester dispatched.`);
            const menu = document.getElementById('debris-context-menu');
            if (menu) menu.remove();
            if (window.loadGameState) await window.loadGameState();
        } else {
            Notifications.showError(`Protocol failure: ${result.error}`);
        }
    } catch (error) {
        Notifications.showError(`System error: ${error.message}`);
    }
};

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