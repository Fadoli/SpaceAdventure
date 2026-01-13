// Ranking view logic
import { API } from '../api.js';
import { formatNumber } from '../utils.js';

/**
 * Update ranking view
 */
export async function updateRankingView(offset = 0) {
    const container = document.getElementById('ranking-container');
    if (!container) return;

    try {
        const data = await API.getRankings(offset, 100);
        renderRankingTable(container, data.rankings, data.totalPlayers, data.offset, data.limit);
    } catch (error) {
        console.error('Failed to load rankings:', error);
        container.innerHTML = `<p class="error">Failed to load rankings: ${error.message}</p>`;
    }
}

/**
 * Render the ranking table
 */
function renderRankingTable(container, rankings, totalPlayers, offset, limit) {
    if (!rankings || rankings.length === 0) {
        container.innerHTML = '<p>No data available yet.</p>';
        return;
    }

    const startRange = offset + 1;
    const endRange = Math.min(offset + limit, totalPlayers);

    let html = `
        <div class="ranking-header">
            <div class="ranking-info">
                <p>Showing players ${startRange}-${endRange} of ${totalPlayers} by total resources spent.</p>
            </div>
            <div class="ranking-nav">
                <button class="btn btn-secondary btn-small" onclick="window.updateRankingView(0)" ${offset === 0 ? 'disabled' : ''}>Top 100</button>
                <button class="btn btn-secondary btn-small" onclick="window.updateRankingView(${Math.max(0, offset - 100)})" ${offset === 0 ? 'disabled' : ''}>Previous 100</button>
                <button class="btn btn-secondary btn-small" onclick="window.updateRankingView(${offset + 100})" ${offset + 100 >= totalPlayers ? 'disabled' : ''}>Next 100</button>
            </div>
        </div>
        <div class="ranking-wrapper">
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th class="rank-col">Rank</th>
                        <th class="player-col">Player</th>
                        <th class="coords-col">Homeworld</th>
                        <th class="planets-col">Planets</th>
                        <th class="score-col">Total Resources Spent</th>
                    </tr>
                </thead>
                <tbody>
    `;

    rankings.forEach(player => {
        const isCurrentPlayer = player.userId === window.currentUser?.userId;
        const coords = player.homeworldCoords || [1, 1, 1];
        const coordsStr = `[${coords.join(':')}]`;
        
        const allianceTagHtml = player.allianceTag ? `<span class="ranking-alliance-tag">[${player.allianceTag}] </span>` : '';

        html += `
            <tr class="${isCurrentPlayer ? 'current-player-row' : ''}">
                <td class="rank-col">${player.rank}</td>
                <td class="player-col">${allianceTagHtml}${player.username}</td>
                <td class="coords-col">
                    <a href="#" class="galaxy-link" onclick="event.preventDefault(); window.navigateToCoords(${coords[0]}, ${coords[1]}, ${coords[2]})">
                        ${coordsStr}
                    </a>
                </td>
                <td class="planets-col">${player.planets}</td>
                <td class="score-col">${formatNumber(player.totalSpent)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

// Expose to window for onclick handlers
window.updateRankingView = updateRankingView;

