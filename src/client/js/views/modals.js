/**
 * Modal System for Confirmations and Inputs
 */

let cancelActiveModal = null;

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
    cancelActiveModal?.();
    const previousFocus = document.activeElement;

    const modal = document.getElementById('input-modal');
    const titleEl = document.getElementById('input-modal-title');
    const bodyEl = document.getElementById('input-modal-body');
    const fieldContainer = document.getElementById('input-modal-field-container');
    const field = document.getElementById('input-modal-field');
    const confirmBtn = document.getElementById('input-modal-confirm');
    const cancelBtn = document.getElementById('input-modal-cancel');

    if (!modal) return Promise.resolve(null);

    titleEl.textContent = (options.title || 'Confirm Action').toUpperCase();
    bodyEl.textContent = options.body || '';
    
    if (options.showInput) {
        fieldContainer.style.display = 'block';
        field.value = options.defaultValue || '';
        field.setAttribute('aria-label', options.title || 'Input');
    } else {
        fieldContainer.style.display = 'none';
    }

    confirmBtn.textContent = options.confirmText || 'Confirm';
    cancelBtn.textContent = options.cancelText || 'Cancel';

    modal.style.display = 'flex';
    (options.showInput ? field : confirmBtn).focus();

    return new Promise((resolve) => {
        const finish = (result) => {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            window.removeEventListener('keydown', handleEsc);
            cancelActiveModal = null;
            previousFocus?.focus?.();
            resolve(result);
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                cancelActiveModal();
            }
        };

        cancelActiveModal = () => finish(options.showInput ? null : false);

        confirmBtn.onclick = () => {
            const result = options.showInput ? field.value : true;
            finish(result);
        };

        cancelBtn.onclick = cancelActiveModal;

        window.addEventListener('keydown', handleEsc);
        
        // Click outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                cancelActiveModal();
            }
        };
    });
}

/**
 * Close input modal (exposed globally)
 */
export function closeInputModal() {
    if (cancelActiveModal) cancelActiveModal();
    else document.getElementById('input-modal')?.style.setProperty('display', 'none');
}

// Expose globally
window.closeInputModal = closeInputModal;
