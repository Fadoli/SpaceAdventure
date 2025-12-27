// Main server application
import { 
  registerUser, 
  authenticateUser, 
  createSession, 
  deleteSession, 
  getUserFromSession 
} from './auth/auth.js';
import { initializeStorage } from './storage/storage.js';
import { createPlayer, getPlayerByUserId, updatePlayer } from './game/player.js';
import { upgradeBuilding, cancelBuilding, processCompletedBuildings, updateBuildingAllocation, updatePlanetAllocations, getBuildingCost, getBuildTime, getProduction, getStorageIncrease } from './game/buildings.js';
import { buildShips, buildDefenses, cancelProduction, processCompletedProduction, getShipyardDetails } from './game/shipyard.js';
import { startGameLoop } from './game/gameLoop.js';
import { BUILDINGS } from '../shared/buildings.js';
import { SHIPS } from '../shared/ships.js';
import { DEFENSES } from '../shared/defenses.js';
import { loadConfig, getBuildQueueSize } from './config.js';

// Load configuration
await loadConfig();

// Initialize storage on startup
await initializeStorage();

// Start game loop
startGameLoop();

const PORT = process.env.PORT || 3000;

// Helper to get cookie value
function getCookie(req, name) {
  const cookies = req.headers.get('cookie');
  if (!cookies) return null;
  
  const cookie = cookies.split(';').find(c => c.trim().startsWith(`${name}=`));
  return cookie ? cookie.split('=')[1] : null;
}

