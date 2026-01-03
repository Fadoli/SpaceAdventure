// Buildings view logic
import { API } from '../api.js';
import { formatNumber, formatCountdown } from '../utils.js';
import { RESOURCE_ICONS, SCALING, BUILDING_SPEED_MULTIPLIER } from '../../../shared/constants.js';
import { isEmpty } from '../../../shared/utils.js';
import { calculateAllocationEffectiveness, calculateBuildTime } from '../../../shared/formulas.js';
import { calculateBaseTime } from '../../../shared/time.js';

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
    
    // Check if building state has changed
    const currentBuildingHash = calculateBuildingStateHash(buildings, planet);
    if (currentBuildingHash === lastBuildingStateHash) {
        // Building state hasn't changed, but check if queue changed
        const currentQueueHash = calculateQueueStateHash(queue);
        if (currentQueueHash === lastQueueStateHash) {
            // Both states unchanged, skip re-render entirely
            return;
        }
        // Queue changed but buildings didn't, only re-render queue
        updateQueueView(queue, maxQueueSize, buildings);
        lastQueueStateHash = currentQueueHash;
        return;
    }
    lastBuildingStateHash = currentBuildingHash;
    
    const queueFull = queue.length >= maxQueueSize;
    
    const buildingHtmls = [];
    for (const key in buildings) {
        const building = buildings[key];
            // All data now comes from server including icon and description
            
            // Determine what stats to show based on building type
            let statsInfo = '';
            
            if (building.storage && !isEmpty(building.storage)) {
                // Storage building - show storage capacity increase
                statsInfo = '<div class="building-storage">';
                for (const resource in building.storage) {
                    const nextAmount = building.storage[resource];
                    // Calculate current level storage
                    let currentAmount = 0;
                    if (building.currentLevel > 0) {
                        const baseAmount = nextAmount / Math.pow(SCALING.BUILDING_STORAGE, building.nextLevel - 1);
                        currentAmount = Math.floor(baseAmount * Math.pow(SCALING.BUILDING_STORAGE, building.currentLevel - 1));
                    }
                    const diff = nextAmount - currentAmount;
                    const icon = RESOURCE_ICONS[resource] || '❓';
                    statsInfo += `<div>${icon} +${formatNumber(diff)}</div>`;
                }
                statsInfo += '</div>';
            } else if (building.production && !isEmpty(building.production)) {
                // Production building - show production increase
                const currentProd = {};
                const nextProd = building.production || {};
                
                // Estimate current level production (approximate reverse calculation)
                // The server already applies variant modifiers, so we just reverse-calculate with the 10x config multiplier
                if (building.currentLevel > 0 && !isEmpty(nextProd)) {
                    for (const resource in nextProd) {
                        const nextAmount = nextProd[resource];
                        const baseAmount = nextAmount / (building.nextLevel * Math.pow(SCALING.BUILDING_PRODUCTION, building.nextLevel) * 10.0);
                        currentProd[resource] = Math.floor(baseAmount * building.currentLevel * Math.pow(SCALING.BUILDING_PRODUCTION, building.currentLevel) * 10.0);
                    }
                }
                
                statsInfo = '<div class="building-production">';
                for (const resource in nextProd) {
                    const nextAmount = nextProd[resource];
                    const currentAmount = currentProd[resource] || 0;
                    const diff = nextAmount - currentAmount;
                    const icon = RESOURCE_ICONS[resource] || '❓';
                    statsInfo += `<div>${icon} +${formatNumber(diff)}/h</div>`;
                }
                statsInfo += '</div>';
            } else if (key === 'roboticsFactory' && building.currentLevel > 0) {
                // Robotics factory - show construction speed
                const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, building.currentLevel)).toFixed(2);
                statsInfo = `<div class="building-special">⏱️ Construction: ${speedMult}x speed</div>`;
            } else if (key === 'naniteFactory' && building.currentLevel > 0) {
                // Nanite factory - show massive construction speed improvement
                const speedMult = Math.pow(2, building.currentLevel).toFixed(0);
                statsInfo = `<div class="building-special">⚡ Construction: ${speedMult}x speed</div>`;
            } else if (key === 'researchLab' && building.currentLevel > 0) {
                // Research lab - show research speed (multiplicative BUILDING_SPEED_MULTIPLIER^level on time)
                const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, building.currentLevel)).toFixed(2);
                statsInfo = `<div class="building-special">🔬 Research: ${speedMult}x speed</div>`;
            } else if (key === 'shipyard' && building.currentLevel > 0) {
                // Shipyard - show production speed (multiplicative BUILDING_SPEED_MULTIPLIER^level on time)
                const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, building.currentLevel)).toFixed(2);
                statsInfo = `<div class="building-special">🚀 Production: ${speedMult}x speed</div>`;
            }
            
            // Calculate current level energy consumption or deuterium consumption to show difference
            let energyInfo = '';
            if (key === 'fusionReactor' && building.deuteriumConsumption > 0) {
                // For Fusion Reactor, show deuterium consumption instead
                const currentDeuterium = building.currentLevel > 0 ? 
                    Math.floor((building.deuteriumConsumption / (building.nextLevel * Math.pow(SCALING.BUILDING_PRODUCTION, building.nextLevel) * 10.0)) * building.currentLevel * Math.pow(SCALING.BUILDING_PRODUCTION, building.currentLevel) * 10.0) : 0;
                const deuteriumDiff = building.deuteriumConsumption - currentDeuterium;
                energyInfo = `<div class="building-energy">🛢️ -${formatNumber(deuteriumDiff)}/h</div>`;
            } else if (building.energyConsumption > 0) {
                const currentEnergy = building.currentLevel > 0 ? 
                    Math.floor((building.energyConsumption / (building.nextLevel * Math.pow(SCALING.BUILDING_ENERGY, building.nextLevel) * 10.0)) * building.currentLevel * Math.pow(SCALING.BUILDING_ENERGY, building.currentLevel) * 10.0) : 0;
                const energyDiff = building.energyConsumption - currentEnergy;
                energyInfo = `<div class="building-energy">⚡ -${formatNumber(energyDiff)}/h</div>`;
            }
            
            // Check if building has allocation settings (production buildings)
            const allocatableBuildings = ['metalMine', 'crystalMine', 'deuteriumSynthesizer', 'waterExtractor', 'farm'];
            const hasAllocation = allocatableBuildings.includes(key) && building.currentLevel > 0;
            const allocation = planet.buildingAllocations?.[key];
            const actualAllocation = planet.actualAllocations?.[key];
            
            let allocationBadge = '';
            if (hasAllocation && allocation) {
                // Calculate desired effectiveness using shared formula
                const powerEff = calculateAllocationEffectiveness(allocation.power * 100) / 100;
                const popEff = calculateAllocationEffectiveness(allocation.population * 100) / 100;
                const totalEff = powerEff * popEff;
                const effPercent = (totalEff * 100).toFixed(0);
                
                // Calculate ACTUAL effectiveness if available
                let actualBadge = '';
                if (actualAllocation) {
                    const actualPowerEff = calculateAllocationEffectiveness(actualAllocation.power * 100) / 100;
                    const actualPopEff = calculateAllocationEffectiveness(actualAllocation.population * 100) / 100;
                    const actualTotalEff = actualPowerEff * actualPopEff;
                    const actualEffPercent = (actualTotalEff * 100).toFixed(0);
                    const actualEffClass = actualTotalEff >= 0.9 ? 'good' : actualTotalEff >= 0.6 ? 'medium' : 'low';
                    actualBadge = `<div class="allocation-badge ${actualEffClass}" style="margin-top: 5px;" title="Actual allocation after priority-based distribution">⚙️ Actual: ${actualEffPercent}%</div>`;
                }
                
                const effClass = totalEff >= 0.9 ? 'good' : totalEff >= 0.6 ? 'medium' : 'low';
                allocationBadge = `
                    <div class="allocation-badge ${effClass}" title="Desired: Power ${(allocation.power * 100).toFixed(0)}%, Workers ${(allocation.population * 100).toFixed(0)}%">⚙️ Desired: ${effPercent}%</div>
                    ${actualBadge}
                `;
            }
            
            // Count how many times this building is in the queue
            const queueCount = queue.filter(item => item.building === key).length;
            
            let queueBadge = '';
            if (queueCount > 0) {
                queueBadge = `<div class="queue-count-badge">📋 In queue: ${queueCount} time${queueCount > 1 ? 's' : ''}</div>`;
            }
            
            // Build tooltip message for button
            let buttonTooltip = 'Upgrade to next level';
            let buttonDisabled = !building.canAfford || queueFull || !building.requirementsMet;
            
            if (queueFull) {
                buttonTooltip = 'Build queue is full';
            } else if (!building.requirementsMet && building.requirementsList && building.requirementsList.length > 0) {
                const reqs = building.requirementsList.map(r => `${r.name} Level ${r.level}`).join(', ');
                buttonTooltip = `Requirements not met: ${reqs}`;
            } else if (!building.canAfford) {
                buttonTooltip = 'Insufficient resources';
            }
            
            // Show custom variant info if available
            let customVariantBadge = '';
            let variantButtons = '';
            if (building.hasCustomVariant && building.customVariant) {
                const { focusLevels } = building.customVariant;
                const focusesApplied = Object.entries(focusLevels)
                    .filter(([focus, level]) => level > 0)
                    .map(([focus, level]) => `${focus}:${level}`)
                    .join(', ');
                const isCustomActive = building.currentVariant === 'custom';
                customVariantBadge = `<div class="custom-variant-badge" title="Custom variant available with focus: ${focusesApplied}">🔧 ${isCustomActive ? 'Custom Active' : 'Custom Available'}</div>`;
                
                // Calculate cost to switch variants
                let baseCost = building.cost;
                // Apply cost modifier to get custom cost
                let customCost = { ...baseCost };
                if (building.customVariant.modifiers && building.customVariant.modifiers.costMultiplier !== 1) {
                    customCost = {
                        metal: Math.floor(baseCost.metal * building.customVariant.modifiers.costMultiplier),
                        crystal: Math.floor(baseCost.crystal * building.customVariant.modifiers.costMultiplier),
                        deuterium: Math.floor(baseCost.deuterium * building.customVariant.modifiers.costMultiplier)
                    };
                }
                let switchCost = null;
                
                if (isCustomActive) {
                    // Currently custom, switching to base
                    const difference = {
                        metal: Math.abs(baseCost.metal - customCost.metal),
                        crystal: Math.abs(baseCost.crystal - customCost.crystal),
                        deuterium: Math.abs(baseCost.deuterium - customCost.deuterium)
                    };
                    const isCheaper = baseCost.metal + baseCost.crystal + baseCost.deuterium < 
                                     customCost.metal + customCost.crystal + customCost.deuterium;
                    
                    // If switching to cheaper variant, refund half the difference (negative cost)
                    if (isCheaper) {
                        switchCost = {
                            metal: -Math.floor(difference.metal / 2),
                            crystal: -Math.floor(difference.crystal / 2),
                            deuterium: -Math.floor(difference.deuterium / 2)
                        };
                    } else {
                        // Switching to more expensive, cost is twice the difference
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
                    
                    // If switching to cheaper variant, refund half the difference (negative cost)
                    if (isCheaper) {
                        switchCost = {
                            metal: -Math.floor(difference.metal / 2),
                            crystal: -Math.floor(difference.crystal / 2),
                            deuterium: -Math.floor(difference.deuterium / 2)
                        };
                    } else {
                        // Switching to more expensive, cost is twice the difference
                        switchCost = {
                            metal: difference.metal * 2,
                            crystal: difference.crystal * 2,
                            deuterium: difference.deuterium * 2
                        };
                    }
                }
                
                let switchButtonLabel = isCustomActive ? '↩️ Switch to Base' : '🔧 Switch to Custom';
                let canSwitchAfford = true;
                
                // Check if can afford the switch
                if (switchCost.metal > 0 && planet.resources.metal < switchCost.metal) canSwitchAfford = false;
                if (switchCost.crystal > 0 && planet.resources.crystal < switchCost.crystal) canSwitchAfford = false;
                if (switchCost.deuterium > 0 && planet.resources.deuterium < switchCost.deuterium) canSwitchAfford = false;
                
                let switchTooltip = `Switch to ${isCustomActive ? 'base' : 'custom'} variant`;
                if (!canSwitchAfford) {
                    switchTooltip = 'Insufficient resources to switch';
                }
                
                let switchCostDisplay = '';
                if (switchCost.metal !== 0 || switchCost.crystal !== 0 || switchCost.deuterium !== 0) {
                    switchCostDisplay = `
                        <div class="building-cost" style="margin-top: 8px;">
                            <strong>Switch cost:</strong>
                            <div>⚙️ ${switchCost.metal > 0 ? '+' : ''}${formatNumber(switchCost.metal)}</div>
                            <div>💎 ${switchCost.crystal > 0 ? '+' : ''}${formatNumber(switchCost.crystal)}</div>
                            ${switchCost.deuterium !== 0 ? `<div>🛢️ ${switchCost.deuterium > 0 ? '+' : ''}${formatNumber(switchCost.deuterium)}</div>` : ''}
                        </div>
                    `;
                }
                
                variantButtons = `
                    ${switchCostDisplay}
                    <button class="btn btn-full" 
                            ${!canSwitchAfford ? 'disabled' : ''} 
                            title="${switchTooltip}"
                            onclick="window.switchBuildingVariant('${key}', ${isCustomActive ? 'false' : 'true'})">
                        ${switchButtonLabel}
                    </button>
                `;
            }
            
        buildingHtmls.push(`
                <div class="building-card ${queueCount > 0 ? 'in-queue' : ''}">
                    <div class="building-header">
                        <h3>${building.icon} ${building.name}</h3>
                        <button class="btn-info" onclick="window.showBuildingDetails('${key}')" title="View detailed stats">ℹ️</button>
                    </div>
                    <div class="building-level">Level ${building.currentLevel}</div>
                    ${customVariantBadge}
                    ${allocationBadge}
                    ${queueBadge}
                    <p>${building.description}</p>
                    <div class="building-cost">
                        <strong>Cost for level ${building.nextLevel}:</strong>
                        <div>⚙️ Metal: ${formatNumber(building.cost.metal)}</div>
                        <div>💎 Crystal: ${formatNumber(building.cost.crystal)}</div>
                        ${building.cost.deuterium > 0 ? `<div>🛢️ Deuterium: ${formatNumber(building.cost.deuterium)}</div>` : ''}
                    </div>
                    <div class="building-stats">
                        <div class="build-time">🕐 Build time: ${formatCountdown(building.buildTime)}</div>
                        ${statsInfo}
                        ${energyInfo}
                    </div>
                    <button class="btn ${building.canAfford && building.requirementsMet ? 'btn-success' : ''} btn-full" 
                            ${buttonDisabled ? 'disabled' : ''} 
                            title="${buttonTooltip}"
                            onclick="window.upgradeBuilding('${key}')">
                        ${queueFull ? 'Queue Full' : !building.requirementsMet ? 'Requirements Not Met' : `Upgrade to Level ${building.nextLevel}`}
                    </button>
                    ${variantButtons}
                </div>
            `);
    }
    buildingsGrid.innerHTML = buildingHtmls.join('');
    
    // Update queue
    updateQueueView(queue, maxQueueSize, buildings);
    lastQueueStateHash = calculateQueueStateHash(queue);
    
    // Update timers
    updateTimers();
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
                        return `
                            <div class="queue-item ${isActive ? 'active' : ''}">
                                <span class="q-pos">${item.queuePosition}.</span>
                                <span class="q-name" title="${buildings[item.building]?.name || item.building}">${buildings[item.building]?.icon || ''} ${buildings[item.building]?.name || item.building}</span>
                                <span class="q-level">Lvl ${item.level}</span>
                                <span class="timer" data-finish="${item.finishTime}"></span>
                                <button class="btn-cancel-small" onclick="window.cancelBuilding(${item.queuePosition})" title="Cancel">✕</button>
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

/**
 * Update countdown timers
 */
export function updateTimers() {
    document.querySelectorAll('.timer').forEach(timer => {
        const finishTime = parseInt(timer.dataset.finish);
        const remaining = Math.max(0, finishTime - Date.now());
        timer.textContent = formatCountdown(remaining / 1000);
        
        if (remaining === 0) {
            timer.textContent = 'Complete!';
        }
    });
}

/**
 * Upgrade building (exposed globally)
 */
export async function upgradeBuilding(buildingKey, onStateChange) {
    if (!currentGameState || !currentGameState.planets[0]) return;
    
    const planet = currentGameState.planets[0];
    
    try {
        await API.upgradeBuilding(planet.id, buildingKey);
        if (onStateChange) await onStateChange();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

/**
 * Switch building variant (exposed globally)
 */
export async function switchBuildingVariant(buildingKey, toCustom, onStateChange) {
    if (!currentGameState || !currentGameState.planets[0]) return;
    
    const planet = currentGameState.planets[0];
    
    if (!toCustom) {
        // Switching to base - direct switch, no selection needed
        try {
            await API.switchBuildingVariant(planet.id, buildingKey, false);
            if (onStateChange) await onStateChange();
        } catch (error) {
            alert('Error: ' + error.message);
        }
        return;
    }
    
    // Switching to custom - show selection modal
    let buildingDetails;
    try {
        buildingDetails = await API.getBuildingDetails(planet.id);
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
        const focusDisplay = Object.entries(currentVariantData.focusLevels || {})
            .filter(([focus, level]) => level > 0)
            .map(([focus, level]) => `<span class="focus-badge">${focus} <strong>${level}</strong></span>`)
            .join('');
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
            const focusDisplay = Object.entries(variant.focusLevels || {})
                .filter(([focus, level]) => level > 0)
                .map(([focus, level]) => `<span class="focus-badge">${focus} <strong>${level}</strong></span>`)
                .join('');
            
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
    if (!currentGameState || !currentGameState.planets[0]) return;
    
    const planet = currentGameState.planets[0];
    
    if (confirm(`Cancel building at queue position ${queuePosition}? You will get 50% resources back.`)) {
        try {
            await API.cancelBuilding(planet.id, queuePosition);
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
    const planet = currentGameState?.planets[0];
    
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
    
    const modal = document.getElementById('building-details-modal');
    const modalTitle = document.getElementById('modal-building-title');
    const modalBody = document.getElementById('modal-building-body');
    
    modalTitle.innerHTML = `${building.icon} ${building.name} <span class="current-level">(Current: Level ${currentLevel})</span>`;
    
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

    // Create a dummy building object for shared formula use
    const buildingWithBaseTime = { baseCost: baseCostEstimate };
    
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
    
    let tableRows = levels.map(l => {
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
        
        return `
            <tr class="${isCurrent ? 'current-level-row' : ''}">
                <td>${l.level}${isCurrent ? ' ⭐' : ''}</td>
                <td>⚙️${formatNumber(l.cost.metal)}<br>💎${formatNumber(l.cost.crystal)}${l.cost.deuterium > 0 ? `<br>🛢️${formatNumber(l.cost.deuterium)}` : ''}</td>
                <td>${formatCountdown(l.buildTime)}</td>
                <td>${dataCell}</td>
                <td>${consumptionCell}</td>
            </tr>
        `;
    }).join('');
    
    // Generate special effects info for certain buildings
    let effectsSection = '';
    if (buildingKey === 'roboticsFactory' && currentLevel > 0) {
        const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, currentLevel)).toFixed(2);
        effectsSection = `
            <div class="building-effects">
                <strong>⚙️ Current Effect:</strong>
                <div>Construction speed multiplier: ${speedMult}x (1 / ${BUILDING_SPEED_MULTIPLIER}^${currentLevel})</div>
            </div>
        `;
    } else if (buildingKey === 'naniteFactory' && currentLevel > 0) {
        const speedMult = Math.pow(2, currentLevel).toFixed(0);
        effectsSection = `
            <div class="building-effects">
                <strong>⚡ Current Effect:</strong>
                <div>Nanite construction speed multiplier: ${speedMult}x (2^${currentLevel})</div>
            </div>
        `;
    } else if (buildingKey === 'researchLab' && currentLevel > 0) {
        const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, currentLevel)).toFixed(2);
        effectsSection = `
            <div class="building-effects">
                <strong>🔬 Current Effect:</strong>
                <div>Research speed multiplier: ${speedMult}x (1 / ${BUILDING_SPEED_MULTIPLIER}^${currentLevel})</div>
            </div>
        `;
    } else if (buildingKey === 'shipyard' && currentLevel > 0) {
        const speedMult = (1 / Math.pow(BUILDING_SPEED_MULTIPLIER, currentLevel)).toFixed(2);
        effectsSection = `
            <div class="building-effects">
                <strong>🚀 Current Effect:</strong>
                <div>Ship production speed multiplier: ${speedMult}x (1 / ${BUILDING_SPEED_MULTIPLIER}^${currentLevel})</div>
            </div>
        `;
    }
    
    modalBody.innerHTML = `
        <div class="building-description">${building.description}</div>
        ${effectsSection}
        <div class="stats-table-container">
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Level</th>
                        <th>Cost</th>
                        <th>Build Time</th>
                        <th>${
                            buildingKey.includes('Storage') ? 'Capacity' :
                            buildingKey === 'roboticsFactory' ? 'Construction Speed' :
                            buildingKey === 'naniteFactory' ? 'Nanite Speed' :
                            buildingKey === 'researchLab' ? 'Research Speed' :
                            buildingKey === 'shipyard' ? 'Production Speed' :
                            'Production'
                        }</th>
                        <th>${buildingKey === 'fusionReactor' ? 'Deuterium' : 'Energy'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // Add click outside modal to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Add ESC key to close modal
    const handleEscKey = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
            document.removeEventListener('keydown', handleEscKey);
        }
    };
    document.addEventListener('keydown', handleEscKey);
}

/**
 * Close modal
 */
export function closeModal() {
    document.getElementById('building-details-modal').style.display = 'none';
}
