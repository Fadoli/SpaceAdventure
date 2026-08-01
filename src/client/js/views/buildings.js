// Buildings view logic
import { API } from '../api.js';
import { escapeHtml, formatNumber, formatCountdown, formatDuration } from '../utils.js';
import { renderDetailsModal, closeDetailsModal } from './details.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';
import { RESOURCE_ICONS, SCALING } from '../../../shared/constants.js';
import { BUILDINGS } from '../../../shared/buildings.js';
import { getCustomVariant } from '../../../shared/research.js';
import { isEmpty } from '../../../shared/utils.js';
import { calculateAllocationEffectiveness } from '../../../shared/formulas.js';
import { getCurrentPlanetId } from '../main.js';

let currentGameState = null;
let lastBuildingStateHash = null;
let lastQueueStateHash = null;
let cachedBuildingDetails = null;

/**
 * Set the current game state (called from main)
 */
function calculateBuildingStateHash(buildings, planet) {
    const state = {
        planetId: planet.id,
        buildings: buildings,
        resources: planet.resources,
        buildingAllocations: planet.buildingAllocations,
        actualAllocations: planet.actualAllocations
    };
    return JSON.stringify(state);
}

/**
 * Calculate a hash of the queue state to detect changes
 */
function calculateQueueStateHash(queue) {
    return JSON.stringify(queue.map(q => ({ building: q.building, level: q.level, finishTime: q.finishTime })));
}

/**
 * Set the current game state (called from main)
 */
export function setGameState(gameState) {
    currentGameState = gameState;
}

/**
 * Update buildings view with planet data
 */
export async function updateBuildingsView(planet, onStateChange, forceFetch = false) {
    const buildingsGrid = document.getElementById('buildings-grid');
    if (!buildingsGrid) return;

    // Check structural hash before fetching
    // (levels or variant assignments)
    const currentStructuralHash = JSON.stringify({
        planetId: planet.id,
        buildings: planet.buildings,
        activeVariants: planet.activeVariants,
        queueCount: planet.buildQueue?.length || 0
    });

    const needsFetch = forceFetch || !cachedBuildingDetails || currentStructuralHash !== lastBuildingStateHash;
    
    // Fetch building details from server only if needed
    if (needsFetch) {
        try {
            // console.log(`[Buildings] Fetching details for ${planet.name} (force=${forceFetch})`);
            cachedBuildingDetails = await API.getBuildingDetails(planet.id);
            lastBuildingStateHash = currentStructuralHash;
        } catch (error) {
            console.error('Failed to load building details:', error);
            if (!cachedBuildingDetails) {
                buildingsGrid.innerHTML = '<p class="error">Failed to load building information</p>';
                return;
            }
        }
    }
    
    const { buildings, queue, maxQueueSize } = cachedBuildingDetails;
    
    // Re-render only if hash changed or container is empty
    if (needsFetch || buildingsGrid.innerHTML.trim() === '') {
        renderBuildingCards(buildings, planet, queue, maxQueueSize);
    } else {
        // Just update dynamic elements (resources, affordance, etc)
        updateBuildingCostsAndAffordance(buildings, planet, queue, maxQueueSize);
    }
    
    // Update queue view independently
    const currentQueueHash = calculateQueueStateHash(queue);
    if (currentQueueHash !== lastQueueStateHash) {
        updateQueueView(queue, maxQueueSize, buildings);
        lastQueueStateHash = currentQueueHash;
    }
    
    // Update timers
    updateTimers();
}

/**
 * Render all building cards from scratch
 */
function renderBuildingCards(buildings, planet, queue, maxQueueSize) {
    const buildingsGrid = document.getElementById('buildings-grid');
    
    buildingsGrid.innerHTML = renderGridView(buildings, planet, queue, maxQueueSize);
    
    // Initial update of dynamic elements
    updateBuildingCostsAndAffordance(buildings, planet, queue, maxQueueSize);
}

