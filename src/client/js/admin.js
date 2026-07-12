// Admin Dashboard Logic
import { API } from './api.js';
import { parseNumberShorthand, formatNumber } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Auth check - if fails, redirect to home
    try {
        const user = await API.getCurrentUser();
        if (!user || (user.username !== 'fadoli' && user.role !== 'admin')) {
            window.location.href = '/';
            return;
        }
    } catch (e) {
        window.location.href = '/login.html';
        return;
    }

    loadGhosts();

    // Event Listeners
    document.getElementById('refresh-ghosts-btn').addEventListener('click', loadGhosts);
    document.getElementById('refresh-events-btn').addEventListener('click', loadEvents);
    
    document.getElementById('spawn-ghosts-btn').addEventListener('click', async () => {
        if (!confirm('Force a spawn cycle? This will try to fill empty slots.')) return;
        const res = await fetch('/api/admin/ghosts/spawn', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('Spawn cycle executed successfully');
            loadGhosts();
        } else {
            alert('Error: ' + data.error);
        }
    });

    document.getElementById('clear-ghosts-btn').addEventListener('click', async () => {
        if (!confirm('EXTERMINATUS? This will wipe ALL ghost planets from the galaxy.')) return;
        const res = await fetch('/api/admin/ghosts/clear', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert(data.data.message);
            loadGhosts();
        } else {
            alert('Error: ' + data.error);
        }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await API.logout();
        window.location.href = '/login.html';
    });

    // Player Search
    document.getElementById('search-player-btn').addEventListener('click', searchPlayers);
    document.getElementById('player-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchPlayers();
    });

    // Tab Switching
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update buttons
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');

            if (tabId === 'events') loadEvents();
        });
    });
});

async function searchPlayers() {
    const input = document.getElementById('player-search-input');
    const results = document.getElementById('player-management-results');
    const query = input.value.trim();
    if (!query) return;

    results.innerHTML = '<p>Scanning neural networks...</p>';

    try {
        const res = await fetch(`/api/admin/players/search?q=${encodeURIComponent(query)}&t=${Date.now()}`);
        const data = await res.json();
        
        if (!data.success) {
            results.innerHTML = `<p class="error">Search failed: ${data.error}</p>`;
            return;
        }

        if (data.data.length === 0) {
            results.innerHTML = '<p>No matching biological signatures found.</p>';
            return;
        }

        console.log('DEBUG: RAW DATA FROM SERVER:', data.data);
        data.data.forEach(p => {
            console.log(`DEBUG: Player ${p.username} has ${p.planets?.length || 0} planets`);
            p.planets?.forEach(pl => {
                console.log(`DEBUG: Planet ${pl.name} [${pl.id}] data:`, {
                    resources: pl.resources,
                    buildings: pl.buildings,
                    ships: pl.ships,
                    defenses: pl.defenses
                });
            });
        });

        results.innerHTML = data.data.map(player => renderPlayerAdminCard(player)).join('');
    } catch (e) {
        results.innerHTML = `<p class="error">Connection lost: ${e.message}</p>`;
    }
}

function renderPlayerAdminCard(player) {
    const research = player.research || {};
    const planets = player.planets || [];
    
    return `
        <div class="ghost-card" style="margin-bottom: 40px; border-color: var(--accent-blue); width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--accent-blue); padding-bottom: 10px;">
                <h3 style="color: #fff; margin: 0; font-size: 1.4rem;">${player.username} <span style="font-size: 0.9rem; color: var(--text-secondary); margin-left: 10px;">[ID: ${player.userId}]</span></h3>
            </div>
            
            <div style="margin-bottom: 30px; background: rgba(56, 189, 248, 0.05); padding: 15px; border-radius: 4px;">
                <h4 style="color: var(--accent-blue); font-size: 0.85rem; margin-bottom: 15px; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 5px;">🧬 GLOBAL RESEARCH</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
                    ${renderResearchGrid(player.userId, research)}
                </div>
            </div>

            <div class="planet-assets-control">
                ${planets.map(planet => renderPlanetAdminControl(player.userId, planet)).join('')}
            </div>
        </div>
    `;
}

