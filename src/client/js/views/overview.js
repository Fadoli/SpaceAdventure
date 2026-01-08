// Overview view logic
import { API } from '../api.js';
import { formatNumber } from '../utils.js';
import { showPrompt } from './modals.js';
import { Notifications } from '../notifications.js';
import { calculatePopulationChange } from '../../../shared/formulas.js';

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

/**
 * Initialize the basic structure of the overview page
 */
function initializeOverviewStructure(container, planet, allPlanets) {
    const { coordinates } = planet;
    const [galaxy, system, position] = coordinates;
    
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
                <select class="planet-selector" onchange="window.changePlanet(this)">
                    ${options}
                </select>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="overview-header">
            <h2>Planet Overview</h2>
            ${selectorHtml}
        </div>

        <div class="planet-profile">
            <div class="planet-image">
                <div class="planet-visual" id="ov-planet-visual">🌍</div>
            </div>
            
            <div class="planet-details-table">
                <div class="detail-row">
                    <span class="detail-label">Planet</span>
                    <span class="detail-value">
                        <span id="ov-planet-name">-</span>
                        <button class="btn-icon-small" onclick="window.renamePlanetUI('${planet.id}', document.getElementById('ov-planet-name').textContent)" title="Rename Planet">✏️</button>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Coordinates</span>
                    <span class="detail-value" id="ov-planet-coords">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Diameter</span>
                    <span class="detail-value" id="ov-planet-diameter">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Temperature</span>
                    <span class="detail-value" id="ov-planet-temp">-</span>
                </div>
                 <div class="detail-row">
                    <span class="detail-label">Military</span>
                    <span class="detail-value" id="ov-military-summary">-</span>
                </div>
            </div>
        </div>
        
        <div class="overview-grid">
            <div class="overview-card resources-card">
                <h3>Resource Storage</h3>
                <div class="resource-detail-list">
                    <div class="res-row">
                        <span class="res-name metal">Metal</span>
                        <span class="res-val" id="ov-res-metal">-</span>
                    </div>
                    <div class="res-row">
                        <span class="res-name crystal">Crystal</span>
                        <span class="res-val" id="ov-res-crystal">-</span>
                    </div>
                    <div class="res-row">
                        <span class="res-name deuterium">Deuterium</span>
                        <span class="res-val" id="ov-res-deuterium">-</span>
                    </div>
                </div>
            </div>
            
            <div class="overview-card energy-card">
                <h3>Energy Systems</h3>
                <div class="resource-detail-list">
                    <div class="res-row">
                        <span class="res-name energy">Production</span>
                        <span class="res-val text-success" id="ov-energy-prod">-</span>
                    </div>
                    <div class="res-row">
                        <span class="res-name energy">Consumption</span>
                        <span class="res-val text-warning" id="ov-energy-cons">-</span>
                    </div>
                    <div class="res-row total-row">
                        <span class="res-name energy">Net Balance</span>
                        <span class="res-val" id="ov-energy-net">-</span>
                    </div>
                    <div id="ov-energy-warning-container"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Calculate planet fields
 */
function calculateFields(planet) {
    const used = Object.values(planet.buildings || {}).reduce((sum, level) => sum + level, 0);
    const base = 163; // Standard starter size
    const terraformer = (planet.buildings?.terraformer || 0) * 5;
    const total = base + terraformer;
    return { used, total };
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
    if (lastOverviewPlanetId !== planet.id || !container.querySelector('.planet-profile')) {
        initializeOverviewStructure(container, planet, allPlanets);
        lastOverviewPlanetId = planet.id;
    }

    const { resources, storage, production, energyConsumption, energyEfficiency, populationEfficiency, coordinates, ships, defenses } = planet;
    const [galaxy, system, position] = coordinates;
    const { used, total } = calculateFields(planet);
    const { min, max } = calculateTemperature(position);
    
    // Update simple text values
    const safeSetText = (id, val) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== val) el.textContent = val;
    };

    safeSetText('ov-planet-name', planet.name);
    safeSetText('ov-planet-coords', `[${coordinates.join(':')}]`);
    safeSetText('ov-planet-diameter', `12,800km (${used}/${total} fields)`);
    safeSetText('ov-planet-temp', `${min}°C to ${max}°C`);
    
    const shipCount = Object.values(ships || {}).reduce((a, b) => a + b, 0);
    const defenseCount = Object.values(defenses || {}).reduce((a, b) => a + b, 0);
    safeSetText('ov-military-summary', `${formatNumber(shipCount)} Ships, ${formatNumber(defenseCount)} Defenses`);

    // Update resources
    safeSetText('ov-res-metal', `${formatNumber(resources.metal)} / ${formatNumber(storage.metal)}`);
    safeSetText('ov-res-crystal', `${formatNumber(resources.crystal)} / ${formatNumber(storage.crystal)}`);
    safeSetText('ov-res-deuterium', `${formatNumber(resources.deuterium)} / ${formatNumber(storage.deuterium)}`);

    // Update energy
    const energyTotal = production.energy + (energyConsumption || 0);
    const energyBalance = production.energy;
    const isNegative = energyBalance < 0;

    safeSetText('ov-energy-prod', `+${formatNumber(energyTotal)}`);
    safeSetText('ov-energy-cons', `-${formatNumber(Math.abs(energyConsumption || 0))}`);
    
    const netEl = document.getElementById('ov-energy-net');
    if (netEl) {
        netEl.textContent = formatNumber(energyBalance);
        netEl.className = `res-val ${isNegative ? 'text-danger' : 'text-success'}`;
    }

    const warningContainer = document.getElementById('ov-energy-warning-container');
    if (warningContainer) {
        let warnings = '';
        if (energyEfficiency !== undefined && energyEfficiency < 100) {
            warnings += `<div class="energy-warning">⚠️ Power Efficiency: ${energyEfficiency}%</div>`;
        }
        if (populationEfficiency !== undefined && populationEfficiency < 100) {
            warnings += `<div class="energy-warning">⚠️ Pop. Efficiency: ${populationEfficiency}%</div>`;
        }
        warningContainer.innerHTML = warnings;
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
