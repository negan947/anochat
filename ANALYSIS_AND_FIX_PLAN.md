# AnoChat: Code Analysis and Remediation Plan

## 1. Introduction

This document outlines the findings from a thorough code review of the AnoChat application's core components. The analysis revealed several critical issues that compromise the application's functionality, security, and stability.

The following plan provides a step-by-step guide to address these issues, prioritized by severity. It is crucial to follow this plan to make the application functional, secure, and robust.

---

## 2. Executive Summary of Findings

| ID    | Severity     | Title                                   | Component(s) Affected                               |
| ----- | ------------ | --------------------------------------- | --------------------------------------------------- |
| **1** | **BLOCKER**  | Chat Interface is Not Functional        | `ChatInterface.tsx`, `useMessages.ts`               |
| **2** | **CRITICAL** | Insecure Signal Protocol Implementation | `lib/signal-protocol.ts`                            |
| **3** | **CRITICAL** | Broken Room Invitation Logic            | `lib/key-exchange.ts`, `components/RoomManager.tsx` |
| **4** | **HIGH**     | Weak Passphrase Key Derivation          | `lib/crypto.ts`                                     |
| **5** | **MEDIUM**   | Duplicate Room Entries on Join          | `components/RoomManager.tsx`, `lib/storage.ts`      |
| **6** | **MEDIUM**   | Stale "Last Message" Timestamps         | `lib/storage.ts`, `ChatInterface.tsx`               |
| **7** | **LOW**      | Artificial UI Loading Delay             | `app/page.tsx`                                      |

---

## 3. Detailed Remediation Plan

### Issue #1: [BLOCKER] Chat Interface is Not Functional

**The core chat functionality is currently a mock and does not send or receive real messages.**

- **Problem:**

  - `components/ChatInterface.tsx` uses `setTimeout` to simulate a connection and does not subscribe to Supabase for real-time updates.
  - The `handleSendMessage` function does not encrypt messages using the Signal protocol. It encodes the plaintext message with `btoa` and adds it directly to the local state for an optimistic UI update, but the message is never actually sent.
  - There is no logic to receive, decrypt, and display messages from other users in the room.
  - The `useMessages` hook, which likely contains the intended logic, is not being used.

- **Step-by-Step Solution:**
  1.  **Remove Mock Logic:** Delete the `useEffect` that simulates a connection and the mock implementation inside `handleSendMessage` in `ChatInterface.tsx`.
  2.  **Integrate `useMessages` Hook:** Import and utilize the `useMessages` hook within `ChatInterface.tsx`. This hook should manage the message state, connection status, and sending/receiving logic.
  3.  **Implement Real-Time Subscription:** Inside the `useMessages` hook, establish a real-time subscription to the Supabase `messages` table, filtered by the `roomId`.
  4.  **Implement Message Sending:**
      - In the `sendMessage` function (from `useMessages`), call `signal-protocol.encryptMessage` to encrypt the plaintext.
      - Insert the resulting ciphertext object into the Supabase `messages` table.
  5.  **Implement Message Receiving:**
      - When a new message arrives from the Supabase subscription, call `signal-protocol.decryptMessage` to decrypt the ciphertext.
      - Add the decrypted message to the component's state for rendering, handling potential decryption errors gracefully.
  6.  **Update Connection Status:** The connection status indicator should reflect the actual state of the Supabase real-time connection.

### Issue #2: [CRITICAL] Insecure Signal Protocol Implementation

**The Signal Protocol implementation in `lib/signal-protocol.ts` is incomplete and insecure, invalidating the application's E2EE claims.**

- **Problem:**

  - **Placeholder Private Key:** The `SimpleSignalProtocolStore.getIdentityKeyPair` function returns a placeholder `new Uint8Array(32)` instead of the user's actual private key. This completely breaks the chain of trust for all cryptographic operations.
  - **Missing Double Ratchet:** The implementation uses a static session key derived from the initial X3DH handshake. It lacks the key-ratcheting mechanism, which means it provides **no forward secrecy or post-compromise security**.
  - **Fragile Key Loading:** The decryption logic non-deterministically loads the "most recently generated" pre-key from storage instead of using a specific key ID from the message, which is unreliable.
  - **Reimplementation Risk:** Manually reimplementing a complex cryptographic protocol like Signal is extremely prone to subtle, dangerous errors.

