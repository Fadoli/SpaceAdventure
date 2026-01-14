// Alliance management logic
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { generateId } from '../../shared/utils.js';
import { ALLIANCE_ROLES } from '../../shared/constants.js';
import { getPlayerByUserId, updatePlayer } from './player.js';
import { getPlayerMessages } from './messages.js';

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

  // Validation
  if (!name || name.length < 3 || name.length > 30) throw new Error('Alliance name must be 3-30 characters');
  if (!tag || tag.length < 3 || tag.length > 8) throw new Error('Alliance tag must be 3-8 characters');
  if (!/^[a-zA-Z0-9]+$/.test(tag)) throw new Error('Alliance tag must be alphanumeric only');
  
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
  if (type !== 'building') throw new Error('Only building blueprints can be shared');
  
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  // 1. Get the blueprint
  const blueprints = player.buildingBlueprints;
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

    if (!targetPlayer.buildingBlueprints) targetPlayer.buildingBlueprints = {};
    if (!targetPlayer.buildingBlueprints[baseType]) targetPlayer.buildingBlueprints[baseType] = [];
    
    // Don't share if they already have an EXACT copy (same ID)
    if (targetPlayer.buildingBlueprints[baseType].some(bp => bp.id === blueprintId)) continue;

    const sharedBp = JSON.parse(JSON.stringify(blueprint));
    sharedBp.sharedBy = player.username;
    targetPlayer.buildingBlueprints[baseType].push(sharedBp);

    await updatePlayer(tId, targetPlayer);
    sharedCount++;
  }

  return { sharedCount };
}

/**
 * Get messages for an alliance
 */
export async function getAllianceMessages(allianceId) {
  const data = await readJsonFile(`alliances/${allianceId}/messages.json`);
  return data?.messages || [];
}

/**
 * Send a message to the alliance
 */
export async function sendAllianceMessage(userId, allianceId, content) {
  const player = await getPlayerByUserId(userId);
  if (!player || player.allianceId !== allianceId) {
    throw new Error('Not authorized to send messages to this alliance');
  }

  if (!content || content.trim().length === 0) {
    throw new Error('Message content cannot be empty');
  }

  const filename = `alliances/${allianceId}/messages.json`;
  const data = await readJsonFile(filename) || { messages: [] };
  if (!data.messages) data.messages = [];

  const newMessage = {
    id: generateId(),
    userId,
    username: player.username,
    content: content.trim(),
    timestamp: Date.now()
  };

  // Keep only last 50 messages for performance
  data.messages.push(newMessage);
  if (data.messages.length > 50) {
    data.messages.shift();
  }

  await writeJsonFile(filename, data);
  return newMessage;
}

/**
 * Share a report (message) to the alliance
 */
export async function shareAllianceReport(userId, allianceId, messageId) {
  const player = await getPlayerByUserId(userId);
  if (!player || player.allianceId !== allianceId) {
    throw new Error('Not authorized');
  }

  // Find the message in player's inbox
  const messages = await getPlayerMessages(userId);
  const message = messages.find(m => m.id === messageId);

  if (!message) {
    throw new Error('Report not found');
  }

  if (!['attack', 'espionage'].includes(message.type)) {
    throw new Error('Only combat and espionage reports can be shared');
  }

  // Format special shared message
  let content = '';
  if (message.type === 'attack') {
    const winner = message.data?.winner?.toUpperCase() || 'UNKNOWN';
    const coords = message.data?.targetCoords?.join(':') || '---';
    content = `[SHARED COMBAT REPORT] Result: ${winner} at [${coords}]`;
  } else {
    const power = message.data?.power || '0';
    const coords = message.data?.coords?.join(':') || '---';
    content = `[SHARED ESPIONAGE REPORT] Scan Power: ${power} at [${coords}]`;
  }

  const filename = `alliances/${allianceId}/messages.json`;
  const data = await readJsonFile(filename) || { messages: [] };
  
  const newMessage = {
    id: generateId(),
    userId: 'SYSTEM',
    username: `INTELLIGENCE (${player.username})`,
    content: content,
    timestamp: Date.now(),
    reportData: {
      type: message.type,
      data: message.data,
      originalSubject: message.subject
    }
  };

  data.messages.push(newMessage);
  if (data.messages.length > 50) data.messages.shift();

  await writeJsonFile(filename, data);
  return newMessage;
}
