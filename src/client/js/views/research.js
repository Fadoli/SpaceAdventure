// Research view - theoretical and practical research management
import { getTheoreticalResearch, getPracticalResearch, PRACTICAL_FOCUS_TYPES } from '../../../shared/research.js';
import { formatNumber } from '../utils.js';
import { renderDetailsModal, closeDetailsModal } from './details.js';
import { calculateBaseTime } from '../../../shared/time.js';
import { 
  calculateTheoreticalResearchCost, 
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime
} from '../../../shared/formulas.js';
import { BUILDING_SPEED_MULTIPLIER } from '../../../shared/constants.js';

let currentPlanetId = null;
let currentPlanetBuildings = null;
let researchData = null;
let lastResearchStateHash = null;
let researchQueueVisible = true;

/**
 * Toggle research queue visibility
 */
window.toggleResearchQueueVisibility = function() {
    researchQueueVisible = !researchQueueVisible;
    lastResearchStateHash = null; // Force re-render
    
    // Find which tab is active and re-render it
    const activeTab = document.querySelector('.research-tabs .tab-btn.active');
    if (activeTab) {
        const tab = activeTab.dataset.tab;
        if (tab === 'theoretical') renderTheoreticalResearch();
        else if (tab === 'practical') renderPracticalResearch();
    }
};

/**
 * Calculate a hash of the research state to detect changes
 */
function calculateResearchStateHash(data) {
  const state = {
    progress: data.progress,
    theoretical: data.theoretical,
    practical: data.practical
  };
  return JSON.stringify(state);
}

/**
 * Initialize research view
 */
export async function initializeResearch(planet) {
  console.log('Initializing research view for planet:', planet.id);
  currentPlanetId = planet.id;
  currentPlanetBuildings = planet.buildings;
  await loadResearchData();
  console.log('Research data ready:', researchData);
  renderResearchView();
}

/**
 * Load research data from server
 */
async function loadResearchData() {
  try {
    const response = await fetch('/api/game/research');
    const result = await response.json();
    // Extract data from response wrapper
    const newResearchData = result.data || result;
    
    // Check if state has changed
    const currentHash = calculateResearchStateHash(newResearchData);
    if (currentHash === lastResearchStateHash && researchData !== null) {
      // State hasn't changed, skip re-render
      return;
    }
    lastResearchStateHash = currentHash;
    
    researchData = newResearchData;
    console.log('Research data loaded:', researchData);
  } catch (error) {
    console.error('Failed to load research data:', error);
    researchData = { progress: { theoretical: [], practical: [] }, theoretical: {}, practical: {} };
  }
}

/**
 * Render the main research view with tabs
 */
function renderResearchView() {
  const container = document.getElementById('research-view');
  if (!container) {
    console.error('Research view container not found');
    return;
  }

  console.log('Clearing research view container');
  // Clear the container first (remove the "coming soon" message)
  container.innerHTML = '';

  const content = document.createElement('div');
  content.className = 'research-container';
  content.innerHTML = `
    <h2>Research System</h2>
    
    <div class="research-tabs">
      <button class="tab-btn active" data-tab="theoretical">Theoretical Research</button>
      <button class="tab-btn" data-tab="practical">Practical Customization</button>
      <button class="tab-btn" data-tab="variants">Custom Variants</button>
    </div>

    <div id="theoretical-tab" class="research-tab active">
      <div class="research-content"></div>
    </div>

    <div id="practical-tab" class="research-tab">
      <div class="research-content"></div>
    </div>

    <div id="variants-tab" class="research-tab">
      <div class="research-content"></div>
    </div>
  `;

  console.log('Appending research content to container');
  container.appendChild(content);

  // Add tab switching
  document.querySelectorAll('.research-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      switchTab(tab);
    });
  });

  // Render initial tab content
  renderTheoreticalResearch();
}

/**
 * Switch between tabs
 */
function switchTab(tab) {
  // Hide all tabs
  document.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  // Show selected tab
  const tabElement = document.getElementById(`${tab}-tab`);
  if (tabElement) {
    tabElement.classList.add('active');
  }

  // Update button state
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

  // Render content
  switch (tab) {
    case 'theoretical':
      renderTheoreticalResearch();
      break;
    case 'practical':
      renderPracticalResearch();
      break;
    case 'variants':
      renderCustomVariants();
      break;
  }
}

/**
 * Render theoretical research tab
 */
