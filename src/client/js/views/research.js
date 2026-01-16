// Research view - theoretical and practical research management
import { API } from '../api.js';
import { getTheoreticalResearch, getPracticalResearch, PRACTICAL_FOCUS_TYPES, getResearchBonus, canResearchTheoretical } from '../../../shared/research.js';
import { formatNumber, formatDuration, formatCountdown } from '../utils.js';
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
    
    // Re-render current tab to apply visibility change
    const activeTab = document.querySelector('.research-tabs .tab-btn.active');
    if (activeTab) {
        switchTab(activeTab.dataset.tab, false);
    }
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
async function loadResearchData(force = false) {
    try {
        const response = await fetch('/api/game/research');
        const result = await response.json();
        const newResearchData = result.data || result;
        
        const currentHash = calculateResearchStateHash(newResearchData);

        if (!force && researchData && currentHash === lastResearchStateHash) {
            updateCurrentTabStatus();
            return;
        }

        // Get active tab from URL or default to theoretical
        const urlParams = new URLSearchParams(window.location.search);
        const subTab = urlParams.get('subtab') || 'theoretical';
        
        researchData = newResearchData;
        lastResearchStateHash = currentHash;

        switchTab(subTab, false);
    } catch (error) {
        console.error('Failed to load research data:', error);
        if (!researchData) researchData = { progress: { theoretical: [], practical: [] }, theoretical: {}, practical: {} };
    }
}

/**
 * Render the main research view with tabs
 */
function renderResearchView() {
    const container = document.getElementById('research-view');
    if (!container) return;

    if (!container.querySelector('.research-container')) {
        const urlParams = new URLSearchParams(window.location.search);
        const activeSubTab = urlParams.get('subtab') || 'theoretical';

        container.innerHTML = '';
        const content = document.createElement('div');
        content.className = 'research-container';
        content.innerHTML = `
            <div class="view-header-technical">
                <h2>RESEARCH COMMAND</h2>
                <div class="header-line"></div>
            </div>
            <div class="research-tabs-container">
                <div class="research-tabs">
                  <button class="tab-btn ${activeSubTab === 'theoretical' ? 'active' : ''}" data-tab="theoretical">THEORETICAL</button>
                  <button class="tab-btn ${activeSubTab === 'practical' ? 'active' : ''}" data-tab="practical">PRACTICAL</button>
                  <button class="tab-btn ${activeSubTab === 'variants' ? 'active' : ''}" data-tab="variants">BLUEPRINTS</button>
                </div>
            </div>
            <div id="theoretical-tab" class="research-tab ${activeSubTab === 'theoretical' ? 'active' : ''}"><div class="research-content"></div></div>
            <div id="practical-tab" class="research-tab ${activeSubTab === 'practical' ? 'active' : ''}"><div class="research-content"></div></div>
            <div id="variants-tab" class="research-tab ${activeSubTab === 'variants' ? 'active' : ''}"><div class="research-content"></div></div>
        `;
        container.appendChild(content);

        document.querySelectorAll('.research-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchTab(e.target.dataset.tab);
            });
        });

        switchTab(activeSubTab, false);
    }
}