function renderGridView(buildings, planet, queue, maxQueueSize) {
    const buildingHtmls = [];
    for (const key in buildings) {
        const building = buildings[key];
        const queueCount = queue.filter(item => item.building === key).length;
        
        let designSelector = '';
        if (building.availableBlueprints && building.availableBlueprints.length > 0) {
            designSelector = `
                <button class="btn-icon-action" onclick="window.openDesignSelection('${key}')" title="Modify planetary design / Change blueprint">
                    🎨
                </button>
            `;
        }

        let allocationBadge = '';
        const allocatableBuildings = ['metalMine', 'crystalMine', 'deuteriumSynthesizer', 'waterExtractor', 'farm'];
        if (allocatableBuildings.includes(key) && building.currentLevel > 0) {
            allocationBadge = `<div id="allocation-badge-${key}" class="allocation-badge-container"></div>`;
        }

        const isOperational = (planet.actualAllocations?.[key]?.power || 0) > 0 && building.currentLevel > 0;
        const hasBlueprints = (building.availableBlueprints || []).length > 0 || building.currentVariant !== 'base';

        buildingHtmls.push(`
            <div class="building-card ${queueCount > 0 ? 'in-queue' : ''} ${building.currentVariant !== 'base' ? 'custom-active' : ''}" id="building-card-${key}" role="button" tabindex="0" onclick="window.showBuildingDetails('${key}')" onkeydown="if (event.target === this && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); window.showBuildingDetails('${key}'); }">
                <div class="card-corner-top"></div>
                
                <div class="building-header" title="${building.description}">
                    <div class="header-main">
                        <div class="title-row">
                            <span class="status-led ${isOperational ? 'led-on' : 'led-off'}"></span>
                            <h3><img class="entity-art" src="/assets/icons/buildings/${key}.png" alt="" loading="lazy"> <span>${building.name}</span></h3>
                        </div>
                        <div class="blueprint-row">
                            <span class="level-indicator">Lvl ${building.currentLevel}</span>
                        </div>
                    </div>
                </div>
                
                <div class="building-body">
                    ${allocationBadge}
                    <div id="queue-badge-${key}"></div>
                    
                    <div class="diagnostic-section">
                        <div class="section-tag">Requisition</div>
                        <div class="building-cost" id="cost-display-${key}"></div>
                    </div>

                    <div class="diagnostic-section">
                        <div class="section-tag">Diagnostics</div>
                        <div class="building-stats">
                            <div class="build-time" id="time-display-${key}">🕐 Build time: --</div>
                            <div id="stats-info-${key}"></div>
                            <div id="energy-info-${key}"></div>
                        </div>
                    </div>
                </div>

                <div class="building-actions">
                    <div class="action-group">
                        <button class="btn upgrade-btn" id="upgrade-btn-${key}" onclick="event.stopPropagation(); window.upgradeBuilding('${key}')">
                            Upgrade
                        </button>
                        ${hasBlueprints ? `
                            <button class="btn design-btn" onclick="event.stopPropagation(); window.openDesignSelection('${key}')" title="Operational Configuration / Change Blueprint">
                                ⚙️
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `);
    }
    return buildingHtmls.join('');
}

/**
 * Update costs, affordance, and stats without re-rendering the whole card
 */
function updateBuildingCostsAndAffordance(buildings, planet, queue, maxQueueSize) {
    const queueFull = queue.length >= maxQueueSize;

    // Helper for granular updates
    const granularUpdate = (id, html, isText = false) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (isText) {
            if (el.textContent !== String(html)) el.textContent = html;
        } else {
            if (el.innerHTML !== html) el.innerHTML = html;
        }
    };

    for (const key in buildings) {
        try {
            const building = buildings[key];
            const queueCount = queue.filter(item => item.building === key).length;
            
            // Update cost display
            if (building.cost) {
                const costHtml = `
                    <div class="${planet.resources.metal < building.cost.metal ? 'text-error' : ''}">⚙️ ${formatNumber(building.cost.metal)}</div>
                    <div class="${planet.resources.crystal < building.cost.crystal ? 'text-error' : ''}">💎 ${formatNumber(building.cost.crystal)}</div>
                    ${building.cost.deuterium > 0 ? `<div class="${planet.resources.deuterium < building.cost.deuterium ? 'text-error' : ''}">🛢️ ${formatNumber(building.cost.deuterium)}</div>` : ''}
                `;
                granularUpdate(`cost-display-${key}`, costHtml);
            } else {
                const statusHtml = building.currentLevel >= (building.maxLevel || 50) ? '<div class="text-success">Maximum level reached</div>' : '<div>Cost info unavailable</div>';
                granularUpdate(`cost-display-${key}`, statusHtml);
            }

            // Update build time
            const timeText = building.buildTime ? `🕐 Build time: ${formatCountdown(building.buildTime)}` : '';
            granularUpdate(`time-display-${key}`, timeText, true);

            // Update button status
            const btn = document.getElementById(`upgrade-btn-${key}`);
            if (btn) {
                let btnText = `Upgrade to Level ${building.nextLevel}`;
                let btnTooltip = 'Upgrade to next level';
                let btnDisabled = !building.canAfford || queueFull || !building.requirementsMet;
                
                if (queueFull) {
                    btnTooltip = 'Build queue is full';
                    btnText = 'Queue Full';
                } else if (!building.requirementsMet) {
                    const reqs = building.requirementsList?.map(r => `${r.name} Lvl ${r.level}`).join(', ') || '';
                    btnTooltip = `Requirements not met: ${reqs}`;
                    btnText = 'Requirements Not Met';
                } else if (!building.canAfford) {
                    btnTooltip = 'Insufficient resources';
                }
                
                if (btn.textContent !== btnText) btn.textContent = btnText;
                if (btn.disabled !== btnDisabled) btn.disabled = btnDisabled;
                if (btn.title !== btnTooltip) btn.title = btnTooltip;
                
                const btnClass = 'btn btn-full upgrade-btn';
                if (btn.className !== btnClass) btn.className = btnClass;
            }

            // Update queue badge
            const qBadgeHtml = queueCount > 0 ? `<div class="queue-count-badge">📋 In queue: ${queueCount}</div>` : '';
            granularUpdate(`queue-badge-${key}`, qBadgeHtml);

            // Update stats and energy
            let statsHtml = '';
            if (building.storage && !isEmpty(building.storage)) {
                statsHtml = '<div class="building-storage">';
                for (const resource in building.storage) {
                    const nextAmount = building.storage[resource];
                    let currentAmount = 0;
                    if (building.currentLevel > 0) {
                        const scaling = building.costScaling || SCALING.BUILDING_STORAGE;
                        const baseAmount = nextAmount / Math.pow(scaling, building.nextLevel - 1);
                        currentAmount = Math.floor(baseAmount * Math.pow(scaling, building.currentLevel - 1));
                    }
                    const diff = nextAmount - currentAmount;
                    statsHtml += `<div>${RESOURCE_ICONS[resource] || '❓'} +${formatNumber(diff)}</div>`;
                }
                statsHtml += '</div>';
            } else if (building.production && !isEmpty(building.production)) {
                statsHtml = '<div class="building-production">';
                if (!isEmpty(building.productionGains)) {
                    statsHtml += `<div class="expected-gain" title="Expected gain if you upgrade, keeping current allocations">Gain: `;
                    for (const res in building.productionGains) {
                        statsHtml += `<span class="gain-value">${RESOURCE_ICONS[res] || ''} +${formatNumber(building.productionGains[res])}/h</span> `;
                    }
                    statsHtml += `</div>`;
                }
                statsHtml += '</div>';
            }
            
            if (!statsHtml) {
                const speedMap = {
                    roboticsFactory: { icon: '⏱️', label: 'Construction' },
                    researchLab: { icon: '🔬', label: 'Research' },
                    shipyard: { icon: '🚀', label: 'Production' },
                    naniteFactory: { icon: '⚡', label: 'Construction' }
                };
                if (speedMap[key] && building.currentLevel > 0) {
                    const def = BUILDINGS[key];
                    const speedMult = key === 'naniteFactory' 
                        ? Math.pow(2, building.currentLevel).toFixed(0)
                        : (1 / Math.pow(def.speedMultiplier || 0.85, building.currentLevel)).toFixed(2);
                    statsHtml = `<div class="building-special">${speedMap[key].icon} ${speedMap[key].label}: ${speedMult}x speed</div>`;
                }
            }
            granularUpdate(`stats-info-${key}`, statsHtml);

            let energyHtml = '';
            if (key === 'fusionReactor' && building.deuteriumGain > 0) {
                energyHtml = `<div class="building-energy expected-gain">🛢️ Cost: +${formatNumber(building.deuteriumGain)}/h</div>`;
            } else if (building.energyConsumption > 0 && building.energyGain > 0) {
                energyHtml = `<div class="building-energy expected-gain">⚡ Cost: +${formatNumber(building.energyGain)}/h</div>`;
            }
            granularUpdate(`energy-info-${key}`, energyHtml);

            // Allocation badges
            const allocation = planet.buildingAllocations?.[key];
            if (allocation) {
                const powerEff = calculateAllocationEffectiveness(allocation.power * 100) / 100;
                const popEff = calculateAllocationEffectiveness(allocation.population * 100) / 100;
                const effPercent = (powerEff * popEff * 100).toFixed(0);
                
                let allocHtml = `<div class="allocation-badge-row" title="Detailed Target: Power ${(allocation.power * 100).toFixed(0)}%, Workers ${(allocation.population * 100).toFixed(0)}%">`;
                allocHtml += `<span class="alloc-label">⚙️ EFFICIENCY:</span> <span class="alloc-val">Target ${effPercent}%</span>`;
                
                const actual = planet.actualAllocations?.[key];
                if (actual) {
                    const actualTotalEff = (calculateAllocationEffectiveness(actual.power * 100) / 100) * (calculateAllocationEffectiveness(actual.population * 100) / 100);
                    const actualEffPercent = (actualTotalEff * 100).toFixed(0);
                    const actualEffClass = actualTotalEff >= 0.9 ? 'text-success' : actualTotalEff >= 0.6 ? 'text-warning' : 'text-danger';
                    allocHtml += `<span class="alloc-divider">|</span> <span class="alloc-val">Actual <span class="${actualEffClass}">${actualEffPercent}%</span></span>`;
                }
                allocHtml += `</div>`;
                granularUpdate(`allocation-badge-${key}`, allocHtml);
            }

            // Update variant switch buttons (handled via modal now, but kept for HUD if needed)
            const variantActions = document.getElementById(`variant-actions-${key}`);
            if (variantActions && building.hasCustomVariant && building.customVariant) {
                variantActions.innerHTML = `
                    <button class="btn btn-full btn-secondary" onclick="window.openDesignSelection('${key}')">
                        🎨 Design
                    </button>
                `;
            }
        } catch (e) {
            console.error(`Error updating building ${key}:`, e);
        }
    }
}

/** Helper for variant switch cost estimate */
function calculateSwitchCostEstimate(building, isCustomActive) {
    let baseCost = building.baseCost || building.cost;
    let currentCost = building.cost;
    
    // For switching TO custom, we need to know the target custom cost.
    // In this estimate, we use the specific customVariant attached to the building
    let targetCost = baseCost;
    if (!isCustomActive && building.customVariant?.modifiers?.costMultiplier) {
        targetCost = {
            metal: Math.floor(baseCost.metal * building.customVariant.modifiers.costMultiplier),
            crystal: Math.floor(baseCost.crystal * building.customVariant.modifiers.costMultiplier),
            deuterium: Math.floor(baseCost.deuterium * building.customVariant.modifiers.costMultiplier)
        };
    }
    
    return calculateSwitchCost(currentCost, targetCost);
}

// Load saved preference
let queueVisible = localStorage.getItem('buildQueueVisible') !== 'false';

/**
 * Toggle queue visibility
 */
window.toggleQueueVisibility = function() {
    queueVisible = !queueVisible;
    localStorage.setItem('buildQueueVisible', queueVisible);
    
    const items = document.querySelector('.build-queue-summary .queue-items');
    const header = document.querySelector('.build-queue-summary .queue-header');
    const toggle = document.querySelector('.build-queue-summary .queue-header .toggle-icon');
    
    if (items) {
        items.style.display = queueVisible ? 'flex' : 'none';
    }
    if (toggle) {
        toggle.textContent = queueVisible ? '🔼' : '🔽';
    }
    header?.setAttribute('aria-expanded', String(queueVisible));
};

/**
 * Update the queue view independently
 */
function updateQueueView(queue, maxQueueSize, buildings) {
    const queueContainer = document.getElementById('buildings-queue-container');
    
    if (queue.length > 0) {
        const queueSummary = `
            <div class="build-queue-summary">
                <div class="card-corner-top"></div>
                <div class="queue-header" role="button" tabindex="0" aria-expanded="${queueVisible}" aria-controls="build-queue-items" onclick="window.toggleQueueVisibility()" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.toggleQueueVisibility(); }">
                    <h3>🔨 CONSTRUCTION LOG (${queue.length}/${maxQueueSize})</h3>
                    <span class="toggle-icon">${queueVisible ? '🔼' : '🔽'}</span>
                </div>
                <div id="build-queue-items" class="queue-items" style="display: ${queueVisible ? 'flex' : 'none'};">
                    ${queue.map((item, index) => {
                        const isActive = index === 0;
                        const elapsed = Date.now() - item.startTime;
                        const total = item.finishTime - item.startTime;
                        const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                        
                        const posLabel = index === 0 ? 'ACTUAL' : (index === 1 ? 'NEXT' : `#${item.queuePosition}`);

                        return `
                            <div class="queue-item ${isActive ? 'active' : ''}">
                                <div class="queue-item-row">
                                    <span class="q-pos" style="width: 60px;">${posLabel}</span>
                                    <span class="q-name" title="${buildings[item.building]?.name || item.building}">${buildings[item.building]?.name || item.building}</span>
                                    <span class="q-level">LVL ${item.level}</span>
                                    <div class="progress-bar-mini">
                                        <div class="progress-fill" id="build-progress-${item.queuePosition}" style="width: ${isActive ? percent : 0}%"></div>
                                    </div>
                                    <span class="q-time-mini timer" data-finish="${item.finishTime}" data-start="${item.startTime}" data-queue-pos="${item.queuePosition}"></span>
                                    <button class="btn-cancel-small" onclick="window.cancelBuilding(${item.queuePosition})" title="Abort Project">✕</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        queueContainer.innerHTML = queueSummary;
    } else {
        queueContainer.innerHTML = '';
    }
}

export function updateTimers() {
    const now = Date.now();
    // Target all timer elements across all views
    document.querySelectorAll('.timer').forEach(timer => {
        const finishTime = parseInt(timer.dataset.finish);
        const startTime = parseInt(timer.dataset.start);
        const queuePos = timer.dataset.queuePos;
        const id = timer.dataset.id;
        
        if (!finishTime) return;

        const remaining = Math.max(0, finishTime - now);
        
        // Use helpful duration format
        if (remaining === 0) {
            timer.textContent = 'COMPLETE!';
        } else {
            timer.textContent = formatDuration(remaining);
        }
        
        // Update Building/Shipyard progress bar
        if (queuePos) {
            const progressBar = document.getElementById(`build-progress-${queuePos}`);
            if (progressBar && startTime && finishTime) {
                const total = finishTime - startTime;
                const elapsed = now - startTime;
                const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                progressBar.style.width = `${percent}%`;
            }
        }

        // Update Research progress bars
        if (id) {
            const bar = document.getElementById(`research-theory-progress-${id}`) || 
                        document.getElementById(`research-practical-progress-${id}`);
            if (bar && startTime && finishTime) {
                const total = finishTime - startTime;
                const elapsed = now - startTime;
                const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                bar.style.width = `${percent}%`;
            }
        }
    });
}

/**
 * Upgrade building (exposed globally)
 */
export async function upgradeBuilding(buildingKey, onStateChange) {
    const planetId = getCurrentPlanetId();
    if (!planetId) return;
    
    try {
        await API.upgradeBuilding(planetId, buildingKey);
        if (onStateChange) await onStateChange();
    } catch (error) {
        Notifications.showError('Error: ' + error.message);
    }
}

export async function openDesignSelection(buildingKey) {
    const planetId = getCurrentPlanetId();
    if (!planetId) return;
    
    try {
        const buildingDetails = await API.getBuildingDetails(planetId);
        const building = buildingDetails.buildings[buildingKey];
        const planet = currentGameState?.planets.find(p => p.id === planetId);
        
        if (building && planet) {
            showBlueprintSelectionModal(buildingKey, building, planet);
        }
    } catch (error) {
        Notifications.showError('Failed to open design selection: ' + error.message);
    }
}

window.openDesignSelection = openDesignSelection;

/**
 * Show modal for selecting from multiple blueprints
 */
export async function showBlueprintSelectionModal(buildingKey, building, planet) {
    const modal = document.getElementById('custom-variant-modal') || createCustomVariantModal();
    const modalTitle = document.getElementById('modal-variant-title');
    const modalBody = document.getElementById('modal-variant-body');
    
    modalTitle.textContent = `Design Options: ${building.name}`;
    modal.style.display = 'flex';
    
    const blueprints = building.availableBlueprints || [];
    renderBlueprintList(modalBody, buildingKey, building, blueprints, planet);
}

function renderBlueprintList(container, buildingKey, building, blueprints, planet) {
    const activeBlueprintId = building.currentVariant || 'base';
    const baseCost = building.baseCost || building.cost;
    const currentCost = building.cost;
    
    let html = '<div class="blueprint-selection-grid">';
    
    // --- Option 1: Base Model ---
    const isBaseActive = activeBlueprintId === 'base';
    const baseSwitchCost = calculateSwitchCost(currentCost, baseCost);
    const isBaseRefund = (baseCost.metal + baseCost.crystal + baseCost.deuterium) < 
                        (currentCost.metal + currentCost.crystal + currentCost.deuterium);

    html += `
        <div class="blueprint-card-select ${isBaseActive ? 'active' : ''}">
            <div class="blueprint-card-header">
                <h4>Standard Model</h4>
                ${isBaseActive ? '<span class="active-tag">Active</span>' : ''}
            </div>
            <div class="blueprint-card-body">
                <p class="blueprint-desc">Reliable standard design.</p>
                <div class="blueprint-modifiers">
                    <div class="mod-row"><span class="mod-icon">📉</span> <span class="mod-label">No custom modifiers</span></div>
                </div>
                <div class="blueprint-switch-cost ${isBaseActive ? 'hidden' : (isBaseRefund ? 'refund' : 'cost')}">
                    <strong>Switch ${isBaseRefund ? 'Refund' : 'Cost'}:</strong>
                    <div>⚙️ ${formatNumber(Math.abs(baseSwitchCost.metal))} 💎 ${formatNumber(Math.abs(baseSwitchCost.crystal))}</div>
                </div>
            </div>
            <div class="blueprint-card-footer">
                <button class="btn btn-primary btn-full" onclick="window.selectAndActivateBlueprint('${buildingKey}', 'base')" ${isBaseActive ? 'disabled' : ''}>
                    ${isBaseActive ? 'Current Design' : 'Select Design'}
                </button>
            </div>
        </div>
    `;

    // --- Option 2+: Blueprints ---
    for (const bp of blueprints) {
        const isActive = activeBlueprintId === bp.id;
        const modifiers = getCustomVariant(buildingKey, bp.focusLevels)?.modifiers || bp.modifiers;
        
        let targetCost = baseCost;
        if (modifiers && modifiers.costMultiplier !== 1) {
            targetCost = {
                metal: Math.floor(baseCost.metal * modifiers.costMultiplier),
                crystal: Math.floor(baseCost.crystal * modifiers.costMultiplier),
                deuterium: Math.floor(baseCost.deuterium * modifiers.costMultiplier)
            };
        }

        const switchCost = calculateSwitchCost(currentCost, targetCost);
        const isRefund = (targetCost.metal + targetCost.crystal + targetCost.deuterium) < 
                         (currentCost.metal + currentCost.crystal + currentCost.deuterium);

        const modifierLabels = {
            productionMultiplier: { label: 'Production', icon: '📈', isPos: true },
            costMultiplier: { label: 'Build Cost', icon: '💰', isPos: false },
            energyMultiplier: { label: 'Energy Cons.', icon: '⚡', isPos: false },
            populationMultiplier: { label: 'Workforce', icon: '👥', isPos: false }
        };

        let modifiersHtml = '';
        if (modifiers) {
            for (const modKey in modifierLabels) {
                const val = modifiers[modKey];
                if (val !== undefined && Math.abs(val - 1) > 0.001) {
                    const config = modifierLabels[modKey];
                    const percent = formatNumber((val - 1) * 100);
                    const isGood = (val > 1) === config.isPos;
                    modifiersHtml += `<div class="mod-row ${isGood ? 'pos' : 'neg'}">
                        <span class="mod-icon">${config.icon}</span>
                        <span class="mod-label">${config.label}:</span>
                        <span class="mod-value">${val > 1 ? '+' : ''}${percent}%</span>
                    </div>`;
                }
            }
        }

        html += `
            <div class="blueprint-card-select ${isActive ? 'active' : ''}">
                <div class="blueprint-card-header">
                    <h4>${escapeHtml(bp.name)}</h4>
                    ${isActive ? '<span class="active-tag">Active</span>' : ''}
                </div>
                <div class="blueprint-card-body">
                    <div class="blueprint-modifiers">
                        ${modifiersHtml || '<div class="no-mods">No significant modifiers</div>'}
                    </div>
                    <div class="blueprint-switch-cost ${isActive ? 'hidden' : (isRefund ? 'refund' : 'cost')}">
                        <strong>Switch ${isRefund ? 'Refund' : 'Cost'}:</strong>
                        <div>⚙️ ${formatNumber(Math.abs(switchCost.metal))} 💎 ${formatNumber(Math.abs(switchCost.crystal))}</div>
                    </div>
                </div>
                <div class="blueprint-card-footer">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-full" onclick="window.selectAndActivateBlueprint('${buildingKey}', '${bp.id}')" ${isActive ? 'disabled' : ''}>
                            ${isActive ? 'Current Design' : 'Select Design'}
                        </button>
                        <button class="btn btn-danger" onclick="window.deleteBlueprintFromSelection('${buildingKey}', '${bp.id}')" title="Delete Blueprint">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

window.selectAndActivateBlueprint = async function(buildingKey, blueprintId) {
    const planetId = getCurrentPlanetId();
    try {
        await API.request(`/game/planet/${planetId}/building/${buildingKey}/activate-blueprint`, {
            method: 'POST',
            body: JSON.stringify({ blueprintId })
        });
        
        Notifications.showSuccess('Design switched successfully!');
        window.closeCustomVariantModal();
        if (window.loadGameState) await window.loadGameState();
    } catch (error) {
        Notifications.showError('Switch failed: ' + error.message);
    }
};

window.deleteBlueprintFromSelection = async function(buildingKey, blueprintId) {
    if (!(await showConfirm('Delete Blueprint', `Delete this design? It will no longer be available for selection.`))) return;
    try {
        await API.request(`/game/blueprints/${buildingKey}/${blueprintId}`, { method: 'DELETE' });
        // Refresh modal
        window.openDesignSelection(buildingKey);
    } catch (error) {
        Notifications.showError('Delete failed: ' + error.message);
    }
};

/**
 * Create custom variant selection modal if it doesn't exist
 */
function createCustomVariantModal() {
    const modal = document.getElementById('custom-variant-modal') || createCustomVariantModalElement();
    return modal;
}

function createCustomVariantModalElement() {
    const modal = document.createElement('div');
    modal.id = 'custom-variant-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="card-corner-top"></div>
            <div class="modal-header">
                <h2 id="modal-variant-title">CONFIGURATION INTERFACE</h2>
                <button type="button" onclick="window.closeCustomVariantModal()" class="modal-close" aria-label="Close">&times;</button>
            </div>
            <div id="modal-variant-body" class="modal-body"></div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

/**
 * Close custom variant modal
 */
export function closeCustomVariantModal() {
    const modal = document.getElementById('custom-variant-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.closeCustomVariantModal = closeCustomVariantModal;

/**
 * Calculate switch cost between base and custom
 */
function calculateSwitchCost(baseCost, customCost) {
    const baseTotalCost = baseCost.metal + baseCost.crystal + baseCost.deuterium;
    const customTotalCost = customCost.metal + customCost.crystal + customCost.deuterium;
    
    if (customTotalCost > baseTotalCost) {
        // Custom is more expensive, cost is twice the difference
        const difference = {
            metal: customCost.metal - baseCost.metal,
            crystal: customCost.crystal - baseCost.crystal,
            deuterium: customCost.deuterium - baseCost.deuterium
        };
        return {
            metal: Math.max(0, difference.metal * 2),
            crystal: Math.max(0, difference.crystal * 2),
            deuterium: Math.max(0, difference.deuterium * 2)
        };
    } else {
        // Custom is cheaper, refund half the difference
        const difference = {
            metal: baseCost.metal - customCost.metal,
            crystal: baseCost.crystal - customCost.crystal,
            deuterium: baseCost.deuterium - customCost.deuterium
        };
        return {
            metal: -Math.floor(difference.metal / 2),
            crystal: -Math.floor(difference.crystal / 2),
            deuterium: -Math.floor(difference.deuterium / 2)
        };
    }
}

/**
 * Get output differences between base and custom variant
 */
function getOutputDifferences(building, variant) {
    const diffs = [];
    
    if (!variant || !variant.modifiers) {
        return diffs;
    }
    
    // modifiers are stored as multiplicative values (e.g., 1.49 = ×1.49 = +49%, 0.7 = ×0.7 = -30%)
    // productionMultiplier, costMultiplier, energyMultiplier, etc.
    
    // Production changes
    if (variant.modifiers.productionMultiplier !== undefined && variant.modifiers.productionMultiplier !== 1) {
        const change = variant.modifiers.productionMultiplier;
        diffs.push({
            label: 'Production',
            change: change,
            icon: '📈'
        });
    }
    
    // Energy consumption changes
    if (variant.modifiers.energyMultiplier !== undefined && variant.modifiers.energyMultiplier !== 1) {
        const change = variant.modifiers.energyMultiplier;
        diffs.push({
            label: 'Energy consumption',
            change: change,
            icon: '⚡'
        });
    }
    
    // Cost changes
    if (variant.modifiers.costMultiplier !== undefined && variant.modifiers.costMultiplier !== 1) {
        const change = variant.modifiers.costMultiplier;
        diffs.push({
            label: 'Build cost',
            change: change,
            icon: '💰'
        });
    }
    
    // Population changes
    if (variant.modifiers.populationMultiplier !== undefined && variant.modifiers.populationMultiplier !== 1) {
        const change = variant.modifiers.populationMultiplier;
        diffs.push({
            label: 'Population requirement',
            change: change,
            icon: '👥'
        });
    }
    
    return diffs;
}

/**
 * Cancel building (exposed globally)
 */
export async function cancelBuilding(queuePosition, onStateChange) {
    const planetId = getCurrentPlanetId();
    if (!planetId) return;
    
    const confirmed = await showConfirm('Cancel Building', `Cancel building at queue position ${queuePosition}? You will get 50% resources back.`);
    if (confirmed) {
        try {
            await API.cancelBuilding(planetId, queuePosition);
            if (onStateChange) await onStateChange();
        } catch (error) {
            Notifications.showError('Error: ' + error.message);
        }
    }
}

/**
 * Show building details modal
 */
export async function showBuildingDetails(buildingKey) {
    const planetId = getCurrentPlanetId();
    if (!planetId) return;
    
    const planet = currentGameState?.planets.find(p => p.id === planetId);
    if (!planet) return;
    
    // Fetch detailed stats from server
    let buildingDetails;
    try {
        buildingDetails = await API.getBuildingDetails(planet.id);
    } catch (error) {
        console.error('Failed to load building details:', error);
        return;
    }
    
    const building = buildingDetails.buildings[buildingKey];
    const currentLevel = building.currentLevel;
    
    const levels = [];
    const levelProjections = building.levelProjections || [];

    // Generate levels to display
    const levelsToGenerate = [];
    const maxDisplayLevel = building.maxLevel || 50;
    const windowSize = 4;
    
    if (currentLevel <= 8) {
        // Show 1 to 15 for low levels
        for (let l = 1; l <= Math.min(15, maxDisplayLevel); l++) levelsToGenerate.push(l);
    } else {
        // Show 1, then gap, then window around current
        levelsToGenerate.push(1);
        if (currentLevel - windowSize > 2) levelsToGenerate.push('gap');
        
        const start = Math.max(2, currentLevel - windowSize);
        const end = Math.min(maxDisplayLevel, currentLevel + windowSize);
        
        for (let l = start; l <= end; l++) levelsToGenerate.push(l);
    }

    for (const levelItem of levelsToGenerate) {
        if (levelItem === 'gap') {
            levels.push({ isGap: true });
            continue;
        }
        
        const projection = levelProjections.find(item => item.level === levelItem);
        if (projection) levels.push(projection);
    }
    
    // Prepare table data
    const headers = [
        'Level',
        'Cost',
        'Build Time',
        buildingKey.includes('Storage') ? 'Capacity' :
        buildingKey === 'roboticsFactory' ? 'Construction Speed' :
        buildingKey === 'naniteFactory' ? 'Nanite Speed' :
        buildingKey === 'researchLab' ? 'Research Speed' :
        buildingKey === 'shipyard' ? 'Production Speed' :
        'Production',
        buildingKey === 'fusionReactor' ? 'Deuterium' : 'Energy'
    ];

    const rows = levels.map(l => {
        if (l.isGap) {
            return headers.map(() => '<span style="color: var(--text-secondary); opacity: 0.5;">...</span>');
        }

        const isCurrent = l.level === currentLevel;
        
        // Determine what data to display based on building type
        let dataCell = '';
        if (l.storage) {
            // Storage building - show storage amounts
            for (const resource in l.storage) {
                const amount = l.storage[resource];
                const icon = RESOURCE_ICONS[resource] || '❓';
                dataCell += `<div>${icon}+${formatNumber(amount)}</div>`;
            }
        } else if (l.production) {
            // Production building - show production amounts
            for (const resource in l.production) {
                const amount = l.production[resource];
                const icon = RESOURCE_ICONS[resource] || '❓';
                dataCell += `<div>${icon}+${formatNumber(amount)}/h</div>`;
            }
        } else if (buildingKey === 'roboticsFactory') {
            // Robotics factory - show construction speed multiplier
            const roboticsDef = BUILDINGS.roboticsFactory;
            const speedMultiplier = roboticsDef.speedMultiplier || 0.85;
            const speedMult = 1 / Math.pow(speedMultiplier, l.level);
            dataCell = `<div>⏱️ ${speedMult.toFixed(2)}x speed<br><span style="font-size: 0.9em;">(1 / ${speedMultiplier}^${l.level})</span></div>`;
        } else if (buildingKey === 'naniteFactory') {
            // Nanite factory - show massive construction speed
            const speedMult = Math.pow(2, l.level);
            dataCell = `<div>⚡ ${speedMult.toFixed(0)}x speed<br><span style="font-size: 0.9em;">(2^${l.level})</span></div>`;
        } else if (buildingKey === 'researchLab') {
            // Research lab - show research speed multiplier
            const labDef = BUILDINGS.researchLab;
            const speedMultiplier = labDef.speedMultiplier || 0.85;
            const speedMult = 1 / Math.pow(speedMultiplier, l.level);
            dataCell = `<div>🔬 ${speedMult.toFixed(2)}x speed<br><span style="font-size: 0.9em;">(1 / ${speedMultiplier}^${l.level})</span></div>`;
        } else if (buildingKey === 'shipyard') {
            // Shipyard - show production multiplier
            const shipyardDef = BUILDINGS.shipyard;
            const speedMultiplier = shipyardDef.speedMultiplier || 0.85;
            const speedMult = 1 / Math.pow(speedMultiplier, l.level);
            dataCell = `<div>🚀 ${speedMult.toFixed(2)}x speed<br><span style="font-size: 0.9em;">(1 / ${speedMultiplier}^${l.level})</span></div>`;
        } else {
            dataCell = '-';
        }
        
        let consumptionCell = '-';
        if (buildingKey === 'fusionReactor' && l.deuteriumConsumption > 0) {
            consumptionCell = `🛢️-${formatNumber(l.deuteriumConsumption)}/h`;
        } else if (l.energyConsumption > 0) {
            consumptionCell = `⚡-${formatNumber(l.energyConsumption)}/h`;
        }
        
        const costCell = `⚙️${formatNumber(l.cost.metal)}<br>💎${formatNumber(l.cost.crystal)}${l.cost.deuterium > 0 ? `<br>🛢️${formatNumber(l.cost.deuterium)}` : ''}`;
        
        return [
            `${l.level}${isCurrent ? ' ⭐' : ''}`,
            costCell,
            formatCountdown(l.buildTime),
            dataCell,
            consumptionCell
        ];
    });

    // Prepare effects string
    let effects = '';
    if (buildingKey === 'roboticsFactory' && currentLevel > 0) {
        const roboticsDef = BUILDINGS.roboticsFactory;
        const speedMultiplier = roboticsDef.speedMultiplier || 0.85;
        const speedMult = (1 / Math.pow(speedMultiplier, currentLevel)).toFixed(2);
        effects = `
            <div class="building-effects">
                <strong>⚙️ Current Effect:</strong>
                <div>Construction speed multiplier: ${speedMult}x (1 / ${speedMultiplier}^${currentLevel})</div>
            </div>
        `;
    } else if (buildingKey === 'naniteFactory' && currentLevel > 0) {
        const speedMult = Math.pow(2, currentLevel).toFixed(0);
        effects = `
            <div class="building-effects">
                <strong>⚡ Current Effect:</strong>
                <div>Nanite construction speed multiplier: ${speedMult}x (2^${currentLevel})</div>
            </div>
        `;
    } else if (buildingKey === 'researchLab' && currentLevel > 0) {
        const labDef = BUILDINGS.researchLab;
        const speedMultiplier = labDef.speedMultiplier || 0.85;
        const speedMult = (1 / Math.pow(speedMultiplier, currentLevel)).toFixed(2);
        effects = `
            <div class="building-effects">
                <strong>🔬 Current Effect:</strong>
                <div>Research speed multiplier: ${speedMult}x (1 / ${speedMultiplier}^${currentLevel})</div>
            </div>
        `;
    } else if (buildingKey === 'shipyard' && currentLevel > 0) {
        const shipyardDef = BUILDINGS.shipyard;
        const speedMultiplier = shipyardDef.speedMultiplier || 0.85;
        const speedMult = (1 / Math.pow(speedMultiplier, currentLevel)).toFixed(2);
        effects = `
            <div class="building-effects">
                <strong>🚀 Current Effect:</strong>
                <div>Ship production speed multiplier: ${speedMult}x (1 / ${speedMultiplier}^${currentLevel})</div>
            </div>
        `;
    }

    renderDetailsModal({
        title: `${building.icon} ${building.name} (Current: Level ${currentLevel})`,
        description: building.description,
        detailedDescription: building.detailedDescription,
        effects: effects,
        table: {
            headers: headers,
            rows: rows,
            allowHtml: true,
            highlightRowIndex: rows.findIndex((r, i) => levels[i].level === currentLevel)
        }
    });
}

/**
 * Close modal
 */
export function closeModal() {
    closeDetailsModal();
}
