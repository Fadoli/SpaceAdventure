import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { generateId } from '../../shared/utils.js';
import { wsManager } from './wsManager.js';

const messagesCache = new Map(); // userId -> messages array
const dirtyMessageUsers = new Set();

/**
 * Get the filename for a user's messages
 */
function getMessagesFilename(userId) {
  return `players/${userId}/messages.json`;
}

/**
 * Get all messages for a player
 */
export async function getPlayerMessages(userId) {
  if (messagesCache.has(userId)) {
    return messagesCache.get(userId);
  }

  const filename = getMessagesFilename(userId);
  const data = await readJsonFile(filename);
  const messages = data?.messages || [];
  
  messagesCache.set(userId, messages);
  return messages;
}

/**
 * Add a message to a player's mailbox
 * @param {string} userId - Target user ID
 * @param {Object} messageData - Message content (subject, body, sender, type, data)
 */
export async function addMessage(userId, messageData) {
  const messages = await getPlayerMessages(userId);
  
  const newMessage = {
    id: generateId(),
    timestamp: Date.now(),
    read: false,
    ...messageData
  };
  
  messages.unshift(newMessage); // Newest first
  
  // Limit to 100 messages
  if (messages.length > 100) {
    messages.pop();
  }
  
  dirtyMessageUsers.add(userId);

  // Notify client of new message
  wsManager.sendToUser(userId, 'NEW_MESSAGE', { count: messages.filter(m => !m.read).length });

  return newMessage;
}

/**
 * Mark a message as read
 */
export async function markMessageRead(userId, messageId) {
  const messages = await getPlayerMessages(userId);
  const message = messages.find(m => m.id === messageId);
  
  if (message) {
    message.read = true;
    dirtyMessageUsers.add(userId);
    return true;
  }
  return false;
}

/**
 * Delete a specific message
 */
export async function deleteMessage(userId, messageId) {
  const messages = await getPlayerMessages(userId);
  const initialLength = messages.length;
  
  const filtered = messages.filter(m => m.id !== messageId);
  
  if (filtered.length !== initialLength) {
    messagesCache.set(userId, filtered);
    dirtyMessageUsers.add(userId);
    return true;
  }
  return false;
}

/**
 * Delete all messages for a player
 */
export async function clearMessages(userId) {
  messagesCache.set(userId, []);
  dirtyMessageUsers.add(userId);
  return true;
}

/**
 * Flush all dirty message mailboxes to disk
 */
export async function flushDirtyMessages() {
  if (dirtyMessageUsers.size === 0) return;

  const count = dirtyMessageUsers.size;
  console.log(`[Storage] Flushing ${count} dirty mailboxes to disk...`);

  const ids = Array.from(dirtyMessageUsers);
  dirtyMessageUsers.clear();

  for (const userId of ids) {
    const messages = messagesCache.get(userId);
    if (messages) {
      await writeJsonFile(getMessagesFilename(userId), { messages });
    }
  }
}
