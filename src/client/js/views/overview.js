// Overview view logic
import { API } from '../api.js';
import { formatNumber, formatDuration } from '../utils.js';
import { showPrompt } from './modals.js';
import { Notifications } from '../notifications.js';
import { calculatePopulationChange, calculatePositionMultiplier } from '../../../shared/formulas.js';
import { getGameState, getCurrentPlanetId } from '../main.js';

let lastOverviewPlanetId = null;

// Global handler for planet selection
window.changePlanet = function(select) {
    const planetId = select.value;
    if (window.selectPlanet) {
        window.selectPlanet(planetId);
    } else {
        window.location.reload();
    }
};

window.renamePlanetUI = async function(planetId, currentName) {
    const newName = await showPrompt('Rename Planet', 'Enter new planet name (3-20 characters):', currentName);
    if (newName === null || newName === currentName) return;
    
    try {
        await API.renamePlanet(planetId, newName);
        // Refresh the whole state to update all UI parts (header select, overview, etc)
        // We can use a trick: trigger a "reload" of the current view by just calling updateUI via a global if possible
        // but since we want to be safe, let's just use window.location.reload() for this specific "structural" change
        // OR better: if selectPlanet is available, just call it with current ID to refresh
        if (window.selectPlanet) {
            window.selectPlanet(planetId);
        } else {
            window.location.reload();
        }
    } catch (error) {
        Notifications.showError('Failed to rename: ' + error.message);
    }
};

window.viewMyRank = async function() {
    try {
        const { index } = await API.getMyRank();
        // Calculate offset to show the player in the 100 entries page they belong to
        const offset = Math.max(0, Math.floor(index / 100) * 100);
        
        // Show ranking view using main.js helper
        if (window.showView) {
            window.showView('ranking');
            // Small delay to ensure view is active and then load specific offset
            setTimeout(() => {
                if (window.updateRankingView) {
                    window.updateRankingView(offset);
                }
            }, 50);
        }
    } catch (error) {
        Notifications.showError('Failed to find rank: ' + error.message);
    }
};

/**
 * Initialize the basic structure of the overview page
 */
