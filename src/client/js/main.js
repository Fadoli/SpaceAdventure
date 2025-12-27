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
import { updateGalaxyView } from './views/galaxy.js';
import { renderAllocation, setupAllocationHandlers } from './views/allocation.js';

// State
let currentUser = null;
let gameState = null;
let currentView = 'overview';
let currentPlanetId = null;
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
    setupAuthListeners();
    setupGameListeners();
    
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
    
    // Now switch to the restored/default view
    // Use false to not push to history since we're just restoring state
    switchView(currentView, false);
    
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
            renderAllocation().then(html => {
                document.getElementById('allocation-view').innerHTML = html;
                setupAllocationHandlers();
            });
        } else if (view === 'galaxy') {
            // Render galaxy view when explicitly switched
            updateGalaxyView(gameState);
        } else if (view === 'research') {
            // Initialize research view when explicitly switched
            initializeResearch(currentPlanetId);
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
    
    // Get current planet by ID, or default to first planet
    let planet = null;
    if (currentPlanetId) {
        planet = gameState.planets.find(p => p.id === currentPlanetId);
    }
    if (!planet && gameState.planets.length > 0) {
        planet = gameState.planets[0];
        currentPlanetId = planet.id;
        // Don't update URL here - it would overwrite URL params during page load
    }
    
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
            updateOverview(planet);
            break;
        case 'buildings':
            updateBuildingsView(planet, loadGameState);
            break;
        case 'research':
            // Update research timers without full re-render
            updateTimers();
            updateResearchTimers();
            break;
        case 'shipyard':
            updateShipyardView(planet);
            break;
        case 'fleet':
            updateFleetView(gameState);
            break;
        case 'galaxy':
            // Don't auto-update galaxy view during regular updates
            // Only render when user explicitly switches to this view
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

// Galaxy navigation functions
window.navigateGalaxySystem = async function(galaxy, system) {
    if (system < 1 || system > 499) return; // Limit systems 1-499
    
    const container = document.getElementById('galaxy-view');
    
    try {
        const galaxyData = await API.getGalaxyView(galaxy, system);
        
        // Import and use the render function
        const { default: renderFunc } = await import('./views/galaxy.js');
        
        // Directly render the loaded galaxy data
        const { renderOGameGalaxyTable } = await import('./views/galaxy.js');
        
        // We need to call the render function - let's use a different approach
        // Create a temporary module to get access to the render function
        container.innerHTML = renderGalaxyTableHTML(galaxyData, window.currentGameState, galaxy, system);
        
        // Store current coordinates
        window.currentGalaxy = galaxy;
        window.currentSystem = system;
    } catch (error) {
        console.error('Failed to load system:', error);
        container.innerHTML = `<p class="error">Failed to load system: ${error.message}</p>`;
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

window.selectPlanetFromGalaxy = function(playerUsername) {
    // Find the planet with this username in current game state
    if (!window.currentGameState) return;
    
    const planet = window.currentGameState.planets.find(p => p.name === playerUsername || p.id === playerUsername);
    if (planet) {
        currentPlanetId = planet.id;
        switchView('overview');
        updateUI();
    }
};

window.spyOnPlanetFromGalaxy = function(position) {
    console.log('Spy on planet at position:', position);
    // TODO: Implement espionage view
};

window.attackPlanetFromGalaxy = function(position) {
    console.log('Attack planet at position:', position);
    // TODO: Implement attack/fleet management
};

// Helper function to render galaxy table HTML
function renderGalaxyTableHTML(galaxyData, gameState, galaxy, system) {
    const { planets } = galaxyData;
    
    // Create a map of planets by position
    const planetMap = new Map();
    planets.forEach(p => planetMap.set(p.position, p));
    
    // Create a set of player planet positions
    const playerPlanetPositions = new Set();
    if (gameState?.planets) {
        gameState.planets.forEach(planet => {
            const [pGalaxy, pSystem, pPosition] = planet.coordinates;
            if (pGalaxy === galaxy && pSystem === system) {
                playerPlanetPositions.add(pPosition);
            }
        });
    }
    
    let html = `
        <div class="ogame-galaxy-view">
            <div class="galaxy-controls">
                <div class="nav-section">
                    <button class="nav-btn" onclick="window.navigateGalaxySystem(${galaxy}, ${system - 1})" ${system === 1 ? 'disabled' : ''}>← Previous Sector</button>
                    <span class="current-coords">Galaxy ${galaxy} : System ${system}</span>
                    <button class="nav-btn" onclick="window.navigateGalaxySystem(${galaxy}, ${system + 1})">Next Sector →</button>
                </div>
                
                <div class="quick-travel">
                    <div class="travel-input-group">
                        <label>Galaxy:</label>
                        <button class="travel-btn-decrease" onclick="window.changeGalaxyValue(-1)" title="Decrease galaxy">−</button>
                        <input type="number" id="galaxy-input" class="travel-input-field" min="1" max="10" value="${galaxy}" 
                               onchange="window.navigateToGalaxy(this.value)" onkeypress="if(event.key==='Enter') window.navigateToGalaxy(this.value)">
                        <button class="travel-btn-increase" onclick="window.changeGalaxyValue(1)" title="Increase galaxy">+</button>
                    </div>
                    <div class="travel-input-group">
                        <label>System:</label>
                        <button class="travel-btn-decrease" onclick="window.changeSystemValue(-1)" title="Decrease system">−</button>
                        <input type="number" id="system-input" class="travel-input-field" min="1" max="499" value="${system}"
                               onchange="window.navigateToSystem(this.value)" onkeypress="if(event.key==='Enter') window.navigateToSystem(this.value)">
                        <button class="travel-btn-increase" onclick="window.changeSystemValue(1)" title="Increase system">+</button>
                    </div>
                </div>
            </div>
            
            <div class="ogame-table-wrapper">
                <table class="ogame-system-table">
                    <thead>
                        <tr>
                            <th class="pos-col">Pos</th>
                            <th class="planet-col">Planet</th>
                            <th class="player-col">Player</th>
                            <th class="status-col">Status</th>
                            <th class="action-col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    for (let position = 1; position <= 15; position++) {
        const planet = planetMap.get(position);
        const isPlayerPlanet = playerPlanetPositions.has(position);
        
        if (planet) {
            const moonBadge = planet.moon ? '<span class="moon-badge">🌙</span>' : '';
            const playerIcon = planet.playerType === 'player' ? '👨‍💼' : '🤖';
            const rowClass = isPlayerPlanet ? 'my-planet-row' : '';
            const planetTypeClass = planet.playerType === 'player' ? 'player-planet-row' : 'ai-planet-row';
            
            html += `
                <tr class="planet-row ${rowClass} ${planetTypeClass}">
                    <td class="pos-col"><strong>${position}</strong></td>
                    <td class="planet-col">
                        <div class="planet-name-cell">
                            <div class="planet-icon-mini">🌍</div>
                            <div class="planet-details">
                                <div class="planet-name">${planet.planetName}</div>
                                <div class="planet-activity">Last: ${planet.activity}</div>
                            </div>
                            ${moonBadge}
                        </div>
                    </td>
                    <td class="player-col">
                        <div class="player-info">
                            ${playerIcon}
                            <span>${planet.player}</span>
                        </div>
                    </td>
                    <td class="status-col">
                        <span class="status-badge ${isPlayerPlanet ? 'status-own' : 'status-other'}">
                            ${isPlayerPlanet ? '🏠 Own' : '👾 Other'}
                        </span>
                    </td>
                    <td class="action-col">
                        <div class="action-buttons">
                            ${isPlayerPlanet ? `
                                <button class="action-btn view-btn" onclick="window.selectPlanetFromGalaxy('${planet.player}')" title="View planet">👁️</button>
                            ` : `
                                <button class="action-btn info-btn" onclick="window.spyOnPlanetFromGalaxy(${position})" title="Spy">🕵️</button>
                                <button class="action-btn attack-btn" onclick="window.attackPlanetFromGalaxy(${position})" title="Attack">⚔️</button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        } else {
            html += `
                <tr class="empty-row">
                    <td class="pos-col"><strong>${position}</strong></td>
                    <td class="planet-col empty-cell">-</td>
                    <td class="player-col empty-cell">-</td>
                    <td class="status-col empty-cell">-</td>
                    <td class="action-col empty-cell">-</td>
                </tr>
            `;
        }
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    return html;
}

// Export getCurrentPlanet for allocation view
export function getCurrentPlanet() {
    if (!gameState || !currentPlanetId) {
        return gameState?.planets?.[0] || null;
    }
    return gameState.planets.find(p => p.id === currentPlanetId) || gameState.planets[0] || null;
}

// Start the app
init();
