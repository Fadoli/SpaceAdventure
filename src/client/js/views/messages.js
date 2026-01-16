import { API } from '../api.js';
import { formatDate, formatNumber, isEmpty } from '../utils.js';
import { showConfirm } from './modals.js';
import { Notifications } from '../notifications.js';
import { SHIPS, ALIEN_SHIPS } from '../../../shared/ships.js';

let lastMessagesHash = null;
let currentFilter = 'all';
const espionageRegistry = new Map();

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
                            <div class="msg-actions-footer" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; gap: 10px;">
                                ${msg.type === 'espionage' ? `<button class="btn btn-primary btn-small" onclick="window.openBattleSimulator('${msg.id}')">⚔️ BATTLE SIMULATOR</button>` : ''}
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
            return renderEspionageData(msg.data, msg.id);
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
    const attackerLossesParts = [];
    if (data.attackerLosses) {
        for (const k in data.attackerLosses) {
            const shipDef = SHIPS[k] || ALIEN_SHIPS[k];
            const name = shipDef ? shipDef.name.toUpperCase() : k.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
            attackerLossesParts.push(`<div class="bt-row"><span class="bt-label">${name}</span><span class="bt-value unstable">-${data.attackerLosses[k]}</span></div>`);
        }
    }

    const defenderLossesParts = [];
    const defLosses = data.defenderLosses || {};
    const allDefLosses = { ...(defLosses.ships || {}), ...(defLosses.defenses || {}) };
    for (const k in allDefLosses) {
        const shipDef = SHIPS[k] || ALIEN_SHIPS[k];
        const name = shipDef ? shipDef.name.toUpperCase() : k.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
        defenderLossesParts.push(`<div class="bt-row"><span class="bt-label">${name}</span><span class="bt-value unstable">-${allDefLosses[k]}</span></div>`);
    }

    html += `
        <div class="report-block losses-readout">
            <div class="loss-col">
                <div class="v-readout-header">ATTACKER LOSSES</div>
                <div class="bt-readout">
                    ${attackerLossesParts.length === 0 ? '<div class="bt-row"><span class="bt-label">NONE</span></div>' : attackerLossesParts.join('')}
                </div>
            </div>
            <div class="loss-col">
                <div class="v-readout-header">DEFENDER LOSSES</div>
                <div class="bt-readout">
                    ${defenderLossesParts.length === 0 ? '<div class="bt-row"><span class="bt-label">NONE</span></div>' : defenderLossesParts.join('')}
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

export function renderEspionageData(data, msgId = null) {
    if (msgId && data) {
        espionageRegistry.set(msgId, data);
    }

    const c = data.coords || [1, 1, 1];
    let html = `
        <div class="technical-report espionage">
            <div class="report-header">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="report-title">INTELLIGENCE SCAN REPORT ${data.isGhost ? '<span style="color: var(--accent-yellow);"> (GHOST)</span>' : ''}</span>
                </div>
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
        const entries = [];
        if (section.data) {
            for (const k in section.data) {
                const v = section.data[k];
                const level = (typeof v === 'object' ? v.level : v);
                if (level > 0) entries.push([k, level]);
            }
        }

        if (entries.length > 0) {
            html += `
                <div class="report-block">
                    <div class="v-readout-header">${section.label}</div>
                    <div class="bt-readout">
                        ${entries.map(([k, v]) => {
                            const def = SHIPS[k] || ALIEN_SHIPS[k];
                            const name = def ? def.name.toUpperCase() : k.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
                            return `
                                <div class="bt-row">
                                    <span class="bt-label">${name}</span>
                                    <span class="bt-value archived">${typeof v === 'object' ? v.level : v}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
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
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    }
};

