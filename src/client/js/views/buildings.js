// Buildings view logic
import { API } from '../api.js';
import { formatNumber, formatCountdown } from '../utils.js';
import { RESOURCE_ICONS } from '../../../shared/constants.js';
import { isEmpty } from '../../../shared/utils.js';

let currentGameState = null;

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
    const queueFull = queue.length >= maxQueueSize;
    
    const buildingHtmls = [];
    for (const key in buildings) {
        const building = buildings[key];
            // All data now comes from server including icon and description
            
            // Calculate current level production to show differences
            const currentProd = {};
            const nextProd = building.production || {};
            
            // Estimate current level production (approximate reverse calculation)
            if (building.currentLevel > 0 && !isEmpty(nextProd)) {
                for (const resource in nextProd) {
                    const nextAmount = nextProd[resource];
                    const baseAmount = nextAmount / (building.nextLevel * Math.pow(1.1, building.nextLevel) * 10.0);
                    currentProd[resource] = Math.floor(baseAmount * building.currentLevel * Math.pow(1.1, building.currentLevel) * 10.0);
                }
            }
            
            // Show production difference info
            let productionInfo = '';
            if (!isEmpty(nextProd)) {
                productionInfo = '<div class="building-production">';
                for (const resource in nextProd) {
                    const nextAmount = nextProd[resource];
                    const currentAmount = currentProd[resource] || 0;
                    const diff = nextAmount - currentAmount;
                    const icon = RESOURCE_ICONS[resource] || '❓';
                    productionInfo += `<div>${icon} +${formatNumber(diff)}/h</div>`;
                }
                productionInfo += '</div>';
            }
            
            // Calculate current level energy consumption to show difference
            let energyInfo = '';
            if (building.energyConsumption > 0) {
                const currentEnergy = building.currentLevel > 0 ? 
                    Math.floor((building.energyConsumption / (building.nextLevel * Math.pow(1.1, building.nextLevel) * 10.0)) * building.currentLevel * Math.pow(1.1, building.currentLevel) * 10.0) : 0;
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
                // Calculate desired effectiveness (simplified client-side)
                const powerEff = allocation.power <= 1.0 ? Math.sqrt(allocation.power) : 1.0 + ((allocation.power - 1.0) * 0.5 * Math.pow(0.5, allocation.power - 1.0));
                const popEff = allocation.population <= 1.0 ? Math.sqrt(allocation.population) : 1.0 + ((allocation.population - 1.0) * 0.5 * Math.pow(0.5, allocation.population - 1.0));
                const totalEff = powerEff * popEff;
                const effPercent = (totalEff * 100).toFixed(0);
                
                // Calculate ACTUAL effectiveness if available
                let actualBadge = '';
                if (actualAllocation) {
                    const actualPowerEff = actualAllocation.power <= 1.0 ? Math.sqrt(actualAllocation.power) : 1.0 + ((actualAllocation.power - 1.0) * 0.5 * Math.pow(0.5, actualAllocation.power - 1.0));
                    const actualPopEff = actualAllocation.population <= 1.0 ? Math.sqrt(actualAllocation.population) : 1.0 + ((actualAllocation.population - 1.0) * 0.5 * Math.pow(0.5, actualAllocation.population - 1.0));
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
            
        buildingHtmls.push(`
                <div class="building-card ${queueCount > 0 ? 'in-queue' : ''}">
                    <div class="building-header">
                        <h3>${building.icon} ${building.name}</h3>
                        <button class="btn-info" onclick="window.showBuildingDetails('${key}')" title="View detailed stats">ℹ️</button>
                    </div>
                    <div class="building-level">Level ${building.currentLevel}</div>
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
                        ${productionInfo}
                        ${energyInfo}
                    </div>
                    <button class="btn ${building.canAfford ? 'btn-success' : ''} btn-full" 
                            ${!building.canAfford || queueFull ? 'disabled' : ''} 
                            onclick="window.upgradeBuilding('${key}')">
                        ${queueFull ? 'Queue Full' : `Upgrade to Level ${building.nextLevel}`}
                    </button>
                </div>
            `);
    }
    buildingsGrid.innerHTML = buildingHtmls.join('');
    
    // Show build queue summary
    if (queue.length > 0) {
        const queueSummary = `
            <div class="build-queue-summary">
                <h3>🔨 Build Queue (${queue.length}/${maxQueueSize})</h3>
                <div class="queue-items">
                    ${queue.map((item, index) => {
                        const isActive = index === 0;
                        return `
                            <div class="queue-item ${isActive ? 'active' : ''}">
                                <div class="queue-item-info">
                                    <strong>${item.queuePosition}. ${buildings[item.building]?.icon || ''} ${buildings[item.building]?.name || item.building}</strong>
                                    <span>→ Level ${item.level}</span>
                                </div>
                                <div class="queue-item-time">
                                    ${isActive ? '<span class="building-now">⚙️ Building</span>' : ''}
                                    <span class="timer" data-finish="${item.finishTime}"></span>
                                </div>
                                <button class="btn-cancel" onclick="window.cancelBuilding(${item.queuePosition})" title="Cancel">❌</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        buildingsGrid.insertAdjacentHTML('afterbegin', queueSummary);
    }
    
    // Update timers
    updateTimers();
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
        metal: Math.round(building.cost.metal / (Math.pow(1.5, building.nextLevel) * 0.5)),
        crystal: Math.round(building.cost.crystal / (Math.pow(1.5, building.nextLevel) * 0.5)),
        deuterium: Math.round(building.cost.deuterium / (Math.pow(1.5, building.nextLevel) * 0.5))
    };
    
    for (let level = 1; level <= Math.min(currentLevel + 10, 30); level++) {
        const multiplier = Math.pow(1.5, level);
        const costMultiplier = 0.5;
        const cost = {
            metal: Math.floor(baseCostEstimate.metal * multiplier * costMultiplier),
            crystal: Math.floor(baseCostEstimate.crystal * multiplier * costMultiplier),
            deuterium: Math.floor(baseCostEstimate.deuterium * multiplier * costMultiplier)
        };
        
        // Use the building.buildTime as a reference point
        const baseTimeEstimate = building.buildTime / (Math.pow(1.5, building.nextLevel - 1) * 0.1);
        const baseTime = baseTimeEstimate * Math.pow(1.5, level - 1);
        const roboticsLevel = planet?.buildings.roboticsFactory || 0;
        const naniteLevel = planet?.buildings.naniteFactory || 0;
        const roboticsMultiplier = roboticsLevel > 0 ? Math.pow(0.8, roboticsLevel) : 1;
        const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
        const configMultiplier = 0.1;
        const buildTime = Math.max(1, Math.floor((baseTime * roboticsMultiplier / naniteMultiplier) * configMultiplier));
        
        let production = null;
        if (building.production && !isEmpty(building.production)) {
            production = {};
            const productionMultiplier = 10.0;
            for (const resource in building.production) {
                const currentAmount = building.production[resource];
                // Estimate base amount from next level's production
                const baseAmount = currentAmount / (building.nextLevel * Math.pow(1.1, building.nextLevel) * productionMultiplier);
                production[resource] = Math.floor(baseAmount * level * Math.pow(1.1, level) * productionMultiplier);
            }
        }
        
        let energyConsumption = 0;
        if (building.energyConsumption > 0) {
            const energyMultiplier = 10.0;
            const baseEnergy = building.energyConsumption / (building.nextLevel * Math.pow(1.1, building.nextLevel) * energyMultiplier);
            energyConsumption = Math.floor(baseEnergy * level * Math.pow(1.1, level) * energyMultiplier);
        }
        
        levels.push({ level, cost, buildTime, production, energyConsumption });
    }
    
    let tableRows = levels.map(l => {
        const isCurrent = l.level === currentLevel;
        let productionCells = '';
        if (l.production) {
            for (const resource in l.production) {
                const amount = l.production[resource];
                const icon = RESOURCE_ICONS[resource] || '❓';
                productionCells += `<div>${icon}+${formatNumber(amount)}/h</div>`;
            }
        } else {
            productionCells = '-';
        }
        
        const energyCell = l.energyConsumption > 0 ? `⚡-${formatNumber(l.energyConsumption)}/h` : '-';
        
        return `
            <tr class="${isCurrent ? 'current-level-row' : ''}">
                <td>${l.level}${isCurrent ? ' ⭐' : ''}</td>
                <td>⚙️${formatNumber(l.cost.metal)}<br>💎${formatNumber(l.cost.crystal)}${l.cost.deuterium > 0 ? `<br>🛢️${formatNumber(l.cost.deuterium)}` : ''}</td>
                <td>${formatCountdown(l.buildTime)}</td>
                <td>${productionCells}</td>
                <td>${energyCell}</td>
            </tr>
        `;
    }).join('');
    
    // Generate special effects info for certain buildings
    let effectsSection = '';
    if (buildingKey === 'roboticsFactory' && currentLevel > 0) {
        const reductionFactor = Math.pow(0.8, currentLevel);
        const reductionPercent = ((1 - reductionFactor) * 100).toFixed(1);
        effectsSection = `
            <div class="building-effects">
                <strong>⚙️ Current Effect:</strong>
                <div>Construction time reduced to ${(reductionFactor * 100).toFixed(1)}% (${reductionPercent}% faster)</div>
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
                        <th>Production</th>
                        <th>Energy</th>
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
