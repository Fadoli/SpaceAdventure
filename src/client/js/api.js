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
        
        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error(response.ok ? 'Invalid server response' : `Request failed (${response.status})`);
        }
        
        if (!response.ok || !data.success) {
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

    async demolishBuilding(planetId, buildingType) {
        return await this.request(`/game/planet/${planetId}/building/${buildingType}/demolish`, {
            method: 'POST'
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

    async updatePlanetAllocations(planetId, allocations) {
        return await this.request(`/game/planet/${planetId}/allocations`, {
            method: 'POST',
            body: JSON.stringify({ allocations })
        });
    },

    async getRankings(offset = 0, limit = 100, category = 'total') {
        return await this.request(`/game/rankings?offset=${offset}&limit=${limit}&category=${category}`);
    },

    async getMyRank() {
        return await this.request('/game/rank-index');
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
    
    async cancelShipyardProduction(planetId, queueId, type = 'ships') {
        return await this.request(`/game/planet/${planetId}/shipyard/${queueId}`, {
            method: 'DELETE',
            body: JSON.stringify({ type })
        });
    },
    
    async getFleetDetails(planetId) {
        return await this.request(`/game/planet/${planetId}/fleet`);
    },

    async recallFleet(fleetId) {
        return await this.request(`/game/fleet/${fleetId}/recall`, {
            method: 'POST'
        });
    },
    
    async getGalaxyView(galaxy, system) {
        return await this.request(`/game/galaxy/${galaxy}/${system}`);
    },

    async renamePlanet(planetId, newName) {
        return await this.request(`/game/planet/${planetId}/rename`, {
            method: 'POST',
            body: JSON.stringify({ name: newName })
        });
    },

    async resetPracticalResearch(baseType) {
        return await this.request('/game/research/practical/reset', {
            method: 'POST',
            body: JSON.stringify({ baseType })
        });
    },

    async getMessages() {
        return await this.request('/game/messages');
    },

    async markMessageRead(messageId) {
        return await this.request(`/game/messages/${messageId}/read`, {
            method: 'POST'
        });
    },

    async deleteMessage(messageId) {
        return await this.request(`/game/messages/${messageId}`, {
            method: 'DELETE'
        });
    },

    async clearMessages() {
        return await this.request('/game/messages', {
            method: 'DELETE'
        });
    },

    async getAlliances() {
        return await this.request('/game/alliances');
    },

    async getAlliance(allianceId) {
        return await this.request(`/game/alliance/${allianceId}`);
    },

    async createAlliance(name, tag) {
        return await this.request('/game/alliance/create', {
            method: 'POST',
            body: JSON.stringify({ name, tag })
        });
    },

    async joinAlliance(allianceId) {
        return await this.request(`/game/alliance/join/${allianceId}`, {
            method: 'POST'
        });
    },

    async leaveAlliance() {
        return await this.request('/game/alliance/leave', {
            method: 'POST'
        });
    },

    async updateRelation(targetUserId, tag) {
        return await this.request('/game/relation', {
            method: 'POST',
            body: JSON.stringify({ targetUserId, tag })
        });
    },

    async getFriends() {
        return await this.request('/game/friends');
    },

    async shareBlueprint(baseType, blueprintId, type, targetType, targetId = null) {
        return await this.request('/game/blueprints/share', {
            method: 'POST',
            body: JSON.stringify({ baseType, blueprintId, type, targetType, targetId })
        });
    },

    async getAllianceMessages() {
        return await this.request('/game/alliance/messages');
    },

    async sendAllianceMessage(content) {
        return await this.request('/game/alliance/messages', {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    },

    async shareReportToAlliance(messageId) {
        return await this.request('/game/alliance/share-report', {
            method: 'POST',
            body: JSON.stringify({ messageId })
        });
    },

    async simulateCombat(attacker, defender) {
        return await this.request('/game/simulate', {
            method: 'POST',
            body: JSON.stringify({ attacker, defender })
        });
    }
};
