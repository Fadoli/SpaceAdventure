// Main client application - Entry point
import { API } from './api.js';
import { updateOverview, updateResources } from './views/overview.js';
import { 
    updateBuildingsView, 
    updateTimers, 
    setGameState,
    upgradeBuilding as buildingUpgrade,
    cancelBuilding as buildingCancel,
    showBuildingDetails as showBuildingInfo,
    closeModal as closeBuildingModal
} from './views/buildings.js';
import { updateResearchView } from './views/research.js';
import { updateShipyardView } from './views/shipyard.js';
import { updateFleetView } from './views/fleet.js';
import { updateGalaxyView } from './views/galaxy.js';
import { renderAllocation, setupAllocationHandlers } from './views/allocation.js';

// State
let currentUser = null;
let gameState = null;
let currentView = 'overview';
let updateInterval = null;

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

async function showGameScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    await loadGameState();
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
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
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
    
    // Update view if needed
    if (gameState) {
        // For allocation view, render it when explicitly switched
        if (view === 'allocation') {
            renderAllocation().then(html => {
                document.getElementById('allocation-view').innerHTML = html;
                setupAllocationHandlers();
            });
        } else {
            updateCurrentView();
        }
    }
}

// Game State Management
async function loadGameState() {
    try {
        gameState = await API.getGameState();
        setGameState(gameState);
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
        // Update resources (always visible in header)
        updateResources(planet);
        
        // Update planet info
        document.getElementById('planet-name').textContent = planet.name;
        document.getElementById('planet-coords').textContent = 
            `[${planet.coordinates.join(':')}]`;
        
        // Update current view
        updateCurrentView();
    }
}

function updateCurrentView() {
    const planet = gameState.planets[0];
    
    switch (currentView) {
        case 'overview':
            updateOverview(planet);
            break;
        case 'buildings':
            updateBuildingsView(planet, loadGameState);
            break;
        case 'research':
            updateResearchView(gameState);
            break;
        case 'shipyard':
            updateShipyardView(planet);
            break;
        case 'fleet':
            updateFleetView(gameState);
            break;
        case 'galaxy':
            updateGalaxyView();
            break;
        case 'allocation':
            // Don't re-render allocation view during auto-updates to preserve user input
            // Only re-render when user explicitly switches to this view
            break;
    }
}

// Resource auto-update
function startResourceUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
        await loadGameState();
        updateTimers();
    }, 2000); // Every 2 seconds
}

// Global window functions for onclick handlers
window.upgradeBuilding = async function(buildingKey) {
    await buildingUpgrade(buildingKey, loadGameState);
};

window.cancelBuilding = async function(queuePosition = 1) {
    await buildingCancel(queuePosition, loadGameState);
};

window.showBuildingDetails = function(buildingKey) {
    showBuildingInfo(buildingKey);
};

window.closeModal = function() {
    closeBuildingModal();
};

window.showView = function(view) {
    switchView(view);
};

// Export getCurrentPlanet for allocation view
export function getCurrentPlanet() {
    return gameState?.planets?.[0] || null;
}

// Start the app
init();
