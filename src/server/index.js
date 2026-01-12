// Main server application
import { 
  registerUser, 
  authenticateUser, 
  createSession, 
  deleteSession, 
  getUserFromSession 
} from './auth/auth.js';
import { initializeStorage } from './storage/storage.js';
import { createPlayer, getPlayerByUserId, updatePlayer, recomputeAllPlanetsOnStartup, getPlayers, renamePlanet, getRankings, getPlayerRankIndex, updatePlayerRelation } from './game/player.js';
import { getGalaxyData } from './game/galaxyData.js';
import { 
  upgradeBuilding, 
  cancelBuilding, 
  processCompletedBuildings, 
  updateBuildingAllocation, 
  updatePlanetAllocations, 
  getBuildingCost, 
  getBuildTime, 
  getProduction, 
  getStorageIncrease, 
  updatePlanetProduction, 
  queueVariantSwitch, 
  processCompletedVariantSwitches, 
  getEffectiveBuildingDefinition,
  createBuildingBlueprint,
  setActiveBlueprint,
  deleteBuildingBlueprint,
  renameBuildingBlueprint
} from './game/buildings.js';
import { 
  buildShips, 
  buildDefenses, 
  cancelProduction, 
  processCompletedProduction, 
  getShipyardDetails, 
  createShipBlueprint, 
  deleteShipBlueprint,
  renameShipBlueprint
} from './game/shipyard.js';
import { sendFleet } from './game/fleet.js';
import { getAiMetadata, createAiPlayer, seedAiPlayers } from './game/aiManager.js';
import { AI_TYPES } from '../shared/constants.js';
import { getPlayerMessages, markMessageRead, deleteMessage, clearMessages } from './game/messages.js';
import { getAlliances, getAllianceById, createAlliance, joinAlliance, leaveAlliance } from './game/alliance.js';
import { 
  startTheoreticalResearch, 
  completeTheoreticalResearch, 
  cancelTheoreticalResearch,
  startPracticalResearchWithAllocation,
  completePracticalResearch,
  cancelPracticalResearch,
  resetPracticalResearch,
  selectCustomBuildingVariant,
  selectCustomShipVariant,
  getResearchProgress,
  getTheoreticalResearchLevels,
  getPracticalResearchProgress,
  getActiveCustomVariants,
  getActiveShipCustomVariants,
  getAvailablePracticalResearchForPlayer,
  getResearchHistory
} from './game/researchLogic.js';
import { startGameLoop } from './game/gameLoop.js';
import { BUILDINGS, checkRequirements, getRequirementsList } from '../shared/buildings.js';
import { getTheoreticalResearch, getResearchBonus } from '../shared/research.js';
import { SHIPS, calculateShipSpeed } from '../shared/ships.js';
import { DEFENSES } from '../shared/defenses.js';
import { MISSION_TYPES } from '../shared/constants.js';
import { calculateBaseTime } from '../shared/time.js';
import { SCALING } from '../shared/constants.js';
import { calculateAllocationEffectiveness } from '../shared/formulas.js';
import { isEmpty } from '../shared/utils.js';
import { loadConfig, getBuildQueueSize, getConfig } from './config.js';
import { gzipSync, deflateSync } from 'zlib';

// Load configuration
await loadConfig();

// Initialize storage on startup
await initializeStorage();

// Auto-spawn AI if none exist
const aiMetadata = await getAiMetadata();
if (!aiMetadata.aiPlayers || aiMetadata.aiPlayers.length < 100) {
  await seedAiPlayers(100);
}

// Recompute all planets on startup (in-memory, no persistence)
await recomputeAllPlanetsOnStartup();

// Start game loop
startGameLoop();

const PORT = process.env.PORT || 3000;

/**
 * Compress response body based on Accept-Encoding header
 */
function compressResponse(req, body, contentType) {
  const acceptEncoding = req.headers.get('accept-encoding') || '';
  let compressedBody = body;
  let encoding = null;

  // Only compress text-based formats and large enough bodies
  const isCompressible = contentType && (
    contentType.includes('text/') || 
    contentType.includes('json') || 
    contentType.includes('javascript') ||
    contentType.includes('svg')
  );

  if (isCompressible && body.length > 1024) {
    if (acceptEncoding.includes('gzip')) {
      compressedBody = gzipSync(body);
      encoding = 'gzip';
    } else if (acceptEncoding.includes('deflate')) {
      compressedBody = deflateSync(body);
      encoding = 'deflate';
    }
  }

  return { compressedBody, encoding };
}

// Helper to get cookie value
function getCookie(req, name) {
  const cookies = req.headers.get('cookie');
  if (!cookies) return null;
  
  const cookie = cookies.split(';').find(c => c.trim().startsWith(`${name}=`));
  return cookie ? cookie.split('=')[1] : null;
}

