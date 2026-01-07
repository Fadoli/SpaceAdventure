// Ranking view logic
import { API } from '../api.js';
import { formatNumber } from '../utils.js';

/**
 * Update ranking view
 */
export async function updateRankingView() {
    const container = document.getElementById('ranking-container');
    if (!container) return;

    try {
        const rankings = await API.getRankings();
        renderRankingTable(container, rankings);
    } catch (error) {
        console.error('Failed to load rankings:', error);
        container.innerHTML = `<p class="error">Failed to load rankings: ${error.message}</p>`;
    }
}

/**
 * Render the ranking table
 */
function renderRankingTable(container, rankings) {
    if (!rankings || rankings.length === 0) {
        container.innerHTML = '<p>No data available yet.</p>';
        return;
    }

    let html = `
        <div class="ranking-wrapper">
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th class="rank-col">Rank</th>
                        <th class="player-col">Player</th>
                        <th class="planets-col">Planets</th>
                        <th class="score-col">Total Resources Spent</th>
                    </tr>
                </thead>
                <tbody>
    `;

    rankings.forEach(player => {
        const isCurrentPlayer = player.userId === window.currentUser?.id;
        html += `
            <tr class="${isCurrentPlayer ? 'current-player-row' : ''}">
                <td class="rank-col">${player.rank}</td>
                <td class="player-col">${player.username}</td>
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
