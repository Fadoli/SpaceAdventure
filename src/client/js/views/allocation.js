// Building allocation view - manage power and population allocation
import { getCurrentPlanet } from '../main.js';
import { API } from '../api.js';
import { calculateAllocationEffectiveness, getBuildingEnergyConsumption, getBuildingPopulationRequired } from '../../../shared/formulas.js';
import { BUILDINGS } from '../../../shared/buildings.js';

// Track saved allocation state to avoid overwriting user input during updates
let savedAllocations = {};

/**
 * Get limiting factor badge showing what constrains efficiency
 */
function getLimitingFactorBadge(baseEnergyRequired, basePopulationRequired, powerAllocation, populationAllocation, energyAvailable, populationAvailable, totalEnergyAllocated, totalPopulationAllocated) {
  // If no energy required, population is the only limiter
  if (baseEnergyRequired === 0) {
    // Check if we have population shortfall
    if (totalPopulationAllocated > populationAvailable) {
      return '<span class="limiting-badge limiting-population" title="Population shortage - not enough workers available">Limited by: 👥</span>';
    }
    return '';
  }
  
  // Check if we have shortages for this specific building
  const energyRequired = baseEnergyRequired * powerAllocation;
  const populationRequired = basePopulationRequired * populationAllocation;
  
  // Determine limiting factors
  const hasEnergyShortage = totalEnergyAllocated > energyAvailable;
  const hasPopulationShortage = totalPopulationAllocated > populationAvailable;
  
  // If both have shortages
  if (hasEnergyShortage && hasPopulationShortage) {
    return '<span class="limiting-badge limiting-balanced" title="Both electricity and population are in shortage">Limited by: ⚡👥</span>';
  }
  
  // If only energy is short
  if (hasEnergyShortage) {
    return '<span class="limiting-badge limiting-power" title="Electricity shortage - not enough power available">Limited by: ⚡</span>';
  }
  
  // If only population is short
  if (hasPopulationShortage) {
    return '<span class="limiting-badge limiting-population" title="Population shortage - not enough workers available">Limited by: 👥</span>';
  }
  
  // No shortages - nothing is limiting
  return '';
}

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
    'farm',
    'solarPlant',
    'roboticsFactory',
    'researchLab'
  ];
  
  // Calculate totals
  let totalPowerAllocated = 0;
  let totalPopulationAllocated = 0;
  
  for (const buildingType of allocatableBuildings) {
    const level = planet.buildings[buildingType] || 0;
    if (level > 0) {
      const allocation = planet.buildingAllocations?.[buildingType] || { power: 1.0, population: 1.0 };
      
      // Calculate actual power consumption using shared function
      const baseEnergyRequired = await getBuildingEnergyConsumption(buildingType, level, BUILDINGS);
      totalPowerAllocated += baseEnergyRequired * allocation.power;
      
      // Calculate actual population requirement using shared function
      const basePopulationRequired = await getBuildingPopulationRequired(buildingType, level, BUILDINGS);
      totalPopulationAllocated += basePopulationRequired * allocation.population;
    }
  }
  
  const currentPopulation = planet.resources?.population || 0;
  const maxPopulation = planet.maxPopulation || 0;
  // Use the actual planet energy data (includes all buildings)
  const energyBalance = planet.production?.energy || 0;
  const consumedPowerTotal = planet.energyConsumption || 0;
  const producedPower = energyBalance + consumedPowerTotal;
  
  // Note: totalPowerAllocated is only for allocatable buildings with workers
  // The actual planet may consume more energy from non-allocatable buildings
  const allocatableEnergyConsumption = totalPowerAllocated;
  const otherEnergyConsumption = Math.max(0, consumedPowerTotal - allocatableEnergyConsumption);
  
  let html = `
    <div class="allocation-view">
      <h2>⚙️ Resource Allocation</h2>
      
      <div class="allocation-summary">
        <div class="summary-card">
          <h3>⚡ Power Status</h3>
          <div class="resource-bar">
            <div class="bar-fill" style="width: ${Math.min(100, Math.max(0, (consumedPowerTotal / Math.max(1, producedPower)) * 100))}%"></div>
          </div>
          <p><strong>Produced:</strong> ${producedPower.toFixed(0)}</p>
          <p><strong>Consumed (Total):</strong> ${consumedPowerTotal.toFixed(0)}</p>
          <p style="margin-left: 20px; font-size: 0.9em; color: var(--text-secondary);">└─ Allocatable: ${allocatableEnergyConsumption.toFixed(0)}</p>
          <p style="margin-left: 20px; font-size: 0.9em; color: var(--text-secondary);">└─ Other: ${otherEnergyConsumption.toFixed(0)}</p>
          <p><strong>Balance:</strong> <span style="color: ${(producedPower - consumedPowerTotal) >= 0 ? '#5cb85c' : '#d9534f'}">${(producedPower - consumedPowerTotal).toFixed(0)}</span></p>
        </div>
        
        <div class="summary-card">
          <h3>👥 Population Status</h3>
          <div class="resource-bar">
            <div class="bar-fill" style="width: ${Math.min(100, (totalPopulationAllocated / Math.max(1, currentPopulation)) * 100)}%"></div>
          </div>
          <p><strong>Assigned (Base):</strong> ${totalPopulationAllocated.toFixed(0)}</p>
          <p><strong>Total Available:</strong> ${currentPopulation.toFixed(0)}</p>
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
    
    const building = BUILDINGS[buildingType];
    const allocation = planet.buildingAllocations?.[buildingType] || { power: 1.0, population: 1.0, priority: 3 };
    const actualAllocation = planet.actualAllocations?.[buildingType] || allocation;
    
    // Calculate base requirements for this building at current level using shared functions
    const baseEnergyRequired = await getBuildingEnergyConsumption(buildingType, level, BUILDINGS);
    const basePopulationRequired = await getBuildingPopulationRequired(buildingType, level, BUILDINGS);
    
    // Calculate desired requirements based on user-set allocation
    const energyRequired = baseEnergyRequired * allocation.power;
    const populationRequired = basePopulationRequired * allocation.population;
    
    // Calculate desired effectiveness
    const powerEffectiveness = calculateAllocationEffectiveness(allocation.power * 100) / 100;
    const populationEffectiveness = calculateAllocationEffectiveness(allocation.population * 100) / 100;
    const totalEffectiveness = powerEffectiveness * populationEffectiveness;
    
    // Calculate ACTUAL effectiveness (based on priority and available resources)
    const actualPowerEffectiveness = calculateAllocationEffectiveness(actualAllocation.power * 100) / 100;
    const actualPopulationEffectiveness = calculateAllocationEffectiveness(actualAllocation.population * 100) / 100;
    const actualTotalEffectiveness = actualPowerEffectiveness * actualPopulationEffectiveness;
    
    // Check if building has energy consumption (skip power slider for solarPlant)
    const hasEnergyConsumption = baseEnergyRequired > 0;
    
    html += `
      <div class="allocation-item" data-building="${buildingType}">
        <div class="allocation-header">
          <h4>${building.icon} ${building.name} (Level ${level})</h4>
          <div class="header-right">
            <div class="priority-select">
              <label>Priority:</label>
              <select class="building-priority" data-building="${buildingType}">
                <option value="1" ${allocation.priority === 1 ? 'selected' : ''}>High (1)</option>
                <option value="2" ${allocation.priority === 2 ? 'selected' : ''}>Medium (2)</option>
                <option value="3" ${allocation.priority === 3 ? 'selected' : ''}>Low (3)</option>
              </select>
            </div>
            <span class="effectiveness-badge ${getEffectivenessClass(totalEffectiveness)}">
              Desired: ${(totalEffectiveness * 100).toFixed(0)}%
            </span>
            <span class="effectiveness-badge ${getEffectivenessClass(actualTotalEffectiveness)}" style="margin-left: 5px;">
              Actual: ${(actualTotalEffectiveness * 100).toFixed(0)}%
            </span>
            ${getLimitingFactorBadge(baseEnergyRequired, basePopulationRequired, allocation.power, allocation.population, producedPower, currentPopulation, totalPowerAllocated, totalPopulationAllocated)}
          </div>
        </div>
        
        <div class="allocation-controls">
          ${hasEnergyConsumption ? `
          <div class="allocation-slider">
            <div class="allocation-label-row">
              <label>⚡ Energy <span class="allocation-display">${(allocation.power * 100).toFixed(0)}%</span> : <span class="base-requirement">${energyRequired.toFixed(0)}</span> <span style="color: ${(powerEffectiveness * 100) >= 100 ? '#5cb85c' : '#d9534f'}">(${((powerEffectiveness * 100) - 100 >= 0 ? '+' : '')}${((powerEffectiveness * 100) - 100).toFixed(0)}%)</span></label>
            </div>
            <input 
              type="range" 
              class="power-slider" 
              min="0" 
              max="200" 
              value="${allocation.power * 100}"
              data-building="${buildingType}"
            >
          </div>
          ` : ''}
          
          <div class="allocation-slider">
            <div class="allocation-label-row">
              <label>👥 Workers <span class="allocation-display">${(allocation.population * 100).toFixed(0)}%</span> : <span class="base-requirement">${populationRequired.toFixed(0)}</span> <span style="color: ${(populationEffectiveness * 100) >= 100 ? '#5cb85c' : '#d9534f'}">(${((populationEffectiveness * 100) - 100 >= 0 ? '+' : '')}${((populationEffectiveness * 100) - 100).toFixed(0)}%)</span></label>
            </div>
            <input 
              type="range" 
              class="population-slider" 
              min="0" 
              max="200" 
              value="${allocation.population * 100}"
              data-building="${buildingType}"
            >
          </div>
        </div>
      </div>
    `;
  }
  
  html += `
      </div>
      
      <div class="allocation-actions">
        <button class="btn-primary btn-small apply-allocations">Apply All Changes</button>
        <button class="btn-secondary btn-small undo-allocations">↶ Undo Changes</button>
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Setup allocation event handlers
 */
