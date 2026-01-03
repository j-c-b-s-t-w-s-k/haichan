# haichan thesis

**proof-of-work mediated social interaction**

## abstract

haichan tests the idea that an online community can be made healthier and more interesting by replacing cheap abundance (infinite posts, infinite users, zero-cost identity) with cryptographically enforced scarcity and computational friction. every meaningful action on the board is treated as a scarce, verifiable event rather than disposable "content."

## core mechanisms

### 1. caps the social graph

A hard ceiling on users (256-sized tranches, invite-gated) turns the board into a finite game. You are not shouting into a global feed; you are interacting inside a closed topology whose participants are known, trackable, and costly to fake. Every user is a scarce asset. Every connection is visible and meaningful. The boundaries of the community are explicit and enforced.

**Implementation:**
- Maximum 256 users per registration tranche
- Invite codes required for registration
- Invite codes tracked with usage limits
- Admin can generate new invite codes
- User count enforced at database level

### 2. prices expression in computation, not money

Posting is gated by proof-of-work and protocol-level friction. You can't spam your way to visibility; you have to literally burn cycles. Every post is a small cryptographic artifact with a verifiable cost history, not a free write to an endless log. The cost is denominated in electricity and time, not capital. This creates a market where attention is earned, not bought.

**Implementation:**
- SHA-256 mining with target prefix `21e8`
- Point system: 15 × 4^(trailing_zeros)
- All posts, threads, replies require valid PoW
- PoW validated server-side before submission
- User total PoW tracked and displayed
- Content ranked by accumulated PoW

### 3. compresses the medium to expose the structure

Images are aggressively compressed/dithered; the interface is TUI/ssh-like rather than glossy web. By constraining bandwidth and aesthetics, haichan foregrounds structure (who can post, at what cost, with what history) over UI spectacle. The medium itself becomes transparent. What remains is pure signal: the network topology, the proof-of-work ledger, the threads and conversations.

**Implementation:**
- Floyd-Steinberg dithering on all uploaded images
- Monospace fonts throughout
- Black and white color scheme
- Minimal graphics and animations
- Terminal-inspired UI components
- Focus on textual content and structure

### 4. lets the board respond to work, not vibes

The global state of the board (ordering, visibility, possible actions, maybe even "seasons" or modes) is designed to be a function of aggregate work performed by participants. The community doesn't just live on the substrate; it drives it. Posts rank by accumulated PoW. Threads bump based on collective contribution. The incentive structure is transparent and verifiable.

**Implementation:**
- Thread bump order based on reply PoW
- User leaderboard sorted by total PoW
- Diamond hash achievements for rare finds
- Global PoW statistics displayed
- Content discovery driven by work metrics
- No hidden algorithms or engagement metrics

### 5. treats posts as programmable primitives

Because each post has a cryptographic pedigree and exists in a small, legible space, it can be composed into higher-order systems later: reputation markets, computational data markets, or other experiments in valuing small, dense artifacts. Posts are not locked into a single platform or social graph. They are portable, verifiable, and composable. The infrastructure is extensible.

**Implementation:**
- Each post stored with PoW metadata
- Mining challenge, nonce, hash, points recorded
- Verifiable chain of work per user
- Export capabilities for post data
- Public API for accessing PoW records
- Extensible data model for future experiments

## philosophical foundation

### scarcity as signal

In a world of infinite information, scarcity becomes the only honest signal of value. Proof-of-work enforces scarcity not through gatekeeping or moderation, but through thermodynamics. You cannot fake the cost of hashing.

**Why this matters:**
- Eliminates bot spam (too expensive)
- Reduces low-effort noise
- Makes every post meaningful
- Creates natural rate limiting
- Aligns incentives with quality

### skin in the game

Every participant has literally invested energy in the system. This creates alignment and accountability. You can't post without cost. You can't join without invitation. You can't game the system without burning real resources.

**Practical effects:**
- Users think before posting
- Community self-selects for commitment
- Reputation tied to cumulative work
- Natural deterrent to bad actors
- Shared investment in community health

### transparent mechanisms

The rules are cryptographic, not algorithmic. There is no hidden recommendation engine, no engagement metrics driving visibility. What you see is determined by observable, verifiable work.

