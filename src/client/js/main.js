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
import { updateResearchView, initializeResearch, updateResearchTimers } from './views/research.js';
import { updateShipyardView } from './views/shipyard.js';
import { updateFleetView } from './views/fleet.js';
import { updateRankingView } from './views/ranking.js';
import { updateGalaxyView } from './views/galaxy.js';
import { updateMessagesView, updateUnreadCount } from './views/messages.js';
import { renderAllocation, setupAllocationHandlers } from './views/allocation.js';
import { updateFleetMovements } from './views/fleetMovements.js';
import { Notifications } from './notifications.js';
import { showConfirm } from './views/modals.js';
import { calculatePopulationChange } from '../../shared/formulas.js';

// State
let currentUser = null;
let gameState = null;
let currentView = 'overview';
let currentPlanetId = null;
let lastAllocationPlanetId = null;
let updateInterval = null;

// URL State Management
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        planetId: params.get('planet'),
        view: params.get('view') || 'overview'
    };
}

function updateUrlParams(planetId, view) {
    const params = new URLSearchParams();
    if (planetId) {
        params.set('planet', planetId);
    }
    if (view) {
        params.set('view', view);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ planetId, view }, '', newUrl);
}

// Initialize app
async function init() {
    setupGameListeners();
    
    // Fetch and store game configuration
    try {
        window.GAME_CONFIG = await API.getConfig();
        console.log('Game config loaded:', window.GAME_CONFIG);
    } catch (error) {
        console.error('Failed to load game config:', error);
        // Fallback to default if fetch fails
        window.GAME_CONFIG = {
            gameSpeed: {
                resourceProduction: 1.0,
                buildTime: 1.0,
                researchTime: 1.0,
                shipBuildTime: 1.0,
                fleetSpeed: 1.0
            },
            balancing: {
                resourceCostMultiplier: 1.0,
                energyConsumptionMultiplier: 1.0,
                storageCapacityMultiplier: 1.0
            }
        };
    }
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        if (event.state && gameState) {
            const { planetId, view } = event.state;
            currentPlanetId = planetId;
            currentView = view || 'overview';
            switchView(currentView, false); // false = don't push to history
        }
    });
    
    // Check if already logged in
    try {
        currentUser = await API.getCurrentUser();
        if (currentUser) {
            window.currentUser = currentUser;
            await showGameScreen();
        } else {
            if (window.location.pathname !== '/login.html') {
                window.location.href = '/login.html';
            }
        }
    } catch (error) {
        if (window.location.pathname !== '/login.html') {
            window.location.href = '/login.html';
        }
    }
}

async function showGameScreen() {
    document.getElementById('game-screen').classList.add('active');
    
    // Load game state first
    await loadGameState();
    
    // Restore state from URL if available
    const urlParams = getUrlParams();
    
    if (urlParams.planetId && gameState) {
        const planet = gameState.planets.find(p => p.id === urlParams.planetId);
        if (planet) {
            currentPlanetId = urlParams.planetId;
        } else {
            // Planet not found, use first planet
            currentPlanetId = gameState.planets[0]?.id;
        }
    } else if (gameState && gameState.planets && gameState.planets.length > 0) {
        // Default to first planet
        currentPlanetId = gameState.planets[0].id;
    }
    
    // Restore view from URL or use default
    if (urlParams.view) {
        currentView = urlParams.view;
    }
    
    // Update UI first to ensure planet info is shown
    updateUI();
    updateUnreadCount();
    
    // Now switch to the restored/default view
    // Use false to not push to history since we're just restoring state
    switchView(currentView, false);
    
    startResourceUpdate();
}

function setupGameListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (window.closeDetailsModal) window.closeDetailsModal();
            if (window.closeInputModal) window.closeInputModal();
            if (window.closeAllocationModal) window.closeAllocationModal();
            if (window.closeCustomVariantModal) window.closeCustomVariantModal();
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        const confirmed = await showConfirm('Logout', 'Are you sure you want to log out?');
        if (!confirmed) return;
        
        await API.logout();
        currentUser = null;
        gameState = null;
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        window.location.href = '/login.html';
    });
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view, updateHistory = true) {
    currentView = view;
    
    // Update URL if requested
    if (updateHistory) {
        updateUrlParams(currentPlanetId, view);
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const navBtn = document.querySelector(`[data-view="${view}"]`);
    const viewEl = document.getElementById(`${view}-view`);
    
    if (navBtn) navBtn.classList.add('active');
    if (viewEl) viewEl.classList.add('active');
    
    // Update view if needed
    if (gameState) {
        // For allocation view, render it when explicitly switched
        if (view === 'allocation') {
            lastAllocationPlanetId = currentPlanetId;
            renderAllocation().then(html => {
                document.getElementById('allocation-view').innerHTML = html;
                setupAllocationHandlers();
            });
        } else if (view === 'galaxy') {
            // Render galaxy view when explicitly switched
            updateGalaxyView(gameState);
        } else if (view === 'research') {
            // Initialize research view when explicitly switched
            const planet = gameState.planets.find(p => p.id === currentPlanetId) || gameState.planets[0];
            initializeResearch(planet);
        } else if (view === 'messages') {
            updateMessagesView();
        } else if (view === 'ranking') {
            updateRankingView();
        } else {
            updateCurrentView();
        }
    }
}

// Game State Management
let lastFetchTime = 0;
let nextEarliestCompletion = 0;

function findNextCompletion(state) {
    if (!state) return 0;
    let times = [];

    // Research
    if (state.researchQueue?.length > 0) times.push(state.researchQueue[0].endTime);
    if (state.practicalResearchQueue?.length > 0) times.push(state.practicalResearchQueue[0].endTime);

    // Planets
    if (state.planets) {
        state.planets.forEach(p => {
            if (p.buildQueue?.length > 0) times.push(p.buildQueue[0].finishTime);
            if (p.shipQueue?.length > 0) times.push(p.shipQueue[0].finishTime);
            if (p.defenseQueue?.length > 0) times.push(p.defenseQueue[0].finishTime);
        });
    }

    // Filter out past times and find minimum
    const futureTimes = times.filter(t => t > Date.now());
    return futureTimes.length > 0 ? Math.min(...futureTimes) : 0;
}

async function loadGameState() {
    try {
        gameState = await API.getGameState();
        nextEarliestCompletion = findNextCompletion(gameState);
        setGameState(gameState);
        updateUI();
    } catch (error) {
        console.error('Failed to load game state:', error);
    }
}

window.loadGameState = loadGameState;

function updateUI() {
    if (!gameState || !currentUser) return;
    
    // Update fleet movements
    updateFleetMovements(gameState);
    
    // Update player name
    const playerNameEl = document.getElementById('player-name');
    if (playerNameEl) {
        playerNameEl.textContent = currentUser.username;
    }
    
    // Get current planet by ID, or default to first planet
    let planet = null;
    if (currentPlanetId) {
        planet = gameState.planets.find(p => p.id === currentPlanetId);
    }
    if (!planet && gameState.planets.length > 0) {
        planet = gameState.planets[0];
        currentPlanetId = planet.id;
    }
    
    if (planet) {
        // Update resources (always visible in header)
        updateResources(planet);
        
        // Update planet info in header
        const planetSelectContainer = document.getElementById('planet-select-header-container');
        const planetCoordsHeader = document.getElementById('planet-coords-header');
        
        if (planetSelectContainer) {
            // Only re-render dropdown if number of planets changed or it's missing
            const currentSelect = planetSelectContainer.querySelector('select');
            if (!currentSelect || currentSelect.options.length !== gameState.planets.length) {
                const options = gameState.planets.map(p => 
                    `<option value="${p.id}" ${p.id === planet.id ? 'selected' : ''}>${p.name}</option>`
                ).join('');
                planetSelectContainer.innerHTML = `<select class="header-planet-select" onchange="window.selectPlanet(this.value)">${options}</select>`;
            } else if (currentSelect.value !== planet.id) {
                currentSelect.value = planet.id;
            }
        }
        
        if (planetCoordsHeader) planetCoordsHeader.textContent = `[${planet.coordinates.join(':')}]`;
        
        // Update current view
        updateCurrentView();
    }
}

function updateCurrentView() {
    let planet = null;
    if (currentPlanetId) {
        planet = gameState.planets.find(p => p.id === currentPlanetId);
    }
    if (!planet && gameState.planets.length > 0) {
        planet = gameState.planets[0];
    }
    
    if (!planet) return;
    
    switch (currentView) {
        case 'overview':
            updateOverview(planet, gameState.planets);
            break;
        case 'buildings':
            updateBuildingsView(planet, loadGameState);
            break;
        case 'research':
            // Update research buildings without full re-render
            updateResearchView(gameState, currentPlanetId);
            break;
        case 'shipyard':
            updateShipyardView(planet);
            break;
        case 'defenses':
            updateShipyardView(planet, 'defenses');
            break;
        case 'fleet':
            updateFleetView(gameState);
            break;
        case 'galaxy':
            // Don't auto-update galaxy view during regular updates
            // Only render when user explicitly switches to this view
            break;
        case 'messages':
            updateMessagesView();
            break;
        case 'ranking':
            // Don't auto-update ranking view to save bandwidth and prevent jitter
            break;
        case 'allocation':
            // Don't re-render allocation view during auto-updates to preserve user input
            // EXCEPT when we switched planets
            if (lastAllocationPlanetId !== currentPlanetId) {
                lastAllocationPlanetId = currentPlanetId;
                renderAllocation().then(html => {
                    const el = document.getElementById('allocation-view');
                    if (el) {
                        el.innerHTML = html;
                        setupAllocationHandlers();
                    }
                });
            }
            break;
    }
}

// Resource auto-update
function startResourceUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    let tickCount = 0;
    lastFetchTime = Date.now();
    
    updateInterval = setInterval(async () => {
        const now = Date.now();
        let shouldFetch = false;

        // 1. Default 10s fetch
        if (now >= lastFetchTime + 10000) {
            shouldFetch = true;
        } 
        // 2. Fetch 1s after an event is supposed to end
        else if (nextEarliestCompletion > 0 && now >= nextEarliestCompletion + 1000) {
            shouldFetch = true;
        }

        if (shouldFetch) {
            await loadGameState();
            lastFetchTime = Date.now();
            nextEarliestCompletion = findNextCompletion(gameState);
        } else if (gameState) {
            // Local resource interpolation (happens every second)
            gameState.planets.forEach(planet => {
                const timeDeltaHours = 1 / 3600; // 1 second in hours
                
                // Metal
                if (planet.resources.metal < planet.storage.metal) {
                    planet.resources.metal += planet.production.metal * timeDeltaHours;
                    if (planet.resources.metal > planet.storage.metal) planet.resources.metal = planet.storage.metal;
                }
                
                // Crystal
                if (planet.resources.crystal < planet.storage.crystal) {
                    planet.resources.crystal += planet.production.crystal * timeDeltaHours;
                    if (planet.resources.crystal > planet.storage.crystal) planet.resources.crystal = planet.storage.crystal;
                }
                
                // Deuterium
                if (planet.resources.deuterium < planet.storage.deuterium) {
                    planet.resources.deuterium += planet.production.deuterium * timeDeltaHours;
                    if (planet.resources.deuterium > planet.storage.deuterium) planet.resources.deuterium = planet.storage.deuterium;
                }

                // Water
                const waterStorage = planet.storage.water || 10000;
                const netWater = (planet.production.water || 0) - (planet.consumption?.water || 0);
                if (netWater > 0 && planet.resources.water < waterStorage) {
                    planet.resources.water += netWater * timeDeltaHours;
                    if (planet.resources.water > waterStorage) planet.resources.water = waterStorage;
                } else if (netWater < 0) {
                    planet.resources.water += netWater * timeDeltaHours;
                    if (planet.resources.water < 0) planet.resources.water = 0;
                }

                // Food
                const foodStorage = planet.storage.food || 10000;
                const netFood = (planet.production.food || 0) - (planet.consumption?.food || 0);
                if (netFood > 0 && planet.resources.food < foodStorage) {
                    planet.resources.food += netFood * timeDeltaHours;
                    if (planet.resources.food > foodStorage) planet.resources.food = foodStorage;
                } else if (netFood < 0) {
                    planet.resources.food += netFood * timeDeltaHours;
                    if (planet.resources.food < 0) planet.resources.food = 0;
                }

                // Population
                const prodMult = window.GAME_CONFIG?.gameSpeed?.resourceProduction || 1.0;
                planet.resources.population = calculatePopulationChange(
                    planet.resources.population || 0,
                    planet.maxPopulation || 0,
                    (planet.resources.food || 0) > 0,
                    (planet.resources.water || 0) > 0,
                    timeDeltaHours,
                    prodMult
                );
            });
            
            // Force UI update with interpolated values
            updateUI();
        }

        // Always update timers and movements for smooth UI
        updateTimers();
        updateFleetMovements(gameState);
        
        // Update messages count every 5 seconds (of ticks)
        tickCount++;
        if (tickCount % 5 === 0) {
            updateUnreadCount();
        }
    }, 1000); // Check every 1 second
}

