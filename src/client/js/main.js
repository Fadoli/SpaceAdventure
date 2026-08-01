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
import { updateMessagesView, updateUnreadCount, syncNewMessage } from './views/messages.js';
import { updateAllianceView } from './views/alliance.js';
import { renderAllocation, setupAllocationHandlers } from './views/allocation.js';
import { updateFleetMovements } from './views/fleetMovements.js';
import { Notifications } from './notifications.js';
import { showConfirm } from './views/modals.js';
import { calculatePopulationChange } from '../../shared/formulas.js';
import { gameSocket } from './socket.js';
import { escapeHtml } from './utils.js';

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
    const params = new URLSearchParams(window.location.search);
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
    window.addEventListener('popstate', () => {
        if (!gameState) return;

        const { planetId, view } = getUrlParams();
        if (planetId && gameState.planets.some(planet => planet.id === planetId)) {
            currentPlanetId = planetId;
        } else {
            currentPlanetId = gameState.planets[0]?.id || null;
        }
        currentView = view;
        switchView(currentView, false);
        updateUI(true);
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
    
    // Connect to real-time event socket
    gameSocket.connect();
    
    // Refresh game state when important events happen on server
    let wsRefreshTimeout = null;
    gameSocket.addHandler((type, data) => {
        const fleetEvents = ['FLEET_ARRIVED', 'FLEET_RETURNED', 'FLEET_RECALLED', 'INCOMING_FLEET'];
        const structuralEvents = [
            'BUILDING_COMPLETE', 
            'RESEARCH_COMPLETE', 
            'PRODUCTION_COMPLETE', 
            'SHIPYARD_QUEUE_COMPLETE',
            'VARIANT_SWITCH_COMPLETE',
            'RESOURCES_UPDATED',
            'QUEUE_UPDATED'
        ];
        
        if (type === 'NEW_MESSAGE') {
            syncNewMessage(data?.message, data?.count);
            return;
        }

        const isFleetEvent = fleetEvents.includes(type);
        const isStructural = structuralEvents.includes(type);

        if (type === 'STATE_SYNC') {
            if (wsRefreshTimeout) {
                clearTimeout(wsRefreshTimeout);
                wsRefreshTimeout = null;
            }

            if (!gameState || !data?.state) {
                loadGameState();
                return;
            }

            const incomingVersion = Number(data.stateVersion) || 0;
            const currentVersion = Number(gameState.stateVersion) || 0;
            if (!data.force && incomingVersion <= currentVersion) return;

            gameState = { ...gameState, ...data.state, stateVersion: incomingVersion };
            setGameState(gameState);
            updateUI(false, true);
            return;
        }

        if (isFleetEvent || isStructural) {
            if (type === 'SHIPYARD_QUEUE_COMPLETE') {
                Notifications.showSuccess(`Shipyard production on ${data.planetName || 'planet'} complete!`);
            }

            // Debounce refresh to avoid 3x fetches on single action
            if (wsRefreshTimeout) clearTimeout(wsRefreshTimeout);
            wsRefreshTimeout = setTimeout(() => {
                wsRefreshTimeout = null;
                console.log(`[WS] Debounced refresh triggered by ${type} (structural=${isStructural})`);
                
                // For fleet events, we always want to refresh the global state 
                // but we only "force" a full re-render of sub-details if structural
                // or if we are currently looking at the fleet view.
                const force = isFleetEvent ? false : (isStructural || currentView === 'fleet');
                loadGameState(force); 
            }, 100);
        }
    });
    
    // Load game state first
    if (!await loadGameState()) {
        gameSocket.disconnect();
        Notifications.showError('Unable to load your game state. Please refresh and try again.');
        return;
    }
    
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
    // Use true to force a deep fetch of sub-details (queues, etc) on startup
    switchView(currentView, false, true);
    
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
        gameSocket.disconnect();
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

    // Submenu Navigation
    document.querySelectorAll('.nav-sub-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (e.target.dataset.subtab) {
                const subtab = e.target.dataset.subtab;
                if (currentView === 'research') {
                    const { switchTab } = await import('./views/research.js');
                    switchTab(subtab);
                }
            } else if (e.target.dataset.subview) {
                const subview = e.target.dataset.subview;
                if (currentView === 'overview') {
                    const { switchOverviewMode } = await import('./views/overview.js');
                    switchOverviewMode(subview);
                }
            }
        });
    });
}

function switchView(view, updateHistory = true, forceFetch = false) {
    currentView = view;

    if (view === 'galaxy' && gameState) {
        const planet = gameState.planets.find(p => p.id === currentPlanetId) || gameState.planets[0];
        if (planet) {
            [window.currentGalaxy, window.currentSystem] = planet.coordinates;
        }
    }
    
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

    // Handle Submenus
    const overviewSubmenu = document.getElementById('overview-submenu');
    if (overviewSubmenu) {
        overviewSubmenu.style.display = view === 'overview' ? 'flex' : 'none';
    }

    const researchSubmenu = document.getElementById('research-submenu');
    if (researchSubmenu) {
        researchSubmenu.style.display = view === 'research' ? 'flex' : 'none';
    }
    
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
        } else if (view === 'alliance') {
            updateAllianceView();
        } else if (view === 'ranking') {
            updateRankingView();
        } else {
            updateCurrentView(forceFetch);
        }
    }

    // Always update unread count on navigation
    updateUnreadCount();
}

// Game State Management
let lastFetchTime = 0;
let stateFetchPromise = null;

