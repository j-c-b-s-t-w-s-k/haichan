# WORKING STATUS - HAICHAN

## current state

**site:** haichan (branded as haichan not pseudochan)
**url:** https://pseudochan.org (domain name, but site is haichan)
**aesthetic:** 90s barebones, times new roman, 12px, no shadows, day mode only

## authentication system

- username/password login
- registration requires friend code (invite system)
- during registration, generates bitcoin address (instant for regular users)
- admin jcb has special 21e8 "diamond" bitcoin address
- downloads credentials file after registration
- stores encrypted bitcoin private key in database

## pages

- `/landing.html` - landing page with login/register links
- `/register.html` - registration with friend code, bitcoin mining
- `/login.html` - username/password login
- `/welcome.html` - post-registration welcome
- `/` (index.html) - main haichan app with updates box

## site updates box

the updates box on the home page is used to track:
- new features and functionality
- new links and pages
- announcements
- site changes

## boards

- `/gen/` - general discussion
- `/tech/` - technology discussion
- `/film/` - film and media discussion

## database schema

users table includes:
- username (unique)
- password (bcrypted)
- pubkey (from bitcoin keypair)
- bitcoin_address (starts with 21e8)
- bitcoin_privkey (encrypted)
- display_name
- avatar_path
- is_admin
- invite_code

## proof-of-work

- `21e8` prefix required for all POW
- points = `15 * pow(4, zeros_after_21e8)`
- `21e8` = 15pts
- `21e80` = 60pts
- `21e800` = 240pts
- etc

## todos

- [x] 90s aesthetic
- [x] landing page
- [x] registration with bitcoin mining
- [x] username/password auth
- [x] deploy to production
- [x] strip CSS to black and white only (no opacity, gradients, or rgba)
- [x] add 1px borders to headers and links
- [x] install and configure PHP-FPM for production
- [x] fix chat for anonymous users
- [x] add talky chatbot to chat
- [x] create first admin user (jcb)
- [ ] test full registration flow

## admin credentials

- username: jcb
- password: @!Qtrin0pz (bcrypt hashed with automatic salt)
- is_admin: true

## invite codes

- haichan2025 (100 max uses, created by jcb)

## notes

- branding is HAICHAN not pseudochan
- bitcoin addresses must start with 21e8 (client-side mining)
- all fonts must be serif (times new roman)
- no gradients, shadows, or fancy css
- day mode only (no dark theme)
- only black (#000000) and white (#ffffff) colors allowed
- no opacity or rgba
- 1px borders on headers and links
- no border-radius, transitions, or animations
