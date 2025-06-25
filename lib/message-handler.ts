import { EncryptedMessage, DecryptedMessage } from './types';
import { 
  encryptMessage as signalEncrypt, 
  decryptMessage as signalDecrypt,
  initSignalProtocol
} from './signal-protocol';
import { insertMessage, fetchMessages, subscribeToRoom } from './supabase';
import { metadataProtection, PaddingScheme } from './metadata-protection';
import { sessionManager } from './session';

// Message queue for offline/retry handling
interface QueuedMessage {
  id: string;
  roomId: string;
  content: string;
  recipientFingerprint: string;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

// In-memory queues
const outgoingQueue: Map<string, QueuedMessage> = new Map();
const processingQueue: Set<string> = new Set();

// Message cache for deduplication
const messageCache: Map<string, DecryptedMessage> = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const RETRY_BACKOFF_FACTOR = 2;

// Default device ID (simplified for this implementation)
const DEFAULT_DEVICE_ID = 1;

// Initialize Signal Protocol on module load
let signalInitialized = false;
async function ensureSignalInitialized() {
  if (!signalInitialized) {
    await initSignalProtocol();
    signalInitialized = true;
  }
}

// Wrapper for simplified encryption with metadata protection
async function encryptMessage(
  content: string,
  recipientFingerprint: string
): Promise<{ ciphertext: Uint8Array; header: Uint8Array } | null> {
  await ensureSignalInitialized();
  
  try {
    const encrypted = await signalEncrypt(recipientFingerprint, DEFAULT_DEVICE_ID, content);
    
    // Convert the encrypted format to our expected format
    let body = Uint8Array.from(atob(encrypted.body), c => c.charCodeAt(0));
    
    // Apply message padding for metadata protection
    body = new Uint8Array(metadataProtection.padMessage(body, PaddingScheme.BLOCK));
    
    const headerObj = JSON.stringify({
      type: encrypted.type,
      ek: encrypted.ek,
      ik: encrypted.ik
    });
    const header = typeof window !== 'undefined'
      ? new TextEncoder().encode(headerObj)
      : Uint8Array.from(Buffer.from(headerObj, 'utf8'));
    
    return {
      ciphertext: body,
      header: header
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

// Wrapper for simplified decryption with metadata protection
async function decryptMessage(
  ciphertext: Uint8Array,
  header: Uint8Array,
  senderFingerprint: string
): Promise<string | null> {
  await ensureSignalInitialized();
  
  try {
    // Remove padding first
    const unpaddedCiphertext = metadataProtection.unpadMessage(ciphertext);
    
    // Parse header to get encryption metadata
    // Use Buffer.from for Node.js environment (Jest)
    const headerStr = typeof window !== 'undefined' 
      ? new TextDecoder().decode(header)
      : Buffer.from(header).toString('utf8');
    const metadata = JSON.parse(headerStr);
    
    // Convert ciphertext back to base64
    const body = btoa(String.fromCharCode(...unpaddedCiphertext));
    
    const encrypted = {
      type: metadata.type || 1,
      body: body,
      ek: metadata.ek,
      ik: metadata.ik
    };
    
    const decrypted = await signalDecrypt(senderFingerprint, DEFAULT_DEVICE_ID, encrypted);
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

/**
 * Send an encrypted message with metadata protection
 */
export async function sendMessage(
  roomId: string,
  content: string,
  recipientFingerprint: string,
  senderFingerprint: string
): Promise<boolean> {
  const messageId = generateMessageId();
  
  try {
    // Add random delay for timing analysis protection
    await metadataProtection.addRandomDelay();
    
    // Add to queue first
    const queuedMessage: QueuedMessage = {
      id: messageId,
      roomId,
      content,
      recipientFingerprint,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: MAX_RETRY_ATTEMPTS,
    };
    
    outgoingQueue.set(messageId, queuedMessage);
    
    // Attempt to send
    const success = await processOutgoingMessage(queuedMessage, senderFingerprint);
    
    if (success) {
      outgoingQueue.delete(messageId);
      
      // Extend session on successful message send
      sessionManager.extendSession();
    }
    
    return success;
  } catch (error) {
    console.error('Send message failed:', error);
    return false;
  }
}

/**
 * Process outgoing message
 */
async function processOutgoingMessage(
  message: QueuedMessage,
  senderFingerprint: string
): Promise<boolean> {
  if (processingQueue.has(message.id)) {
    return false; // Already processing
  }
  
  processingQueue.add(message.id);
  
  try {
    // Encrypt the message
    const encrypted = await encryptMessage(
      message.content,
      message.recipientFingerprint
    );
    
    if (!encrypted) {
      throw new Error('Encryption failed');
    }
    
    // Create encrypted message with metadata protection
    const encryptedMessage: EncryptedMessage = {
      room_id: message.roomId,
      sender_fingerprint: senderFingerprint,
      ciphertext: encrypted.ciphertext,
      header: encrypted.header,
      created_at: new Date(),
    };
    
    // Sanitize metadata before sending
    const sanitizedMessage = metadataProtection.sanitizeMessageMetadata(encryptedMessage);
    
    // Send to Supabase
    const result = await insertMessage(
      sanitizedMessage.room_id,
      sanitizedMessage.sender_fingerprint,
      sanitizedMessage.ciphertext,
      sanitizedMessage.header
    );
    
    if (!result) {
      throw new Error('Failed to insert message');
    }
    
    return true;
  } catch (error) {
    console.error('Process message error:', error);
    
    // Handle retry
    if (message.retryCount < message.maxRetries) {
      message.retryCount++;
      const delay = RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_FACTOR, message.retryCount - 1);
      
      setTimeout(() => {
        processingQueue.delete(message.id);
        processOutgoingMessage(message, senderFingerprint);
      }, delay);
    }
    
    return false;
  } finally {
    processingQueue.delete(message.id);
  }
}

/**
 * Process incoming encrypted message
 */
export async function processIncomingMessage(
  encryptedMessage: EncryptedMessage
): Promise<DecryptedMessage | null> {
  try {
    // Check cache first
    const cacheKey = getCacheKey(encryptedMessage);
    const cached = messageCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Decrypt the message
    const decrypted = await decryptMessage(
      encryptedMessage.ciphertext,
      encryptedMessage.header,
      encryptedMessage.sender_fingerprint
    );
    
    if (!decrypted) {
      console.error('Failed to decrypt message');
      return null;
    }
    
    const decryptedMessage: DecryptedMessage = {
      id: encryptedMessage.id || generateMessageId(),
      room_id: encryptedMessage.room_id,
      sender_fingerprint: encryptedMessage.sender_fingerprint,
      content: decrypted,
      timestamp: encryptedMessage.created_at || new Date(),
    };
    
    // Add to cache
    addToCache(cacheKey, decryptedMessage);
    
    return decryptedMessage;
  } catch (error) {
    console.error('Process incoming message error:', error);
    return null;
  }
}

/**
 * Load and decrypt room history
 */
export async function loadRoomHistory(
  roomId: string,
  limit: number = 50
): Promise<DecryptedMessage[]> {
  try {
    const encryptedMessages = await fetchMessages(roomId, limit);
    const decryptedMessages: DecryptedMessage[] = [];
    
    for (const encrypted of encryptedMessages) {
      const decrypted = await processIncomingMessage(encrypted);
      if (decrypted) {
        decryptedMessages.push(decrypted);
      }
    }
    
    // Sort by timestamp
    return decryptedMessages.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  } catch (error) {
    console.error('Load room history error:', error);
    return [];
  }
}

/**
 * Subscribe to room messages with decryption
 */
export function subscribeToRoomMessages(
  roomId: string,
  onMessage: (message: DecryptedMessage) => void
): () => void {
  return subscribeToRoom(roomId, async (encryptedMessage) => {
    const decrypted = await processIncomingMessage(encryptedMessage);
    if (decrypted) {
      onMessage(decrypted);
    }
  });
}

/**
 * Retry failed messages
 */
export async function retryFailedMessages(senderFingerprint: string): Promise<void> {
  const messages = Array.from(outgoingQueue.values());
  
  for (const message of messages) {
    if (!processingQueue.has(message.id)) {
      await processOutgoingMessage(message, senderFingerprint);
    }
  }
}

/**
 * Clear message queue for a room
 */
export function clearRoomQueue(roomId: string): void {
  for (const [id, message] of outgoingQueue) {
    if (message.roomId === roomId) {
      outgoingQueue.delete(id);
      processingQueue.delete(id);
    }
  }
}

/**
 * Get pending messages count
 */
export function getPendingMessagesCount(): number {
  return outgoingQueue.size;
}

/**
 * Clear all queues and caches
 */
export function clearAllQueues(): void {
  outgoingQueue.clear();
  processingQueue.clear();
  messageCache.clear();
}

// Helper functions

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCacheKey(message: EncryptedMessage): string {
  return `${message.room_id}_${message.sender_fingerprint}_${message.created_at}`;
}

function addToCache(key: string, message: DecryptedMessage): void {
  // Implement LRU cache behavior
  if (messageCache.size >= CACHE_MAX_SIZE) {
    const firstKey = messageCache.keys().next().value;
    if (firstKey) {
      messageCache.delete(firstKey);
    }
  }
  
  messageCache.set(key, message);
  
  // Clean expired entries periodically
  setTimeout(() => {
    messageCache.delete(key);
  }, CACHE_TTL_MS);
}

/**
 * Message ordering helper
 */
export function sortMessagesByTimestamp(messages: DecryptedMessage[]): DecryptedMessage[] {
  return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Message deduplication helper
 */
export function deduplicateMessages(messages: DecryptedMessage[]): DecryptedMessage[] {
  const seen = new Set<string>();
  return messages.filter(msg => {
    const key = `${msg.id}_${msg.timestamp.getTime()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
} 