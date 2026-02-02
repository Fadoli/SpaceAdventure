import { appendFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const EVENTS_FILE = './data/events.jsonl';

// Ensure data directory exists
const dir = dirname(EVENTS_FILE);
if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
}

/**
 * Log a global event to JSONL
 * @param {string} type - Event type (e.g., 'COMBAT', 'COLONY', 'BUILDING')
 * @param {Object} data - Event data
 */
export async function logEvent(type, data) {
    const event = {
        timestamp: Date.now(),
        type,
        ...data
    };
    
    try {
        const line = JSON.stringify(event) + '\n';
        await appendFile(EVENTS_FILE, line, 'utf-8');
    } catch (error) {
        console.error('[EventLogger] Failed to log event:', error);
    }
}

/**
 * Get recent events from the log
 * @param {number} limit - Number of events to return
 * @returns {Promise<Array>}
 */
export async function getRecentEvents(limit = 100) {
    if (!existsSync(EVENTS_FILE)) return [];
    
    try {
        const file = Bun.file(EVENTS_FILE);
        const text = await file.text();
        if (!text) return [];
        
        const events = Bun.JSONL.parse(text);
        return events.slice(-limit).reverse(); // Newest first
    } catch (error) {
        console.error('[EventLogger] Failed to read events:', error);
        return [];
    }
}