// Global window functions for onclick handlers
window.selectPlanet = function(planetId) {
    if (!gameState) return;
    
    // Close any open modals when switching planets
    if (window.closeDetailsModal) window.closeDetailsModal();
    if (window.closeInputModal) window.closeInputModal();
    if (window.closeAllocationModal) window.closeAllocationModal();
    
    const planet = gameState.planets.find(p => p.id === planetId);
    if (planet) {
        currentPlanetId = planet.id;
        updateUrlParams(currentPlanetId, currentView);
        updateUI();
    }
};

window.upgradeBuilding = async function(buildingKey) {
    await buildingUpgrade(buildingKey, loadGameState);
};

window.switchBuildingVariant = async function(buildingKey, toCustom) {
    // switchBuildingVariant is imported from views/buildings.js
    const buildingsView = await import('./views/buildings.js');
    await buildingsView.switchBuildingVariant(buildingKey, toCustom, loadGameState);
};

window.selectCustomVariant = async function(buildingKey, focusLevels) {
    const planetId = getCurrentPlanetId();
    if (!planetId) return;
    
    try {
        const buildingsView = await import('./views/buildings.js');
        await API.selectCustomVariant(planetId, buildingKey, focusLevels);
        await buildingsView.closeCustomVariantModal();
        await loadGameState();
    } catch (error) {
        Notifications.showError('Error: ' + error.message);
    }
};

