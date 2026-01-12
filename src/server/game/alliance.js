// Alliance management logic
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { generateId } from '../../shared/utils.js';
import { ALLIANCE_ROLES } from '../../shared/constants.js';
import { getPlayerByUserId, updatePlayer } from './player.js';

let alliancesCache = null;

/**
 * Get all alliances
 */
export async function getAlliances() {
  if (alliancesCache) return alliancesCache;
  
  const data = await readJsonFile('alliances.json');
  alliancesCache = data?.alliances || {};
  return alliancesCache;
}

/**
 * Get alliance by ID
 */
export async function getAllianceById(allianceId) {
  const alliances = await getAlliances();
  return alliances[allianceId] || null;
}

/**
 * Create a new alliance
 */
export async function createAlliance(userId, name, tag) {
  const alliances = await getAlliances();
  const player = await getPlayerByUserId(userId);
  
  if (!player) throw new Error('Player not found');
  if (player.allianceId) throw new Error('Player already in an alliance');
  
  // Check if name or tag taken
  for (const id in alliances) {
    if (alliances[id].name.toLowerCase() === name.toLowerCase()) throw new Error('Alliance name already taken');
    if (alliances[id].tag.toLowerCase() === tag.toLowerCase()) throw new Error('Alliance tag already taken');
  }
  
  const allianceId = generateId();
  const alliance = {
    id: allianceId,
    name,
    tag,
    founderId: userId,
    createdAt: Date.now(),
    description: `Welcome to ${name}`,
    members: [
      {
        userId,
        username: player.username,
        role: ALLIANCE_ROLES.FOUNDER,
        joinedAt: Date.now()
      }
    ],
    applications: []
  };
  
  alliances[allianceId] = alliance;
  await writeJsonFile('alliances.json', { alliances });
  
  // Link player to alliance
  player.allianceId = allianceId;
  player.allianceRole = ALLIANCE_ROLES.FOUNDER;
  await updatePlayer(userId, player);
  
  return alliance;
}

/**
 * Join an alliance
 */
export async function joinAlliance(userId, allianceId) {
  const alliances = await getAlliances();
  const alliance = alliances[allianceId];
  const player = await getPlayerByUserId(userId);
  
  if (!alliance) throw new Error('Alliance not found');
  if (!player) throw new Error('Player not found');
  if (player.allianceId) throw new Error('Player already in an alliance');
  
  // Add member
  alliance.members.push({
    userId,
    username: player.username,
    role: ALLIANCE_ROLES.MEMBER,
    joinedAt: Date.now()
  });
  
  await writeJsonFile('alliances.json', { alliances });
  
  // Link player
  player.allianceId = allianceId;
  player.allianceRole = ALLIANCE_ROLES.MEMBER;
  await updatePlayer(userId, player);
  
  return alliance;
}

/**
 * Leave an alliance
 */
export async function leaveAlliance(userId) {
  const player = await getPlayerByUserId(userId);
  if (!player || !player.allianceId) throw new Error('Player not in an alliance');
  
  const alliances = await getAlliances();
  const alliance = alliances[player.allianceId];
  
  if (!alliance) {
    // Clean up corrupted player state
    player.allianceId = null;
    player.allianceRole = null;
    await updatePlayer(userId, player);
    return;
  }
  
  // If founder leaves, the alliance might need a new founder or be deleted
  if (alliance.founderId === userId) {
    if (alliance.members.length === 1) {
      // Last member is founder, delete alliance
      delete alliances[player.allianceId];
    } else {
      // Find someone else to be founder (oldest member)
      alliance.members = alliance.members.filter(m => m.userId !== userId);
      const nextFounder = alliance.members[0];
      nextFounder.role = ALLIANCE_ROLES.FOUNDER;
      alliance.founderId = nextFounder.userId;
      
      // Update the new founder's player data too
      const newFounderPlayer = await getPlayerByUserId(nextFounder.userId);
      if (newFounderPlayer) {
        newFounderPlayer.allianceRole = ALLIANCE_ROLES.FOUNDER;
        await updatePlayer(nextFounder.userId, newFounderPlayer);
      }
    }
  } else {
    // Normal member leaves
    alliance.members = alliance.members.filter(m => m.userId !== userId);
  }
  
  await writeJsonFile('alliances.json', { alliances });
  
  // Clear player link
  player.allianceId = null;
  player.allianceRole = null;
  await updatePlayer(userId, player);
}
