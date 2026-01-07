import { formatCountdown, formatTime } from '../utils.js';
import { isEmpty } from '../../../shared/utils.js';

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
 * Handle global tooltip positioning
 */
function setupTooltipHandlers() {
    const tooltip = document.getElementById('fleet-tooltip-global') || createGlobalTooltip();
    
    document.querySelectorAll('.fleet-row').forEach(row => {
        row.addEventListener('mouseenter', (e) => {
            const content = row.querySelector('.fleet-tooltip-content').innerHTML;
            const header = row.querySelector('.fleet-tooltip-header-text').textContent;
            
            tooltip.querySelector('.tooltip-header').textContent = header;
            tooltip.querySelector('.tooltip-body').innerHTML = content;
            tooltip.style.display = 'block';
            
            updateTooltipPosition(e, tooltip);
        });
        
        row.addEventListener('mousemove', (e) => {
            updateTooltipPosition(e, tooltip);
        });
        
        row.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    });
}

function createGlobalTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'fleet-tooltip-global';
    tooltip.className = 'fleet-tooltip-fixed';
    tooltip.innerHTML = `
        <div class="tooltip-header"></div>
        <div class="tooltip-body"></div>
    `;
    document.body.appendChild(tooltip);
    return tooltip;
}

function updateTooltipPosition(e, tooltip) {
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    
    // Keep inside viewport
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const maxX = window.innerWidth - width - 20;
    const maxY = window.innerHeight - height - 20;
    
    tooltip.style.left = Math.min(x, maxX) + 'px';
    tooltip.style.top = Math.min(y, maxY) + 'px';
}

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
            case 'expedition':
                missionIcon = '🚀';
                missionClass = 'mission-expedition';
                break;
        }
        
        if (isReturning) {
            missionClass += ' mission-return';
            missionName = `${missionName} (Returning)`;
        } else if (fleet.waiting) {
            missionClass += ' mission-stay';
            missionName = `${missionName} (Exploring)`;
        } else if (fleet.missionType === 'expedition') {
            missionName = `${missionName} (Traveling)`;
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
            
        const resourceList = (fleet.resources && !isEmpty(fleet.resources)) ? Object.entries(fleet.resources)
            .filter(([_, amount]) => amount > 0)
            .map(([type, amount]) => `${type}: ${amount}`)
            .join('<br>') : '';
            
        // Calculate estimated final return time for traveling/exploring expeditions
        let timelineHtml = '';
        if (fleet.missionType === 'expedition' && !isReturning) {
            const travelDuration = (fleet.arrivalTime - fleet.startTime); // Approximate
            let finalReturn;
            if (fleet.waiting) {
                // Already exploring, final return = now + remaining explore + travel
                finalReturn = formatTime(fleet.arrivalTime + travelDuration);
            } else {
                // Still traveling, final return = now + travel to + stay + travel back
                const stayMs = (fleet.stayTime || 1) * 60 * 60 * 1000;
                finalReturn = formatTime(fleet.arrivalTime + stayMs + travelDuration);
            }
            timelineHtml = `<br><br><strong>Estimated Timeline:</strong><br>
                • Arrives at Target: ${arrivalTime}<br>
                • Return Arrival: ${finalReturn}`;
        }

        const tooltipContent = `
            <strong>Ships:</strong><br>${shipList}
            ${resourceList ? `<br><br><strong>Resources:</strong><br>${resourceList}` : ''}
            ${timelineHtml}
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
                
                <!-- Hidden data for tooltip -->
                <div class="fleet-tooltip-data" style="display: none;">
                    <div class="fleet-tooltip-header-text">${missionName} Details</div>
                    <div class="fleet-tooltip-content">${tooltipContent}</div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    
    container.innerHTML = html;
    
    // Attach handlers after rendering
    setupTooltipHandlers();
}