- **Step-by-Step Solution:**
  1.  **[Immediate Fix] Load the Real Private Key:**
      - The `getIdentityKeyPair` function in `lib/signal-protocol.ts` **must** be modified.
      - It needs to access the currently loaded identity's private key. This will likely require passing the `currentIdentity` from the main app state down into the signal context or retrieving it from a secure in-memory store. **This is the single most important fix.**
  2.  **[Long-Term Strategy] Replace the Custom Implementation:**
      - **Recommendation:** The entire `lib/signal-protocol.ts` should be deprecated and replaced with the official, well-vetted `libsignal-protocol-javascript` library.
      - **Migration:** This will involve rewriting the key exchange and message handling logic to conform to the official library's API, but it is the only way to provide genuine Signal Protocol security.
      - For now, acknowledge in the code with `// TODO:` comments that the current implementation lacks forward secrecy.

### Issue #3: [CRITICAL] Broken Room Invitation Logic

**The room invitation mechanism is broken due to incorrect `roomId` reconstruction, making it impossible for users to join the same room.**

- **Problem:**

  - In `lib/key-exchange.ts`, the `serializeKeyExchange` function shortens the `roomId` to 8 characters to save space.
  - The `deserializeKeyExchange` function then attempts to reconstruct it with a fake template: `` `${serialized.r.slice(0,8)}-xxxx-xxxx-xxxx-${serialized.r.slice(0,8)}` ``.
  - This generates an invalid UUID that does not match the original `roomId`, so the joining user will be in a different room from the creator.

- **Step-by-Step Solution:**
  1.  **Send Full Room ID:** In `lib/key-exchange.ts`, modify `serializeKeyExchange` to include the full, unmodified `roomId` in the payload. Do not shorten it.
  2.  **Remove Reconstruction Logic:** Remove the faulty reconstruction logic from `deserializeKeyExchange`. It should use the `roomId` from the payload directly.
  3.  **Verify QR Code Size:** Test if including the full UUID in the QR code data exceeds the practical size limit. If it does, the invite mechanism needs a redesign (e.g., using a short code that resolves to the full data on a server, though this would compromise the zero-knowledge principle). For now, assume it will fit.

### Issue #4: [HIGH] Weak Passphrase Key Derivation

**User passphrases are not being hashed with the industry-standard algorithm, making stored private keys more vulnerable to offline brute-force attacks.**

- **Problem:**

  - `lib/crypto.ts` uses `sodium.crypto_generichash` (BLAKE2b) to derive an encryption key from a user's passphrase.
  - The correct, recommended function for this is `sodium.crypto_pwhash` (Argon2id), which is specifically designed to be slow and memory-hard to resist brute-force attacks.

- **Step-by-Step Solution:**
  1.  **Update `encryptPrivateKey`:**
      - In `lib/crypto.ts`, change the implementation of `encryptPrivateKey` to use `sodium.crypto_pwhash` to derive the key.
      - You will need to select appropriate `opslimit` and `memlimit` parameters (e.g., `crypto_pwhash_OPSLIMIT_INTERACTIVE` and `crypto_pwhash_MEMLIMIT_INTERACTIVE`). The salt is still required.
  2.  **Update `decryptPrivateKey`:**
      - Update the decryption function to use the same `crypto_pwhash` function and parameters to re-derive the key for decryption.
  3.  **Consider Migration:** If there were any real users, this change would require a migration path where old identities are decrypted with the old method and re-encrypted with the new one upon login. For this pre-functional app, a clean switch is sufficient.

### Issue #5: [MEDIUM] Duplicate Room Entries on Join

- **Problem:** When a user joins a room via an invite, the code in `RoomManager.tsx` doesn't check if they are already a member of that room. This can lead to duplicate room entries in the UI if a user joins the same room multiple times.
- **Solution:**
  1.  In `handleJoinRoom` in `components/RoomManager.tsx`, before calling `storage.saveRoom`, first call `storage.getRoom(invite.roomId)`.
  2.  If the room already exists, do not save it again. Simply call `onRoomJoined` to navigate to the chat.

### Issue #6: [MEDIUM] Stale "Last Message" Timestamps

- **Problem:** The database schema and UI are designed to sort rooms by recent activity (`lastMessageAt`), but this timestamp is never updated.
- **Solution:**
  1.  Once `ChatInterface.tsx` is functional (Issue #1), ensure the `storage.updateRoomLastMessage(roomId)` function is called whenever a message is successfully sent or a new message is received and decrypted.

### Issue #7: [LOW] Artificial UI Loading Delay

- **Problem:** `app/page.tsx` has a hardcoded `setTimeout` of 1.5 seconds during the initial identity check, which unnecessarily slows down the app startup for all users.
- **Solution:**
  1.  In the main `useEffect` in `app/page.tsx`, remove the `await new Promise(resolve => setTimeout(resolve, 1500));` line.
  2.  The loading spinner should now display only for the actual duration of the `storage.getAllIdentities()` check.