export function setupAllocationHandlers() {
  const planet = getCurrentPlanet();
  if (!planet) return;
  
  // Save current allocations as the baseline for undo
  const allocatableBuildings = [
    'metalMine',
    'crystalMine',
    'deuteriumSynthesizer',
    'waterExtractor',
    'farm',
    'solarPlant',
    'roboticsFactory',
    'researchLab'
  ];
  
  for (const buildingType of allocatableBuildings) {
    const allocation = planet.buildingAllocations?.[buildingType] || { power: 1.0, population: 1.0, priority: 3 };
    savedAllocations[buildingType] = { ...allocation };
  }
  
  // Update slider value displays
  document.querySelectorAll('.power-slider, .population-slider').forEach(slider => {
    slider.addEventListener('input', async (e) => {
      const value = e.target.value;
      const labelRow = e.target.parentElement.querySelector('.allocation-label-row');
      
      // Update effectiveness display and required resources
      const effectiveness = calculateAllocationEffectiveness(value) / 100;
      const effectivenessPercent = effectiveness * 100;
      
      if (labelRow) {
        // Get building data
        const buildingType = e.target.dataset.building;
        const planet = getCurrentPlanet();
        const level = planet.buildings[buildingType] || 0;
        
        if (e.target.classList.contains('power-slider')) {
          const baseEnergyRequired = await getBuildingEnergyConsumption(buildingType, level, BUILDINGS);
          const energyRequired = baseEnergyRequired * (value / 100);
          const deltaPercent = (effectivenessPercent - 100).toFixed(0);
          const color = effectivenessPercent >= 100 ? '#5cb85c' : '#d9534f';
          const sign = effectivenessPercent >= 100 ? '+' : '';
          labelRow.innerHTML = `<label>⚡ Energy <span class="allocation-display">${value}%</span> : <span class="base-requirement">${energyRequired.toFixed(0)}</span> <span style="color: ${color}">(${sign}${deltaPercent}%)</span></label>`;
        } else {
          const basePopulationRequired = await getBuildingPopulationRequired(buildingType, level, BUILDINGS);
          const populationRequired = basePopulationRequired * (value / 100);
          const deltaPercent = (effectivenessPercent - 100).toFixed(0);
          const color = effectivenessPercent >= 100 ? '#5cb85c' : '#d9534f';
          const sign = effectivenessPercent >= 100 ? '+' : '';
          labelRow.innerHTML = `<label>👥 Workers <span class="allocation-display">${value}%</span> : <span class="base-requirement">${populationRequired.toFixed(0)}</span> <span style="color: ${color}">(${sign}${deltaPercent}%)</span></label>`;
        }
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
  
  // Undo changes
  const undoBtn = document.querySelector('.undo-allocations');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      await undoAllAllocations();
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
  
  const powerPercent = parseFloat(powerSlider.value);
  const populationPercent = parseFloat(populationSlider.value);
  
  const powerEff = calculateAllocationEffectiveness(powerPercent) / 100;
  const popEff = calculateAllocationEffectiveness(populationPercent) / 100;
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
  
  // Collect all allocations with priorities
  document.querySelectorAll('.allocation-item').forEach(item => {
    const buildingType = item.dataset.building;
    const powerSlider = item.querySelector('.power-slider');
    const populationSlider = item.querySelector('.population-slider');
    const prioritySelect = item.querySelector('.building-priority');
    
    if (populationSlider) {
      allocations[buildingType] = {
        power: powerSlider ? parseFloat(powerSlider.value) / 100 : 1.0,
        population: parseFloat(populationSlider.value) / 100,
        priority: prioritySelect ? parseInt(prioritySelect.value) : 3
      };
    }
  });
  
  // Send to server
  try {
    await API.request(`/planet/${planet.id}/allocations`, {
      method: 'POST',
      body: JSON.stringify({ allocations })
    });
    
    // Save these allocations as the new baseline for undo
    savedAllocations = { ...allocations };
    
    // Show success message without refreshing the view
    alert('Allocations updated successfully!');
  } catch (error) {
    console.error('Failed to update allocations:', error);
    alert('Failed to update allocations: ' + error.message);
  }
}

/**
 * Undo allocation changes - reset to last saved state
 */
async function undoAllAllocations() {
  document.querySelectorAll('.allocation-item').forEach(async item => {
    const buildingType = item.dataset.building;
    const saved = savedAllocations[buildingType];
    
    if (saved) {
      const powerSlider = item.querySelector('.power-slider');
      const populationSlider = item.querySelector('.population-slider');
      const prioritySelect = item.querySelector('.building-priority');
      const planet = getCurrentPlanet();
      const level = planet.buildings[buildingType] || 0;
      
      if (powerSlider) {
        powerSlider.value = saved.power * 100;
        const labelRow = powerSlider.parentElement.querySelector('.allocation-label-row');
        if (labelRow) {
          const effectiveness = calculateAllocationEffectiveness(saved.power * 100) / 100;
          const effectivenessPercent = effectiveness * 100;
          const baseEnergyRequired = await getBuildingEnergyConsumption(buildingType, level, BUILDINGS);
          const energyRequired = baseEnergyRequired * saved.power;
          const deltaPercent = (effectivenessPercent - 100).toFixed(0);
          const color = effectivenessPercent >= 100 ? '#5cb85c' : '#d9534f';
          const sign = effectivenessPercent >= 100 ? '+' : '';
          labelRow.innerHTML = `<label>⚡ Energy <span class="allocation-display">${(saved.power * 100).toFixed(0)}%</span> : <span class="base-requirement">${energyRequired.toFixed(0)}</span> <span style="color: ${color}">(${sign}${deltaPercent}%)</span></label>`;
        }
      }
      
      if (populationSlider) {
        populationSlider.value = saved.population * 100;
        const labelRow = populationSlider.parentElement.querySelector('.allocation-label-row');
        if (labelRow) {
          const effectiveness = calculateAllocationEffectiveness(saved.population * 100) / 100;
          const effectivenessPercent = effectiveness * 100;
          const basePopulationRequired = await getBuildingPopulationRequired(buildingType, level, BUILDINGS);
          const populationRequired = basePopulationRequired * saved.population;
          const deltaPercent = (effectivenessPercent - 100).toFixed(0);
          const color = effectivenessPercent >= 100 ? '#5cb85c' : '#d9534f';
          const sign = effectivenessPercent >= 100 ? '+' : '';
          labelRow.innerHTML = `<label>👥 Workers <span class="allocation-display">${(saved.population * 100).toFixed(0)}%</span> : <span class="base-requirement">${populationRequired.toFixed(0)}</span> <span style="color: ${color}">(${sign}${deltaPercent}%)</span></label>`;
        }
      }
      
      if (prioritySelect && saved.priority) {
        prioritySelect.value = saved.priority;
      }
      
      // Update combined effectiveness badge
      updateEffectivenessBadge(buildingType);
    }
  });
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
