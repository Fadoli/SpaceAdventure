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
import { upgradeBuilding, cancelBuilding, processCompletedBuildings } from './game/buildings.js';
import { startGameLoop } from './game/gameLoop.js';
import { BUILDINGS } from '../shared/buildings.js';

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
      
      try {
        const result = await cancelBuilding(user.id, planetId);
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
