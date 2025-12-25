// Main client application
import { API } from './api.js';
import { formatNumber, formatCountdown } from './utils.js';

// Import buildings data with complete stats
const BUILDINGS_DATA = {
    metalMine: { 
        name: 'Metal Mine', 
        icon: '⚙️', 
        desc: 'Extracts metal from the planet',
        baseCost: { metal: 60, crystal: 15, deuterium: 0 },
        baseTime: 30,
        baseProduction: { metal: 30 },
        energyConsumption: 10
    },
    crystalMine: { 
        name: 'Crystal Mine', 
        icon: '💎', 
        desc: 'Mines crystal from the planet',
        baseCost: { metal: 48, crystal: 24, deuterium: 0 },
        baseTime: 30,
        baseProduction: { crystal: 20 },
        energyConsumption: 10
    },
    deuteriumSynthesizer: { 
        name: 'Deuterium Synthesizer', 
        icon: '🛢️', 
        desc: 'Synthesizes deuterium',
        baseCost: { metal: 225, crystal: 75, deuterium: 0 },
        baseTime: 45,
        baseProduction: { deuterium: 10 },
        energyConsumption: 20
    },
    solarPlant: { 
        name: 'Solar Plant', 
        icon: '⚡', 
        desc: 'Generates energy',
        baseCost: { metal: 75, crystal: 30, deuterium: 0 },
        baseTime: 25,
        baseProduction: { energy: 20 },
        energyConsumption: 0
    },
    fusionReactor: { 
        name: 'Fusion Reactor', 
        icon: '⚛️', 
        desc: 'Advanced energy production',
        baseCost: { metal: 900, crystal: 360, deuterium: 180 },
        baseTime: 120,
        baseProduction: { energy: 50 },
        energyConsumption: 0
    },
    roboticsFactory: { 
        name: 'Robotics Factory', 
        icon: '🤖', 
        desc: 'Speeds up construction (5% per level)',
        baseCost: { metal: 400, crystal: 120, deuterium: 200 },
        baseTime: 60,
        energyConsumption: 0
    },
    shipyard: { 
        name: 'Shipyard', 
        icon: '🚀', 
        desc: 'Build ships and defenses',
        baseCost: { metal: 400, crystal: 200, deuterium: 100 },
        baseTime: 60,
        energyConsumption: 0
    },
    researchLab: { 
        name: 'Research Lab', 
        icon: '🔬', 
        desc: 'Research technologies',
        baseCost: { metal: 200, crystal: 400, deuterium: 200 },
        baseTime: 60,
        energyConsumption: 0
    },
    naniteFactory: { 
        name: 'Nanite Factory', 
        icon: '🔧', 
        desc: 'Dramatically speeds up construction (2x per level)',
        baseCost: { metal: 1000000, crystal: 500000, deuterium: 100000 },
        baseTime: 3600,
        energyConsumption: 0
    },
    metalStorage: { 
        name: 'Metal Storage', 
        icon: '📦', 
        desc: 'Increases metal storage',
        baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
        baseTime: 30,
        energyConsumption: 0
    },
    crystalStorage: { 
        name: 'Crystal Storage', 
        icon: '📦', 
        desc: 'Increases crystal storage',
        baseCost: { metal: 1000, crystal: 500, deuterium: 0 },
        baseTime: 30,
        energyConsumption: 0
    },
    deuteriumTank: { 
        name: 'Deuterium Tank', 
        icon: '🛢️', 
        desc: 'Increases deuterium storage',
        baseCost: { metal: 1000, crystal: 1000, deuterium: 0 },
        baseTime: 30,
        energyConsumption: 0
    }
};

// State
let currentUser = null;
let gameState = null;
let currentView = 'overview';

// Initialize app
async function init() {
    setupAuthListeners();
    setupGameListeners();
    
    // Check if already logged in
    try {
        currentUser = await API.getCurrentUser();
        if (currentUser) {
            await showGameScreen();
        }
    } catch (error) {
        showAuthScreen();
    }
}

