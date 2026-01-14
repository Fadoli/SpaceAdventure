// Alliance view logic
import { API } from '../api.js';
import { formatDate, formatNumber } from '../utils.js';
import { Notifications } from '../notifications.js';
import { showConfirm, showPrompt } from './modals.js';
import { renderCombatReport, renderEspionageData } from './messages.js';

let currentSubView = 'overview';
let messageRefreshInterval = null;

let lastSubView = null;
let lastAllianceId = null;

/**
 * Update alliance view
 */
export async function updateAllianceView() {
    const container = document.querySelector('#alliance-view .alliance-container');
    if (!container) return;

    try {
        const gameState = await API.getGameState();
        
        // 1. Check if we need a full structural re-render
        // If the container has no meaningful content, force a full render
        const isContainerEmpty = container.children.length === 0 || container.querySelector('.empty-log-message');
        const needsFullRender = gameState.allianceId !== lastAllianceId || currentSubView !== lastSubView || isContainerEmpty;
        
        lastAllianceId = gameState.allianceId;
        lastSubView = currentSubView;

        if (gameState.allianceId) {
            const alliance = await API.getAlliance(gameState.allianceId);
            if (currentSubView === 'overview') {
                if (needsFullRender) renderAllianceDashboard(container, alliance, gameState);
                stopMessagePolling();
            } else if (currentSubView === 'planner') {
                if (needsFullRender) renderAlliancePlanner(container, alliance, gameState);
                stopMessagePolling();
            } else {
                if (needsFullRender) {
                    await renderAllianceCommunications(container, alliance, gameState);
                }
                startMessagePolling();
                // Messages update independently via their own hash-check
                await refreshAllianceMessages();
            }
        } else {
            stopMessagePolling();
            if (needsFullRender) {
                const alliances = await API.getAlliances();
                renderAllianceSearch(container, alliances);
            }
        }
    } catch (error) {
        console.error('Failed to load alliance data:', error);
        container.innerHTML = `<div class="empty-log-message">> DATA LINK FAILURE: ${error.message}</div>`;
        // Reset trackers on error so next retry can force render
        lastAllianceId = null;
        lastSubView = null;
    }
}

function startMessagePolling() {
    if (messageRefreshInterval) return;
    messageRefreshInterval = setInterval(async () => {
        if (currentSubView === 'communications') {
            await refreshAllianceMessages();
        }
    }, 5000);
}

function stopMessagePolling() {
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
        messageRefreshInterval = null;
    }
}

/**
 * Render dashboard for members
 */
