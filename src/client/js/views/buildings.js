// Buildings view logic
import { API } from '../api.js';
import { formatNumber, formatCountdown } from '../utils.js';
import { renderDetailsModal, closeDetailsModal } from './details.js';
import { showConfirm } from './modals.js';
import { RESOURCE_ICONS, SCALING, BUILDING_SPEED_MULTIPLIER } from '../../../shared/constants.js';
import { isEmpty } from '../../../shared/utils.js';
import { calculateAllocationEffectiveness, calculateBuildTime } from '../../../shared/formulas.js';
import { calculateBaseTime } from '../../../shared/time.js';
import { getCurrentPlanetId } from '../main.js';

let currentGameState = null;
let lastBuildingStateHash = null;
let lastQueueStateHash = null;

/**
 * Calculate a hash of the building state to detect changes
 */
function calculateBuildingStateHash(buildings, planet) {
    const state = {
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
export async function updateBuildingsView(planet, onStateChange) {
    const buildingsGrid = document.getElementById('buildings-grid');
    
    // Fetch building details from server (all calculations done server-side)
    let buildingDetails;
    try {
        buildingDetails = await API.getBuildingDetails(planet.id);
    } catch (error) {
        console.error('Failed to load building details:', error);
        buildingsGrid.innerHTML = '<p class="error">Failed to load building information</p>';
        return;
    }
    
    const { buildings, queue, maxQueueSize } = buildingDetails;
    
    // Check if structural building state has changed (levels or allocations)
    const buildingsSummary = {};
    for (const key in buildings) {
        buildingsSummary[key] = { 
            currentLevel: buildings[key].currentLevel,
            requirementsMet: buildings[key].requirementsMet,
            hasCustomVariant: buildings[key].hasCustomVariant,
            currentVariant: buildings[key].currentVariant
        };
    }

    const structuralState = {
        buildings: buildingsSummary,
        buildingAllocations: planet.buildingAllocations,
        actualAllocations: planet.actualAllocations
    };
    
    const currentStructuralHash = JSON.stringify(structuralState);
    
    if (currentStructuralHash !== lastBuildingStateHash) {
        // Structural change (level up, allocation change, variant change)
        // Full re-render of building cards
        renderBuildingCards(buildings, planet, queue, maxQueueSize);
        lastBuildingStateHash = currentStructuralHash;
    } else {
        // No structural change, just update costs, affordance, and timers
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
    const queueFull = queue.length >= maxQueueSize;
    const buildingHtmls = [];

    for (const key in buildings) {
        const building = buildings[key];
        const queueCount = queue.filter(item => item.building === key).length;
        
        // Show custom variant info if available
        let customVariantBadge = '';
        let variantButtons = '';
        if (building.hasCustomVariant && building.customVariant) {
            const isCustomActive = building.currentVariant === 'custom';
            customVariantBadge = `<div class="custom-variant-badge">🔧 ${isCustomActive ? 'Custom Active' : 'Custom Available'}</div>`;
            
            variantButtons = `
                <div id="variant-actions-${key}" class="variant-actions-container">
                    <!-- Populated by updateBuildingCostsAndAffordance -->
                </div>
            `;
        }

        // Allocation badge
        let allocationBadge = '';
        const allocatableBuildings = ['metalMine', 'crystalMine', 'deuteriumSynthesizer', 'waterExtractor', 'farm'];
        const hasAllocation = allocatableBuildings.includes(key) && building.currentLevel > 0;
        
        if (hasAllocation) {
            allocationBadge = `<div id="allocation-badge-${key}" class="allocation-badge-container"></div>`;
        }

        buildingHtmls.push(`
            <div class="building-card ${queueCount > 0 ? 'in-queue' : ''}" id="building-card-${key}">
                <div class="building-header">
                    <h3>${building.icon} ${building.name}</h3>
                    <button class="btn-info" onclick="window.showBuildingDetails('${key}')" title="View detailed stats">ℹ️</button>
                </div>
                <div class="building-level">Level ${building.currentLevel}</div>
                ${customVariantBadge}
                ${allocationBadge}
                <div id="queue-badge-${key}"></div>
                <p>${building.description}</p>
                <div class="building-cost" id="cost-display-${key}">
                    <!-- Dynamic cost info -->
                </div>
                <div class="building-stats">
                    <div class="build-time" id="time-display-${key}">🕐 Build time: --</div>
                    <div id="stats-info-${key}"></div>
                    <div id="energy-info-${key}"></div>
                </div>
                <button class="btn btn-full upgrade-btn" id="upgrade-btn-${key}" onclick="window.upgradeBuilding('${key}')">
                    Upgrade
                </button>
                ${variantButtons}
            </div>
        `);
    }
    
    buildingsGrid.innerHTML = buildingHtmls.join('');
    
    // Initial update of dynamic elements
    updateBuildingCostsAndAffordance(buildings, planet, queue, maxQueueSize);
}

/**
 * Update costs, affordance, and stats without re-rendering the whole card
 */
function updateBuildingCostsAndAffordance(buildings, planet, queue, maxQueueSize) {
    const queueFull = queue.length >= maxQueueSize;

    for (const key in buildings) {
        const building = buildings[key];
        const queueCount = queue.filter(item => item.building === key).length;
        
        // Update cost display
        const costEl = document.getElementById(`cost-display-${key}`);
        if (costEl) {
            costEl.innerHTML = `
                <strong>Cost for level ${building.nextLevel}:</strong>
                <div class="${planet.resources.metal < building.cost.metal ? 'text-error' : ''}">⚙️ Metal: ${formatNumber(building.cost.metal)}</div>
                <div class="${planet.resources.crystal < building.cost.crystal ? 'text-error' : ''}">💎 Crystal: ${formatNumber(building.cost.crystal)}</div>
                ${building.cost.deuterium > 0 ? `<div class="${planet.resources.deuterium < building.cost.deuterium ? 'text-error' : ''}">🛢️ Deuterium: ${formatNumber(building.cost.deuterium)}</div>` : ''}
            `;
        }

        // Update build time
        const timeEl = document.getElementById(`time-display-${key}`);
        if (timeEl) {
            timeEl.textContent = `🕐 Build time: ${formatCountdown(building.buildTime)}`;
        }

        // Update button status
        const btn = document.getElementById(`upgrade-btn-${key}`);
        if (btn) {
            let buttonTooltip = 'Upgrade to next level';
            let buttonDisabled = !building.canAfford || queueFull || !building.requirementsMet;
            
            if (queueFull) {
                buttonTooltip = 'Build queue is full';
                btn.textContent = 'Queue Full';
            } else if (!building.requirementsMet) {
                const reqs = building.requirementsList?.map(r => `${r.name} Lvl ${r.level}`).join(', ') || '';
                buttonTooltip = `Requirements not met: ${reqs}`;
                btn.textContent = 'Requirements Not Met';
            } else if (!building.canAfford) {
                buttonTooltip = 'Insufficient resources';
                btn.textContent = `Upgrade to Level ${building.nextLevel}`;
            } else {
                btn.textContent = `Upgrade to Level ${building.nextLevel}`;
            }
            
            btn.className = `btn btn-full upgrade-btn ${building.canAfford && building.requirementsMet && !queueFull ? 'btn-success' : ''}`;
            btn.disabled = buttonDisabled;
            btn.title = buttonTooltip;
        }

        // Update queue badge
        const qBadge = document.getElementById(`queue-badge-${key}`);
        if (qBadge) {
            qBadge.innerHTML = queueCount > 0 ? `<div class="queue-count-badge">📋 In queue: ${queueCount}</div>` : '';
        }

        // Update stats and energy
        const statsEl = document.getElementById(`stats-info-${key}`);
        const energyEl = document.getElementById(`energy-info-${key}`);
        
        if (statsEl) {
            let statsHtml = '';
            if (building.storage && !isEmpty(building.storage)) {
                statsHtml = '<div class="building-storage">';
                for (const resource in building.storage) {
                    const nextAmount = building.storage[resource];
                    let currentAmount = 0;
                    if (building.currentLevel > 0) {
                        const baseAmount = nextAmount / Math.pow(SCALING.BUILDING_STORAGE, building.nextLevel - 1);
                        currentAmount = Math.floor(baseAmount * Math.pow(SCALING.BUILDING_STORAGE, building.currentLevel - 1));
                    }
                    const diff = nextAmount - currentAmount;
                    statsHtml += `<div>${RESOURCE_ICONS[resource] || '❓'} +${formatNumber(diff)}</div>`;
                }
                statsHtml += '</div>';
            } else if (building.production && !isEmpty(building.production)) {
                statsHtml = '<div class="building-production">';
                
                // Show current actual production
                if (building.currentLevel > 0 && !isEmpty(building.actualProduction)) {
                    statsHtml += `<div class="actual-value" title="Current actual production based on workers and power">Actual: `;
                    for (const res in building.actualProduction) {
                        statsHtml += `${RESOURCE_ICONS[res] || ''} ${formatNumber(building.actualProduction[res])}/h `;
                    }
                    statsHtml += `<span class="eff-label">(${(building.totalEffectiveness * 100).toFixed(0)}%)</span></div>`;
                }

                // Show expected gain for next level (based on current effectiveness)
                if (!isEmpty(building.productionGains)) {
                    statsHtml += `<div class="expected-gain" title="Expected gain if you upgrade, keeping current allocations">Gain: `;
                    for (const res in building.productionGains) {
                        const gain = building.productionGains[res];
                        statsHtml += `<span class="gain-value">${RESOURCE_ICONS[res] || ''} +${formatNumber(gain)}/h</span> `;
                    }
                    statsHtml += `</div>`;
                }
                statsHtml += '</div>';
            } else if (key === 'roboticsFactory' && building.currentLevel > 0) {
                const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, building.currentLevel)).toFixed(2);
                statsHtml = `<div class="building-special">⏱️ Construction: ${speedMult}x speed</div>`;
            } else if (key === 'naniteFactory' && building.currentLevel > 0) {
                const speedMult = Math.pow(2, building.currentLevel).toFixed(0);
                statsHtml = `<div class="building-special">⚡ Construction: ${speedMult}x speed</div>`;
            } else if (key === 'researchLab' && building.currentLevel > 0) {
                const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, building.currentLevel)).toFixed(2);
                statsHtml = `<div class="building-special">🔬 Research: ${speedMult}x speed</div>`;
            } else if (key === 'shipyard' && building.currentLevel > 0) {
                const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, building.currentLevel)).toFixed(2);
                statsHtml = `<div class="building-special">🚀 Production: ${speedMult}x speed</div>`;
            }
            statsEl.innerHTML = statsHtml;
        }

        if (energyEl) {
            let energyHtml = '';
            if (key === 'fusionReactor') {
                if (building.currentLevel > 0) {
                    energyHtml += `<div class="building-energy actual-value">🛢️ Actual: -${formatNumber(building.actualDeuteriumConsumption)}/h</div>`;
                }
                if (building.deuteriumGain > 0) {
                    energyHtml += `<div class="building-energy expected-gain">🛢️ Cost: +${formatNumber(building.deuteriumGain)}/h</div>`;
                }
            } else if (building.energyConsumption > 0) {
                if (building.currentLevel > 0) {
                    energyHtml += `<div class="building-energy actual-value">⚡ Actual: -${formatNumber(building.actualEnergyConsumption)}/h</div>`;
                }
                if (building.energyGain > 0) {
                    energyHtml += `<div class="building-energy expected-gain">⚡ Cost: +${formatNumber(building.energyGain)}/h</div>`;
                }
            }
            energyEl.innerHTML = energyHtml;
        }

        // Update allocation badges
        const allocContainer = document.getElementById(`allocation-badge-${key}`);
        if (allocContainer) {
            const allocation = planet.buildingAllocations?.[key];
            const actualAllocation = planet.actualAllocations?.[key];
            
            if (allocation) {
                const powerEff = calculateAllocationEffectiveness(allocation.power * 100) / 100;
                const popEff = calculateAllocationEffectiveness(allocation.population * 100) / 100;
                const totalEff = powerEff * popEff;
                const effPercent = (totalEff * 100).toFixed(0);
                const effClass = totalEff >= 0.9 ? 'good' : totalEff >= 0.6 ? 'medium' : 'low';
                
                let html = `<div class="allocation-badge ${effClass}" title="Desired: Power ${(allocation.power * 100).toFixed(0)}%, Workers ${(allocation.population * 100).toFixed(0)}%">⚙️ Desired: ${effPercent}%</div>`;
                
                if (actualAllocation) {
                    const actualTotalEff = (calculateAllocationEffectiveness(actualAllocation.power * 100) / 100) * (calculateAllocationEffectiveness(actualAllocation.population * 100) / 100);
                    const actualEffClass = actualTotalEff >= 0.9 ? 'good' : actualTotalEff >= 0.6 ? 'medium' : 'low';
                    html += `<div class="allocation-badge ${actualEffClass}" style="margin-top: 5px;">⚙️ Actual: ${(actualTotalEff * 100).toFixed(0)}%</div>`;
                }
                allocContainer.innerHTML = html;
            }
        }

        // Update variant switch buttons
        const variantActions = document.getElementById(`variant-actions-${key}`);
        if (variantActions && building.hasCustomVariant && building.customVariant) {
            const isCustomActive = building.currentVariant === 'custom';
            // Logic for switchCost (simplified)
            const switchCost = calculateSwitchCostEstimate(building, isCustomActive);
            
            let canSwitchAfford = planet.resources.metal >= switchCost.metal &&
                                 planet.resources.crystal >= switchCost.crystal &&
                                 planet.resources.deuterium >= switchCost.deuterium;
            
            variantActions.innerHTML = `
                <div class="building-cost" style="margin-top: 8px;">
                    <strong>Switch cost:</strong>
                    <div class="${planet.resources.metal < switchCost.metal ? 'text-error' : ''}">⚙️ ${formatNumber(switchCost.metal)}</div>
                    <div class="${planet.resources.crystal < switchCost.crystal ? 'text-error' : ''}">💎 ${formatNumber(switchCost.crystal)}</div>
                </div>
                <button class="btn btn-full" ${!canSwitchAfford ? 'disabled' : ''} 
                        onclick="window.switchBuildingVariant('${key}', ${!isCustomActive})">
                    ${isCustomActive ? '↩️ Switch to Base' : '🔧 Switch to Custom'}
                </button>
            `;
        }
    }
}

