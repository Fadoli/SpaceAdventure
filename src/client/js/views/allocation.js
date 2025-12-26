// Building allocation view - manage power and population allocation
import { getCurrentPlanet } from '../main.js';
import { API } from '../api.js';
import { calculateAllocationEffectiveness, getBuildingEnergyConsumption, getBuildingPopulationRequired } from '../../../shared/formulas.js';
import { BUILDINGS } from '../../../shared/buildings.js';

// Track saved allocation state to avoid overwriting user input during updates
let savedAllocations = {};

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
  // Power: production.energy is actually the balance (produced - consumed)
  // Actual produced = balance + consumed
  const energyBalance = planet.production?.energy || 0;
  const consumedPower = planet.energyConsumption || 0;
  const producedPower = energyBalance + consumedPower;
  
  let html = `
    <div class="allocation-view">
      <h2>⚙️ Resource Allocation</h2>
      
      <div class="allocation-summary">
        <div class="summary-card">
          <h3>⚡ Power Status</h3>
          <div class="resource-bar">
            <div class="bar-fill" style="width: ${Math.min(100, Math.max(0, (consumedPower / Math.max(1, producedPower)) * 100))}%"></div>
          </div>
          <p><strong>Produced:</strong> ${producedPower.toFixed(0)}</p>
          <p><strong>Consumed:</strong> ${consumedPower.toFixed(0)}</p>
          <p><strong>Balance:</strong> <span style="color: ${energyBalance >= 0 ? '#5cb85c' : '#d9534f'}">${energyBalance.toFixed(0)}</span></p>
        </div>
        
        <div class="summary-card">
          <h3>👥 Population Status</h3>
          <div class="resource-bar">
            <div class="bar-fill" style="width: ${Math.min(100, (totalPopulationAllocated / Math.max(1, currentPopulation)) * 100)}%"></div>
          </div>
          <p><strong>Assigned:</strong> ${totalPopulationAllocated.toFixed(0)}</p>
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
    const allocation = planet.buildingAllocations?.[buildingType] || { power: 1.0, population: 1.0 };
    
    // Calculate base requirements for this building at current level using shared functions
    const baseEnergyRequired = await getBuildingEnergyConsumption(buildingType, level, BUILDINGS);
    const basePopulationRequired = await getBuildingPopulationRequired(buildingType, level, BUILDINGS);
    
    // Calculate actual requirements based on current allocation
    const energyRequired = baseEnergyRequired * allocation.power;
    const populationRequired = basePopulationRequired * allocation.population;
    
    // Calculate effectiveness
    const powerEffectiveness = calculateAllocationEffectiveness(allocation.power) / 100;
    const populationEffectiveness = calculateAllocationEffectiveness(allocation.population) / 100;
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
            <div class="allocation-label-row">
              <label>⚡ Power: <span class="value">${(allocation.power * 100).toFixed(0)}%</span></label>
              <div class="priority-select">
                <label>Priority:</label>
                <select class="power-priority" data-building="${buildingType}">
                  <option value="1" ${allocation.powerPriority === 1 ? 'selected' : ''}>High (1)</option>
                  <option value="2" ${allocation.powerPriority === 2 ? 'selected' : ''}>Medium (2)</option>
                  <option value="3" ${allocation.powerPriority === 3 ? 'selected' : ''}>Low (3)</option>
                </select>
              </div>
            </div>
            <input 
              type="range" 
              class="power-slider" 
              min="0" 
              max="200" 
              value="${allocation.power * 100}"
              data-building="${buildingType}"
            >
            <small>⚡ Required: ${energyRequired.toFixed(0)} / Effectiveness: ${(powerEffectiveness * 100).toFixed(0)}%</small>
          </div>
          
          <div class="allocation-slider">
            <div class="allocation-label-row">
              <label>👥 Workers: <span class="value">${(allocation.population * 100).toFixed(0)}%</span></label>
              <div class="priority-select">
                <label>Priority:</label>
                <select class="population-priority" data-building="${buildingType}">
                  <option value="1" ${allocation.populationPriority === 1 ? 'selected' : ''}>High (1)</option>
                  <option value="2" ${allocation.populationPriority === 2 ? 'selected' : ''}>Medium (2)</option>
                  <option value="3" ${allocation.populationPriority === 3 ? 'selected' : ''}>Low (3)</option>
                </select>
              </div>
            </div>
            <input 
              type="range" 
              class="population-slider" 
              min="0" 
              max="200" 
              value="${allocation.population * 100}"
              data-building="${buildingType}"
            >
            <small>👥 Required: ${populationRequired.toFixed(0)} / Effectiveness: ${(populationEffectiveness * 100).toFixed(0)}%</small>
          </div>
        </div>
      </div>
    `;
  }
  
  html += `
      </div>
      
      <button class="btn-primary apply-allocations">Apply All Changes</button>
      <button class="btn-secondary undo-allocations">↶ Undo Changes</button>
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
    'farm'
  ];
  
  for (const buildingType of allocatableBuildings) {
    const allocation = planet.buildingAllocations?.[buildingType] || { power: 1.0, population: 1.0, powerPriority: 3, populationPriority: 3 };
    savedAllocations[buildingType] = { ...allocation };
  }
  
  // Update slider value displays
  document.querySelectorAll('.power-slider, .population-slider').forEach(slider => {
    slider.addEventListener('input', async (e) => {
      const value = e.target.value;
      const label = e.target.parentElement.querySelector('.value');
      if (label) {
        label.textContent = `${value}%`;
      }
      
      // Update effectiveness display and required resources
      const effectiveness = calculateAllocationEffectiveness(value / 100) / 100;
      const small = e.target.parentElement.querySelector('small');
      if (small) {
        // Get building data
        const buildingType = e.target.dataset.building;
        const planet = getCurrentPlanet();
        const level = planet.buildings[buildingType] || 0;
        
        if (e.target.classList.contains('power-slider')) {
          const energyRequired = await getBuildingEnergyConsumption(buildingType, level, BUILDINGS) * (value / 100);
          small.textContent = `⚡ Required: ${energyRequired.toFixed(0)} / Effectiveness: ${(effectiveness * 100).toFixed(0)}%`;
        } else {
          const populationRequired = await getBuildingPopulationRequired(buildingType, level, BUILDINGS) * (value / 100);
          small.textContent = `👥 Required: ${populationRequired.toFixed(0)} / Effectiveness: ${(effectiveness * 100).toFixed(0)}%`;
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
  
  const powerPercent = parseFloat(powerSlider.value) / 100;
  const populationPercent = parseFloat(populationSlider.value) / 100;
  
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
    const powerPrioritySelect = item.querySelector('.power-priority');
    const populationPrioritySelect = item.querySelector('.population-priority');
    
    if (powerSlider && populationSlider) {
      allocations[buildingType] = {
        power: parseFloat(powerSlider.value) / 100,
        population: parseFloat(populationSlider.value) / 100,
        powerPriority: parseInt(powerPrioritySelect.value),
        populationPriority: parseInt(populationPrioritySelect.value)
      };
    }
  });
  
  // Send to server
  try {
    for (const [buildingType, allocation] of Object.entries(allocations)) {
      await API.request(`/planet/${planet.id}/building/${buildingType}/allocation`, {
        method: 'POST',
        body: JSON.stringify({
          power: allocation.power,
          population: allocation.population,
          powerPriority: allocation.powerPriority,
          populationPriority: allocation.populationPriority
        })
      });
    }
    
    // Save these allocations as the new baseline for undo
    savedAllocations = { ...allocations };
    
    // Refresh the view
    window.showView('allocation');
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
      const powerPrioritySelect = item.querySelector('.power-priority');
      const populationPrioritySelect = item.querySelector('.population-priority');
      const planet = getCurrentPlanet();
      const level = planet.buildings[buildingType] || 0;
      
      if (powerSlider) {
        powerSlider.value = saved.power * 100;
        const label = powerSlider.parentElement.querySelector('.value');
        if (label) label.textContent = `${saved.power * 100}%`;
        
        const effectiveness = calculateAllocationEffectiveness(saved.power) / 100;
        const energyRequired = await getBuildingEnergyConsumption(buildingType, level, BUILDINGS) * saved.power;
        const small = powerSlider.parentElement.querySelector('small');
        if (small) small.textContent = `⚡ Required: ${energyRequired.toFixed(0)} / Effectiveness: ${(effectiveness * 100).toFixed(0)}%`;
      }
      
      if (populationSlider) {
        populationSlider.value = saved.population * 100;
        const label = populationSlider.parentElement.querySelector('.value');
        if (label) label.textContent = `${saved.population * 100}%`;
        
        const effectiveness = calculateAllocationEffectiveness(saved.population) / 100;
        const populationRequired = await getBuildingPopulationRequired(buildingType, level, BUILDINGS) * saved.population;
        const small = populationSlider.parentElement.querySelector('small');
        if (small) small.textContent = `👥 Required: ${populationRequired.toFixed(0)} / Effectiveness: ${(effectiveness * 100).toFixed(0)}%`;
      }
      
      if (powerPrioritySelect && saved.powerPriority) {
        powerPrioritySelect.value = saved.powerPriority;
      }
      
      if (populationPrioritySelect && saved.populationPriority) {
        populationPrioritySelect.value = saved.populationPriority;
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
