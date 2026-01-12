// Alliance view logic
import { API } from '../api.js';
import { formatDate, formatNumber } from '../utils.js';
import { Notifications } from '../notifications.js';
import { showConfirm, showPrompt } from './modals.js';

/**
 * Update alliance view
 */
export async function updateAllianceView() {
    const container = document.querySelector('#alliance-view .alliance-container');
    if (!container) return;

    try {
        const gameState = await API.getGameState();
        
        if (gameState.allianceId) {
            const alliance = await API.getAlliance(gameState.allianceId);
            renderAllianceDashboard(container, alliance, gameState);
        } else {
            const alliances = await API.getAlliances();
            renderAllianceSearch(container, alliances);
        }
    } catch (error) {
        console.error('Failed to load alliance data:', error);
        container.innerHTML = `<div class="empty-log-message">> DATA LINK FAILURE: ${error.message}</div>`;
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
                <h2>ALLIANCE COMMAND: [${alliance.tag}] ${alliance.name.toUpperCase()}</h2>
                <span class="msg-stats-tag">${alliance.members.length} OPERATIVES ACTIVE</span>
            </div>
            <div class="msg-filter-bar">
                <div class="filter-group">
                    <button class="msg-filter-btn active">OVERVIEW</button>
                    <button class="msg-filter-btn" onclick="Notifications.showInfo('Communication channel coming soon!')">COMMUNICATIONS</button>
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
    
    const tag = await showPrompt('Alliance Tag', 'Enter 3-4 character tag:');
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
