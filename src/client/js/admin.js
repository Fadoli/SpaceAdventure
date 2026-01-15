// Admin Dashboard Logic
import { API } from './api.js';

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
});

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

function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
}
