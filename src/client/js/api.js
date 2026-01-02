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

    async getConfig() {
        return await this.request('/config');
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
    
    async cancelBuilding(planetId, queuePosition = 1) {
        return await this.request(`/game/planet/${planetId}/build`, {
            method: 'DELETE',
            body: JSON.stringify({ queuePosition })
        });
    },
    
    async switchBuildingVariant(planetId, buildingType, toCustom) {
        return await this.request(`/game/planet/${planetId}/building/${buildingType}/variant`, {
            method: 'POST',
            body: JSON.stringify({ toCustom })
        });
    },
    
    async selectCustomVariant(planetId, buildingType, focusLevels) {
        return await this.request(`/game/planet/${planetId}/building/${buildingType}/select-variant`, {
            method: 'POST',
            body: JSON.stringify({ focusLevels })
        });
    },
    
    async getCustomVariantDetails(planetId, buildingType) {
        return await this.request(`/game/planet/${planetId}/building/${buildingType}/variant-details`);
    },
    
    async getBuildings() {
        return await this.request('/game/buildings');
    },
    
    async getBuildingDetails(planetId) {
        return await this.request(`/game/planet/${planetId}/buildings-details`);
    },
    
    async getShipyardDetails(planetId) {
        return await this.request(`/game/planet/${planetId}/shipyard`);
    },
    
    async buildShips(planetId, ships) {
        return await this.request(`/game/planet/${planetId}/shipyard/ships`, {
            method: 'POST',
            body: JSON.stringify({ ships })
        });
    },
    
    async buildDefenses(planetId, defenses) {
        return await this.request(`/game/planet/${planetId}/shipyard/defenses`, {
            method: 'POST',
            body: JSON.stringify({ defenses })
        });
    },
    
    async cancelShipyardProduction(planetId, queueId) {
        return await this.request(`/game/planet/${planetId}/shipyard/${queueId}`, {
            method: 'DELETE',
            body: JSON.stringify({ type: 'ships' })
        });
    },
    
    async getFleetDetails(planetId) {
        return await this.request(`/game/planet/${planetId}/fleet`);
    },
    
    async getGalaxyView(galaxy, system) {
        return await this.request(`/game/galaxy/${galaxy}/${system}`);
    }
};
