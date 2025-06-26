import { createClient, SupabaseClient, RealtimeChannel, Session } from '@supabase/supabase-js';
import { EncryptedMessage } from './types';

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabase) {
    return supabase;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  
  return supabase;
}

// Track active subscriptions
const activeChannels: Map<string, RealtimeChannel> = new Map();

/**
 * Sign in anonymously
 * Creates a new ephemeral session without any identifying information
 */
export async function signInAnonymously() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    throw error;
  }
}

/**
 * Sign out and clear session
 */
export async function signOut() {
  try {
    // Unsubscribe from all channels
    for (const [, channel] of activeChannels) {
      channel.unsubscribe();
    }
    activeChannels.clear();

    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Sign out failed:', error);
    throw error;
  }
}

/**
 * Get current session
 */
export async function getSession() {
  try {
    const client = getSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Get session failed:', error);
    return null;
  }
}

/**
 * Insert encrypted message
 */
export async function insertMessage(
  roomId: string,
  senderFingerprint: string,
  ciphertext: Uint8Array,
  header: Uint8Array
): Promise<EncryptedMessage | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .insert([
        {
          room_id: roomId,
          sender_fingerprint: senderFingerprint,
          ciphertext: Array.from(ciphertext), // Convert Uint8Array to number[] for JSON
          header: Array.from(header),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Convert back to Uint8Array
    return {
      ...data,
      ciphertext: new Uint8Array(data.ciphertext),
      header: new Uint8Array(data.header),
    };
  } catch (error) {
    console.error('Insert message failed:', error);
    return null;
  }
}

/**
 * Fetch messages for a room
 */
export async function fetchMessages(
  roomId: string,
  limit: number = 50
): Promise<EncryptedMessage[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    // Convert ciphertext and header back to Uint8Array
    return (data || []).map(msg => ({
      ...msg,
      ciphertext: new Uint8Array(msg.ciphertext),
      header: new Uint8Array(msg.header),
    }));
  } catch (error) {
    console.error('Fetch messages failed:', error);
    return [];
  }
}

/**
 * Subscribe to real-time messages for a room
 */
export function subscribeToRoom(
  roomId: string,
  onMessage: (message: EncryptedMessage) => void
): () => void {
  const client = getSupabaseClient();
  // Unsubscribe from existing channel if any
  const existingChannel = activeChannels.get(roomId);
  if (existingChannel) {
    existingChannel.unsubscribe();
  }

  const channel = client
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const message = payload.new as Record<string, unknown>;
        // Convert arrays back to Uint8Array
        onMessage({
          ...message,
          ciphertext: new Uint8Array(message.ciphertext as number[]),
          header: new Uint8Array(message.header as number[]),
        } as EncryptedMessage);
      }
    )
    .subscribe();

  activeChannels.set(roomId, channel);

  // Return unsubscribe function
  return () => {
    channel.unsubscribe();
    activeChannels.delete(roomId);
  };
}

/**
 * Subscribe to typing indicators (optional feature)
 * Uses Presence for real-time typing status without persistence
 */
export function subscribeToTyping(
  roomId: string,
  fingerprint: string,
  onTypingUpdate: (typingUsers: string[]) => void
): {
  setTyping: (isTyping: boolean) => void;
  unsubscribe: () => void;
} {
  const client = getSupabaseClient();
  const channel = client.channel(`typing:${roomId}`);
  
  // Track typing status
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const typingUsers = Object.keys(state)
        .filter(key => {
          const presence = state[key][0] as Record<string, unknown>;
          return presence?.typing;
        })
        .map(key => {
          const presence = state[key][0] as Record<string, unknown>;
          return presence?.fingerprint as string;
        })
        .filter(fp => fp !== fingerprint); // Exclude self
      onTypingUpdate(typingUsers);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ fingerprint, typing: false });
      }
    });

  return {
    setTyping: async (isTyping: boolean) => {
      await channel.track({ fingerprint, typing: isTyping });
    },
    unsubscribe: () => {
      channel.unsubscribe();
    },
  };
}

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Get connection status
 */
export function getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
  if (!supabase) return 'disconnected';
  const channels = supabase.getChannels();
  if (channels.length === 0) return 'disconnected';
  
  const states = channels.map(c => c.state);
  if (states.some(s => s === 'joined')) return 'connected';
  if (states.some(s => s === 'joining')) return 'connecting';
  return 'disconnected';
}

export async function authenticateAnonymously(): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.auth.signInAnonymously();
    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  } catch (error) {
    console.error("Anonymous authentication failed:", error);
    throw error;
  }
}

export async function subscribeToMessages(
  roomId: string,
  onMessage: (message: unknown) => void
): Promise<() => void> {
  const client = getSupabaseClient();
  const subscription = client
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload: unknown) => {
        onMessage(payload);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

export async function sendEncryptedMessage(
  roomId: string,
  senderFingerprint: string,
  ciphertext: Uint8Array,
  header: Uint8Array
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("messages").insert({
    room_id: roomId,
    sender_fingerprint: senderFingerprint,
    ciphertext: ciphertext,
    header: header,
  });

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

/**
 * A wrapper for onAuthStateChange to support lazy initialization.
 */
export function onAuthChange(
  callback: (event: string, session: Session | null) => void
) {
  const client = getSupabaseClient();
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback);

  return subscription;
} 