function renderTheoreticalResearch() {
  const container = document.querySelector('#theoretical-tab .research-content');
  if (!container) return;

  const theoryResearch = getTheoreticalResearch();
  const playerTech = researchData?.theoretical || {};
  const queue = researchData?.progress?.theoretical || [];

  // Group by category
  const grouped = {};
  for (const [key, tech] of Object.entries(theoryResearch)) {
    if (!grouped[tech.category]) {
      grouped[tech.category] = [];
    }
    grouped[tech.category].push({ key, ...tech });
  }

  let html = '<div class="theory-research-list">';

  // Show research queue at the top if there are items
  if (queue.length > 0) {
    html += `
      <div class="research-queue-section">
        <div class="queue-header" onclick="window.toggleResearchQueueVisibility()" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <h3 style="margin: 0;">🔬 Research Queue (${queue.length})</h3>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${researchQueueVisible ? '🔼' : '🔽'}</span>
        </div>
        <div class="queue-list" style="${researchQueueVisible ? '' : 'display: none;'}">
    `;
    
    for (const queueItem of queue) {
      const tech = theoryResearch[queueItem.techKey];
      if (!tech) continue;
      
      const isActive = queue.indexOf(queueItem) === 0;
      const elapsed = Date.now() - queueItem.startTime;
      const duration = queueItem.duration || (queueItem.endTime - queueItem.startTime);
      const percent = Math.min(100, Math.max(0, (elapsed / duration) * 100));
      
      html += `
        <div class="queue-item ${isActive ? 'active' : ''}">
          <div class="queue-item-row">
            <span class="q-pos">${queue.indexOf(queueItem) + 1}</span>
            <span class="q-name" title="${tech.name}">${tech.icon} ${tech.name}</span>
            <span class="q-level">Lvl ${queueItem.level}</span>
            <div class="progress-bar-mini">
              <div class="progress-fill" id="research-theory-progress-${queueItem.id}" style="width: ${isActive ? percent : 0}%"></div>
            </div>
            <span class="q-time-mini timer" data-finish="${queueItem.endTime}" data-start="${queueItem.startTime}" data-id="${queueItem.id}"></span>
            <button class="btn-cancel-small" onclick="window.cancelTheoreticalResearch('${queueItem.id}')" title="Cancel">✕</button>
          </div>
        </div>
      `;
    }
    
    html += '</div></div>';
  }

  for (const [category, techs] of Object.entries(grouped)) {
    html += `<div class="research-category">
      <h3>${category}</h3>
      <div class="tech-list">`;

    for (const tech of techs) {
      const level = playerTech[tech.key] || 0;
      const queuedItems = queue.filter(q => q.techKey === tech.key);
      const isQueued = queuedItems.length > 0;
      const queuedCount = queuedItems.length;
      const nextLevelToQueue = level + 1 + queuedCount;

      html += `
        <div class="tech-card ${isQueued ? 'queued' : ''}">
          <div class="tech-header">
            <span class="tech-icon">${tech.icon}</span>
            <div class="tech-name">
              <h4>${tech.name}</h4>
              <span class="tech-level">Level: ${level}</span>
            </div>
            <button class="btn-info" onclick="window.showResearchDetails('${tech.key}')" title="View detailed information">ℹ️</button>
          </div>

          <div class="tech-actions">
            ${isQueued ? `<span class="queued-badge">📋 ${queuedCount}</span>` : ''}
            <button class="btn btn-primary btn-small" onclick="window.startTheoreticalResearch('${tech.key}')">
              Level ${nextLevelToQueue}
            </button>
          </div>
        </div>
      `;
    }

    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
  updateResearchQueueTimers();
}

/**
 * Update research queue timers
 */
function updateResearchQueueTimers() {
  document.querySelectorAll('.research-queue-section .timer').forEach(timer => {
    const finishTime = parseInt(timer.dataset.finish);
    const startTime = parseInt(timer.dataset.start);
    const id = timer.dataset.id;
    const now = Date.now();
    const remaining = Math.max(0, finishTime - now);
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (remaining === 0) {
      timer.textContent = 'Complete!';
    } else {
      timer.textContent = `${hours}h ${minutes}m ${seconds}s`;
    }

    // Update progress bar if it exists
    if (id && startTime && finishTime) {
      const theoryBar = document.getElementById(`research-theory-progress-${id}`);
      const practicalBar = document.getElementById(`research-practical-progress-${id}`);
      const progressBar = theoryBar || practicalBar;
      
      if (progressBar) {
        const total = finishTime - startTime;
        const elapsed = now - startTime;
        const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
        progressBar.style.width = `${percent}%`;
      }
    }
  });
}

/**
 * Render practical research tab - compact investment level system
 */
async function renderPracticalResearch() {
  const container = document.querySelector('#practical-tab .research-content');
  if (!container) return;

  try {
    // Load available practical research
    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/available`);
    if (!response.ok) {
      throw new Error(`Failed to load available research: ${response.statusText}`);
    }
    const result = await response.json();
    const available = result.data || result || {};

    const practical = getPracticalResearch();
    const playerPractical = researchData?.practical || {};
    const queue = researchData?.progress?.practical || [];

    let html = '<div class="practical-research-view">';
    
    // Show active research queue
    if (queue && queue.length > 0) {
      html += `
        <div class="research-queue-section">
          <div class="queue-header" onclick="window.toggleResearchQueueVisibility()" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <h3 style="margin: 0;">🔬 Research Queue (${queue.length})</h3>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">${researchQueueVisible ? '🔼' : '🔽'}</span>
          </div>
          <div class="queue-list" style="${researchQueueVisible ? '' : 'display: none;'}">
      `;
      for (const queueItem of queue) {
        const research = Object.values(practical).find(r => r.baseType === queueItem.baseType);
        if (!research) continue;
        
        const isActive = queue.indexOf(queueItem) === 0;
        const elapsed = Date.now() - queueItem.startTime;
        const duration = queueItem.duration || (queueItem.endTime - queueItem.startTime);
        const percent = Math.min(100, Math.max(0, (elapsed / duration) * 100));

        html += `
          <div class="queue-item ${isActive ? 'active' : ''}">
            <div class="queue-item-row">
              <span class="q-pos">${queue.indexOf(queueItem) + 1}</span>
              <span class="q-name" title="${research.name}">${research.icon} ${research.name}</span>
              <span class="q-level">Lvl ${queueItem.level || ''}</span>
              <div class="progress-bar-mini">
                <div class="progress-fill" id="research-practical-progress-${queueItem.id}" style="width: ${isActive ? percent : 0}%"></div>
              </div>
              <span class="q-time-mini timer" data-finish="${queueItem.endTime}" data-start="${queueItem.startTime}" data-id="${queueItem.id}"></span>
              <button class="btn-cancel-small" onclick="window.cancelPracticalResearch('${queueItem.id}')" title="Cancel">✕</button>
            </div>
          </div>
        `;
      }
      html += '</div></div>';
    }

    // Show available research as clickable cards
    let foundAny = false;
    html += '<div class="research-cards-section"><h3>Available Customizations</h3>';
    html += '<div class="research-cards">';

    for (const [key, research] of Object.entries(practical)) {
      if (!available[key]) continue;
      foundAny = true;
      
      // Calculate total focus level for this research
      const researchLevels = playerPractical[research.baseType];
      const totalLevel = researchLevels 
        ? Object.values(researchLevels).reduce((a, b) => a + b, 0)
        : 0;

      html += `
        <div class="research-card" onclick="openAllocationModal('${key}', '${research.name}', '${research.baseType}', '${research.icon}')">
          <div class="card-header">
            <span class="icon">${research.icon}</span>
            <span class="name">${research.name}</span>
          </div>
          <div class="card-body">
            <p class="description">${research.description}</p>
            <div class="current-level">
              Current Level: <strong>${totalLevel}</strong>
            </div>
            <div class="focuses">
              ${researchLevels ? `
                <span class="focus output">📈 ${researchLevels.output}</span>
                <span class="focus automation">🤖 ${researchLevels.automation}</span>
                <span class="focus energy">⚡ ${researchLevels.energy}</span>
                <span class="focus cost">💰 ${researchLevels.cost}</span>
              ` : '<span class="focus">Not yet researched</span>'}
            </div>
          </div>
          <div class="card-footer">
            ${totalLevel > 0 ? `
              <button class="btn btn-success btn-small" onclick="window.buildCustomVariantFromResearch('${research.baseType}', 'building', event)">✓ Create Variant</button>
            ` : ''}
            <button class="btn btn-primary" onclick="openAllocationModal('${key}', '${research.name}', '${research.baseType}', '${research.icon}', event)">Customize Research →</button>
          </div>
        </div>
      `;
    }

    if (!foundAny) {
      html += '<p class="info">No practical research available. Build more buildings and ships.</p>';
    }

    html += '</div></div></div>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading practical research:', error);
    container.innerHTML = `<p class="error">Failed to load practical research: ${error.message}</p>`;
  }
}

/**
 * Start research at next level
 */
window.startResearchLevel = async function(researchKey) {
  try {
    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/practical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        researchKey
      })
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.message}`);
      return;
    }

    await loadResearchData();
    renderPracticalResearch();
  } catch (error) {
    alert(`Failed to start research: ${error.message}`);
  }
};