function renderAllianceDashboard(container, alliance, player) {
    const isFounder = alliance.founderId === player.userId;
    
    let html = `
        <div class="messages-header-control">
            <div class="msg-title-area">
            <div class="msg-filter-bar">
                <div class="filter-group">
                    <button class="msg-filter-btn ${currentSubView === 'overview' ? 'active' : ''}" onclick="window.switchAllianceSubView('overview')">OVERVIEW</button>
                    <button class="msg-filter-btn ${currentSubView === 'communications' ? 'active' : ''}" onclick="window.switchAllianceSubView('communications')">COMMUNICATIONS</button>
                    <button class="msg-filter-btn ${currentSubView === 'planner' ? 'active' : ''}" onclick="window.switchAllianceSubView('planner')">ATTACK PLANNER</button>
                </div>
                <button class="v-action-btn delete" onclick="window.leaveAllianceUI()">LEAVE ALLIANCE</button>
            </div>
        </div>

        <div class="alliance-grid">
            <div class="alliance-main-col">
                <div class="research-card">
                    <div class="card-corner-top"></div>
                    <div class="card-header">
                        <div class="header-main">
                            <div class="title-row"><span class="name">INTERNAL DIRECTIVES</span></div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="details-description" style="margin: 0;">${alliance.description}</div>
                    </div>
                </div>

                <div class="research-card" style="margin-top: 20px;">
                    <div class="card-corner-top"></div>
                    <div class="card-header">
                        <div class="header-main">
                            <div class="title-row"><span class="name">PERSONNEL REGISTRY</span></div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="bt-readout">
                            ${alliance.members.map(m => `
                                <div class="bt-row">
                                    <span class="bt-label">${m.username.toUpperCase()} [${m.role.toUpperCase()}]</span>
                                    <span class="bt-value archived">ACTIVE</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="alliance-side-col">
                <div class="research-card">
                    <div class="card-corner-top"></div>
                    <div class="card-header">
                        <div class="header-main">
                            <div class="title-row"><span class="name">DATA SUMMARY</span></div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="diagnostic-section">
                            <div class="section-tag">Logistics</div>
                            <div class="bt-readout">
                                <div class="bt-row"><span class="bt-label">ESTABLISHED</span><span class="bt-value">${formatDate(alliance.createdAt)}</span></div>
                                <div class="bt-row"><span class="bt-label">ALLIANCE TAG</span><span class="bt-value archived">${alliance.tag}</span></div>
                                <div class="bt-row"><span class="bt-label">TOTAL MEMBERS</span><span class="bt-value">${alliance.members.length}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Render communications view (Alliance Chat)
 */
async function renderAllianceCommunications(container, alliance, player) {
    let html = `
        <div class="messages-header-control">
            <div class="msg-title-area">
                <h2>ENCRYPTED COMM-LINK: ${alliance.name.toUpperCase()}</h2>
                <span class="msg-stats-tag">SECURE CONNECTION ESTABLISHED</span>
            </div>
            <div class="msg-filter-bar">
                <div class="filter-group">
                    <button class="msg-filter-btn ${currentSubView === 'overview' ? 'active' : ''}" onclick="window.switchAllianceSubView('overview')">OVERVIEW</button>
                    <button class="msg-filter-btn ${currentSubView === 'communications' ? 'active' : ''}" onclick="window.switchAllianceSubView('communications')">COMMUNICATIONS</button>
                    <button class="msg-filter-btn ${currentSubView === 'planner' ? 'active' : ''}" onclick="window.switchAllianceSubView('planner')">ATTACK PLANNER</button>
                </div>
                <button class="v-action-btn delete" onclick="window.leaveAllianceUI()">LEAVE ALLIANCE</button>
            </div>
        </div>

        <div class="alliance-comm-container card-base">
            <div class="card-corner-top"></div>
            <div id="alliance-chat-history" class="alliance-chat-history">
                <div class="chat-loading">Initializing secure link...</div>
            </div>
            <div class="alliance-chat-input-area">
                <input type="text" id="alliance-chat-input" placeholder="ENTER ENCRYPTED MESSAGE..." autocomplete="off">
                <button class="btn btn-primary" onclick="window.sendAllianceMessageUI()">SEND</button>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // Add enter key listener
    const input = document.getElementById('alliance-chat-input');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') window.sendAllianceMessageUI();
        });
    }

    await refreshAllianceMessages();
}

let lastMessagesHash = null;

async function refreshAllianceMessages() {
    const historyEl = document.getElementById('alliance-chat-history');
    if (!historyEl) return;

    try {
        const messages = await API.getAllianceMessages();
        
        // 1. Check if anything actually changed
        const currentHash = JSON.stringify(messages.map(m => m.id));
        if (currentHash === lastMessagesHash) return;
        lastMessagesHash = currentHash;

        if (messages.length === 0) {
            historyEl.innerHTML = '<div class="empty-chat">> NO RECENT COMMUNICATIONS DETECTED</div>';
            return;
        }

        const isAtBottom = historyEl.scrollHeight - historyEl.scrollTop <= historyEl.clientHeight + 100;

        historyEl.innerHTML = messages.map(msg => {
            const isMe = msg.userId === window.currentUser?.userId;
            const isSystem = msg.userId === 'SYSTEM';
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            let contentHtml = `<span class="msg-content">${msg.content}</span>`;
            
            // Render shared reports if present
            if (msg.reportData) {
                contentHtml = `
                    <div class="shared-report-container">
                        <span class="msg-content" style="display: block; margin-bottom: 8px; color: var(--accent-blue);">${msg.content}</span>
                        <div class="shared-report-mini card-base">
                            ${msg.reportData.type === 'attack' ? renderCombatReport(msg.reportData.data) : renderEspionageData(msg.reportData.data)}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="chat-msg ${isMe ? 'msg-me' : ''} ${isSystem ? 'msg-system' : ''}">
                    <span class="msg-meta">[${time}] <span class="msg-user">${msg.username.toUpperCase()}</span>:</span>
                    ${contentHtml}
                </div>
            `;
        }).join('');

        if (isAtBottom) {
            historyEl.scrollTop = historyEl.scrollHeight;
        }
    } catch (error) {
        console.error('Failed to fetch alliance messages:', error);
    }
}

window.switchAllianceSubView = function(sub) {
    currentSubView = sub;
    updateAllianceView();
};

window.sendAllianceMessageUI = async function() {
    const input = document.getElementById('alliance-chat-input');
    if (!input || !input.value.trim()) return;

    const content = input.value.trim();
    input.value = '';
    input.disabled = true;

    try {
        await API.sendAllianceMessage(content);
        await refreshAllianceMessages();
    } catch (error) {
        Notifications.showError('Failed to send message: ' + error.message);
    } finally {
        input.disabled = false;
        input.focus();
    }
};

/**
 * Render search/create for non-members
 */
function renderAllianceSearch(container, alliances) {
    let html = `
        <div class="messages-header-control">
            <div class="msg-title-area">
                <h2>DIPLOMATIC CORPS</h2>
                <span class="msg-stats-tag">${alliances.length} KNOWN COALITIONS</span>
            </div>
            <div class="msg-filter-bar">
                <div class="filter-group">
                    <button class="msg-filter-btn active">BROWSE ALLIANCES</button>
                </div>
                <button class="v-action-btn" style="border-color: var(--accent-green); color: var(--accent-green);" onclick="window.createAllianceUI()">FOUND NEW ALLIANCE</button>
            </div>
        </div>

        <div class="alliance-list-grid">
    `;

    if (alliances.length === 0) {
        html += `<div class="empty-log-message">> NO EXTERNAL COALITIONS DETECTED IN LOCAL CLUSTER</div>`;
    } else {
        alliances.forEach(all => {
            html += `
                <div class="research-card">
                    <div class="card-corner-top"></div>
                    <div class="card-header">
                        <div class="header-main">
                            <div class="title-row">
                                <span class="name">[${all.tag}] ${all.name.toUpperCase()}</span>
                            </div>
                            <div class="blueprint-row">
                                <span class="eff-multiplier" style="color: var(--accent-blue); opacity: 0.8; font-size: 0.65rem;">${all.members.length} MEMBERS</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <p style="font-size: 0.8rem; color: var(--text-secondary); font-style: italic; min-height: 40px;">${all.description}</p>
                    </div>
                    <div class="building-actions">
                        <div class="action-group">
                            <button class="btn upgrade-btn" style="padding: 10px !important; font-size: 0.75rem !important;" onclick="window.joinAllianceUI('${all.id}', '${all.name}')">
                                REQUEST AFFILIATION
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

// Global UI handlers
window.createAllianceUI = async function() {
    const name = await showPrompt('Found Alliance', 'Enter alliance name:');
    if (!name) return;
    
    const tag = await showPrompt('Alliance Tag', 'Enter 3-8 character tag:');
    if (!tag) return;

    try {
        await API.createAlliance(name, tag);
        Notifications.showSuccess('Alliance established!');
        updateAllianceView();
    } catch (error) {
        Notifications.showError(error.message);
    }
};

window.joinAllianceUI = async function(id, name) {
    const confirmed = await showConfirm('Join Alliance', `Request immediate affiliation with [${name}]?`);
    if (!confirmed) return;

    try {
        await API.joinAlliance(id);
        Notifications.showSuccess('Affiliation confirmed!');
        updateAllianceView();
    } catch (error) {
        Notifications.showError(error.message);
    }
};

window.leaveAllianceUI = async function() {
    const confirmed = await showConfirm('Leave Alliance', 'Terminate all current alliance affiliations?');
    if (!confirmed) return;

    try {
        await API.leaveAlliance();
        Notifications.showSuccess('Affiliations terminated.');
        updateAllianceView();
    } catch (error) {
        Notifications.showError(error.message);
    }
};

/**
 * Render the Attack Planner subview
 */
function renderAlliancePlanner(container, alliance, player) {
    const plans = alliance.plannedAttacks || [];
    
    let html = `
        <div class="messages-header-control">
            <div class="msg-title-area">
                <h2>TACTICAL OPERATIONS CENTER</h2>
                <span class="msg-stats-tag">${plans.length} OPERATIONS PLANNED</span>
            </div>
            <div class="msg-filter-bar">
                <div class="filter-group">
                    <button class="msg-filter-btn ${currentSubView === 'overview' ? 'active' : ''}" onclick="window.switchAllianceSubView('overview')">OVERVIEW</button>
                    <button class="msg-filter-btn ${currentSubView === 'communications' ? 'active' : ''}" onclick="window.switchAllianceSubView('communications')">COMMUNICATIONS</button>
                    <button class="msg-filter-btn ${currentSubView === 'planner' ? 'active' : ''}" onclick="window.switchAllianceSubView('planner')">ATTACK PLANNER</button>
                </div>
                <button class="v-action-btn" style="border-color: var(--accent-blue); color: var(--accent-blue);" onclick="window.createNewAttackPlanUI()">INITIATE NEW PLAN</button>
            </div>
        </div>

        <div class="planner-grid">
    `;

    if (plans.length === 0) {
        html += `<div class="empty-log-message">> NO RECENT OFFENSIVE OPERATIONS PLANNED</div>`;
    } else {
        // Sort: gathering first, then launched, then newest
        const sortedPlans = [...plans].sort((a, b) => {
            if (a.status === 'gathering' && b.status !== 'gathering') return -1;
            if (a.status !== 'gathering' && b.status === 'gathering') return 1;
            return b.createdAt - a.createdAt;
        });

        sortedPlans.forEach(plan => {
            const isHost = plan.hostId === player.userId;
            const statusClass = plan.status === 'gathering' ? 'status-active' : (plan.status === 'launched' ? 'status-launched' : '');
            
            html += `
                <div class="research-card plan-card ${plan.status}">
                    <div class="card-corner-top"></div>
                    <div class="card-header">
                        <div class="header-main">
                            <div class="title-row">
                                <span class="name">OP: [${plan.targetCoords.join(':')}]</span>
                                <span class="status-badge-technical ${statusClass}">${plan.status.toUpperCase()}</span>
                            </div>
                            <div class="blueprint-row">
                                <span class="eff-multiplier">COMMANDER: ${plan.hostUsername.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="diagnostic-section">
                            <div class="section-tag">Rally Point</div>
                            <div class="bt-readout">
                                <div class="bt-row"><span class="bt-label">HOST COORDINATES</span><span class="bt-value archived">[${plan.hostCoords.join(':')}]</span></div>
                                <div class="bt-row"><span class="bt-label">PARTICIPANTS</span><span class="bt-value">${plan.participants.length}</span></div>
                            </div>
                        </div>

                        <div class="diagnostic-section">
                            <div class="section-tag">Task Force Composition</div>
                            <div class="pooled-ships-summary">
                                ${renderPlanParticipantSummary(plan)}
                            </div>
                        </div>
                    </div>
                    <div class="building-actions">
                        <div class="action-group">
                            ${plan.status === 'gathering' ? `
                                <button class="btn upgrade-btn" onclick="window.joinAttackPlanUI('${plan.id}')">
                                    REINFORCE OPERATION
                                </button>
                                ${isHost ? `
                                    <button class="btn design-btn" onclick="window.launchAttackPlanUI('${plan.id}')" title="Initiate Full Coalition Strike">
                                        🚀 LAUNCH
                                    </button>
                                ` : ''}
                            ` : `
                                <button class="btn upgrade-btn" disabled>
                                    OPERATION ${plan.status.toUpperCase()}
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

function renderPlanParticipantSummary(plan) {
    // Collect all ships being sent/gathered
    const totals = {};
    plan.participants.forEach(p => {
        if (p.fleets) {
            p.fleets.forEach(f => {
                for (const k in f.ships) totals[k] = (totals[k] || 0) + f.ships[k];
            });
        }
    });

    if (isEmpty(totals)) return '<div style="font-size: 0.7rem; opacity: 0.5;">NO ASSETS CURRENTLY POOLED</div>';

    return Object.entries(totals).map(([key, val]) => `
        <div class="mini-ship-tag">
            <span class="ship-qty">${formatNumber(val)}</span>
            <span class="ship-name">${key.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</span>
        </div>
    `).join('');
}

window.createNewAttackPlanUI = async function() {
    const coordsStr = await showPrompt('Set Objective', 'Enter target coordinates (G:S:P):');
    if (!coordsStr) return;

    const coords = coordsStr.split(':').map(Number);
    if (coords.length !== 3 || coords.some(isNaN)) {
        Notifications.showError('Invalid coordinate format. Use G:S:P');
        return;
    }

    try {
        const planetId = window.getCurrentPlanetId();
        await API.request('/game/alliance/plan/create', {
            method: 'POST',
            body: JSON.stringify({ hostPlanetId: planetId, targetCoords: coords })
        });
        Notifications.showSuccess('Operation objective established.');
        updateAllianceView();
    } catch (error) {
        Notifications.showError(error.message);
    }
};

window.joinAttackPlanUI = async function(planId) {
    const planet = window.getCurrentPlanet();
    if (!planet) return;

    // Show simplified ship selection
    const ships = {};
    let hasShips = false;
    
    // We'll reuse the unified mission modal logic if possible, 
    // but for now let's just use a prompt or simplified logic.
    // Actually, let's open a custom modal for "reinforcing".
    
    const modal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('details-modal-title');
    const modalBody = document.getElementById('details-modal-body');

    modalTitle.innerHTML = `🛡️ REINFORCE OPERATION`;
    
    let html = '<div class="expedition-ship-selection"><div class="mission-section"><h4>🚢 DEPLOY ASSETS TO RALLY POINT</h4><div class="expedition-ships-list">';
    
    for (const [shipKey, count] of Object.entries(planet.ships)) {
        if (count > 0) {
            const shipName = shipKey.replace(/([A-Z])/g, ' $1').toUpperCase();
            html += `
                <div class="expedition-ship-item dense">
                    <span class="ship-name">${shipName}</span>
                    <span class="ship-available">Avail: ${formatNumber(count)}</span>
                    <div class="ship-input">
                        <input type="text" pattern="[0-9]*" class="plan-qty-input" data-ship="${shipKey}" value="0">
                        <button class="btn-max" onclick="this.previousElementSibling.value=${count}">MAX</button>
                    </div>
                </div>
            `;
            hasShips = true;
        }
    }

    if (!hasShips) {
        Notifications.showError('No available strike craft on current planet.');
        return;
    }

    html += `</div></div><div class="modal-footer"><button class="btn btn-secondary" onclick="window.closeDetailsModal()">ABORT</button><button class="btn btn-primary" onclick="window.submitJoinAttackPlan('${planId}')">DISPATCH REINFORCEMENTS</button></div></div>`;
    
    modalBody.innerHTML = html;
    modal.style.display = 'flex';
};

window.submitJoinAttackPlan = async function(planId) {
    const ships = {};
    let total = 0;
    document.querySelectorAll('.plan-qty-input').forEach(input => {
        const val = parseInt(input.value) || 0;
        if (val > 0) {
            ships[input.dataset.ship] = val;
            total += val;
        }
    });

    if (total === 0) {
        Notifications.showError('No assets selected for deployment.');
        return;
    }

    try {
        const planetId = window.getCurrentPlanetId();
        await API.request('/game/alliance/plan/join', {
            method: 'POST',
            body: JSON.stringify({ planId, originPlanetId: planetId, ships })
        });
        Notifications.showSuccess('Reinforcements dispatched to rally point.');
        window.closeDetailsModal();
        updateAllianceView();
    } catch (error) {
        Notifications.showError(error.message);
    }
};

window.launchAttackPlanUI = async function(planId) {
    const confirmed = await showConfirm('Initiate Strike', 'Initiate full coalition strike? All assets currently at rally point will be launched.');
    if (!confirmed) return;

    try {
        const planet = window.getCurrentPlanet();
        // Host must also contribute some ships (can be 0 if only allies, but let's assume they want to pick)
        // For simplicity, we launch ALL military ships the host currently has on that planet
        const hostShips = {};
        for (const k in planet.ships) {
            if (['lightFighter', 'heavyFighter', 'cruiser', 'battleship', 'destroyer', 'bomber'].includes(k)) {
                hostShips[k] = planet.ships[k];
            }
        }

        await API.request('/game/alliance/plan/launch', {
            method: 'POST',
            body: JSON.stringify({ planId, hostShips })
        });
        Notifications.showSuccess('COALITION STRIKE INITIATED. ALL ASSETS EN ROUTE TO OBJECTIVE.');
        updateAllianceView();
    } catch (error) {
        Notifications.showError(error.message);
    }
};
