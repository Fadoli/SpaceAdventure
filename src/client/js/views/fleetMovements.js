import { formatCountdown, formatTime } from '../utils.js';

// Global toggle handler
window.toggleFleetMovements = function() {
    const list = document.getElementById('fleet-list');
    const header = document.getElementById('fleet-header');
    if (list && header) {
        list.classList.toggle('collapsed');
        header.classList.toggle('collapsed');
        
        // Save state preference
        localStorage.setItem('fleetViewCollapsed', list.classList.contains('collapsed'));
    }
};

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
    
    // Sort fleets by arrival time
    const sortedFleets = [...gameState.fleets].sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    // Check saved collapse state or current DOM state
    const currentList = document.getElementById('fleet-list');
    let isCollapsed = false;
    if (currentList) {
        isCollapsed = currentList.classList.contains('collapsed');
    } else {
        isCollapsed = localStorage.getItem('fleetViewCollapsed') === 'true';
    }
    
    const count = sortedFleets.length;
    const collapseClass = isCollapsed ? 'collapsed' : '';
    const arrow = isCollapsed ? '▼' : '▲';
    
    let html = `
        <div id="fleet-header" class="fleet-header ${collapseClass}" onclick="window.toggleFleetMovements()">
            <span class="header-title">Fleet Movements (${count})</span>
            <span class="toggle-icon">${arrow}</span>
        </div>
        <div id="fleet-list" class="fleet-list ${collapseClass}">
    `;
    
    for (const fleet of sortedFleets) {
        const isReturning = fleet.returning;
        const timeRemaining = Math.max(0, Math.floor((fleet.arrivalTime - now) / 1000));
        
        // Skip if expired (server will clean up)
        if (timeRemaining <= 0) continue;
        
        let missionIcon = '🚀';
        let missionClass = 'mission-transport';
        let missionName = fleet.missionType.charAt(0).toUpperCase() + fleet.missionType.slice(1);
        
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
            missionClass += ' mission-return';
            missionName = `${missionName} (R)`;
        }
        
        const originCoords = `[${fleet.originCoords.join(':')}]`;
        const targetCoords = `[${fleet.targetCoords.join(':')}]`;
        const startTime = formatTime(fleet.startTime);
        const arrivalTime = formatTime(fleet.arrivalTime);
        
        // Generate ship list for tooltip
        const shipList = Object.entries(fleet.ships)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => `${type}: ${count}`)
            .join('<br>');
            
        const resourceList = fleet.resources ? Object.entries(fleet.resources)
            .filter(([_, amount]) => amount > 0)
            .map(([type, amount]) => `${type}: ${amount}`)
            .join('<br>') : '';
            
        const tooltipContent = `
            <strong>Ships:</strong><br>${shipList}
            ${resourceList ? `<br><br><strong>Resources:</strong><br>${resourceList}` : ''}
        `;
        
        html += `
            <div class="fleet-row ${missionClass}">
                <div class="fleet-info-cell type-cell">
                    <span class="mission-icon">${missionIcon}</span>
                    <span class="mission-name">${missionName}</span>
                </div>
                
                <div class="fleet-info-cell coords-cell">
                    <span class="coord-from">${originCoords}</span>
                    <span class="coord-arrow">➔</span>
                    <span class="coord-to">${targetCoords}</span>
                </div>
                
                <div class="fleet-info-cell time-cell">
                    <span class="time-range">${startTime} - ${arrivalTime}</span>
                </div>
                
                <div class="fleet-info-cell timer-cell">
                    <span class="fleet-timer">${formatCountdown(timeRemaining)}</span>
                </div>
                
                <div class="fleet-tooltip">
                    <div class="tooltip-header">${missionName} Details</div>
                    <div class="tooltip-body">${tooltipContent}</div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    
    container.innerHTML = html;
}