/**
 * Open allocation modal for practical research customization
 */
window.openAllocationModal = function(researchKey, researchName, baseType, icon, event) {
  // Stop propagation if called from a button
  if (event) {
    event.stopPropagation();
  }
  
  const practical = getPracticalResearch();
  const research = practical[researchKey];
  
  if (!research) {
    alert('Research not found');
    return;
  }
  
  // Create modal HTML
  const modalHtml = `
    <div class="modal-overlay" onclick="closeAllocationModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${icon} ${researchName}</h2>
          <button class="modal-close" onclick="closeAllocationModal()">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="allocation-intro">
            <p>Customize your research by allocating focus across different aspects:</p>
          </div>
          
          <div class="allocation-container">
            <div class="allocation-sliders">
              <div class="slider-group">
                <label>📈 Output (Production/Efficiency)</label>
                <div class="slider-row">
                  <input type="range" min="0" max="100" value="0" id="slider-output" class="slider"
                    oninput="updateAllocationSliders()">
                  <span id="value-output" class="value">0%</span>
                </div>
                <p class="slider-hint">Increases production but costs more</p>
              </div>
              
              <div class="slider-group">
                <label>🤖 Automation (Reduce Workforce)</label>
                <div class="slider-row">
                  <input type="range" min="0" max="100" value="0" id="slider-automation" class="slider"
                    oninput="updateAllocationSliders()">
                  <span id="value-automation" class="value">0%</span>
                </div>
                <p class="slider-hint">Reduces workforce needs but uses more energy</p>
              </div>
              
              <div class="slider-group">
                <label>⚡ Energy (Efficiency)</label>
                <div class="slider-row">
                  <input type="range" min="0" max="100" value="0" id="slider-energy" class="slider"
                    oninput="updateAllocationSliders()">
                  <span id="value-energy" class="value">0%</span>
                </div>
                <p class="slider-hint">Reduces energy consumption but costs more</p>
              </div>
              
              <div class="slider-group">
                <label>💰 Cost (Economy)</label>
                <div class="slider-row">
                  <input type="range" min="0" max="100" value="0" id="slider-cost" class="slider"
                    oninput="updateAllocationSliders()">
                  <span id="value-cost" class="value">0%</span>
                </div>
                <p class="slider-hint">Reduces costs but less efficient</p>
              </div>
              
              <div class="divider-line"></div>
              
              <div class="slider-group">
                <label>💪 Research Strength</label>
                <p class="slider-description">Affects how impactful the research is. Higher strength = more expensive & longer.</p>
                <div class="slider-row">
                  <input type="range" min="0" max="100" value="50" id="slider-strength" class="slider"
                    oninput="updateAllocationSliders()">
                  <span id="value-strength" class="value">50%</span>
                </div>
                <p class="slider-hint">Low strength = quick & cheap, High strength = powerful & costly</p>
                <p class="strength-warning" id="strength-warning"></p>
              </div>
            </div>
            
            <div class="allocation-preview">
              <div class="preview-section">
                <h4>Investment Total</h4>
                <div class="total-allocation">
                  <span id="total-percent">0%</span>
                </div>
                <p class="allocation-note">Distribute 100% across focus areas</p>
              </div>
              
              <div class="preview-section">
                <h4>Estimated Cost</h4>
                <div class="cost-breakdown" id="cost-breakdown">
                  <span>⚙️ Metal: --</span>
                  <span>💎 Crystal: --</span>
                  <span>🔷 Deuterium: --</span>
                </div>
              </div>
              
              <div class="preview-section">
                <h4>Research Time</h4>
                <div id="time-estimate">--</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeAllocationModal()">Cancel</button>
          <button class="btn btn-primary" id="start-research-btn" disabled
            onclick="submitAllocationResearch('${researchKey}', '${baseType}')">
            Start Research
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Store research data for later use
  window.currentResearch = {
    researchKey,
    research,
    baseType
  };
};

/**
 * Close the allocation modal
 */
window.closeAllocationModal = function() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
  window.currentResearch = null;
};

/**
 * Update allocation sliders and show preview
 */
window.updateAllocationSliders = function() {
  const output = parseInt(document.getElementById('slider-output').value);
  const automation = parseInt(document.getElementById('slider-automation').value);
  const energy = parseInt(document.getElementById('slider-energy').value);
  const cost = parseInt(document.getElementById('slider-cost').value);
  const strength = parseInt(document.getElementById('slider-strength').value);
  
  // Update display values
  document.getElementById('value-output').textContent = output + '%';
  document.getElementById('value-automation').textContent = automation + '%';
  document.getElementById('value-energy').textContent = energy + '%';
  document.getElementById('value-cost').textContent = cost + '%';
  document.getElementById('value-strength').textContent = strength + '%';
  
  const total = output + automation + energy + cost;
  document.getElementById('total-percent').textContent = total + '%';
  
  // Enable button only if total is exactly 100 and strength is valid
  const isValid = (total === 100);
  document.getElementById('start-research-btn').disabled = !isValid;
  
  // Update cost and time estimates
  if (window.currentResearch) {
    const research = window.currentResearch.research;
    
    // Calculate weighted cost based on allocation
    const allocation = { output, automation, energy, cost };
    const weightedMultiplier = (output * 1.05 + automation * 1.12 + energy * 1.08 + cost * 0.88) / 100;
    
    // Non-linear strength multiplier: 0% = 0.5x, 50% = 1x, 100% = 2.5x (quadratic)
    const strengthNormalized = strength / 100;
    const strengthMultiplier = 0.5 + (strengthNormalized * strengthNormalized * 2);  // 0.5 to 3
    
    const costMultiplier = (1 + (weightedMultiplier - 1) * 0.5) * strengthMultiplier;
    
    const estimatedCost = {
      metal: Math.ceil(research.baseCost.metal * costMultiplier),
      crystal: Math.ceil(research.baseCost.crystal * costMultiplier),
      deuterium: Math.ceil(research.baseCost.deuterium * costMultiplier)
    };
    
    const costBreakdown = document.getElementById('cost-breakdown');
    costBreakdown.innerHTML = `
      <span>⚙️ Metal: ${formatNumber(estimatedCost.metal)}</span>
      <span>💎 Crystal: ${formatNumber(estimatedCost.crystal)}</span>
      <span>🔷 Deuterium: ${formatNumber(estimatedCost.deuterium)}</span>
    `;
    
    // Calculate time estimate with strength and max 2 days constraint
    const baseTime = calculateBaseTime(research);
    const timeMultiplier = 1 + (weightedMultiplier - 1) * 0.2;
    const strengthTimeMultiplier = 0.5 + (strengthNormalized * strengthNormalized * 3);  // 0.5 to 3.5
    
    // Include lab and tech bonuses to match server logic
    const playerTech = researchData?.theoretical || {};
    const computerTechLevel = playerTech.computerTech || 0;
    const researchLabLevel = currentPlanetBuildings?.researchLab || 1;
    const labMultiplier = Math.pow(BUILDING_SPEED_MULTIPLIER, researchLabLevel);
    const techMultiplier = 1 / (1 + (computerTechLevel * 0.1));
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.researchTime || 1.0;
    
    let estimatedTime = Math.floor(baseTime * timeMultiplier * strengthTimeMultiplier * labMultiplier * techMultiplier * configMultiplier);
    
    // Max duration is 2 days (172800 seconds)
    const maxDuration = 172800;
    let warningMsg = '';
    
    if (estimatedTime > maxDuration) {
      estimatedTime = maxDuration;
      warningMsg = '⚠️ Capped at 2 days maximum';
    }
    
    document.getElementById('time-estimate').textContent = formatTime(estimatedTime * 1000);
    
    const warningEl = document.getElementById('strength-warning');
    if (warningEl) {
      warningEl.textContent = warningMsg;
    }
  }
};

/**
 * Submit allocation-based research with strength
 */
window.submitAllocationResearch = async function(researchKey, baseType) {
  const output = parseInt(document.getElementById('slider-output').value);
  const automation = parseInt(document.getElementById('slider-automation').value);
  const energy = parseInt(document.getElementById('slider-energy').value);
  const cost = parseInt(document.getElementById('slider-cost').value);
  const strength = parseInt(document.getElementById('slider-strength').value);
  
  const allocation = {
    output: output / 100,
    automation: automation / 100,
    energy: energy / 100,
    cost: cost / 100
  };
  
  try {
    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/practical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        researchKey,
        allocation,
        strength: strength / 100
      })
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.message}`);
      return;
    }

    closeAllocationModal();
    await loadResearchData();
    renderPracticalResearch();
  } catch (error) {
    alert(`Failed to start research: ${error.message}`);
  }
};

