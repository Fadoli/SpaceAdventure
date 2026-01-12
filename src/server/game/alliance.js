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

/**
 * Share a blueprint with alliance or a specific friend
 */
export async function shareBlueprint(userId, baseType, blueprintId, type, targetType, targetId = null) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  // 1. Get the blueprint
  const blueprints = type === 'building' ? player.buildingBlueprints : player.shipBlueprints;
  const blueprint = blueprints?.[baseType]?.find(bp => bp.id === blueprintId);
  if (!blueprint) throw new Error('Blueprint not found');

  const targets = [];

  // 2. Identify targets
  if (targetType === 'alliance') {
    if (!player.allianceId) throw new Error('You are not in an alliance');
    const alliance = await getAllianceById(player.allianceId);
    if (!alliance) throw new Error('Alliance not found');
    
    // Add all alliance members except self
    alliance.members.forEach(m => {
      if (m.userId !== userId) targets.push(m.userId);
    });
  } else if (targetType === 'player') {
    if (!targetId) throw new Error('Target player ID required');
    // Verify target is a friend
    if (player.relations?.[targetId] !== 'friend') {
      throw new Error('You can only share blueprints with players tagged as FRIEND');
    }
    targets.push(targetId);
  }

  if (targets.length === 0) return { sharedCount: 0 };

  // 3. Clone and Distribute
  let sharedCount = 0;
  for (const tId of targets) {
    const targetPlayer = await getPlayerByUserId(tId);
    if (!targetPlayer) continue;

    // Determine target collection
    if (type === 'building') {
      if (!targetPlayer.buildingBlueprints) targetPlayer.buildingBlueprints = {};
      if (!targetPlayer.buildingBlueprints[baseType]) targetPlayer.buildingBlueprints[baseType] = [];
      
      // Don't share if they already have an EXACT copy (same ID)
      if (targetPlayer.buildingBlueprints[baseType].some(bp => bp.id === blueprintId)) continue;

      const sharedBp = JSON.parse(JSON.stringify(blueprint));
      sharedBp.sharedBy = player.username;
      targetPlayer.buildingBlueprints[baseType].push(sharedBp);
    } else {
      if (!targetPlayer.shipBlueprints) targetPlayer.shipBlueprints = {};
      if (!targetPlayer.shipBlueprints[baseType]) targetPlayer.shipBlueprints[baseType] = [];
      
      if (targetPlayer.shipBlueprints[baseType].some(bp => bp.id === blueprintId)) continue;

      const sharedBp = JSON.parse(JSON.stringify(blueprint));
      sharedBp.sharedBy = player.username;
      targetPlayer.shipBlueprints[baseType].push(sharedBp);
    }

    await updatePlayer(tId, targetPlayer);
    sharedCount++;
  }

  return { sharedCount };
}