function initializeOverviewStructure(container, planet, allPlanets) {
    const { coordinates } = planet;
    
    // Planet Selector HTML
    let selectorHtml = '';
    if (allPlanets && allPlanets.length > 1) {
        const options = allPlanets.map(p => 
            `<option value="${p.id}" ${p.id === planet.id ? 'selected' : ''}>
                ${p.name} [${p.coordinates.join(':')}]
            </option>`
        ).join('');
        
        selectorHtml = `
            <div class="planet-selector-container">
                <select class="planet-selector header-planet-select" onchange="window.changePlanet(this)">
                    ${options}
                </select>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="overview-header">
            <h2>System Intel: ${planet.name}</h2>
            ${selectorHtml}
        </div>

        <div class="planet-main-info">
            <div class="planet-visual-section">
                <div class="planet-image-large" id="ov-planet-visual">🌍</div>
                <div class="planet-name-container">
                    <span id="ov-planet-name">-</span>
                    <button class="btn-rename" onclick="window.renamePlanetUI('${planet.id}', document.getElementById('ov-planet-name').textContent)" title="Rename Planet">✏️</button>
                </div>
            </div>
            
            <div class="planet-stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Imperial Coordinates</div>
                    <div class="stat-value" id="ov-planet-coords">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Imperial Standing</div>
                    <div class="stat-value">
                        <button class="btn btn-primary btn-small" onclick="window.viewMyRank()" style="font-size: 0.7rem; width: 100%;">View Rank</button>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Orbital Garrison</div>
                    <div class="stat-value" id="ov-military-summary">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Strategic Intel: Deuterium</div>
                    <div class="stat-value" id="ov-bonus-deut">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Strategic Intel: Water</div>
                    <div class="stat-value" id="ov-bonus-water">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Strategic Intel: Food</div>
                    <div class="stat-value" id="ov-bonus-food">-</div>
                </div>
            </div>
        </div>
        
        <div class="production-report">
            <div class="section-header-technical">
                <h3>PLANETARY LOGISTICS & SUSTAINMENT</h3>
                <div class="header-line"></div>
            </div>
            <div class="production-grid">
                <div class="production-item metal">
                    <div class="prod-header">
                        <span class="prod-label">METAL</span>
                        <span class="prod-value" id="ov-res-metal">-</span>
                    </div>
                    <div class="storage-bar-container"><div class="storage-bar-fill" id="ov-bar-metal" style="width: 0%"></div></div>
                    <div id="ov-prod-metal" class="prod-net">-</div>
                </div>
                <div class="production-item crystal">
                    <div class="prod-header">
                        <span class="prod-label">CRYSTAL</span>
                        <span class="prod-value" id="ov-res-crystal">-</span>
                    </div>
                    <div class="storage-bar-container"><div class="storage-bar-fill" id="ov-bar-crystal" style="width: 0%"></div></div>
                    <div id="ov-prod-crystal" class="prod-net">-</div>
                </div>
                <div class="production-item deuterium">
                    <div class="prod-header">
                        <span class="prod-label">DEUTERIUM</span>
                        <span class="prod-value" id="ov-res-deuterium">-</span>
                    </div>
                    <div class="storage-bar-container"><div class="storage-bar-fill" id="ov-bar-deuterium" style="width: 0%"></div></div>
                    <div id="ov-prod-deuterium" class="prod-net">-</div>
                </div>
                <div class="production-item energy">
                    <div class="prod-header">
                        <span class="prod-label">ENERGY</span>
                        <span class="prod-value" id="ov-energy-net">-</span>
                    </div>
                    <div class="storage-bar-container"><div class="storage-bar-fill" id="ov-bar-energy" style="width: 0%"></div></div>
                    <div id="ov-energy-details" class="prod-net">
                        <span id="ov-energy-prod" class="text-success"></span><span class="sep">/</span><span id="ov-energy-cons" class="text-danger"></span>
                    </div>
                </div>
                <div class="production-item water">
                    <div class="prod-header">
                        <span class="prod-label">WATER</span>
                        <span class="prod-value" id="ov-res-water">-</span>
                    </div>
                    <div class="storage-bar-container"><div class="storage-bar-fill" id="ov-bar-water" style="width: 0%"></div></div>
                    <div id="ov-prod-water" class="prod-net">-</div>
                </div>
                <div class="production-item food">
                    <div class="prod-header">
                        <span class="prod-label">FOOD</span>
                        <span class="prod-value" id="ov-res-food">-</span>
                    </div>
                    <div class="storage-bar-container"><div class="storage-bar-fill" id="ov-bar-food" style="width: 0%"></div></div>
                    <div id="ov-prod-food" class="prod-net">-</div>
                </div>
                <div class="production-item population">
                    <div class="prod-header">
                        <span class="prod-label">POPULATION</span>
                        <span class="prod-value" id="ov-pop-val">-</span>
                    </div>
                    <div class="storage-bar-container"><div class="storage-bar-fill" id="ov-bar-population" style="width: 0%"></div></div>
                    <div id="ov-pop-prod" class="prod-net">-</div>
                </div>
            </div>
            <div id="ov-efficiency-warning-container"></div>
        </div>

        <div class="overview-card queue-card card-base" style="margin-top: 20px;">
            <h3>🔨 Active Command Queues</h3>
            <div class="queue-summary-list" id="ov-queue-list">
                <p class="empty-text">No active construction or production</p>
            </div>
        </div>

        <div class="empire-summary-section" style="margin-top: 30px;">
            <div class="section-header-technical">
                <h3>EMPIRE COMMAND CENTER</h3>
                <div class="header-line"></div>
            </div>
            <div id="empire-summary-table-container">
                <!-- Empire table will be rendered here -->
            </div>
        </div>
    `;
}

function renderEmpireTable(gameState) {
    let html = `
        <div class="empire-table-wrapper">
            <table class="empire-stats-table">
                <thead>
                    <tr>
                        <th class="planet-col">Planet</th>
                        <th class="res-col">Resources</th>
                        <th class="energy-col">Energy</th>
                        <th class="pop-col">Population</th>
                        <th class="queue-col">Active Queues</th>
                    </tr>
                </thead>
                <tbody>
    `;

    gameState.planets.forEach(planet => {
        const isCurrent = planet.id === getCurrentPlanetId();
        html += renderEmpirePlanetRow(planet, isCurrent);
    });

    html += `
                </tbody>
            </table>
        </div>
    `;
    return html;
}

function renderEmpirePlanetRow(planet, isCurrent) {
    const coords = `[${planet.coordinates.join(':')}]`;
    const getResClass = (type) => (planet.resources[type] >= planet.storage[type] * 0.9) ? 'text-warning' : '';
    const energyNet = planet.production.energy;
    const energyClass = energyNet < 0 ? 'text-error' : 'text-success';

    let queueHtml = '';
    if (planet.buildQueue && planet.buildQueue.length > 0) {
        const item = planet.buildQueue[0];
        queueHtml += `<div class="q-mini-item build"><span class="q-icon">🏗️</span> <span class="q-name">${item.building}</span> <span class="q-timer timer" data-finish="${item.finishTime}">-</span></div>`;
    }
    const shipQueueCount = planet.shipQueue?.length || 0;
    const defQueueCount = planet.defenseQueue?.length || 0;
    if (shipQueueCount > 0 || defQueueCount > 0) {
        const item = (planet.shipQueue?.[0] || planet.defenseQueue?.[0]);
        queueHtml += `<div class="q-mini-item shipyard"><span class="q-icon">🚀</span> <span class="q-name">Shipyard</span> <span class="q-timer timer" data-finish="${item.finishTime}">-</span></div>`;
    }
    if (!queueHtml) queueHtml = '<span class="empty-q">IDLE</span>';

    return `
        <tr class="empire-planet-row ${isCurrent ? 'current' : ''}" onclick="window.selectPlanet('${planet.id}')">
            <td class="planet-col">
                <div class="planet-identity">
                    <span class="p-name">${planet.name}</span>
                    <span class="p-coords">${coords}</span>
                </div>
            </td>
            <td class="res-col">
                <div class="res-grid-mini">
                    <div class="res-item ${getResClass('metal')}">⚙️ ${formatNumber(Math.floor(planet.resources.metal))}</div>
                    <div class="res-item ${getResClass('crystal')}">💎 ${formatNumber(Math.floor(planet.resources.crystal))}</div>
                    <div class="res-item ${getResClass('deuterium')}">🛢️ ${formatNumber(Math.floor(planet.resources.deuterium))}</div>
                </div>
            </td>
            <td class="energy-col">
                <div class="energy-info-mini">
                    <span class="${energyClass}">${formatNumber(Math.floor(energyNet))}</span>
                    <small>${planet.energyEfficiency}% EFF</small>
                </div>
            </td>
            <td class="pop-col">
                <div class="pop-info-mini">
                    <span>${formatNumber(Math.floor(planet.resources.population))}</span>
                    <small>/ ${formatNumber(planet.maxPopulation)}</small>
                </div>
            </td>
            <td class="queue-col">
                <div class="queues-summary">${queueHtml}</div>
            </td>
        </tr>
    `;
}

/**
 * Calculate planet temperature range based on position
 */
function calculateTemperature(position) {
    const maxTemp = Math.floor(80 - (position * 4)); 
    const minTemp = maxTemp - 40;
    return { min: minTemp, max: maxTemp };
}

/**
 * Update overview view with planet data
 */
export function updateOverview(planet, allPlanets = []) {
    const container = document.getElementById('overview-view');
    if (!container) return;

    // Initialize structure if planet changed or container is empty
    if (lastOverviewPlanetId !== planet.id || !container.querySelector('.planet-main-info')) {
        initializeOverviewStructure(container, planet, allPlanets);
        lastOverviewPlanetId = planet.id;
    }

    const { resources, storage, production, consumption, energyConsumption, energyEfficiency, populationEfficiency, coordinates, ships, defenses } = planet;
    const [galaxy, system, position] = coordinates;
    
    // Strategic Bonuses
    const deutBonus = calculatePositionMultiplier(position, 'deuterium');
    const waterBonus = calculatePositionMultiplier(position, 'water');
    const foodBonus = calculatePositionMultiplier(position, 'food');

    // Update simple text values
    const safeSetText = (id, val) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== val) el.textContent = val;
    };

    const formatBonus = (val) => {
        const percent = ((val - 1) * 100).toFixed(0);
        const sign = val >= 1 ? '+' : '';
        const color = val > 1 ? 'var(--accent-green)' : (val < 1 ? 'var(--accent-red)' : 'var(--text-secondary)');
        return `<span style="color: ${color}">${sign}${percent}%</span> <span style="font-size: 0.7rem; opacity: 0.6;">(${val.toFixed(1)}x)</span>`;
    };

    safeSetText('ov-planet-name', planet.name);
    safeSetText('ov-planet-coords', `[${coordinates.join(':')}]`);
    
    const deutEl = document.getElementById('ov-bonus-deut');
    if (deutEl) deutEl.innerHTML = formatBonus(deutBonus);
    
    const waterEl = document.getElementById('ov-bonus-water');
    if (waterEl) waterEl.innerHTML = formatBonus(waterBonus);
    
    const foodEl = document.getElementById('ov-bonus-food');
    if (foodEl) foodEl.innerHTML = formatBonus(foodBonus);
    
    // Simplified stats
    let shipCount = 0;
    if (ships) {
        for (const k in ships) shipCount += ships[k];
    }
    let defenseCount = 0;
    if (defenses) {
        for (const k in defenses) defenseCount += defenses[k];
    }
    safeSetText('ov-military-summary', `${formatNumber(shipCount)} Fleet Units / ${formatNumber(defenseCount)} Tactical Defenses`);

    // Update resources
    const resourceKeys = ['metal', 'crystal', 'deuterium', 'water', 'food'];
    resourceKeys.forEach(key => {
        const current = resources[key] || 0;
        const max = storage[key] || 10000;
        safeSetText(`ov-res-${key}`, `${formatNumber(current)} / ${formatNumber(max)}`);
        
        // Update bar
        const bar = document.getElementById(`ov-bar-${key}`);
        if (bar) {
            const percent = Math.min(100, (current / max) * 100);
            bar.style.width = `${percent}%`;
            // Color based on fullness
            if (percent > 90) bar.style.backgroundColor = 'var(--accent-red)';
            else if (percent > 75) bar.style.backgroundColor = 'var(--accent-yellow)';
            else bar.style.backgroundColor = 'var(--accent-blue)';
        }

        const prod = production[key] || 0;
        const cons = consumption?.[key] || 0;
        const net = prod - cons;
        const prodEl = document.getElementById(`ov-prod-${key}`);
        if (prodEl) {
            prodEl.textContent = (net >= 0 ? '+' : '') + formatNumber(net) + '/h';
            prodEl.className = `${net < 0 ? 'text-danger' : 'text-success'}`;
        }
    });

    const energyTotal = (production.energy || 0) + (energyConsumption || 0);
    const energyBalance = production.energy || 0;
    const isNegative = energyBalance < 0;

    safeSetText('ov-energy-prod', `${formatNumber(energyTotal)}`);
    safeSetText('ov-energy-cons', `${formatNumber(Math.abs(energyConsumption || 0))}`);
    
    const netEl = document.getElementById('ov-energy-net');
    if (netEl) {
        netEl.textContent = (energyBalance >= 0 ? '+' : '') + formatNumber(energyBalance);
        netEl.className = `prod-val ${isNegative ? 'text-danger' : 'text-success'}`;
    }

    // Energy Bar (Load %)
    const energyBar = document.getElementById('ov-bar-energy');
    if (energyBar) {
        const loadPercent = energyTotal > 0 ? Math.min(100, (Math.abs(energyConsumption || 0) / energyTotal) * 100) : 0;
        energyBar.style.width = `${loadPercent}%`;
        energyBar.style.backgroundColor = isNegative ? 'var(--accent-red)' : 'var(--accent-green)';
    }

    // Update population
    const currentPop = resources.population || 0;
    const maxPop = planet.maxPopulation || 100;
    safeSetText('ov-pop-val', `${formatNumber(currentPop)} / ${formatNumber(maxPop)}`);
    
    // Population Bar
    const popBar = document.getElementById('ov-bar-population');
    if (popBar) {
        const popPercent = Math.min(100, (currentPop / maxPop) * 100);
        popBar.style.width = `${popPercent}%`;
        popBar.style.backgroundColor = popPercent > 95 ? 'var(--accent-red)' : 'var(--population-color)';
    }

    const popProdEl = document.getElementById('ov-pop-prod');
    if (popProdEl) {
        const prodMult = window.GAME_CONFIG?.gameSpeed?.resourceProduction || 1.0;
        const nextPop = calculatePopulationChange(
            resources.population || 0,
            planet.maxPopulation || 0,
            (resources.food || 0) > 0,
            (resources.water || 0) > 0,
            1,
            prodMult
        );
        const netChange = nextPop - (resources.population || 0);
        popProdEl.textContent = (netChange >= 0 ? '+' : '') + formatNumber(netChange) + '/h';
        popProdEl.className = `prod-net ${netChange < 0 ? 'text-danger' : (netChange > 0 ? 'text-success' : '')}`;
    }

    // Warnings
    const warningContainer = document.getElementById('ov-efficiency-warning-container');
    if (warningContainer) {
        let warnings = '';
        if (energyEfficiency !== undefined && energyEfficiency < 100) {
            warnings += `<div class="efficiency-warning text-warning">⚠️ Energy Efficiency: ${energyEfficiency}%</div>`;
        }
        if (populationEfficiency !== undefined && populationEfficiency < 100) {
            warnings += `<div class="efficiency-warning text-warning">⚠️ Population Efficiency: ${populationEfficiency}%</div>`;
        }
        warningContainer.innerHTML = warnings;
    }

    // Update Queue Summary
    const queueList = document.getElementById('ov-queue-list');
    if (queueList) {
        const activeQueues = [];
        
        // Building Queue
        if (planet.buildQueue && planet.buildQueue.length > 0) {
            const item = planet.buildQueue[0];
            activeQueues.push(`<div>🏗️ Building: <strong>${item.building}</strong> (Lvl ${item.level}) <span class="timer" data-finish="${item.finishTime}">-</span></div>`);
        }
        
        // Ship Queue
        if (planet.shipQueue && planet.shipQueue.length > 0) {
            const item = planet.shipQueue[0];
            activeQueues.push(`<div>🚀 Shipyard: Active Production <span class="timer" data-finish="${item.finishTime}">-</span></div>`);
        }

        // Defense Queue
        if (planet.defenseQueue && planet.defenseQueue.length > 0) {
            const item = planet.defenseQueue[0];
            activeQueues.push(`<div>🛡️ Defenses: Active Production <span class="timer" data-finish="${item.finishTime}">-</span></div>`);
        }

        if (activeQueues.length > 0) {
            queueList.innerHTML = activeQueues.join('');
        } else {
            queueList.innerHTML = '<p class="empty-text">No active construction or production</p>';
        }
    }

    // Update Empire Table
    const empireContainer = document.getElementById('empire-summary-table-container');
    if (empireContainer) {
        const gameState = getGameState();
        if (gameState) {
            empireContainer.innerHTML = renderEmpireTable(gameState);
        }
    }

    const visualEl = document.getElementById('ov-planet-visual');
    if (visualEl) {
        visualEl.style.filter = `hue-rotate(${position * 20}deg)`;
    }
}

