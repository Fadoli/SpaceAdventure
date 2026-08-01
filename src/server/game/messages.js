import { existsSync } from 'fs';
import { readFile, unlink, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { generateId } from '../../shared/utils.js';
import { wsManager } from './wsManager.js';
import { readJsonFile } from '../storage/storage.js';

const messagesCache = new Map(); // userId -> messages array
const dirtyMessageUsers = new Set();
const DATA_DIR = './data';

/**
 * Get the filename for a user's messages (JSONL format)
 */
function getMessagesFilename(userId) {
  return `${DATA_DIR}/players/${userId}/messages.jsonl`;
}

/**
 * Get the old filename for migration
 */
function getOldMessagesFilename(userId) {
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
  let messages = [];

  // Migration logic
  if (!existsSync(filename)) {
    const oldFilename = getOldMessagesFilename(userId);
    const oldData = await readJsonFile(oldFilename);
    if (oldData?.messages) {
      messages = oldData.messages;
      // Save in new format immediately to migrate
      await saveMessagesToJsonl(userId, messages);
      // Optional: delete old file
      // await unlink(`${DATA_DIR}/${oldFilename}`).catch(() => {});
    }
  } else {
    try {
      const file = Bun.file(filename);
      const text = await file.text();
      if (text) {
        messages = Bun.JSONL.parse(text);
      }
    } catch (error) {
      console.error(`Error reading messages for ${userId}:`, error.message);
    }
  }
  
  messagesCache.set(userId, messages);
  return messages;
}

/**
 * Save messages to JSONL format
 */
async function saveMessagesToJsonl(userId, messages) {
  const filename = getMessagesFilename(userId);
  const dir = dirname(filename);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const content = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
  await Bun.write(filename, content);
}

/**
 * Add a message to a player's mailbox
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
  wsManager.sendToUser(userId, 'NEW_MESSAGE', {
    count: messages.filter(m => !m.read).length,
    message: newMessage
  });

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
  console.log(`[Messages] Flushing ${count} dirty mailboxes to JSONL...`);

  const ids = Array.from(dirtyMessageUsers);
  dirtyMessageUsers.clear();

  for (const userId of ids) {
    const messages = messagesCache.get(userId);
    if (messages) {
      await saveMessagesToJsonl(userId, messages);
    }
  }
}