/**
 * Render custom variants tab
 */
async function renderCustomVariants() {
  const container = document.querySelector('#variants-tab .research-content');
  if (!container) return;

  try {
    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/variants`);
    const result = await response.json();
    const { building, ships } = result.data || result;

    let html = '<div class="variants-container">';

    // Building variants
    if (Object.keys(building).length > 0) {
      html += '<div class="variants-section">';
      html += '<h3>Custom Building Variants</h3>';

      for (const [baseType, variant] of Object.entries(building)) {
        html += renderVariantCard(baseType, variant, 'building');
      }

      html += '</div>';
    }

    // Ship variants
    if (Object.keys(ships).length > 0) {
      html += '<div class="variants-section">';
      html += '<h3>Custom Ship Variants</h3>';

      for (const [baseType, variant] of Object.entries(ships)) {
        html += renderVariantCard(baseType, variant, 'ship');
      }

      html += '</div>';
    }

    if (Object.keys(building).length === 0 && Object.keys(ships).length === 0) {
      html += '<p class="no-variants">No custom variants yet. Research practical customizations to create variants.</p>';
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<p class="error">Failed to load variants: ${error.message}</p>`;
  }
}

/**
 * Render a variant card
 */
function renderVariantCard(baseType, variant, type) {
  const { focusLevels, modifiers } = variant;

  let html = `
    <div class="variant-card">
      <h4>${baseType} - Custom Variant</h4>
      <div class="focus-breakdown">
  `;

  for (const [focus, level] of Object.entries(focusLevels)) {
    if (level > 0) {
      html += `<span class="focus-badge focus-${focus}">+${level} ${focus}</span>`;
    }
  }

  html += '</div><div class="modifiers-preview">';

  // Show only building-related modifiers that have changed
  const buildingModifiers = [
    { key: 'productionMultiplier', label: 'Production', isPositive: true },  // More production is good
    { key: 'costMultiplier', label: 'Build Cost', isPositive: false },  // More cost is bad
    { key: 'energyMultiplier', label: 'Energy', isPositive: false },  // More energy is bad
    { key: 'populationMultiplier', label: 'Population', isPositive: false }  // More population needed is bad
  ];

  // Show only ship-related modifiers if this is a ship variant
  const shipModifiers = [
    { key: 'cargoMultiplier', label: 'Cargo', isPositive: true },  // More cargo is good
    { key: 'speedMultiplier', label: 'Speed', isPositive: true },  // More speed is good
    { key: 'attackMultiplier', label: 'Attack', isPositive: true },  // More attack is good
    { key: 'hullMultiplier', label: 'Hull', isPositive: true },  // More hull is good
    { key: 'shieldMultiplier', label: 'Shield', isPositive: true },  // More shield is good
    { key: 'fuelMultiplier', label: 'Fuel', isPositive: false }  // More fuel consumption is bad
  ];

  const modsToShow = type === 'building' ? buildingModifiers : shipModifiers;

  for (const modInfo of modsToShow) {
    const modValue = modifiers[modInfo.key];
    // Only show if modifier is not 1 (which means no change)
    if (modValue !== undefined && modValue !== 1) {
      const percentChange = ((modValue - 1) * 100).toFixed(0);
      const sign = modValue > 1 ? '+' : '';
      
      // Determine color: if the modifier change is positive for this stat, show green; otherwise red
      const isGoodChange = (modValue > 1) === modInfo.isPositive;
      const colorClass = isGoodChange ? 'positive' : 'negative';
      
      html += `<p class="${colorClass}" style="margin: 5px 0; color: ${isGoodChange ? 'var(--accent-green)' : 'var(--accent-red)'}"><small>${modInfo.label}: ${sign}${percentChange}%</small></p>`;
    }
  }

  html += `
      </div>
      <button class="btn btn-primary btn-small" onclick="buildCustomVariant('${baseType}', '${type}')">Build Custom Variant</button>
    </div>
  `;

  return html;
}

