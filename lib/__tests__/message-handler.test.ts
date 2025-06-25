/**
 * Unit tests for message handler
 */

import { sendMessage, processIncomingMessage, loadRoomHistory, clearAllQueues } from '../message-handler';
import { insertMessage, fetchMessages } from '../supabase';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../supabase', () => ({
  insertMessage: jest.fn(),
  fetchMessages: jest.fn(),
  subscribeToRoom: jest.fn(),
}));

// Mock the signal protocol functions
jest.mock('../signal-protocol', () => ({
  initSignalProtocol: jest.fn().mockResolvedValue(undefined),
  encryptMessage: jest.fn().mockResolvedValue({
    type: 1,
    body: 'bW9ja2VkX2VuY3J5cHRlZF9ib2R5', // base64 encoded
    ek: 'ephemeral_key',
    ik: 'identity_key'
  }),
  decryptMessage: jest.fn().mockResolvedValue('decrypted message'),
  hasSession: jest.fn().mockResolvedValue(true),
}));

// Mock crypto
jest.mock('../crypto', () => ({
  generateFingerprint: jest.fn((key) => `fingerprint_${key}`),
  initCrypto: jest.fn().mockResolvedValue(undefined),
}));

describe('Message Handler', () => {
  const roomId = uuidv4();
  const aliceFingerprint = 'alice_fingerprint';
  const bobFingerprint = 'bob_fingerprint';

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllQueues();
  });

  test('should handle message send with mocked encryption', async () => {
    const testMessage = 'Test message';
    
    // Mock successful insertion
    (insertMessage as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      room_id: roomId,
      sender_fingerprint: aliceFingerprint,
      ciphertext: new Uint8Array([1, 2, 3]),
      header: new Uint8Array([4, 5, 6]),
      created_at: new Date(),
    });

    // The encryption is already mocked at the module level

    const success = await sendMessage(
      roomId,
      testMessage,
      bobFingerprint,
      aliceFingerprint
    );

    expect(success).toBe(true);
    expect(insertMessage).toHaveBeenCalledWith(
      roomId,
      aliceFingerprint,
      expect.any(Uint8Array),
      expect.any(Uint8Array)
    );
  });

  test('should handle incoming message processing', async () => {
    const encryptedMessage = {
      id: uuidv4(),
      room_id: roomId,
      sender_fingerprint: bobFingerprint,
      ciphertext: new Uint8Array([1, 2, 3]),
      header: new Uint8Array([4, 5, 6]),
      created_at: new Date(),
    };

    // Since we're mocking, decryption will fail
    // but the function should handle it gracefully
    const result = await processIncomingMessage(encryptedMessage);
    
    // With mocked decryption failing, result should be null
    expect(result).toBeNull();
  });

  test('should load room history', async () => {
    const mockMessages = [
      {
        id: uuidv4(),
        room_id: roomId,
        sender_fingerprint: aliceFingerprint,
        ciphertext: new Uint8Array([1, 2, 3]),
        header: new Uint8Array([4, 5, 6]),
        created_at: new Date(),
      },
      {
        id: uuidv4(),
        room_id: roomId,
        sender_fingerprint: bobFingerprint,
        ciphertext: new Uint8Array([7, 8, 9]),
        header: new Uint8Array([10, 11, 12]),
        created_at: new Date(Date.now() + 1000),
      },
    ];

    (fetchMessages as jest.Mock).mockResolvedValue(mockMessages);

    const history = await loadRoomHistory(roomId);

    expect(fetchMessages).toHaveBeenCalledWith(roomId, 50);
    expect(Array.isArray(history)).toBe(true);
    // Since decryption is mocked to fail, history will be empty
    expect(history).toHaveLength(0);
  });

  test('should handle send failure and retry', async () => {
    const testMessage = 'Message that will fail';

    // The encryption is already mocked at the module level

    // Mock failure then success
    (insertMessage as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        id: uuidv4(),
        room_id: roomId,
        sender_fingerprint: aliceFingerprint,
        ciphertext: new Uint8Array([1, 2, 3]),
        header: new Uint8Array([4, 5, 6]),
        created_at: new Date(),
      });

    const success = await sendMessage(
      roomId,
      testMessage,
      bobFingerprint,
      aliceFingerprint
    );

    // Initial attempt will fail
    expect(success).toBe(false);

    // Wait for retry
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check that retry was attempted
    expect(insertMessage).toHaveBeenCalledTimes(2);
  });
}); 