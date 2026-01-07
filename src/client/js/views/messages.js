import { API } from '../api.js';
import { formatDate } from '../utils.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';

let lastMessagesHash = null;

/**
 * Update messages view
 */
export async function updateMessagesView() {
    const container = document.querySelector('#messages-view .messages-container');
    if (!container) return;

    try {
        const messages = await API.getMessages();
        
        // Simple hash to detect changes
        const currentHash = JSON.stringify(messages.map(m => ({ id: m.id, read: m.read })));
        if (currentHash === lastMessagesHash && container.innerHTML !== '') {
            return;
        }
        lastMessagesHash = currentHash;

        renderMessagesList(container, messages);
    } catch (error) {
        console.error('Failed to load messages:', error);
        container.innerHTML = `<p class="error">Failed to load messages: ${error.message}</p>`;
    }
}

/**
 * Render list of messages
 */
function renderMessagesList(container, messages) {
    if (!messages || messages.length === 0) {
        container.innerHTML = '<h2>📬 Messages</h2><p class="empty-info">Your inbox is empty.</p>';
        return;
    }

    let html = `
        <div class="messages-header">
            <h2>📬 Messages (${messages.length})</h2>
            <button class="btn btn-danger btn-small" onclick="window.clearAllMessages()">Clear All</button>
        </div>
        <div class="messages-list">
    `;

    messages.forEach(msg => {
        const isUnread = !msg.read;
        const typeClass = `msg-type-${msg.type || 'general'}`;
        
        html += `
            <div class="message-item ${isUnread ? 'unread' : ''} ${typeClass}" id="msg-${msg.id}">
                <div class="msg-header" onclick="window.toggleMessageBody('${msg.id}')">
                    <span class="msg-status-icon">${isUnread ? '✉️' : '📖'}</span>
                    <span class="msg-sender">${msg.from}</span>
                    <span class="msg-subject">${msg.subject}</span>
                    <span class="msg-date">${formatDate(msg.timestamp)}</span>
                    <button class="btn-delete-msg" onclick="window.deleteSingleMessage('${msg.id}', event)">✕</button>
                </div>
                <div class="msg-body" id="msg-body-${msg.id}" style="display: none;">
                    <div class="msg-text">${msg.body || ''}</div>
                    ${renderMessageData(msg)}
                </div>
            </div>
        `;
    });

    html += '</div>';
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
            return `<div class="msg-data-info">Coordinates: [${msg.data.coords.join(':')}]</div>`;
        case 'expedition':
            let resHtml = '';
            if (msg.data.resultType === 'resources') {
                resHtml = `<p>Surviving crew has rejoined the planetary population.</p>`;
            }
            return `<div class="msg-data-info">Location: Deep Space [${msg.data.coords.join(':')}]<br>${resHtml}</div>`;
        default:
            return '';
    }
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
        html += `
            <div class="report-section">
                <h4>Resources at [${data.coords.join(':')}]</h4>
                <div class="res-grid-mini">
                    <div>⚙️ ${Math.floor(data.resources.metal).toLocaleString()}</div>
                    <div>💎 ${Math.floor(data.resources.crystal).toLocaleString()}</div>
                    <div>🛢️ ${Math.floor(data.resources.deuterium).toLocaleString()}</div>
                    <div>⚡ ${Math.floor(data.resources.energy).toLocaleString()}</div>
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
window.toggleMessageBody = async function(id) {
    const body = document.getElementById(`msg-body-${id}`);
    const item = document.getElementById(`msg-${id}`);
    
    if (!body) return;
    
    const isOpening = body.style.display === 'none';
    body.style.display = isOpening ? 'block' : 'none';
    
    if (isUnread(item) && isOpening) {
        try {
            await API.markMessageRead(id);
            item.classList.remove('unread');
            const icon = item.querySelector('.msg-status-icon');
            if (icon) icon.textContent = '📖';
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
