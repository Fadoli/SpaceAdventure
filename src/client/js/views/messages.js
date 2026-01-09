import { API } from '../api.js';
import { formatDate, formatNumber, isEmpty } from '../utils.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';

let lastMessagesHash = null;
let currentFilter = 'all';

/**
 * Update messages view
 */
export async function updateMessagesView() {
    const container = document.querySelector('#messages-view .messages-container');
    if (!container) return;

    try {
        const messages = await API.getMessages();
        
        // 1. If container is empty or filter changed, do a full render
        const listEl = container.querySelector('.messages-list');
        if (!listEl || lastMessagesHash?.filter !== currentFilter) {
            renderMessagesList(container, messages);
            lastMessagesHash = { 
                hash: calculateHash(messages), 
                filter: currentFilter 
            };
            return;
        }

        // 2. Check if structure changed (new messages or deletions)
        const currentHash = calculateHash(messages);
        if (currentHash !== lastMessagesHash.hash) {
            // Full re-render for new/deleted items to keep order correct
            // But we'll try to preserve the "open" state IDs
            const openIds = Array.from(listEl.querySelectorAll('.message-item[data-open="true"]'))
                                .map(el => el.id.replace('msg-', ''));
            
            renderMessagesList(container, messages);
            
            // Restore open states
            openIds.forEach(id => {
                const body = document.getElementById(`msg-body-${id}`);
                const item = document.getElementById(`msg-${id}`);
                if (body && item) {
                    body.style.display = 'block';
                    item.setAttribute('data-open', 'true');
                }
            });
            
            lastMessagesHash = { hash: currentHash, filter: currentFilter };
        } else {
            // 3. Just update read/unread statuses of existing elements
            messages.forEach(msg => {
                const item = document.getElementById(`msg-${msg.id}`);
                if (item) {
                    const isUnread = !msg.read;
                    const hasUnreadClass = item.classList.contains('unread');
                    
                    if (isUnread !== hasUnreadClass) {
                        if (isUnread) item.classList.add('unread');
                        else item.classList.remove('unread');
                        
                        const icon = item.querySelector('.msg-status-icon');
                        if (icon) icon.textContent = isUnread ? '📧' : '📖';
                    }
                }
            });
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
        container.innerHTML = `<p class="error">Failed to load messages: ${error.message}</p>`;
    }
}

function calculateHash(messages) {
    return JSON.stringify(messages.map(m => m.id));
}

/**
 * Render list of messages
 */
function renderMessagesList(container, messages) {
    let filteredMessages = messages;
    if (currentFilter !== 'all') {
        filteredMessages = messages.filter(m => m.type === currentFilter);
    }

    let html = `
        <div class="messages-header">
            <h2>📬 Messages (${messages.length})</h2>
            <div class="message-filters">
                <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" onclick="window.filterMessages('all')">All</button>
                <button class="filter-btn ${currentFilter === 'espionage' ? 'active' : ''}" onclick="window.filterMessages('espionage')">Espionage</button>
                <button class="filter-btn ${currentFilter === 'colonization' ? 'active' : ''}" onclick="window.filterMessages('colonization')">Colonization</button>
                <button class="filter-btn ${currentFilter === 'expedition' ? 'active' : ''}" onclick="window.filterMessages('expedition')">Expedition</button>
            </div>
            <button class="btn btn-danger btn-small" onclick="window.clearAllMessages()">Clear All</button>
        </div>
        <div class="messages-list">
    `;

    if (!filteredMessages || filteredMessages.length === 0) {
        html += `<p class="empty-info">No ${currentFilter === 'all' ? '' : currentFilter} messages found.</p>`;
    } else {
        filteredMessages.forEach(msg => {
            const isUnread = !msg.read;
            const typeIcon = msg.type === 'espionage' ? '🕵️' : (msg.type === 'colonization' ? '🏗️' : '🚀');
            const statusIcon = isUnread ? '📧' : '📖';
            
            html += `
                <div id="msg-${msg.id}" class="message-item ${isUnread ? 'unread' : ''}" 
                     data-open="false">
                    <div class="message-header-row" onclick="window.toggleMessageBody('${msg.id}')">
                        <span class="msg-status-icon">${statusIcon}</span>
                        <span class="msg-type-icon">${typeIcon}</span>
                        <span class="msg-sender">${msg.from}</span>
                        <span class="msg-subject">${msg.subject}</span>
                        <span class="msg-date">${formatDate(msg.timestamp)}</span>
                        <button class="msg-delete-btn" onclick="window.deleteSingleMessage('${msg.id}', event)">✕</button>
                    </div>
                    <div id="msg-body-${msg.id}" class="message-body" style="display: none;" onclick="event.stopPropagation()">
                        <div class="msg-content">${msg.body}</div>
                        ${renderMessageData(msg)}
                    </div>
                </div>
            `;
        });
    }

    html += `
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Render specialized data based on message type
 */
function renderMessageData(msg) {
    if (!msg.data) return '';

    switch (msg.type) {
        case 'espionage':
            return renderEspionageData(msg.data);
        case 'colonization':
            const c = msg.data.coords || [1, 1, 1];
            return `
                <div class="msg-data-info">
                    Coordinates: 
                    <a href="#" class="galaxy-link" onclick="event.preventDefault(); event.stopPropagation(); window.navigateToCoords(${c[0]}, ${c[1]}, ${c[2]})">
                        [${c.join(':')}]
                    </a>
                </div>`;
        case 'expedition':
            let resHtml = '';
            const ec = msg.data.coords || [1, 1, 1];
            if (msg.data.resultType === 'resources') {
                resHtml = `<p>Surviving crew has rejoined the planetary population.</p>`;
            }
            return `
                <div class="msg-data-info">
                    Location: 
                    <a href="#" class="galaxy-link" onclick="event.preventDefault(); event.stopPropagation(); window.navigateToCoords(${ec[0]}, ${ec[1]}, ${ec[2]})">
                        Deep Space [${ec.join(':')}]
                    </a>
                    <br>${resHtml}
                </div>`;
        case 'attack':
            return renderCombatReport(msg.data);
        default:
            return '';
    }
}

function renderCombatReport(data) {
    let html = '<div class="combat-report">';
    
    const winnerClass = data.winner === 'attacker' ? (data.isAttacker ? 'winner' : 'loser') : 
                       (data.winner === 'defender' ? (data.isAttacker ? 'loser' : 'winner') : 'draw');
    
    html += `
        <div class="combat-header ${winnerClass}">
            <h3>Winner: ${data.winner.toUpperCase()}</h3>
            <p>Battle at [${data.targetCoords.join(':')}]</p>
        </div>
    `;

    // Loot section
    if (data.loot && (data.loot.metal > 0 || data.loot.crystal > 0 || data.loot.deuterium > 0)) {
        html += `
            <div class="report-section loot-section">
                <h4>Captured Resources</h4>
                <div class="res-grid-mini">
                    <div>⚙️ ${formatNumber(data.loot.metal)}</div>
                    <div>💎 ${formatNumber(data.loot.crystal)}</div>
                    <div>🛢️ ${formatNumber(data.loot.deuterium)}</div>
                </div>
            </div>
        `;
    }

    // Rounds summary
    html += `<div class="report-section"><h4>Battle Summary</h4>`;
    data.rounds.forEach(r => {
        html += `<div class="round-row">Round ${r.round}: Attacker shots: ${r.attackerShotCount}, Defender shots: ${r.defenderShotCount}</div>`;
    });
    html += `</div>`;

    // Losses
    html += `<div class="report-section losses-grid">
        <div class="loss-column">
            <h4>Attacker Losses</h4>
            <div class="data-list">`;
    if (isEmpty(data.attackerLosses)) {
        html += '<span>None</span>';
    } else {
        for (const k in data.attackerLosses) {
            html += `<span>${k.replace(/([A-Z])/g, ' $1').trim()}: ${data.attackerLosses[k]}</span>`;
        }
    }
    html += `</div></div>
        <div class="loss-column">
            <h4>Defender Losses</h4>
            <div class="data-list">`;
    
    const defLosses = data.defenderLosses || {};
    const allDefLosses = { ...(defLosses.ships || {}), ...(defLosses.defenses || {}) };
    
    if (isEmpty(allDefLosses)) {
        html += '<span>None</span>';
    } else {
        for (const k in allDefLosses) {
            html += `<span>${k.replace(/([A-Z])/g, ' $1').trim()}: ${allDefLosses[k]}</span>`;
        }
    }
    html += `</div></div></div>`;

    // Debris Field
    if (data.debris && (data.debris.metal > 0 || data.debris.crystal > 0)) {
        html += `
            <div class="report-section debris-section">
                <h4>Debris Field Generated</h4>
                <div class="res-grid-mini">
                    <div>⚙️ ${formatNumber(data.debris.metal)}</div>
                    <div>💎 ${formatNumber(data.debris.crystal)}</div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

function renderEspionageData(data) {
    let html = '<div class="espionage-report">';
    
    // Header stats
    html += `
        <div class="report-meta">
            <small>Your Tech: ${data.techLevel} | Enemy Tech: ${data.defenderTechLevel} | Probes: ${data.probeCount} | <strong>Power: ${data.power}</strong></small>
        </div>
    `;

    if (data.info) {
        html += `<p class="report-info"><em>${data.info}</em></p>`;
    }

    if (data.resources) {
        const c = data.coords || [1, 1, 1];
        html += `
            <div class="report-section">
                <h4>
                    Resources at 
                    <a href="#" class="galaxy-link" onclick="event.preventDefault(); event.stopPropagation(); window.navigateToCoords(${c[0]}, ${c[1]}, ${c[2]})">
                        [${c.join(':')}]
                    </a>
                </h4>
                <div class="res-grid-mini">
                    <div>⚙️ ${Math.floor(data.resources.metal).toLocaleString()}</div>
                    <div>💎 ${Math.floor(data.resources.crystal).toLocaleString()}</div>
                    <div>🛢️ ${Math.floor(data.resources.deuterium).toLocaleString()}</div>
                    <div>⚡ ${Math.floor(data.resources.energy).toLocaleString()}</div>
                    <div>👥 ${Math.floor(data.resources.population).toLocaleString()}</div>
                </div>
            </div>
        `;
    }

    if (data.ships && Object.keys(data.ships).length > 0) {
        html += `<div class="report-section"><h4>Ships</h4><div class="data-list">`;
        for (const s in data.ships) {
            if (data.ships[s] > 0) {
                const name = s.replace(/([A-Z])/g, ' $1').trim();
                html += `<span>${name}: ${data.ships[s]}</span>`;
            }
        }
        html += `</div></div>`;
    }

    if (data.defenses && Object.keys(data.defenses).length > 0) {
        html += `<div class="report-section"><h4>Defenses</h4><div class="data-list">`;
        for (const d in data.defenses) {
            if (data.defenses[d] > 0) {
                const name = d.replace(/([A-Z])/g, ' $1').trim();
                html += `<span>${name}: ${data.defenses[d]}</span>`;
            }
        }
        html += `</div></div>`;
    }

    if (data.buildings && Object.keys(data.buildings).length > 0) {
        html += `<div class="report-section"><h4>Buildings</h4><div class="data-list">`;
        for (const b in data.buildings) {
            if (data.buildings[b] > 0) {
                const name = b.replace(/([A-Z])/g, ' $1').trim();
                html += `<span>${name}: ${data.buildings[b]}</span>`;
            }
        }
        html += `</div></div>`;
    }

    if (data.research && Object.keys(data.research).length > 0) {
        html += `<div class="report-section"><h4>Research</h4><div class="data-list">`;
        for (const r in data.research) {
            const level = typeof data.research[r] === 'object' ? data.research[r].level : data.research[r];
            if (level > 0) {
                const name = r.replace(/([A-Z])/g, ' $1').trim();
                html += `<span>${name}: ${level}</span>`;
            }
        }
        html += `</div></div>`;
    }

    html += '</div>';
    return html;
}

// Window functions
window.filterMessages = function(filter) {
    currentFilter = filter;
    updateMessagesView();
};

window.toggleMessageBody = async function(id) {
    const body = document.getElementById(`msg-body-${id}`);
    const item = document.getElementById(`msg-${id}`);
    
    if (!body || !item) return;
    
    const isOpening = body.style.display === 'none';
    body.style.display = isOpening ? 'block' : 'none';
    item.setAttribute('data-open', isOpening ? 'true' : 'false');
    
    if (isUnread(item) && isOpening) {
        try {
            await API.markMessageRead(id);
            // Locally update UI without full re-render
            item.classList.remove('unread');
            const icon = item.querySelector('.msg-status-icon');
            if (icon) icon.textContent = '📖';
            
            // Update the hash so the next auto-refresh doesn't think it changed
            if (lastMessagesHash) {
                // This is a bit hacky but prevents the next background update from overwriting
                // our local change before the server data matches.
                // Alternatively, we could just wait for the next refresh.
            }
        } catch (error) {
            console.error('Failed to mark read:', error);
        }
    }
};

function isUnread(el) {
    return el && el.classList.contains('unread');
}

window.deleteSingleMessage = async function(id, event) {
    if (event) event.stopPropagation();
    const confirmed = await showConfirm('Delete Message', 'Delete this message?');
    if (!confirmed) return;
    
    try {
        await API.deleteMessage(id);
        lastMessagesHash = null; // Force re-render
        updateMessagesView();
    } catch (error) {
        Notifications.showError('Failed to delete: ' + error.message);
    }
};

window.clearAllMessages = async function() {
    const confirmed = await showConfirm('Clear All Messages', 'Delete ALL messages?');
    if (!confirmed) return;
    
    try {
        await API.clearMessages();
        lastMessagesHash = null; // Force re-render
        updateMessagesView();
    } catch (error) {
        Notifications.showError('Failed to clear: ' + error.message);
    }
};