/** Helper for variant switch cost estimate */
function calculateSwitchCostEstimate(building, isCustomActive) {
    let baseCost = building.cost;
    // Apply cost modifier to get custom cost
    let customCost = { ...baseCost };
    if (building.customVariant?.modifiers && building.customVariant.modifiers.costMultiplier !== 1) {
        customCost = {
            metal: Math.floor(baseCost.metal * building.customVariant.modifiers.costMultiplier),
            crystal: Math.floor(baseCost.crystal * building.customVariant.modifiers.costMultiplier),
            deuterium: Math.floor(baseCost.deuterium * building.customVariant.modifiers.costMultiplier)
        };
    }
    
    let switchCost = { metal: 0, crystal: 0, deuterium: 0 };
    
    if (isCustomActive) {
        // Currently custom, switching to base
        const difference = {
            metal: Math.abs(baseCost.metal - customCost.metal),
            crystal: Math.abs(baseCost.crystal - customCost.crystal),
            deuterium: Math.abs(baseCost.deuterium - customCost.deuterium)
        };
        const isCheaper = baseCost.metal + baseCost.crystal + baseCost.deuterium < 
                         customCost.metal + customCost.crystal + customCost.deuterium;
        
        if (isCheaper) {
            switchCost = {
                metal: -Math.floor(difference.metal / 2),
                crystal: -Math.floor(difference.crystal / 2),
                deuterium: -Math.floor(difference.deuterium / 2)
            };
        } else {
            switchCost = {
                metal: difference.metal * 2,
                crystal: difference.crystal * 2,
                deuterium: difference.deuterium * 2
            };
        }
    } else {
        // Currently base, switching to custom
        const difference = {
            metal: Math.abs(customCost.metal - baseCost.metal),
            crystal: Math.abs(customCost.crystal - baseCost.crystal),
            deuterium: Math.abs(customCost.deuterium - baseCost.deuterium)
        };
        const isCheaper = customCost.metal + customCost.crystal + customCost.deuterium < 
                         baseCost.metal + baseCost.crystal + baseCost.deuterium;
        
        if (isCheaper) {
            switchCost = {
                metal: -Math.floor(difference.metal / 2),
                crystal: -Math.floor(difference.crystal / 2),
                deuterium: -Math.floor(difference.deuterium / 2)
            };
        } else {
            switchCost = {
                metal: difference.metal * 2,
                crystal: difference.crystal * 2,
                deuterium: difference.deuterium * 2
            };
        }
    }
    return switchCost;
}

