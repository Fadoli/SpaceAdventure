// API Client
import { hashPassword } from './utils.js';

const API_BASE = '/api';

export const API = {
    async request(endpoint, options = {}) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data.data;
    },
    
    async register(username, password, email) {
        // Hash password on client side before sending
        const hashedPassword = await hashPassword(password);
        return await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password: hashedPassword, email })
        });
    },
    
    async login(username, password) {
        // Hash password on client side before sending
        const hashedPassword = await hashPassword(password);
        return await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password: hashedPassword })
        });
    },
    
    async logout() {
        return await this.request('/auth/logout', {
            method: 'POST'
        });
    },
    
    async getCurrentUser() {
        return await this.request('/auth/me');
    },
    
    async getGameState() {
        return await this.request('/game/state');
    },
    
    async upgradeBuilding(planetId, building) {
        return await this.request(`/game/planet/${planetId}/build`, {
            method: 'POST',
            body: JSON.stringify({ building })
        });
    },
    
    async cancelBuilding(planetId) {
        return await this.request(`/game/planet/${planetId}/build`, {
            method: 'DELETE'
        });
    },
    
    async getBuildings() {
        return await this.request('/game/buildings');
    }
};
