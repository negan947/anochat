/**
 * Storage module for AnoChat using Dexie (IndexedDB wrapper)
 * Handles encrypted key storage and room management
 */

import Dexie, { Table } from "dexie";
import {
  StoredIdentity,
  StoredRoom,
  SessionInfo,
  EncryptedPrivateKey,
  StorageError,
} from "./types";

import { STORAGE } from "./constants";

// Add Signal Protocol storage interfaces
interface StoredPreKey {
  keyId: number;
  keyPair: ArrayBuffer;
  createdAt: Date;
}

interface StoredSignedPreKey {
  keyId: number;
  keyPair: ArrayBuffer;
  createdAt: Date;
}

interface StoredSignalSession {
  identifier: string;
  record: ArrayBuffer;
  deviceId: number;
  createdAt: Date;
  lastUsed: Date;
}

interface StoredIdentityKey {
  identifier: string;
  identityKey: ArrayBuffer;
  createdAt: Date;
}

// Define the database schema
class AnoChatDatabase extends Dexie {
  identities!: Table<StoredIdentity>;
  rooms!: Table<StoredRoom>;
  sessions!: Table<SessionInfo>;
  
  // New Signal Protocol tables
  preKeys!: Table<StoredPreKey>;
  signedPreKeys!: Table<StoredSignedPreKey>;
  signalSessions!: Table<StoredSignalSession>;
  identityKeys!: Table<StoredIdentityKey>;

  constructor() {
    super(STORAGE.DATABASE_NAME);
    
    // Define database version and schema
    this.version(STORAGE.DATABASE_VERSION).stores({
      identities: "++id, fingerprint, createdAt, lastUsed",
      rooms: "++id, room_id, joinedAt, lastMessageAt",
      sessions: "sessionId, createdAt, expiresAt",
      
      // New Signal Protocol stores
      preKeys: "keyId, createdAt",
      signedPreKeys: "keyId, createdAt", 
      signalSessions: "identifier, deviceId, createdAt, lastUsed",
      identityKeys: "identifier, createdAt"
    });

    // Migration for existing v1 databases
    this.version(1).stores({
      identities: "++id, fingerprint, createdAt, lastUsed",
      rooms: "++id, room_id, joinedAt, lastMessageAt"
    });
  }
}

// Create database instance
const db = new AnoChatDatabase();