// Auth Screen
function showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('game-screen').classList.remove('active');
}

function showGameScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    loadGameState();
    startResourceUpdate();
}

function setupAuthListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(`${tab}-form`).classList.add('active');
        });
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        try {
            errorEl.classList.remove('show');
            const response = await API.login(username, password);
            currentUser = response;
            await showGameScreen();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('show');
        }
    });
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const email = document.getElementById('register-email').value;
        const errorEl = document.getElementById('register-error');
        
        try {
            errorEl.classList.remove('show');
            const response = await API.register(username, password, email);
            currentUser = response;
            await showGameScreen();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('show');
        }
    });
}

function setupGameListeners() {
    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await API.logout();
        currentUser = null;
        gameState = null;
        showAuthScreen();
    });
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    document.getElementById(`${view}-view`).classList.add('active');
}

// Game State Management
async function loadGameState() {
    try {
        gameState = await API.getGameState();
        updateUI();
    } catch (error) {
        console.error('Failed to load game state:', error);
    }
}

function updateUI() {
    if (!gameState) return;
    
    // Update player name
    document.getElementById('player-name').textContent = currentUser.username;
    
    // Get current planet (first planet for now)
    const planet = gameState.planets[0];
    
    if (planet) {
        // Update resources
        updateResources(planet);
        
        // Update planet info
        document.getElementById('planet-name').textContent = planet.name;
        document.getElementById('planet-coords').textContent = 
            `[${planet.coordinates.join(':')}]`;
        
        // Update overview
        updateOverview(planet);
        
        // Update buildings view
        updateBuildingsView(planet);
    }
}

function updateResources(planet) {
    const { resources, production, energyConsumption, energyEfficiency } = planet;
    
    document.getElementById('metal-amount').textContent = formatNumber(resources.metal);
    document.getElementById('crystal-amount').textContent = formatNumber(resources.crystal);
    document.getElementById('deuterium-amount').textContent = formatNumber(resources.deuterium);
    
    // Energy display shows net energy
    const energyProduction = production.energy + (energyConsumption || 0);
    const energyDisplay = production.energy >= 0 
        ? `${formatNumber(production.energy)}` 
        : `<span style="color: var(--accent-red)">${formatNumber(production.energy)}</span>`;
    document.getElementById('energy-amount').textContent = '';
    document.getElementById('energy-amount').innerHTML = energyDisplay;
    
    // Show efficiency warning if low energy
    const metalProd = energyEfficiency < 100 
        ? `${production.metal} (${energyEfficiency}%)` 
        : production.metal;
    const crystalProd = energyEfficiency < 100 
        ? `${production.crystal} (${energyEfficiency}%)` 
        : production.crystal;
    const deutProd = energyEfficiency < 100 
        ? `${production.deuterium} (${energyEfficiency}%)` 
        : production.deuterium;
    
    document.getElementById('metal-production').textContent = metalProd;
    document.getElementById('crystal-production').textContent = crystalProd;
    document.getElementById('deuterium-production').textContent = deutProd;
}

