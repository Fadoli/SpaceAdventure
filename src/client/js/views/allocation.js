// Building allocation view - manage power and population allocation
import { getCurrentPlanet } from '../main.js';
import { makeRequest } from '../api.js';

/**
 * Render allocation management view
 */
export async function renderAllocation() {
  const planet = getCurrentPlanet();
  if (!planet) {
    return '<div class="error">No planet selected</div>';
  }
  
  // Buildings that can have allocation (production buildings with workers)
  const allocatableBuildings = [
    'metalMine',
    'crystalMine',
    'deuteriumSynthesizer',
    'waterExtractor',
    'farm'
  ];
  
  // Calculate totals
  let totalPowerAllocated = 0;
  let totalPopulationAllocated = 0;
  
  for (const buildingType of allocatableBuildings) {
    const level = planet.buildings[buildingType] || 0;
    if (level > 0) {
      const allocation = planet.buildingAllocations?.[buildingType] || { power: 1.0, population: 1.0 };
      
      // Calculate actual power consumption (simplified)
      const building = getBuildingInfo(buildingType);
      if (building?.energyConsumption) {
        totalPowerAllocated += building.energyConsumption * level * allocation.power;
      }
      
      // Calculate actual population requirement (simplified)
      if (building?.populationRequired) {
        totalPopulationAllocated += building.populationRequired * level * allocation.population;
      }
    }
  }
  
  const currentPopulation = planet.resources?.population || 0;
  const maxPopulation = planet.maxPopulation || 0;
  const availableEnergy = planet.production?.energy || 0;
  
  let html = `
    <div class="allocation-view">
      <h2>⚙️ Resource Allocation</h2>
      
      <div class="allocation-summary">
        <div class="summary-card">
          <h3>⚡ Power Status</h3>
          <div class="resource-bar">
            <div class="bar-fill" style="width: ${Math.min(100, (totalPowerAllocated / Math.max(1, availableEnergy)) * 100)}%"></div>
          </div>
          <p>${totalPowerAllocated.toFixed(0)} / ${availableEnergy.toFixed(0)} Energy</p>
        </div>
        
        <div class="summary-card">
          <h3>👥 Population Status</h3>
          <div class="resource-bar">
            <div class="bar-fill" style="width: ${Math.min(100, (totalPopulationAllocated / Math.max(1, currentPopulation)) * 100)}%"></div>
          </div>
          <p>${totalPopulationAllocated.toFixed(0)} / ${currentPopulation.toFixed(0)} Workers</p>
          <small>Max Population: ${maxPopulation.toFixed(0)}</small>
        </div>
      </div>
      
      <div class="allocation-info">
        <h3>ℹ️ Allocation Guide</h3>
        <ul>
          <li><strong>50%</strong> allocation → <strong>~70%</strong> effectiveness</li>
          <li><strong>100%</strong> allocation → <strong>100%</strong> effectiveness</li>
          <li><strong>200%</strong> allocation → <strong>~150%</strong> effectiveness (diminishing returns)</li>
        </ul>
        <p>Both power and population effectiveness multiply together!</p>
      </div>
      
      <h3>🏭 Building Allocations</h3>
      <div class="allocation-list">
  `;
  
  for (const buildingType of allocatableBuildings) {
    const level = planet.buildings[buildingType] || 0;
    if (level === 0) continue;
    
    const building = getBuildingInfo(buildingType);
    const allocation = planet.buildingAllocations?.[buildingType] || { power: 1.0, population: 1.0 };
    
    // Calculate effectiveness
    const powerEffectiveness = calculateEffectiveness(allocation.power);
    const populationEffectiveness = calculateEffectiveness(allocation.population);
    const totalEffectiveness = powerEffectiveness * populationEffectiveness;
    
    html += `
      <div class="allocation-item" data-building="${buildingType}">
        <div class="allocation-header">
          <h4>${building.icon} ${building.name} (Level ${level})</h4>
          <span class="effectiveness-badge ${getEffectivenessClass(totalEffectiveness)}">
            ${(totalEffectiveness * 100).toFixed(0)}% Effective
          </span>
        </div>
        
        <div class="allocation-controls">
          <div class="allocation-slider">
            <label>⚡ Power: <span class="value">${(allocation.power * 100).toFixed(0)}%</span></label>
            <input 
              type="range" 
              class="power-slider" 
              min="0" 
              max="200" 
              value="${allocation.power * 100}"
              data-building="${buildingType}"
            >
            <small>Effectiveness: ${(powerEffectiveness * 100).toFixed(0)}%</small>
          </div>
          
          <div class="allocation-slider">
            <label>👥 Workers: <span class="value">${(allocation.population * 100).toFixed(0)}%</span></label>
            <input 
              type="range" 
              class="population-slider" 
              min="0" 
              max="200" 
              value="${allocation.population * 100}"
              data-building="${buildingType}"
            >
            <small>Effectiveness: ${(populationEffectiveness * 100).toFixed(0)}%</small>
          </div>
        </div>
      </div>
    `;
  }
  
  html += `
      </div>
      
      <button class="btn-primary apply-allocations">Apply All Changes</button>
    </div>
  `;
  
  return html;
}

