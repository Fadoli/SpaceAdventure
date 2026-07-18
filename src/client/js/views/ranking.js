// Ranking view logic
import { API } from '../api.js';
import { escapeHtml, formatNumber } from '../utils.js';

let currentCategory = 'total';

/**
 * Update ranking view
 */
export async function updateRankingView(offset = 0, category = null) {
    const container = document.getElementById('ranking-container');
    if (!container) return;

    if (category) currentCategory = category;

    try {
        const data = await API.getRankings(offset, 100, currentCategory);
        renderRankingTable(container, data.rankings, data.totalPlayers, data.offset, data.limit, data.category, data.lastSnapshotTime);
    } catch (error) {
        console.error('Failed to load rankings:', error);
        container.innerHTML = `<p class="error">Failed to load rankings: ${escapeHtml(error.message)}</p>`;
    }
}

/**
 * Render the ranking table
 */
export function renderRankingTable(container, rankings, totalPlayers, offset, limit, category, lastSnapshotTime) {
    const startRange = totalPlayers === 0 ? 0 : offset + 1;
    const endRange = Math.min(offset + limit, totalPlayers);
    
    const categoryLabels = {
        total: 'Total Resources Spent',
        economy: 'Economy (Buildings)',
        research: 'Research (Technologies)',
        fleet: 'Military (Ships & Defenses)'
    };

    let snapshotInfo = '';
    if (lastSnapshotTime) {
        const hoursAgo = Math.round((Date.now() - lastSnapshotTime) / (3600 * 1000));
        snapshotInfo = `<span style="margin-left: 10px; opacity: 0.7; font-size: 0.75rem;">(Changes compared to ${hoursAgo}h ago)</span>`;
    }

    let html = `
        <div class="ranking-header">
            <div class="ranking-category-nav">
                <button class="btn btn-tab ${category === 'total' ? 'active' : ''}" onclick="window.updateRankingView(0, 'total')">Total</button>
                <button class="btn btn-tab ${category === 'economy' ? 'active' : ''}" onclick="window.updateRankingView(0, 'economy')">Economy</button>
                <button class="btn btn-tab ${category === 'research' ? 'active' : ''}" onclick="window.updateRankingView(0, 'research')">Research</button>
                <button class="btn btn-tab ${category === 'fleet' ? 'active' : ''}" onclick="window.updateRankingView(0, 'fleet')">Military</button>
            </div>
            <div class="ranking-info-row">
                <div class="ranking-info">
                    <p>Showing players ${startRange}-${endRange} of ${totalPlayers} ranked by <strong>${categoryLabels[category] || category}</strong>. ${snapshotInfo}</p>
                </div>
                <div class="ranking-nav">
                    <button class="btn btn-secondary btn-small" onclick="window.updateRankingView(0)" ${offset === 0 ? 'disabled' : ''}>Top 100</button>
                    <button class="btn btn-secondary btn-small" onclick="window.updateRankingView(${Math.max(0, offset - 100)})" ${offset === 0 ? 'disabled' : ''}>Previous 100</button>
                    <button class="btn btn-secondary btn-small" onclick="window.updateRankingView(${offset + 100})" ${offset + 100 >= totalPlayers ? 'disabled' : ''}>Next 100</button>
                </div>
            </div>
        </div>
        <div class="ranking-wrapper">
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th class="rank-col">Rank</th>
                        <th class="change-col" title="Rank change in last 24h">+/-</th>
                        <th class="player-col">Player</th>
                        <th class="coords-col">Homeworld</th>
                        <th class="planets-col">Planets</th>
                        <th class="score-col">Score</th>
                        <th class="score-change-col" title="Score increase in last 24h">Delta 24h</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (!rankings || rankings.length === 0) {
        html += `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">No intelligence data available for this sector yet.</td></tr>`;
    } else {
        rankings.forEach(player => {
            const isCurrentPlayer = player.userId === window.currentUser?.userId;
            const coords = player.homeworldCoords || [1, 1, 1];
            const coordsStr = `[${coords.join(':')}]`;
            
            const allianceTagHtml = player.allianceTag ? `<span class="ranking-alliance-tag">[${escapeHtml(player.allianceTag)}] </span>` : '';

            // Rank Change formatting
            let rankChangeHtml = '<span class="change-neutral">-</span>';
            if (player.rankChange > 0) {
                rankChangeHtml = `<span class="change-positive">▲${player.rankChange}</span>`;
            } else if (player.rankChange < 0) {
                rankChangeHtml = `<span class="change-negative">▼${Math.abs(player.rankChange)}</span>`;
            }

            // Score Change formatting
            let scoreChangeHtml = `<span class="score-change-neutral">+0</span>`;
            if (player.scoreChange > 0) {
                scoreChangeHtml = `<span class="score-change-positive">+${formatNumber(player.scoreChange)}</span>`;
            }

            html += `
                <tr class="${isCurrentPlayer ? 'current-player-row' : ''}">
                    <td class="rank-col">${player.rank}</td>
                    <td class="change-col">${rankChangeHtml}</td>
                    <td class="player-col">${allianceTagHtml}${escapeHtml(player.username)}</td>
                    <td class="coords-col">
                        <a href="#" class="galaxy-link" onclick="event.preventDefault(); window.navigateToCoords(${coords[0]}, ${coords[1]}, ${coords[2]})">
                            ${coordsStr}
                        </a>
                    </td>
                    <td class="planets-col">${player.planets}</td>
                    <td class="score-col">${formatNumber(player.score)}</td>
                    <td class="score-change-col">${scoreChangeHtml}</td>
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

// Expose to window for onclick handlers
window.updateRankingView = updateRankingView;