window.openBattleSimulator = async function(msgId) {
    const scanData = espionageRegistry.get(msgId);
    if (!scanData) {
        Notifications.showError('Espionage data not found');
        return;
    }

    const currentPlanet = window.getCurrentPlanet();
    if (!currentPlanet) {
        Notifications.showError('No active planet selected');
        return;
    }

    const modal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('details-modal-title');
    const modalBody = document.getElementById('details-modal-body');

    modalTitle.innerHTML = `⚔️ BATTLE SIMULATOR - [${scanData.coords.join(':')}]`;
    modal.style.display = 'flex';

    // Remove any existing footer to prevent duplicates when reusing the modal
    const existingFooter = modal.querySelector('.modal-footer');
    if (existingFooter) existingFooter.remove();

    let html = `
        <div class="simulator-container" style="display: flex; flex-direction: column; gap: 20px;">
            <div class="simulator-header" style="background: rgba(56, 189, 248, 0.1); padding: 10px; border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 4px;">
                <p style="margin: 0; font-size: 0.8rem; color: var(--accent-blue); font-weight: bold;">TARGET: ${scanData.targetPlayer.toUpperCase()} ${scanData.isGhost ? '(GHOST)' : ''}</p>
                <p style="margin: 5px 0 0 0; font-size: 0.7rem; color: var(--text-secondary); font-family: 'Share Tech Mono', monospace;">DEFENDER TECHS: W:${scanData.defenderTechLevel} / S:${scanData.defenderTechLevel} / A:${scanData.defenderTechLevel}</p>
            </div>

            <div class="simulator-columns" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <!-- Attacker Side (You) -->
                <div class="sim-attacker-side">
                    <h4 style="color: var(--accent-blue); margin-bottom: 10px; font-family: 'Orbitron', sans-serif; font-size: 0.8rem;">YOUR EXPEDITIONARY FORCE</h4>
                    <div class="ship-selector-list" style="max-height: 400px; overflow-y: auto; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.05);">
    `;

    // List available ships from current planet
    const shipKeys = ['lightFighter', 'heavyFighter', 'cruiser', 'battleship', 'destroyer', 'bomber', 'dreadnought', 'carrier', 'smallCargo', 'largeCargo', 'recycler', 'espionageProbe'];
    
    shipKeys.forEach(ship => {
        const count = currentPlanet.ships?.[ship] || 0;
        const name = ship.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
        
        if (count > 0 || ['lightFighter', 'cruiser', 'battleship'].includes(ship)) {
            html += `
                <div class="sim-ship-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <div style="flex: 1;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: #eee;">${name}</div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary);">AVAIL: ${formatNumber(count)}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="number" class="sim-attacker-ship" data-ship="${ship}" value="0" min="0" max="${count * 100}" style="width: 70px; background: #05080f; border: 1px solid #1e293b; color: var(--accent-blue); padding: 3px 5px; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem;">
                        <button class="btn-max" onclick="this.previousElementSibling.value=${count}" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); color: var(--accent-blue); font-size: 0.6rem; padding: 2px 4px; cursor: pointer;">MAX</button>
                    </div>
                </div>
            `;
        }
    });

    html += `
                    </div>
                </div>

                <!-- Defender Side (Scanned) -->
                <div class="sim-defender-side">
                    <h4 style="color: var(--accent-yellow); margin-bottom: 10px; font-family: 'Orbitron', sans-serif; font-size: 0.8rem;">THREAT ASSESSMENT</h4>
                    <div class="defender-unit-preview" style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem; font-family: 'Share Tech Mono', monospace;">
    `;

    // Show scanned ships
    if (scanData.ships && !isEmpty(scanData.ships)) {
        html += '<p style="color: var(--accent-blue); font-weight: bold; margin: 0 0 8px 0; font-family: \'Orbitron\', sans-serif; font-size: 0.65rem;">SCANNED FLEET:</p>';
        for (const [k, v] of Object.entries(scanData.ships)) {
            html += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; border-bottom: 1px dotted rgba(255,255,255,0.05);"><span>${k.toUpperCase()}</span><span style="color: #fff;">${formatNumber(v)}</span></div>`;
        }
    } else {
        html += '<p style="font-style: italic; opacity: 0.5; margin-bottom: 15px;">No ship signatures detected</p>';
    }

    // Show scanned defenses
    if (scanData.defenses && !isEmpty(scanData.defenses)) {
        html += '<p style="color: var(--accent-yellow); font-weight: bold; margin: 15px 0 8px 0; font-family: \'Orbitron\', sans-serif; font-size: 0.65rem;">PLANETARY DEFENSES:</p>';
        for (const [k, v] of Object.entries(scanData.defenses)) {
            html += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; border-bottom: 1px dotted rgba(255,255,255,0.05);"><span>${k.toUpperCase()}</span><span style="color: #fff;">${formatNumber(v)}</span></div>`;
        }
    } else {
        html += '<p style="font-style: italic; opacity: 0.5; margin-top: 15px;">No defensive structures detected</p>';
    }

    html += `
                    </div>
                    <div id="sim-result-area" style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 2px; min-height: 150px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, var(--accent-blue), transparent); animation: scan-line 2s infinite;"></div>
                        <p style="text-align: center; color: var(--text-secondary); margin-top: 45px; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem;">[ AWAITING INPUT VECTORS ]</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    modalBody.innerHTML = html;

    // Add footer outside the simulator container to use standard modal-footer styling
    modalBody.insertAdjacentHTML('afterend', `
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="window.closeDetailsModal()">ABORT</button>
            <button class="btn btn-primary" id="run-sim-btn">ENGAGE SIMULATION</button>
        </div>
    `);

    // Attach event listener
    document.getElementById('run-sim-btn').addEventListener('click', () => window.runCombatSimulation(msgId));
};

window.runCombatSimulation = async function(msgId) {
    const scanData = espionageRegistry.get(msgId);
    const resultArea = document.getElementById('sim-result-area');
    const attackerShipsEls = document.querySelectorAll('.sim-attacker-ship');
    
    resultArea.innerHTML = `
        <div style="text-align: center; margin-top: 40px;">
            <div class="scanner-pulse" style="margin: 0 auto 15px auto;"></div>
            <p style="font-family: 'Share Tech Mono', monospace; font-size: 0.8rem; color: var(--accent-blue);">CALCULATING COMBAT PROBABILITIES...</p>
        </div>
    `;

    const attackerShips = {};
    attackerShipsEls.forEach(el => {
        const val = parseInt(el.value) || 0;
        if (val > 0) attackerShips[el.dataset.ship] = val;
    });

    if (isEmpty(attackerShips)) {
        resultArea.innerHTML = '<p style="text-align: center; color: var(--accent-red); margin-top: 45px; font-family: \'Share Tech Mono\', monospace;">ERROR: NO ATTACK VECTORS DEFINED.</p>';
        return;
    }

    const gameState = window.getGameState();
    const attackerResearch = gameState.research || {};

    try {
        const report = await API.simulateCombat({
            ships: attackerShips,
            research: attackerResearch,
            username: window.currentUser.username
        }, {
            ships: scanData.ships || {},
            defenses: scanData.defenses || {},
            research: {
                weaponsTech: scanData.defenderTechLevel,
                shieldingTech: scanData.defenderTechLevel,
                armorTech: scanData.defenderTechLevel
            },
            username: scanData.targetPlayer
        });

        // Render result in the result area
        const winnerColor = report.winner === 'attacker' ? 'var(--accent-green)' : (report.winner === 'defender' ? 'var(--accent-red)' : 'var(--accent-yellow)');
        
        let resultHtml = `
            <div style="font-family: 'Share Tech Mono', monospace; animation: fadeIn 0.5s ease-out;">
                <h4 style="color: ${winnerColor}; margin-bottom: 15px; text-align: center; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; font-size: 0.9rem; text-shadow: 0 0 10px ${winnerColor}44;">
                    PROJECTION: ${report.winner.toUpperCase()} VICTORIOUS
                </h4>
                <div style="font-size: 0.7rem; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 2px;">
                    <div>
                        <p style="color: var(--accent-blue); margin: 0 0 8px 0; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 2px;">EST. YOUR LOSSES:</p>
                        ${renderLossesMini(report.attackerLosses)}
                    </div>
                    <div>
                        <p style="color: var(--accent-yellow); margin: 0 0 8px 0; border-bottom: 1px solid rgba(251, 191, 36, 0.2); padding-bottom: 2px;">EST. TARGET LOSSES:</p>
                        ${renderLossesMini({ ...report.defenderLosses.ships, ...report.defenderLosses.defenses })}
                    </div>
                </div>
                <div style="margin-top: 15px; font-size: 0.7rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
                    <span>RECOVERABLE DEBRIS:</span>
                    <span style="color: var(--accent-blue); font-weight: bold;">${formatNumber(report.debris.metal)} M / ${formatNumber(report.debris.crystal)} C</span>
                </div>
                <div style="margin-top: 5px; font-size: 0.65rem; color: #64748b; text-align: right; font-style: italic;">
                    * Statistical projection based on current intel.
                </div>
            </div>
        `;
        resultArea.innerHTML = resultHtml;

    } catch (error) {
        resultArea.innerHTML = `<p style="text-align: center; color: var(--accent-red); margin-top: 45px; font-family: 'Share Tech Mono', monospace;">ANALYSIS FAILED: ${error.message.toUpperCase()}</p>`;
    }
};

function renderLossesMini(losses) {
    if (!losses || isEmpty(losses)) return '<p style="font-size: 0.65rem; opacity: 0.3; margin: 0;">NO LOSSES PROJECTED</p>';
    let html = '<div style="display: flex; flex-direction: column; gap: 2px;">';
    for (const [k, v] of Object.entries(losses)) {
        const shipDef = SHIPS[k] || ALIEN_SHIPS[k];
        const name = shipDef ? shipDef.name.toUpperCase() : k.toUpperCase();
        html += `<div style="font-size: 0.65rem; display: flex; justify-content: space-between; color: #eee;"><span>${name}</span><span style="color: var(--accent-red);">${formatNumber(v)}</span></div>`;
    }
    html += '</div>';
    return html;
}

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
        if (!navBtn) return;

        let badge = navBtn.querySelector('.unread-badge');
        
        if (unreadCount > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                navBtn.appendChild(badge);
            }
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
            badge.style.display = 'block'; // Ensure it's shown
        } else if (badge) {
            badge.classList.add('hidden');
            badge.style.display = 'none'; // Ensure it's hidden
        }
    } catch (error) {
        // Silent fail for background updates
        console.warn('Failed to update unread count', error);
    }
}