/**
 * Setup allocation event handlers
 */
export function setupAllocationHandlers() {
  // Update slider value displays
  document.querySelectorAll('.power-slider, .population-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const value = e.target.value;
      const label = e.target.parentElement.querySelector('.value');
      if (label) {
        label.textContent = `${value}%`;
      }
      
      // Update effectiveness display
      const effectiveness = calculateEffectiveness(value / 100);
      const small = e.target.parentElement.querySelector('small');
      if (small) {
        small.textContent = `Effectiveness: ${(effectiveness * 100).toFixed(0)}%`;
      }
      
      // Update combined effectiveness badge
      updateEffectivenessBadge(e.target.dataset.building);
    });
  });
  
  // Apply all changes
  const applyBtn = document.querySelector('.apply-allocations');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      await applyAllAllocations();
    });
  }
}

/**
 * Update effectiveness badge for a building
 */
function updateEffectivenessBadge(buildingType) {
  const item = document.querySelector(`.allocation-item[data-building="${buildingType}"]`);
  if (!item) return;
  
  const powerSlider = item.querySelector('.power-slider');
  const populationSlider = item.querySelector('.population-slider');
  
  if (!powerSlider || !populationSlider) return;
  
  const powerPercent = parseFloat(powerSlider.value) / 100;
  const populationPercent = parseFloat(populationSlider.value) / 100;
  
  const powerEff = calculateEffectiveness(powerPercent);
  const popEff = calculateEffectiveness(populationPercent);
  const totalEff = powerEff * popEff;
  
  const badge = item.querySelector('.effectiveness-badge');
  if (badge) {
    badge.textContent = `${(totalEff * 100).toFixed(0)}% Effective`;
    badge.className = `effectiveness-badge ${getEffectivenessClass(totalEff)}`;
  }
}

/**
 * Apply all allocation changes
 */
async function applyAllAllocations() {
  const planet = getCurrentPlanet();
  if (!planet) return;
  
  const allocations = {};
  
  // Collect all allocations
  document.querySelectorAll('.allocation-item').forEach(item => {
    const buildingType = item.dataset.building;
    const powerSlider = item.querySelector('.power-slider');
    const populationSlider = item.querySelector('.population-slider');
    
    if (powerSlider && populationSlider) {
      allocations[buildingType] = {
        power: parseFloat(powerSlider.value) / 100,
        population: parseFloat(populationSlider.value) / 100
      };
    }
  });
  
  // Send to server
  try {
    for (const [buildingType, allocation] of Object.entries(allocations)) {
      await makeRequest(`/api/planet/${planet.id}/building/${buildingType}/allocation`, 'POST', {
        power: allocation.power,
        population: allocation.population
      });
    }
    
    // Refresh the view
    window.showView('allocation');
    alert('Allocations updated successfully!');
  } catch (error) {
    console.error('Failed to update allocations:', error);
    alert('Failed to update allocations: ' + error.message);
  }
}

/**
 * Calculate effectiveness from allocation percentage
 */
function calculateEffectiveness(allocationPercent) {
  if (allocationPercent <= 0) return 0;
  
  if (allocationPercent <= 1.0) {
    return Math.sqrt(allocationPercent);
  } else {
    const excess = allocationPercent - 1.0;
    return 1.0 + (excess * 0.5 * Math.pow(0.5, excess));
  }
}

/**
 * Get effectiveness class for styling
 */
function getEffectivenessClass(effectiveness) {
  if (effectiveness >= 1.2) return 'excellent';
  if (effectiveness >= 0.9) return 'good';
  if (effectiveness >= 0.6) return 'medium';
  return 'low';
}

/**
 * Get building info (simplified, should match server data)
 */
function getBuildingInfo(buildingType) {
  const buildings = {
    metalMine: { name: 'Metal Mine', icon: '⚙️', energyConsumption: 10, populationRequired: 5 },
    crystalMine: { name: 'Crystal Mine', icon: '💎', energyConsumption: 10, populationRequired: 5 },
    deuteriumSynthesizer: { name: 'Deuterium Synthesizer', icon: '🛢️', energyConsumption: 20, populationRequired: 8 },
    waterExtractor: { name: 'Water Extractor', icon: '💧', energyConsumption: 8, populationRequired: 5 },
    farm: { name: 'Farm', icon: '🌾', energyConsumption: 5, populationRequired: 8 }
  };
  
  return buildings[buildingType];
}