/**
 * Get focus benefits description
 */
function getFocusBenefits(focus) {
  const benefits = {
    output: 'Increases production output, but increases overall requirements',
    manpower: 'Reduces workforce needs with automation, but increases cost and energy',
    energy: 'Improves energy efficiency and reduces consumption',
    cost: 'Reduces construction costs, but decreases efficiency'
  };
  return benefits[focus] || '';
}

/**
 * Format time (milliseconds) to readable string
 */
function formatTime(ms) {
  if (!ms || ms < 0) return '0s';

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const hours = Math.floor((ms / 1000 / 60 / 60) % 24);
  const days = Math.floor(ms / 1000 / 60 / 60 / 24);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Capitalize string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Start theoretical research
 */
window.startTheoreticalResearch = async function(techKey) {
  try {
    console.log('Starting theoretical research for tech:', techKey);
    console.log('Current Planet ID:', currentPlanetId);
    
    if (!currentPlanetId) {
      alert('Error: Planet ID not set. Please refresh the page.');
      console.error('Planet ID is not set!');
      return;
    }

    const url = `/api/game/planet/${currentPlanetId}/research/theoretical`;
    const body = { techKey };
    
    console.log('Making request to:', url);
    console.log('Request body:', body);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const error = await response.json();
      console.error('Server error response:', error);
      alert(`Error: ${error.message}`);
      return;
    }

    const data = await response.json();
    console.log('Success response:', data);

    await loadResearchData();
    renderTheoreticalResearch();
  } catch (error) {
    console.error('Failed to start research:', error);
    alert(`Failed to start research: ${error.message}`);
  }
};

