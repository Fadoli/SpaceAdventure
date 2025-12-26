// Authentication system with bcrypt
import bcrypt from 'bcrypt';
import { generateId } from '../../shared/utils.js';
import { CONFIG } from '../../shared/constants.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';

// In-memory session storage
const sessions = new Map();

// Session persistence for hot-reload
let sessionsSaveTimeout = null;

/**
 * Load sessions from storage
 */
async function loadSessions() {
  try {
    const data = await readJsonFile('sessions.json');
    if (data && data.sessions) {
      // Clear existing sessions
      sessions.clear();
      
      // Load sessions from file
      const now = Date.now();
      for (const [token, session] of Object.entries(data.sessions)) {
        // Only load non-expired sessions
        if (session.expiresAt > now) {
          sessions.set(token, session);
        }
      }
      console.log(`Loaded ${sessions.size} active sessions from storage`);
    }
  } catch (error) {
    // File doesn't exist or error reading - that's ok, start fresh
    console.log('No existing sessions to load');
  }
}

/**
 * Save sessions to storage (debounced)
 */
function scheduleSaveSessions() {
  if (sessionsSaveTimeout) {
    clearTimeout(sessionsSaveTimeout);
  }
  
  sessionsSaveTimeout = setTimeout(async () => {
    try {
      const sessionsObj = {};
      for (const [token, session] of sessions.entries()) {
        sessionsObj[token] = session;
      }
      await writeJsonFile('sessions.json', { sessions: sessionsObj });
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }, 1000); // Wait 1 second before saving
}

// Load sessions on startup
await loadSessions();

/**
 * Get all users from storage
 */
async function getUsers() {
  const data = await readJsonFile('users.json');
  return data?.users || [];
}

/**
 * Save users to storage
 */
async function saveUsers(users) {
  return await writeJsonFile('users.json', { users });
}

/**
 * Find user by username
 */
export async function findUserByUsername(username) {
  const users = await getUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

/**
 * Find user by ID
 */
export async function findUserById(userId) {
  const users = await getUsers();
  return users.find(u => u.id === userId);
}

/**
 * Register a new user
 */
export async function registerUser(username, password, email = null) {
  // Validation
  if (!username || username.length < 3 || username.length > 20) {
    throw new Error('Username must be 3-20 characters');
  }
  
  // Password is already hashed on client (SHA-256), so it's 64 hex chars
  if (!password || password.length !== 64) {
    throw new Error('Invalid password format');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  // Check if username exists
  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    throw new Error('Username already exists');
  }
  
  // Hash the already-hashed password with bcrypt (double hashing for security)
  // Client sent SHA-256 hash, server adds bcrypt with salt
  const passwordHash = await bcrypt.hash(password, CONFIG.BCRYPT_SALT_ROUNDS);
  
  // Create user
  const user = {
    id: generateId(),
    username,
    passwordHash,
    email,
    createdAt: Date.now(),
    lastLogin: Date.now()
  };
  
  // Save to storage
  const users = await getUsers();
  users.push(user);
  await saveUsers(users);
  
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt
  };
}

/**
 * Authenticate user
 */
export async function authenticateUser(username, password) {
  const user = await findUserByUsername(username);
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!isValid) {
    throw new Error('Invalid credentials');
  }
  
  // Update last login
  user.lastLogin = Date.now();
  const users = await getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index !== -1) {
    users[index] = user;
    await saveUsers(users);
  }
  
  return {
    id: user.id,
    username: user.username,
    lastLogin: user.lastLogin
  };
}

/**
 * Create session for user
 */
export function createSession(userId) {
  const sessionToken = generateId();
  const expiresAt = Date.now() + CONFIG.SESSION_EXPIRE_TIME;
  
  sessions.set(sessionToken, {
    userId,
    expiresAt
  });
  
  // Save sessions to file
  scheduleSaveSessions();
  
  return sessionToken;
}

/**
 * Get session
 */
export function getSession(sessionToken) {
  const session = sessions.get(sessionToken);
  
  if (!session) {
    return null;
  }
  
  // Check if expired
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionToken);
    return null;
  }
  
  return session;
}

/**
 * Delete session
 */
export function deleteSession(sessionToken) {
  sessions.delete(sessionToken);
  
  // Save sessions to file
  scheduleSaveSessions();
}

/**
 * Get user from session token
 */
export async function getUserFromSession(sessionToken) {
  const session = getSession(sessionToken);
  
  if (!session) {
    return null;
  }
  
  return await findUserById(session.userId);
}

/**
 * Clean up expired sessions (run periodically)
 */
export function cleanupSessions() {
  const now = Date.now();
  let cleaned = false;
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
      cleaned = true;
    }
  }
  
  // Save if any sessions were cleaned up
  if (cleaned) {
    scheduleSaveSessions();
  }
}

// Clean up expired sessions every hour
setInterval(cleanupSessions, 60 * 60 * 1000);
