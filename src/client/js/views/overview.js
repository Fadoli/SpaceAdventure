// Overview view logic
import { formatNumber } from '../utils.js';

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
                    <span class="detail-value" id="ov-planet-name">-</span>
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

    const { resources, storage, production, energyConsumption, energyEfficiency, coordinates, ships, defenses } = planet;
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
        if (energyEfficiency < 100) {
            warningContainer.innerHTML = `
                <div class="energy-warning">
                    ⚠️ Efficiency: ${energyEfficiency}%
                </div>
            `;
        } else {
            warningContainer.innerHTML = '';
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
    const { resources, production, energyConsumption, energyEfficiency, maxPopulation } = planet;
    
    const metalAmt = document.getElementById('metal-amount');
    const crystalAmt = document.getElementById('crystal-amount');
    const deutAmt = document.getElementById('deuterium-amount');
    
    if (metalAmt) metalAmt.textContent = formatNumber(resources.metal);
    if (crystalAmt) crystalAmt.textContent = formatNumber(resources.crystal);
    if (deutAmt) deutAmt.textContent = formatNumber(resources.deuterium);
    
    const energyAmt = document.getElementById('energy-amount');
    if (energyAmt) {
        const energyDisplay = production.energy >= 0 
            ? `${formatNumber(production.energy)}` 
            : `<span style="color: var(--accent-red)">${formatNumber(production.energy)}</span>`;
        energyAmt.innerHTML = energyDisplay;
    }
    
    const metalProdEl = document.getElementById('metal-production');
    const crystalProdEl = document.getElementById('crystal-production');
    const deutProdEl = document.getElementById('deuterium-production');
    
    const metalProdValue = energyEfficiency < 100 ? `${formatNumber(production.metal)} (${energyEfficiency}%)` : formatNumber(production.metal);
    const crystalProdValue = energyEfficiency < 100 ? `${formatNumber(production.crystal)} (${energyEfficiency}%)` : formatNumber(production.crystal);
    const deutProdValue = energyEfficiency < 100 ? `${formatNumber(production.deuterium)} (${energyEfficiency}%)` : formatNumber(production.deuterium);

    if (metalProdEl) metalProdEl.textContent = metalProdValue;
    if (crystalProdEl) crystalProdEl.textContent = crystalProdValue;
    if (deutProdEl) deutProdEl.textContent = deutProdValue;
    
    const waterAmt = document.getElementById('water-amount');
    const waterProd = document.getElementById('water-production');
    if (waterAmt) waterAmt.textContent = formatNumber(resources.water || 0);
    if (waterProd) waterProd.textContent = formatNumber(production.water || 0);
    
    const foodAmt = document.getElementById('food-amount');
    const foodProd = document.getElementById('food-production');
    if (foodAmt) foodAmt.textContent = formatNumber(resources.food || 0);
    if (foodProd) foodProd.textContent = formatNumber(production.food || 0);
    
    const popAmt = document.getElementById('population-amount');
    const popMax = document.getElementById('population-max');
    if (popAmt) popAmt.textContent = formatNumber(resources.population || 0);
    if (popMax) popMax.textContent = formatNumber(maxPopulation || 0);
}