window.closeCustomVariantModal = async function() {
    const buildingsView = await import('./views/buildings.js');
    buildingsView.closeCustomVariantModal();
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

// Galaxy navigation functions
window.navigateGalaxySystem = async function(galaxy, system) {
    if (system < 1 || system > 499) return; // Limit systems 1-499
    
    // Update global state
    window.currentGalaxy = parseInt(galaxy, 10);
    window.currentSystem = parseInt(system, 10);
    
    // Delegate rendering to the galaxy view module
    const { updateGalaxyView } = await import('./views/galaxy.js');
    if (window.getGameState()) {
        await updateGalaxyView(window.getGameState());
    }
};

window.navigateToGalaxy = async function(value) {
    if (!value) return;
    const galaxy = parseInt(value, 10);
    const system = window.currentSystem || 1;
    await window.navigateGalaxySystem(galaxy, system);
};

window.navigateToSystem = async function(value) {
    if (!value) return;
    const system = parseInt(value, 10);
    const galaxy = window.currentGalaxy || 1;
    await window.navigateGalaxySystem(galaxy, system);
};

window.changeGalaxyValue = function(delta) {
    const input = document.getElementById('galaxy-input');
    if (!input) return;
    
    let value = parseInt(input.value, 10) || 1;
    value = Math.max(1, Math.min(10, value + delta));
    input.value = value;
    window.navigateToGalaxy(value);
};

window.changeSystemValue = function(delta) {
    const input = document.getElementById('system-input');
    if (!input) return;
    
    let value = parseInt(input.value, 10) || 1;
    value = Math.max(1, Math.min(499, value + delta));
    input.value = value;
    window.navigateToSystem(value);
};

window.selectPlanetFromGalaxy = function(position) {
    // Find the planet with this position in current galaxy/system
    if (!window.currentGameState) return;
    
    const galaxy = window.currentGalaxy;
    const system = window.currentSystem;
    
    const planet = window.currentGameState.planets.find(p => 
        p.coordinates[0] === galaxy && 
        p.coordinates[1] === system && 
        p.coordinates[2] === position
    );
    
    if (planet) {
        currentPlanetId = planet.id;
        switchView('overview');
        updateUI();
    }
};

// Export getCurrentPlanet for allocation view
export function getCurrentPlanet() {
    if (!gameState || !currentPlanetId) {
        return gameState?.planets?.[0] || null;
    }
    return gameState.planets.find(p => p.id === currentPlanetId) || gameState.planets[0] || null;
}

export function getCurrentPlanetId() {
    return currentPlanetId;
}

export function getGameState() {
    return gameState;
}

window.getGameState = getGameState;
window.getCurrentPlanetId = getCurrentPlanetId;
window.getCurrentPlanet = getCurrentPlanet;

// Global navigation helper
window.navigateToCoords = async function(galaxy, system, position) {
    // 1. Set current coordinates for galaxy view
    window.currentGalaxy = galaxy;
    window.currentSystem = system;
    
    // 2. Switch to galaxy view
    if (window.showView) {
        window.showView('galaxy');
    }
    
    // 3. Trigger navigation within galaxy view
    if (window.navigateGalaxySystem) {
        await window.navigateGalaxySystem(galaxy, system);
    }
};

// Start the app
init();
