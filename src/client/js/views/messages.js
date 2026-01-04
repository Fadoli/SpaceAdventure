import { API } from '../api.js';
import { formatDate } from '../utils.js';

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
        default:
            return '';
    }
}

function renderEspionageData(data) {
    let html = '<div class="espionage-report">';
    
    if (data.info) {
        html += `<p class="report-info">${data.info}</p>`;
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

    if (data.buildings && Object.keys(data.buildings).length > 0) {
        html += `<div class="report-section"><h4>Buildings</h4><div class="data-list">`;
        for (const b in data.buildings) {
            if (data.buildings[b] > 0) html += `<span>${b}: ${data.buildings[b]}</span>`;
        }
        html += `</div></div>`;
    }

    if (data.ships && Object.keys(data.ships).length > 0) {
        html += `<div class="report-section"><h4>Ships</h4><div class="data-list">`;
        for (const s in data.ships) {
            if (data.ships[s] > 0) html += `<span>${s}: ${data.ships[s]}</span>`;
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
    if (!confirm('Delete this message?')) return;
    
    try {
        await API.deleteMessage(id);
        lastMessagesHash = null; // Force re-render
        updateMessagesView();
    } catch (error) {
        alert('Failed to delete: ' + error.message);
    }
};

window.clearAllMessages = async function() {
    if (!confirm('Delete ALL messages?')) return;
    
    try {
        await API.clearMessages();
        lastMessagesHash = null; // Force re-render
        updateMessagesView();
    } catch (error) {
        alert('Failed to clear: ' + error.message);
    }
};
