// Main client application
import { API } from './api.js';
import { formatNumber, formatCountdown } from './utils.js';

// Import buildings data
const BUILDINGS_DATA = {
    metalMine: { name: 'Metal Mine', icon: '⚙️', desc: 'Extracts metal from the planet' },
    crystalMine: { name: 'Crystal Mine', icon: '💎', desc: 'Mines crystal from the planet' },
    deuteriumSynthesizer: { name: 'Deuterium Synthesizer', icon: '🛢️', desc: 'Synthesizes deuterium' },
    solarPlant: { name: 'Solar Plant', icon: '⚡', desc: 'Generates energy' },
    roboticsFactory: { name: 'Robotics Factory', icon: '🤖', desc: 'Speeds up construction' },
    shipyard: { name: 'Shipyard', icon: '🚀', desc: 'Build ships and defenses' },
    researchLab: { name: 'Research Lab', icon: '🔬', desc: 'Research technologies' },
    fusionReactor: { name: 'Fusion Reactor', icon: '⚛️', desc: 'Advanced energy production' },
    metalStorage: { name: 'Metal Storage', icon: '📦', desc: 'Increases metal storage' },
    crystalStorage: { name: 'Crystal Storage', icon: '📦', desc: 'Increases crystal storage' },
    deuteriumTank: { name: 'Deuterium Tank', icon: '🛢️', desc: 'Increases deuterium storage' }
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
    
    buildingsGrid.innerHTML = Object.entries(BUILDINGS_DATA)
        .map(([key, data]) => {
            const level = buildings[key] || 0;
            const nextLevel = level + 1;
            
            // Simplified cost calculation (matches server)
            let baseMetal = 60, baseCrystal = 15;
            if (key === 'crystalMine') { baseMetal = 48; baseCrystal = 24; }
            if (key === 'deuteriumSynthesizer') { baseMetal = 225; baseCrystal = 75; }
            if (key === 'solarPlant') { baseMetal = 75; baseCrystal = 30; }
            if (key === 'roboticsFactory') { baseMetal = 400; baseCrystal = 120; }
            if (key === 'shipyard') { baseMetal = 400; baseCrystal = 200; }
            if (key === 'researchLab') { baseMetal = 200; baseCrystal = 400; }
            if (key === 'fusionReactor') { baseMetal = 900; baseCrystal = 360; }
            if (key === 'metalStorage') { baseMetal = 1000; baseCrystal = 0; }
            if (key === 'crystalStorage') { baseMetal = 1000; baseCrystal = 500; }
            if (key === 'deuteriumTank') { baseMetal = 1000; baseCrystal = 1000; }
            
            const cost = {
                metal: Math.floor(baseMetal * Math.pow(1.5, nextLevel)),
                crystal: Math.floor(baseCrystal * Math.pow(1.5, nextLevel))
            };
            
            const canAfford = planet.resources.metal >= cost.metal && 
                            planet.resources.crystal >= cost.crystal;
            
            const isBuilding = planet.buildQueue && planet.buildQueue.length > 0 && 
                             planet.buildQueue[0].building === key;
            
            const hasQueue = planet.buildQueue && planet.buildQueue.length > 0;
            
            return `
                <div class="building-card">
                    <h3>${data.icon} ${data.name}</h3>
                    <div class="building-level">Level ${level}</div>
                    <p>${data.desc}</p>
                    ${isBuilding ? `
                        <div class="building-progress">
                            <strong>🔨 Building to Level ${nextLevel}...</strong>
                            <div class="timer" data-finish="${planet.buildQueue[0].finishTime}"></div>
                            <button class="btn btn-danger" onclick="window.cancelBuilding()">Cancel</button>
                        </div>
                    ` : `
                        <div class="building-cost">
                            <strong>Cost for level ${nextLevel}:</strong>
                            <div>Metal: ${formatNumber(cost.metal)}</div>
                            <div>Crystal: ${formatNumber(cost.crystal)}</div>
                        </div>
                        <button class="btn ${canAfford ? 'btn-success' : ''}" 
                                ${!canAfford || hasQueue ? 'disabled' : ''} 
                                onclick="window.upgradeBuilding('${key}')">
                            Upgrade to Level ${nextLevel}
                        </button>
                    `}
                </div>
            `;
        })
        .join('');
    
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
        alert('Building upgrade started!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Cancel building (global for onclick)
window.cancelBuilding = async function() {
    if (!gameState || !gameState.planets[0]) return;
    
    const planet = gameState.planets[0];
    
    if (confirm('Cancel building construction? You will get 50% resources back.')) {
        try {
            await API.cancelBuilding(planet.id);
            await loadGameState();
            alert('Building cancelled');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
};

// Start the app
init();
