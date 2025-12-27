// Research view - theoretical and practical research management
import { getTheoreticalResearch, getPracticalResearch, PRACTICAL_FOCUS_TYPES } from '../../../shared/research.js';
import { formatNumber } from '../utils.js';

let currentPlanetId = null;
let researchData = null;

/**
 * Initialize research view
 */
export async function initializeResearch(planetId) {
  console.log('Initializing research view for planet:', planetId);
  currentPlanetId = planetId;
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
    researchData = result.data || result;
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

  for (const [category, techs] of Object.entries(grouped)) {
    html += `<div class="research-category">
      <h3>${category}</h3>
      <div class="tech-list">`;

    for (const tech of techs) {
      const level = playerTech[tech.key] || 0;
      const isResearching = queue.some(q => q.techKey === tech.key);
      const queueItem = queue.find(q => q.techKey === tech.key);

      html += `
        <div class="tech-card ${isResearching ? 'researching' : ''} ${level >= 10 ? 'maxed' : ''}">
          <div class="tech-header">
            <span class="tech-icon">${tech.icon}</span>
            <div class="tech-name">
              <h4>${tech.name}</h4>
              <p class="tech-desc">${tech.description}</p>
            </div>
            <span class="tech-level">Level: ${level}</span>
          </div>

          ${isResearching ? `
            <div class="research-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${queueItem.progress}%"></div>
              </div>
              <p class="progress-text">${queueItem.progress}% - ${formatTime(queueItem.timeRemaining)}</p>
              <button class="btn btn-danger btn-small" onclick="cancelTheoreticalResearch('${queueItem.id}')">Cancel</button>
            </div>
          ` : `
            <div class="tech-info">
              <div class="cost-info">
                <span>Metal: ${formatNumber(tech.baseCost.metal)}</span>
                <span>Crystal: ${formatNumber(tech.baseCost.crystal)}</span>
                <span>Deuterium: ${formatNumber(tech.baseCost.deuterium)}</span>
              </div>
              <p class="time-estimate">Time: ~${formatTime(tech.baseTime * 1000)}</p>
              <button class="btn btn-primary btn-small" onclick="startTheoreticalResearch('${tech.key}')" ${level >= 10 ? 'disabled' : ''}>
                Research Level ${level + 1}
              </button>
            </div>
          `}
        </div>
      `;
    }

    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Render practical research tab
 */
async function renderPracticalResearch() {
  const container = document.querySelector('#practical-tab .research-content');
  if (!container) return;

  try {
    // Load available practical research
    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/available`);
    const available = await response.json();

    const practical = getPracticalResearch();
    const playerPractical = researchData?.practical || {};
    const queue = researchData?.progress?.practical || [];

    let html = '<div class="practical-research-list">';

    for (const [key, research] of Object.entries(practical)) {
      if (!available[key]) continue; // Skip if not available

      const focusLevels = playerPractical[research.baseType] || {
        output: 0,
        manpower: 0,
        energy: 0,
        cost: 0
      };

      html += `
        <div class="practical-card">
          <div class="practical-header">
            <span class="icon">${research.icon}</span>
            <div class="practical-info">
              <h4>${research.name}</h4>
              <p>${research.description}</p>
            </div>
          </div>

          <div class="focus-controls">
      `;

      // Focus buttons
      for (const focus of ['output', 'manpower', 'energy', 'cost']) {
        const level = focusLevels[focus] || 0;
        const isResearching = queue.some(q => q.baseType === research.baseType && q.focus === focus);
        const queueItem = queue.find(q => q.baseType === research.baseType && q.focus === focus);

        html += `
          <div class="focus-group">
            <div class="focus-header">
              <h5>${capitalize(focus)}</h5>
              <span class="level-badge">Level ${level}</span>
            </div>

            ${isResearching ? `
              <div class="research-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${queueItem.progress}%"></div>
                </div>
                <p class="progress-text">${queueItem.progress}% - ${formatTime(queueItem.timeRemaining)}</p>
                <button class="btn btn-danger btn-small" onclick="cancelPracticalResearch('${queueItem.id}')">Cancel</button>
              </div>
            ` : `
              <div class="focus-benefits">
                <p class="benefits-text">${getFocusBenefits(focus)}</p>
              </div>
              <button class="btn btn-primary btn-small" onclick="startPracticalResearch('${research.baseType}', '${research.type}', '${focus}')" ${level >= research.maxLevels ? 'disabled' : ''}>
                Upgrade to Level ${level + 1}
              </button>
            `}
          </div>
        `;
      }

      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<p class="error">Failed to load practical research: ${error.message}</p>`;
  }
}

/**
 * Render custom variants tab
 */
async function renderCustomVariants() {
  const container = document.querySelector('#variants-tab .research-content');
  if (!container) return;

  try {
    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/variants`);
    const { building, ships } = await response.json();

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

  // Show key modifiers
  const keyModifiers = [
    'productionMultiplier',
    'costMultiplier',
    'energyMultiplier',
    'populationMultiplier',
    'cargoMultiplier',
    'speedMultiplier',
    'attackMultiplier'
  ];

  for (const mod of keyModifiers) {
    if (modifiers[mod] && modifiers[mod] !== 0) {
      const value = (modifiers[mod] * 100).toFixed(0);
      const sign = modifiers[mod] > 0 ? '+' : '';
      html += `<p><small>${mod}: ${sign}${value}%</small></p>`;
    }
  }

  html += `
      </div>
      <button class="btn btn-secondary btn-small" onclick="editVariant('${baseType}', '${type}')">Edit</button>
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
    const response = await fetch(`/api/game/planet/${currentPlanetId}/research/theoretical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ techKey })
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.message}`);
      return;
    }

    await loadResearchData();
    renderTheoreticalResearch();
  } catch (error) {
    alert(`Failed to start research: ${error.message}`);
  }
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
window.editVariant = function(baseType, type) {
  alert(`Edit variant for ${type} ${baseType} (coming soon)`);
};

/**
 * Update research view with player data
 */
export function updateResearchView(player) {
    // Called when player data updates during gameplay
    loadResearchData();
}