// Helper to create cookie string
function createCookie(name, value, maxAge) {
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
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
function jsonResponse(req, data, status = 200, headers = {}) {
  const body = JSON.stringify(data);
  const contentType = 'application/json';
  const { compressedBody, encoding } = compressResponse(req, Buffer.from(body), contentType);
  
  const origin = req.headers.get('origin') || '*';
  const finalHeaders = {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    ...headers
  };

  if (encoding) {
    finalHeaders['Content-Encoding'] = encoding;
  }

  return new Response(compressedBody, {
    status,
    headers: finalHeaders
  });
}

// Error response helper
function errorResponse(req, message, status = 400) {
  return jsonResponse(req, {
    success: false,
    error: message,
    timestamp: Date.now()
  }, status);
}

// Success response helper
function successResponse(req, data) {
  return jsonResponse(req, {
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
  
  if (method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '*';
    return new Response(null, { 
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }
  
  try {
    // Static file serving
    if (path === '/' || path === '/login.html' || !path.startsWith('/api/')) {
      const filePath = (path === '/' || path === '/login.html') ? (path === '/' ? '/src/client/index.html' : '/src/client/login.html') : path;
      const file = Bun.file(`.${filePath}`);
      
      if (await file.exists()) {
        // Determine content type based on file extension
        let contentType = 'text/html; charset=utf-8';
        let cacheTime = 5; // 5 seconds for most files (dev)
        
        if (filePath.endsWith('.js')) {
          contentType = 'application/javascript; charset=utf-8';
          cacheTime = 5; // 5 seconds for JS (dev)
        } else if (filePath.endsWith('.css')) {
          contentType = 'text/css; charset=utf-8';
          cacheTime = 86400; // 1 day for CSS
        } else if (filePath.endsWith('.json')) {
          contentType = 'application/json; charset=utf-8';
        } else if (filePath.endsWith('.png')) {
          contentType = 'image/png';
          cacheTime = 604800; // 1 week for images
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
          cacheTime = 604800;
        } else if (filePath.endsWith('.svg')) {
          contentType = 'image/svg+xml';
          cacheTime = 604800;
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const { compressedBody, encoding } = compressResponse(req, Buffer.from(arrayBuffer), contentType);
        
        const headers = {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${cacheTime}`
        };

        if (encoding) {
          headers['Content-Encoding'] = encoding;
        }
        
        return new Response(compressedBody, { headers });
      }
      
      // If not found and not an API route, serve index.html (SPA routing)
      if (!path.startsWith('/api/')) {
        const indexFile = Bun.file('./src/client/index.html');
        if (await indexFile.exists()) {
          const arrayBuffer = await indexFile.arrayBuffer();
          const { compressedBody, encoding } = compressResponse(req, Buffer.from(arrayBuffer), 'text/html');
          
          const headers = {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache' // Main entry point should check if changed
          };

          if (encoding) {
            headers['Content-Encoding'] = encoding;
          }

          return new Response(compressedBody, { headers });
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
      
      return jsonResponse(req, {
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          sessionToken
        },
        timestamp: Date.now()
      }, 200, {
        'Set-Cookie': createCookie('session', sessionToken, 86400)
      });
    }
    
    // POST /api/auth/login
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await req.json();
      const { username, password } = body;
      
      const user = await authenticateUser(username, password);
      const sessionToken = createSession(user.id);
      
      return jsonResponse(req, {
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          sessionToken
        },
        timestamp: Date.now()
      }, 200, {
        'Set-Cookie': createCookie('session', sessionToken, 86400)
      });
    }
    
    // POST /api/auth/logout
    if (path === '/api/auth/logout' && method === 'POST') {
      const sessionToken = getCookie(req, 'session');
      if (sessionToken) {
        deleteSession(sessionToken);
      }
      
      return jsonResponse(req, {
        success: true,
        data: null,
        timestamp: Date.now()
      }, 200, {
        'Set-Cookie': createCookie('session', '', 0)
      });
    }
    
    // GET /api/auth/me
    if (path === '/api/auth/me' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      return successResponse(req, {
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
      
      // Return only what's needed for the client
      return successResponse(req, {
        gameSpeed: config.gameSpeed,
        balancing: config.balancing,
        gameplay: config.gameplay
      });
    }
    
    // GET /api/game/state
    if (path === '/api/game/state' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse(req, 'Player not found', 404);
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

      // Find hostile fleets targeting this player
      const allPlayers = await getPlayers();
      const hostileFleets = [];
      const myPlanetCoords = player.planets.map(p => p.coordinates.join(':'));

      for (const otherPlayer of allPlayers) {
        if (otherPlayer.userId === user.id) continue;
        if (!otherPlayer.fleets) continue;

        for (const fleet of otherPlayer.fleets) {
          if (myPlanetCoords.includes(fleet.targetCoords.join(':')) && !fleet.returning) {
            // It's a hostile fleet targeting us!
            // We only send minimal info for hostile fleets
            hostileFleets.push({
                id: fleet.id,
                missionType: fleet.missionType,
                originCoords: fleet.originCoords,
                targetCoords: fleet.targetCoords,
                startTime: fleet.startTime,
                arrivalTime: fleet.arrivalTime,
                isHostile: true,
                ownerName: otherPlayer.username
            });
          }
        }
      }

      const responseData = { ...player, hostileFleets };
      
      return successResponse(req, responseData);
    }
    
    // POST /api/game/planet/:planetId/build
    if (path.startsWith('/api/game/planet/') && path.endsWith('/build') && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const body = await req.json();
      const { building } = body;
      
      try {
        const result = await upgradeBuilding(user.id, planetId, building);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // DELETE /api/game/planet/:planetId/build
    if (path.startsWith('/api/game/planet/') && path.endsWith('/build') && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const body = await req.json().catch(() => ({}));
      const queuePosition = body.queuePosition || 1;
      
      try {
        const result = await cancelBuilding(user.id, planetId, queuePosition);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // POST /api/planet/:planetId/building/:buildingType/allocation
    if (path.match(/^\/api\/planet\/[^/]+\/building\/[^/]+\/allocation$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[3];
      const buildingType = pathParts[5];

      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const body = await req.json();
      const { power, population } = body;
      
      try {
        const result = await updateBuildingAllocation(user.id, planetId, buildingType, power, population);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // POST /api/game/planet/:planetId/building/:buildingType/variant
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/variant$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[4];
      const buildingType = pathParts[6];

      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const body = await req.json();
      const { toCustom } = body;
      
      try {
        const result = await switchBuildingVariant(user.id, planetId, buildingType, toCustom);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // GET /api/game/planet/:planetId/building/:buildingType/variant-details
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/variant-details$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[4];
      const buildingType = pathParts[6];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
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
        
        return successResponse(req, {
          baseCost,
          currentCost,
          currentVariant,
          currentVariantData,
          availableVariants
        });
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // POST /api/game/planet/:planetId/building/:buildingType/select-variant
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/select-variant$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const planetId = pathParts[4];
      const buildingType = pathParts[6];

      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const body = await req.json();
      const { focusLevels } = body;
      
      try {
        // If focusLevels is empty, switch to base; otherwise switch to custom
        const isSwitchingToBase = !focusLevels || isEmpty(focusLevels);
        
        if (isSwitchingToBase) {
          // Queue switch to base variant
          const result = await queueVariantSwitch(user.id, planetId, buildingType, false);
          return successResponse(req, result);
        } else {
          // Switch to custom variant with the specified focus levels
          selectCustomBuildingVariant(player, planetId, buildingType, focusLevels);
          const result = await queueVariantSwitch(user.id, planetId, buildingType, true);
          return successResponse(req, result);
        }
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // GET /api/game/buildings
    if (path === '/api/game/buildings' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
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
      
      return successResponse(req, buildingInfo);
    }
    
    // GET /api/game/planet/:planetId/buildings-details
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/buildings-details$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      
      // Ensure production is updated and state is repaired
      updatePlanetProduction(planet, player);

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
        const isMaxLevel = buildingDef.maxLevel && currentLevel >= buildingDef.maxLevel;
        
        // Calculate cost for next level (null if at max level)
        const cost = isMaxLevel ? null : getBuildingCost(buildingType, nextLevel, planet, player);
        const baseCostForNextLevel = isMaxLevel ? null : getBuildingCost(buildingType, nextLevel); // cost without variant
        
        // Calculate build time
        const roboticsLevel = planet.buildings.roboticsFactory || 0;
        const naniteLevel = planet.buildings.naniteFactory || 0;
        const buildTime = isMaxLevel ? 0 : getBuildTime(buildingType, nextLevel, roboticsLevel, naniteLevel, planet, player);
        
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
          // Energy efficiency from research: data-driven
          const energyEfficiencyBonus = getResearchBonus(player?.research, 'buildingEnergyEfficiency');
          const reduction = 1 - energyEfficiencyBonus;
          
          energyConsumption = Math.floor(buildingDef.energyConsumption * nextLevel * Math.pow(SCALING.BUILDING_ENERGY, nextLevel) * productionMultiplier * Math.max(0.5, reduction));
        }
        
        // Calculate deuterium consumption for next level
        let deuteriumConsumption = 0;
        if (buildingDef.deuteriumConsumption) {
          const productionMultiplier = 10.0; // From config
          // Apply same energy efficiency bonus if it's a deuterium consumer (flavor choice)
          const energyEfficiencyBonus = getResearchBonus(player?.research, 'buildingEnergyEfficiency');
          const reduction = 1 - energyEfficiencyBonus;
          deuteriumConsumption = Math.floor(buildingDef.deuteriumConsumption * nextLevel * Math.pow(SCALING.BUILDING_PRODUCTION, nextLevel) * productionMultiplier * Math.max(0.5, reduction));
        }
        
        // Check if can afford
        const canAfford = cost && 
                         planet.resources.metal >= cost.metal &&
                         planet.resources.crystal >= cost.crystal &&
                         planet.resources.deuterium >= cost.deuterium;
        
        // Check requirements
        const requirementsMet = checkRequirements(buildingType, planet.buildings, player.research || {});
        const requirementsList = getRequirementsList(buildingType);
        
        // Check if this building has a custom variant
        const activeVariantId = (planet.activeVariants && planet.activeVariants[buildingType]) || 'base';
        let customVariant = null;
        
        if (activeVariantId !== 'base') {
          // Check blueprints first
          if (player.buildingBlueprints && player.buildingBlueprints[buildingType]) {
            customVariant = player.buildingBlueprints[buildingType].find(bp => bp.id === activeVariantId);
          }
          // Fallback to legacy single variant
          if (!customVariant && activeVariantId === 'custom' && player.customBuildingVariants && player.customBuildingVariants[buildingType]) {
            customVariant = player.customBuildingVariants[buildingType];
          }
        }
        
        const hasCustomVariant = customVariant !== null;
        
        // Calculate current ACTUAL production and consumption (adjusted by effectiveness)
        const currentProdBase = currentLevel > 0 ? getProduction(buildingType, currentLevel, planet, player) : {};
        const actualAllocation = (planet.actualAllocations && planet.actualAllocations[buildingType]) || { power: 1.0, population: 1.0 };
        
        // Use same formula as updatePlanetProduction
        const powerEffectiveness = calculateAllocationEffectiveness(actualAllocation.power * 100) / 100;
        const populationEffectiveness = calculateAllocationEffectiveness(actualAllocation.population * 100) / 100;
        const totalEffectiveness = powerEffectiveness * populationEffectiveness;
        
        const actualProduction = {};
        for (const res in currentProdBase) {
          actualProduction[res] = Math.floor(currentProdBase[res] * totalEffectiveness);
        }

        let actualEnergyConsumption = 0;
        if (buildingDef.energyConsumption && currentLevel > 0) {
          const energyMultiplier = 10.0;
          const energyEfficiencyBonus = getResearchBonus(player?.research, 'buildingEnergyEfficiency');
          const reduction = 1 - energyEfficiencyBonus;
          const baseConsumption = Math.floor(buildingDef.energyConsumption * currentLevel * Math.pow(SCALING.BUILDING_ENERGY, currentLevel) * energyMultiplier * Math.max(0.5, reduction));
          actualEnergyConsumption = Math.floor(baseConsumption * actualAllocation.power);
        }

        let actualDeuteriumConsumption = 0;
        if (buildingDef.deuteriumConsumption && currentLevel > 0) {
          const productionMultiplier = 10.0;
          const energyEfficiencyBonus = getResearchBonus(player?.research, 'buildingEnergyEfficiency');
          const reduction = 1 - energyEfficiencyBonus;
          const baseConsumption = Math.floor(buildingDef.deuteriumConsumption * currentLevel * Math.pow(SCALING.BUILDING_PRODUCTION, currentLevel) * productionMultiplier * Math.max(0.5, reduction));
          actualDeuteriumConsumption = Math.floor(baseConsumption * totalEffectiveness);
        }

        // Calculate expected gains for next level based on CURRENT effectiveness/allocations
        const expectedNextProduction = {};
        for (const res in production) {
          expectedNextProduction[res] = Math.floor(production[res] * totalEffectiveness);
        }

        const expectedNextEnergyConsumption = buildingDef.energyConsumption ? 
          Math.floor(energyConsumption * actualAllocation.power) : 0;
        
        const expectedNextDeuteriumConsumption = buildingDef.deuteriumConsumption ? 
          Math.floor(deuteriumConsumption * totalEffectiveness) : 0;

        const productionGains = {};
        for (const res in expectedNextProduction) {
          productionGains[res] = expectedNextProduction[res] - (actualProduction[res] || 0);
        }

        const energyGain = expectedNextEnergyConsumption - actualEnergyConsumption;
        const deuteriumGain = expectedNextDeuteriumConsumption - actualDeuteriumConsumption;

        // Get all available blueprints for this type
        const availableBlueprints = (player.buildingBlueprints && player.buildingBlueprints[buildingType]) || [];
        
        buildingsDetails[buildingType] = {
          name: buildingDef.name,
          description: buildingDef.description,
          detailedDescription: buildingDef.detailedDescription,
          icon: buildingDef.icon,
          currentLevel,
          nextLevel,
          maxLevel: buildingDef.maxLevel || 50,
          cost,
          baseCost: baseCostForNextLevel,
          costScaling: buildingDef.costScaling || SCALING.BUILDING_COST,
          buildTime,
          production,
          storage,
          energyConsumption,
          deuteriumConsumption,
          actualProduction,
          actualEnergyConsumption,
          actualDeuteriumConsumption,
          productionGains,
          energyGain,
          deuteriumGain,
          totalEffectiveness,
          canAfford,
          requirementsMet,
          requirementsList,
          hasCustomVariant,
          customVariant,
          availableBlueprints,
          currentVariant: activeVariantId
        };
      }
      
      return successResponse(req, {
        buildings: buildingsDetails,
        queue: planet.buildQueue || [],
        variantSwitchQueue: planet.variantSwitchQueue || [],
        maxQueueSize
      });
    }
    
    // POST /api/game/planet/:planetId/allocations - Update all building allocations at once
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/allocations$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const parts = path.split('/');
      const planetId = parts[4];
      
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const body = await req.json();
      const { allocations } = body;
      
      if (!allocations || typeof allocations !== 'object') {
        return errorResponse(req, 'Missing or invalid allocations in request', 400);
      }
      
      try {
        const result = await updatePlanetAllocations(user.id, planetId, allocations);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // POST /api/game/planet/:planetId/building/:buildingType/allocation
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/building\/[^\/]+\/allocation$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const parts = path.split('/');
      const planetId = parts[4];
      const buildingType = parts[6];
      
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const body = await req.json();
      const { power, population, priority } = body;
      
      if (power === undefined || population === undefined) {
        return errorResponse(req, 'Missing power or population in request', 400);
      }
      
      try {
        const result = await updateBuildingAllocation(user.id, planetId, buildingType, power, population, priority);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // GET /api/game/planet/:planetId/shipyard
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      
      // Process any completed production
      processCompletedProduction(planet);
      
      const shipyardDetails = getShipyardDetails(planet, player);
      
      // Add available ships and defenses to the response
      const ships = {};
      const defenses = {};
      
      for (const shipKey in SHIPS) {
        const ship = SHIPS[shipKey];
        ships[shipKey] = {
          name: ship.name,
          icon: ship.icon,
          type: ship.type,
          driveType: ship.driveType,
          description: ship.description,
          detailedDescription: ship.detailedDescription,
          attack: ship.attack,
          shield: ship.shield,
          hull: ship.hull,
          cargoCapacity: ship.cargoCapacity,
          fuel: ship.fuel,
          populationRequired: ship.populationRequired,
          rapidFire: ship.rapidFire || {},
          baseCost: ship.baseCost,
          baseTime: calculateBaseTime(ship),
          speed: calculateShipSpeed(shipKey, player.research)
        };
      }
      
      for (const defenseKey in DEFENSES) {
        const defense = DEFENSES[defenseKey];
        defenses[defenseKey] = {
          name: defense.name,
          icon: defense.icon,
          description: defense.description,
          detailedDescription: defense.detailedDescription,
          attack: defense.attack,
          shield: defense.shield,
          hull: defense.hull,
          rapidFire: defense.rapidFire || {},
          baseCost: defense.baseCost,
          baseTime: calculateBaseTime(defense)
        };
      }
      
      return successResponse(req, {
        ...shipyardDetails,
        availableShips: ships,
        availableDefenses: defenses
      });
    }
    
    // POST /api/game/planet/:planetId/shipyard/ships
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard\/ships$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      
      const body = await req.json();
      const { ships } = body;
      
      try {
        const shipyardLevel = planet.buildings?.shipyard || 0;
        const roboticsLevel = planet.buildings?.roboticsFactory || 0;
        const naniteLevel = planet.buildings?.naniteFactory || 0;
        
        const result = buildShips(planet, player, ships, shipyardLevel, roboticsLevel, naniteLevel);
        
        // Save player
        await updatePlayer(user.id, player);
        
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // POST /api/game/planet/:planetId/shipyard/defenses
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard\/defenses$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      
      const body = await req.json();
      const { defenses } = body;
      
      try {
        const shipyardLevel = planet.buildings?.shipyard || 0;
        const roboticsLevel = planet.buildings?.roboticsFactory || 0;
        const naniteLevel = planet.buildings?.naniteFactory || 0;
        
        const result = buildDefenses(planet, player, defenses, shipyardLevel, roboticsLevel, naniteLevel);
        
        // Save player
        await updatePlayer(user.id, player);
        
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // DELETE /api/game/planet/:planetId/shipyard/:queueId
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/shipyard\/[^\/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const parts = path.split('/');
      const planetId = parts[4];
      const queueId = parts[6];
      
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      const body = await req.json().catch(() => ({}));
      const type = body.type || 'ships';
      
      try {
        const result = cancelProduction(planet, queueId, type);
        
        if (!result) {
          return errorResponse(req, 'Queue item not found', 404);
        }
        
        // Save player
        await updatePlayer(user.id, player);
        
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // GET /api/game/planet/:planetId/fleet
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/fleet$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const planet = player.planets.find(p => p.id === planetId);
      
      // Process any completed production
      processCompletedProduction(planet);
      
      return successResponse(req, {
        ships: planet.ships || {},
        defenses: planet.defenses || {}
      });
    }
    
    // GET /api/game/galaxy/:galaxy/:system
    if (path.match(/^\/api\/game\/galaxy\/\d+\/\d+$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }
      
      const pathParts = path.split('/');
      const galaxy = parseInt(pathParts[4], 10);
      const system = parseInt(pathParts[5], 10);
      
      // Get all players to scan for planets in this system
      const allPlayers = await getPlayers();
      const galaxyData = await getGalaxyData();
      const planetsInSystem = [];
      
      for (const player of allPlayers) {
        for (const planet of player.planets) {
          const [pGalaxy, pSystem, pPosition] = planet.coordinates;
          if (pGalaxy === galaxy && pSystem === system) {
            const coordKey = `${pGalaxy}:${pSystem}:${pPosition}`;
            const debris = galaxyData.debrisFields?.[coordKey] || null;

            planetsInSystem.push({
              position: pPosition,
              player: player.username,
              playerId: player.userId,
              playerType: player.isAI ? 'ai' : 'player',
              planetName: planet.name,
              activity: planet.lastActivity ? getActivityString(planet.lastActivity) : 'Unknown',
              moon: planet.moon || false,
              debris
            });
          }
        }
      }

      // Check for debris fields in empty slots
      for (const coordKey in (galaxyData.debrisFields || {})) {
        const [dg, ds, dp] = coordKey.split(':').map(Number);
        if (dg === galaxy && ds === system) {
          // If this slot doesn't have a planet already, we still need to show the debris
          if (!planetsInSystem.find(p => p.position === dp)) {
            planetsInSystem.push({
              position: dp,
              playerType: 'none',
              debris: galaxyData.debrisFields[coordKey]
            });
          }
        }
      }
      
      // Sort by position
      planetsInSystem.sort((a, b) => a.position - b.position);
      
      return successResponse(req, {
        galaxy,
        system,
        planets: planetsInSystem
      });
    }

    // POST /api/game/planet/:planetId/rename
    if (path.match(/^\/api\/game\/planet\/[^\/]+\/rename$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const planetId = path.split('/')[4];
      const body = await req.json();
      const { name } = body;
      
      try {
        const planet = await renamePlanet(user.id, planetId, name);
        return successResponse(req, planet);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/galaxy/mission - Send mission from galaxy view
    if (path === '/api/game/galaxy/mission' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse(req, 'Player not found', 404);
      }

      const body = await req.json();
      const { missionType, targetCoords, ships, originPlanetId, stayTime } = body;

      if (!missionType || !targetCoords || !ships) {
        return errorResponse(req, 'Missing mission details', 400);
      }

      try {
        // Find a planet that has these ships
        let originPlanet = null;
        if (originPlanetId) {
          originPlanet = player.planets.find(p => p.id === originPlanetId);
        } else {
          for (const p of player.planets) {
            let hasShips = true;
            for (const shipKey in ships) {
              if ((p.ships[shipKey] || 0) < ships[shipKey]) {
                hasShips = false;
                break;
              }
            }
            if (hasShips) {
              originPlanet = p;
              break;
            }
          }
        }

        if (!originPlanet) {
          return errorResponse(req, 'No planet found with sufficient ships for this mission', 400);
        }

        const fleet = await sendFleet(user.id, originPlanet.id, targetCoords, missionType, ships, {}, stayTime);
        return successResponse(req, fleet);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // ============================================
    // RESEARCH ROUTES
    // ============================================

    // GET /api/game/my-rank - Get current player's rank index
    if (path === '/api/game/my-rank' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      try {
        const index = await getPlayerRankIndex(user.id);
        return successResponse(req, { index });
      } catch (error) {
        return errorResponse(req, error.message, 500);
      }
    }

    // GET /api/game/rankings - Get player rankings
    if (path === '/api/game/rankings' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);

      try {
        const rankings = await getRankings(offset, limit);
        return successResponse(req, rankings);
      } catch (error) {
        return errorResponse(req, error.message, 500);
      }
    }

    // GET /api/game/research - Get all research info
    if (path === '/api/game/research' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse(req, 'Player not found', 404);
      }

      try {
        const progress = getResearchProgress(player);
        const theoreticalLevels = getTheoreticalResearchLevels(player);
        const practical = getPracticalResearchProgress(player);

        // Include metadata from shared research definitions
        const theoreticalMetadata = getTheoreticalResearch();
        const theoretical = {};
        for (const key in theoreticalMetadata) {
          theoretical[key] = {
            level: theoreticalLevels[key] || 0,
            detailedDescription: theoreticalMetadata[key].detailedDescription
          };
        }

        const blueprints = {
          ...(player.buildingBlueprints || {}),
          ...(player.shipBlueprints || {})
        };

        return successResponse(req, {
          progress,
          theoretical,
          practical,
          blueprints
        });
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // GET /api/game/research/history/:baseType - Get research history
    if (path.match(/^\/api\/game\/research\/history\/[^/]+$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const baseType = path.split('/')[5];
      try {
        const history = await getResearchHistory(user.id, baseType);
        return successResponse(req, history);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/planet/:planetId/research/theoretical - Start theoretical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/theoretical$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const planet = player.planets.find(p => p.id === planetId);

      const body = await req.json();
      const { techKey } = body;

      try {
        const queueItem = startTheoreticalResearch(player, techKey, planetId);
        await updatePlayer(user.id, player);
        return successResponse(req, queueItem);
      } catch (error) {
        console.error('Error starting theoretical research:', error);
        console.error('Error message:', error.message);
        return errorResponse(req, error.message, 400);
      }
    }

    // DELETE /api/game/planet/:planetId/research/theoretical/:queueId - Cancel theoretical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/theoretical\/[^/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const parts = path.split('/');
      const planetId = parts[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const queueId = parts[7];

      try {
        const refund = cancelTheoreticalResearch(player, queueId, planetId);
        await updatePlayer(user.id, player);

        return successResponse(req, { refund, cancelled: true });
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/planet/:planetId/research/practical - Start practical research level
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/practical$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }

      const planet = player.planets.find(p => p.id === planetId);

      const body = await req.json();
      const { researchKey, allocation, strength } = body;

      try {
        let queueItem;
        if (allocation) {
          // Allocation-based research (customization)
          queueItem = startPracticalResearchWithAllocation(player, researchKey, allocation, planetId, strength || 0.5);
        } else {
          // Simple default research (balanced)
          const defaultAllocation = { output: 0.25, automation: 0.25, energy: 0.25, cost: 0.25 };
          queueItem = startPracticalResearchWithAllocation(player, researchKey, defaultAllocation, planetId, 0.5);
        }
        await updatePlayer(user.id, player);

        return successResponse(req, queueItem);
      } catch (error) {
        console.error(`[PRACTICAL_RESEARCH] Error starting research:`, error.message);
        return errorResponse(req, error.message, 400);
      }
    }

    // DELETE /api/game/planet/:planetId/research/practical/:queueId - Cancel practical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/practical\/[^/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const parts = path.split('/');
      const planetId = parts[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const queueId = parts[7];

      try {
        const refund = cancelPracticalResearch(player, queueId, planetId);
        console.log(`[PRACTICAL_RESEARCH] Cancelled research: ${queueId}, refund:`, refund);
        await updatePlayer(user.id, player);

        return successResponse(req, { refund, cancelled: true });
      } catch (error) {
        console.error(`[PRACTICAL_RESEARCH] Error cancelling research:`, error.message);
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/research/practical/reset - Reset research to bank breakthroughs
    if (path === '/api/game/research/practical/reset' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const body = await req.json();
      const { baseType } = body;

      const player = await getPlayerByUserId(user.id);
      if (!player) return errorResponse(req, 'Player not found', 404);

      try {
        const result = resetPracticalResearch(player, baseType);
        await updatePlayer(user.id, player);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // GET /api/game/planet/:planetId/research/available - Get available practical research
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/available$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const planetId = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse(req, 'Player not found', 404);
      }

      try {
        const available = getAvailablePracticalResearchForPlayer(player, planetId);
        return successResponse(req, available);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/planet/:planetId/research/building-variant - Create a new blueprint
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/building-variant$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const body = await req.json();
      const { baseType, focusLevels, name } = body;

      try {
        const blueprint = await createBuildingBlueprint(user.id, baseType, focusLevels, name);
        return successResponse(req, blueprint);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/planet/:planetId/building/:baseType/activate-blueprint - Set active variant
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/activate-blueprint$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const parts = path.split('/');
      const planetId = parts[4];
      const player = await getPlayerByUserId(user.id);
      if (!player || !player.planets.find(p => p.id === planetId)) {
        return errorResponse(req, 'Unauthorized: You do not own this planet', 403);
      }
      
      const baseType = parts[6];
      const body = await req.json();
      const { blueprintId } = body;

      try {
        const result = await setActiveBlueprint(user.id, planetId, baseType, blueprintId);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // GET /api/game/blueprints/:baseType - Get all blueprints for a type
    if (path.match(/^\/api\/game\/blueprints\/[^/]+$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const baseType = path.split('/')[4];
      const player = await getPlayerByUserId(user.id);
      
      const blueprints = (player.buildingBlueprints && player.buildingBlueprints[baseType]) || [];
      return successResponse(req, blueprints);
    }

    // DELETE /api/game/blueprints/:baseType/:blueprintId - Delete building blueprint
    if (path.match(/^\/api\/game\/blueprints\/[^/]+\/[^/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const parts = path.split('/');
      const baseType = parts[4];
      const blueprintId = parts[5];

      try {
        const result = await deleteBuildingBlueprint(user.id, baseType, blueprintId);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // PATCH /api/game/blueprints/:baseType/:blueprintId - Rename building blueprint
    if (path.match(/^\/api\/game\/blueprints\/[^/]+\/[^/]+$/) && method === 'PATCH') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const parts = path.split('/');
      const baseType = parts[4];
      const blueprintId = parts[5];
      const body = await req.json();
      const { name } = body;

      try {
        const result = await renameBuildingBlueprint(user.id, baseType, blueprintId, name);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/research/ship-blueprint - Create a new ship blueprint
    if (path === '/api/game/research/ship-blueprint' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const body = await req.json();
      const { baseType, focusLevels, name } = body;

      try {
        const blueprint = await createShipBlueprint(user.id, baseType, focusLevels, name);
        return successResponse(req, blueprint);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // DELETE /api/game/research/ship-blueprint/:baseType/:blueprintId - Delete ship blueprint
    if (path.match(/^\/api\/game\/research\/ship-blueprint\/[^/]+\/[^/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const parts = path.split('/');
      const baseType = parts[5];
      const blueprintId = parts[6];

      try {
        const result = await deleteShipBlueprint(user.id, baseType, blueprintId);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // PATCH /api/game/research/ship-blueprint/:baseType/:blueprintId - Rename ship blueprint
    if (path.match(/^\/api\/game\/research\/ship-blueprint\/[^/]+\/[^/]+$/) && method === 'PATCH') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);

      const parts = path.split('/');
      const baseType = parts[5];
      const blueprintId = parts[6];
      const body = await req.json();
      const { name } = body;

      try {
        const result = await renameShipBlueprint(user.id, baseType, blueprintId, name);
        return successResponse(req, result);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/research/ship-variant - Set custom ship variant
    if (path === '/api/game/research/ship-variant' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse(req, 'Player not found', 404);
      }

      const body = await req.json();
      const { baseType, focusLevels } = body;

      try {
        const variant = selectCustomShipVariant(player, baseType, focusLevels);
        await updatePlayer(user.id, player);

        return successResponse(req, variant);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // GET /api/game/planet/:planetId/research/variants - Get active custom variants
    if (path.match(/^\/api\/game\/planet\/[^/]+\/research\/variants$/) && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) {
        return errorResponse(req, 'Not authenticated', 401);
      }

      const player = await getPlayerByUserId(user.id);
      if (!player) {
        return errorResponse(req, 'Player not found', 404);
      }

      try {
        const buildingBlueprints = player.buildingBlueprints || {};
        const shipBlueprints = player.shipBlueprints || {};

        return successResponse(req, {
          building: buildingBlueprints,
          ships: shipBlueprints
        });
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // ============================================
    // MESSAGE ROUTES
    // ============================================

    // GET /api/game/messages
    if (path === '/api/game/messages' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const messages = await getPlayerMessages(user.id);
      return successResponse(req, messages);
    }

    // POST /api/game/messages/:messageId/read
    if (path.match(/^\/api\/game\/messages\/[^\/]+\/read$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const messageId = path.split('/')[4];
      const result = await markMessageRead(user.id, messageId);
      return successResponse(req, { success: result });
    }

    // DELETE /api/game/messages/:messageId
    if (path.match(/^\/api\/game\/messages\/[^\/]+$/) && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const messageId = path.split('/')[4];
      const result = await deleteMessage(user.id, messageId);
      return successResponse(req, { success: result });
    }

    // DELETE /api/game/messages
    if (path === '/api/game/messages' && method === 'DELETE') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const result = await clearMessages(user.id);
      return successResponse(req, { success: result });
    }

    // POST /api/game/planet/:planetId/building/:buildingType/activate-blueprint
    if (path.match(/^\/api\/game\/planet\/[^/]+\/building\/[^/]+\/activate-blueprint$/) && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const pathParts = path.split('/');
      const planetId = pathParts[4];
      const buildingType = pathParts[6];

      const body = await req.json();
      const { blueprintId } = body;
      
      try {
        const player = await getPlayerByUserId(user.id);
        const planet = player.planets.find(p => p.id === planetId);
        if (!planet) return errorResponse(req, 'Planet not found', 404);

        if (!planet.activeVariants) planet.activeVariants = {};
        planet.activeVariants[buildingType] = blueprintId;
        
        await updatePlayer(user.id, player);
        return successResponse(req, { success: true });
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // GET /api/game/alliances
    if (path === '/api/game/alliances' && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const alliances = await getAlliances();
      return successResponse(req, Object.values(alliances));
    }

    // GET /api/game/alliance/:id
    if (path.startsWith('/api/game/alliance/') && method === 'GET') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const allianceId = path.split('/')[4];
      const alliance = await getAllianceById(allianceId);
      if (!alliance) return errorResponse(req, 'Alliance not found', 404);
      
      return successResponse(req, alliance);
    }

    // POST /api/game/alliance/create
    if (path === '/api/game/alliance/create' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const { name, tag } = await req.json();
      try {
        const alliance = await createAlliance(user.id, name, tag);
        return successResponse(req, alliance);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/alliance/join/:id
    if (path.startsWith('/api/game/alliance/join/') && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const allianceId = path.split('/')[4];
      try {
        const alliance = await joinAlliance(user.id, allianceId);
        return successResponse(req, alliance);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/alliance/leave
    if (path === '/api/game/alliance/leave' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      try {
        await leaveAlliance(user.id);
        return successResponse(req, { success: true });
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }

    // POST /api/game/relation
    if (path === '/api/game/relation' && method === 'POST') {
      const user = await requireAuth(req);
      if (!user) return errorResponse(req, 'Not authenticated', 401);
      
      const { targetUserId, tag } = await req.json();
      try {
        const relations = await updatePlayerRelation(user.id, targetUserId, tag);
        return successResponse(req, relations);
      } catch (error) {
        return errorResponse(req, error.message, 400);
      }
    }
    
    // 404 for unknown API routes
    return errorResponse(req, 'Route not found', 404);
    
  } catch (error) {
    console.error('Request error:', error);
    return errorResponse(req, error.message || 'Internal server error', 500);
  }
}

// Create server
const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`🚀 Space Adventure server running on http://localhost:${PORT}`);