function updateOverview(planet) {
    const { resources, storage, buildings, production, energyConsumption, energyEfficiency } = planet;
    
    document.getElementById('overview-metal').textContent = formatNumber(resources.metal);
    document.getElementById('overview-crystal').textContent = formatNumber(resources.crystal);
    document.getElementById('overview-deuterium').textContent = formatNumber(resources.deuterium);
    
    document.getElementById('overview-metal-storage').textContent = formatNumber(storage.metal);
    document.getElementById('overview-crystal-storage').textContent = formatNumber(storage.crystal);
    document.getElementById('overview-deuterium-storage').textContent = formatNumber(storage.deuterium);
    
    // Buildings list (only update if element exists)
    const buildingsList = document.getElementById('buildings-list');
    if (buildingsList) {
        buildingsList.innerHTML = Object.entries(buildings)
            .filter(([_, level]) => level > 0)
            .map(([building, level]) => {
                const name = building.replace(/([A-Z])/g, ' $1').trim();
                const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                return `<div>${capitalizedName}: Level ${level}</div>`;
            })
            .join('') || '<p class="empty">No buildings yet</p>';
    }
    
    // Energy overview (only update if element exists)
    const energyOverview = document.getElementById('energy-overview');
    if (energyOverview) {
        const energyProduction = production.energy + (energyConsumption || 0);
        const energyBalance = production.energy;
        const isNegative = energyBalance < 0;
        
        energyOverview.innerHTML = `
            <div>Production: <span style="color: var(--accent-green)">${energyProduction}</span></div>
            <div>Consumption: <span style="color: var(--accent-yellow)">${energyConsumption || 0}</span></div>
            <div>Balance: <span style="color: ${isNegative ? 'var(--accent-red)' : 'var(--accent-green)'}">
                ${energyBalance}
            </span></div>
            ${energyEfficiency < 100 ? `
                <div style="color: var(--accent-red); font-weight: bold; margin-top: 10px;">
                    ⚠️ Not enough energy!<br>
                    Production efficiency: ${energyEfficiency}%
                </div>
            ` : ''}
        `;
    }
}

