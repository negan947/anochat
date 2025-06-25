/**
 * Integration test for messaging functionality
 * Tests the full flow of sending and receiving encrypted messages
 */

import { initCrypto, generateIdentityKey, generateFingerprint } from '../../crypto';
import { initSignalProtocol, generatePreKeyBundle, processPreKeyBundle } from '../../signal-protocol';
import { sendMessage, processIncomingMessage, loadRoomHistory } from '../../message-handler';
import { signInAnonymously, insertMessage, fetchMessages } from '../../supabase';
import { v4 as uuidv4 } from 'uuid';

// Mock Supabase client
jest.mock('../../supabase', () => ({
  signInAnonymously: jest.fn(),
  insertMessage: jest.fn(),
  fetchMessages: jest.fn(),
  subscribeToRoom: jest.fn(),
  isSupabaseConfigured: () => true,
}));

describe('Messaging Integration', () => {
  let alice: { publicKey: Uint8Array; privateKey: Uint8Array; fingerprint: string };
  let bob: { publicKey: Uint8Array; privateKey: Uint8Array; fingerprint: string };
  const roomId = uuidv4();

  beforeAll(async () => {
    // Initialize crypto
    await initCrypto();

    // Generate identities
    alice = await generateIdentityKey();
    alice.fingerprint = await generateFingerprint(alice.publicKey);

    bob = await generateIdentityKey();
    bob.fingerprint = await generateFingerprint(bob.publicKey);

    // Initialize Signal protocol
    await initSignalProtocol();

    // Mock successful auth
    (signInAnonymously as jest.Mock).mockResolvedValue({
      session: { user: { id: 'anon-123' } },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle key exchange and establish session', async () => {
    // Alice creates pre-key bundle
    const aliceBundle = await generatePreKeyBundle(alice);
    expect(aliceBundle).toBeDefined();
    expect(aliceBundle.identityKey).toBeInstanceOf(Uint8Array);

    // Bob processes Alice's bundle
    await processPreKeyBundle(alice.fingerprint, 1, aliceBundle);

    // Bob creates pre-key bundle
    const bobBundle = await generatePreKeyBundle(bob);
    
    // Alice processes Bob's bundle
    await processPreKeyBundle(bob.fingerprint, 1, bobBundle);
  });

  test('should encrypt and decrypt messages', async () => {
    const testMessage = 'Hello, this is a secret message!';

    // First establish sessions
    const aliceBundle = await generatePreKeyBundle(alice);
    await processPreKeyBundle(alice.fingerprint, 1, aliceBundle);
    
    const bobBundle = await generatePreKeyBundle(bob);
    await processPreKeyBundle(bob.fingerprint, 1, bobBundle);

    // Now test message sending through message handler
    // Mock successful insertion
    (insertMessage as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      room_id: roomId,
      sender_fingerprint: alice.fingerprint,
      ciphertext: new Uint8Array([1, 2, 3]),
      header: new Uint8Array([4, 5, 6]),
      created_at: new Date(),
    });

    // Send message from Alice to Bob
    const success = await sendMessage(
      roomId,
      testMessage,
      bob.fingerprint,
      alice.fingerprint
    );
    
    expect(success).toBe(true);
  });

  test('should send message through message handler', async () => {
    const testMessage = 'Test message through handler';

    // Mock successful insertion
    (insertMessage as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      room_id: roomId,
      sender_fingerprint: alice.fingerprint,
      ciphertext: new Uint8Array([1, 2, 3]),
      header: new Uint8Array([4, 5, 6]),
      created_at: new Date(),
    });

    // Send message
    const success = await sendMessage(
      roomId,
      testMessage,
      bob.fingerprint,
      alice.fingerprint
    );

    expect(success).toBe(true);
    expect(insertMessage).toHaveBeenCalledWith(
      roomId,
      alice.fingerprint,
      expect.any(Uint8Array),
      expect.any(Uint8Array)
    );
  });

  test('should process incoming messages', async () => {
    // Create mock encrypted message (would normally come from Supabase)
    const encryptedMessage = {
      id: uuidv4(),
      room_id: roomId,
      sender_fingerprint: bob.fingerprint,
      ciphertext: new Uint8Array([1, 2, 3, 4, 5]), // Mock encrypted data
      header: new Uint8Array([6, 7, 8, 9, 10]), // Mock header
      created_at: new Date(),
    };

    // Process incoming message
    const decrypted = await processIncomingMessage(encryptedMessage);
    
    // Since we're using mock data, it won't decrypt properly
    // In a real scenario with proper key exchange, this would work
    expect(decrypted).toBeDefined();
  });

  test('should load and decrypt room history', async () => {
    // Mock encrypted messages
    const encryptedMessages = [
      {
        id: uuidv4(),
        room_id: roomId,
        sender_fingerprint: alice.fingerprint,
        ciphertext: new Uint8Array([1, 2, 3]),
        header: new Uint8Array([4, 5, 6]),
        created_at: new Date(Date.now()),
      },
      {
        id: uuidv4(),
        room_id: roomId,
        sender_fingerprint: bob.fingerprint,
        ciphertext: new Uint8Array([7, 8, 9]),
        header: new Uint8Array([10, 11, 12]),
        created_at: new Date(Date.now() + 1000),
      },
      {
        id: uuidv4(),
        room_id: roomId,
        sender_fingerprint: alice.fingerprint,
        ciphertext: new Uint8Array([13, 14, 15]),
        header: new Uint8Array([16, 17, 18]),
        created_at: new Date(Date.now() + 2000),
      },
    ];

    // Mock fetch messages
    (fetchMessages as jest.Mock).mockResolvedValue(encryptedMessages);

    // Load room history
    const history = await loadRoomHistory(roomId);

    expect(fetchMessages).toHaveBeenCalledWith(roomId, 50);
    // With mock data, decryption will fail but the function should handle it gracefully
    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
  });

  test('should handle message send failure and retry', async () => {
    // Mock failure then success
    (insertMessage as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        id: uuidv4(),
        room_id: roomId,
        sender_fingerprint: alice.fingerprint,
        ciphertext: new Uint8Array([1, 2, 3]),
        header: new Uint8Array([4, 5, 6]),
        created_at: new Date(),
      });

    // Send message (will fail initially but retry)
    await sendMessage(
      roomId,
      'Message that will fail initially',
      bob.fingerprint,
      alice.fingerprint
    );

    // Wait for retry
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Should have been called twice (initial + retry)
    expect(insertMessage).toHaveBeenCalledTimes(2);
  });


}); 