/**
 * Show research details modal
 */
window.showResearchDetails = function(techKey) {
  const theoryResearch = getTheoreticalResearch();
  const tech = theoryResearch[techKey];
  const playerTech = researchData?.theoretical || {};
  const currentLevel = playerTech[techKey] || 0;
  
  if (!tech) return;
  
  let effectsHtml = '';
  
  // Show bonuses/effects
  if (tech.bonuses && Object.keys(tech.bonuses).length > 0) {
    effectsHtml += `<div class="research-effects">
      <h3>Benefits:</h3>
      <ul>`;
    for (const [bonus, value] of Object.entries(tech.bonuses)) {
      const displayName = bonus
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const displayValue = (value * 100).toFixed(0);
      effectsHtml += `<li>+${displayValue}% ${displayName}</li>`;
    }
    effectsHtml += `</ul></div>`;
  }
  
  // Show unlocks
  if (tech.unlocks && tech.unlocks.length > 0) {
    effectsHtml += `<div class="research-unlocks">
      <h3>Unlocks:</h3>
      <ul>`;
    for (const unlock of tech.unlocks) {
      effectsHtml += `<li>${unlock}</li>`;
    }
    effectsHtml += `</ul></div>`;
  }
  
  // Prepare progression table
  const headers = ['Level', '⚙️ Metal', '💎 Crystal', '🛢️ Deuterium', '⏱️ Time'];
  const rows = [];
  
  const computerTechLevel = playerTech.computerTech || 0;
  const researchLabLevel = currentPlanetBuildings?.researchLab || 0;
  const researchSpeedBonus = computerTechLevel * 0.1;
  const configMultiplier = window.GAME_CONFIG?.gameSpeed?.researchTime || 1.0;

  for (let level = currentLevel + 1; level <= Math.min(currentLevel + 5, 30); level++) {
    const cost = calculateTheoreticalResearchCost(tech.baseCost, level - 1);
    const timeInSeconds = calculateTheoreticalResearchTime(
      tech, 
      level - 1, 
      researchLabLevel, 
      researchSpeedBonus,
      configMultiplier
    );
    const timeStr = formatTime(timeInSeconds * 1000);
    
    rows.push([
      `Level ${level}`,
      formatNumber(cost.metal),
      formatNumber(cost.crystal),
      formatNumber(cost.deuterium),
      timeStr
    ]);
  }
  
  renderDetailsModal({
    title: `${tech.icon} ${tech.name} <span class="current-level">(Current: Level ${currentLevel})</span>`,
    description: tech.description,
    effects: effectsHtml,
    table: {
      headers: headers,
      rows: rows
    },
    footer: `* Time estimate assumes Research Lab level ${researchLabLevel}`
  });
};