function renderPlanetAdminControl(userId, planet) {
    // Debug helper to find where data might be missing
    const resData = planet.resources || {};
    const buildData = planet.buildings || {};
    const shipData = planet.ships || {};
    const defData = planet.defenses || {};

    return `
        <div style="background: rgba(0,0,0,0.4); padding: 20px; border-radius: 4px; margin-bottom: 25px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center;">
                <strong style="color: var(--accent-yellow); font-size: 1.1rem;">🪐 ${planet.name} <span style="color: var(--text-secondary); font-size: 0.8rem; margin-left: 10px;">[${planet.coordinates.join(':')}]</span></strong>
                <span style="font-family: 'Share Tech Mono', monospace; font-size: 0.7rem; color: #64748b;">PLANET ID: ${planet.id}</span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Resources Section -->
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 4px;">
                    <h5 style="color: var(--accent-blue); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <span style="opacity: 0.7;">📦</span> Resources
                    </h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                        ${renderAssetInputs(userId, planet.id, 'resources', resData, ['metal', 'crystal', 'deuterium', 'water', 'food', 'population'])}
                    </div>
                </div>
                
                <!-- Buildings Section -->
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 4px;">
                    <h5 style="color: var(--accent-blue); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <span style="opacity: 0.7;">🏗️</span> Buildings
                    </h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                        ${renderAssetInputs(userId, planet.id, 'buildings', buildData, [
                            'metalMine', 'crystalMine', 'deuteriumSynthesizer', 'solarPlant', 'fusionReactor',
                            'roboticsFactory', 'shipyard', 'researchLab', 'naniteFactory', 'housing',
                            'waterExtractor', 'farm', 'metalStorage', 'crystalStorage', 'deuteriumTank'
                        ])}
                    </div>
                </div>
                
                <!-- Ships Section -->
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 4px;">
                    <h5 style="color: var(--accent-blue); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <span style="opacity: 0.7;">🚀</span> Ships
                    </h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                        ${renderAssetInputs(userId, planet.id, 'ships', shipData, [
                            'smallCargo', 'largeCargo', 'lightFighter', 'heavyFighter', 'cruiser', 
                            'battleship', 'destroyer', 'bomber', 'carrier', 'dreadnought', 
                            'colonyShip', 'recycler', 'espionageProbe'
                        ])}
                    </div>
                </div>

                <!-- Defenses Section -->
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 4px;">
                    <h5 style="color: var(--accent-blue); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <span style="opacity: 0.7;">🛡️</span> Defenses
                    </h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                        ${renderAssetInputs(userId, planet.id, 'defenses', defData, [
                            'rocketLauncher', 'laserCannon', 'particleBeam', 'ionCannon', 'gaussCannon', 'plasmaTurret', 'shield'
                        ])}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderResearchGrid(userId, research) {
    const techs = [
        'energyTech', 'computerTech', 'weaponsTech', 'shieldingTech', 'armorTech',
        'combustionDrive', 'impulseDrive', 'hyperspaceDrive', 'espionageTech', 'astrophysics',
        'housingTech', 'laserTech', 'ionTech', 'plasmaTech', 'resourceEfficiency', 'modularConstruction'
    ];
    
    return techs.map(tech => {
        const val = research[tech] || 0;
        return `
            <div style="display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.05);">
                <label style="font-size: 0.7rem; color: #94a3b8; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${tech}">${tech}</label>
                <input type="number" id="research-${userId}-${tech}" value="${val}" class="modal-input" style="width: 50px; height: 24px; font-size: 0.75rem; padding: 0 4px; text-align: center; border-color: rgba(56, 189, 248, 0.3);">
                <button class="btn btn-primary btn-small" style="padding: 0 4px; height: 24px; width: 35px; font-size: 0.65rem;" onclick="window.updateSingleResearch('${userId}', '${tech}')">SET</button>
            </div>
        `;
    }).join('');
}

function renderAssetInputs(userId, planetId, category, currentValues, keys) {
    return keys.map(key => {
        const val = currentValues ? (currentValues[key] || 0) : 0;
        const displayVal = typeof val === 'number' ? formatNumber(val) : (val || 0);
        
        return `
            <div style="display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.05);">
                <label style="font-size: 0.7rem; color: #94a3b8; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${key}">${key}</label>
                <input type="text" id="${category}-${userId}-${planetId}-${key}" value="${displayVal}" placeholder="${displayVal}" class="modal-input" style="width: 65px; height: 24px; font-size: 0.75rem; padding: 0 4px; text-align: center; border-color: rgba(255,255,255,0.1);">
                <button class="btn btn-primary btn-small" style="padding: 0 4px; height: 24px; width: 35px; font-size: 0.65rem;" onclick="window.updateSingleAsset('${userId}', '${planetId}', '${category}', '${key}')">SET</button>
            </div>
        `;
    }).join('');
}

window.updateSingleAsset = async function(userId, planetId, category, key) {
    const input = document.getElementById(`${category}-${userId}-${planetId}-${key}`);
    const rawValue = input.value.trim();
    if (!rawValue) return;

    const newValue = parseNumberShorthand(rawValue);

    const payload = { 
        planetId,
        mode: 'SET'
    };
    payload[category] = { [key]: newValue };

    try {
        const res = await fetch(`/api/admin/players/${userId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            const formatted = formatNumber(newValue);
            input.value = formatted;
            input.placeholder = formatted;
            // Visual feedback
            input.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
            setTimeout(() => input.style.backgroundColor = '', 1000);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (e) {
        alert('Request failed: ' + e.message);
    }
};

window.updateSingleResearch = async function(userId, techKey) {
    const input = document.getElementById(`research-${userId}-${techKey}`);
    const newValue = parseInt(input.value, 10);
    if (isNaN(newValue)) return;

    try {
        const res = await fetch(`/api/admin/players/${userId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                research: { [techKey]: newValue },
                mode: 'SET'
            })
        });
        const data = await res.json();
        if (data.success) {
            input.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
            setTimeout(() => input.style.backgroundColor = '', 1000);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (e) {
        alert('Request failed: ' + e.message);
    }
};

async function loadGhosts() {
    const list = document.getElementById('ghost-list');
    const countEl = document.getElementById('ghost-count');
    
    try {
        const res = await fetch('/api/admin/ghosts');
        const result = await res.json();
        
        if (!result.success) {
            list.innerHTML = `<p class="error">Unauthorized or Error: ${result.error}</p>`;
            return;
        }

        const ghosts = result.data.ghosts;
        const keys = Object.keys(ghosts);
        countEl.textContent = result.data.count;

        if (keys.length === 0) {
            list.innerHTML = '<p>The void is silent. No ghost planets detected.</p>';
            return;
        }

        // Sort by tier desc then coords
        keys.sort((a, b) => {
            if (ghosts[b].tier !== ghosts[a].tier) return ghosts[b].tier - ghosts[a].tier;
            return a.localeCompare(b);
        });

        list.innerHTML = keys.map(key => {
            const g = ghosts[key];
            const tierClass = g.tier === 8 ? 'tier-8' : '';
            return `
                <div class="ghost-card ${tierClass}">
                    <div class="ghost-tier ${tierClass}">T${g.tier}</div>
                    <h3 style="color: var(--accent-blue); margin-bottom: 5px;">[${key}]</h3>
                    <div style="font-weight: bold; margin-bottom: 10px;">${g.name}</div>
                    <div class="res-list">
                        M: ${formatNumber(g.resources.metal)}<br>
                        C: ${formatNumber(g.resources.crystal)}<br>
                        D: ${formatNumber(g.resources.deuterium)}
                    </div>
                    <div style="margin-top: 10px; font-size: 0.7rem; color: #64748b;">
                        SHIPS: ${Object.keys(g.ships || {}).length}<br>
                        DEFS: ${Object.keys(g.defenses || {}).length}
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        list.innerHTML = `<p class="error">Failed to fetch data: ${e.message}</p>`;
    }
}

async function loadEvents() {
    const container = document.getElementById('event-log-container');
    try {
        const res = await fetch('/api/admin/events?limit=50');
        const data = await res.json();
        
        if (!data.success) {
            container.innerHTML = `<p class="error">Failed to load events: ${data.error}</p>`;
            return;
        }

        if (data.data.length === 0) {
            container.innerHTML = '<p>The galaxy is surprisingly quiet.</p>';
            return;
        }

        container.innerHTML = data.data.map(event => {
            const time = new Date(event.timestamp).toLocaleTimeString();
            let color = '#94a3b8';
            if (event.type === 'COMBAT') color = 'var(--accent-red)';
            if (event.type === 'COLONY') color = 'var(--accent-blue)';
            if (event.type === 'BUILDING_COMPLETE' || event.type === 'RESEARCH_COMPLETE') color = 'var(--accent-yellow)';
            
            return `
                <div style="margin-bottom: 8px; border-left: 2px solid ${color}; padding-left: 10px;">
                    <span style="color: #64748b; font-size: 0.7rem;">[${time}]</span>
                    <strong style="color: ${color}; margin-right: 10px;">${event.type}</strong>
                    <span style="color: #e2e8f0;">${formatEventData(event)}</span>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<p class="error">Connection lost: ${e.message}</p>`;
    }
}

function formatEventData(event) {
    const { type, ...data } = event;
    delete data.timestamp;
    
    switch(type) {
        case 'COMBAT':
            return `Battle at [${data.coords.join(':')}] between ${data.attacker} and ${data.defender}. Result: ${data.winner}`;
        case 'COLONY':
            return `New colony established at [${data.coords.join(':')}] by ${data.username}`;
        case 'BUILDING_COMPLETE':
            return `${data.username} completed ${data.building} level ${data.level} on ${data.planetName}`;
        case 'RESEARCH_COMPLETE':
            return `${data.username} finished ${data.research} level ${data.level}`;
        case 'SPAWN_GHOST':
            return `Anomalous activity detected at [${data.coords.join(':')}] (Tier ${data.tier})`;
        default:
            return JSON.stringify(data);
    }
}
