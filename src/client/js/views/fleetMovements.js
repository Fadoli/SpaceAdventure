import { formatCountdown } from '../utils.js';

/**
 * Update the global fleet movements display
 */
export function updateFleetMovements(gameState) {
    const container = document.getElementById('fleet-movements-bar');
    if (!container) return;
    
    // If no fleets, clear container
    if (!gameState || !gameState.fleets || gameState.fleets.length === 0) {
        container.innerHTML = '';
        container.classList.remove('active');
        return;
    }
    
    container.classList.add('active');
    
    const now = Date.now();
    let html = '';
    
    // Sort fleets by arrival time
    const sortedFleets = [...gameState.fleets].sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    for (const fleet of sortedFleets) {
        const isReturning = fleet.returning;
        const timeRemaining = Math.max(0, Math.floor((fleet.arrivalTime - now) / 1000));
        
        // Skip if expired (server will clean up)
        if (timeRemaining <= 0) continue;
        
        let missionIcon = '🚀';
        let missionClass = 'mission-transport';
        let missionName = fleet.missionType;
        
        switch (fleet.missionType) {
            case 'attack':
                missionIcon = '⚔️';
                missionClass = 'mission-attack';
                break;
            case 'espionage':
                missionIcon = '🕵️';
                missionClass = 'mission-espionage';
                break;
            case 'colonize':
                missionIcon = '🌱';
                missionClass = 'mission-colonize';
                break;
            case 'transport':
                missionIcon = '📦';
                missionClass = 'mission-transport';
                break;
            case 'deploy':
                missionIcon = '🏁';
                missionClass = 'mission-deploy';
                break;
        }
        
        if (isReturning) {
            missionIcon = '🔙';
            missionClass = 'mission-return';
            missionName = 'Return';
        }
        
        const originCoords = `[${fleet.originCoords.join(':')}]`;
        const targetCoords = `[${fleet.targetCoords.join(':')}]`;
        
        html += `
            <div class="flying-fleet-item ${missionClass}" title="${missionName}: ${originCoords} -> ${targetCoords}">
                <span class="fleet-mission-icon">${missionIcon}</span>
                <span class="fleet-timer">${formatCountdown(timeRemaining)}</span>
                <div class="fleet-details-tooltip">
                    <div class="fleet-tooltip-header">
                        ${isReturning ? 'Returning to' : missionName + ' to'} ${isReturning ? originCoords : targetCoords}
                    </div>
                    <div class="fleet-tooltip-info">
                        Ships: ${Object.values(fleet.ships).reduce((a, b) => a + b, 0)}
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}
