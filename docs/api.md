# Pseudochan API Documentation

Base URL: `/api`

## Authentication

### POST /auth/challenge
Request a signing challenge.

**Response:**
```json
{
  "nonce": "random64charstring",
  "domain": "https://pseudochan.example",
  "message": "Sign this message to authenticate with Pseudochan\n\nDomain: https://pseudochan.example\nNonce: ..."
}
```

### POST /auth/verify
Verify signature and create/login user.

**Request:**
```json
{
  "pubkey": "hex_encoded_secp256k1_pubkey",
  "signature": "hex_encoded_signature"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "pubkey": "...",
    "display_name": "Anonymous",
    "bitcoin_address": "1A1zP1..."
  }
}
```

## Proof of Work

### GET /pow/challenge
Get a new POW challenge.

**Response:**
```json
{
  "challenge": "random64charstring",
  "target_prefix": "21e8"
}
```

### POST /pow/submit
Submit a valid proof.

**Request:**
```json
{
  "challenge": "challenge_string",
  "nonce": "found_nonce",
  "thread_id": 5  // optional
}
```

**Response:**
```json
{
  "valid": true,
  "hash": "21e8000...",
  "points": 60,
  "proof_id": 123
}
```

### GET /pow/leaderboard
Get top 100 users by POW points.

**Response:**
```json
[
  {
    "id": 1,
    "display_name": "Anonymous",
    "pubkey": "0x1234...",
    "total_points": 1337
  }
]
```

## Threads

### GET /threads
List all threads ordered by total POW.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Thread Title",
    "user_id": 1,
    "total_pow": 240,
    "posts_count": 42,
    "created_at": "2025-11-08T00:00:00.000000Z",
    "user": { ... }
  }
]
```

### POST /threads (auth required)
Create a new thread.

**Request:**
```json
{
  "title": "My Thread"
}
```

### GET /threads/{id}
Get thread with all posts and replies.

**Response:**
```json
{
  "id": 1,
  "title": "Thread Title",
  "total_pow": 240,
  "user": { ... },
  "posts": [
    {
      "id": 1,
      "body": "Post content",
      "image_path": "images/xyz.jpg",
      "user": { ... },
      "replies": [ ... ]
    }
  ]
}
```

## Posts

### GET /threads/{thread}/posts
Get all posts in a thread.

### POST /threads/{thread}/posts (auth required)
Create a post or reply.

**Request:**
```json
{
  "body": "Post content",
  "parent_id": 5,  // optional, for replies
  "image": "multipart/form-data"  // optional
}
```

**Response:**
```json
{
  "id": 10,
  "thread_id": 1,
  "parent_id": 5,
  "user_id": 2,
  "body": "Post content",
  "image_path": "images/abc.jpg",
  "created_at": "2025-11-08T00:00:00.000000Z"
}
```

## Notes

- All authenticated routes require session cookie after `/auth/verify`
- Image uploads max 10MB
- Images stored in `storage/app/public/images`
- Run `php artisan storage:link` to enable public access
