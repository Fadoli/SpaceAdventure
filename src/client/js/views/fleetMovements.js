import { escapeHtml, formatCountdown, formatTime, formatNumber } from '../utils.js';
import { isEmpty } from '../../../shared/utils.js';

// Global toggle handler
window.toggleFleetMovements = function() {
    const list = document.getElementById('fleet-list');
    const header = document.getElementById('fleet-header');
    if (list && header) {
        const collapsed = list.classList.toggle('collapsed');
        header.classList.toggle('collapsed', collapsed);
        header.setAttribute('aria-expanded', String(!collapsed));
        header.querySelector('.header-status-text').textContent = collapsed ? 'DATA FEED COLLAPSED' : 'ACTIVE OPERATIONS';
        header.querySelector('.toggle-icon').textContent = collapsed ? '▼' : '▲';
        
        // Save state preference
        localStorage.setItem('fleetViewCollapsed', collapsed);
    }
};

/**
 * Handle global tooltip positioning
 */
function setupTooltipHandlers() {
    const tooltip = document.getElementById('fleet-tooltip-global') || createGlobalTooltip();
    
    document.querySelectorAll('.fleet-row').forEach(row => {
        row.addEventListener('mouseenter', (e) => {
            const contentEl = row.querySelector('.fleet-tooltip-content');
            const headerEl = row.querySelector('.fleet-tooltip-header-text');
            
            if (!contentEl || !headerEl) return;

            const content = contentEl.innerHTML;
            const header = headerEl.textContent;
            
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
    
    const allFleets = [...(gameState?.fleets || []), ...(gameState?.hostileFleets || [])];

    // If no fleets, clear container
    if (allFleets.length === 0) {
        if (container.innerHTML !== '') {
            container.innerHTML = '';
            container.classList.remove('active');
            lastFleetSignature = '';
        }
        return;
    }
    
    if (!container.classList.contains('active')) container.classList.add('active');
    
    // Sort fleets by arrival time (next event)
    const sortedFleets = allFleets.sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    // Generate signature to detect structural changes (ID, Mission, Returning, Waiting, Hostile)
    const currentSignature = sortedFleets.map(f => `${f.id}-${f.missionType}-${f.returning}-${f.waiting}-${f.isHostile ? 'h' : 'f'}`).join('|');
    
    // Check if header/structure exists
    let header = document.getElementById('fleet-header');
    let list = document.getElementById('fleet-list');
    
    const count = sortedFleets.length;
    
    // 1. Structural update check
    if (!header || !list || currentSignature !== lastFleetSignature) {
        // Check saved collapse state
        let isCollapsed = false;
        if (header) {
            isCollapsed = header.classList.contains('collapsed');
        } else {
            isCollapsed = localStorage.getItem('fleetViewCollapsed') === 'true';
        }
        
        const collapseClass = isCollapsed ? 'collapsed' : '';
        const statusText = isCollapsed ? 'DATA FEED COLLAPSED' : 'ACTIVE OPERATIONS';
        
        container.innerHTML = `
            <button type="button" id="fleet-header" class="fleet-header ${collapseClass}" onclick="window.toggleFleetMovements()" aria-expanded="${!isCollapsed}" aria-controls="fleet-list">
                <span class="header-left-group">
                    <span class="header-title">FLEET TELEMETRY FEED</span>
                    <span class="header-stats-tag">${count} ACTIVE SIGNATURES</span>
                </span>
                <span class="header-right-group">
                    <span class="header-status-text">${statusText}</span>
                    <span class="toggle-icon">${isCollapsed ? '▼' : '▲'}</span>
                </span>
            </button>
            <div id="fleet-list" class="fleet-list ${collapseClass}">
                ${sortedFleets.map(f => renderFleetRow(f)).join('')}
            </div>
        `;
        
        // Attach handlers after rendering
        setupTooltipHandlers();
        lastFleetSignature = currentSignature;
    } else {
        // 2. Granular Update: Just update timers and header count
        const statsTag = header.querySelector('.header-stats-tag');
        if (statsTag && statsTag.textContent !== `${count} ACTIVE SIGNATURES`) {
            statsTag.textContent = `${count} ACTIVE SIGNATURES`;
        }
        
        sortedFleets.forEach(fleet => {
            const row = document.getElementById(`fleet-row-${fleet.id}`);
            if (row) {
                const now = Date.now();
                const timeRemaining = Math.max(0, Math.floor((fleet.arrivalTime - now) / 1000));
                
                // Update timer
                const timerEl = row.querySelector('.fleet-timer');
                if (timerEl) {
                    const timerText = formatCountdown(timeRemaining);
                    if (timerEl.textContent !== timerText) timerEl.textContent = timerText;
                }
            }
        });
    }
}

export function renderFleetRow(fleet) {
    const now = Date.now();
    const isReturning = fleet.returning;
    const timeRemaining = Math.max(0, Math.floor((fleet.arrivalTime - now) / 1000));
    const isHostile = fleet.isHostile;
    
    // Skip if expired (server will clean up)
    if (timeRemaining <= 0) return '';
    
    let missionClass = isHostile ? 'mission-hostile' : 'mission-transport';
    let missionName = fleet.missionType.toUpperCase();
    
    if (!isHostile) {
        switch (fleet.missionType) {
            case 'attack': missionClass = 'mission-attack'; break;
            case 'espionage': missionClass = 'mission-espionage'; break;
            case 'colonize': missionClass = 'mission-colonize'; break;
            case 'transport': missionClass = 'mission-transport'; break;
            case 'deploy': missionClass = 'mission-deploy'; break;
            case 'expedition': missionClass = 'mission-expedition'; break;
        }
    } else {
        missionClass = 'mission-attack'; // All hostiles look like attacks for now or keep their type
        if (fleet.missionType === 'espionage') missionClass = 'mission-espionage';
    }
    
    let statusLabel = isHostile ? 'INBOUND' : 'EN ROUTE';
    if (isReturning) {
        missionClass += ' mission-return';
        statusLabel = 'RETURNING';
    } else if (fleet.waiting) {
        missionClass += ' mission-stay';
        statusLabel = 'OPERATING';
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
    
    // Return time logic
    let returnTimeHtml = '';
    if (!isReturning && !isHostile && fleet.missionType !== 'deploy') {
        let finalArrivalTime;
        if (fleet.waiting) {
            // Already at target (Operating), arrivalTime is when stay ends
            // Use server-provided travelTime if available, otherwise estimate from leg history
            const returnTravelMs = (fleet.travelTime * 1000) || (fleet.arrivalTime - fleet.startTime);
            finalArrivalTime = fleet.arrivalTime + returnTravelMs;
        } else {
            // Traveling to target (En Route)
            const travelDurationMs = (fleet.arrivalTime - fleet.startTime);
            const stayMs = fleet.missionType === 'expedition' ? (fleet.stayTime || 1) * 3600 * 1000 : 0;
            finalArrivalTime = fleet.arrivalTime + stayMs + travelDurationMs;
        }
        returnTimeHtml = `<span class="return-eta" title="Estimated Return Time"> | ${formatTime(finalArrivalTime)}</span>`;
    }

    // Resource summary for the row
    let resSummary = '';
    if (fleet.resources && !isEmpty(fleet.resources)) {
        const entries = Object.entries(fleet.resources).filter(([_, amount]) => amount > 0);
        if (entries.length > 0) {
            resSummary = entries.map(([type, amount]) => {
                const icon = { metal: '⚙️', crystal: '💎', deuterium: '🛢️', water: '💦', food: '🍞' }[type] || '';
                return `<span>${icon}${formatNumber(amount)}</span>`;
            }).join(' ');
        }
    }

    // Tooltip content
    let tooltipContent = '';
    if (isHostile) {
        tooltipContent = `
            <strong>THREAT SOURCE:</strong> ${escapeHtml(fleet.ownerName || 'UNKNOWN')}<br>
            <strong>MISSION:</strong> ${missionName}<br><br>
            <em>Sensors cannot determine vessel composition of hostile fleets.</em>
        `;
    } else {
        // Generate ship list for tooltip
        const shipList = Object.entries(fleet.ships)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => `${type.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}: ${count}`)
            .join('<br>');
            
        const resourceList = (fleet.resources && !isEmpty(fleet.resources)) ? Object.entries(fleet.resources)
            .filter(([_, amount]) => amount > 0)
            .map(([type, amount]) => `${type.toUpperCase()}: ${amount}`)
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
            timelineHtml = `<br><br><strong>ESTIMATED TIMELINE:</strong><br>
                • TARGET ARRIVAL: ${arrivalTime}<br>
                • RETURN ARRIVAL: ${finalReturn}`;
        }

        tooltipContent = `
            <strong>VESSEL COMPOSITION:</strong><br>${shipList}
            ${resourceList ? `<br><br><strong>CARGO MANIFEST:</strong><br>${resourceList}` : ''}
            ${timelineHtml}
        `;
    }
    
    return `
        <div id="fleet-row-${fleet.id}" class="fleet-row ${missionClass} ${isHostile ? 'hostile' : ''}">
            <div class="fleet-info-cell type-cell">
                <span class="mission-status-tag">${statusLabel}</span>
                <span class="mission-name">${isHostile ? 'HOSTILE ' : ''}${missionName}</span>
            </div>
            
            <div class="fleet-info-cell coords-cell">
                <span class="coord-from">${originLink}</span>
                <span class="coord-arrow">${isHostile ? '<<< ALERT <<<' : '>>>'}</span>
                <span class="coord-to">${targetLink}</span>
            </div>

            <div class="fleet-info-cell res-cell">
                ${resSummary}
            </div>
            
            <div class="fleet-info-cell time-cell">
                <span class="time-range">${startTime} -> ${arrivalTime}</span>
                ${returnTimeHtml}
            </div>
            
            <div class="fleet-info-cell timer-cell">
                <span class="fleet-timer">${formatCountdown(timeRemaining)}</span>
            </div>
            
            <!-- Hidden data for tooltip -->
            <div class="fleet-tooltip-data" style="display: none;">
                <div class="fleet-tooltip-header-text">${isHostile ? 'THREAT DATA' : missionName + ' OPS DETAILS'}</div>
                <div class="fleet-tooltip-content">${tooltipContent}</div>
            </div>
        </div>
    `;
}
