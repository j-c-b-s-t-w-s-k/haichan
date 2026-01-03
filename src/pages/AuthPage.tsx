import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { LogIn, UserPlus, Key, Download } from 'lucide-react'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { generateBitcoinKeypair, getBitcoinAddressType } from '../lib/bitcoin'
import { downloadFullCredentialBackup } from '../lib/backup'
import { generateSalt, hashPrivateKey } from '../lib/crypto'
import { validateInviteCode, markInviteCodeAsUsed, getCurrentEpoch } from '../lib/invite-codes'
import { validateUsername, sanitizeUsername } from '../lib/username-validation'
import { MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH } from '../lib/constants'
import { getCurrentPublicInviteCode, isPublicInviteActive, getTimeRemaining, getPublicInviteMessage } from '../lib/public-invite-codes'

export function AuthPage() {
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [showAdminSeed, setShowAdminSeed] = useState(false)
  const [currentEpoch, setCurrentEpoch] = useState<number>(256)

  // Login state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')

  // Register state
  const [registerUsername, setRegisterUsername] = useState('')
  const [email, setEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [generatedKeys, setGeneratedKeys] = useState<{ privateKey: string; publicKey: string; address: string } | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [hasDownloadedKey, setHasDownloadedKey] = useState(false)
  const [registerUsernameError, setRegisterUsernameError] = useState('')
  const [inviteCodeError, setInviteCodeError] = useState('')
  const [publicInviteMessage, setPublicInviteMessage] = useState<string | null>(null)
  const [useBitcoinAuth, setUseBitcoinAuth] = useState(false)
  
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    checkForAdminUser()
    loadCurrentEpoch()
    updatePublicInviteMessage()
    
    // Auto-fill public invite code if available
    const publicCode = getCurrentPublicInviteCode()
    if (publicCode && !inviteCode) {
      setInviteCode(publicCode)
    }
    
    // Update public invite message every minute
    const interval = setInterval(updatePublicInviteMessage, 60000)
    return () => clearInterval(interval)
  }, [])

  const checkForAdminUser = async () => {
    try {
      const adminUsers = await db.db.users.list({ where: { isAdmin: '1' }, limit: 1 })
      setShowAdminSeed(adminUsers.length === 0)
    } catch (error: any) {
      // Silently fail if rate limited - default to not showing admin seed
      if (error?.message?.includes('Rate limit')) {
        console.debug('Admin check rate limited, skipping')
      } else {
        console.error('Failed to check for admin:', error)
      }
      setShowAdminSeed(false)
    }
  }

  const loadCurrentEpoch = async () => {
    try {
      const epoch = await getCurrentEpoch()
      setCurrentEpoch(epoch)
    } catch (error: any) {
      // Silently fail if rate limited - use default
      if (error?.message?.includes('Rate limit')) {
        console.debug('Epoch check rate limited, using cache')
      } else {
        console.error('Failed to load epoch:', error)
      }
    }
  }

  const updatePublicInviteMessage = () => {
    const message = getPublicInviteMessage()
    setPublicInviteMessage(message)
  }

  // Login handlers
  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    
    setLoading(true)
    setUsernameError('')

    try {
      const normalizedUsername = username.trim().toLowerCase()
      console.log('[AuthPage] Attempting login with username:', normalizedUsername)
      
      const users = await db.db.users.list({ where: { username: normalizedUsername }, limit: 1 })
      console.log('[AuthPage] User lookup result:', users)

      if (!users || users.length === 0) {
        console.warn('[AuthPage] Username not found in database:', normalizedUsername)
        setUsernameError('Username not found. Please check your username and try again.')
        toast.error('Username not found')
        setLoading(false)
        return
      }

      const user = users[0]
      console.log('[AuthPage] Found user:', { id: user.id, email: user.email, username: user.username })

      if (!user.email) {
        console.error('[AuthPage] User has no email:', user.id)
        setUsernameError('Account email not found. Please contact support.')
        toast.error('Account email not found')
        setLoading(false)
        return
      }

      const loginResult = await db.auth.signInWithEmail(user.email, password)
      console.log('[AuthPage] Login successful:', loginResult)

      const isFirstLogin = !user.lastSignIn || new Date(user.lastSignIn).getTime() === new Date(user.createdAt).getTime()

      if (isFirstLogin) {
        try {
          const inviteCodes = await db.db.inviteCodes.list({ where: { usedBy: user.id }, limit: 1 })
          const inviteCodeValue = inviteCodes && inviteCodes.length > 0 ? inviteCodes[0].code : 'N/A'

          downloadFullCredentialBackup({
            username: user.username || username,
            email: user.email,
            password,
            userId: user.id,
            bitcoinAddress: user.bitcoinAddress || 'N/A',
            publicKey: user.publicKey,
            registrationDate: user.createdAt,
            inviteCode: inviteCodeValue,
            totalPowPoints: user.totalPowPoints || 0,
            diamondLevel: user.diamondLevel || 0,
            backupGeneratedAt: new Date().toISOString(),
            isFirstLogin: true
          })

          toast.success('First login! Credential backup downloaded. Store securely!', { duration: 5000 })
        } catch (backupError) {
          console.error('Failed to generate first login backup:', backupError)
          toast.success('Welcome back!')
        }
      } else {
        toast.success('Welcome back!')
      }
      console.log('[AuthPage] Navigating to home after successful login')
      
      // Delay navigation slightly to allow toast to be seen
      setTimeout(() => {
        if (isMounted.current) {
          navigate('/')
        }
      }, 500)
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed'

      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('incorrect') || errorMessage.toLowerCase().includes('unauthorized')) {
        setUsernameError('Invalid username or password. Please check your credentials and try again.')
        toast.error('Invalid username or password')
      } else {
        setUsernameError(errorMessage)
        toast.error(errorMessage)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }



  // Register handlers
  const handleRegisterUsernameChange = async (value: string) => {
    const sanitized = sanitizeUsername(value)
    setRegisterUsername(sanitized)
    setRegisterUsernameError('')

    if (sanitized.length >= MIN_USERNAME_LENGTH) {
      const validation = await validateUsername(sanitized)
      if (!validation.valid) {
        setRegisterUsernameError(validation.message)
      }
    }
  }

  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value.toUpperCase())
    setInviteCodeError('')
  }

  const handleGenerateKeys = () => {
    try {
      const keys = generateBitcoinKeypair()
      if (!keys) {
        toast.error('Bitcoin crypto unavailable in this browser. Please use password authentication.')
        return
      }
      setGeneratedKeys(keys)
      setHasDownloadedKey(false)
      toast.success('Bitcoin keypair generated! Please download and secure your private key.')
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate Bitcoin keypair')
      console.error('Keypair generation error:', error)
    }
  }

  const handleDownloadPrivateKey = () => {
    if (!generatedKeys) return

    const content = `HAICHAN BITCOIN PRIVATE KEY
=====================================

⚠️ CRITICAL: Store this file securely offline!
Your private key provides backup access to your account.
Anyone with this key can authenticate as you.

Username: ${registerUsername || 'Not set'}
Bitcoin Address: ${generatedKeys.address}
Address Type: ${getBitcoinAddressType(generatedKeys.address)}

Private Key (WIF Format):
${generatedKeys.privateKey}

Public Key (hex):
${generatedKeys.publicKey}

Generated: ${new Date().toISOString()}

🔒 SECURITY NOTES:
- Never share this key with anyone
- Store in a password manager or encrypted drive
- Consider printing and storing in a safe
- This key is NEVER stored on Haichan servers
- Use this key for backup authentication only
`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `haichan-bitcoin-key-${generatedKeys.address.slice(0, 8)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setHasDownloadedKey(true)
    toast.success('Private key downloaded! Keep this file secure.')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent double submission
    if (loading) return
    setLoading(true)

    try {
      // 1. Validate inputs
      const usernameValidation = await validateUsername(registerUsername)
      if (!usernameValidation.valid) {
        setRegisterUsernameError(usernameValidation.message)
        toast.error(usernameValidation.message)
        setLoading(false)
        return
      }

      const inviteValidation = await validateInviteCode(inviteCode)
      if (!inviteValidation.valid) {
        setInviteCodeError(inviteValidation.message)
        toast.error(inviteValidation.message)
        setLoading(false)
        return
      }

      // 2. Validate Bitcoin keys if enabled
      if (useBitcoinAuth && generatedKeys && !hasDownloadedKey) {
        toast.error('Please download your private key before registering')
        setLoading(false)
        return
      }

      if (useBitcoinAuth && generatedKeys) {
        const existingUser = await db.db.users.list({ where: { bitcoinAddress: generatedKeys.address }, limit: 1 })
        if (existingUser && existingUser.length > 0) {
          toast.error('This Bitcoin address is already registered')
          setLoading(false)
          return
        }
      }

      // 3. Prepare Bitcoin auth data
      let keyHash, salt
      if (useBitcoinAuth && generatedKeys) {
        salt = generateSalt()
        keyHash = await hashPrivateKey(generatedKeys.privateKey, salt)
      }

      // 4. Create Auth User
      let user: any = null
      try {
        user = await db.auth.signUp({
          email,
          password: registerPassword,
          displayName: registerUsername,
          metadata: {
            username: registerUsername,
            ...(useBitcoinAuth && generatedKeys && {
              bitcoinAddress: generatedKeys.address,
              addressType: getBitcoinAddressType(generatedKeys.address),
              publicKey: generatedKeys.publicKey,
              keySalt: salt,
              keyHash: keyHash
            })
          }
        })

        // Auto-login after signup
        console.log('[AuthPage] Signup successful, auto-logging in...')
        await db.auth.signInWithEmail(email, registerPassword)
        console.log('[AuthPage] Auto-login successful')

      } catch (signupError: any) {
        const errorMsg = signupError.message || 'Signup failed'
        console.error('Signup auth error:', signupError)
        
        if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('exists')) {
          toast.error('This email is already registered. Please try logging in instead.')
        } else {
          toast.error(`Signup failed: ${errorMsg}`)
        }
        setLoading(false)
        return
      }

      if (user?.id) {
        // 5. Sync User Profile to Database
        // Brief delay to allow auth propagation
        await new Promise(resolve => setTimeout(resolve, 500))

        const userData: any = {
          id: user.id,
          username: registerUsername.toLowerCase(),
          displayName: registerUsername,
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          totalPowPoints: 0,
          diamondLevel: 0,
          isAdmin: '0',
          emailVerified: '0',
          lastSignIn: new Date().toISOString(),
          ...(useBitcoinAuth && generatedKeys && {
            bitcoinAddress: generatedKeys.address,
            publicKey: generatedKeys.publicKey
          })
        }

        let profileCreated = false
        // Retry logic for profile creation
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await db.db.users.upsert(userData)
            console.log('User record synced successfully:', user.id)
            profileCreated = true
            break
          } catch (error: any) {
            console.error(`Failed to sync user record (attempt ${attempt + 1}/3):`, error)
            if (attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
            }
          }
        }

        // 6. Handle Invite Code
        if (inviteValidation.codeId) {
          try {
            await markInviteCodeAsUsed(inviteValidation.codeId, user.id)
          } catch (e) {
            console.warn('Failed to mark invite code as used:', e)
          }
        }

        // 7. Download Backup
        try {
          downloadFullCredentialBackup({
            username: registerUsername,
            email,
            password: registerPassword,
            userId: user.id,
            bitcoinAddress: generatedKeys?.address || 'N/A',
            publicKey: generatedKeys?.publicKey || '',
            privateKey: generatedKeys?.privateKey || '',
            registrationDate: new Date().toISOString(),
            inviteCode,
            totalPowPoints: 0,
            diamondLevel: 0,
            backupGeneratedAt: new Date().toISOString(),
            isFirstLogin: false
          })
        } catch (e) {
          console.warn('Failed to download credential backup:', e)
        }

        // 8. Show Success Message & Navigate
        // Clear any existing toasts to prevent stacking
        toast.dismiss()
        
        if (profileCreated) {
          toast.success('Registration successful! Credential backup downloaded.', { duration: 5000 })
        } else {
          toast.success('Account created! Please check your profile settings.', { duration: 5000 })
        }

        setTimeout(() => {
          if (isMounted.current) {
            navigate('/')
          }
        }, 1500)
      } else {
        toast.error('Signup failed: No user ID returned')
      }
    } catch (error: any) {
      console.error('Unexpected registration error:', error)
      toast.error(error.message || 'Registration failed. Please try again.')
    } finally {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold font-mono">HAICHAN</CardTitle>
          <CardDescription className="font-mono">Proof-of-Work Imageboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="login" className="font-mono text-xs">
                <LogIn className="w-3 h-3 mr-1" />
                LOGIN
              </TabsTrigger>
              <TabsTrigger value="register" className="font-mono text-xs">
                <UserPlus className="w-3 h-3 mr-1" />
                REGISTER
              </TabsTrigger>
              <TabsTrigger value="lurk" className="font-mono text-xs">
                👻
              </TabsTrigger>
            </TabsList>

            {/* LOGIN TAB */}
            <TabsContent value="login">
              <form onSubmit={handleUsernameLogin} className="space-y-4">
                {usernameError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm font-mono">
                    ⚠️ {usernameError}
                  </div>
                )}

                <div>
                  <Label htmlFor="username" className="font-mono">USERNAME</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setUsernameError('')
                    }}
                    className="font-mono"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="font-mono">PASSWORD</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setUsernameError('')
                    }}
                    className="font-mono"
                    required
                  />
                </div>

                <Button type="submit" className="w-full font-mono" disabled={loading}>
                  {loading ? 'AUTHENTICATING...' : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      LOG IN
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* REGISTER TAB */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                {publicInviteMessage && (
                  <div className="p-3 bg-green-50 border-2 border-green-500 rounded font-mono text-xs text-green-700">
                    🎉 {publicInviteMessage}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="inviteCode" className="font-mono">INVITE CODE *</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => handleInviteCodeChange(e.target.value)}
                    className={`font-mono ${inviteCodeError ? 'border-red-500' : ''}`}
                    placeholder="HC-XXXX-XXXX-XXXX"
                    required
                    autoFocus
                  />
                  {inviteCodeError && (
                    <p className="text-xs text-red-600 mt-1 font-mono">⚠ {inviteCodeError}</p>
                  )}
                  {isPublicInviteActive() ? (
                    <p className="text-xs text-green-600 mt-1 font-mono">✓ Public registration is open! Code auto-filled.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">Request an invite code from an existing user or admin (Current epoch: {currentEpoch} users)</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="registerUsername" className="font-mono">USERNAME * (A-Z, a-z, 0-9)</Label>
                  <Input
                    id="registerUsername"
                    type="text"
                    value={registerUsername}
                    onChange={(e) => handleRegisterUsernameChange(e.target.value)}
                    className={`font-mono ${registerUsernameError ? 'border-red-500' : ''}`}
                    placeholder="SATOSHI2024"
                    minLength={MIN_USERNAME_LENGTH}
                    maxLength={MAX_USERNAME_LENGTH}
                    required
                  />
                  {registerUsernameError && (
                    <p className="text-xs text-red-600 mt-1 font-mono">⚠ {registerUsernameError}</p>
                  )}
                  {!registerUsernameError && registerUsername.length >= MIN_USERNAME_LENGTH && (
                    <p className="text-xs text-green-600 mt-1 font-mono">✓ Username is available</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{registerUsername.length}/{MAX_USERNAME_LENGTH} characters</p>
                </div>

                <div>
                  <Label htmlFor="registerEmail" className="font-mono">EMAIL *</Label>
                  <Input id="registerEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="font-mono" required />
                </div>

                <div>
                  <Label htmlFor="registerPassword" className="font-mono">PASSWORD *</Label>
                  <Input id="registerPassword" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="font-mono" minLength={8} required />
                </div>

                <div className="border-2 border-dashed p-4 rounded">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-mono">BITCOIN KEYPAIR (OPTIONAL)</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setUseBitcoinAuth(!useBitcoinAuth)
                        if (!useBitcoinAuth) {
                          setGeneratedKeys(null)
                          setHasDownloadedKey(false)
                        }
                      }}
                      className="text-xs font-mono text-primary hover:underline"
                    >
                      {useBitcoinAuth ? 'Skip for now' : 'Enable Bitcoin auth'}
                    </button>
                  </div>

                  {!useBitcoinAuth ? (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground font-mono mb-3">
                        You can register with just username/password.<br/>
                        Bitcoin authentication can be added later.
                      </p>
                      <Button
                        type="button"
                        onClick={() => setUseBitcoinAuth(true)}
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                      >
                        <Key className="w-3 h-3 mr-1" />
                        Add Bitcoin Auth
                      </Button>
                    </div>
                  ) : !generatedKeys ? (
                    <Button type="button" onClick={handleGenerateKeys} variant="outline" className="w-full font-mono">
                      <Key className="w-4 h-4 mr-2" />
                      GENERATE KEYS
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-muted p-3 rounded">
                        <p className="text-xs font-mono text-muted-foreground mb-1">Bitcoin Address:</p>
                        <p className="text-xs font-mono break-all">{generatedKeys.address}</p>
                        <p className="text-xs text-green-600 mt-1 font-mono">✓ {getBitcoinAddressType(generatedKeys.address)}</p>
                      </div>

                      <div className="bg-muted p-3 rounded">
                        <p className="text-xs font-mono text-muted-foreground mb-1">Private Key:</p>
                        {showPrivateKey ? (
                          <p className="text-xs font-mono break-all text-red-600">{generatedKeys.privateKey}</p>
                        ) : (
                          <p className="text-xs font-mono text-muted-foreground">••••••••••••••••••••</p>
                        )}
                        <Button type="button" onClick={() => setShowPrivateKey(!showPrivateKey)} variant="ghost" size="sm" className="mt-2 font-mono text-xs">
                          {showPrivateKey ? 'HIDE' : 'SHOW'}
                        </Button>
                      </div>

                      <Button type="button" onClick={handleDownloadPrivateKey} variant={hasDownloadedKey ? 'secondary' : 'default'} className="w-full font-mono">
                        <Download className="w-4 h-4 mr-2" />
                        {hasDownloadedKey ? '✓ KEY DOWNLOADED' : 'DOWNLOAD PRIVATE KEY'}
                      </Button>

                      <p className="text-xs text-amber-600 font-mono border-l-2 border-amber-600 pl-2">⚠️ Download and secure your private key before registering! This key provides backup access to your account.</p>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full font-mono" disabled={loading || (useBitcoinAuth && generatedKeys && !hasDownloadedKey)}>
                  {loading ? 'REGISTERING...' : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      REGISTER
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* LURK TAB */}
            <TabsContent value="lurk">
              <div className="font-mono text-xs leading-relaxed space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                
                {/* Abstract */}
                <section className="border border-border p-3">
                  <h2 className="font-bold text-sm mb-2">lurk mode</h2>
                  <p className="text-justify">
                    haichan tests the idea that an online community can be made healthier and more interesting by replacing cheap abundance (infinite posts, infinite users, zero-cost identity) with cryptographically enforced scarcity and computational friction.
                  </p>
                </section>

                {/* Core Mechanism 1 */}
                <section className="border border-border p-3">
                  <h3 className="font-bold text-sm mb-2">caps the social graph</h3>
                  <p className="text-justify">
                    A hard ceiling on users (256-sized tranches, invite-gated) turns the board into a finite game. You are not shouting into a global feed; you are interacting inside a closed topology whose participants are known, trackable, and costly to fake.
                  </p>
                </section>

                {/* Core Mechanism 2 */}
                <section className="border border-border p-3">
                  <h3 className="font-bold text-sm mb-2">prices expression in computation</h3>
                  <p className="text-justify">
                    Posting is gated by proof-of-work and protocol-level friction. You can't spam your way to visibility; you have to literally burn cycles. Every post is a small cryptographic artifact with a verifiable cost history.
                  </p>
                </section>

                {/* Core Mechanism 3 */}
                <section className="border border-border p-3">
                  <h3 className="font-bold text-sm mb-2">compresses the medium</h3>
                  <p className="text-justify">
                    Images are aggressively compressed/dithered; the interface is TUI/ssh-like. By constraining bandwidth and aesthetics, haichan foregrounds structure (who can post, at what cost, with what history) over UI spectacle.
                  </p>
                </section>

                {/* Core Mechanism 4 */}
                <section className="border border-border p-3">
                  <h3 className="font-bold text-sm mb-2">responds to work, not vibes</h3>
                  <p className="text-justify">
                    The global state of the board (ordering, visibility, possible actions) is designed to be a function of aggregate work performed by participants. The community doesn't just live on the substrate; it drives it.
                  </p>
                </section>

                {/* Core Mechanism 5 */}
                <section className="border border-border p-3">
                  <h3 className="font-bold text-sm mb-2">treats posts as programmable primitives</h3>
                  <p className="text-justify">
                    Because each post has a cryptographic pedigree and exists in a small, legible space, it can be composed into higher-order systems: reputation markets, computational data markets, or other experiments in valuing small, dense artifacts.
                  </p>
                </section>

                {/* Bottom CTA */}
                <div className="border-2 border-primary bg-primary/5 p-3 text-center">
                  <p className="text-xs mb-2">Ready to participate?</p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setActiveTab('login')} 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 font-mono text-xs"
                    >
                      LOGIN
                    </Button>
                    <Button 
                      onClick={() => setActiveTab('register')} 
                      size="sm" 
                      className="flex-1 font-mono text-xs"
                    >
                      REGISTER
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer Links */}
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
            {showAdminSeed && (
              <div>
                <button type="button" onClick={() => navigate('/seed')} className="text-xs font-mono text-muted-foreground hover:text-foreground underline">[ADMIN] Seed Test User</button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
