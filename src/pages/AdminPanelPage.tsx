import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Users, Database, Activity, Shield, Key, UserCog, Layout, Trash2, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { getUserInviteCodes, grantEpochInviteCodes, getCurrentEpoch } from '../lib/invite-codes'
import { ADMIN_CODES_PER_EPOCH } from '../lib/constants'

export function AdminPanelPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalThreads: 0,
    totalPosts: 0,
    totalPow: 0,
    totalBoards: 0
  })
  
  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<any[]>([])
  const [currentEpoch, setCurrentEpoch] = useState<number>(256)
  const [generating, setGenerating] = useState(false)
  
  // User management state
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [boards, setBoards] = useState<any[]>([])
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'user' | 'invite' | 'board' | null; id: string | null; name: string | null }>({
    open: false,
    type: null,
    id: null,
    name: null
  })

  useEffect(() => {
    let isMounted = true
    
    const performAuth = async () => {
      try {
        if (!authState.user) {
          setLoading(false)
          return
        }
        
        if (!isMounted) return
        
        // Check if user is jcb or admin (isAdmin is stored as "0" or "1" string)
        if (authState.user.username !== 'jcb' && Number(authState.user.isAdmin) === 0) {
          toast.error('Access denied: Admin only')
          navigate('/')
          setLoading(false)
          return
        }
        
        // Load all data after auth check succeeds
        try {
          const [users, threads, posts, boardsList] = await Promise.all([
            db.db.users.list({ limit: 1000 }),
            db.db.threads.list({ limit: 1000 }),
            db.db.posts.list({ limit: 1000 }),
            db.db.boards.list({ limit: 100 })
          ])

          if (!isMounted) return

          const totalPow = users.reduce((sum, u) => sum + (Number(u.totalPowPoints) || 0), 0)

          setStats({
            totalUsers: users.length,
            totalThreads: threads.length,
            totalPosts: posts.length,
            totalPow,
            totalBoards: boardsList.length
          })

          setAllUsers(users)
          setBoards(boardsList)

          // Load invite codes (auth already checked above)
          if (authState.user?.id) {
            const epoch = await getCurrentEpoch()
            setCurrentEpoch(epoch)
            const codes = await getUserInviteCodes(authState.user.id)
            setInviteCodes(codes)
          }

          setLoading(false)
        } catch (dataError) {
          if (isMounted) {
            console.error('Data loading error:', dataError)
            toast.error('Failed to load statistics')
            setLoading(false)
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Auth check error:', error)
          toast.error('Failed to load admin panel')
          navigate('/')
          setLoading(false)
        }
      }
    }

    performAuth()
    
    return () => {
      isMounted = false
    }
  }, [navigate, authState.user])
  


  const loadAllData = useCallback(async () => {
    try {
      const [users, threads, posts, boardsList] = await Promise.all([
        db.db.users.list({ limit: 1000 }),
        db.db.threads.list({ limit: 1000 }),
        db.db.posts.list({ limit: 1000 }),
        db.db.boards.list({ limit: 100 })
      ])

      const totalPow = users.reduce((sum, u) => sum + (Number(u.totalPowPoints) || 0), 0)

      setStats({
        totalUsers: users.length,
        totalThreads: threads.length,
        totalPosts: posts.length,
        totalPow,
        totalBoards: boardsList.length
      })

      setAllUsers(users)
      setBoards(boardsList)

      // Reload invite codes if user exists
      if (authState.user?.id) {
        const epoch = await getCurrentEpoch()
        setCurrentEpoch(epoch)
        const codes = await getUserInviteCodes(authState.user.id)
        setInviteCodes(codes)
      }

      toast.success('Data refreshed!')
    } catch (error) {
      console.error('Failed to refresh data:', error)
      toast.error('Failed to refresh data')
    }
  }, [authState.user?.id])
  
  const handleGenerateCodes = async () => {
    if (!authState.user?.id) return
    
    // Only jcb can generate codes
    if (authState.user?.username !== 'jcb') {
      toast.error('Only the admin user "jcb" can generate invite codes')
      return
    }
    
    setGenerating(true)
    try {
      const isAdmin = Number(authState.user?.isAdmin) > 0
      await grantEpochInviteCodes(authState.user.id, isAdmin)
      toast.success(`Generated ${isAdmin ? ADMIN_CODES_PER_EPOCH : 1} new invite code(s)!`)
      await loadAllData()
    } catch (error) {
      toast.error('Failed to generate invite codes')
    } finally {
      setGenerating(false)
    }
  }
  
  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy')
    }
  }
  
  const handleDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.type) return
    
    try {
      switch (deleteDialog.type) {
        case 'user':
          await db.db.users.delete(deleteDialog.id)
          toast.success('User deleted successfully')
          await loadAllData()
          break
        case 'invite':
          await db.db.inviteCodes.delete(deleteDialog.id)
          toast.success('Invite code deleted successfully')
          await loadInviteCodes()
          break
        case 'board':
          await db.db.boards.delete(deleteDialog.id)
          toast.success('Board deleted successfully')
          await loadAllData()
          break
      }
    } catch (error) {
      toast.error(`Failed to delete ${deleteDialog.type}`)
      console.error('Delete error:', error)
    } finally {
      setDeleteDialog({ open: false, type: null, id: null, name: null })
    }
  }

  if (loading) {
    return (
      <div className="bg-white text-black min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-gray-500">Verifying admin access</div>
        </div>
      </div>
    )
  }
  
  // Filter invite codes
  const unusedCodes = inviteCodes.filter(code => {
    const maxUses = Number(code.maxUses) || 1
    const usesCount = Number(code.usesCount) || 0
    return usesCount < maxUses
  })
  const usedCodes = inviteCodes.filter(code => {
    const maxUses = Number(code.maxUses) || 1
    const usesCount = Number(code.usesCount) || 0
    return usesCount >= maxUses
  })

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="container mx-auto p-4 max-w-7xl">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-black font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

        <div className="border-4 border-black bg-black text-white p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-mono flex items-center gap-3">
                <Shield className="w-7 h-7" />
                ADMIN CONTROL PANEL
              </h1>
              <p className="text-xs font-mono mt-2 text-gray-300">
                Full system administration • Logged in as: <span className="font-bold text-white">{authState.user?.username}</span> • Role: ADMIN
              </p>
            </div>
            <Button
              onClick={loadAllData}
              variant="outline"
              className="bg-white text-black hover:bg-gray-200 font-mono"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              REFRESH ALL
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-4 border-black">
            <CardContent className="pt-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalUsers}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">USERS</p>
            </CardContent>
          </Card>
          <Card className="border-4 border-black">
            <CardContent className="pt-4 text-center">
              <Database className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalThreads + stats.totalPosts}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">POSTS</p>
            </CardContent>
          </Card>
          <Card className="border-4 border-black">
            <CardContent className="pt-4 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalPow.toLocaleString()}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">POW</p>
            </CardContent>
          </Card>
          <Card className="border-4 border-black">
            <CardContent className="pt-4 text-center">
              <Layout className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalBoards}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">BOARDS</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Interface */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-black text-white border-4 border-black h-auto">
            <TabsTrigger value="overview" className="font-mono data-[state=active]:bg-white data-[state=active]:text-black py-3">
              <Shield className="w-4 h-4 mr-2" />
              OVERVIEW
            </TabsTrigger>
            <TabsTrigger value="invites" className="font-mono data-[state=active]:bg-white data-[state=active]:text-black py-3">
              <Key className="w-4 h-4 mr-2" />
              INVITES
            </TabsTrigger>
            <TabsTrigger value="users" className="font-mono data-[state=active]:bg-white data-[state=active]:text-black py-3">
              <UserCog className="w-4 h-4 mr-2" />
              USERS
            </TabsTrigger>
            <TabsTrigger value="boards" className="font-mono data-[state=active]:bg-white data-[state=active]:text-black py-3">
              <Layout className="w-4 h-4 mr-2" />
              BOARDS
            </TabsTrigger>
            <TabsTrigger value="tools" className="font-mono data-[state=active]:bg-white data-[state=active]:text-black py-3">
              <Database className="w-4 h-4 mr-2" />
              TOOLS
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <Card className="border-4 border-black">
              <CardHeader className="bg-black text-white border-b-4 border-black">
                <CardTitle className="font-mono">SYSTEM OVERVIEW</CardTitle>
                <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                  Quick actions and system information
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => navigate('/seed')}
                    variant="outline"
                    className="font-mono border-2 border-black h-auto py-4"
                  >
                    <div className="text-left w-full">
                      <div className="font-bold">DATABASE SEED</div>
                      <div className="text-xs text-gray-600 mt-1">Initialize test data and boards</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => navigate('/images')}
                    variant="outline"
                    className="font-mono border-2 border-black h-auto py-4"
                  >
                    <div className="text-left w-full">
                      <div className="font-bold">IMAGE LIBRARY</div>
                      <div className="text-xs text-gray-600 mt-1">Manage uploaded images</div>
                    </div>
                  </Button>
                </div>

                <div className="bg-gray-100 border-2 border-black p-4 font-mono text-sm">
                  <p className="font-bold mb-3 text-base">📊 SYSTEM STATISTICS:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <ul className="space-y-2 text-gray-700 text-xs">
                        <li className="flex justify-between">
                          <span>Total Users:</span>
                          <span className="font-bold">{stats.totalUsers}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Total Threads:</span>
                          <span className="font-bold">{stats.totalThreads}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Total Posts:</span>
                          <span className="font-bold">{stats.totalPosts}</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <ul className="space-y-2 text-gray-700 text-xs">
                        <li className="flex justify-between">
                          <span>Avg PoW/User:</span>
                          <span className="font-bold">{stats.totalUsers > 0 ? Math.floor(stats.totalPow / stats.totalUsers) : 0}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Posts/Thread:</span>
                          <span className="font-bold">{stats.totalThreads > 0 ? (stats.totalPosts / stats.totalThreads).toFixed(1) : 0}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Total Boards:</span>
                          <span className="font-bold">{stats.totalBoards}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invites Tab */}
          <TabsContent value="invites">
            <Card className="border-4 border-black">
              <CardHeader className="bg-black text-white border-b-4 border-black">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-mono flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      INVITE CODE MANAGEMENT
                    </CardTitle>
                    <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                      Current epoch: {currentEpoch} • {unusedCodes.length} unused, {usedCodes.length} used
                      {authState.user?.username !== 'jcb' && ' • View only (jcb access required)'}
                    </CardDescription>
                  </div>
                  {authState.user?.username === 'jcb' && (
                    <Button
                      onClick={handleGenerateCodes}
                      disabled={generating}
                      className="bg-white text-black hover:bg-gray-200 font-mono font-bold"
                      size="sm"
                    >
                      {generating ? 'GENERATING...' : `+ GENERATE ${ADMIN_CODES_PER_EPOCH}`}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Unused Codes */}
                {unusedCodes.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-mono font-bold text-sm mb-3 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      AVAILABLE CODES ({unusedCodes.length})
                    </h3>
                    <div className="space-y-2">
                      {unusedCodes.map((code) => {
                        const maxUses = Number(code.maxUses) || 1
                        const usesCount = Number(code.usesCount) || 0
                        const remainingUses = maxUses - usesCount
                        
                        return (
                          <div key={code.id} className="flex items-center gap-2 p-3 bg-green-50 rounded border-2 border-green-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-lg font-mono font-bold select-all">{code.code}</p>
                                {maxUses > 1 && (
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {remainingUses}/{maxUses} uses
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs font-mono text-gray-600 mt-1">
                                Created: {new Date(code.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              onClick={() => copyToClipboard(code.code)}
                              variant="outline"
                              size="sm"
                              className="font-mono"
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              COPY
                            </Button>
                            {authState.user?.username === 'jcb' && (
                              <Button
                                onClick={() => setDeleteDialog({ open: true, type: 'invite', id: code.id, name: code.code })}
                                variant="outline"
                                size="sm"
                                className="font-mono text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Used Codes */}
                {usedCodes.length > 0 && (
                  <div>
                    <h3 className="font-mono font-bold text-sm mb-3 flex items-center gap-2 text-gray-600">
                      <Check className="w-4 h-4" />
                      USED CODES ({usedCodes.length})
                    </h3>
                    <div className="space-y-2">
                      {usedCodes.slice(0, 10).map((code) => {
                        const maxUses = Number(code.maxUses) || 1
                        const usesCount = Number(code.usesCount) || 0
                        
                        return (
                          <div key={code.id} className="p-3 bg-gray-100 rounded border-2 border-gray-300 opacity-60">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-mono font-bold line-through">{code.code}</p>
                              <Badge variant="secondary" className="font-mono text-xs">
                                {usesCount}/{maxUses}
                              </Badge>
                            </div>
                            <div className="text-xs font-mono text-gray-600 space-y-0.5">
                              <p>Created: {new Date(code.createdAt).toLocaleString()}</p>
                              {code.usedAt && <p>Last used: {new Date(code.usedAt).toLocaleString()}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {usedCodes.length > 10 && (
                      <p className="text-xs text-gray-500 font-mono mt-2 text-center">
                        Showing 10 of {usedCodes.length} used codes
                      </p>
                    )}
                  </div>
                )}

                {inviteCodes.length === 0 && (
                  <div className="text-center py-12">
                    <Key className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-xl font-mono mb-2">No invite codes yet</p>
                    <p className="text-sm text-gray-600 mb-6 font-mono">
                      {authState.user?.username === 'jcb' ? 'Generate your first batch of invite codes' : 'Only admin user "jcb" can generate codes'}
                    </p>
                    {authState.user?.username === 'jcb' && (
                      <Button onClick={handleGenerateCodes} disabled={generating} className="font-mono">
                        {generating ? 'GENERATING...' : `GENERATE ${ADMIN_CODES_PER_EPOCH} CODES`}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="border-4 border-black">
              <CardHeader className="bg-black text-white border-b-4 border-black">
                <CardTitle className="font-mono flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  USER MANAGEMENT ({allUsers.length})
                </CardTitle>
                <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                  View and manage registered users
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {allUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded border-2 border-gray-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-bold">{u.username || 'Anonymous'}</p>
                          {Number(u.isAdmin) > 0 && (
                            <Badge className="bg-red-600 text-white font-mono text-xs">ADMIN</Badge>
                          )}
                          {u.username === 'jcb' && (
                            <Badge className="bg-purple-600 text-white font-mono text-xs">OWNER</Badge>
                          )}
                        </div>
                        <div className="text-xs font-mono text-gray-600 mt-1 space-y-0.5">
                          <p>ID: {u.id}</p>
                          <p>Email: {u.email || 'N/A'}</p>
                          <p>PoW Points: {Number(u.totalPowPoints) || 0}</p>
                          <p>Joined: {new Date(u.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {u.username === 'jcb' && (
                          <Button
                            onClick={() => navigate('/admin')}
                            variant="outline"
                            size="sm"
                            className="font-mono text-blue-600 hover:bg-blue-50"
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            ADMIN CP
                          </Button>
                        )}
                        {u.username !== 'jcb' && (
                          <Button
                            onClick={() => setDeleteDialog({ open: true, type: 'user', id: u.id, name: u.username || u.email || 'user' })}
                            variant="outline"
                            size="sm"
                            className="font-mono text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Boards Tab */}
          <TabsContent value="boards">
            <Card className="border-4 border-black">
              <CardHeader className="bg-black text-white border-b-4 border-black">
                <CardTitle className="font-mono flex items-center gap-2">
                  <Layout className="w-5 h-5" />
                  BOARD MANAGEMENT ({boards.length})
                </CardTitle>
                <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                  View and manage discussion boards
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {boards.map((board) => (
                    <div key={board.id} className="p-4 bg-gray-50 rounded border-2 border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-mono font-bold text-lg">/{board.slug}/</p>
                          <p className="font-mono text-sm">{board.name}</p>
                        </div>
                        {authState.user?.username === 'jcb' && (
                          <Button
                            onClick={() => setDeleteDialog({ open: true, type: 'board', id: board.id, name: board.name })}
                            variant="outline"
                            size="sm"
                            className="font-mono text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs font-mono text-gray-600 mb-2">
                        {board.description || 'No description'}
                      </p>
                      <div className="flex gap-4 text-xs font-mono text-gray-600">
                        <span>PoW: {Number(board.totalPow) || 0}</span>
                        <span>Created: {new Date(board.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools">
            <Card className="border-4 border-black">
              <CardHeader className="bg-black text-white border-b-4 border-black">
                <CardTitle className="font-mono">ADMIN TOOLS</CardTitle>
                <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                  System utilities and management
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => navigate('/seed')}
                    variant="outline"
                    className="font-mono border-2 border-black h-auto py-6"
                  >
                    <div className="text-left w-full">
                      <Database className="w-6 h-6 mb-2" />
                      <div className="font-bold">DATABASE SEED</div>
                      <div className="text-xs text-gray-600 mt-1">Initialize test data and seed boards</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => navigate('/images')}
                    variant="outline"
                    className="font-mono border-2 border-black h-auto py-6"
                  >
                    <div className="text-left w-full">
                      <Database className="w-6 h-6 mb-2" />
                      <div className="font-bold">IMAGE LIBRARY</div>
                      <div className="text-xs text-gray-600 mt-1">Manage uploaded images</div>
                    </div>
                  </Button>
                  <Button
                    onClick={loadAllData}
                    variant="outline"
                    className="font-mono border-2 border-black h-auto py-6"
                  >
                    <div className="text-left w-full">
                      <RefreshCw className="w-6 h-6 mb-2" />
                      <div className="font-bold">REFRESH ALL DATA</div>
                      <div className="text-xs text-gray-600 mt-1">Reload all statistics and data</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => navigate('/mine')}
                    variant="outline"
                    className="font-mono border-2 border-black h-auto py-6"
                  >
                    <div className="text-left w-full">
                      <Activity className="w-6 h-6 mb-2" />
                      <div className="font-bold">MINING INTERFACE</div>
                      <div className="text-xs text-gray-600 mt-1">Access proof-of-work mining</div>
                    </div>
                  </Button>
                </div>

                <div className="mt-6 bg-yellow-50 border-2 border-yellow-400 p-4 font-mono text-sm">
                  <div className="flex gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <p className="font-bold text-yellow-800">ADMIN WARNING:</p>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-yellow-700 text-xs">
                    <li>Deleting users will remove all their posts and threads</li>
                    <li>Deleting boards will remove all threads and posts within them</li>
                    <li>These actions cannot be undone - use with caution</li>
                    <li>Owner account (jcb) cannot be deleted</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent className="border-4 border-black font-mono">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                CONFIRM DELETION
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono">
                Are you sure you want to delete this {deleteDialog.type}?
                <span className="block mt-2 font-bold text-black">
                  {deleteDialog.name}
                </span>
                <span className="block mt-2 text-red-600 text-xs">
                  This action cannot be undone. All related data will be permanently removed.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono">CANCEL</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 font-mono"
              >
                DELETE
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
