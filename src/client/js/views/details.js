/**
 * Generic Details Modal View
 * Handles rendering of detailed information for buildings, research, ships, etc.
 */

import { escapeHtml } from '../utils.js';

let returnFocus = null;

/**
 * Render and show the details modal
 * @param {Object} data - The data to display
 * @param {string} data.title - Title of the modal (can include HTML/Icons)
 * @param {string} data.description - Description text
 * @param {string|Array} [data.effects] - Current effects (HTML string or array of objects)
 * @param {Object} [data.table] - Progression table data
 * @param {string[]} data.table.headers - Array of column headers
 * @param {Array[]} data.table.rows - Array of rows, where each row is an array of cell content
 * @param {boolean} [data.table.allowHtml] - Whether cells contain trusted UI markup
 * @param {number} [data.table.highlightRowIndex] - Index of row to highlight (e.g. current level)
 * @param {string} [data.footer] - Optional footer text
 */
export function renderDetailsModal(data) {
    const modal = document.getElementById('details-modal');
    if (!modal) {
        console.error('Details modal container not found');
        return;
    }

    const modalTitle = document.getElementById('details-modal-title');
    const modalBody = document.getElementById('details-modal-body');
    modal.classList?.remove('mission-modal');

    // Set Title
    modalTitle.textContent = data.title;

    // Clean up any existing footer from previous uses
    const existingFooter = modal.querySelector('.modal-footer');
    if (existingFooter) existingFooter.remove();

    // Build Content
    let html = `<div class="details-description">${escapeHtml(data.detailedDescription || data.description)}</div>`;

    // Render Stats (formerly effects)
    if (data.effects) {
        if (typeof data.effects === 'string') {
            html += data.effects;
        } else if (Array.isArray(data.effects) && data.effects.length > 0) {
            html += `<div class="diagnostic-grid">`;
            data.effects.forEach(stat => {
                if (stat.label && stat.value !== undefined) {
                    html += `
                        <div class="stat-box">
                            <div class="stat-header">
                                <span class="stat-icon">${stat.icon || ''}</span>
                                <span class="stat-label">${stat.label.toUpperCase()}</span>
                            </div>
                            <div class="stat-value">${stat.value}</div>
                        </div>`;
                }
            });
            html += `</div>`;
        }
    }

    // Render Sections (for Rapid Fire, etc.)
    if (data.sections && Array.isArray(data.sections)) {
        data.sections.forEach(section => {
            html += `<div class="details-section">
                <div class="section-title">${escapeHtml(section.title).toUpperCase()}</div>`;
            
            if (section.table) {
                html += `
                <div class="stats-table-container">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                ${section.table.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${section.table.rows.map(row => `
                                <tr>
                                    ${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
            }
            
            html += `</div>`;
        });
    }

    // Legacy Table support
    if (data.table && data.table.headers && data.table.rows) {
        html += `
        <div class="details-section">
            <div class="stats-table-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            ${data.table.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.table.rows.map((row, index) => {
                            const isHighlight = index === data.table.highlightRowIndex;
                            const rowClass = isHighlight ? 'current-level-row' : '';
                            return `
                                <tr class="${rowClass}">
                                    ${row.map(cell => `<td>${data.table.allowHtml ? cell : escapeHtml(cell)}</td>`).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    // Render Footer
    if (data.footer) {
        html += `<div class="details-footer">${data.footer}</div>`;
    }

    modalBody.innerHTML = html;
    openDetailsModal();
}

export function openDetailsModal() {
    const modal = document.getElementById('details-modal');
    if (!modal) return;

    if (modal.style.display !== 'flex') returnFocus = document.activeElement;
    modal.style.display = 'flex';
    setupModalCloseHandlers(modal);
    modal.querySelector('.modal-close')?.focus();
}

/**
 * Close the details modal
 */
export function closeDetailsModal() {
    const modal = document.getElementById('details-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList?.remove('mission-modal');
        // Clean up any dynamic footer
        const existingFooter = modal.querySelector('.modal-footer');
        if (existingFooter) existingFooter.remove();
        returnFocus?.focus?.();
        returnFocus = null;
    }
}

function setupModalCloseHandlers(modal) {
    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeDetailsModal();
        }
    };
}

// Expose globally for HTML onclick events
window.closeDetailsModal = closeDetailsModal;
