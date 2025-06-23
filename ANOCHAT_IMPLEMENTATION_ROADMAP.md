# AnoChat Implementation Roadmap

## Zero-Knowledge End-to-End Encrypted Anonymous Chat Application

This roadmap serves as the comprehensive guide for implementing AnoChat - an anonymous, E2EE chat application built with Next.js, Tailwind CSS, and deployed on Vercel/Supabase.

## Core Principles

1. **Zero-Knowledge Architecture**: All encryption/decryption happens client-side only
2. **Perfect Forward Secrecy**: Signal Double Ratchet protocol implementation
3. **Anonymous by Design**: No persistent identities, ephemeral session IDs
4. **Metadata Protection**: IP masking via Cloudflare, minimal server logging

## Phase 1: Project Setup & Dependencies

### 1.1 Initialize Next.js Project

```bash
npx create-next-app@latest anochat
cd anochat
```

- Choose: TypeScript? Yes
- Choose: ESLint? Yes
- Choose: Tailwind CSS? Yes
- Choose: `src/` directory? No
- Choose: App Router? Yes
- Choose: Import alias? No

### 1.2 Install Crypto & Core Dependencies

```bash
npm install libsodium-wrappers libsignal-protocol @supabase/supabase-js uuid
npm install --save-dev @types/libsodium-wrappers @types/uuid
```

### 1.3 Additional Dependencies for IndexedDB & QR

```bash
npm install dexie qrcode react-qr-code
npm install --save-dev @types/qrcode
```

## Phase 2: Supabase Configuration

### 2.1 Project Setup

1. Create new Supabase project at https://app.supabase.com
2. Navigate to Authentication → Settings
3. Enable ONLY anonymous sign-in (disable all email/social auth)

### 2.2 Database Schema

Execute in SQL Editor:

```sql
-- Messages table for encrypted content
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  sender_fingerprint text NOT NULL,
  ciphertext bytea NOT NULL,
  header bytea NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient room queries
CREATE INDEX idx_messages_room_id ON messages (room_id);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anonymous users to insert/select
CREATE POLICY "Allow anonymous message operations" ON messages
  FOR ALL
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');
```

### 2.3 Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Phase 3: Crypto Module Implementation

### 3.1 Core Crypto Library (`lib/crypto.ts`)

- Initialize sodium library
- Generate X25519 identity keypairs
- Encrypt/decrypt private keys with passphrase
- Generate ephemeral session IDs
- Key fingerprint generation

### 3.2 Storage Module (`lib/storage.ts`)

- IndexedDB wrapper using Dexie
- Encrypted key storage
- Session management
- Room history (optional)

## Phase 4: Signal Protocol Integration

### 4.1 Protocol Wrapper (`lib/signal-protocol.ts`)

- Initialize Signal sessions
- Handle pre-key bundles
- Encrypt/decrypt messages
- Manage Double Ratchet state

### 4.2 Key Exchange (`lib/key-exchange.ts`)

- Generate pre-key bundles
- QR code generation for key exchange
- Parse and validate key bundles

## Phase 5: React Components

### 5.1 Key Management Component (`components/KeyManager.tsx`)

- First-time key generation UI
- Passphrase input with strength indicator
- Key recovery from IndexedDB
- Export/import key backup

### 5.2 Chat Interface (`components/ChatInterface.tsx`)

- Message input with encryption indicator
- Real-time message display
- Typing indicators (encrypted)
- Message status (sent/delivered)

### 5.3 Room Management (`components/RoomManager.tsx`)

- Create new room with unique ID
- Join room via ID or QR code
- Display room participants (fingerprints only)
- Leave/delete room

### 5.4 Identity Display (`components/Identity.tsx`)

- Show ephemeral session ID
- Display key fingerprint
- QR code for key sharing
- Burn notice button

## Phase 6: Real-time Messaging

### 6.1 Supabase Client (`lib/supabase.ts`)

- Initialize Supabase client
- Anonymous authentication
- Real-time subscriptions
- Message insertion/retrieval

### 6.2 Message Handler (`lib/message-handler.ts`)

- Queue outgoing messages
- Handle incoming messages
- Manage message ordering
- Retry failed sends

## Phase 7: Anonymity Features

### 7.1 Session Management

- Ephemeral IDs rotate on page reload
- No persistent cookies for identity
- Auto-burn after inactivity timeout
- Session rotation warnings

### 7.2 Metadata Protection

- Minimal database footprint
- No IP logging
- Randomized message timing
- Padded message sizes

## Phase 8: UI/UX Implementation

### 8.1 Tailwind Components

- Dark mode by default
- Minimalist anonymous aesthetic
- Loading states
- Error boundaries

### 8.2 Responsive Design

- Mobile-first approach
- PWA capabilities
- Offline message queue
- Touch-friendly interfaces

## Phase 9: Security Hardening

### 9.1 Content Security Policy

```typescript
// next.config.js
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' *.supabase.co wss://*.supabase.co; img-src 'self' data: blob:; font-src 'self';",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
];
```

### 9.2 Burn Notice Implementation

- Clear all IndexedDB data
- Wipe sessionStorage
- Reset all crypto states
- Overwrite memory
- Redirect to fresh session

## Phase 10: Deployment

### 10.1 Pre-deployment Checklist

- Remove all console.logs
- Disable source maps
- Minify and obfuscate
- Security audit

### 10.2 Vercel Setup

1. Push to GitHub repository
2. Import to Vercel
3. Set environment variables
4. Configure custom domain

### 10.3 Cloudflare Configuration

1. Add custom domain
2. Enable proxy (orange cloud)
3. SSL/TLS: Full (strict)
4. Enable HSTS
5. Configure firewall rules

## Implementation Order

1. Project initialization
2. Basic crypto setup
3. Supabase integration
4. Simple message send/receive
5. Signal protocol integration
6. Full UI implementation
7. Security hardening
8. Deployment

## Testing Checklist

- [ ] Crypto functions work correctly
- [ ] Messages encrypt/decrypt properly
- [ ] Real-time updates function
- [ ] Anonymity preserved
- [ ] No data leaks
- [ ] Burn notice works
- [ ] Mobile responsive
- [ ] Performance acceptable

## Key Files Structure

```
anochat/
├── app/
│   ├── page.tsx          # Main chat interface
│   ├── layout.tsx        # Root layout with providers
│   ├── globals.css       # Tailwind styles
│   └── api/              # API routes (if needed)
├── components/
│   ├── ChatInterface.tsx # Main chat component
│   ├── KeyManager.tsx    # Key generation/management
│   ├── RoomManager.tsx   # Room creation/joining
│   ├── Identity.tsx      # Anonymous identity display
│   ├── MessageList.tsx   # Message display
│   ├── MessageInput.tsx  # Message composition
│   └── BurnNotice.tsx    # Data destruction UI
├── lib/
│   ├── crypto.ts         # Core crypto operations
│   ├── signal-protocol.ts # Signal wrapper
│   ├── key-exchange.ts   # Key exchange logic
│   ├── supabase.ts       # Supabase client
│   ├── storage.ts        # IndexedDB operations
│   ├── message-handler.ts # Message processing
│   └── types.ts          # TypeScript types
├── hooks/
│   ├── useAuth.ts        # Anonymous auth hook
│   ├── useMessages.ts    # Message subscription
│   └── useCrypto.ts      # Crypto operations hook
├── .env.local            # Environment variables
├── next.config.js        # Next.js config with security
├── tailwind.config.js    # Tailwind configuration
└── package.json          # Dependencies
```
