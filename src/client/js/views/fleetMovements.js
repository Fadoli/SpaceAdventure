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

let lastFleetSignature = '';

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
        lastFleetSignature = '';
        return;
    }
    
    container.classList.add('active');
    
    // Sort fleets by arrival time (next event)
    const sortedFleets = [...gameState.fleets].sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    // Generate signature to detect structural changes
    const currentSignature = sortedFleets.map(f => `${f.id}-${f.missionType}-${f.returning}-${f.waiting}`).join('|');
    
    // Check if header/structure exists
    let header = document.getElementById('fleet-header');
    let list = document.getElementById('fleet-list');
    
    const count = sortedFleets.length;
    
    // If full re-render needed (structure missing or fleet list changed)
    if (!header || !list || currentSignature !== lastFleetSignature) {
        // Check saved collapse state
        let isCollapsed = false;
        if (header) {
            isCollapsed = header.classList.contains('collapsed');
        } else {
            isCollapsed = localStorage.getItem('fleetViewCollapsed') === 'true';
        }
        
        const collapseClass = isCollapsed ? 'collapsed' : '';
        const arrow = isCollapsed ? '▼' : '▲';
        
        container.innerHTML = `
            <div id="fleet-header" class="fleet-header ${collapseClass}" onclick="window.toggleFleetMovements()">
                <span class="header-title">Fleet Movements (${count})</span>
                <span class="toggle-icon">${arrow}</span>
            </div>
            <div id="fleet-list" class="fleet-list ${collapseClass}">
                ${sortedFleets.map(f => renderFleetRow(f)).join('')}
            </div>
        `;
        
        // Attach handlers after rendering
        setupTooltipHandlers();
        lastFleetSignature = currentSignature;
    } else {
        // Partial Update: Just update timers and header count
        const title = header.querySelector('.header-title');
        if (title) title.textContent = `Fleet Movements (${count})`;
        
        sortedFleets.forEach(fleet => {
            const row = document.getElementById(`fleet-row-${fleet.id}`);
            if (row) {
                const now = Date.now();
                const timeRemaining = Math.max(0, Math.floor((fleet.arrivalTime - now) / 1000));
                
                // Update timer
                const timerEl = row.querySelector('.fleet-timer');
                if (timerEl) timerEl.textContent = formatCountdown(timeRemaining);
                
                // Skip if expired (handled by signature change on next tick usually)
                if (timeRemaining <= 0) return;
            }
        });
    }
}

function renderFleetRow(fleet) {
    const now = Date.now();
    const isReturning = fleet.returning;
    const timeRemaining = Math.max(0, Math.floor((fleet.arrivalTime - now) / 1000));
    
    // Skip if expired (server will clean up)
    if (timeRemaining <= 0) return '';
    
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

    // Helper to generate clickable coord
    const createCoordLink = (coords) => {
        const [g, s, p] = coords;
        return `<span class="clickable-coord" onclick="event.stopPropagation(); window.navigateToCoords(${g}, ${s}, ${p});">[${coords.join(':')}]</span>`;
    };

    const originLink = createCoordLink(fleet.originCoords);
    const targetLink = createCoordLink(fleet.targetCoords);

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
    
    return `
        <div id="fleet-row-${fleet.id}" class="fleet-row ${missionClass}">
            <div class="fleet-info-cell type-cell">
                <span class="mission-icon">${missionIcon}</span>
                <span class="mission-name">${missionName}</span>
            </div>
            
            <div class="fleet-info-cell coords-cell">
                <span class="coord-from">${originLink}</span>
                <span class="coord-arrow">➔</span>
                <span class="coord-to">${targetLink}</span>
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
