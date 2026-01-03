# Haichan Features Documentation

## User Identity & Anonymity

### Username Display
- **Usernames** are displayed throughout the site instead of email addresses
- If a username is not set, the local part of the email (before @) is used
- All user-facing displays (toolbar, chat, blogs) show usernames

### Anonymity Rules
Haichan has strict anonymity rules based on context:

#### ✅ **Anonymity Allowed:**
- **Boards** (threads and posts) - Users with diamond levels can post anonymously

#### ❌ **Anonymity NOT Allowed:**
- **Blogs** - All blog posts must show author username (no anonymity)
- **Chat** - All chat messages show the sender's username (no anonymity)
- Real identity required for persistent content and live communication

### Anonymous PoW Rewards
- Anonymous users can still mine and accumulate PoW points
- If an anonymous session generates a rare hash (e.g., `21e800000000`):
  - **90% of the PoW points** are credited to the user's account
  - **10% runoff** is distributed to the system
- This incentivizes anonymous participation while rewarding real accounts

## Profile Management

### View Profile
- Access your profile by clicking your username in the top toolbar
- View other users' profiles at `/profile/:userId`
- Profile shows:
  - Total PoW points
  - Diamond level
  - Account creation date
  - Bitcoin address (if set)

### Edit Profile
- Click the "EDIT" button on your own profile page
- Editable fields:
  - Username
  - Display name (optional)
  - Email address
- Changes are saved to the database immediately

## @talky AI Bot

### About Talky
Talky is the built-in AI chatbot that participates in the global chat room.

### How to Use @talky
1. **Invoke Talky** by mentioning in chat:
   - Type `@talky` anywhere in your message
   - Or start with `talky,` (e.g., "talky, what's up?")

2. **Automatic Response**:
   - Talky will respond to your message within ~1 second
   - Response appears as a chat message with a bot indicator
   - Uses context from recent chat history

3. **Automatic Participation**:
   - Talky monitors chat activity automatically
   - Every minute, checks if it should contribute to the conversation
   - Responds naturally based on chat flow

### Talky Implementation
- Backend: Edge function at `/functions/talky-bot/index.ts`
- Memory system: Stores conversation context in `chat_memory` table
- AI Model: Uses Blink SDK's AI generation
- Context-aware: Reads recent messages and memory for relevant responses

### Talky Features
- **Memory persistence**: Remembers important conversation topics
- **Context awareness**: Understands ongoing discussions
- **Natural timing**: Only speaks when relevant
- **Bot indicator**: Messages clearly marked as AI-generated

## Mining & Proof-of-Work

### PoW Points System
- All actions (posts, blogs, chat) can be enhanced with PoW mining
- Higher PoW = higher visibility and ranking
- Points tracked in `total_pow_points` for each user

### Mining Sessions
- Dedicated mining mode available at `/mine`
- Background mining during normal browsing
- Mouseover mining on interactive elements
- Real-time hash rate displayed in bottom toolbar

### Diamond Achievements
- Rare hash patterns unlock diamond levels
- Higher diamond level = more features (like anonymity on boards)
- Tracked in `achievements` and `diamond_level` columns

## Content Features

### Blogs
- Personal publishing platform with custom theming
- Required fields:
  - Author username (always visible - no anonymity)
  - Blog name
  - Title and content
- Optional customization:
  - Font selection (15+ fonts available)
  - Accent color
  - Rich media embeds (YouTube, hyperlinks)
- PoW mining required for publishing

### Boards & Threads
- Classic imageboard format
- Anonymous posting allowed (with diamond level)
- Image uploads with automatic dithering
- PoW affects post ranking and bump order

### Chat
- Real-time global chat room
- Username always visible (no anonymity)
- @talky AI bot integration
- Online user list in sidebar
- Inactivity timeout: 1 hour

### Images
- Centralized image library
- AI-powered tagging system
- Upload and management
- Image search and filtering

## Technical Details

### Database Schema
- `users` - User accounts with username, email, PoW points
- `blog_posts` - Blog content with author_username field
- `threads` & `posts` - Board content
- `chat_messages` - Chat history with username tracking
- `chat_activity` - Online user tracking
- `chat_memory` - Talky AI memory storage

### Authentication
- Email/password authentication
- Bitcoin key authentication (secp256k1)
- Invite code system for registration
- Session management via Blink SDK

### Mining Implementation
- Web Worker-based hashing
- Multi-threaded mining support
- Configurable difficulty targets
- Real-time progress tracking
