# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## pseudochan

imageboard built on proof-of-work mining and secp256k1 cryptographic authentication. no passwords, no traditional identity. users prove themselves through computational work.

## development commands

```bash
cd web-app

php artisan migrate
php artisan tinker
php artisan serve

php artisan make:migration create_table_name
php artisan make:model ModelName
php artisan make:controller ControllerName

vendor/bin/phpunit
vendor/bin/phpunit --filter testMethodName
```

## architecture

### authentication flow
- secp256k1 elliptic curve signatures (no passwords)
- user requests challenge nonce from `/api/auth/challenge`
- user signs message with private key
- server verifies signature at `/api/auth/verify` using `simplito/elliptic-php`
- pubkey stored as unique identifier, bitcoin p2pkh address derived for display

### proof-of-work system
- all content creation requires POW with `21e8` hash prefix
- SHA-256 hash of challenge + nonce must start with `21e8` followed by trailing zeros
- points calculated as `15 * pow(4, extraZeros)` where extraZeros is count after `21e8`
- examples: `21e8` = 15pts, `21e80` = 60pts, `21e800` = 240pts, `21e8000` = 960pts
- POW stored in `proof_of_work` table with user_id and optional thread_id
- threads ordered by total accumulated POW from all posts
- achievements unlock at each zero milestone (0-10 zeros after `21e8`)
- implemented in `ProofOfWorkService` and `ProofOfWork` model

### POW requirements by action
- create thread: any valid `21e8` hash
- create post: any valid `21e8` hash
- create blog post: any valid `21e8` hash (stored with post)
- create chatroom: requires `21e80000` prefix (4 zeros)

### data model
- users: pubkey (unique), display_name, avatar_path, is_admin, invite_code
- boards: slug, name, description, position (multi-board system)
- threads: board_id, user_id, title (ordered by total POW)
- posts: thread_id, parent_id (nested replies), user_id, body, image_path
- proof_of_work: user_id, thread_id, challenge, nonce, hash, difficulty, points
- achievements: user_id, difficulty (0-10), hash (diamond milestones)
- chatrooms: name, slug, created_by_user_id, required_hash
- messages: user_id, chatroom_id, body (irc-style, not DMs)
- blog_posts: user_id, title, body, pow_hash, pow_points
- invite_codes: code, created_by_user_id, used_by_user_id, used_at

### chat commands
messages starting with `/` are handled by `ChatCommandService`:
- `/statusline` - user stats (POW, posts, threads, blogs, achievements)
- `/help` - command list
- `/whois <user>` - user info lookup
- `/list` - users in current room
- `/achievements` - user's diamond achievements
- `/leaderboard` - top 5 miners by total POW

commands return `{type: 'system', message: '...'}` instead of creating message records

### admin system
- `is_admin` flag on users table
- `EnsureUserIsAdmin` middleware protects `/api/admin/*` routes
- admin can generate bulk invite codes
- admin can create/update/delete boards
- admin can upload files with prompts for future claude instances

### dependencies
- laravel 11
- simplito/elliptic-php (secp256k1)
- sqlite database (database/database.sqlite)
- session-based auth (no sanctum/passport)

### design principles
- no dummy or fake values ever
- stay lean (minimal dependencies)
- stay powerful (optimized queries with proper indexes)
- always working (resilient error handling)
- all commits GPG signed by nozmo-king

### file structure
- controllers split: `Api/` for public endpoints, `Admin/` for admin, `Auth/` for authentication
- services in `app/Services/` for business logic (ProofOfWorkService, ChatCommandService)
- routes in `routes/api.php` with middleware groups
- migrations timestamped, never edit existing migrations
- css in `public/assets/pseudochan.css` (black/white/grey theme, 3d shadows, grain overlay)
- no claude code references or authorship ever