/**
 * Close research details modal
 */
window.closeResearchModal = function() {
  closeDetailsModal();
};

/**
 * Cancel theoretical research
 */
window.cancelTheoreticalResearch = async function(queueId) {
  if (!confirm('Cancel this research?')) return;

  try {
    const response = await fetch(
      `/api/game/planet/${currentPlanetId}/research/theoretical/${queueId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.message}`);
      return;
    }

    await loadResearchData();
    renderTheoreticalResearch();
  } catch (error) {
    alert(`Failed to cancel research: ${error.message}`);
  }
};

/**
 * Start practical research
 */
window.startPracticalResearch = async function(baseType, type, focus) {
  try {
    if (!currentPlanetId) {
      alert('Error: Planet ID not set. Please refresh the page.');
      return;
    }

    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/practical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseType, type, focus })
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.message}`);
      return;
    }

    await loadResearchData();
    renderPracticalResearch();
  } catch (error) {
    alert(`Failed to start customization research: ${error.message}`);
  }
};

/**
 * Cancel practical research
 */
window.cancelPracticalResearch = async function(queueId) {
  if (!confirm('Cancel this research?')) return;

  try {
    const response = await fetch(
      `/api/game/planet/${currentPlanetId}/research/practical/${queueId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.message}`);
      return;
    }

    await loadResearchData();
    renderPracticalResearch();
  } catch (error) {
    alert(`Failed to cancel research: ${error.message}`);
  }
};

/**
 * Edit variant
 */
/**
 * Build a custom variant directly from existing research levels
 */
window.buildCustomVariantFromResearch = async function(baseType, type, event) {
  if (event) {
    event.stopPropagation();
  }
  
  // Get the current practical research levels for this base type
  const response = await fetch('/api/game/research');
  const result = await response.json();
  const practical = result.data?.practical || result.practical || {};
  
  const focusLevels = practical[baseType];
  if (!focusLevels || !Object.values(focusLevels).some(level => level > 0)) {
    alert(`No research available for ${baseType}`);
    return;
  }
  
  try {
    // Determine the endpoint based on type (building or ship)
    const endpoint = type === 'building' 
      ? `/api/game/planet/${currentPlanetId}/research/building-variant`
      : `/api/game/research/ship-variant`;
    
    const variantResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseType,
        focusLevels
      })
    });
    
    if (!variantResponse.ok) {
      const error = await variantResponse.json();
      alert(`Error: ${error.message || 'Failed to create variant'}`);
      return;
    }
    
    alert(`✅ Custom ${baseType} variant created! You can now build it in the Buildings view.`);
    
    // Reload research data to show the variant
    await loadResearchData();
    renderCustomVariants();
  } catch (error) {
    alert(`Failed to create variant: ${error.message}`);
  }
};

/**
 * Build a custom variant (activate it for building)
 */
window.buildCustomVariant = async function(baseType, type) {
  // Get the current practical research levels for this base type
  const response = await fetch('/api/game/research');
  const researchData = await response.json();
  const practical = researchData.data?.practical || researchData.practical || {};
  
  const focusLevels = practical[baseType];
  if (!focusLevels) {
    alert(`No research available for ${baseType}`);
    return;
  }
  
  try {
    // Determine the endpoint based on type (building or ship)
    const endpoint = type === 'building' 
      ? `/api/game/planet/${currentPlanetId}/research/building-variant`
      : `/api/game/research/ship-variant`;
    
    const variantResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseType,
        focusLevels
      })
    });
    
    if (!variantResponse.ok) {
      const error = await variantResponse.json();
      alert(`Error: ${error.message || 'Failed to create variant'}`);
      return;
    }
    
    alert(`✅ Custom ${baseType} variant created! You can now build it in the Buildings view.`);
    
    // Reload research data to show the variant
    await loadResearchData();
    renderCustomVariants();
  } catch (error) {
    alert(`Failed to create variant: ${error.message}`);
  }
};

window.editVariant = function(baseType, type) {
  alert(`Edit variant for ${type} ${baseType} (coming soon)`);
};

/**
 * Update research view with player data
 */
export function updateResearchView(player) {
    // Called when player data updates during gameplay
    // Need to ensure currentPlanetId is set from the player's first planet
    if (!currentPlanetId && player?.planets?.[0]) {
        currentPlanetId = player.planets[0].id;
    }
    loadResearchData();
}

/**
 * Update research timers (exported for main loop)
 */
export function updateResearchTimers() {
    updateResearchQueueTimers();
}
