// Admin Dashboard Logic
import { API } from './api.js';
import { parseNumberShorthand } from './utils.js';

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
        const res = await fetch(`/api/admin/players/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (!data.success) {
            results.innerHTML = `<p class="error">Search failed: ${data.error}</p>`;
            return;
        }

        if (data.data.length === 0) {
            results.innerHTML = '<p>No matching biological signatures found.</p>';
            return;
        }

        results.innerHTML = data.data.map(player => renderPlayerAdminCard(player)).join('');
    } catch (e) {
        results.innerHTML = `<p class="error">Connection lost: ${e.message}</p>`;
    }
}

function renderPlayerAdminCard(player) {
    return `
        <div class="ghost-card" style="margin-bottom: 20px; border-color: var(--accent-blue);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div>
                    <h3 style="color: #fff; margin: 0;">${player.username}</h3>
                    <small style="color: var(--text-secondary); font-family: 'Share Tech Mono', monospace;">ID: ${player.userId}</small>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 5px; border-radius: 2px;">
                     <strong style="color: var(--accent-blue); font-size: 0.7rem;">GLOBAL RESEARCH</strong>
                     <div style="display: flex; gap: 5px; margin-top: 5px;">
                        <select id="research-${player.userId}" class="modal-input" style="width: 150px; font-size: 0.7rem; height: 28px; padding: 2px;">
                            <option value="energyTech">Energy Tech</option>
                            <option value="computerTech">Computer Tech</option>
                            <option value="weaponsTech">Weapons Tech</option>
                            <option value="shieldingTech">Shielding Tech</option>
                            <option value="armorTech">Armor Tech</option>
                            <option value="combustionDrive">Combustion Drive</option>
                            <option value="impulseDrive">Impulse Drive</option>
                            <option value="hyperspaceDrive">Hyperspace Drive</option>
                            <option value="espionageTech">Espionage Tech</option>
                            <option value="astrophysics">Astrophysics</option>
                            <option value="housingTech">Housing Tech</option>
                            <option value="laserTech">Laser Tech</option>
                            <option value="ionTech">Ion Tech</option>
                            <option value="plasmaTech">Plasma Tech</option>
                            <option value="resourceEfficiency">Resource Efficiency</option>
                            <option value="modularConstruction">Modular Construction</option>
                        </select>
                        <input type="text" id="research-val-${player.userId}" class="modal-input" placeholder="Lvl +/-" style="width: 60px; height: 28px; font-size: 0.7rem;">
                        <button class="btn btn-primary btn-small" style="padding: 0 8px; height: 28px;" onclick="window.modifyResearch('${player.userId}')">SET</button>
                     </div>
                </div>
            </div>
            
            <div class="planet-assets-control">
                ${player.planets.map(planet => `
                    <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 2px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <strong style="color: var(--accent-yellow); font-size: 0.8rem;">🪐 ${planet.name} [${planet.coordinates.join(':')}]</strong>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="admin-control-group">
                                <select id="type-${player.userId}-${planet.id}" class="modal-input" style="width: 100%; font-size: 0.7rem; height: 28px; padding: 2px;">
                                    <optgroup label="RESOURCES">
                                        <option value="res-metal">Metal</option>
                                        <option value="res-crystal">Crystal</option>
                                        <option value="res-deuterium">Deuterium</option>
                                        <option value="res-water">Water</option>
                                        <option value="res-food">Food</option>
                                    </optgroup>
                                    <optgroup label="BUILDINGS">
                                        <option value="build-metalMine">Metal Mine</option>
                                        <option value="build-crystalMine">Crystal Mine</option>
                                        <option value="build-deuteriumSynthesizer">Deuterium Synth</option>
                                        <option value="build-solarPlant">Solar Plant</option>
                                        <option value="build-fusionReactor">Fusion Reactor</option>
                                        <option value="build-roboticsFactory">Robotics Factory</option>
                                        <option value="build-shipyard">Shipyard</option>
                                        <option value="build-researchLab">Research Lab</option>
                                        <option value="build-naniteFactory">Nanite Factory</option>
                                        <option value="build-housing">Housing</option>
                                    </optgroup>
                                    <optgroup label="MILITARY SHIPS">
                                        <option value="ship-lightFighter">Light Fighter</option>
                                        <option value="ship-heavyFighter">Heavy Fighter</option>
                                        <option value="ship-cruiser">Cruiser</option>
                                        <option value="ship-battleship">Battleship</option>
                                        <option value="ship-destroyer">Destroyer</option>
                                        <option value="ship-bomber">Bomber</option>
                                        <option value="ship-carrier">Carrier</option>
                                        <option value="ship-dreadnought">Dreadnought</option>
                                    </optgroup>
                                    <optgroup label="CIVILIAN SHIPS">
                                        <option value="ship-smallCargo">Small Cargo</option>
                                        <option value="ship-largeCargo">Large Cargo</option>
                                        <option value="ship-colonyShip">Colony Ship</option>
                                        <option value="ship-recycler">Recycler</option>
                                        <option value="ship-espionageProbe">Espionage Probe</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <input type="text" id="val-${player.userId}-${planet.id}" class="modal-input" placeholder="Qty (e.g. 5m)" style="width: 100px; height: 28px; font-size: 0.7rem;">
                                <button class="btn btn-primary btn-small" style="padding: 0 8px; height: 28px;" onclick="window.modifyAssets('${player.userId}', '${planet.id}')">ADD</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.modifyResearch = async function(userId) {
    const typeSelect = document.getElementById(`research-${userId}`);
    const valInput = document.getElementById(`research-val-${userId}`);
    const techKey = typeSelect.value;
    const value = parseInt(valInput.value, 10);

    if (isNaN(value)) return;

    try {
        const res = await fetch(`/api/admin/players/${userId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ research: { [techKey]: value } })
        });
        const data = await res.json();
        if (data.success) {
            alert('Research levels adjusted successfully');
            valInput.value = '';
        } else {
            alert('Error: ' + data.error);
        }
    } catch (e) {
        alert('Request failed: ' + e.message);
    }
}

window.modifyAssets = async function(userId, planetId) {
    const typeSelect = document.getElementById(`type-${userId}-${planetId}`);
    const valInput = document.getElementById(`val-${userId}-${planetId}`);
    const rawType = typeSelect.value;
    const value = parseNumberShorthand(valInput.value);

    if (value === 0) return;

    const payload = { planetId };
    if (rawType.startsWith('res-')) {
        payload.resources = { [rawType.replace('res-', '')]: value };
    } else if (rawType.startsWith('ship-')) {
        payload.ships = { [rawType.replace('ship-', '')]: value };
    } else if (rawType.startsWith('build-')) {
        payload.buildings = { [rawType.replace('build-', '')]: value };
    }

    try {
        const res = await fetch(`/api/admin/players/${userId}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert('Assets adjusted successfully');
            valInput.value = '';
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
            if (event.type === 'BUILDING' || event.type === 'RESEARCH') color = 'var(--accent-yellow)';
            
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

function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
}