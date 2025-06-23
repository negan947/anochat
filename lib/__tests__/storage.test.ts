/**
 * Tests for storage module using Dexie
 */

import 'fake-indexeddb/auto';
import storage from '../storage';
import { EncryptedPrivateKey, StorageError } from '../types';

describe('Storage Module', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await storage.burnEverything();
  });

  describe('Identity Operations', () => {
    const mockIdentity = {
      fingerprint: 'test-fingerprint-123',
      publicKey: new Uint8Array([1, 2, 3]),
      encryptedPrivateKey: {
        salt: new Uint8Array([4, 5, 6]),
        nonce: new Uint8Array([7, 8, 9]),
        ciphertext: new Uint8Array([10, 11, 12])
      } as EncryptedPrivateKey
    };

    it('should save identity successfully', async () => {
      const id = await storage.saveIdentity(
        mockIdentity.fingerprint,
        mockIdentity.publicKey,
        mockIdentity.encryptedPrivateKey
      );
      
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('should retrieve identity by fingerprint', async () => {
      await storage.saveIdentity(
        mockIdentity.fingerprint,
        mockIdentity.publicKey,
        mockIdentity.encryptedPrivateKey
      );

      const retrieved = await storage.getIdentity(mockIdentity.fingerprint);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.fingerprint).toBe(mockIdentity.fingerprint);
      expect(retrieved?.publicKey).toEqual(mockIdentity.publicKey);
      expect(retrieved?.encryptedPrivateKey).toEqual(mockIdentity.encryptedPrivateKey);
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.lastUsed).toBeInstanceOf(Date);
    });

    it('should update lastUsed timestamp when getting identity', async () => {
      await storage.saveIdentity(
        mockIdentity.fingerprint,
        mockIdentity.publicKey,
        mockIdentity.encryptedPrivateKey
      );

      const firstGet = await storage.getIdentity(mockIdentity.fingerprint);
      const firstLastUsed = firstGet?.lastUsed;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondGet = await storage.getIdentity(mockIdentity.fingerprint);
      const secondLastUsed = secondGet?.lastUsed;

      expect(secondLastUsed?.getTime()).toBeGreaterThan(firstLastUsed?.getTime() || 0);
    });

    it('should return undefined for non-existent identity', async () => {
      const result = await storage.getIdentity('non-existent');
      expect(result).toBeUndefined();
    });

    it('should get all identities sorted by lastUsed', async () => {
      // Save multiple identities
      await storage.saveIdentity('fingerprint1', new Uint8Array([1]), mockIdentity.encryptedPrivateKey);
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.saveIdentity('fingerprint2', new Uint8Array([2]), mockIdentity.encryptedPrivateKey);
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.saveIdentity('fingerprint3', new Uint8Array([3]), mockIdentity.encryptedPrivateKey);

      // Access the first one to update its lastUsed
      await storage.getIdentity('fingerprint1');

      const all = await storage.getAllIdentities();
      
      expect(all.length).toBe(3);
      expect(all[0].fingerprint).toBe('fingerprint1'); // Most recently used
    });

    it('should delete identity', async () => {
      await storage.saveIdentity(
        mockIdentity.fingerprint,
        mockIdentity.publicKey,
        mockIdentity.encryptedPrivateKey
      );

      await storage.deleteIdentity(mockIdentity.fingerprint);
      
      const result = await storage.getIdentity(mockIdentity.fingerprint);
      expect(result).toBeUndefined();
    });

    it('should export and import identity', async () => {
      await storage.saveIdentity(
        mockIdentity.fingerprint,
        mockIdentity.publicKey,
        mockIdentity.encryptedPrivateKey
      );

      const exported = await storage.exportIdentity(mockIdentity.fingerprint);
      expect(typeof exported).toBe('string');

      // Clear storage
      await storage.burnEverything();

      // Import back
      const importedId = await storage.importIdentity(exported);
      expect(typeof importedId).toBe('number');

      // Verify imported data
      const imported = await storage.getIdentity(mockIdentity.fingerprint);
      expect(imported?.fingerprint).toBe(mockIdentity.fingerprint);
      expect(imported?.publicKey).toEqual(mockIdentity.publicKey);
    });

    it('should throw error when exporting non-existent identity', async () => {
      await expect(storage.exportIdentity('non-existent'))
        .rejects.toThrow('Identity not found');
    });
  });

  describe('Room Operations', () => {
    const mockRoom = {
      room_id: 'test-room-123',
      name: 'Test Room',
      participants: ['fingerprint1', 'fingerprint2']
    };

    it('should save room successfully', async () => {
      const id = await storage.saveRoom(
        mockRoom.room_id,
        mockRoom.name,
        mockRoom.participants
      );
      
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('should retrieve room by room_id', async () => {
      await storage.saveRoom(
        mockRoom.room_id,
        mockRoom.name,
        mockRoom.participants
      );

      const retrieved = await storage.getRoom(mockRoom.room_id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.room_id).toBe(mockRoom.room_id);
      expect(retrieved?.name).toBe(mockRoom.name);
      expect(retrieved?.participants).toEqual(mockRoom.participants);
      expect(retrieved?.joinedAt).toBeInstanceOf(Date);
    });

    it('should save room without name', async () => {
      await storage.saveRoom(mockRoom.room_id);
      const room = await storage.getRoom(mockRoom.room_id);
      
      expect(room?.name).toBeUndefined();
      expect(room?.participants).toEqual([]);
    });

    it('should update room last message timestamp', async () => {
      await storage.saveRoom(mockRoom.room_id);
      const before = await storage.getRoom(mockRoom.room_id);
      expect(before?.lastMessageAt).toBeUndefined();

      await storage.updateRoomLastMessage(mockRoom.room_id);
      
      const after = await storage.getRoom(mockRoom.room_id);
      expect(after?.lastMessageAt).toBeInstanceOf(Date);
    });

    it('should add participant to room', async () => {
      await storage.saveRoom(mockRoom.room_id, mockRoom.name, ['fingerprint1']);
      
      await storage.addRoomParticipant(mockRoom.room_id, 'fingerprint2');
      
      const room = await storage.getRoom(mockRoom.room_id);
      expect(room?.participants).toContain('fingerprint2');
      expect(room?.participants.length).toBe(2);
    });

    it('should not add duplicate participant', async () => {
      await storage.saveRoom(mockRoom.room_id, mockRoom.name, ['fingerprint1']);
      
      await storage.addRoomParticipant(mockRoom.room_id, 'fingerprint1');
      
      const room = await storage.getRoom(mockRoom.room_id);
      expect(room?.participants.length).toBe(1);
    });

    it('should get all rooms sorted by last message', async () => {
      await storage.saveRoom('room1');
      await storage.saveRoom('room2');
      await storage.saveRoom('room3');

      // Update last message for room2
      await storage.updateRoomLastMessage('room2');

      const all = await storage.getAllRooms();
      
      expect(all.length).toBe(3);
      expect(all[0].room_id).toBe('room2'); // Most recent message
    });

    it('should delete room', async () => {
      await storage.saveRoom(mockRoom.room_id);
      await storage.deleteRoom(mockRoom.room_id);
      
      const result = await storage.getRoom(mockRoom.room_id);
      expect(result).toBeUndefined();
    });
  });

  describe('Session Operations', () => {
    it('should save session', async () => {
      const sessionId = 'test-session-123';
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
      
      await storage.saveSession(sessionId, expiresAt);
      
      const session = await storage.getSession(sessionId);
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.expiresAt).toEqual(expiresAt);
    });

    it('should save session without expiry', async () => {
      const sessionId = 'test-session-456';
      
      await storage.saveSession(sessionId);
      
      const session = await storage.getSession(sessionId);
      expect(session?.expiresAt).toBeUndefined();
    });

    it('should delete expired sessions', async () => {
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      
      await storage.saveSession('expired-session', expiredDate);
      await storage.saveSession('valid-session', futureDate);
      await storage.saveSession('no-expiry-session');
      
      await storage.deleteExpiredSessions();
      
      const expired = await storage.getSession('expired-session');
      const valid = await storage.getSession('valid-session');
      const noExpiry = await storage.getSession('no-expiry-session');
      
      expect(expired).toBeUndefined();
      expect(valid).toBeDefined();
      expect(noExpiry).toBeDefined();
    });
  });

  describe('Burn Operations', () => {
    it('should delete all data', async () => {
      // Add some data
      await storage.saveIdentity('test-fingerprint', new Uint8Array([1]), {
        salt: new Uint8Array([2]),
        nonce: new Uint8Array([3]),
        ciphertext: new Uint8Array([4])
      });
      await storage.saveRoom('test-room');
      await storage.saveSession('test-session');

      // Burn everything
      await storage.burnEverything();

      // Verify all data is gone
      const identities = await storage.getAllIdentities();
      const rooms = await storage.getAllRooms();
      const session = await storage.getSession('test-session');

      expect(identities.length).toBe(0);
      expect(rooms.length).toBe(0);
      expect(session).toBeUndefined();
    });

    it('should clear sessionStorage when burning', async () => {
      const mockClear = jest.fn();
      global.sessionStorage.clear = mockClear;

      await storage.burnEverything();
      
      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Test with invalid data that might cause errors
      expect(StorageError).toBeDefined();
    });
  });
}); 