// Helper to create cookie string
function createCookie(name, value, maxAge) {
  return `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

// Middleware to check authentication
async function requireAuth(req) {
  const sessionToken = getCookie(req, 'session');
  if (!sessionToken) {
    return null;
  }
  
  const user = await getUserFromSession(sessionToken);
  return user;
}

// API Response helper
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

// Error response helper
function errorResponse(message, status = 400) {
  return jsonResponse({
    success: false,
    error: message,
    timestamp: Date.now()
  }, status);
}

// Success response helper
function successResponse(data) {
  return jsonResponse({
    success: true,
    data,
    timestamp: Date.now()
  });
}

// Request handler
async function handleRequest(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Static file serving
    if (path === '/' || !path.startsWith('/api/')) {
      const filePath = path === '/' ? '/src/client/index.html' : path;
      const file = Bun.file(`.${filePath}`);
      
      if (await file.exists()) {
        return new Response(file);
      }
      
      // If not found and not an API route, serve index.html (SPA routing)
      if (!path.startsWith('/api/')) {
        const indexFile = Bun.file('./src/client/index.html');
        if (await indexFile.exists()) {
          return new Response(indexFile);
        }
      }
      
      return new Response('Not Found', { status: 404 });
    }
    
    // API Routes
    
    // POST /api/auth/register
    if (path === '/api/auth/register' && method === 'POST') {
      const body = await req.json();
      const { username, password, email } = body;
      
      const user = await registerUser(username, password, email);
      const sessionToken = createSession(user.id);
      
      // Create player game state
      await createPlayer(user.id, user.username);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          sessionToken
        },
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          'Set-Cookie': createCookie('session', sessionToken, 86400)
        }
      });
    }
    
    // POST /api/auth/login
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await req.json();
      const { username, password } = body;
      
      const user = await authenticateUser(username, password);
      const sessionToken = createSession(user.id);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          sessionToken
        },
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          'Set-Cookie': createCookie('session', sessionToken, 86400)
        }
      });
    }
    
    // POST /api/auth/logout
    if (path === '/api/auth/logout' && method === 'POST') {
      const sessionToken = getCookie(req, 'session');
      if (sessionToken) {
        deleteSession(sessionToken);
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: null,
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          'Set-Cookie': createCookie('session', '', 0)
        }
      });
    }
    
    // GET /api/auth/me
    if (path === '/api/auth/me' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      return successResponse({
        userId: user.id,
        username: user.username,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
    }
    
    // GET /api/game/state
    if (path === '/api/game/state' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      // Process any completed buildings
      const updated = await processCompletedBuildings(player);
      if (updated) {
        await updatePlayer(user.id, player);
      }
      
      return successResponse(player);
    }
    
    // POST /api/game/planet/:planetId/build
    if (path.startsWith('/api/game/planet/') && path.endsWith('/build') && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const body = await req.json();
      const { building } = body;
      
      try {
        const result = await upgradeBuilding(user.id, planetId, building);
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // DELETE /api/game/planet/:planetId/build
    if (path.startsWith('/api/game/planet/') && path.endsWith('/build') && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const body = await req.json().catch(() => ({}));
      const queuePosition = body.queuePosition || 1;
      
      try {
        const result = await cancelBuilding(user.id, planetId, queuePosition);
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // POST /api/planet/:planetId/building/:buildingType/allocation
    if (path.match(/^\/api\/planet\/[^/]+\/building\/[^/]+\/allocation$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[3];
      const buildingType = pathParts[5];
      const body = await req.json();
      const { power, population } = body;
      
      try {
        const result = await updateBuildingAllocation(user.id, planetId, buildingType, power, population);
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // GET /api/game/buildings
    if (path === '/api/game/buildings' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      // Return building definitions (without exposing internal structure)
      const buildingInfo = {};
      for (const [key, building] of Object.entries(BUILDINGS)) {
        buildingInfo[key] = {
          name: building.name,
          description: building.description,
          maxLevel: building.maxLevel
        };
      }
      
      return successResponse(buildingInfo);
    }
    
    // GET /api/game/planet/:planetId/buildings-details
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/buildings-details$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }
      
      // Calculate building details for each building type
      const buildingsDetails = {};
      const maxQueueSize = getBuildQueueSize();
      
      for (const [buildingType, buildingDef] of Object.entries(BUILDINGS)) {
        const currentLevel = planet.buildings[buildingType] || 0;
        const nextLevel = currentLevel + 1;
        
        // Calculate cost for next level
        const cost = getBuildingCost(buildingType, nextLevel);
        
        // Calculate build time
        const roboticsLevel = planet.buildings.roboticsFactory || 0;
        const naniteLevel = planet.buildings.naniteFactory || 0;
        const buildTime = getBuildTime(buildingType, nextLevel, roboticsLevel, naniteLevel);
        
        // Calculate production for next level
        const production = getProduction(buildingType, nextLevel);
        
        // Calculate energy consumption for next level
        let energyConsumption = 0;
        if (buildingDef.energyConsumption) {
          const productionMultiplier = 10.0; // From config
          energyConsumption = Math.floor(buildingDef.energyConsumption * nextLevel * Math.pow(1.1, nextLevel) * productionMultiplier);
        }
        
        // Check if can afford
        const canAfford = planet.resources.metal >= cost.metal &&
                         planet.resources.crystal >= cost.crystal &&
                         planet.resources.deuterium >= cost.deuterium;
        
        buildingsDetails[buildingType] = {
          name: buildingDef.name,
          description: buildingDef.description,
          icon: buildingDef.icon || '',
          currentLevel,
          nextLevel,
          maxLevel: buildingDef.maxLevel,
          cost,
          buildTime,
          production,
          energyConsumption,
          canAfford
        };
      }
      
      return successResponse({
        buildings: buildingsDetails,
        queue: planet.buildQueue || [],
        maxQueueSize
      });
    }
    
    // POST /api/planet/:planetId/allocations - Update all building allocations at once
    if (path.match(/^\/api\/planet\/[^\/]+\/allocations$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const parts = path.split('/');
      const planetId = parts[3];
      
      const body = await req.json();
      const { allocations } = body;
      
      if (!allocations || typeof allocations !== 'object') {
        return errorResponse('Missing or invalid allocations in request', 400);
      }
      
      try {
        const result = await updatePlanetAllocations(user.id, planetId, allocations);
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // POST /api/planet/:planetId/building/:buildingType/allocation
    if (path.match(/^\/api\/planet\/[^\/]+\/building\/[^\/]+\/allocation$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const parts = path.split('/');
      const planetId = parts[3];
      const buildingType = parts[5];
      
      const body = await req.json();
      const { power, population, priority } = body;
      
      if (power === undefined || population === undefined) {
        return errorResponse('Missing power or population in request', 400);
      }
      
      try {
        const result = await updateBuildingAllocation(user.id, planetId, buildingType, power, population, priority);
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // GET /api/game/planet/:planetId/shipyard
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }
      
      // Process any completed production
      processCompletedProduction(planet);
      
      const shipyardDetails = getShipyardDetails(planet);
      
      // Add available ships and defenses to the response
      const ships = {};
      const defenses = {};
      
      for (const [shipKey, ship] of Object.entries(SHIPS)) {
        ships[shipKey] = {
          name: ship.name,
          icon: ship.icon,
          type: ship.type,
          description: ship.description,
          attack: ship.attack,
          shield: ship.shield,
          hull: ship.hull,
          cargoCapacity: ship.cargoCapacity,
          baseCost: ship.baseCost,
          buildTime: ship.buildTime
        };
      }
      
      for (const [defenseKey, defense] of Object.entries(DEFENSES)) {
        defenses[defenseKey] = {
          name: defense.name,
          icon: defense.icon,
          description: defense.description,
          attack: defense.attack,
          shield: defense.shield,
          hull: defense.hull,
          baseCost: defense.baseCost,
          buildTime: defense.buildTime
        };
      }
      
      return successResponse({
        ...shipyardDetails,
        availableShips: ships,
        availableDefenses: defenses
      });
    }
    
    // POST /api/game/planet/:planetId/shipyard/ships
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard\/ships$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }
      
      const body = await req.json();
      const { ships } = body;
      
      try {
        const shipyardLevel = planet.buildings?.shipyard || 0;
        const roboticsLevel = planet.buildings?.roboticsFactory || 0;
        const naniteLevel = planet.buildings?.naniteFactory || 0;
        
        const result = buildShips(planet, ships, shipyardLevel, roboticsLevel, naniteLevel);
        
        // Save player
        await updatePlayer(player);
        
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // POST /api/game/planet/:planetId/shipyard/defenses
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard\/defenses$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }
      
      const body = await req.json();
      const { defenses } = body;
      
      try {
        const roboticsLevel = planet.buildings?.roboticsFactory || 0;
        const naniteLevel = planet.buildings?.naniteFactory || 0;
        
        const result = buildDefenses(planet, defenses, roboticsLevel, naniteLevel);
        
        // Save player
        await updatePlayer(player);
        
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // DELETE /api/game/planet/:planetId/shipyard/:queueId
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard\/[^\/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const parts = path.split('/');
      const planetId = parts[4];
      const queueId = parts[6];
      const body = await req.json().catch(() => ({}));
      const type = body.type || 'ships';
      
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }
      
      try {
        const result = cancelProduction(planet, queueId, type);
        
        if (!result) {
          return errorResponse('Queue item not found', 404);
        }
        
        // Save player
        await updatePlayer(player);
        
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // GET /api/game/planet/:planetId/fleet
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/fleet$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }
      
      // Process any completed production
      processCompletedProduction(planet);
      
      return successResponse({
        ships: planet.ships || {},
        defenses: planet.defenses || {}
      });
    }
    
    // 404 for unknown API routes
    return errorResponse('Route not found', 404);
    
  } catch (error) {
    console.error('Request error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

// Create server
const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`🚀 Space Adventure server running on http://localhost:${PORT}`);
