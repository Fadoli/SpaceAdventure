// Research view - theoretical and practical research management
import { getTheoreticalResearch, getPracticalResearch, PRACTICAL_FOCUS_TYPES, getResearchBonus, canResearchTheoretical } from '../../../shared/research.js';
import { formatNumber } from '../utils.js';
import { renderDetailsModal, closeDetailsModal } from './details.js';
import { showConfirm } from './modals.js';
import { calculateBaseTime } from '../../../shared/time.js';
import { Notifications } from '../notifications.js';
import {
    calculateTheoreticalResearchCost,
    calculateTheoreticalResearchTime,
    calculatePracticalResearchCost,
    calculatePracticalResearchTime
} from '../../../shared/formulas.js';
import { BUILDING_SPEED_MULTIPLIER } from '../../../shared/constants.js';
import { isEmpty } from '../../../shared/utils.js';
import { getCurrentPlanetId, getCurrentPlanet } from '../main.js';

let currentPlanetBuildings = null;
let researchData = null;
let lastResearchStateHash = null;
let researchQueueVisible = true;

/**
 * Toggle research queue visibility
 */
window.toggleResearchQueueVisibility = function () {
    researchQueueVisible = !researchQueueVisible;
    lastResearchStateHash = null; // Force re-render
    loadResearchData();
};

/**
 * Calculate a hash of the research state to detect changes
 */
function calculateResearchStateHash(data) {
    const state = {
        planetId: getCurrentPlanetId(),
        labLevel: currentPlanetBuildings?.researchLab || 0,
        theoreticalQueue: (data.progress?.theoretical || []).map(q => ({ id: q.id, techKey: q.techKey, level: q.level })),
        practicalQueue: (data.progress?.practical || []).map(q => ({ id: q.id, baseType: q.baseType, strength: q.strength })),
        theoretical: data.theoretical,
        practical: data.practical,
        blueprints: data.blueprints
    };
    return JSON.stringify(state);
}

/**
 * Initialize research view
 */
export async function initializeResearch(planet) {
    currentPlanetBuildings = planet.buildings;
    await loadResearchData();
    renderResearchView();
}

/**
 * Load research data from server
 */