export function switchTab(tab, updateUrl = true) {
    document.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const tabElement = document.getElementById(`${tab}-tab`);
    if (tabElement) tabElement.classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    // Sync sidebar submenu
    document.querySelectorAll('.nav-sub-btn').forEach(btn => {
        if (btn.dataset.subtab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update URL query parameter
    if (updateUrl) {
        const url = new URL(window.location);
        url.searchParams.set('subtab', tab);
        window.history.replaceState({}, '', url);
    }

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
        
        const nextLevelCost = calculateTheoreticalResearchCost(tech.baseCost, nextLevelToQueue - 1, tech.costScaling);
        const requirementsMet = canResearchTheoretical(techKey, playerTech, currentPlanetBuildings);
        
        const canAffordMetal = currentPlanet.resources.metal >= nextLevelCost.metal;
        const canAffordCrystal = currentPlanet.resources.crystal >= nextLevelCost.crystal;
        const canAffordDeut = currentPlanet.resources.deuterium >= (nextLevelCost.deuterium || 0);
        const canAfford = canAffordMetal && canAffordCrystal && canAffordDeut;

        const isQueueFull = queue.length >= maxQueue;
        const isDisabled = isQueueFull || !requirementsMet || !canAfford || !hasLab;

        // Find elements in DOM
        const card = document.querySelector(`.research-card[data-tech="${techKey}"]`);
        if (!card) continue;

        // Update cost colors
        const costsItems = card.querySelectorAll('.tech-costs .cost-item');
        if (costsItems.length > 0) {
            costsItems[0].className = `cost-item ${canAffordMetal ? '' : 'text-danger'}`;
            costsItems[1].className = `cost-item ${canAffordCrystal ? '' : 'text-danger'}`;
            if (costsItems[2]) {
                costsItems[2].className = `cost-item ${canAffordDeut ? '' : 'text-danger'}`;
            }
        }

        const btn = card.querySelector('.upgrade-btn');
        if (btn) {
            btn.disabled = isDisabled;
            if (isQueueFull) {
                btn.textContent = 'QUEUE FULL';
            } else if (!requirementsMet) {
                btn.textContent = 'LOCKED';
            } else if (!hasLab) {
                btn.textContent = 'LAB REQUIRED';
            } else if (!canAfford) {
                btn.textContent = 'INSUFFICIENT FUNDS';
            } else {
                btn.textContent = `INITIATE RESEARCH LVL ${nextLevelToQueue}`;
            }
        }
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
        <div class="card-corner-top"></div>
        <div class="queue-header" onclick="window.toggleResearchQueueVisibility()">
          <h3>🔬 TECHNOLOGICAL DEVELOPMENT LOG (${queue.length}/${maxQueue})</h3>
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
            <span class="q-name" title="${tech.name}">${tech.name}</span>
            <span class="q-level">LVL ${queueItem.level}</span>
            <div class="progress-bar-mini">
              <div class="progress-fill" id="research-theory-progress-${queueItem.id}" style="width: ${isActive ? percent : 0}%"></div>
            </div>
            <span class="q-time-mini timer" data-finish="${queueItem.endTime}" data-start="${queueItem.startTime}" data-id="${queueItem.id}"></span>
            <button class="btn-cancel-small" onclick="window.cancelTheoreticalResearch('${queueItem.id}')" title="Abort Research">✕</button>
          </div>
        </div>`;
        }
        html += '</div></div>';
    }

    for (const category in grouped) {
        html += `
            <div class="research-category">
                <div class="category-header-technical">
                    <h3>${category.toUpperCase()} DIVISION</h3>
                    <span class="category-stats-tag">${grouped[category].length} TECHNOLOGIES AVAILABLE</span>
                </div>
                <div class="tech-list">`;
        
        const researchLabLevel = currentPlanetBuildings?.researchLab || 0;
        const researchSpeedBonus = getResearchBonus(playerTech, 'globalResearchSpeed');
        const configMultiplier = window.GAME_CONFIG?.gameSpeed?.researchTime || 1.0;

        for (const tech of grouped[category]) {
            const techData = playerTech[tech.key];
            const level = typeof techData === 'object' ? (techData.level ?? 0) : (techData ?? 0);
            const queuedCount = queue.filter(q => q.techKey === tech.key).length;
            const nextLevelToQueue = level + 1 + queuedCount;
            const nextLevelTime = calculateTheoreticalResearchTime(tech, nextLevelToQueue - 1, researchLabLevel, researchSpeedBonus, configMultiplier);
            const nextLevelCost = calculateTheoreticalResearchCost(tech.baseCost, nextLevelToQueue - 1, tech.costScaling);
            
            const requirementsMet = canResearchTheoretical(tech.key, playerTech, currentPlanetBuildings);
            const isQueueFull = queue.length >= maxQueue;
            const isDisabled = isQueueFull || !requirementsMet || researchLabLevel === 0;

            html += `
        <div class="research-card" data-tech="${tech.key}">
          <div class="card-corner-top"></div>
          <div class="card-header" title="${tech.description}">
            <div class="header-main">
              <div class="title-row">
                <span class="name">${tech.icon} ${tech.name}</span>
              </div>
              <div class="blueprint-row">
                <span class="level-indicator">CURRENT LEVEL: ${level}</span>
              </div>
            </div>
            <div class="header-actions">
                <button class="btn-info" onclick="window.showResearchDetails('${tech.key}')" title="Technical Data">ℹ️</button>
            </div>
          </div>
          
          <div class="card-body">
            <div class="diagnostic-section">
              <div class="section-tag">Requisition Data</div>
              <div class="tech-costs">
                <div class="cost-item">⚙️ ${formatNumber(nextLevelCost.metal)}</div>
                <div class="cost-item">💎 ${formatNumber(nextLevelCost.crystal)}</div>
                ${nextLevelCost.deuterium > 0 ? `<div class="cost-item">🛢️ ${formatNumber(nextLevelCost.deuterium)}</div>` : ''}
              </div>
            </div>

            <div class="diagnostic-section">
              <div class="section-tag">Project Timeline</div>
              <div class="tech-footer">
                <span class="build-time" style="font-size: 0.8rem;">🕐 ${formatCountdown(nextLevelTime)}</span>
                ${queuedCount > 0 ? `<span class="queued-badge" style="background: var(--accent-yellow); color: #000; padding: 1px 6px; font-weight: bold; border-radius: 1px;">QUEUED: ${queuedCount}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="building-actions">
            <div class="action-group">
                <button class="btn upgrade-btn" style="padding: 12px !important; font-size: 0.8rem !important;" onclick="window.startTheoreticalResearch('${tech.key}')">
                    INITIATE RESEARCH LVL ${nextLevelToQueue}
                </button>
            </div>
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
            timer.textContent = formatCountdown(remaining / 1000);
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
          <div class="card-corner-top"></div>
          <div class="queue-header" onclick="window.toggleResearchQueueVisibility()">
            <h3>🔬 EXPERIMENTAL LOG (${queue.length}/${maxQueue})</h3>
            <span class="toggle-icon">${researchQueueVisible ? '🔼' : '🔽'}</span>
          </div>
          <div class="queue-list" style="${researchQueueVisible ? '' : 'display: none;'}">
      `;
            for (const q of queue) {
                let r = null;
                for (const pk in practical) {
                    if (practical[pk].baseType === q.baseType) {
                        r = practical[pk];
                        break;
                    }
                }
                if (!r) continue;
                const isActive = queue.indexOf(q) === 0;
                const percent = Math.min(100, Math.max(0, ((Date.now() - q.startTime) / (q.endTime - q.startTime)) * 100));
                html += `
          <div class="queue-item ${isActive ? 'active' : ''}">
            <div class="queue-item-row">
              <span class="q-pos">${queue.indexOf(q) + 1}</span>
              <span class="q-name">${r.name}</span>
              <span class="q-level">STRENGTH: ${(q.strength * 100).toFixed(0)}%</span>
              <div class="progress-bar-mini"><div class="progress-fill" id="research-practical-progress-${q.id}" style="width: ${isActive ? percent : 0}%"></div></div>
              <span class="q-time-mini timer" data-finish="${q.endTime}" data-start="${q.startTime}" data-id="${q.id}"></span>
              <button class="btn-cancel-small" onclick="window.cancelPracticalResearch('${q.id}')" title="Abort Experiment">✕</button>
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
                      const currentXp = exp[f] || 0;
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
              <div class="section-tag">Breakthrough Data</div>
              <div class="bt-readout">
                <div class="bt-row" title="Current breakthroughs found in this run. Bank them by resetting.">
                  <span class="bt-label">UNSTABLE BREAKTHROUGHS</span>
                  <span class="bt-value unstable">${currentBreakthroughs}</span>
                </div>
                <div class="bt-row" title="Banked breakthroughs (Permanent).">
                  <span class="bt-label">ARCHIVED BREAKTHROUGHS</span>
                  <span class="bt-value archived">${bankedBreakthroughs}</span>
                </div>
              </div>
              ${lastResultHtml}
            </div>
          </div>
          <div class="building-actions">
            <div class="action-group">
              <button class="btn upgrade-btn" onclick="window.openAllocationModal('${key}', '${res.name.replace(/ (Specialization|Customization)$/, '')}', '${res.baseType}', '${res.icon}', event)">
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

    const focusHints = {
        output: 'Increases production output',
        automation: 'Reduces workforce needs',
        energy: 'Reduces energy consumption',
        cost: 'Reduces construction costs'
    };

    const focusLabels = {
        output: '📈 OUTPUT',
        automation: '🤖 AUTOMATION',
        energy: '⚡ ENERGY',
        cost: '💰 ECONOMY'
    };

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" onclick="window.closeAllocationModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2>${icon} ${researchName}</h2>
                <button class="modal-close" onclick="window.closeAllocationModal()">✕</button>
            </div>
            <div class="modal-body">
              <p style="font-family: 'Share Tech Mono', monospace; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">> CALIBRATING EXPERIMENT FOCUS (TOTAL 100%):</p>
              <div class="allocation-container">
                <div class="allocation-sliders">
                  ${['output', 'automation', 'energy', 'cost'].map(f => `
                    <div class="slider-group">
                      <label>${focusLabels[f]}</label>
                      <div class="slider-row">
                        <input type="range" min="0" max="100" value="0" id="slider-${f}" class="slider" oninput="window.updateAllocationSliders()">
                        <span id="value-${f}" class="value">0%</span>
                      </div>
                      <p class="slider-hint">${focusHints[f]}</p>
                    </div>`).join('')}
                  <div class="divider-line"></div>
                  <div class="slider-group"><label>💪 EXPERIMENT INTENSITY</label>
                      <div class="slider-row">
                          <input type="range" min="1" max="6" step="0.1" value="2" id="slider-strength" class="slider" oninput="window.updateAllocationSliders()" list="strength-markers">
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
                      <p class="slider-hint">Higher intensity increases XP gain but exponentially increases cost and duration.</p>
                  </div>
                </div>
                <div class="allocation-preview">
                  <div class="preview-card">
                    <h4>INVESTMENT TOTAL <span id="total-percent">0%</span></h4>
                    <div id="cost-breakdown"></div>
                    <div class="divider-line"></div>
                    <h4>ESTIMATED DURATION</h4>
                    <div id="time-estimate">--</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="window.closeAllocationModal()">ABORT</button>
                <button class="btn btn-primary" id="start-research-btn" disabled onclick="window.submitAllocationResearch('${researchKey}', '${baseType}')">INITIATE EXPERIMENT</button>
            </div>
        </div>
    </div>`);
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
            const exp = tree.experience || {}; 
            for (const f in exp) {
                totalFocusLevel += Math.floor(Math.sqrt((exp[f] || 0) / 100));
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
        document.getElementById('time-estimate').textContent = formatDuration(time * 1000);
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
        const { building } = (await response.json()).data;
        let html = '<div class="variants-container">';
        
        const buildingTypes = [];
        for (const type in building) {
            if (building[type].length > 0) buildingTypes.push(type);
        }
        if (buildingTypes.length > 0) { 
            html += '<div class="variants-section"><h3>Buildings</h3><div class="variant-grid">'; 
            for (const baseType of buildingTypes) {
                const blueprints = building[baseType];
                blueprints.forEach(bp => {
                    html += renderVariantCard(baseType, bp);
                });
            }
            html += '</div></div>'; 
        }
        
        if (buildingTypes.length === 0) html += '<p style="padding: 20px; opacity: 0.5; font-family: \'Share Tech Mono\', monospace;">NO ACTIVE BLUEPRINTS DETECTED</p>';
        container.innerHTML = html + '</div>';
    } catch (e) { container.innerHTML = `<p class="error">${e.message}</p>`; }
}

function renderVariantCard(baseType, variant) {
    const { id, name, focusLevels, modifiers } = variant;
    
    let focusesHtml = '';
    for (const f in focusLevels) {
        if (focusLevels[f] > 0) {
            focusesHtml += `
                <div class="xp-row">
                    <div class="xp-label"><span>${f.toUpperCase()}</span><span>Lvl ${focusLevels[f]}</span></div>
                    <div class="xp-bar-container"><div class="xp-bar-fill focus-${f}" style="width: 100%"></div></div>
                </div>`;
        }
    }

    let modifiersHtml = '';
    if (modifiers) {
        const modifierLabels = {
            productionMultiplier: { label: 'Production', isPos: true },
            costMultiplier: { label: 'Build Cost', isPos: false },
            energyMultiplier: { label: 'Energy Cons.', isPos: false },
            populationMultiplier: { label: 'Workforce', isPos: false }
        };

        for (const modKey in modifiers) {
            const val = modifiers[modKey];
            if (val !== undefined && Math.abs(val - 1) > 0.001) {
                const config = modifierLabels[modKey];
                if (!config) continue;
                const percent = ((val - 1) * 100).toFixed(1);
                const isGood = (val > 1) === config.isPos;
                modifiersHtml += `
                    <div class="bt-row" style="margin-bottom: 2px;">
                        <span class="bt-label" style="font-size: 0.7rem;">${config.label.toUpperCase()}</span>
                        <span class="bt-value ${isGood ? 'archived' : 'unstable'}" style="font-size: 0.75rem;">${val > 1 ? '+' : ''}${percent}%</span>
                    </div>`;
            }
        }
    }

    const escapedName = (name || baseType).replace(/'/g, "\\'");

    return `
        <div class="research-card" id="variant-${id}">
            <div class="card-corner-top"></div>
            <div class="card-header">
                <div class="header-main">
                    <div class="title-row">
                        <span class="name">${name || baseType}</span>
                    </div>
                    <div class="blueprint-row">
                        <span class="eff-multiplier" style="color: var(--accent-blue); opacity: 0.8; font-size: 0.65rem;">BUILDING MODEL</span>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="diagnostic-section">
                    <div class="section-tag">Focus Calibration</div>
                    <div class="xp-section" style="gap: 8px;">
                        ${focusesHtml}
                    </div>
                </div>
                <div class="diagnostic-section">
                    <div class="section-tag">System Modifiers</div>
                    <div class="bt-readout">
                        ${modifiersHtml || '<div class="no-mods">NO ACTIVE MODIFIERS</div>'}
                    </div>
                </div>
            </div>
            <div class="building-actions">
                <div class="action-group">
                    <button class="btn upgrade-btn" style="padding: 10px !important;" onclick="window.renameVariant('${baseType}', '${id}', '${escapedName}')">
                        Rename
                    </button>
                    <button class="btn design-btn" onclick="window.shareVariant('${baseType}', '${id}', event)" title="Share Design">
                        🔗
                    </button>
                    <button class="btn design-btn" style="border-color: rgba(244, 63, 94, 0.3); color: var(--accent-red);" onclick="window.deleteVariant('${baseType}', '${id}')" title="Delete">
                        ✕
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.renameVariant = async function(baseType, blueprintId, currentName) {
    const { showPrompt } = await import('./modals.js');
    const newName = await showPrompt('Rename Blueprint', `Enter a new name for your design:`, currentName);
    if (!newName || newName === currentName) return;

    try {
        const response = await fetch(`/api/game/blueprints/${baseType}/${blueprintId}`, { 
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

window.shareVariant = async function(baseType, blueprintId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // Close any existing menu
    const existing = document.getElementById('share-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'share-context-menu';
    menu.className = 'context-menu-scifi';
    
    // Check if player is in an alliance
    const state = window.getGameState();
    const hasAlliance = !!state?.allianceId;

    let html = `<div class="menu-header">BLUEPRINT DISSEMINATION</div>`;
    
    if (hasAlliance) {
        html += `
            <button class="menu-item" onclick="window.executeShareBlueprint('${baseType}', '${blueprintId}', 'alliance')">
                <span class="indicator friend"></span> BROADCAST TO ALLIANCE
            </button>`;
    }

    // Find all players tagged as 'friend'
    const relations = state?.relations || {};
    const friends = [];
    for (const relId in relations) {
        if (relations[relId] === 'friend') friends.push([relId, relations[relId]]);
    }

    if (friends.length > 0) {
        if (hasAlliance) {
            html += `<div class="menu-divider" style="height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0;"></div>`;
        }
        
        // Main "Share with friend" button that opens sub-menu
        html += `
            <button class="menu-item" onclick="window.openFriendShareSubMenu('${baseType}', '${blueprintId}', event)">
                <span class="indicator clear"></span> SHARE WITH FRIEND...
            </button>`;
    }

    if (!hasAlliance && friends.length === 0) {
        html += `<div class="menu-item" style="opacity: 0.5; font-size: 0.6rem;">NO VALID TARGETS FOR DATA TRANSFER</div>`;
    }

    menu.innerHTML = html;
    document.body.appendChild(menu);

    // Position menu next to click
    const x = event ? event.pageX : window.innerWidth / 2;
    const y = event ? event.pageY : window.innerHeight / 2;
    menu.style.left = `${x + 10}px`;
    menu.style.top = `${y + 10}px`;

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
};

window.openFriendShareSubMenu = async function(baseType, blueprintId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        // Use the dedicated friends API
        const friends = await API.getFriends();

        if (friends.length === 0) {
            Notifications.showInfo('No contacts available for data transfer.');
            return;
        }

        // Close current menu
        const existing = document.getElementById('share-context-menu');
        if (existing) existing.remove();

        // Create sub-menu
        const menu = document.createElement('div');
        menu.id = 'share-context-menu';
        menu.className = 'context-menu-scifi';
        
        let html = `<div class="menu-header">SELECT RECIPIENT</div>`;
        
        friends.forEach(f => {
            html += `
                <button class="menu-item" onclick="window.executeShareBlueprint('${baseType}', '${blueprintId}', 'player', '${f.id}')">
                    <span class="indicator friend"></span> ${f.username.toUpperCase()}
                </button>`;
        });

        // Add back button
        html += `
            <div class="menu-divider" style="height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0;"></div>
            <button class="menu-item" onclick="window.shareVariant('${baseType}', '${blueprintId}', event)">
                <span class="indicator clear"></span> << BACK
            </button>`;

        menu.innerHTML = html;
        document.body.appendChild(menu);

        // Position next to mouse
        menu.style.left = `${event.pageX + 10}px`;
        menu.style.top = `${event.pageY + 10}px`;

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);

    } catch (error) {
        Notifications.showError('Failed to resolve contacts: ' + error.message);
    }
};

window.executeShareBlueprint = async function(baseType, blueprintId, targetType, targetId = null) {
    try {
        const result = await API.shareBlueprint(baseType, blueprintId, 'building', targetType, targetId);
        Notifications.showSuccess(`Blueprint successfully shared with ${result.sharedCount} recipients.`);
        const menu = document.getElementById('share-context-menu');
        if (menu) menu.remove();
    } catch (error) {
        Notifications.showError(`Data transfer failed: ${error.message}`);
    }
};

window.deleteVariant = async function(baseType, blueprintId) {
    if (!(await showConfirm('Delete Blueprint', `Are you sure you want to delete this blueprint? Any planets using it will revert to the standard model.`))) return;
    
    try {
        const response = await fetch(`/api/game/blueprints/${baseType}/${blueprintId}`, { method: 'DELETE' });
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

window.startTheoreticalResearch = async function (techKey) {
    try {
        const response = await fetch(`/api/game/planet/${getCurrentPlanetId()}/research/theoretical`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ techKey }) });
        if (!response.ok) { Notifications.showError((await response.json()).message); return; }
        await loadResearchData();
    } catch (e) { Notifications.showError(e.message); }
};

window.showResearchDetails = function (techKey) {
    const res = getTheoreticalResearch()[techKey];
    if (!res) return;

    const lv = typeof researchData.theoretical[techKey] === 'object' ? (researchData.theoretical[techKey].level ?? 0) : (researchData.theoretical[techKey] ?? 0);
    
    const researchLabLevel = currentPlanetBuildings?.researchLab || 0;
    const researchSpeedBonus = getResearchBonus(researchData.theoretical || {}, 'globalResearchSpeed');
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.researchTime || 1.0;

    const stats = [];
    if (res.bonuses) { 
        for (const b in res.bonuses) {
            stats.push({ label: b.replace(/([A-Z])/g, ' $1').toUpperCase(), value: `+${(res.bonuses[b] * 100).toFixed(0)}%` });
        }
    }

    const rows = [];
    for (let i = lv; i < lv + 15; i++) {
        const c = calculateTheoreticalResearchCost(res.baseCost, i, res.costScaling);
        const t = calculateTheoreticalResearchTime(res, i, researchLabLevel, researchSpeedBonus, configMultiplier);
        rows.push([`Level ${i}`, `⚙️${formatNumber(c.metal)} 💎${formatNumber(c.crystal)}`, formatDuration(t * 1000)]);
    }

    renderDetailsModal({ 
        title: `${res.icon} ${res.name.toUpperCase()}`, 
        description: res.detailedDescription || res.description, 
        effects: stats, 
        sections: [
            { title: 'Projected Development Schedule', table: { headers: ['Lvl', 'Requisition', 'Duration'], rows } }
        ] 
    });
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
    const cleanBaseName = baseType.replace(/([A-Z])/g, ' $1').replace(/ (Specialization|Customization)$/, '');
    const defaultName = `${cleanBaseName.charAt(0).toUpperCase() + cleanBaseName.slice(1)} Mk ${nextVersion}`;
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
            const allocationParts = [];
            for (const ak in run.allocation) {
                if (run.allocation[ak] > 0) {
                    allocationParts.push(`${ak.charAt(0).toUpperCase()}: ${(run.allocation[ak] * 100).toFixed(0)}%`);
                }
            }
            const allocationStr = allocationParts.join(', ');
            
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

export function updateResearchView(player, planetId = null, forceFetch = false) {
    const target = planetId || getCurrentPlanetId() || (player?.planets?.[0]?.id);
    if (target) { const p = player.planets.find(pl => pl.id === target); if (p) currentPlanetBuildings = p.buildings; }
    
    if (forceFetch || !researchData) {
        loadResearchData(forceFetch);
    } else {
        updateCurrentTabStatus();
    }
}

export function updateResearchTimers() { updateResearchQueueTimers(); }