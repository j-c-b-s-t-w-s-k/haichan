import { useState, useEffect } from 'react'
import { useMining } from '../hooks/use-mining'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { DiamondHashDisplay } from '../components/mining/DiamondHashDisplay'
import { RunoffPoWDisplay } from '../components/mining/RunoffPoWDisplay'
import { MultiplayerCanvas } from '../components/views/MultiplayerCanvas'
import { Pickaxe, Target, Trophy, Zap, Activity } from 'lucide-react'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import { getAllPowLevels, getSavedPowLevel, savePowLevel, PowLevel } from '../lib/pow-config'

export function MinePage() {
  const { authState } = useAuth()
  const { dedicatedSession, startDedicatedMining, stopDedicatedMining } = useMining()
  const [targetType, setTargetType] = useState<'user' | 'thread' | 'post' | 'blog'>('user')
  const [targetId, setTargetId] = useState('')
  const [powLevel, setPowLevel] = useState<PowLevel>(getSavedPowLevel())
  const [threads, setThreads] = useState<any[]>([])
  const [blogs, setBlogs] = useState<any[]>([])
  const [hashLog, setHashLog] = useState<Array<{ hash: string; points: number; timestamp: number }>>([])
  const [hashRate, setHashRate] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  // Get rolling hash rate from worker
  useEffect(() => {
    if (dedicatedSession?.currentProgress?.hashRate !== undefined) {
      setHashRate(dedicatedSession.currentProgress.hashRate)
    }
  }, [dedicatedSession?.currentProgress?.hashRate])

  // Add to hash log when new hash is found
  useEffect(() => {
    if (dedicatedSession?.currentProgress?.hash) {
      setHashLog(prev => {
        const newEntry = {
          hash: dedicatedSession.currentProgress!.hash,
          points: dedicatedSession.currentProgress!.points,
          timestamp: Date.now()
        }
        const updated = [newEntry, ...prev].slice(100) // Keep last 100
        return updated
      })
    }
  }, [dedicatedSession?.currentProgress?.hash])

  const loadData = async () => {
    try {
      if (authState.user?.id) {
        // Load user's threads
        const userThreads = await db.db.threads.list({
          where: { userId: authState.user.id },
          orderBy: { createdAt: 'desc' },
          limit: 20
        })
        setThreads(userThreads)

        // Load user's blogs
        const userBlogs = await db.db.blogPosts.list({
          where: { userId: authState.user.id },
          orderBy: { createdAt: 'desc' },
          limit: 20
        })
        setBlogs(userBlogs)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  const handleStartMining = async () => {
    if (dedicatedSession) {
      console.log('[MinePage] Stopping dedicated mining')
      stopDedicatedMining()
      setHashLog([])
      setHashRate(0)
    } else {
      const id = targetType === 'user' ? undefined : targetId
      console.log('[MinePage] Starting dedicated mining:', { targetType, id, points: powLevel.points, prefix: powLevel.prefix })
      savePowLevel(powLevel)
      try {
        await startDedicatedMining(targetType, id, powLevel.points, powLevel.prefix)
        console.log('[MinePage] ✓ Dedicated mining started successfully')
      } catch (error) {
        console.error('[MinePage] Failed to start dedicated mining:', error)
      }
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 font-mono flex items-center gap-3">
          <Pickaxe className="w-10 h-10" />
          MINING STATION
        </h1>
        <p className="text-muted-foreground">
          Mine proof-of-work for your account, threads, posts, or blogs. Adjust PoW difficulty to {powLevel.prefix} or customize below.
        </p>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border-2 border-blue-600 text-sm font-mono">
          <span className="font-bold">💡 Quick Tip:</span> Press <kbd className="px-2 py-1 mx-1 bg-white dark:bg-gray-800 border-2 border-blue-600 rounded text-blue-600 font-bold">M</kbd> anywhere on the site to toggle dedicated mining on/off!
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mining Control */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono">
                <Target className="w-5 h-5" />
                Mining Configuration
              </CardTitle>
              <CardDescription>
                Select what you want to mine for and start the mining process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs value={targetType} onValueChange={(v) => setTargetType(v as any)}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="user" className="font-mono">USER</TabsTrigger>
                  <TabsTrigger value="thread" className="font-mono">THREAD</TabsTrigger>
                  <TabsTrigger value="post" className="font-mono">POST</TabsTrigger>
                  <TabsTrigger value="blog" className="font-mono">BLOG</TabsTrigger>
                </TabsList>

                <TabsContent value="user" className="space-y-4">
                  <div className="text-sm text-muted-foreground p-4 border-2 border-dashed">
                    Mine PoW directly to your personal diamond hash. Runoff mining when not actively mining other targets.
                  </div>
                </TabsContent>

                <TabsContent value="thread" className="space-y-4">
                  <div>
                    <Label htmlFor="thread-select" className="font-mono">Select Thread</Label>
                    <Select value={targetId} onValueChange={setTargetId}>
                      <SelectTrigger id="thread-select">
                        <SelectValue placeholder="Choose a thread to mine for" />
                      </SelectTrigger>
                      <SelectContent>
                        {threads.map((thread) => (
                          <SelectItem key={thread.id} value={thread.id}>
                            {thread.title} (PoW: {thread.totalPow || 0})
                          </SelectItem>
                        ))}
                        {threads.length === 0 && (
                          <SelectItem value="none" disabled>No threads found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="post" className="space-y-4">
                  <div>
                    <Label htmlFor="post-id" className="font-mono">Post ID</Label>
                    <Input
                      id="post-id"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      placeholder="Enter post ID to mine for"
                      className="font-mono"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="blog" className="space-y-4">
                  <div>
                    <Label htmlFor="blog-select" className="font-mono">Select Blog Post</Label>
                    <Select value={targetId} onValueChange={setTargetId}>
                      <SelectTrigger id="blog-select">
                        <SelectValue placeholder="Choose a blog to mine for" />
                      </SelectTrigger>
                      <SelectContent>
                        {blogs.map((blog) => (
                          <SelectItem key={blog.id} value={blog.id}>
                            {blog.title} (PoW: {blog.totalPow || 0})
                          </SelectItem>
                        ))}
                        {blogs.length === 0 && (
                          <SelectItem value="none" disabled>No blogs found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <div>
                <Label htmlFor="pow-level" className="font-mono">PoW Difficulty Level</Label>
                <Select value={powLevel.prefix} onValueChange={(prefix) => {
                  const level = getAllPowLevels().find(l => l.prefix === prefix)
                  if (level) setPowLevel(level)
                }}>
                  <SelectTrigger id="pow-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAllPowLevels().map((level) => (
                      <SelectItem key={level.prefix} value={level.prefix}>
                        {level.name} ({level.points} pts) - {level.prefix}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted border">
                  <div><strong>Prefix:</strong> {powLevel.prefix}</div>
                  <div><strong>Points:</strong> {powLevel.points}</div>
                  <div><strong>Description:</strong> {powLevel.description}</div>
                </div>
              </div>

              <Button
                onClick={handleStartMining}
                size="lg"
                className="w-full font-mono text-lg"
                variant={dedicatedSession ? 'destructive' : 'default'}
              >
                {dedicatedSession ? (
                  <>
                    <Zap className="w-5 h-5 mr-2 animate-pulse" />
                    STOP MINING
                  </>
                ) : (
                  <>
                    <Pickaxe className="w-5 h-5 mr-2" />
                    START MINING
                  </>
                )}
              </Button>

              {dedicatedSession?.currentProgress && (
                <div className="space-y-4">
                  {/* Real-time Stats */}
                  <div className="p-4 bg-muted border-2 border-foreground space-y-3 font-mono">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 animate-pulse" />
                      <span className="text-sm font-bold">LIVE MINING STATS (ROLLING HASH RATE)</span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">HASH/SEC</div>
                        <div className="text-2xl font-bold">{hashRate.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">POINTS</div>
                        <div className="text-2xl font-bold">{dedicatedSession.currentProgress.points}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">ZEROS</div>
                        <div className="text-2xl font-bold">{dedicatedSession.currentProgress.trailingZeros}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">TOTAL</div>
                        <div className="text-2xl font-bold">{dedicatedSession.currentProgress.attempts.toLocaleString()}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">CURRENT BEST HASH</div>
                      <div className="text-[10px] break-all bg-background p-2 border font-mono">
                        {dedicatedSession.currentProgress.hash}
                      </div>
                    </div>
                  </div>

                  {/* Hash Log */}
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-mono">HASH LOG (Last 100)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-[10px]">
                        {hashLog.length === 0 ? (
                          <div className="text-muted-foreground text-center py-4">
                            Hashes will appear here as mining progresses...
                          </div>
                        ) : (
                          hashLog.map((entry, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 border border-foreground/20 hover:bg-muted"
                            >
                              <div className="flex-1 break-all mr-2">
                                <span className={entry.points >= 15 ? 'text-green-600 font-bold' : ''}>
                                  {entry.hash}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-bold text-xs">
                                  {entry.points} pts
                                </span>
                                <span className="text-muted-foreground text-[9px]">
                                  {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Diamond Hash Display */}
        <div className="space-y-4">
          <RunoffPoWDisplay />
          <DiamondHashDisplay />
        </div>
      </div>

      {/* Multiplayer Canvas Section */}
      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Pickaxe className="w-6 h-6" />
            MINER DOODLE SESSION
          </h2>
          <p className="text-muted-foreground text-sm">
            Collaborate with other miners in real-time. Record your session and export to library or GIF.
          </p>
        </div>
        <MultiplayerCanvas />
      </div>
    </div>
  )
}