let queueVisible = true;

/**
 * Toggle queue visibility
 */
window.toggleQueueVisibility = function() {
    queueVisible = !queueVisible;
    const items = document.querySelector('.build-queue-summary .queue-items');
    const toggle = document.querySelector('.build-queue-summary .queue-header span');
    
    if (items) {
        items.style.display = queueVisible ? 'flex' : 'none';
        if (queueVisible) items.style.marginTop = '4px';
    }
    if (toggle) {
        toggle.textContent = queueVisible ? '🔼' : '🔽';
    }
};

/**
 * Update the queue view independently
 */
function updateQueueView(queue, maxQueueSize, buildings) {
    const queueContainer = document.getElementById('buildings-queue-container');
    
    if (queue.length > 0) {
        const queueSummary = `
            <div class="build-queue-summary">
                <div class="queue-header" onclick="window.toggleQueueVisibility()">
                    <h3 style="margin: 0; font-size: 0.9rem; color: var(--accent-yellow);">🔨 Queue (${queue.length}/${maxQueueSize})</h3>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${queueVisible ? '🔼' : '🔽'}</span>
                </div>
                <div class="queue-items" style="${queueVisible ? 'display: flex; margin-top: 4px;' : 'display: none;'}">
                    ${queue.map((item, index) => {
                        const isActive = index === 0;
                        const elapsed = Date.now() - item.startTime;
                        const total = item.finishTime - item.startTime;
                        const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                        
                        return `
                            <div class="queue-item ${isActive ? 'active' : ''}">
                                <div class="queue-item-row">
                                    <span class="q-pos">${item.queuePosition}.</span>
                                    <span class="q-name" title="${buildings[item.building]?.name || item.building}">${buildings[item.building]?.icon || ''} ${buildings[item.building]?.name || item.building}</span>
                                    <span class="q-level">Lvl ${item.level}</span>
                                    <div class="progress-bar-mini">
                                        <div class="progress-fill" id="build-progress-${item.queuePosition}" style="width: ${isActive ? percent : 0}%"></div>
                                    </div>
                                    <span class="q-time-mini timer" data-finish="${item.finishTime}" data-start="${item.startTime}" data-queue-pos="${item.queuePosition}"></span>
                                    <button class="btn-cancel-small" onclick="window.cancelBuilding(${item.queuePosition})" title="Cancel">✕</button>
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
    document.querySelectorAll('.timer').forEach(timer => {
        const finishTime = parseInt(timer.dataset.finish);
        const startTime = parseInt(timer.dataset.start);
        const queuePos = timer.dataset.queuePos;
        const now = Date.now();
        const remaining = Math.max(0, finishTime - now);
        
        timer.textContent = formatCountdown(remaining / 1000);
        
        // Update progress bar if it exists
        if (queuePos) {
            const progressBar = document.getElementById(`build-progress-${queuePos}`);
            if (progressBar && startTime && finishTime) {
                const total = finishTime - startTime;
                const elapsed = now - startTime;
                const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                progressBar.style.width = `${percent}%`;
            }
        }
        
        if (remaining === 0) {
            timer.textContent = 'Complete!';
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
        alert('Error: ' + error.message);
    }
}

/**
 * Switch building variant (exposed globally)
 */
export async function switchBuildingVariant(buildingKey, toCustom, onStateChange) {
    const planetId = getCurrentPlanetId();
    if (!planetId) return;
    
    if (!toCustom) {
        // Switching to base - direct switch, no selection needed
        try {
            await API.switchBuildingVariant(planetId, buildingKey, false);
            if (onStateChange) await onStateChange();
        } catch (error) {
            alert('Error: ' + error.message);
        }
        return;
    }
    
    // Switching to custom - show selection modal
    let buildingDetails;
    try {
        buildingDetails = await API.getBuildingDetails(planetId);
    } catch (error) {
        console.error('Failed to load building details:', error);
        alert('Failed to load building details');
        return;
    }
    
    const building = buildingDetails.buildings[buildingKey];
    if (!building || !building.customVariant) {
        alert('No custom variant available');
        return;
    }
    
    const planet = currentGameState?.planets.find(p => p.id === planetId);
    showCustomVariantSelectionModal(buildingKey, building, planet, onStateChange);
}

/**
 * Show modal for selecting custom variant details
 */
export async function showCustomVariantSelectionModal(buildingKey, building, planet, onStateChange) {
    const modal = document.getElementById('custom-variant-modal') || createCustomVariantModal();
    modal.style.display = 'block';
    
    const modalTitle = document.getElementById('modal-variant-title');
    const modalBody = document.getElementById('modal-variant-body');
    
    modalTitle.innerHTML = `Select ${building.name} Customization`;
    
    // Get available custom variants for this building
    try {
        const variantDetails = await API.getCustomVariantDetails(planet.id, buildingKey);
        renderCustomVariantOptions(modalBody, buildingKey, building, variantDetails, planet, onStateChange);
    } catch (error) {
        console.error('Failed to load variant details:', error);
        modalBody.innerHTML = `<p class="error">Failed to load customization options: ${error.message}</p>`;
    }
}

/**
 * Create custom variant selection modal if it doesn't exist
 */
function createCustomVariantModal() {
    const modal = document.createElement('div');
    modal.id = 'custom-variant-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modal-variant-title">Select Customization</h2>
                <button onclick="window.closeCustomVariantModal()" class="modal-close">&times;</button>
            </div>
            <div id="modal-variant-body"></div>
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

/**
 * Render custom variant selection options
 */
function renderCustomVariantOptions(container, buildingKey, building, variantDetails, planet, onStateChange) {
    const { availableVariants, baseCost, currentCost, currentVariant, currentVariantData } = variantDetails;
    
    // Determine current variant title
    const currentVariantTitle = currentVariant === 'custom' ? 'Custom Variant (Current)' : 'Base Variant (Current)';
    
    let html = `
        <div class="variant-selection">
            <div class="current-variant-info">
                <h3>${currentVariantTitle}</h3>
                <div class="cost-display">
                    <strong>Cost per level:</strong>
                    <div>⚙️ ${formatNumber(currentCost.metal)}</div>
                    <div>💎 ${formatNumber(currentCost.crystal)}</div>
                    ${currentCost.deuterium > 0 ? `<div>🛢️ ${formatNumber(currentCost.deuterium)}</div>` : ''}
                </div>
    `;
    
    // Show focus levels if on custom variant
    if (currentVariant === 'custom' && currentVariantData) {
        const focuses = [];
        for (const focus in (currentVariantData.focusLevels || {})) {
            const level = currentVariantData.focusLevels[focus];
            if (level > 0) {
                focuses.push(`<span class="focus-badge">${focus} <strong>${level}</strong></span>`);
            }
        }
        const focusDisplay = focuses.join('');
        if (focusDisplay) {
            html += `<div class="variant-focuses" style="margin-top: 10px;">${focusDisplay}</div>`;
        }
    }
    
    html += `
            </div>
            <div class="variant-options">
                <h3>Switch To</h3>
    `;
    
    if (!availableVariants || availableVariants.length === 0) {
        html += `<p>No variants to switch to. </p>`;
    } else {
        for (const variant of availableVariants) {
            const isBaseVariant = variant.isBase;
            const switchCost = calculateSwitchCost(currentCost, variant.cost);
            
            const focuses = [];
            for (const focus in (variant.focusLevels || {})) {
                const level = variant.focusLevels[focus];
                if (level > 0) {
                    focuses.push(`<span class="focus-badge">${focus} <strong>${level}</strong></span>`);
                }
            }
            const focusDisplay = focuses.join('');
            
            const isCheaper = (variant.cost.metal + variant.cost.crystal + variant.cost.deuterium) < 
                            (currentCost.metal + currentCost.crystal + currentCost.deuterium);
            
            const switchCostDisplay = `
                <div class="switch-cost ${isCheaper ? 'refund' : 'cost'}">
                    ${isCheaper ? '💰 Refund:' : '💰 Cost:'}
                    <div>⚙️ ${formatNumber(switchCost.metal)}</div>
                    <div>💎 ${formatNumber(switchCost.crystal)}</div>
                    ${switchCost.deuterium !== 0 ? `<div>🛢️ ${formatNumber(switchCost.deuterium)}</div>` : ''}
                </div>
            `;
            
            const outputDiffs = getOutputDifferences(building, variant);
            let outputDisplay = '';
            if (outputDiffs.length > 0) {
                outputDisplay = `
                    <div class="output-changes">
                        <strong>Output Changes:</strong>
                        ${outputDiffs.map(diff => {
                            const multiplier = diff.change.toFixed(2);
                            const percentChange = ((diff.change - 1) * 100).toFixed(1);
                            const isPositive = diff.change > 1;
                            return `<div class="${isPositive ? 'positive' : 'negative'}">
                                ${diff.icon} ${diff.label}: ${multiplier}x (${isPositive ? '+' : ''}${percentChange}%)
                            </div>`;
                        }).join('')}
                    </div>
                `;
            }
            
            const buttonText = isBaseVariant ? 'Switch to Base' : 'Select This Variant';
            const focusLevels = isBaseVariant ? {} : variant.focusLevels;
            
            html += `
                <div class="variant-option">
                    ${focusDisplay ? `<div class="variant-focuses">${focusDisplay}</div>` : '<p><em>Standard Build</em></p>'}
                    ${switchCostDisplay}
                    ${outputDisplay}
                    <button class="btn btn-success btn-full" 
                            onclick="window.selectCustomVariant('${buildingKey}', ${JSON.stringify(focusLevels).replace(/"/g, '&quot;')})">
                        ${buttonText}
                    </button>
                </div>
            `;
        }
    }
    
    html += `
            </div>
            <div class="variant-actions">
                <button class="btn btn-full" onclick="window.closeCustomVariantModal()">Cancel</button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

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
    
    if (!variant.modifiers) {
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
            alert('Error: ' + error.message);
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
    
    // For the table, we still need to calculate future levels
    // This could be optimized by having the server provide this data too
    const levels = [];
    
    // Estimate base costs from current level costs
    const baseCostEstimate = {
        metal: Math.round(building.cost.metal / Math.pow(SCALING.BUILDING_COST, building.nextLevel)),
        crystal: Math.round(building.cost.crystal / Math.pow(SCALING.BUILDING_COST, building.nextLevel)),
        deuterium: Math.round(building.cost.deuterium / Math.pow(SCALING.BUILDING_COST, building.nextLevel))
    };

    const roboticsLevel = planet?.buildings.roboticsFactory || 0;
    const naniteLevel = planet?.buildings.naniteFactory || 0;
    const configMultiplier = window.GAME_CONFIG?.gameSpeed?.buildTime || 1.0;
    
    // Estimate base building time from current next level build time
    // This ensures consistency with the server's current build time for the next level
    const serverBuildTimeForNextLevel = building.buildTime;
    const baseTimeFromCostEstimate = (serverBuildTimeForNextLevel / configMultiplier / Math.pow(BUILDING_SPEED_MULTIPLIER, roboticsLevel) * Math.pow(2, naniteLevel)) / Math.pow(SCALING.BUILDING_TIME, building.nextLevel - 1);
    
    // Estimate base production amounts
    const baseProductionEstimate = {};
    const productionMultiplier = 10.0;
    if (building.production && !isEmpty(building.production)) {
        for (const resource in building.production) {
            baseProductionEstimate[resource] = building.production[resource] / (building.nextLevel * Math.pow(SCALING.BUILDING_PRODUCTION, building.nextLevel) * productionMultiplier);
        }
    }

    // Estimate base storage amounts
    const baseStorageEstimate = {};
    if (building.storage && !isEmpty(building.storage)) {
        for (const resource in building.storage) {
            baseStorageEstimate[resource] = building.storage[resource] / Math.pow(SCALING.BUILDING_STORAGE, building.nextLevel - 1);
        }
    }

    // Estimate base consumption amounts
    let baseEnergyEstimate = 0;
    const energyMultiplier = 10.0;
    if (building.energyConsumption > 0) {
        baseEnergyEstimate = building.energyConsumption / (building.nextLevel * Math.pow(SCALING.BUILDING_ENERGY, building.nextLevel) * energyMultiplier);
    }

    let baseDeuteriumConsEstimate = 0;
    const deuteriumConsMultiplier = 10.0;
    if (building.deuteriumConsumption > 0) {
        baseDeuteriumConsEstimate = building.deuteriumConsumption / (building.nextLevel * Math.pow(SCALING.BUILDING_PRODUCTION, building.nextLevel) * deuteriumConsMultiplier);
    }
    
    for (let level = 1; level <= Math.min(currentLevel + 10, 30); level++) {
        const multiplier = Math.pow(SCALING.BUILDING_COST, level);
        const cost = {
            metal: Math.floor(baseCostEstimate.metal * multiplier),
            crystal: Math.floor(baseCostEstimate.crystal * multiplier),
            deuterium: Math.floor(baseCostEstimate.deuterium * multiplier)
        };
        
        // Use shared formula for build time, but pass our estimated baseTime indirectly
        const baseTimeForLevel = baseTimeFromCostEstimate * Math.pow(SCALING.BUILDING_TIME, level - 1);
        const buildTime = Math.max(1, Math.floor((baseTimeForLevel * Math.pow(BUILDING_SPEED_MULTIPLIER, roboticsLevel) / Math.pow(2, naniteLevel)) * configMultiplier));
        
        let production = null;
        if (!isEmpty(baseProductionEstimate)) {
            production = {};
            for (const resource in baseProductionEstimate) {
                production[resource] = Math.floor(baseProductionEstimate[resource] * level * Math.pow(SCALING.BUILDING_PRODUCTION, level) * productionMultiplier);
            }
        }
        
        let storage = null;
        if (!isEmpty(baseStorageEstimate)) {
            storage = {};
            for (const resource in baseStorageEstimate) {
                storage[resource] = Math.floor(baseStorageEstimate[resource] * Math.pow(SCALING.BUILDING_STORAGE, level - 1));
            }
        }
        
        let energyConsumption = 0;
        if (baseEnergyEstimate > 0) {
            energyConsumption = Math.floor(baseEnergyEstimate * level * Math.pow(SCALING.BUILDING_ENERGY, level) * energyMultiplier);
        }

        let deuteriumConsumption = 0;
        if (baseDeuteriumConsEstimate > 0) {
            deuteriumConsumption = Math.floor(baseDeuteriumConsEstimate * level * Math.pow(SCALING.BUILDING_PRODUCTION, level) * deuteriumConsMultiplier);
        }
        
        levels.push({ level, cost, buildTime, production, storage, energyConsumption, deuteriumConsumption });
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
            const speedMult = 1 / Math.pow(BUILDING_SPEED_MULTIPLIER, l.level);
            dataCell = `<div>⏱️ ${speedMult.toFixed(2)}x speed<br><span style="font-size: 0.9em;">(1 / ${BUILDING_SPEED_MULTIPLIER}^${l.level})</span></div>`;
        } else if (buildingKey === 'naniteFactory') {
            // Nanite factory - show massive construction speed
            const speedMult = Math.pow(2, l.level);
            dataCell = `<div>⚡ ${speedMult.toFixed(0)}x speed<br><span style="font-size: 0.9em;">(2^${l.level})</span></div>`;
        } else if (buildingKey === 'researchLab') {
            // Research lab - show research speed multiplier (multiplicative BUILDING_SPEED_MULTIPLIER^level on time)
            const speedMult = 1 / Math.pow(BUILDING_SPEED_MULTIPLIER, l.level);
            dataCell = `<div>🔬 ${speedMult.toFixed(2)}x speed<br><span style="font-size: 0.9em;">(1 / ${BUILDING_SPEED_MULTIPLIER}^${l.level})</span></div>`;
        } else if (buildingKey === 'shipyard') {
            // Shipyard - show production multiplier (multiplicative BUILDING_SPEED_MULTIPLIER^level on time)
            const speedMult = 1 / Math.pow(BUILDING_SPEED_MULTIPLIER, l.level);
            dataCell = `<div>🚀 ${speedMult.toFixed(2)}x speed<br><span style="font-size: 0.9em;">(1 / ${BUILDING_SPEED_MULTIPLIER}^${l.level})</span></div>`;
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
        const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, currentLevel)).toFixed(2);
        effects = `
            <div class="building-effects">
                <strong>⚙️ Current Effect:</strong>
                <div>Construction speed multiplier: ${speedMult}x (1 / ${BUILDING_SPEED_MULTIPLIER}^${currentLevel})</div>
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
        const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, currentLevel)).toFixed(2);
        effects = `
            <div class="building-effects">
                <strong>🔬 Current Effect:</strong>
                <div>Research speed multiplier: ${speedMult}x (1 / ${BUILDING_SPEED_MULTIPLIER}^${currentLevel})</div>
            </div>
        `;
    } else if (buildingKey === 'shipyard' && currentLevel > 0) {
        const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, currentLevel)).toFixed(2);
        effects = `
            <div class="building-effects">
                <strong>🚀 Current Effect:</strong>
                <div>Ship production speed multiplier: ${speedMult}x (1 / ${BUILDING_SPEED_MULTIPLIER}^${currentLevel})</div>
            </div>
        `;
    }

    renderDetailsModal({
        title: `${building.icon} ${building.name} <span class="current-level">(Current: Level ${currentLevel})</span>`,
        description: building.description,
        detailedDescription: building.detailedDescription,
        effects: effects,
        table: {
            headers: headers,
            rows: rows,
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