async function loadResearchData() {
    try {
        const response = await fetch('/api/game/research');
        const result = await response.json();
        const newResearchData = result.data || result;

        const currentHash = calculateResearchStateHash(newResearchData);
        
        const activeTab = document.querySelector('.research-tabs .tab-btn.active');
        const tabId = activeTab ? activeTab.dataset.tab : 'theoretical';
        const container = document.querySelector(`#${tabId}-tab .research-content`);
        const isContainerEmpty = !container || container.innerHTML.trim() === '';

        const stateChanged = currentHash !== lastResearchStateHash;
        
        researchData = newResearchData;
        lastResearchStateHash = currentHash;

        if (stateChanged || isContainerEmpty) {
            // Only re-render full content if research levels or queue changed
            if (activeTab) {
                switchTab(activeTab.dataset.tab);
            } else {
                renderTheoreticalResearch();
            }
        } else {
            // Just update button states and cost colors without re-rendering everything
            updateCurrentTabStatus();
        }
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
    if (!container) return;

    if (!container.querySelector('.research-container')) {
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
            <div id="theoretical-tab" class="research-tab active"><div class="research-content"></div></div>
            <div id="practical-tab" class="research-tab"><div class="research-content"></div></div>
            <div id="variants-tab" class="research-tab"><div class="research-content"></div></div>
        `;
        container.appendChild(content);

        document.querySelectorAll('.research-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchTab(e.target.dataset.tab);
            });
        });

        renderTheoreticalResearch();
    }
}

function switchTab(tab) {
    document.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const tabElement = document.getElementById(`${tab}-tab`);
    if (tabElement) tabElement.classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    switch (tab) {
        case 'theoretical': renderTheoreticalResearch(); break;
        case 'practical': renderPracticalResearch(); break;
        case 'variants': renderCustomVariants(); break;
    }
}

/**
 * Update current tab without re-rendering
 */
function updateCurrentTabStatus() {
    const activeTab = document.querySelector('.research-tabs .tab-btn.active');
    if (!activeTab) return;
    
    if (activeTab.dataset.tab === 'theoretical') {
        updateTheoreticalResearchButtons();
    } else if (activeTab.dataset.tab === 'practical') {
        // Practical research buttons are static until research level changes
    }
    
    updateResearchQueueTimers();
}

/**
 * Update theoretical research buttons and cost colors
 */
function updateTheoreticalResearchButtons() {
    const currentPlanet = getCurrentPlanet();
    if (!currentPlanet || !researchData) return;

    const theoryResearch = getTheoreticalResearch();
    const playerTech = researchData.theoretical || {};
    const queue = researchData.progress?.theoretical || [];
    const maxQueue = window.GAME_CONFIG?.gameplay?.researchQueueSize || 1;
    const researchLabLevel = currentPlanetBuildings?.researchLab || 0;
    const hasLab = researchLabLevel > 0;

    for (const techKey in theoryResearch) {
        const tech = theoryResearch[techKey];
        const techData = playerTech[techKey];
        const level = typeof techData === 'object' ? (techData.level ?? 0) : (techData ?? 0);
        const queuedItems = queue.filter(q => q.techKey === techKey);
        const queuedCount = queuedItems.length;
        const nextLevelToQueue = level + 1 + queuedCount;
        
        const nextLevelCost = calculateTheoreticalResearchCost(tech.baseCost, nextLevelToQueue - 1);
        const requirementsMet = canResearchTheoretical(techKey, playerTech, currentPlanetBuildings);
        
        const canAffordMetal = currentPlanet.resources.metal >= nextLevelCost.metal;
        const canAffordCrystal = currentPlanet.resources.crystal >= nextLevelCost.crystal;
        const canAffordDeut = currentPlanet.resources.deuterium >= (nextLevelCost.deuterium || 0);
        const canAfford = canAffordMetal && canAffordCrystal && canAffordDeut;

        const isQueueFull = queue.length >= maxQueue;
        const isDisabled = isQueueFull || !requirementsMet || !canAfford || !hasLab;

        // Find elements in DOM
        const card = document.querySelector(`.tech-card[data-tech="${techKey}"]`);
        if (!card) continue;

        // Update cost classes
        const costs = card.querySelector('.tech-costs');
        if (costs) {
            const metalEl = costs.querySelector('[title="Metal"]');
            const crystalEl = costs.querySelector('[title="Crystal"]');
            const deutEl = costs.querySelector('[title="Deuterium"]');
            
            if (metalEl) metalEl.className = `cost-item ${canAffordMetal ? '' : 'text-error'}`;
            if (crystalEl) crystalEl.className = `cost-item ${canAffordCrystal ? '' : 'text-error'}`;
            if (deutEl) deutEl.className = `cost-item ${canAffordDeut ? '' : 'text-error'}`;
        }

        // Update button
        const btn = card.querySelector('.btn-primary, .btn-secondary');
        if (btn) {
            btn.disabled = isDisabled;
            btn.className = `btn ${isDisabled ? 'btn-secondary' : 'btn-primary'} btn-small`;
            
            // Update tooltip
            let buttonTitle = 'Research next level';
            if (isQueueFull) buttonTitle = 'Research queue is full';
            else if (!hasLab) buttonTitle = 'A Research Lab is required';
            else if (!requirementsMet) buttonTitle = 'Requirements not met';
            else if (!canAfford) buttonTitle = 'Insufficient resources';
            btn.title = buttonTitle;
        }
        
        // Update locked class on card
        if (!requirementsMet || !hasLab) card.classList.add('locked');
        else card.classList.remove('locked');
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

    const grouped = {};
    for (const key in theoryResearch) {
        const tech = theoryResearch[key];
        if (!grouped[tech.category]) grouped[tech.category] = [];
        grouped[tech.category].push({ key, ...tech });
    }

    let html = '<div class="theory-research-list">';
    const maxQueue = window.GAME_CONFIG?.gameplay?.researchQueueSize || 1;

    if (queue.length > 0) {
        html += `
      <div class="research-queue-section">
        <div class="queue-header" onclick="window.toggleResearchQueueVisibility()">
          <h3>🔬 Research Queue (${queue.length}/${maxQueue})</h3>
          <span class="toggle-icon">${researchQueueVisible ? '🔼' : '🔽'}</span>
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
        </div>`;
        }
        html += '</div></div>';
    }

    for (const category in grouped) {
        html += `<div class="research-category"><h3>${category}</h3><div class="tech-list">`;
        const researchLabLevel = currentPlanetBuildings?.researchLab || 0;
        const researchSpeedBonus = getResearchBonus(playerTech, 'globalResearchSpeed');
        const configMultiplier = window.GAME_CONFIG?.gameSpeed?.researchTime || 1.0;

        for (const tech of grouped[category]) {
            const techData = playerTech[tech.key];
            const level = typeof techData === 'object' ? (techData.level ?? 0) : (techData ?? 0);
            const queuedCount = queue.filter(q => q.techKey === tech.key).length;
            const nextLevelToQueue = level + 1 + queuedCount;
            const nextLevelTime = calculateTheoreticalResearchTime(tech, nextLevelToQueue - 1, researchLabLevel, researchSpeedBonus, configMultiplier);
            const nextLevelCost = calculateTheoreticalResearchCost(tech.baseCost, nextLevelToQueue - 1);
            
            const requirementsMet = canResearchTheoretical(tech.key, playerTech, currentPlanetBuildings);
            const isQueueFull = queue.length >= maxQueue;
            const isDisabled = isQueueFull || !requirementsMet || researchLabLevel === 0;

            html += `
        <div class="tech-card" data-tech="${tech.key}">
          <div class="card-corner-top"></div>
          <div class="card-corner-bottom"></div>
          <div class="tech-header" title="${tech.description}">
            <div class="header-main">
              <div class="title-row">
                <h4>${tech.icon} ${tech.name}</h4>
              </div>
              <div class="blueprint-row">
                <span class="level-indicator">Lvl ${level}</span>
              </div>
            </div>
            <button class="btn-info" onclick="window.showResearchDetails('${tech.key}')" title="View detailed information">ℹ️</button>
          </div>
          
          <div class="card-body">
            <div class="diagnostic-section">
              <div class="section-tag">Requisition</div>
              <div class="tech-costs">
                <div class="cost-item" title="Metal">⚙️ ${formatNumber(nextLevelCost.metal)}</div>
                <div class="cost-item" title="Crystal">💎 ${formatNumber(nextLevelCost.crystal)}</div>
                ${nextLevelCost.deuterium > 0 ? `<div class="cost-item" title="Deuterium">🛢️ ${formatNumber(nextLevelCost.deuterium)}</div>` : ''}
              </div>
            </div>

            <div class="diagnostic-section">
              <div class="section-tag">Diagnostics</div>
              <div class="tech-footer">
                <span class="build-time">🕐 ${formatTime(nextLevelTime * 1000)}</span>
                ${queuedCount > 0 ? `<span class="queued-badge">📋 QUEUED: ${queuedCount}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="building-actions">
            <button class="btn btn-primary upgrade-btn" onclick="window.startTheoreticalResearch('${tech.key}')">
              Initialize Research
            </button>
          </div>
        </div>`;
        }
        html += '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    updateTheoreticalResearchButtons();
}

function updateResearchQueueTimers() {
    document.querySelectorAll('.research-queue-section .timer').forEach(timer => {
        const finishTime = parseInt(timer.dataset.finish);
        const startTime = parseInt(timer.dataset.start);
        const id = timer.dataset.id;
        const now = Date.now();
        const remaining = Math.max(0, finishTime - now);

        if (remaining === 0) {
            timer.textContent = 'Complete!';
        } else {
            const h = Math.floor(remaining / 3600000);
            const m = Math.floor((remaining % 3600000) / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            timer.textContent = `${h}h ${m}m ${s}s`;
        }

        if (id && startTime && finishTime) {
            const bar = document.getElementById(`research-theory-progress-${id}`) || document.getElementById(`research-practical-progress-${id}`);
            if (bar) {
                const percent = Math.min(100, Math.max(0, ((now - startTime) / (finishTime - startTime)) * 100));
                bar.style.width = `${percent}%`;
            }
        }
    });
}

async function renderPracticalResearch() {
    const container = document.querySelector('#practical-tab .research-content');
    if (!container) return;

    try {
        const planetId = getCurrentPlanetId();
        const response = await fetch(`/api/game/planet/${planetId}/research/available`);
        const available = (await response.json()).data || {};
        
        const practical = getPracticalResearch();
        const playerPractical = researchData?.practical || {};
        const queue = researchData?.progress?.practical || [];
        const maxQueue = window.GAME_CONFIG?.gameplay?.researchQueueSize || 1;

        let html = '<div class="practical-research-view">';
        
        // Research Laboratory Header
        html += `
            <div class="research-header-info">
                <h3>🧪 R&D Laboratory</h3>
                <p>Run experiments to gain focus experience. Random outcomes can lead to breakthroughs or setbacks.</p>
            </div>
        `;

        if (queue.length > 0) {
            html += `
        <div class="research-queue-section">
          <div class="queue-header" onclick="window.toggleResearchQueueVisibility()">
            <h3>🔬 Active Experiments (${queue.length}/${maxQueue})</h3>
            <span class="toggle-icon">${researchQueueVisible ? '🔼' : '🔽'}</span>
          </div>
          <div class="queue-list" style="${researchQueueVisible ? '' : 'display: none;'}">
      `;
            for (const q of queue) {
                let r = Object.values(practical).find(p => p.baseType === q.baseType);
                if (!r) continue;
                const isActive = queue.indexOf(q) === 0;
                const percent = Math.min(100, Math.max(0, ((Date.now() - q.startTime) / (q.endTime - q.startTime)) * 100));
                html += `
          <div class="queue-item ${isActive ? 'active' : ''}">
            <div class="queue-item-row">
              <span class="q-pos">${queue.indexOf(q) + 1}</span>
              <span class="q-name">${r.icon} ${r.name}</span>
              <span class="q-level">Strength: ${(q.strength * 100).toFixed(0)}%</span>
              <div class="progress-bar-mini"><div class="progress-fill" id="research-practical-progress-${q.id}" style="width: ${isActive ? percent : 0}%"></div></div>
              <span class="q-time-mini timer" data-finish="${q.endTime}" data-start="${q.startTime}" data-id="${q.id}"></span>
              <button class="btn-cancel-small" onclick="window.cancelPracticalResearch('${q.id}')">✕</button>
            </div>
          </div>`;
            }
            html += '</div></div>';
        }

        html += '<div class="research-cards-section"><h3>Available Research Trees</h3><div class="research-cards">';
        for (const key in practical) {
            const res = practical[key];
            if (!available[key]) continue;
            
            // Get tree and ensure experience object exists
            let tree = playerPractical[res.baseType];
            if (!tree || !tree.experience) {
                // Handle possible old format (tree was just an object of levels) or missing tree
                if (tree && !tree.experience && typeof tree === 'object' && 'output' in tree) {
                    // Convert old format to new format locally for rendering
                    tree = { 
                        experience: { 
                            output: Math.pow(tree.output || 0, 2) * 100, 
                            automation: Math.pow(tree.automation || 0, 2) * 100, 
                            energy: Math.pow(tree.energy || 0, 2) * 100, 
                            cost: Math.pow(tree.cost || 0, 2) * 100 
                        }, 
                        treeBonus: 1.0
                    };
                } else {
                    tree = { experience: { output: 0, automation: 0, energy: 0, cost: 0 }, treeBonus: 1.0 };
                }
            }
            
            const exp = tree.experience;
            
            // Calculate levels for display
            const levels = {
                output: Math.floor(Math.sqrt((exp.output || 0) / 100)),
                automation: Math.floor(Math.sqrt((exp.automation || 0) / 100)),
                energy: Math.floor(Math.sqrt((exp.energy || 0) / 100)),
                cost: Math.floor(Math.sqrt((exp.cost || 0) / 100))
            };

            const bankedBreakthroughs = tree.bankedBreakthroughs || 0;
            const currentBreakthroughs = tree.currentBreakthroughs || 0;
            const totalEfficiency = 1 + (bankedBreakthroughs * 0.02);

            // Get last result status
            let lastResultHtml = '';
            if (tree.lastResult) {
                const last = tree.lastResult;
                const color = last.type === 'breakthrough' ? 'var(--accent-green)' : (last.type === 'failure' ? 'var(--accent-red)' : 'var(--text-primary)');
                lastResultHtml = `<div class="last-result" style="color: ${color}; font-size: 0.75rem; margin-top: 5px; font-family: 'Share Tech Mono', monospace; text-transform: uppercase;">Last run: ${last.type} (+${last.xpGain} XP)</div>`;
            }

            const researchLabLevel = currentPlanetBuildings?.researchLab || 0;
            const isDisabled = queue.length >= maxQueue || researchLabLevel === 0;
            
            const currentBlueprints = (researchData?.blueprints?.[res.baseType] || []).length;
            const MAX_BLUEPRINTS = 5;
            const canCreate = currentBlueprints < MAX_BLUEPRINTS;

            // Sleek modifier for the title row
            const modPercent = ((totalEfficiency - 1) * 100).toFixed(0);
            const modifierHtml = `<span class="xp-modifier-label" title="Total Bonus: +${modPercent}% (from ${bankedBreakthroughs} banked breakthroughs)">
                +${modPercent}% XP
            </span>`;

            html += `
        <div class="research-card ${isDisabled ? 'locked' : ''}">
          <div class="card-corner-top"></div>
          <div class="card-corner-bottom"></div>
          <div class="card-header" title="${res.description}">
            <div class="header-main">
              <div class="title-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="name">${res.icon} ${res.name.replace(/ (Specialization|Customization)$/, '')}</span>
                </div>
                ${modifierHtml}
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="diagnostic-section">
              <div class="section-tag">Focus Levels</div>
              <div class="xp-section">
                  ${['output', 'automation', 'energy', 'cost'].map(f => {
                      const level = levels[f];
                      const nextXp = Math.pow(level + 1, 2) * 100;
                      const currentXp = exp[f];
                      const prevXp = Math.pow(level, 2) * 100;
                      const progress = Math.min(100, ((currentXp - prevXp) / (nextXp - prevXp)) * 100);
                      
                      return `
                          <div class="xp-row" title="${currentXp} / ${nextXp} XP">
                              <div class="xp-label"><span>${f.toUpperCase()}</span><span>Lvl ${level}</span></div>
                              <div class="xp-bar-container"><div class="xp-bar-fill focus-${f}" style="width: ${progress}%"></div></div>
                          </div>
                      `;
                  }).join('')}
              </div>
            </div>

            <div class="diagnostic-section">
              <div class="section-tag">Breakthroughs</div>
              <div class="efficiency-summary">
                  <span class="bt-stat" title="Current breakthroughs found in this run. Bank them by resetting.">
                      <strong class="current-breakthroughs-val">${currentBreakthroughs}</strong> 🌟
                  </span>
                  <span class="bt-stat" title="Banked breakthroughs (Permanent).">
                      <strong>${bankedBreakthroughs}</strong> 💎
                  </span>
              </div>
              ${lastResultHtml}
            </div>
          </div>
          <div class="building-actions">
            <div class="action-group">
              <button class="btn upgrade-btn" onclick="openAllocationModal('${key}', '${res.name.replace(/ (Specialization|Customization)$/, '')}', '${res.baseType}', '${res.icon}', event)">
                🔬 Run Experiment
              </button>
              <button class="btn design-btn" onclick="window.buildCustomVariantFromResearch('${res.baseType}', 'building', event)" 
                      ${!canCreate ? 'disabled' : ''} title="Create design (${currentBlueprints}/${MAX_BLUEPRINTS})">
                🔧
              </button>
              <button class="btn design-btn" onclick="window.showResearchHistory('${res.baseType}')" title="View historical data">
                📋
              </button>
              <button class="btn design-btn" onclick="window.resetPracticalResearchUI('${res.baseType}')" title="Reset / Bank breakthroughs">
                ♻️
              </button>
            </div>
          </div>
        </div>`;
        }
        html += '</div></div></div>';
        container.innerHTML = html;
    } catch (e) { container.innerHTML = `<p class="error">${e.message}</p>`; }
}

window.startResearchLevel = async function (researchKey) {
    try {
        const response = await fetch(`/api/game/planet/${getCurrentPlanetId()}/research/practical`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ researchKey }) });
        if (!response.ok) { Notifications.showError(`Error: ${(await response.json()).message}`); return; }
        await loadResearchData();
    } catch (e) { Notifications.showError(e.message); }
};