/**
 * Update resource display in header (unchanged, but ensuring null checks from previous step)
 */
export function updateResources(planet) {
    const { resources, production, consumption, energyConsumption, energyEfficiency, populationEfficiency, maxPopulation } = planet;
    
    const metalAmt = document.getElementById('metal-amount');
    const crystalAmt = document.getElementById('crystal-amount');
    const deutAmt = document.getElementById('deuterium-amount');
    
    if (metalAmt) metalAmt.textContent = formatNumber(resources.metal);
    if (crystalAmt) crystalAmt.textContent = formatNumber(resources.crystal);
    if (deutAmt) deutAmt.textContent = formatNumber(resources.deuterium);
    
    const energyAmt = document.getElementById('energy-amount');
    if (energyAmt) {
        // Balance is already net in production.energy
        const energyDisplay = production.energy >= 0 
            ? `${formatNumber(production.energy)}` 
            : `<span style="color: var(--accent-red)">${formatNumber(production.energy)}</span>`;
        energyAmt.innerHTML = energyDisplay;
    }

    const energyProdEl = document.getElementById('energy-production');
    if (energyProdEl) {
        const grossEnergyProd = (production.energy || 0) + (energyConsumption || 0);
        energyProdEl.textContent = `+${formatNumber(grossEnergyProd)} -${formatNumber(energyConsumption || 0)}`;
    }
    
    const metalProdEl = document.getElementById('metal-production');
    const crystalProdEl = document.getElementById('crystal-production');
    const deutProdEl = document.getElementById('deuterium-production');
    
    // Determine lowest efficiency to display
    let efficiency = 100;
    if (energyEfficiency !== undefined && energyEfficiency < 100) efficiency = energyEfficiency;
    if (populationEfficiency !== undefined && populationEfficiency < efficiency) efficiency = populationEfficiency;
    
    const displaySuffix = efficiency < 100 ? ` (${efficiency}%)` : '';
    
    const formatProd = (val) => (val >= 0 ? '+' : '') + formatNumber(val) + displaySuffix;

    if (metalProdEl) metalProdEl.textContent = formatProd(production.metal);
    if (crystalProdEl) crystalProdEl.textContent = formatProd(production.crystal);
    if (deutProdEl) deutProdEl.textContent = formatProd(production.deuterium);
    
    const waterAmt = document.getElementById('water-amount');
    const waterProd = document.getElementById('water-production');
    if (waterAmt) waterAmt.textContent = formatNumber(resources.water || 0);
    if (waterProd) {
        const netWater = (production.water || 0) - (consumption?.water || 0);
        waterProd.textContent = formatProd(netWater);
        waterProd.style.color = netWater < 0 ? 'var(--accent-red)' : '';
    }
    
    const foodAmt = document.getElementById('food-amount');
    const foodProd = document.getElementById('food-production');
    if (foodAmt) foodAmt.textContent = formatNumber(resources.food || 0);
    if (foodProd) {
        const netFood = (production.food || 0) - (consumption?.food || 0);
        foodProd.textContent = formatProd(netFood);
        foodProd.style.color = netFood < 0 ? 'var(--accent-red)' : '';
    }
    
    const popAmt = document.getElementById('population-amount');
    const popMax = document.getElementById('population-max');
    const popProd = document.getElementById('population-production');
    
    if (popAmt) popAmt.textContent = formatNumber(resources.population || 0);
    if (popMax) popMax.textContent = formatNumber(maxPopulation || 0);
    
    if (popProd) {
        const currentPopulation = resources.population || 0;
        const foodAvailable = (resources.food || 0) > 0;
        const waterAvailable = (resources.water || 0) > 0;
        const prodMult = window.GAME_CONFIG?.gameSpeed?.resourceProduction || 1.0;
        
        // Calculate population after 1 hour to see net change
        const nextPop = calculatePopulationChange(
            currentPopulation,
            maxPopulation,
            foodAvailable,
            waterAvailable,
            1, // 1 hour
            prodMult
        );
        
        const netChange = nextPop - currentPopulation;
        const sign = netChange >= 0 ? '+' : '';
        popProd.textContent = sign + formatNumber(netChange);
        popProd.style.color = netChange < 0 ? 'var(--accent-red)' : (netChange > 0 ? 'var(--accent-green)' : '');
    }
}
