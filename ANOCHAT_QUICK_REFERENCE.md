# AnoChat Quick Reference

## 🏗️ Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS (dark mode default)
- **Crypto**: libsodium-wrappers + libsignal-protocol
- **Storage**: IndexedDB (Dexie) + sessionStorage
- **Backend**: Supabase (Postgres + Realtime)
- **Deployment**: Vercel behind Cloudflare
- **Auth**: Anonymous only (no emails/passwords)

## 🔐 Core Security Principles

### Zero-Knowledge Rules

```typescript
// ❌ NEVER on server:
const plaintext = decrypt(ciphertext);

// ✅ ALWAYS on client:
const plaintext = await decryptInBrowser(ciphertext);
```

### Database Schema

```sql
messages (
  id: uuid PRIMARY KEY,
  room_id: text NOT NULL,           -- ephemeral room ID
  sender_fingerprint: text NOT NULL, -- public key fingerprint
  ciphertext: bytea NOT NULL,       -- encrypted message blob
  header: bytea NOT NULL,           -- Signal protocol header
  created_at: timestamptz DEFAULT now()
)
```

## 🔑 Key Management

### Storage Locations

- **Private Keys**: IndexedDB (encrypted with passphrase)
- **Session IDs**: sessionStorage (ephemeral)
- **Room IDs**: URL params or sessionStorage
- **Public Keys**: Can be in localStorage (not sensitive)

### Key Generation Flow

```typescript
1. await sodium.ready
2. generateIdentityKey() → X25519 keypair
3. Derive encryption key from passphrase
4. Encrypt private key with derived key
5. Store in IndexedDB via Dexie
```

## 💬 Message Flow

### Sending

1. Get plaintext from input
2. Encrypt with Signal SessionCipher
3. Insert to Supabase (room_id, fingerprint, ciphertext, header)
4. Clear input

### Receiving

1. Subscribe to Supabase realtime for room_id
2. Receive encrypted message
3. Decrypt with Signal SessionCipher
4. Display in UI

## 🎭 Anonymity Checklist

- [ ] No email/username/phone registration
- [ ] UUID v4 for all identifiers
- [ ] Session IDs in sessionStorage only
- [ ] Cloudflare proxy enabled
- [ ] No server-side logging
- [ ] Burn notice implemented
- [ ] No analytics/tracking
- [ ] CSP headers configured

## 📁 Project Structure

```
anochat/
├── app/              # Next.js app directory
├── components/       # React components
├── lib/              # Core logic
├── hooks/            # Custom React hooks
├── types/            # TypeScript definitions
└── public/           # Static assets
```

## 🚀 Quick Commands

### Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript check
```

### Testing Crypto

```typescript
// Quick test in browser console
await initCrypto();
const keys = generateIdentityKey();
console.log("Public:", keys.publicKey);
console.log("Private:", keys.privateKey);
```

## ⚠️ Common Pitfalls

### Security

- ❌ Storing keys unencrypted
- ❌ Using Math.random() for crypto
- ❌ Sending private keys to server
- ❌ Logging message content
- ❌ Using predictable IDs

### Implementation

- ❌ Forgetting to await sodium.ready
- ❌ Not handling IndexedDB errors
- ❌ Missing CORS headers
- ❌ Exposing source maps in prod
- ❌ Using localStorage for sensitive data

## 🔧 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Never add:
# - Private keys
# - Server secrets
# - User data
```

## 📊 Performance Tips

1. **Lazy load crypto libraries**

   ```typescript
   const sodium = await import("libsodium-wrappers");
   ```

2. **Batch message decryption**

   ```typescript
   const decrypted = await Promise.all(messages.map((m) => decrypt(m)));
   ```

3. **Use React.memo for message components**

4. **Implement virtual scrolling for long chats**

## 🧪 Quick Validation

### Check E2EE Working

1. Open browser DevTools
2. Network tab → WS frames
3. Verify all messages are base64 gibberish
4. Check Supabase dashboard - should see only ciphertext

### Check Anonymity

1. Clear all browser data
2. Reload page
3. Verify new session ID generated
4. Check no cookies set
5. Verify no user tracking

## 🔥 Burn Notice Checklist

```typescript
async function burnEverything() {
  // 1. Clear IndexedDB
  await Dexie.delete("AnoChat");

  // 2. Clear sessionStorage
  sessionStorage.clear();

  // 3. Clear any in-memory keys
  cryptoState = null;

  // 4. Reload to fresh state
  window.location.reload();
}
```

## 📝 Remember

- "If the server can read it, it's not E2EE"
- "If it persists after closing, it's not anonymous"
- "If you didn't generate it randomly, it's not secure"
- "If you logged it, they can subpoena it"
