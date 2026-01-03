# Pseudochan Architecture

## Overview

Pseudochan is an imageboard platform with cryptographic authentication and proof-of-work mining. It combines traditional forum features with cryptocurrency concepts.

## Core Components

### Authentication
- **secp256k1 Signature Authentication**: Users authenticate by signing challenges with their private keys
- **Bitcoin Address Backup**: Each pubkey maps to a P2PKH Bitcoin address starting with "1"
- **Automatic Registration**: First signature creates user account via `firstOrCreate`

### Proof of Work System
- **Target**: Hash prefix `21e8` followed by zeros
- **Scoring**:
  - `21e8` = 1 point
  - `21e80` = 15 points
  - `21e800` = 60 points
  - Points = 15 * 4^(extra_zeros)
- **Thread Ordering**: Catalog sorted by total POW accumulated per thread
- **User Runoff**: POW without thread_id goes to user's personal score

### Data Model

```
users
├── id
├── pubkey (unique, secp256k1 public key)
├── display_name (nullable)
├── avatar_path (nullable)
└── timestamps

threads
├── id
├── title
├── user_id (foreign key)
└── timestamps

posts
├── id
├── thread_id (foreign key)
├── parent_id (nullable, for replies)
├── user_id (foreign key)
├── body (text content)
├── image_path (nullable, stored as path not URL)
└── timestamps

proof_of_work
├── id
├── user_id (nullable, foreign key)
├── thread_id (nullable, foreign key)
├── challenge
├── nonce
├── hash
├── difficulty
├── points
└── timestamps
```

### Relationships
- Users have many Threads
- Users have many Posts
- Users have many ProofOfWork entries
- Threads have many Posts
- Threads have many ProofOfWork entries
- Posts have many Replies (self-referential)

## Design Principles

1. **Store paths, not URLs**: All file storage uses relative paths
2. **Crypto-first auth**: No passwords, email, or traditional signup
3. **POW as currency**: Mining determines thread visibility and user reputation
4. **Network graph**: Highly interconnected, info-dense relational structure
5. **Minimalist aesthetic**: Black/white with 3D shadows, grain overlay
