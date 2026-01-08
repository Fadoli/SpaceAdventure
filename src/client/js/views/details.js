/**
 * Generic Details Modal View
 * Handles rendering of detailed information for buildings, research, ships, etc.
 */

/**
 * Render and show the details modal
 * @param {Object} data - The data to display
 * @param {string} data.title - Title of the modal (can include HTML/Icons)
 * @param {string} data.description - Description text
 * @param {string|Array} [data.effects] - Current effects (HTML string or array of objects)
 * @param {Object} [data.table] - Progression table data
 * @param {string[]} data.table.headers - Array of column headers
 * @param {Array[]} data.table.rows - Array of rows, where each row is an array of cell content
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

    // Set Title
    modalTitle.innerHTML = data.title;

    // Build Content
    let html = `<div class="details-description">${data.detailedDescription || data.description}</div>`;

    // Render Effects
    if (data.effects) {
        if (typeof data.effects === 'string') {
            html += data.effects;
        } else if (Array.isArray(data.effects) && data.effects.length > 0) {
            html += `<div class="details-effects">`;
            data.effects.forEach(effect => {
                if (effect.title) html += `<strong>${effect.title}</strong>`;
                if (effect.items) {
                    html += `<ul>${effect.items.map(item => `<li>${item}</li>`).join('')}</ul>`;
                } else if (effect.label && effect.value) {
                    html += `<div>${effect.label}: ${effect.value}</div>`;
                }
            });
            html += `</div>`;
        }
    }

    // Render Table
    if (data.table && data.table.headers && data.table.rows) {
        html += `<div class="stats-table-container">
            <table class="stats-table">
                <thead>
                    <tr>
                        ${data.table.headers.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.table.rows.map((row, index) => {
                        const isHighlight = index === data.table.highlightRowIndex;
                        const rowClass = isHighlight ? 'current-level-row' : '';
                        return `
                            <tr class="${rowClass}">
                                ${row.map(cell => `<td>${cell}</td>`).join('')}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
    }

    // Render Footer
    if (data.footer) {
        html += `<div class="details-footer">${data.footer}</div>`;
    }

    modalBody.innerHTML = html;
    modal.style.display = 'block';

    // Event listeners for closing are handled globally or set up once
    // We ensure they are set up here just in case, but ideally should be in main.js or init
    setupModalCloseHandlers(modal);
}

/**
 * Close the details modal
 */
export function closeDetailsModal() {
    const modal = document.getElementById('details-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export function setupModalCloseHandlers(modal) {
    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeDetailsModal();
        }
    };
}

// Expose globally for HTML onclick events
window.closeDetailsModal = closeDetailsModal;
