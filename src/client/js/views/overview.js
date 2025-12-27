// Overview view logic
import { formatNumber } from '../utils.js';

/**
 * Update overview view with planet data
 */
export function updateOverview(planet) {
    const { resources, storage, buildings, production, energyConsumption, energyEfficiency } = planet;
    
    document.getElementById('overview-metal').textContent = formatNumber(resources.metal);
    document.getElementById('overview-crystal').textContent = formatNumber(resources.crystal);
    document.getElementById('overview-deuterium').textContent = formatNumber(resources.deuterium);
    
    document.getElementById('overview-metal-storage').textContent = formatNumber(storage.metal);
    document.getElementById('overview-crystal-storage').textContent = formatNumber(storage.crystal);
    document.getElementById('overview-deuterium-storage').textContent = formatNumber(storage.deuterium);
    
    // Buildings list (only update if element exists)
    const buildingsList = document.getElementById('buildings-list');
    if (buildingsList) {
        const buildingsHtml = [];
        for (const building in buildings) {
            const level = buildings[building];
            if (level > 0) {
                const name = building.replace(/([A-Z])/g, ' $1').trim();
                const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                buildingsHtml.push(`<div>${capitalizedName}: Level ${level}</div>`);
            }
        }
        buildingsList.innerHTML = buildingsHtml.join('') || '<p class="empty">No buildings yet</p>';
    }
    
    // Energy overview (only update if element exists)
    const energyOverview = document.getElementById('energy-overview');
    if (energyOverview) {
        const energyProduction = production.energy + (energyConsumption || 0);
        const energyBalance = production.energy;
        const isNegative = energyBalance < 0;
        
        energyOverview.innerHTML = `
            <div>Production: <span style="color: var(--accent-green)">${energyProduction}</span></div>
            <div>Consumption: <span style="color: var(--accent-yellow)">${energyConsumption || 0}</span></div>
            <div>Balance: <span style="color: ${isNegative ? 'var(--accent-red)' : 'var(--accent-green)'}">
                ${energyBalance}
            </span></div>
            ${energyEfficiency < 100 ? `
                <div style="color: var(--accent-red); font-weight: bold; margin-top: 10px;">
                    ⚠️ Not enough energy!<br>
                    Production efficiency: ${energyEfficiency}%
                </div>
            ` : ''}
        `;
    }
}

/**
 * Update resource display in header
 */
export function updateResources(planet) {
    const { resources, production, energyConsumption, energyEfficiency, maxPopulation } = planet;
    
    document.getElementById('metal-amount').textContent = formatNumber(resources.metal);
    document.getElementById('crystal-amount').textContent = formatNumber(resources.crystal);
    document.getElementById('deuterium-amount').textContent = formatNumber(resources.deuterium);
    
    // Energy display shows net energy
    const energyProduction = production.energy + (energyConsumption || 0);
    const energyDisplay = production.energy >= 0 
        ? `${formatNumber(production.energy)}` 
        : `<span style="color: var(--accent-red)">${formatNumber(production.energy)}</span>`;
    document.getElementById('energy-amount').textContent = '';
    document.getElementById('energy-amount').innerHTML = energyDisplay;
    
    // Show efficiency warning if low energy
    const metalProd = energyEfficiency < 100 
        ? `${production.metal} (${energyEfficiency}%)` 
        : production.metal;
    const crystalProd = energyEfficiency < 100 
        ? `${production.crystal} (${energyEfficiency}%)` 
        : production.crystal;
    const deutProd = energyEfficiency < 100 
        ? `${production.deuterium} (${energyEfficiency}%)` 
        : production.deuterium;
    
    document.getElementById('metal-production').textContent = metalProd;
    document.getElementById('crystal-production').textContent = crystalProd;
    document.getElementById('deuterium-production').textContent = deutProd;
    
    // New resources
    if (document.getElementById('water-amount')) {
        document.getElementById('water-amount').textContent = formatNumber(resources.water || 0);
        document.getElementById('water-production').textContent = production.water || 0;
    }
    
    if (document.getElementById('food-amount')) {
        document.getElementById('food-amount').textContent = formatNumber(resources.food || 0);
        document.getElementById('food-production').textContent = production.food || 0;
    }
    
    if (document.getElementById('population-amount')) {
        document.getElementById('population-amount').textContent = formatNumber(resources.population || 0);
        document.getElementById('population-max').textContent = formatNumber(maxPopulation || 0);
    }
}