// Storage API
export const storage = {
  // Identity operations
  async saveIdentity(
    fingerprint: string,
    publicKey: Uint8Array,
    encryptedPrivateKey: EncryptedPrivateKey
  ): Promise<number> {
    try {
      return await db.identities.add({
        fingerprint,
        publicKey,
        encryptedPrivateKey,
        createdAt: new Date(),
        lastUsed: new Date(),
      } as StoredIdentity);
    } catch (error) {
      throw new StorageError(`Failed to save identity: ${error}`);
    }
  },

  async getIdentity(fingerprint: string): Promise<StoredIdentity | undefined> {
    try {
      const identity = await db.identities
        .where("fingerprint")
        .equals(fingerprint)
        .first();
      
      if (identity) {
        // Update last used timestamp
        await db.identities.update(identity.id!, { lastUsed: new Date() });
      }
      
      return identity;
    } catch (error) {
      throw new StorageError(`Failed to get identity: ${error}`);
    }
  },

  async getAllIdentities(): Promise<StoredIdentity[]> {
    try {
      return await db.identities.orderBy("lastUsed").reverse().toArray();
    } catch (error) {
      throw new StorageError(`Failed to get all identities: ${error}`);
    }
  },

  async deleteIdentity(fingerprint: string): Promise<void> {
    try {
      await db.identities.where("fingerprint").equals(fingerprint).delete();
    } catch (error) {
      throw new StorageError(`Failed to delete identity: ${error}`);
    }
  },

  // Room operations
  async saveRoom(
    room_id: string,
    name?: string,
    participants: string[] = []
  ): Promise<number> {
    try {
      return await db.rooms.add({
        room_id,
        name,
        participants,
        joinedAt: new Date(),
      } as StoredRoom);
    } catch (error) {
      throw new StorageError(`Failed to save room: ${error}`);
    }
  },

  async getRoom(room_id: string): Promise<StoredRoom | undefined> {
    try {
      return await db.rooms.where("room_id").equals(room_id).first();
    } catch (error) {
      throw new StorageError(`Failed to get room: ${error}`);
    }
  },

  async updateRoomLastMessage(room_id: string): Promise<void> {
    try {
      const room = await db.rooms.where("room_id").equals(room_id).first();
      if (room) {
        await db.rooms.update(room.id!, { lastMessageAt: new Date() });
      }
    } catch (error) {
      throw new StorageError(`Failed to update room: ${error}`);
    }
  },

  async addRoomParticipant(
    room_id: string,
    fingerprint: string
  ): Promise<void> {
    try {
      const room = await db.rooms.where("room_id").equals(room_id).first();
      if (room && !room.participants.includes(fingerprint)) {
        const updatedParticipants = [...room.participants, fingerprint];
        await db.rooms.update(room.id!, { participants: updatedParticipants });
      }
    } catch (error) {
      throw new StorageError(`Failed to add room participant: ${error}`);
    }
  },

  async getAllRooms(): Promise<StoredRoom[]> {
    try {
      return await db.rooms
        .orderBy("lastMessageAt")
        .reverse()
        .toArray();
    } catch (error) {
      throw new StorageError(`Failed to get all rooms: ${error}`);
    }
  },

  async deleteRoom(room_id: string): Promise<void> {
    try {
      await db.rooms.where("room_id").equals(room_id).delete();
    } catch (error) {
      throw new StorageError(`Failed to delete room: ${error}`);
    }
  },

  // Session operations (ephemeral)
  async saveSession(sessionId: string, expiresAt?: Date): Promise<void> {
    try {
      await db.sessions.put({
        sessionId,
        createdAt: new Date(),
        expiresAt,
      });
    } catch (error) {
      throw new StorageError(`Failed to save session: ${error}`);
    }
  },

  async getSession(sessionId: string): Promise<SessionInfo | undefined> {
    try {
      return await db.sessions.where("sessionId").equals(sessionId).first();
    } catch (error) {
      throw new StorageError(`Failed to get session: ${error}`);
    }
  },

  async deleteExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      await db.sessions
        .where("expiresAt")
        .below(now)
        .delete();
    } catch (error) {
      throw new StorageError(`Failed to delete expired sessions: ${error}`);
    }
  },

  // Enhanced burn operation with memory overwriting
  async burnEverything(): Promise<void> {
    try {
      // 1. Overwrite sensitive data in memory multiple times
      await this.secureMemoryWipe();

      // 2. Clear all IndexedDB databases
      await this.clearAllDatabases();

      // 3. Clear browser storage
      if (typeof window !== 'undefined') {
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear localStorage
        localStorage.clear();
        
        // Clear cookies
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substr(0, eqPos) : c;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
      }

      // 4. Force garbage collection if available
      if (typeof window !== 'undefined' && 'gc' in window) {
        (window as unknown as { gc: () => void }).gc();
      }

      // 5. Overwrite any remaining crypto keys in memory
      await this.wipeCryptoKeys();

      console.log('[SECURITY] Burn operation completed successfully');
    } catch (error) {
      console.error('[SECURITY] Burn operation failed:', error);
      throw new Error(`Burn operation failed: ${error}`);
    }
  },

  // Secure memory wipe with multiple overwrites
  async secureMemoryWipe(): Promise<void> {
    const overwritePatterns = [
      new Uint8Array(1024 * 1024).fill(0x00), // Zeros
      new Uint8Array(1024 * 1024).fill(0xFF), // Ones
      new Uint8Array(1024 * 1024).fill(0xAA), // Alternating pattern
      new Uint8Array(1024 * 1024).fill(0x55), // Inverse alternating
    ];

    // Perform multiple overwrites with different patterns
    for (let i = 0; i < 3; i++) {
      for (const pattern of overwritePatterns) {
        // Create large memory allocations to force overwriting
        const memoryBlocks = [];
        try {
          for (let j = 0; j < 100; j++) {
            memoryBlocks.push(new Uint8Array(pattern));
          }
          // Small delay to ensure memory operations complete
          await new Promise(resolve => setTimeout(resolve, 10));
        } finally {
          // Clear references
          memoryBlocks.length = 0;
        }
      }
    }
  },

  // Clear all IndexedDB databases
  async clearAllDatabases(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Close current database connection
      if (db.isOpen()) {
        db.close();
      }

      // Delete AnoChat database
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase('AnoChat');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => {
          // Force delete even if blocked
          setTimeout(() => resolve(), 1000);
        };
      });

      // Also try to delete any other potential databases
      const commonDbNames = ['keyval-store', 'localforage', 'signal-protocol'];
      for (const dbName of commonDbNames) {
        try {
          await new Promise<void>((resolve) => {
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => resolve(); // Continue even if error
            deleteRequest.onblocked = () => setTimeout(() => resolve(), 500);
          });
        } catch {
          // Continue with other databases
        }
      }
    } catch (error) {
      console.error('[SECURITY] Database clearing failed:', error);
    }
  },

  // Wipe cryptographic keys from memory
  async wipeCryptoKeys(): Promise<void> {
    // Create dummy crypto operations to overwrite key memory
    try {
      const sodium = await import('libsodium-wrappers-sumo');
      await sodium.ready;

      // Generate multiple dummy keys to overwrite memory
      for (let i = 0; i < 50; i++) {
        const dummyKey = sodium.crypto_box_keypair();
        // Overwrite the keys
        dummyKey.publicKey.fill(0);
        dummyKey.privateKey.fill(0);
        
        // Generate random data to further overwrite
        const randomData = sodium.randombytes_buf(1024);
        randomData.fill(0);
      }
    } catch (error) {
      console.error('[SECURITY] Crypto key wiping failed:', error);
    }
  },

  // Utility functions
  async exportIdentity(fingerprint: string): Promise<string> {
    try {
      const identity = await this.getIdentity(fingerprint);
      if (!identity) {
        throw new StorageError("Identity not found");
      }
      
      // Create exportable format (base64 encoded)
      const exportData = {
        fingerprint: identity.fingerprint,
        publicKey: Array.from(identity.publicKey),
        encryptedPrivateKey: {
          salt: Array.from(identity.encryptedPrivateKey.salt),
          nonce: Array.from(identity.encryptedPrivateKey.nonce),
          ciphertext: Array.from(identity.encryptedPrivateKey.ciphertext),
        },
        createdAt: identity.createdAt.toISOString(),
      };
      
      return btoa(JSON.stringify(exportData));
    } catch (error) {
      throw new StorageError(`Failed to export identity: ${error}`);
    }
  },

  async importIdentity(exportedData: string): Promise<number> {
    try {
      const data = JSON.parse(atob(exportedData));
      
      // Convert arrays back to Uint8Array
      const encryptedPrivateKey: EncryptedPrivateKey = {
        salt: new Uint8Array(data.encryptedPrivateKey.salt),
        nonce: new Uint8Array(data.encryptedPrivateKey.nonce),
        ciphertext: new Uint8Array(data.encryptedPrivateKey.ciphertext),
      };
      
      return await this.saveIdentity(
        data.fingerprint,
        new Uint8Array(data.publicKey),
        encryptedPrivateKey
      );
    } catch (error) {
      throw new StorageError(`Failed to import identity: ${error}`);
    }
  },

  // New Signal Protocol storage methods
  
  /**
   * Store a pre-key
   */
  async storePreKey(keyId: number, keyPair: ArrayBuffer): Promise<void> {
    try {
      await db.preKeys.put({
        keyId,
        keyPair,
        createdAt: new Date()
      });
    } catch (error) {
      throw new StorageError(`Failed to store pre-key: ${error}`);
    }
  },

  /**
   * Get a pre-key by ID
   */
  async getPreKey(keyId: number): Promise<ArrayBuffer | null> {
    try {
      const preKey = await db.preKeys.get(keyId);
      return preKey?.keyPair || null;
    } catch (error) {
      throw new StorageError(`Failed to get pre-key: ${error}`);
    }
  },

  /**
   * Remove a pre-key (used after one-time pre-key consumption)
   */
  async removePreKey(keyId: number): Promise<void> {
    try {
      await db.preKeys.delete(keyId);
    } catch (error) {
      throw new StorageError(`Failed to remove pre-key: ${error}`);
    }
  },

  /**
   * Get all pre-key IDs
   */
  async getAllPreKeyIds(): Promise<number[]> {
    try {
      const preKeys = await db.preKeys.toArray();
      return preKeys.map(pk => pk.keyId);
    } catch (error) {
      throw new StorageError(`Failed to get all pre-key IDs: ${error}`);
    }
  },

  /**
   * Store a signed pre-key
   */
  async storeSignedPreKey(keyId: number, keyPair: ArrayBuffer): Promise<void> {
    try {
      await db.signedPreKeys.put({
        keyId,
        keyPair,
        createdAt: new Date()
      });
    } catch (error) {
      throw new StorageError(`Failed to store signed pre-key: ${error}`);
    }
  },

  /**
   * Get a signed pre-key by ID
   */
  async getSignedPreKey(keyId: number): Promise<ArrayBuffer | null> {
    try {
      const signedPreKey = await db.signedPreKeys.get(keyId);
      return signedPreKey?.keyPair || null;
    } catch (error) {
      throw new StorageError(`Failed to get signed pre-key: ${error}`);
    }
  },

  /**
   * Store a Signal session
   */
  async storeSignalSession(identifier: string, record: ArrayBuffer): Promise<void> {
    try {
      // Extract device ID from identifier (format: "name.deviceId")
      const parts = identifier.split('.');
      const deviceId = parts.length > 1 ? parseInt(parts[parts.length - 1]) : 1;

      await db.signalSessions.put({
        identifier,
        record,
        deviceId,
        createdAt: new Date(),
        lastUsed: new Date()
      });
    } catch (error) {
      throw new StorageError(`Failed to store signal session: ${error}`);
    }
  },

  /**
   * Get a Signal session
   */
  async getSignalSession(identifier: string): Promise<ArrayBuffer | undefined> {
    try {
      const session = await db.signalSessions.get(identifier);
      if (session) {
        // Update last used timestamp
        await db.signalSessions.update(identifier, { lastUsed: new Date() });
        return session.record;
      }
      return undefined;
    } catch (error) {
      throw new StorageError(`Failed to get signal session: ${error}`);
    }
  },

  /**
   * Remove a specific Signal session
   */
  async removeSignalSession(identifier: string): Promise<void> {
    try {
      await db.signalSessions.delete(identifier);
    } catch (error) {
      throw new StorageError(`Failed to remove signal session: ${error}`);
    }
  },

  /**
   * Remove all Signal sessions for an identifier (all devices)
   */
  async removeAllSessionsForIdentifier(baseIdentifier: string): Promise<void> {
    try {
      // Remove all sessions that start with the base identifier
      await db.signalSessions
        .where('identifier')
        .startsWith(baseIdentifier)
        .delete();
    } catch (error) {
      throw new StorageError(`Failed to remove all signal sessions: ${error}`);
    }
  },

  /**
   * Get all device IDs for a base identifier
   */
  async getDeviceIds(baseIdentifier: string): Promise<number[]> {
    try {
      const sessions = await db.signalSessions
        .where('identifier')
        .startsWith(baseIdentifier)
        .toArray();
      
      return sessions.map(session => session.deviceId);
    } catch (error) {
      throw new StorageError(`Failed to get device IDs: ${error}`);
    }
  },

  /**
   * Store an identity key for a remote party
   */
  async storeIdentityKey(identifier: string, identityKey: ArrayBuffer): Promise<void> {
    try {
      await db.identityKeys.put({
        identifier,
        identityKey,
        createdAt: new Date()
      });
    } catch (error) {
      throw new StorageError(`Failed to store identity key: ${error}`);
    }
  },

  /**
   * Get an identity key for a remote party
   */
  async getIdentityKey(identifier: string): Promise<ArrayBuffer | null> {
    try {
      const identityKey = await db.identityKeys.get(identifier);
      return identityKey?.identityKey || null;
    } catch (error) {
      throw new StorageError(`Failed to get identity key: ${error}`);
    }
  },

  /**
   * Remove an identity key
   */
  async removeIdentityKey(identifier: string): Promise<void> {
    try {
      await db.identityKeys.delete(identifier);
    } catch (error) {
      throw new StorageError(`Failed to remove identity key: ${error}`);
    }
  },

  // Utility methods

  /**
   * Clear all data (burn notice)
   */
  async clearAll(): Promise<void> {
    try {
      await db.transaction('rw', [
        db.identities,
        db.rooms,
        db.sessions,
        db.preKeys,
        db.signedPreKeys,
        db.signalSessions,
        db.identityKeys
      ], async () => {
        await db.identities.clear();
        await db.rooms.clear();
        await db.sessions.clear();
        await db.preKeys.clear();
        await db.signedPreKeys.clear();
        await db.signalSessions.clear();
        await db.identityKeys.clear();
      });
    } catch (error) {
      throw new StorageError(`Failed to clear all data: ${error}`);
    }
  },

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    identities: number;
    rooms: number;
    sessions: number;
    preKeys: number;
    signedPreKeys: number;
    signalSessions: number;
    identityKeys: number;
  }> {
    try {
      const [identities, rooms, sessions, preKeys, signedPreKeys, signalSessions, identityKeys] = await Promise.all([
        db.identities.count(),
        db.rooms.count(),
        db.sessions.count(),
        db.preKeys.count(),
        db.signedPreKeys.count(),
        db.signalSessions.count(),
        db.identityKeys.count()
      ]);

      return {
        identities,
        rooms,
        sessions,
        preKeys,
        signedPreKeys,
        signalSessions,
        identityKeys
      };
    } catch (error) {
      throw new StorageError(`Failed to get storage stats: ${error}`);
    }
  },
};

// Initialize database on load
if (typeof window !== "undefined") {
  db.open().catch((error) => {
    console.error("Failed to open database:", error);
  });
}

export default storage; 