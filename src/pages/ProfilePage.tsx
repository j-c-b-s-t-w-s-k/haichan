import { useState, useEffect } from 'react'
import { ArrowLeft, User, Trophy, Clock, Hash, Mail, Save, Shield } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { RunoffPoWDisplay } from '../components/mining/RunoffPoWDisplay'
import { BadgesInline } from '../lib/badge-utils'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function ProfilePage() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const { authState } = useAuth()
  const [profileUser, setProfileUser] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: ''
  })

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      
      if (!authState.user?.id) {
        setLoading(false)
        return
      }

      // Always load full user data from database to get POW points
      const users = await db.db.users.list({ where: { id: userId || authState.user.id }, limit: 1 })
      
      if (users && users.length > 0) {
        const fullUser = users[0]
        setProfileUser(fullUser)
        
        // If viewing own profile, allow editing
        if (!userId || userId === authState.user.id) {
          setFormData({
            username: fullUser.username || '',
            displayName: fullUser.displayName || '',
            email: fullUser.email || ''
          })
          setIsEditing(!userId)
        }
      } else {
        toast.error('User not found')
        navigate('/')
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!authState.user || !isEditing) return

    try {
      // Update username in database
      await db.db.users.update(authState.user.id, {
        username: formData.username.trim() || authState.user.username,
        displayName: formData.displayName.trim() || null,
        email: formData.email.trim() || authState.user.email,
        updatedAt: new Date().toISOString()
      })

      toast.success('Profile updated successfully!')
      loadProfile()
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Failed to update profile')
    }
  }

  if (loading) {
    return (
      <div className="bg-white text-black min-h-screen">
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="text-center font-mono py-8">Loading profile...</div>
        </div>
      </div>
    )
  }

  const currentUser = authState.user

  const isOwnProfile = currentUser && profileUser && currentUser.id === profileUser.id
  const displayUser = profileUser || currentUser
  
  // Ensure username is properly displayed (fallback to displayName if needed)
  const displayUsername = displayUser?.username || displayUser?.displayName || 'USER'

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-black font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </button>

        <div className="border-4 border-black bg-black text-white p-3 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
              <User className="w-6 h-6" />
              {isOwnProfile ? 'YOUR PROFILE' : `${displayUsername}'S PROFILE`}
              <BadgesInline user={displayUser} />
              {Number(displayUser?.isAdmin) > 0 && (
                <span className="text-xs px-2 py-1 bg-red-600 text-white border-2 border-white font-bold">
                  ADMIN
                </span>
              )}
            </h1>
            {displayUser?.username === 'jcb' && (
              <Button
                onClick={() => navigate('/admin')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-mono gap-2 border-2 border-white"
              >
                <Shield className="w-4 h-4" />
                ADMIN CP
              </Button>
            )}
          </div>
          <p className="text-xs font-mono mt-1 text-gray-300">
            {isOwnProfile ? 'Manage your account information' : 'View user profile'}
          </p>
        </div>

        {/* Runoff PoW Display (only for own profile) */}
        {isOwnProfile && (
          <div className="mb-6">
            <RunoffPoWDisplay />
          </div>
        )}

        {/* Profile Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-4 border-black">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                TOTAL POW
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {Number(displayUser?.totalPowPoints || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-600 font-mono mt-1">points earned</p>
            </CardContent>
          </Card>

          <Card className="border-4 border-black">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Hash className="w-4 h-4" />
                DIAMOND LEVEL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {displayUser?.diamondLevel || 0}
              </div>
              <p className="text-xs text-gray-600 font-mono mt-1">achievement tier</p>
            </CardContent>
          </Card>

          <Card className="border-4 border-black">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Clock className="w-4 h-4" />
                MEMBER SINCE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold font-mono">
                {new Date(displayUser?.createdAt || Date.now()).toLocaleDateString()}
              </div>
              <p className="text-xs text-gray-600 font-mono mt-1">account created</p>
            </CardContent>
          </Card>
        </div>

        {/* Profile Information */}
        <Card className="border-4 border-black">
          <CardHeader className="bg-black text-white border-b-4 border-black">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-mono">PROFILE INFO</CardTitle>
                <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                  {isOwnProfile ? 'Update your personal information' : 'User details'}
                </CardDescription>
              </div>
              {isOwnProfile && !isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="font-mono border-white text-white hover:bg-white hover:text-black"
                >
                  EDIT
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="font-mono font-bold text-sm">
                USERNAME
              </Label>
              {isOwnProfile && isEditing ? (
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter username"
                  className="font-mono border-2 border-black"
                />
              ) : (
                <div className="p-3 border-2 border-black font-mono bg-gray-50">
                  {displayUser?.username || displayUser?.displayName || 'Not set'}
                </div>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="font-mono font-bold text-sm">
                DISPLAY NAME
              </Label>
              {isOwnProfile && isEditing ? (
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Optional display name"
                  className="font-mono border-2 border-black"
                />
              ) : (
                <div className="p-3 border-2 border-black font-mono bg-gray-50">
                  {displayUser?.displayName || 'Not set'}
                </div>
              )}
            </div>

            {/* Email - Only editable/visible to own profile and completely hidden from others */}
            {isOwnProfile && isEditing && (
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono font-bold text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  EMAIL (PRIVATE)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  className="font-mono border-2 border-black"
                />
              </div>
            )}

            {/* Bitcoin Address */}
            {displayUser?.bitcoinAddress && (
              <div className="space-y-2">
                <Label className="font-mono font-bold text-sm">
                  BITCOIN ADDRESS
                </Label>
                <div className="p-3 border-2 border-black font-mono bg-gray-50 text-xs break-all">
                  {displayUser.bitcoinAddress}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isOwnProfile && isEditing && (
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  className="font-mono flex-1 border-2 border-black"
                >
                  <Save className="w-4 h-4 mr-2" />
                  SAVE CHANGES
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false)
                    setFormData({
                      username: displayUser?.username || '',
                      displayName: displayUser?.displayName || '',
                      email: displayUser?.email || ''
                    })
                  }}
                  variant="outline"
                  className="font-mono border-2 border-black"
                >
                  CANCEL
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
