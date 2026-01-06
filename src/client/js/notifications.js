/**
 * Lightweight Notification System
 */

export const Notifications = {
    /**
     * Show a success notification
     */
    showSuccess(message, duration = 5000) {
        this.show(message, 'success', duration);
    },

    /**
     * Show an error notification
     */
    showError(message, duration = 7000) {
        this.show(message, 'error', duration);
    },

    /**
     * Show an info notification
     */
    showInfo(message, duration = 5000) {
        this.show(message, 'info', duration);
    },

    /**
     * Internal generic show function
     */
    show(message, type, duration) {
        const container = document.getElementById('notifications-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        
        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
            <span class="notification-close">&times;</span>
        `;

        container.appendChild(notification);

        // Auto-remove after duration
        const timer = setTimeout(() => {
            this.remove(notification);
        }, duration);

        // Manual close
        notification.querySelector('.notification-close').onclick = () => {
            clearTimeout(timer);
            this.remove(notification);
        };
    },

    remove(el) {
        el.classList.add('removing');
        el.addEventListener('animationend', () => {
            el.remove();
        });
    }
};

// Global expose
window.Notifications = Notifications;
