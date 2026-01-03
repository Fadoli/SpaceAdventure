// Main server application
import { 
  registerUser, 
  authenticateUser, 
  createSession, 
  deleteSession, 
  getUserFromSession 
} from './auth/auth.js';
import { initializeStorage } from './storage/storage.js';
import { createPlayer, getPlayerByUserId, updatePlayer, recomputeAllPlanetsOnStartup, getPlayers } from './game/player.js';
import { upgradeBuilding, cancelBuilding, processCompletedBuildings, updateBuildingAllocation, updatePlanetAllocations, getBuildingCost, getBuildTime, getProduction, getStorageIncrease, updatePlanetProduction, queueVariantSwitch, processCompletedVariantSwitches, getEffectiveBuildingDefinition } from './game/buildings.js';
import { buildShips, buildDefenses, cancelProduction, processCompletedProduction, getShipyardDetails } from './game/shipyard.js';
import { 
  startTheoreticalResearch, 
  completeTheoreticalResearch, 
  cancelTheoreticalResearch,
  startPracticalResearchWithAllocation,
  startPracticalResearchLevel,
  completePracticalResearch,
  cancelPracticalResearch,
  selectCustomBuildingVariant,
  selectCustomShipVariant,
  getResearchProgress,
  getTheoreticalResearchLevels,
  getPracticalResearchProgress,
  getActiveCustomVariants,
  getActiveShipCustomVariants,
  getAvailablePracticalResearchForPlayer
} from './game/researchLogic.js';
import { startGameLoop } from './game/gameLoop.js';
import { BUILDINGS, checkRequirements, getRequirementsList } from '../shared/buildings.js';
import { SHIPS } from '../shared/ships.js';
import { DEFENSES } from '../shared/defenses.js';
import { calculateBaseTime } from '../shared/time.js';
import { loadConfig, getBuildQueueSize, getConfig } from './config.js';

// Load configuration
await loadConfig();

// Initialize storage on startup
await initializeStorage();

// Recompute all planets on startup (in-memory, no persistence)
await recomputeAllPlanetsOnStartup();

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