**How this works:**
- All ranking based on PoW points
- No personalized feeds
- No hidden scoring
- No shadow banning
- All rules are explicit and verifiable
- Community can audit all mechanisms

### the medium as message

By stripping away the glossy interface and constraining bandwidth, haichan forces the community to confront the underlying structure. The interface doesn't hide complexity; it exposes it.

**Design choices:**
- Monospace fonts reveal structure
- Black and white removes distraction
- Dithering shows computational constraint
- TUI aesthetics emphasize function
- Minimal UI foregrounds content
- Every design choice reinforces thesis

## implementation details

### proof-of-work system

**Target:** SHA-256 hash must start with `21e8`

**Point calculation:**
```
base_points = 15
trailing_zeros = count_zeros_after_21e8(hash)
points = base_points × 4^(trailing_zeros)
```

**Examples:**
- `21e8abcd...` → 15 points
- `21e80abc...` → 60 points
- `21e800ab...` → 240 points
- `21e8000a...` → 960 points

**Special cases:**
- Diamond hashes (leading zeros): bonus multipliers
- Runoff PoW: excess work above minimum preserved
- Stale challenges: expired challenges rejected server-side

### user identity system

**Dual authentication:**
1. Username/password (standard access)
2. Bitcoin secp256k1 keypair (cryptographic identity)

**Identity components:**
- Username (unique, case-insensitive)
- Email (for password auth)
- Bitcoin address (derived from keypair)
- Public key (secp256k1)
- Total PoW points (cumulative)
- Diamond level (achievement tier)

**Security:**
- Private keys never transmitted
- All crypto operations client-side
- Server only stores Bitcoin address and pubkey
- Password hashing via Blink Auth
- Invite codes for registration gating

### content ranking

**Threads:**
- Sort by `bump_order` (higher = more recent activity)
- Bump on new reply with valid PoW
- Display total PoW accumulated in thread

**Posts:**
- Sequential post numbers (global counter)
- Display individual PoW points
- Show username or tripcode
- Link to poster's profile and stats

**Blogs:**
- Personal blogs per user
- Custom themes (font, color)
- Sorted by creation date
- PoW required for publishing

### invite system

**Mechanics:**
- Admin generates invite codes
- Each code has max uses (default: 1)
- Code expires after use (optional)
- Codes tracked in database
- Registration requires valid unused code

**Rationale:**
- Enforces user cap
- Creates social graph bootstrap
- Prevents automated signups
- Natural rate limiting
- Community self-selection

## future directions

### reputation markets

Posts as tradeable primitives:
- PoW points as currency
- Reputation tied to work history
- Transferable post ownership
- Market-based content curation

### computational data markets

Posts as training data:
- Verified human-generated content
- PoW as quality signal
- Exportable datasets
- API access to post corpus

### seasons and modes

Dynamic community states:
- Monthly PoW competitions
- Seasonal themes
- Special event modes
- Collective unlockables

### federation

Multiple haichan instances:
- Cross-instance reputation
- Portable identity
- Federated PoW verification
- Distributed social graph

## questions for iteration

1. **Is 256 the right cap?** Too small? Too large? Should it scale with total network PoW?

2. **Should PoW difficulty adjust?** Like Bitcoin, should target adjust based on hashrate?

3. **How to handle dormant users?** Reclaim slots from inactive accounts?

4. **What about content moderation?** Pure PoW, or layered with admin powers?

5. **Can we add more cryptoeconomics?** Tipping, post bounties, PoW transfers?

6. **How to prevent PoW centralization?** GPUs/ASICs vs CPUs, fairness concerns?

7. **Should we add encrypted messaging?** Private channels with PoW barriers?

8. **Can we make posts programmable?** Smart contracts, composable primitives?

## conclusion

haichan is not a social network optimized for engagement or growth. It is an experiment in what community looks like when you remove the economics of attention and replace it with the physics of work. The outcome is uncertain. But the question is clear: **what happens when you make a system where your voice is limited, your participation is costly, and your identity is tied to the work you've done?**

This thesis is a living document. As the community evolves, so will the mechanisms and philosophy. The code is the ultimate specification, but this document attempts to capture the *why* behind the *how*.

---

**Last updated:** November 2025  
**Version:** 1.0  
**Author:** haichan project  
**License:** MIT
