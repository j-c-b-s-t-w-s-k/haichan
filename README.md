# haichan

**proof-of-work mediated social interaction**

An imageboard where computational work replaces cheap abundance. Every post, every thread, every action is mediated by cryptographic proof-of-work. No infinite feeds. No disposable content. No fake identities.

## thesis

haichan tests whether an online community can be made healthier and more interesting by replacing cheap abundance with cryptographically enforced scarcity. Read the full thesis: [/thesis](src/pages/ThesisPage.tsx) or visit the live site.

### core mechanisms

1. **caps the social graph** - Hard limit of 256 users per tranche, invite-gated
2. **prices expression in computation** - All posting gated by proof-of-work mining
3. **compresses the medium** - Dithered images, TUI-like interface
4. **responds to work, not vibes** - Content ranks by accumulated PoW
5. **treats posts as programmable primitives** - Each post has cryptographic pedigree

## requirements

- Node.js 18+
- Blink SDK (included)
- Modern browser with WebAssembly support

## setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## proof-of-work

All content requires mining SHA-256 hashes with `21e8` prefix:

- `21e8` = 15 points (base)
- `21e80` = 60 points (+1 trailing zero)
- `21e800` = 240 points (+2 trailing zeros)
- `21e8000` = 960 points (+3 trailing zeros)

Formula: `points = 15 × 4^(trailing_zeros)`

Special cases:
- **Diamond hashes**: Leading zeros (rare, bonus multipliers)
- **Runoff PoW**: Excess work beyond target is preserved

## authentication

Dual authentication system:

1. **Username/Password** - Standard account access
2. **Bitcoin secp256k1** - Cryptographic identity verification

Each user identity is tied to a Bitcoin address derived from their keypair. This provides:
- Cryptographic proof of identity
- Portable credentials
- Optional passwordless authentication

Private keys are **never** transmitted to servers - all verification happens client-side.

## architecture

- **Frontend**: Vite + React + TypeScript
- **Backend**: Blink Edge Functions (Deno)
- **Database**: Blink DB (SQLite with PostgREST API)
- **Mining**: Web Workers with SHA-256 hashing
- **Auth**: Blink Auth + Bitcoin cryptography

## features

- Invite-gated registration (256 user cap per tranche)
- Proof-of-work mining for all posts
- Bitcoin address-based identity
- Threaded discussions with PoW ranking
- Personal blogs with custom themes
- Realtime chat (also PoW-gated)
- Image library with dithering
- Diamond hash achievements
- Global leaderboard by total PoW

## philosophical foundation

**Scarcity as signal.** In a world of infinite information, scarcity becomes the only honest signal of value. Proof-of-work enforces scarcity through thermodynamics - you cannot fake the cost of hashing.

**Skin in the game.** Every participant has literally invested energy in the system. This creates alignment and accountability.

**Transparent mechanisms.** The rules are cryptographic, not algorithmic. No hidden recommendation engines, no engagement metrics.

**The medium as message.** By stripping away the glossy interface, haichan forces the community to confront the underlying structure.

## license

MIT (see LICENSE file)

## links

- Live site: https://haichan-pow-imageboard-7e3gh26u.sites.blink.new
- Documentation: [/docs](/docs)
- Thesis: [/thesis](/src/pages/ThesisPage.tsx)