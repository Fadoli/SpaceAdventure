/**
 * Modal System for Confirmations and Inputs
 */

let activeModalPromise = null;

/**
 * Show a confirmation modal
 * @param {string} title - Modal title
 * @param {string} body - Modal message
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false otherwise
 */
export function showConfirm(title, body) {
    return showInputModal({
        title,
        body,
        showInput: false,
        confirmText: 'CONFIRM',
        cancelText: 'CANCEL'
    });
}

/**
 * Show a prompt modal with a text input
 * @param {string} title - Modal title
 * @param {string} body - Modal message
 * @param {string} defaultValue - Initial value for the input field
 * @returns {Promise<string|null>} - Resolves to the input value if confirmed, null otherwise
 */
export function showPrompt(title, body, defaultValue = '') {
    return showInputModal({
        title,
        body,
        showInput: true,
        defaultValue,
        confirmText: 'ESTABLISH',
        cancelText: 'ABORT'
    });
}

/**
 * Internal function to handle modal logic
 */
function showInputModal(options) {
    const modal = document.getElementById('input-modal');
    const titleEl = document.getElementById('input-modal-title');
    const bodyEl = document.getElementById('input-modal-body');
    const fieldContainer = document.getElementById('input-modal-field-container');
    const field = document.getElementById('input-modal-field');
    const confirmBtn = document.getElementById('input-modal-confirm');
    const cancelBtn = document.getElementById('input-modal-cancel');

    if (!modal) return Promise.resolve(null);

    titleEl.textContent = (options.title || 'Confirm Action').toUpperCase();
    bodyEl.innerHTML = options.body || '';
    
    if (options.showInput) {
        fieldContainer.style.display = 'block';
        field.value = options.defaultValue || '';
        setTimeout(() => field.focus(), 50);
    } else {
        fieldContainer.style.display = 'none';
    }

    confirmBtn.textContent = options.confirmText || 'Confirm';
    cancelBtn.textContent = options.cancelText || 'Cancel';

    modal.style.display = 'flex';

    return new Promise((resolve) => {
        const cleanup = () => {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            window.removeEventListener('keydown', handleEsc);
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(null);
            }
        };

        confirmBtn.onclick = () => {
            const result = options.showInput ? field.value : true;
            cleanup();
            resolve(result);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(options.showInput ? null : false);
        };

        window.addEventListener('keydown', handleEsc);
        
        // Click outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(options.showInput ? null : false);
            }
        };
    });
}

/**
 * Close input modal (exposed globally)
 */
export function closeInputModal() {
    const modal = document.getElementById('input-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Expose globally
window.closeInputModal = closeInputModal;
