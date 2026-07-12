import { expect, test, describe, beforeAll } from "bun:test";
import { getPlayerByUserId, createPlayer, getPlayers } from "../../src/server/game/player.js";
import { initializeStorage } from "../../src/server/storage/storage.js";

describe("Admin Search Data Integrity", () => {
    let testUser;

    beforeAll(async () => {
        await initializeStorage();
        // Create a test player if not exists
        testUser = await createPlayer("test-admin-id", "testadminuser");
    });

    test("getPlayerByUserId should return planets with resources", async () => {
        const player = await getPlayerByUserId("test-admin-id");
        expect(player).not.toBeNull();
        expect(player.planets).toBeDefined();
        expect(player.planets.length).toBeGreaterThan(0);
        
        const planet = player.planets[0];
        expect(planet.resources).toBeDefined();
        expect(planet.resources.metal).toBeDefined();
        expect(planet.buildings).toBeDefined();
        expect(planet.ships).toBeDefined();
        expect(planet.defenses).toBeDefined();
    });

    test("Search logic serialization", async () => {
        const query = "testadminuser";
        const allPlayers = await getPlayers();
        const filtered = allPlayers.filter(p => 
            p.username.toLowerCase().includes(query) || 
            p.userId.includes(query)
        );

        const matches = await Promise.all(filtered.map(async p => {
            const fullPlayer = await getPlayerByUserId(p.userId);
            return {
                userId: fullPlayer.userId,
                username: fullPlayer.username,
                research: fullPlayer.research || {},
                planets: fullPlayer.planets
            };
        }));

        expect(matches.length).toBeGreaterThan(0);
        const match = matches[0];
        expect(match.planets[0].resources).toBeDefined();
        expect(match.planets[0].buildings).toBeDefined();
        
        // Simulate JSON serialization/deserialization
        const serialized = JSON.parse(JSON.stringify(match));
        expect(serialized.planets[0].resources).toBeDefined();
        expect(serialized.planets[0].resources.metal).toBeDefined();
    });
});