function updateBuildingsView(planet) {
    const { buildings } = planet;
    const buildingsGrid = document.getElementById('buildings-grid');
    
    // Helper to calculate cost
    const calculateCost = (buildingData, level) => {
        const multiplier = Math.pow(1.5, level);
        const costMultiplier = 0.5; // From dev config
        return {
            metal: Math.floor(buildingData.baseCost.metal * multiplier * costMultiplier),
            crystal: Math.floor(buildingData.baseCost.crystal * multiplier * costMultiplier),
            deuterium: Math.floor(buildingData.baseCost.deuterium * multiplier * costMultiplier)
        };
    };
    
    // Helper to calculate build time
    const calculateBuildTime = (buildingData, level) => {
        const baseTime = buildingData.baseTime * Math.pow(1.5, level - 1);
        const roboticsLevel = planet.buildings.roboticsFactory || 0;
        const naniteLevel = planet.buildings.naniteFactory || 0;
        const roboticsMultiplier = 1 + (roboticsLevel * 0.05);
        const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
        const configMultiplier = 0.1; // From dev config
        return Math.max(1, Math.floor((baseTime / (roboticsMultiplier * naniteMultiplier)) * configMultiplier));
    };
    
    // Helper to calculate production
    const calculateProduction = (buildingData, level) => {
        if (!buildingData.baseProduction) return null;
        const production = {};
        const productionMultiplier = 10.0; // From dev config
        for (const [resource, baseAmount] of Object.entries(buildingData.baseProduction)) {
            production[resource] = Math.floor(baseAmount * level * Math.pow(1.1, level) * productionMultiplier);
        }
        return production;
    };
    
    // Helper to calculate energy consumption
    const calculateEnergyConsumption = (buildingData, level) => {
        if (!buildingData.energyConsumption) return 0;
        const energyMultiplier = 10.0; // Use same as production multiplier
        return Math.floor(buildingData.energyConsumption * level * Math.pow(1.1, level) * energyMultiplier);
    };
    
    buildingsGrid.innerHTML = Object.entries(BUILDINGS_DATA)
        .map(([key, data]) => {
            const level = buildings[key] || 0;
            const nextLevel = level + 1;
            
            const cost = calculateCost(data, nextLevel);
            const buildTime = calculateBuildTime(data, nextLevel);
            const production = calculateProduction(data, nextLevel);
            const energyConsumption = calculateEnergyConsumption(data, nextLevel);
            
            const canAfford = planet.resources.metal >= cost.metal && 
                            planet.resources.crystal >= cost.crystal &&
                            planet.resources.deuterium >= cost.deuterium;
            
            // Check if this building is in queue
            const queueItem = planet.buildQueue?.find(item => item.building === key);
            const queuePosition = queueItem?.queuePosition;
            
            const maxQueueSize = 5; // From dev config
            const queueFull = planet.buildQueue && planet.buildQueue.length >= maxQueueSize;
            
            // Show production info
            let productionInfo = '';
            if (production) {
                productionInfo = '<div class="building-production">';
                for (const [resource, amount] of Object.entries(production)) {
                    const icon = resource === 'metal' ? '⚙️' : resource === 'crystal' ? '💎' : resource === 'deuterium' ? '🛢️' : '⚡';
                    productionInfo += `<div>${icon} +${formatNumber(amount)}/h</div>`;
                }
                productionInfo += '</div>';
            }
            
            let energyInfo = '';
            if (energyConsumption > 0) {
                energyInfo = `<div class="building-energy">⚡ -${formatNumber(energyConsumption)}/h</div>`;
            }
            
            return `
                <div class="building-card ${queueItem ? 'in-queue' : ''}">
                    <div class="building-header">
                        <h3>${data.icon} ${data.name}</h3>
                        <button class="btn-info" onclick="window.showBuildingDetails('${key}')" title="View detailed stats">ℹ️</button>
                    </div>
                    <div class="building-level">Level ${level}</div>
                    <p>${data.desc}</p>
                    ${queueItem ? `
                        <div class="building-progress">
                            <strong>🔨 Queue Position ${queuePosition} - Building to Level ${queueItem.level}...</strong>
                            <div class="timer" data-finish="${queueItem.finishTime}"></div>
                            ${queuePosition === 1 ? '<div class="building-active">⚙️ Currently Building</div>' : '<div class="building-queued">⏳ Waiting in queue</div>'}
                            <button class="btn btn-danger btn-small" onclick="window.cancelBuilding(${queuePosition})">Cancel</button>
                        </div>
                    ` : `
                        <div class="building-cost">
                            <strong>Cost for level ${nextLevel}:</strong>
                            <div>⚙️ Metal: ${formatNumber(cost.metal)}</div>
                            <div>💎 Crystal: ${formatNumber(cost.crystal)}</div>
                            ${cost.deuterium > 0 ? `<div>🛢️ Deuterium: ${formatNumber(cost.deuterium)}</div>` : ''}
                        </div>
                        <div class="building-stats">
                            <div class="build-time">🕐 Build time: ${formatCountdown(buildTime)}</div>
                            ${productionInfo}
                            ${energyInfo}
                        </div>
                        <button class="btn ${canAfford ? 'btn-success' : ''} btn-full" 
                                ${!canAfford || queueFull || queueItem ? 'disabled' : ''} 
                                onclick="window.upgradeBuilding('${key}')">
                            ${queueFull && !queueItem ? 'Queue Full' : queueItem ? 'Already in Queue' : `Upgrade to Level ${nextLevel}`}
                        </button>
                    `}
                </div>
            `;
        })
        .join('');
    
    // Show build queue summary
    if (planet.buildQueue && planet.buildQueue.length > 0) {
        const queueSummary = `
            <div class="build-queue-summary">
                <h3>🔨 Build Queue (${planet.buildQueue.length}/5)</h3>
                <div class="queue-items">
                    ${planet.buildQueue.map((item, index) => {
                        const buildingData = BUILDINGS_DATA[item.building];
                        const isActive = index === 0;
                        return `
                            <div class="queue-item ${isActive ? 'active' : ''}">
                                <div class="queue-item-info">
                                    <strong>${item.queuePosition}. ${buildingData.icon} ${buildingData.name}</strong>
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

// Resource auto-update
let updateInterval;
function startResourceUpdate() {
    updateInterval = setInterval(async () => {
        // Reload game state periodically to get server updates
        await loadGameState();
        updateTimers();
    }, 2000); // Every 2 seconds
}

// Update countdown timers
function updateTimers() {
    document.querySelectorAll('.timer').forEach(timer => {
        const finishTime = parseInt(timer.dataset.finish);
        const remaining = Math.max(0, finishTime - Date.now());
        timer.textContent = formatCountdown(remaining / 1000);
        
        if (remaining === 0) {
            timer.textContent = 'Complete!';
        }
    });
}

// Building upgrade (global for onclick)
window.upgradeBuilding = async function(building) {
    if (!gameState || !gameState.planets[0]) return;
    
    const planet = gameState.planets[0];
    
    try {
        await API.upgradeBuilding(planet.id, building);
        await loadGameState(); // Reload to see changes
        // alert('Building upgrade started!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Cancel building (global for onclick)
window.cancelBuilding = async function(queuePosition = 1) {
    if (!gameState || !gameState.planets[0]) return;
    
    const planet = gameState.planets[0];
    
    if (confirm(`Cancel building at queue position ${queuePosition}? You will get 50% resources back.`)) {
        try {
            await API.cancelBuilding(planet.id, queuePosition);
            await loadGameState();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
};

// Show building details modal
window.showBuildingDetails = function(buildingKey) {
    const buildingData = BUILDINGS_DATA[buildingKey];
    const planet = gameState?.planets[0];
    const currentLevel = planet?.buildings[buildingKey] || 0;
    
    // Calculate stats for levels
    const levels = [];
    for (let level = 1; level <= Math.min(currentLevel + 10, 30); level++) {
        const multiplier = Math.pow(1.5, level);
        const costMultiplier = 0.5;
        const cost = {
            metal: Math.floor(buildingData.baseCost.metal * multiplier * costMultiplier),
            crystal: Math.floor(buildingData.baseCost.crystal * multiplier * costMultiplier),
            deuterium: Math.floor(buildingData.baseCost.deuterium * multiplier * costMultiplier)
        };
        
        const baseTime = buildingData.baseTime * Math.pow(1.5, level - 1);
        const roboticsLevel = planet?.buildings.roboticsFactory || 0;
        const naniteLevel = planet?.buildings.naniteFactory || 0;
        const roboticsMultiplier = 1 + (roboticsLevel * 0.05);
        const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
        const configMultiplier = 0.1;
        const buildTime = Math.max(1, Math.floor((baseTime / (roboticsMultiplier * naniteMultiplier)) * configMultiplier));
        
        let production = null;
        if (buildingData.baseProduction) {
            production = {};
            const productionMultiplier = 10.0;
            for (const [resource, baseAmount] of Object.entries(buildingData.baseProduction)) {
                production[resource] = Math.floor(baseAmount * level * Math.pow(1.1, level) * productionMultiplier);
            }
        }
        
        let energyConsumption = 0;
        if (buildingData.energyConsumption) {
            const energyMultiplier = 10.0; // Use same as production multiplier
            energyConsumption = Math.floor(buildingData.energyConsumption * level * Math.pow(1.1, level) * energyMultiplier);
        }
        
        levels.push({ level, cost, buildTime, production, energyConsumption });
    }
    
    const modal = document.getElementById('building-details-modal');
    const modalTitle = document.getElementById('modal-building-title');
    const modalBody = document.getElementById('modal-building-body');
    
    modalTitle.innerHTML = `${buildingData.icon} ${buildingData.name} <span class="current-level">(Current: Level ${currentLevel})</span>`;
    
    let tableRows = levels.map(l => {
        const isCurrent = l.level === currentLevel;
        let productionCells = '';
        if (l.production) {
            for (const [resource, amount] of Object.entries(l.production)) {
                const icon = resource === 'metal' ? '⚙️' : resource === 'crystal' ? '💎' : resource === 'deuterium' ? '🛢️' : '⚡';
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
    
    modalBody.innerHTML = `
        <div class="building-description">${buildingData.desc}</div>
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
};

// Close modal
window.closeModal = function() {
    document.getElementById('building-details-modal').style.display = 'none';
};

// Start the app
init();