async function loadGameState(forceFetch = false) {
    if (stateFetchPromise) {
        const result = await stateFetchPromise;
        return forceFetch ? loadGameState() : result;
    }

    const fetchPromise = (async () => {
        const nextGameState = await API.getGameState();
        const currentVersion = Number(gameState?.stateVersion) || 0;
        const incomingVersion = Number(nextGameState?.stateVersion) || 0;
        if (incomingVersion >= currentVersion) {
            gameState = nextGameState;
            setGameState(gameState);
        }
        updateUI(forceFetch);
        return true;
    })().catch(error => {
        console.error('Failed to load game state:', error);
        return false;
    });

    stateFetchPromise = fetchPromise.finally(() => {
        stateFetchPromise = null;
    });
    return stateFetchPromise;
}

window.loadGameState = loadGameState;

function updateUI(forceFetch = false, stateOnly = false) {
    if (!gameState || !currentUser) return;
    
    // Update fleet movements
    updateFleetMovements(gameState);
    
    // Update player name
    const playerNameEl = document.getElementById('player-name');
    if (playerNameEl) {
        playerNameEl.textContent = currentUser.username;

        // Admin badge
        if ((currentUser.username === 'fadoli' || currentUser.role === 'admin') && !document.getElementById('admin-badge')) {
            const badge = document.createElement('a');
            badge.id = 'admin-badge';
            badge.href = '/src/client/admin.html';
            badge.className = 'admin-access-badge';
            badge.innerHTML = '🛠️';
            badge.title = 'Admin Dashboard';
            badge.style.marginLeft = '8px';
            badge.style.textDecoration = 'none';
            badge.style.filter = 'drop-shadow(0 0 5px var(--accent-blue))';
            playerNameEl.after(badge);
        }
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
                    `<option value="${p.id}" ${p.id === planet.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
                ).join('');
                planetSelectContainer.innerHTML = `<select class="header-planet-select" onchange="window.selectPlanet(this.value)">${options}</select>`;
            } else if (currentSelect.value !== planet.id) {
                currentSelect.value = planet.id;
            }
        }
        
        if (planetCoordsHeader) planetCoordsHeader.textContent = `[${planet.coordinates.join(':')}]`;
        
        // Update current view
        updateCurrentView(forceFetch, stateOnly);
    }
}

function updateCurrentView(forceFetch = false, stateOnly = false) {
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
            updateBuildingsView(planet, loadGameState, forceFetch);
            break;
        case 'research':
            // Update research buildings without full re-render
            updateResearchView(gameState, currentPlanetId, forceFetch);
            break;
        case 'shipyard':
            if (forceFetch || stateOnly) updateShipyardView(planet, 'ships', forceFetch, stateOnly);
            break;
        case 'defenses':
            if (forceFetch || stateOnly) updateShipyardView(planet, 'defenses', forceFetch, stateOnly);
            break;
        case 'fleet':
            if (gameState) updateFleetView(gameState);
            break;
        case 'galaxy':
            // Don't auto-update galaxy view during regular updates
            // Only render when user explicitly switches to this view
            break;
        case 'messages':
            // Don't auto-update messages view, handled by WebSocket or safety sync
            break;
        case 'alliance':
            updateAllianceView();
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

        // Safety sync every 60 seconds instead of 10s
        if (now >= lastFetchTime + 60000) {
            shouldFetch = true;
        } 

        if (shouldFetch) {
            await loadGameState(true); // force re-fetch sub-details
            lastFetchTime = Date.now();
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
        updateResearchTimers();
        updateFleetMovements(gameState);
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
        updateUI(true);
    }
};

window.recallFleet = async function(fleetId) {
    const confirmed = await showConfirm('Recall Fleet', 'Recall this fleet and send it back to its origin?');
    if (!confirmed) return;

    try {
        await API.recallFleet(fleetId);
        Notifications.showSuccess('Fleet recalled. It is returning to base.');
        await loadGameState(true);
    } catch (error) {
        Notifications.showError(error.message || 'Unable to recall fleet.');
    }
};

window.upgradeBuilding = async function(buildingKey) {
    await buildingUpgrade(buildingKey);
};

window.switchBuildingVariant = async function(buildingKey, toCustom) {
    // switchBuildingVariant is imported from views/buildings.js
    const buildingsView = await import('./views/buildings.js');
    await buildingsView.switchBuildingVariant(buildingKey, toCustom);
};

window.selectCustomVariant = async function(buildingKey, focusLevels) {
    const planetId = getCurrentPlanetId();
    if (!planetId) return;
    
    try {
        const buildingsView = await import('./views/buildings.js');
        await API.selectCustomVariant(planetId, buildingKey, focusLevels);
        await buildingsView.closeCustomVariantModal();
    } catch (error) {
        Notifications.showError('Error: ' + error.message);
    }
};

window.closeCustomVariantModal = async function() {
    const buildingsView = await import('./views/buildings.js');
    buildingsView.closeCustomVariantModal();
};

window.cancelBuilding = async function(queuePosition = 1) {
    await buildingCancel(queuePosition);
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
    const parsedGalaxy = Number(galaxy);
    const parsedSystem = Number(system);
    if (!Number.isInteger(parsedGalaxy) || parsedGalaxy < 1 || parsedGalaxy > 10 ||
        !Number.isInteger(parsedSystem) || parsedSystem < 1 || parsedSystem > 499) return;
    
    // Update global state
    window.currentGalaxy = parsedGalaxy;
    window.currentSystem = parsedSystem;
    
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
