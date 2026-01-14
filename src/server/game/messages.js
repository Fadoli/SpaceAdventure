import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { generateId } from '../../shared/utils.js';
import { wsManager } from './wsManager.js';

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
  const filename = getMessagesFilename(userId);
  const data = await readJsonFile(filename);
  return data?.messages || [];
}

/**
 * Add a message to a player's mailbox
 * @param {string} userId - Target user ID
 * @param {Object} messageData - Message content (subject, body, sender, type, data)
 */
export async function addMessage(userId, messageData) {
  const filename = getMessagesFilename(userId);
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
  
  await writeJsonFile(filename, { messages });

  // Notify client of new message
  wsManager.sendToUser(userId, 'NEW_MESSAGE', { count: messages.filter(m => !m.read).length });

  return newMessage;
}

/**
 * Mark a message as read
 */
export async function markMessageRead(userId, messageId) {
  const filename = getMessagesFilename(userId);
  const messages = await getPlayerMessages(userId);
  const message = messages.find(m => m.id === messageId);
  
  if (message) {
    message.read = true;
    await writeJsonFile(filename, { messages });
    return true;
  }
  return false;
}

/**
 * Delete a specific message
 */
export async function deleteMessage(userId, messageId) {
  const filename = getMessagesFilename(userId);
  const messages = await getPlayerMessages(userId);
  const filtered = messages.filter(m => m.id !== messageId);
  
  if (filtered.length !== messages.length) {
    await writeJsonFile(filename, { messages: filtered });
    return true;
  }
  return false;
}

/**
 * Delete all messages for a player
 */
export async function clearMessages(userId) {
  const filename = getMessagesFilename(userId);
  await writeJsonFile(filename, { messages: [] });
  return true;
}