// Helper to format activity time
function getActivityString(lastActiveTimestamp) {
  if (!lastActiveTimestamp) return 'Unknown';
  const now = Date.now();
  const diff = now - lastActiveTimestamp;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
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
        // Determine content type based on file extension
        let contentType = 'text/html; charset=utf-8';
        if (filePath.endsWith('.js')) {
          contentType = 'application/javascript; charset=utf-8';
        } else if (filePath.endsWith('.css')) {
          contentType = 'text/css; charset=utf-8';
        } else if (filePath.endsWith('.json')) {
          contentType = 'application/json; charset=utf-8';
        } else if (filePath.endsWith('.png')) {
          contentType = 'image/png';
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (filePath.endsWith('.svg')) {
          contentType = 'image/svg+xml';
        }
        
        return new Response(file, {
          headers: {
            'Content-Type': contentType
          }
        });
      }
      
      // If not found and not an API route, serve index.html (SPA routing)
      if (!path.startsWith('/api/')) {
        const indexFile = Bun.file('./src/client/index.html');
        if (await indexFile.exists()) {
          return new Response(indexFile, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8'
            }
          });
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

    // GET /api/config
    if (path === '/api/config' && method === 'GET') {
      // Configuration is public information needed for UI calculations
      const config = getConfig();
      
      // Return only what's needed for the client to avoid leaking server-only secrets if any existed
      // (Currently all config in config.json is safe to expose)
      return successResponse({
        gameSpeed: config.gameSpeed,
        balancing: config.balancing
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
      
      // Recalculate production for all planets before returning
      // This ensures derived values reflect current game constants and variant modifiers
      for (const planet of player.planets) {
        updatePlanetProduction(planet, player);
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
    
    // POST /api/game/planet/:planetId/building/:buildingType/variant
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/variant$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[4];
      const buildingType = pathParts[6];
      const body = await req.json();
      const { toCustom } = body;
      
      try {
        const result = await switchBuildingVariant(user.id, planetId, buildingType, toCustom);
        return successResponse(result);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // GET /api/game/planet/:planetId/building/:buildingType/variant-details
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/variant-details$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[4];
      const buildingType = pathParts[6];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }
      
      try {
        // Get available variants with their focus combinations
        const baseCost = getBuildingCost(buildingType, planet.buildings[buildingType] || 1);
        const currentVariant = (planet.activeVariants && planet.activeVariants[buildingType]) || 'base';
        
        // Determine current variant cost
        let currentVariantData = null;
        let currentCost = baseCost;
        
        if (currentVariant === 'custom' && player.customBuildingVariants && player.customBuildingVariants[buildingType]) {
          const variant = player.customBuildingVariants[buildingType];
          currentVariantData = variant;
          if (variant.modifiers && variant.modifiers.costMultiplier !== 1) {
            currentCost = {
              metal: Math.floor(baseCost.metal * variant.modifiers.costMultiplier),
              crystal: Math.floor(baseCost.crystal * variant.modifiers.costMultiplier),
              deuterium: Math.floor(baseCost.deuterium * variant.modifiers.costMultiplier)
            };
          }
        }
        
        const availableVariants = [];
        
        // Add base variant if not currently on it
        if (currentVariant !== 'base') {
          availableVariants.push({
            isBase: true,
            focusLevels: {},
            modifiers: {},
            cost: baseCost
          });
        }
        
        // Add custom variant if available and not currently on it
        if (player.customBuildingVariants && player.customBuildingVariants[buildingType] && currentVariant !== 'custom') {
          const variant = player.customBuildingVariants[buildingType];
          
          // Calculate the actual custom cost by applying the cost modifier
          let customCost = { ...baseCost };
          if (variant.modifiers && variant.modifiers.costMultiplier !== 1) {
            customCost = {
              metal: Math.floor(baseCost.metal * variant.modifiers.costMultiplier),
              crystal: Math.floor(baseCost.crystal * variant.modifiers.costMultiplier),
              deuterium: Math.floor(baseCost.deuterium * variant.modifiers.costMultiplier)
            };
          }
          
          availableVariants.push({
            focusLevels: variant.focusLevels,
            modifiers: variant.modifiers,
            cost: customCost
          });
        }
        
        return successResponse({
          baseCost,
          currentCost,
          currentVariant,
          currentVariantData,
          availableVariants
        });
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }
    
    // POST /api/game/planet/:planetId/building/:buildingType/select-variant
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/select-variant$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[4];
      const buildingType = pathParts[6];
      const body = await req.json();
      const { focusLevels } = body;
      
      try {
        // If focusLevels is empty, switch to base; otherwise switch to custom
        const isSwitchingToBase = !focusLevels || Object.keys(focusLevels).length === 0;
        
        if (isSwitchingToBase) {
          // Queue switch to base variant
          const result = await queueVariantSwitch(user.id, planetId, buildingType, false);
          return successResponse(result);
        } else {
          // Switch to custom variant with the specified focus levels
          const player = await getPlayerByUserId(user.id);
          selectCustomBuildingVariant(player, planetId, buildingType, focusLevels);
          const result = await queueVariantSwitch(user.id, planetId, buildingType, true);
          return successResponse(result);
        }
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
      for (const key in BUILDINGS) {
        const building = BUILDINGS[key];
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
      
      for (const buildingType in BUILDINGS) {
        // Get effective building definition (custom or base)
        const buildingDef = getEffectiveBuildingDefinition(buildingType, planet, player);
        const currentLevel = planet.buildings[buildingType] || 0;
        
        // Find the highest level of this building in the queue
        let highestQueuedLevel = currentLevel;
        if (planet.buildQueue) {
          const queuedBuildings = planet.buildQueue.filter(item => item.building === buildingType);
          if (queuedBuildings.length > 0) {
            highestQueuedLevel = Math.max(...queuedBuildings.map(item => item.level));
          }
        }
        
        const nextLevel = highestQueuedLevel + 1;
        
        // Calculate cost for next level
        const cost = getBuildingCost(buildingType, nextLevel, planet, player);
        
        // Calculate build time
        const roboticsLevel = planet.buildings.roboticsFactory || 0;
        const naniteLevel = planet.buildings.naniteFactory || 0;
        const buildTime = getBuildTime(buildingType, nextLevel, roboticsLevel, naniteLevel, planet, player);
        
        // Calculate production for next level (already handles variant via definition)
        let production = getProduction(buildingType, nextLevel, planet, player);
        
        // Calculate storage for next level
        let storage = null;
        if (buildingDef.storage) {
          storage = getStorageIncrease(buildingType, nextLevel, planet, player);
        }
        
        // Calculate energy consumption for next level
        let energyConsumption = 0;
        if (buildingDef.energyConsumption) {
          const productionMultiplier = 10.0; // From config
          // Energy efficiency from research
          const energyTechLevel = player?.research?.energyTech || 0;
          const energyEfficiencyBonus = 1 - (energyTechLevel * 0.05); // 5% reduction per level
          
          energyConsumption = Math.floor(buildingDef.energyConsumption * nextLevel * Math.pow(1.1, nextLevel) * productionMultiplier * Math.max(0.5, energyEfficiencyBonus));
        }
        
        // Calculate deuterium consumption for next level
        let deuteriumConsumption = 0;
        if (buildingDef.deuteriumConsumption) {
          const productionMultiplier = 10.0; // From config
          deuteriumConsumption = Math.floor(buildingDef.deuteriumConsumption * nextLevel * Math.pow(1.1, nextLevel) * productionMultiplier);
        }
        
        // Check if can afford
        const canAfford = planet.resources.metal >= cost.metal &&
                         planet.resources.crystal >= cost.crystal &&
                         planet.resources.deuterium >= cost.deuterium;
        
        // Check requirements
        const requirementsMet = checkRequirements(buildingType, planet.buildings, player.research || {});
        const requirementsList = getRequirementsList(buildingType);
        
        // Check if this building has a custom variant
        const hasCustomVariant = player.customBuildingVariants && player.customBuildingVariants[buildingType] ? true : false;
        const customVariant = (player.customBuildingVariants && player.customBuildingVariants[buildingType]) || null;
        
        buildingsDetails[buildingType] = {
          name: buildingDef.name,
          description: buildingDef.description,
          icon: buildingDef.icon,
          currentLevel,
          nextLevel,
          cost,
          buildTime,
          production,
          storage,
          energyConsumption,
          deuteriumConsumption,
          canAfford,
          requirementsMet,
          requirementsList,
          hasCustomVariant,
          customVariant,
          currentVariant: (planet.activeVariants && planet.activeVariants[buildingType]) || 'base'
        };
      }
      
      return successResponse({
        buildings: buildingsDetails,
        queue: planet.buildQueue || [],
        variantSwitchQueue: planet.variantSwitchQueue || [],
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
      
      for (const shipKey in SHIPS) {
        const ship = SHIPS[shipKey];
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
          baseTime: calculateBaseTime(ship)
        };
      }
      
      for (const defenseKey in DEFENSES) {
        const defense = DEFENSES[defenseKey];
        defenses[defenseKey] = {
          name: defense.name,
          icon: defense.icon,
          description: defense.description,
          attack: defense.attack,
          shield: defense.shield,
          hull: defense.hull,
          baseCost: defense.baseCost,
          baseTime: calculateBaseTime(defense)
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
        await updatePlayer(user.id, player);
        
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
        const shipyardLevel = planet.buildings?.shipyard || 0;
        const roboticsLevel = planet.buildings?.roboticsFactory || 0;
        const naniteLevel = planet.buildings?.naniteFactory || 0;
        
        const result = buildDefenses(planet, defenses, shipyardLevel, roboticsLevel, naniteLevel);
        
        // Save player
        await updatePlayer(user.id, player);
        
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
        await updatePlayer(user.id, player);
        
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
    
    // GET /api/game/galaxy/:galaxy/:system
    if (path.match(/^\/api\/game\/galaxy\/\d+\/\d+$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const galaxy = parseInt(pathParts[4], 10);
      const system = parseInt(pathParts[5], 10);
      
      // Get all players to scan for planets in this system
      const allPlayers = await getPlayers();
      const planetsInSystem = [];
      
      for (const player of allPlayers) {
        for (const planet of player.planets) {
          const [pGalaxy, pSystem, pPosition] = planet.coordinates;
          if (pGalaxy === galaxy && pSystem === system) {
            planetsInSystem.push({
              position: pPosition,
              player: player.username,
              playerType: 'ai', // Could be enhanced to track player vs AI
              planetName: planet.name,
              activity: planet.lastActivity ? getActivityString(planet.lastActivity) : 'Unknown',
              moon: planet.moon || false
            });
          }
        }
      }
      
      // Sort by position
      planetsInSystem.sort((a, b) => a.position - b.position);
      
      return successResponse({
        galaxy,
        system,
        planets: planetsInSystem
      });
    }

    // ============================================
    // RESEARCH ROUTES
    // ============================================

    // GET /api/game/research - Get all research info
    if (path === '/api/game/research' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      try {
        const progress = getResearchProgress(player);
        const theoretical = getTheoreticalResearchLevels(player);
        const practical = getPracticalResearchProgress(player);

        return successResponse({
          progress,
          theoretical,
          practical
        });
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }

    // POST /api/game/planet/:planetId/research/theoretical - Start theoretical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/theoretical$/) && method === 'POST') {
      console.log('POST /api/game/planet/:planetId/research/theoretical');
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const planetId = path.split('/')[4];
      console.log('Planet ID:', planetId);
      
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      const planet = player.planets.find(p => p.id === planetId);
      if (!planet) {
        return errorResponse('Planet not found', 404);
      }

      const body = await req.json();
      const { techKey } = body;
      console.log('Request body:', body);
      console.log('Tech key:', techKey);

      try {
        console.log('Starting theoretical research for tech:', techKey);
        const queueItem = startTheoreticalResearch(player, techKey, planetId);
        console.log('Queue item created:', queueItem);
        
        await updatePlayer(user.id, player);
        console.log('Player updated successfully');

        return successResponse(queueItem);
      } catch (error) {
        console.error('Error starting theoretical research:', error);
        console.error('Error message:', error.message);
        return errorResponse(error.message, 400);
      }
    }

    // DELETE /api/game/planet/:planetId/research/theoretical/:queueId - Cancel theoretical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/theoretical\/[^/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const parts = path.split('/');
      const planetId = parts[4];
      const queueId = parts[7];

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      try {
        const refund = cancelTheoreticalResearch(player, queueId, planetId);
        await updatePlayer(user.id, player);

        return successResponse({ refund, cancelled: true });
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }

    // POST /api/game/planet/:planetId/research/practical - Start practical research level
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/practical$/) && method === 'POST') {
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
      const { researchKey, allocation, strength } = body;
      console.log(`[PRACTICAL_RESEARCH] Starting research: researchKey=${researchKey}, allocation=`, allocation, `strength=${strength}`);

      try {
        let queueItem;
        if (allocation) {
          // Allocation-based research (customization)
          queueItem = startPracticalResearchWithAllocation(player, researchKey, allocation, planetId, strength || 0.5);
        } else {
          // Simple level-based research (for backward compatibility)
          queueItem = startPracticalResearchLevel(player, researchKey, planetId);
        }
        console.log(`[PRACTICAL_RESEARCH] Successfully started research:`, queueItem);
        await updatePlayer(user.id, player);

        return successResponse(queueItem);
      } catch (error) {
        console.error(`[PRACTICAL_RESEARCH] Error starting research:`, error.message);
        return errorResponse(error.message, 400);
      }
    }

    // DELETE /api/game/planet/:planetId/research/practical/:queueId - Cancel practical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/practical\/[^/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const parts = path.split('/');
      const planetId = parts[4];
      const queueId = parts[7];

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      try {
        const refund = cancelPracticalResearch(player, queueId, planetId);
        console.log(`[PRACTICAL_RESEARCH] Cancelled research: ${queueId}, refund:`, refund);
        await updatePlayer(user.id, player);

        return successResponse({ refund, cancelled: true });
      } catch (error) {
        console.error(`[PRACTICAL_RESEARCH] Error cancelling research:`, error.message);
        return errorResponse(error.message, 400);
      }
    }

    // GET /api/game/planet/:planetId/research/available - Get available practical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/available$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      try {
        const available = getAvailablePracticalResearchForPlayer(player, planetId);
        return successResponse(available);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }

    // POST /api/game/planet/:planetId/research/building-variant - Set custom building variant
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/building-variant$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      const body = await req.json();
      const { baseType, focusLevels } = body;

      try {
        const variant = selectCustomBuildingVariant(player, planetId, baseType, focusLevels);
        await updatePlayer(user.id, player);

        return successResponse(variant);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }

    // POST /api/game/research/ship-variant - Set custom ship variant
    if (path === '/api/game/research/ship-variant' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      const body = await req.json();
      const { baseType, focusLevels } = body;

      try {
        const variant = selectCustomShipVariant(player, baseType, focusLevels);
        await updatePlayer(user.id, player);

        return successResponse(variant);
      } catch (error) {
        return errorResponse(error.message, 400);
      }
    }

    // GET /api/game/planet/:planetId/research/variants - Get active custom variants
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/variants$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse('Not authenticated', 401);
      }

      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse('Player not found', 404);
      }

      try {
        const buildingVariants = getActiveCustomVariants(player, planetId);
        const shipVariants = getActiveShipCustomVariants(player);

        return successResponse({
          building: buildingVariants,
          ships: shipVariants
        });
      } catch (error) {
        return errorResponse(error.message, 400);
      }
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
