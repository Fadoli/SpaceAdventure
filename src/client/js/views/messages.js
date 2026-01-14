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

    const unreadCount = messages.filter(m => !m.read).length;

    let html = `
        <div class="messages-header-control">
            <div class="msg-title-area">
                <h2>COMMUNICATION LOGS</h2>
                <span class="msg-stats-tag">${unreadCount} NEW / ${messages.length} TOTAL</span>
            </div>
            <div class="msg-filter-bar">
                <div class="filter-group">
                    ${['all', 'espionage', 'attack', 'harvest', 'colonization', 'expedition'].map(f => `
                        <button class="msg-filter-btn ${currentFilter === f ? 'active' : ''}" onclick="window.filterMessages('${f}')">
                            ${f.toUpperCase()}
                        </button>
                    `).join('')}
                </div>
                <button class="v-action-btn delete" onclick="window.clearAllMessages()">PURGE ALL</button>
            </div>
        </div>
        <div class="messages-list">
    `;

    if (!filteredMessages || filteredMessages.length === 0) {
        html += `<div class="empty-log-message">> NO ${currentFilter === 'all' ? '' : currentFilter.toUpperCase()} ENTRIES FOUND IN DATABASE</div>`;
    } else {
        filteredMessages.forEach(msg => {
            const isUnread = !msg.read;
            const typeLabel = msg.type.toUpperCase();
            
            html += `
                <div id="msg-${msg.id}" class="msg-entry ${isUnread ? 'unread' : ''}" data-open="false">
                    <div class="msg-entry-header" onclick="window.toggleMessageBody('${msg.id}')">
                        <div class="msg-main-info">
                            <span class="msg-status-tag">${isUnread ? 'NEW' : 'READ'}</span>
                            <span class="msg-type-tag">${typeLabel}</span>
                            <span class="msg-subject">${msg.subject}</span>
                        </div>
                        <div class="msg-meta-info">
                            <span class="msg-sender">FROM: ${msg.from.toUpperCase()}</span>
                            <span class="msg-date">${formatDate(msg.timestamp)}</span>
                            <button class="msg-delete-icon" onclick="window.deleteSingleMessage('${msg.id}', event)">✕</button>
                        </div>
                    </div>
                    <div id="msg-body-${msg.id}" class="msg-entry-body" style="display: none;" onclick="event.stopPropagation()">
                        <div class="msg-content-text">${linkifyCoords(msg.body)}</div>
                        ${renderMessageData(msg)}
                        
                        ${(msg.type === 'attack' || msg.type === 'espionage') ? `
                            <div class="msg-actions-footer" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end;">
                                <button class="btn btn-primary btn-small" onclick="window.shareMessageToAllianceUI('${msg.id}')">📡 SHARE TO ALLIANCE</button>
                            </div>
                        ` : ''}
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

window.shareMessageToAllianceUI = async function(messageId) {
    const state = window.getGameState();
    if (!state?.allianceId) {
        Notifications.showError('You must be in an alliance to share reports.');
        return;
    }

    const confirmed = await showConfirm('Share Report', 'Broadcast this report to your alliance comm-link?');
    if (!confirmed) return;

    try {
        await API.shareReportToAlliance(messageId);
        Notifications.showSuccess('Report transmitted to alliance channel.');
    } catch (error) {
        Notifications.showError('Transmission failed: ' + error.message);
    }
};

/**
 * Replace [G:S:P] coordinates with clickable galaxy links
 */
function linkifyCoords(text) {
    if (!text) return '';
    // Match [G:S:P] or G:S:P where G,S,P are numbers
    return text.replace(/\[?(\d+):(\d+):(\d+)\]?/g, (match, g, s, p) => {
        return `<a href="#" class="galaxy-link" onclick="event.preventDefault(); event.stopPropagation(); window.navigateToCoords(${g}, ${s}, ${p})">[${g}:${s}:${p}]</a>`;
    });
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
                <div class="msg-technical-data">
                    <div class="data-row">
                        <span class="data-label">ESTABLISHED COORDINATES:</span>
                        <span class="data-val">${linkifyCoords(`[${c.join(':')}]`)}</span>
                    </div>
                </div>`;
        case 'expedition':
            let resHtml = '';
            const ec = msg.data.coords || [1, 1, 1];
            if (msg.data.resultType === 'resources') {
                resHtml = `<div class="data-row"><span class="data-label">CREW STATUS:</span><span class="data-val">REJOINED POPULATION</span></div>`;
            }
            return `
                <div class="msg-technical-data">
                    <div class="data-row">
                        <span class="data-label">SECTOR LOCATION:</span>
                        <span class="data-val">DEEP SPACE ${linkifyCoords(`[${ec.join(':')}]`)}</span>
                    </div>
                    ${resHtml}
                </div>`;
        case 'attack':
            return renderCombatReport(msg.data);
        case 'harvest':
            const h = msg.data.resources || {};
            return `
                <div class="msg-technical-data">
                    <div class="v-readout-header">RECOVERED MATERIALS</div>
                    <div class="bt-readout">
                        <div class="bt-row"><span class="bt-label">METAL</span><span class="bt-value archived">${formatNumber(h.metal || 0)}</span></div>
                        <div class="bt-row"><span class="bt-label">CRYSTAL</span><span class="bt-value archived">${formatNumber(h.crystal || 0)}</span></div>
                    </div>
                </div>`;
        default:
            return '';
    }
}

export function renderCombatReport(data) {
    if (!data) return '';
    const winnerClass = data.winner === 'attacker' ? (data.isAttacker ? 'winner' : 'loser') : 
                       (data.winner === 'defender' ? (data.isAttacker ? 'loser' : 'winner') : 'draw');
    
    const coordsStr = data.targetCoords ? `[${data.targetCoords.join(':')}]` : 'UNKNOWN SECTOR';
    
    let html = `
        <div class="technical-report combat ${winnerClass}">
            <div class="report-header">
                <span class="report-title">COMBAT ENGAGEMENT REPORT</span>
                <span class="report-result ${winnerClass}">RESULT: ${data.winner.toUpperCase()} VICTORIOUS</span>
            </div>
            
            <div class="report-meta">SECTOR: ${linkifyCoords(coordsStr)}</div>
    `;

    // Loot section
    if (data.loot && (data.loot.metal > 0 || data.loot.crystal > 0 || data.loot.deuterium > 0)) {
        html += `
            <div class="report-block">
                <div class="v-readout-header">CAPTURED SHIPMENTS</div>
                <div class="bt-readout">
                    <div class="bt-row"><span class="bt-label">METAL</span><span class="bt-value archived">${formatNumber(data.loot.metal)}</span></div>
                    <div class="bt-row"><span class="bt-label">CRYSTAL</span><span class="bt-value archived">${formatNumber(data.loot.crystal)}</span></div>
                    <div class="bt-row"><span class="bt-label">DEUTERIUM</span><span class="bt-value archived">${formatNumber(data.loot.deuterium)}</span></div>
                </div>
            </div>
        `;
    }

    // Rounds summary
    html += `
        <div class="report-block">
            <div class="v-readout-header">ENGAGEMENT LOG</div>
            <div class="bt-readout">
                ${data.rounds.map(r => `
                    <div class="bt-row">
                        <span class="bt-label">ROUND ${r.round}</span>
                        <span class="bt-value">A: ${r.attackerShotCount} shots / D: ${r.defenderShotCount} shots</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Losses
    html += `
        <div class="report-block losses-readout">
            <div class="loss-col">
                <div class="v-readout-header">ATTACKER LOSSES</div>
                <div class="bt-readout">
                    ${isEmpty(data.attackerLosses) ? '<div class="bt-row"><span class="bt-label">NONE</span></div>' : 
                        Object.entries(data.attackerLosses).map(([k, v]) => `
                            <div class="bt-row"><span class="bt-label">${k.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</span><span class="bt-value unstable">-${v}</span></div>
                        `).join('')}
                </div>
            </div>
            <div class="loss-col">
                <div class="v-readout-header">DEFENDER LOSSES</div>
                <div class="bt-readout">
                    ${(() => {
                        const defLosses = data.defenderLosses || {};
                        const allDefLosses = { ...(defLosses.ships || {}), ...(defLosses.defenses || {}) };
                        return isEmpty(allDefLosses) ? '<div class="bt-row"><span class="bt-label">NONE</span></div>' : 
                            Object.entries(allDefLosses).map(([k, v]) => `
                                <div class="bt-row"><span class="bt-label">${k.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</span><span class="bt-value unstable">-${v}</span></div>
                            `).join('');
                    })()}
                </div>
            </div>
        </div>
    `;

    // Debris Field
    if (data.debris && (data.debris.metal > 0 || data.debris.crystal > 0)) {
        html += `
            <div class="report-block">
                <div class="v-readout-header">DEBRIS FIELD SIGNATURE</div>
                <div class="bt-readout">
                    <div class="bt-row"><span class="bt-label">METAL RECOVERABLE</span><span class="bt-value archived">${formatNumber(data.debris.metal)}</span></div>
                    <div class="bt-row"><span class="bt-label">CRYSTAL RECOVERABLE</span><span class="bt-value archived">${formatNumber(data.debris.crystal)}</span></div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

export function renderEspionageData(data) {
    const c = data.coords || [1, 1, 1];
    let html = `
        <div class="technical-report espionage">
            <div class="report-header">
                <span class="report-title">INTELLIGENCE SCAN REPORT</span>
                <span class="report-meta">COORD: ${linkifyCoords(`[${c.join(':')}]`)}</span>
            </div>
            
            <div class="report-block">
                <div class="bt-readout mini">
                    <div class="bt-row"><span class="bt-label">SCAN POWER:</span><span class="bt-value archived">${data.power}</span></div>
                    <div class="bt-row"><span class="bt-label">YOUR TECH:</span><span class="bt-value">${data.techLevel}</span></div>
                    <div class="bt-row"><span class="bt-label">DEFENDER TECH:</span><span class="bt-value">${data.defenderTechLevel}</span></div>
                </div>
            </div>
    `;

    if (data.info) {
        html += `<div class="report-info-text">> ${data.info.toUpperCase()}</div>`;
    }

    if (data.resources) {
        html += `
            <div class="report-block">
                <div class="v-readout-header">SENSORS DETECTED RESOURCES</div>
                <div class="bt-readout">
                    <div class="bt-row"><span class="bt-label">METAL</span><span class="bt-value">${Math.floor(data.resources.metal).toLocaleString()}</span></div>
                    <div class="bt-row"><span class="bt-label">CRYSTAL</span><span class="bt-value">${Math.floor(data.resources.crystal).toLocaleString()}</span></div>
                    <div class="bt-row"><span class="bt-label">DEUTERIUM</span><span class="bt-value">${Math.floor(data.resources.deuterium).toLocaleString()}</span></div>
                    <div class="bt-row"><span class="bt-label">ENERGY POTENTIAL</span><span class="bt-value">${Math.floor(data.resources.energy).toLocaleString()}</span></div>
                    <div class="bt-row"><span class="bt-label">POPULATION DENSITY</span><span class="bt-value">${Math.floor(data.resources.population).toLocaleString()}</span></div>
                </div>
            </div>
        `;
    }

    const sections = [
        { label: 'SHIP SIGNATURES', data: data.ships },
        { label: 'DEFENSIVE STRUCTURES', data: data.defenses },
        { label: 'FACILITY READOUT', data: data.buildings },
        { label: 'RESEARCH DATABASE', data: data.research }
    ];

    sections.forEach(section => {
        if (section.data && Object.keys(section.data).length > 0) {
            const entries = Object.entries(section.data).filter(([_, v]) => (typeof v === 'object' ? v.level : v) > 0);
            if (entries.length > 0) {
                html += `
                    <div class="report-block">
                        <div class="v-readout-header">${section.label}</div>
                        <div class="bt-readout">
                            ${entries.map(([k, v]) => `
                                <div class="bt-row">
                                    <span class="bt-label">${k.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</span>
                                    <span class="bt-value archived">${typeof v === 'object' ? v.level : v}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
    });

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
            
            // Update the badge
            updateUnreadCount();
            
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
        updateUnreadCount();
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
        updateUnreadCount();
    } catch (error) {
        Notifications.showError('Failed to clear: ' + error.message);
    }
};

/**
 * Update the unread message count badge
 */
export async function updateUnreadCount() {
    try {
        const messages = await API.getMessages();
        const unreadCount = messages.filter(m => !m.read).length;
        
        const navBtn = document.querySelector('.nav-btn[data-view="messages"]');
        if (navBtn) {
            let badge = navBtn.querySelector('.unread-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                navBtn.appendChild(badge);
            }
            
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            if (unreadCount > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (error) {
        // Silent fail for background updates
        console.warn('Failed to update unread count', error);
    }
}