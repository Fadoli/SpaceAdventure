import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    setupAuthListeners();
});

async function withPendingState(form, action) {
    if (form.getAttribute('aria-busy') === 'true') return;
    const button = form.querySelector('button[type="submit"]');
    form.setAttribute('aria-busy', 'true');
    button.disabled = true;
    try {
        await action();
    } finally {
        form.removeAttribute('aria-busy');
        button.disabled = false;
    }
}

function setupAuthListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedButton = e.currentTarget;
            const tab = selectedButton.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => {
                const active = b === selectedButton;
                b.classList.toggle('active', active);
                b.setAttribute('aria-pressed', String(active));
            });
            document.querySelectorAll('.auth-form').forEach(f => {
                const active = f.id === `${tab}-form`;
                f.classList.toggle('active', active);
                f.hidden = !active;
            });
            
        });
    });
    
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await withPendingState(e.currentTarget, async () => {
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            try {
                errorEl.classList.remove('show');
                await API.login(username, password);
                window.location.href = '/';
            } catch (error) {
                errorEl.textContent = error.message;
                errorEl.classList.add('show');
            }
        });
    });
    
    // Register form
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        await withPendingState(e.currentTarget, async () => {
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;
            const email = document.getElementById('register-email').value;
            const errorEl = document.getElementById('register-error');

            try {
                errorEl.classList.remove('show');
                await API.register(username, password, email);
                window.location.href = '/';
            } catch (error) {
                errorEl.textContent = error.message;
                errorEl.classList.add('show');
            }
        });
    });
}
