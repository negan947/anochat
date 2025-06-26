/**
 * In-memory store for the currently active identity.
 * This is a simple solution to make the active identity's private key
 * available to the Signal Protocol implementation without major refactoring.
 */

import { IdentityKey } from './types';

let activeIdentity: IdentityKey | null = null;

export const identityStore = {
  /**
   * Set the active identity for the current session.
   * @param identity The fully loaded identity, including the private key.
   */
  setActiveIdentity(identity: IdentityKey | null): void {
    activeIdentity = identity;
  },

  /**
   * Get the currently active identity.
   * @returns The active identity, or null if none is set.
   */
  getActiveIdentity(): IdentityKey | null {
    return activeIdentity;
  },
}; 