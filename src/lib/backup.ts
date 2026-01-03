/**
 * User backup and credential management
 */

interface UserBackup {
  username: string
  email: string
  userId: string
  bitcoinAddress: string
  publicKey?: string
  registrationDate: string
  inviteCode: string
  totalPowPoints: number
  diamondLevel: number
  backupGeneratedAt: string
  userInviteCode?: string
}

interface FullCredentialBackup extends UserBackup {
  privateKey?: string
  password?: string // Warning: Only use for initial registration backup
  isFirstLogin?: boolean
}

/**
 * Generate backup file content
 */
export function generateBackupFile(data: UserBackup): string {
  return `
╔════════════════════════════════════════════════════════════════════╗
║                    HAICHAN POW IMAGEBOARD                           ║
║                   USER CREDENTIAL BACKUP                            ║
╚════════════════════════════════════════════════════════════════════╝

IMPORTANT: Store this file securely. Your Bitcoin private key cannot be
recovered if lost. This backup contains your complete account credentials.

───────────────────────────────────────────────────────────────────────

ACCOUNT INFORMATION
───────────────────────────────────────────────────────────────────────
Username:          ${data.username}
Email:             ${data.email}
User ID:           ${data.userId}
Registration Date: ${data.registrationDate}
Invite Code Used:  ${data.inviteCode}

───────────────────────────────────────────────────────────────────────
BITCOIN CREDENTIALS
───────────────────────────────────────────────────────────────────────
Bitcoin Address:   ${data.bitcoinAddress}
${data.publicKey ? `Public Key:        ${data.publicKey}` : ''}

───────────────────────────────────────────────────────────────────────
PROOF-OF-WORK STATISTICS
───────────────────────────────────────────────────────────────────────
Total PoW Points:  ${data.totalPowPoints}
Diamond Level:     ${data.diamondLevel} / 10

───────────────────────────────────────────────────────────────────────
YOUR INVITE CODE
───────────────────────────────────────────────────────────────────────
Your Invite Code:  ${data.userInviteCode || 'N/A'}
ℹ️  Share this code to invite 1 friend to Haichan

───────────────────────────────────────────────────────────────────────
BACKUP INFORMATION
───────────────────────────────────────────────────────────────────────
Backup Generated:  ${data.backupGeneratedAt}
Version:           1.0.0

───────────────────────────────────────────────────────────────────────

⚠️  IMPORTANT SECURITY INFORMATION:
• Your Bitcoin private key is NEVER stored on our servers
• Keep your private key secure - it cannot be recovered if lost
• Use email/password to log in normally
• Bitcoin address login requires you to provide your private key each time

For support, use the help command in chat or visit /profile

═══════════════════════════════════════════════════════════════════════
`.trim()
}

/**
 * Trigger download of backup file
 */
export function downloadBackup(data: UserBackup): void {
  try {
    const content = generateBackupFile(data)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `haichan-backup-${data.username}-${Date.now()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to generate backup file:', error)
    throw new Error('Failed to generate backup file')
  }
}

/**
 * Generate comprehensive credential backup file with all login methods
 */
export function generateFullCredentialBackup(data: FullCredentialBackup): string {
  const warningSection = data.privateKey || data.password ? `
⚠️  CRITICAL SECURITY WARNING ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This file contains SENSITIVE CREDENTIALS that provide FULL ACCESS
to your Haichan account. Treat this file like your bank password!

WHAT TO DO:
✓ Store in a password manager (recommended: 1Password, Bitwarden)
✓ Save to an encrypted USB drive stored in a safe location
✓ Print and store in a physical safe or safety deposit box
✓ Create multiple backups in different secure locations

WHAT NOT TO DO:
✗ DO NOT email this file to yourself
✗ DO NOT store in cloud storage (Dropbox, Google Drive, etc.)
✗ DO NOT leave on your desktop or Downloads folder
✗ DO NOT share with anyone - not even support staff
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''

  const passwordSection = data.password ? `
───────────────────────────────────────────────────────────────────────
LOGIN METHOD 1: USERNAME & PASSWORD (RECOMMENDED)
───────────────────────────────────────────────────────────────────────
Username:          ${data.username}
Password:          ${data.password}

🔒 Use these credentials for normal daily login
` : ''

  const keySection = data.privateKey ? `
───────────────────────────────────────────────────────────────────────
LOGIN METHOD 2: BITCOIN PRIVATE KEY (BACKUP ONLY)
───────────────────────────────────────────────────────────────────────
Private Key (WIF): ${data.privateKey}
Bitcoin Address:   ${data.bitcoinAddress}
${data.publicKey ? `Public Key:        ${data.publicKey}` : ''}

🔑 Use this key ONLY if you forget your password
⚠️  This key is NEVER stored on Haichan servers
⚠️  Anyone with this key can authenticate as you
` : ''

  return `
╔════════════════════════════════════════════════════════════════════╗
║                    HAICHAN POW IMAGEBOARD                           ║
║            COMPLETE CREDENTIAL BACKUP - STORE SECURELY!             ║
╚════════════════════════════════════════════════════════════════════╝
${warningSection}
───────────────────────────────────────────────────────────────────────
ACCOUNT INFORMATION
───────────────────────────────────────────────────────────────────────
Username:          ${data.username}
Email:             ${data.email}
User ID:           ${data.userId}
Registration Date: ${data.registrationDate}
Invite Code Used:  ${data.inviteCode}
${passwordSection}${keySection}
───────────────────────────────────────────────────────────────────────
PROOF-OF-WORK STATISTICS
───────────────────────────────────────────────────────────────────────
Total PoW Points:  ${data.totalPowPoints}
Diamond Level:     ${data.diamondLevel} / 10

───────────────────────────────────────────────────────────────────────
YOUR INVITE CODE
───────────────────────────────────────────────────────────────────────
Your Invite Code:  ${data.userInviteCode || 'Generate one in your profile'}
ℹ️  Share this code to invite friends to Haichan

───────────────────────────────────────────────────────────────────────
BACKUP INFORMATION
───────────────────────────────────────────────────────────────────────
Backup Generated:  ${data.backupGeneratedAt}
Backup Type:       ${data.isFirstLogin ? 'First Login Backup' : 'Registration Backup'}
Version:           2.0.0

───────────────────────────────────────────────────────────────────────

📋 QUICK ACCESS GUIDE:

1. NORMAL LOGIN (Daily Use):
   → Go to: /login (or visit the site and click Login)
   → Use username: ${data.username}
   → Enter your password

2. BACKUP LOGIN (Forgot Password):
   → Go to: /login
   → Click "SECP256K1" tab
   → Paste your private key
   → Follow instructions to reset password

3. SUPPORT:
   → Use the help command in chat or visit /profile for support
   → Never share your private key with anyone

═══════════════════════════════════════════════════════════════════════

Generated: ${data.backupGeneratedAt}
This backup was ${data.isFirstLogin ? 'automatically generated on your first login' : 'automatically generated during registration'}.
Keep this file safe!

═══════════════════════════════════════════════════════════════════════
`.trim()
}

/**
 * Trigger download of full credential backup
 */
export function downloadFullCredentialBackup(data: FullCredentialBackup): void {
  try {
    const content = generateFullCredentialBackup(data)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `haichan-credentials-${data.username}-${Date.now()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to generate credential backup:', error)
    throw new Error('Failed to generate credential backup')
  }
}