window.openAllocationModal = function (researchKey, researchName, baseType, icon, event) {
    if (event) event.stopPropagation();
    const res = getPracticalResearch()[researchKey];
    if (!res) { Notifications.showError('Research not found'); return; }

    const isShip = res.type === 'ship';
    const focusHints = isShip ? {
        output: 'Increases cargo capacity / firepower',
        automation: 'Reduces crew requirement',
        energy: 'Improves fuel efficiency',
        cost: 'Reduces build costs'
    } : {
        output: 'Increases production output',
        automation: 'Reduces workforce needs',
        energy: 'Reduces energy consumption',
        cost: 'Reduces construction costs'
    };

    const focusLabels = isShip ? {
        output: '📦 OUTPUT',
        automation: '🤖 AUTOMATION',
        energy: '🛢️ FUEL',
        cost: '💰 ECONOMY'
    } : {
        output: '📈 OUTPUT',
        automation: '🤖 AUTOMATION',
        energy: '⚡ ENERGY',
        cost: '💰 ECONOMY'
    };

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" onclick="closeAllocationModal()"><div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header"><h2>${icon} ${researchName}</h2><button class="modal-close" onclick="closeAllocationModal()">✕</button></div>
        <div class="modal-body">
          <p>Customize focus (Total 100%):</p>
          <div class="allocation-container"><div class="allocation-sliders">
              ${['output', 'automation', 'energy', 'cost'].map(f => `
                <div class="slider-group">
                  <label>${focusLabels[f]}</label>
                  <div class="slider-row">
                    <input type="range" min="0" max="100" value="0" id="slider-${f}" class="slider" oninput="updateAllocationSliders()">
                    <span id="value-${f}" class="value">0%</span>
                  </div>
                  <p class="slider-hint" style="font-size: 0.7rem; color: var(--text-secondary); margin: 2px 0 0 0;">${focusHints[f]}</p>
                </div>`).join('')}
              <div class="divider-line" style="margin: 10px 0; border-top: 1px solid rgba(255,255,255,0.1);"></div>
              <div class="slider-group"><label>💪 STRENGTH</label>
                  <div class="slider-row">
                      <input type="range" min="1" max="6" step="0.1" value="2" id="slider-strength" class="slider" oninput="updateAllocationSliders()" list="strength-markers">
                      <datalist id="strength-markers">
                        <option value="1" label="10"></option>
                        <option value="2" label="100"></option>
                        <option value="3" label="1k"></option>
                        <option value="4" label="10k"></option>
                        <option value="5" label="100k"></option>
                        <option value="6" label="1M"></option>
                      </datalist>
                      <span id="value-strength" class="value">100</span>
                  </div>
                  <p class="slider-hint" style="font-size: 0.7rem; color: var(--text-secondary); margin: 2px 0 0 0;">High strength = more XP but higher cost/time (Logarithmic Scale)</p>
              </div>
            </div>
            <div class="allocation-preview">
              <div class="preview-card" style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                <h4 style="margin-top:0">Investment Total: <span id="total-percent">0%</span></h4>
                <div id="cost-breakdown" style="font-family: monospace; font-size: 0.85rem; margin: 10px 0;"></div>
                <h4 style="margin-bottom:0">Research Time: <span id="time-estimate">--</span></h4>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="closeAllocationModal()">Cancel</button><button class="btn btn-primary" id="start-research-btn" disabled onclick="submitAllocationResearch('${researchKey}', '${baseType}')">Start Experiment</button></div>
    </div></div>`);
    window.currentResearch = { researchKey, research: res, baseType };
};

window.closeAllocationModal = function () { const m = document.querySelector('.modal-overlay'); if (m) m.remove(); window.currentResearch = null; };

window.updateAllocationSliders = function () {
    const vals = ['output', 'automation', 'energy', 'cost'].map(f => parseInt(document.getElementById(`slider-${f}`).value));
    const sliderVal = parseFloat(document.getElementById('slider-strength').value);
    const strLog = Math.pow(10, sliderVal);
    
    ['output', 'automation', 'energy', 'cost'].forEach((f, i) => document.getElementById(`value-${f}`).textContent = vals[i] + '%');
    document.getElementById('value-strength').textContent = formatNumber(strLog);
    
    const total = vals.reduce((a, b) => a + b, 0);
    document.getElementById('total-percent').textContent = total + '%';
    if (window.currentResearch) {
        const res = window.currentResearch.research;
        const strNormalized = (sliderVal - 1) / 5;

        // Sum current focus levels
        let tree = researchData?.practical?.[window.currentResearch.baseType];
        let totalFocusLevel = 0;
        if (tree) {
            const exp = tree.experience || tree; // Handle new or old format
            for (const f in exp) {
                const val = exp[f];
                totalFocusLevel += val > 500 ? Math.floor(Math.sqrt(val / 100)) : val;
            }
        }
        
        const allocation = { output: vals[0]/100, automation: vals[1]/100, energy: vals[2]/100, cost: vals[3]/100 };
        const cost = calculatePracticalResearchCost(res.baseCost, totalFocusLevel, allocation, strNormalized);

        const planet = getCurrentPlanet();
        const canAfford = planet && planet.resources.metal >= cost.metal && planet.resources.crystal >= cost.crystal && planet.resources.deuterium >= (cost.deuterium || 0);
        document.getElementById('cost-breakdown').innerHTML = `⚙️${formatNumber(cost.metal)} 💎${formatNumber(cost.crystal)} 🛢️${formatNumber(cost.deuterium)}`;

        const bankedBreakthroughs = tree?.bankedBreakthroughs || 0;
        const breakthroughBonus = bankedBreakthroughs * 0.02;
        const totalResearchSpeedBonus = getResearchBonus(researchData?.theoretical || {}, 'globalResearchSpeed') + breakthroughBonus;

        const time = calculatePracticalResearchTime(res, totalFocusLevel, currentPlanetBuildings?.researchLab || 1, totalResearchSpeedBonus, window.GAME_CONFIG?.gameSpeed?.researchTime || 1.0, strNormalized, allocation);
        document.getElementById('time-estimate').textContent = formatTime(time * 1000);
        const btn = document.getElementById('start-research-btn');
        if (btn) { 
            btn.disabled = total !== 100 || !canAfford; 
            btn.title = !canAfford ? 'Insufficient resources' : (total === 100 ? 'Start' : 'Need 100% distribution'); 
        }
    }
};

window.submitAllocationResearch = async function (researchKey, baseType) {
    const vals = ['output', 'automation', 'energy', 'cost'].map(f => parseInt(document.getElementById(`slider-${f}`).value) / 100);
    const sliderVal = parseFloat(document.getElementById('slider-strength').value);
    const str = (sliderVal - 1) / 5;
    try {
        const response = await fetch(`/api/game/planet/${getCurrentPlanetId()}/research/practical`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ researchKey, allocation: { output: vals[0], automation: vals[1], energy: vals[2], cost: vals[3] }, strength: str }) });
        if (!response.ok) { Notifications.showError((await response.json()).message); return; }
        closeAllocationModal(); await loadResearchData();
    } catch (e) { Notifications.showError(e.message); }
};

async function renderCustomVariants() {
    const container = document.querySelector('#variants-tab .research-content');
    if (!container) return;
    try {
        const response = await fetch(`/api/game/planet/${getCurrentPlanetId()}/research/variants`);
        const { building, ships } = (await response.json()).data;
        let html = '<div class="variants-container">';
        
        const buildingTypes = Object.keys(building).filter(type => building[type].length > 0);
        if (buildingTypes.length > 0) { 
            html += '<div class="variants-section"><h3>Buildings</h3><div class="variant-grid">'; 
            for (const baseType of buildingTypes) {
                const blueprints = building[baseType];
                blueprints.forEach(bp => {
                    html += renderVariantCard(baseType, bp, 'building');
                });
            }
            html += '</div></div>'; 
        }
        
        const shipTypes = Object.keys(ships).filter(type => ships[type].length > 0);
        if (shipTypes.length > 0) { 
            html += '<div class="variants-section"><h3>Ships</h3><div class="variant-grid">'; 
            for (const baseType of shipTypes) {
                const blueprints = ships[baseType];
                blueprints.forEach(bp => {
                    html += renderVariantCard(baseType, bp, 'ship');
                });
            }
            html += '</div></div>'; 
        }
        
        if (buildingTypes.length === 0 && shipTypes.length === 0) html += '<p>No variants yet.</p>';
        container.innerHTML = html + '</div>';
    } catch (e) { container.innerHTML = `<p class="error">${e.message}</p>`; }
}

function renderVariantCard(baseType, variant, type) {
    const { id, name, focusLevels, modifiers } = variant;
    
    let focusesHtml = '';
    for (const f in focusLevels) {
        if (focusLevels[f] > 0) {
            focusesHtml += `
                <div class="focus-badge focus-${f}" title="${f.toUpperCase()} level ${focusLevels[f]}">
                    <span>${f.toUpperCase()}</span>
                    <span>${focusLevels[f]}</span>
                </div>`;
        }
    }

    let modifiersHtml = '';
    if (modifiers) {
        const modifierLabels = {
            productionMultiplier: { label: 'Production', icon: '📈', isPos: true },
            costMultiplier: { label: 'Build Cost', icon: '💰', isPos: false },
            energyMultiplier: { label: 'Energy Cons.', icon: '⚡', isPos: false },
            populationMultiplier: { label: 'Workforce', icon: '👥', isPos: false },
            cargoMultiplier: { label: 'Cargo', icon: '📦', isPos: true },
            cargoCapacityMultiplier: { label: 'Cargo', icon: '📦', isPos: true },
            fuelMultiplier: { label: 'Fuel Cons.', icon: '🛢️', isPos: false },
            speedMultiplier: { label: 'Speed', icon: '🚀', isPos: true },
            attackMultiplier: { label: 'Attack', icon: '⚔️', isPos: true },
            hullMultiplier: { label: 'Hull', icon: '🛡️', isPos: true },
            shieldMultiplier: { label: 'Shield', icon: '🛡️', isPos: true },
            crewRequirement: { label: 'Crew', icon: '🤖', isPos: false }
        };

        for (const modKey in modifiers) {
            const val = modifiers[modKey];
            if (val !== undefined && Math.abs(val - 1) > 0.001) {
                const config = modifierLabels[modKey] || { label: modKey, icon: '❓', isPos: true };
                const percent = ((val - 1) * 100).toFixed(1);
                const isGood = (val > 1) === config.isPos;
                modifiersHtml += `<div class="mod-row ${isGood ? 'pos' : 'neg'}">
                    <span class="mod-icon">${config.icon}</span>
                    <span class="mod-label">${config.label}:</span>
                    <span class="mod-value">${val > 1 ? '+' : ''}${percent}%</span>
                </div>`;
            }
        }
    }

    const escapedName = (name || baseType).replace(/'/g, "\\'");

    return `
        <div class="variant-card-improved" id="variant-${id}">
            <div class="card-corner-top"></div>
            <div class="card-corner-bottom"></div>
            <div class="variant-card-header">
                <h4>${name || baseType}</h4>
                <div class="variant-card-actions">
                    <button class="btn-icon-action" onclick="window.renameVariant('${baseType}', '${id}', '${type}', '${escapedName}')" title="Rename Blueprint">✏️</button>
                    <button class="btn-icon-action" onclick="window.shareVariant('${baseType}', '${id}', '${type}')" title="Share with Allies">🔗</button>
                    <button class="btn-icon-delete" onclick="window.deleteVariant('${baseType}', '${id}', '${type}')" title="Delete Blueprint">🗑️</button>
                </div>
            </div>
            <div class="variant-card-body">
                <div class="variant-focuses-list">${focusesHtml}</div>
                <div class="variant-modifiers-list">
                    ${modifiersHtml || '<div class="no-mods">No significant modifiers</div>'}
                </div>
            </div>
        </div>
    `;
}

window.renameVariant = async function(baseType, blueprintId, type, currentName) {
    const { showPrompt } = await import('./modals.js');
    const newName = await showPrompt('Rename Blueprint', `Enter a new name for your design:`, currentName);
    if (!newName || newName === currentName) return;

    try {
        const endpoint = type === 'building' 
            ? `/api/game/blueprints/${baseType}/${blueprintId}`
            : `/api/game/research/ship-blueprint/${baseType}/${blueprintId}`;
            
        const response = await fetch(endpoint, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName }) 
        });
        const result = await response.json();
        
        if (!response.ok) {
            Notifications.showError(result.message || 'Failed to rename blueprint');
            return;
        }
        
        Notifications.showSuccess('Blueprint renamed');
        await loadResearchData();
        if (window.loadGameState) await window.loadGameState();
    } catch (e) {
        Notifications.showError('Error renaming blueprint: ' + e.message);
    }
};

window.shareVariant = function(baseType, blueprintId, type) {
    Notifications.showInfo('Sharing with allies will be available once the Alliance system is online!');
};

window.deleteVariant = async function(baseType, blueprintId, type) {
    if (!(await showConfirm('Delete Blueprint', `Are you sure you want to delete this blueprint? Any planets using it will revert to the standard model.`))) return;
    
    try {
        const endpoint = type === 'building' 
            ? `/api/game/blueprints/${baseType}/${blueprintId}`
            : `/api/game/research/ship-blueprint/${baseType}/${blueprintId}`;
            
        const response = await fetch(endpoint, { method: 'DELETE' });
        const result = await response.json();
        
        if (!result.success) {
            Notifications.showError(result.error || 'Failed to delete blueprint');
            return;
        }
        
        Notifications.showSuccess('Blueprint deleted');
        await loadResearchData();
        if (window.loadGameState) await window.loadGameState();
    } catch (e) {
        Notifications.showError('Error deleting blueprint: ' + e.message);
    }
};

function formatTime(ms) {
    if (!ms || ms < 0) return '0s';
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 1000 / 60) % 60);
    const h = Math.floor((ms / 1000 / 60 / 60) % 24);
    const d = Math.floor(ms / 1000 / 60 / 60 / 24);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

window.startTheoreticalResearch = async function (techKey) {
    try {
        const response = await fetch(`/api/game/planet/${getCurrentPlanetId()}/research/theoretical`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ techKey }) });
        if (!response.ok) { Notifications.showError((await response.json()).message); return; }
        await loadResearchData();
    } catch (e) { Notifications.showError(e.message); }
};

window.showResearchDetails = function (techKey) {
    const res = getTheoreticalResearch()[techKey];
    const lv = typeof researchData.theoretical[techKey] === 'object' ? (researchData.theoretical[techKey].level ?? 0) : (researchData.theoretical[techKey] ?? 0);
    if (!res) return;
    let eff = '';
    if (res.bonuses) { eff += '<ul>'; for (const b in res.bonuses) eff += `<li>+${(res.bonuses[b] * 100).toFixed(0)}% ${b}</li>`; eff += '</ul>'; }
    if (res.requirements) { eff += '<h4>Reqs:</h4><ul>'; for (const b in res.requirements) eff += `<li>${b}: ${res.requirements[b]}</li>`; eff += '</ul>'; }
    const rows = [];
    for (let i = lv + 1; i <= lv + 5; i++) {
        const c = calculateTheoreticalResearchCost(res.baseCost, i - 1);
        const t = calculateTheoreticalResearchTime(res, i - 1, currentPlanetBuildings?.researchLab || 0, getResearchBonus(researchData.theoretical, 'globalResearchSpeed'), window.GAME_CONFIG?.gameSpeed?.researchTime || 1.0);
        rows.push([`Level ${i}`, `⚙️${formatNumber(c.metal)} 💎${formatNumber(c.crystal)}`, formatTime(t * 1000)]);
    }
    renderDetailsModal({ title: `${res.icon} ${res.name}`, description: res.description, effects: eff, table: { headers: ['Lvl', 'Cost', 'Time'], rows } });
};

window.closeResearchModal = function () { closeDetailsModal(); };

window.cancelTheoreticalResearch = async function (queueId) {
    if (!(await showConfirm('Cancel', 'Confirm?'))) return;
    try {
        const response = await fetch(`/api/game/planet/${getCurrentPlanetId()}/research/theoretical/${queueId}`, { method: 'DELETE' });
        if (!response.ok) { Notifications.showError((await response.json()).message); return; }
        await loadResearchData();
    } catch (e) { Notifications.showError(e.message); }
};

window.cancelPracticalResearch = async function (queueId) {
    if (!(await showConfirm('Cancel', 'Confirm?'))) return;
    try {
        const response = await fetch(`/api/game/planet/${getCurrentPlanetId()}/research/practical/${queueId}`, { method: 'DELETE' });
        if (!response.ok) { Notifications.showError((await response.json()).message); return; }
        await loadResearchData();
    } catch (e) { Notifications.showError(e.message); }
};

window.buildCustomVariantFromResearch = async function (baseType, type, event) {
    if (event) event.stopPropagation();
    const tree = researchData?.practical?.[baseType];
    if (!tree || !tree.experience) {
        Notifications.showError(`No research available for ${baseType}`);
        return;
    }

    // Get current blueprints count to suggest a version number
    const currentCount = (researchData?.blueprints?.[baseType] || []).length;
    const nextVersion = currentCount + 1;

    // Prompt for name
    const { showPrompt } = await import('./modals.js');
    const defaultName = `${baseType.charAt(0).toUpperCase() + baseType.slice(1).replace(/([A-Z])/g, ' $1')} Mk ${nextVersion}`;
    const name = await showPrompt('Blueprint Name', `Enter a name for your custom design:`, defaultName);
    if (!name) return;

    // Convert XP to levels for the variant creation
    const focusLevels = {};
    for (const focus in tree.experience) {
        focusLevels[focus] = Math.floor(Math.sqrt(tree.experience[focus] / 100));
    }

    try {
        const planetId = getCurrentPlanetId();
        const endpoint = type === 'building' 
            ? `/api/game/planet/${planetId}/research/building-variant` 
            : `/api/game/research/ship-blueprint`;

        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ baseType, focusLevels, name }) 
        });
        if (!response.ok) { Notifications.showError((await response.json()).message); return; }
        Notifications.showSuccess('Blueprint created!'); await loadResearchData();
    } catch (e) { Notifications.showError(e.message); }
};

window.resetPracticalResearchUI = async function(baseType) {
    const confirmed = await showConfirm(
        'Reset Research Tree', 
        `Are you sure you want to reset this research tree? 
        \n\nYou will LOSE all current levels and unbanked breakthroughs in this run. 
        \n\nYour current run's breakthroughs will be banked, providing a PERMANENT research speed bonus for this item (+2% per breakthrough).`
    );
    
    if (!confirmed) return;

    try {
        const result = await API.resetPracticalResearch(baseType);
        Notifications.showSuccess(result.message);
        await loadResearchData();
    } catch (e) {
        Notifications.showError('Reset failed: ' + e.message);
    }
};

window.showResearchHistory = async function (baseType) {
    try {
        const response = await fetch(`/api/game/research/history/${baseType}`);
        const result = await response.json();
        
        if (!result.success) {
            Notifications.showError(result.error || 'Failed to load history');
            return;
        }

        const history = result.data || [];
        if (history.length === 0) {
            Notifications.showInfo('No experiment history for this tree yet.');
            return;
        }

        const headers = ['Result', 'XP Gain', 'Allocation', 'Date'];
        const rows = history.map(run => {
            const date = new Date(run.timestamp).toLocaleTimeString();
            const allocationStr = Object.entries(run.allocation)
                .filter(([_, v]) => v > 0)
                .map(([k, v]) => `${k.charAt(0).toUpperCase()}: ${(v * 100).toFixed(0)}%`)
                .join(', ');
            
            return [
                `<span style="color: ${run.type === 'breakthrough' ? 'var(--accent-green)' : (run.type === 'failure' ? 'var(--accent-red)' : 'white')}">${run.type.toUpperCase()}</span>`,
                `+${run.xpGain} XP`,
                allocationStr,
                date
            ];
        });

        renderDetailsModal({
            title: `🧪 Experiment History: ${baseType}`,
            description: 'Review the outcomes of your previous research runs in this tree.',
            table: { headers, rows }
        });
    } catch (e) {
        Notifications.showError('Failed to fetch history: ' + e.message);
    }
};

export function updateResearchView(player, planetId = null) {
    const target = planetId || getCurrentPlanetId() || (player?.planets?.[0]?.id);
    if (target) { const p = player.planets.find(pl => pl.id === target); if (p) currentPlanetBuildings = p.buildings; }
    loadResearchData();
}

export function updateResearchTimers() { updateResearchQueueTimers(); }