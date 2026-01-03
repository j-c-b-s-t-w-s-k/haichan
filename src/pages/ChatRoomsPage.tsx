import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import { Plus, Users, Link2, Copy, Trash2, Settings } from 'lucide-react'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

interface ChatRoom {
  id: string
  userId: string
  name: string
  description?: string
  isPublic: number
  maxUsers: number
  createdAt: string
}

interface RoomInvite {
  id: string
  roomId: string
  inviteCode: string
  maxUses: number
  usesCount: number
  expiresAt?: string
}

interface RoomMember {
  id: string
  roomId: string
  userId: string
  joinedAt: string
  isAdmin: number
}

export function ChatRoomsPage() {
  const { authState } = useAuth()
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [myRooms, setMyRooms] = useState<ChatRoom[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([])
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [inviteMaxUses, setInviteMaxUses] = useState('1')

  // Form state for creating rooms
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIsPublic, setFormIsPublic] = useState(false)
  const [formMaxUsers, setFormMaxUsers] = useState('256')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      if (!authState.user) return

      setUser(authState.user)

      // Load user's rooms
      const userRooms = await db.db.chatRooms.list({
        where: { userId: authState.user.id },
        orderBy: { createdAt: 'desc' }
      })
      setMyRooms(userRooms)

      // Load public rooms
      const publicRooms = await db.db.chatRooms.list({
        where: { isPublic: 1 },
        orderBy: { createdAt: 'desc' },
        limit: 50
      })
      setRooms(publicRooms)
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!formName.trim()) {
      toast.error('Room name is required')
      return
    }

    if (!user) {
      toast.error('Not authenticated')
      return
    }

    try {
      setCreating(true)

      const newRoom = await db.db.chatRooms.create({
        userId: user.id,
        name: formName,
        description: formDescription,
        isPublic: formIsPublic ? 1 : 0,
        maxUsers: Number(formMaxUsers) || 256
      })

      // Add creator as admin member
      await db.db.roomMembers.create({
        roomId: newRoom.id,
        userId: user.id,
        isAdmin: 1
      })

      toast.success('Room created successfully!')
      setFormName('')
      setFormDescription('')
      setFormIsPublic(false)
      setFormMaxUsers('256')
      setShowCreateDialog(false)

      await loadData()
    } catch (error) {
      console.error('Failed to create room:', error)
      toast.error('Failed to create room')
    } finally {
      setCreating(false)
    }
  }

  const handleGenerateInvite = async (room: ChatRoom) => {
    if (!user) return

    try {
      // Generate random invite code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()

      await db.db.roomInvites.create({
        roomId: room.id,
        createdBy: user.id,
        inviteCode: code,
        maxUses: Number(inviteMaxUses) || 1
      })

      setInviteCode(code)
      toast.success('Invite code generated!')
      await loadRoomDetails(room)
    } catch (error) {
      console.error('Failed to generate invite:', error)
      toast.error('Failed to generate invite')
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return

    try {
      // Delete room members
      const members = await db.db.roomMembers.list({
        where: { roomId }
      })
      for (const member of members) {
        await db.db.roomMembers.delete(member.id)
      }

      // Delete invites
      const invites = await db.db.roomInvites.list({
        where: { roomId }
      })
      for (const inv of invites) {
        await db.db.roomInvites.delete(inv.id)
      }

      // Delete room
      await db.db.chatRooms.delete(roomId)

      toast.success('Room deleted')
      await loadData()
    } catch (error) {
      console.error('Failed to delete room:', error)
      toast.error('Failed to delete room')
    }
  }

  const loadRoomDetails = async (room: ChatRoom) => {
    try {
      setSelectedRoom(room)

      // Load invites
      const invites = await db.db.roomInvites.list({
        where: { roomId: room.id }
      })
      setRoomInvites(invites)

      // Load members
      const members = await db.db.roomMembers.list({
        where: { roomId: room.id }
      })
      setRoomMembers(members)
    } catch (error) {
      console.error('Failed to load room details:', error)
    }
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Invite code copied!')
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 font-mono flex items-center gap-3">
          <Users className="w-10 h-10" />
          CHAT ROOMS
        </h1>
        <p className="text-muted-foreground">
          Create and manage chat rooms. Generate invites to bring others into your community.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Loading rooms...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Room Card */}
          <Card className="border-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono">
                <Plus className="w-5 h-5" />
                CREATE ROOM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="w-full font-mono"
              >
                New Room
              </Button>
            </CardContent>
          </Card>

          {/* My Rooms */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-xl font-bold font-mono mb-4">MY ROOMS ({myRooms.length})</h2>
              {myRooms.length === 0 ? (
                <div className="text-muted-foreground font-mono text-sm">
                  You haven't created any rooms yet
                </div>
              ) : (
                <div className="space-y-3">
                  {myRooms.map(room => (
                    <Card key={room.id} className="border-2">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold font-mono">{room.name}</h3>
                            {room.description && (
                              <p className="text-sm text-muted-foreground">{room.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                loadRoomDetails(room)
                                setShowInviteDialog(true)
                              }}
                            >
                              <Link2 className="w-3 h-3 mr-1" />
                              Invite
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteRoom(room.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <Badge variant="secondary">
                            {Number(room.maxUsers)} max users
                          </Badge>
                          {Number(room.isPublic) > 0 && (
                            <Badge variant="secondary">PUBLIC</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
            <DialogDescription>
              Create a new chat room for your community
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="room-name" className="font-mono">Room Name *</Label>
              <Input
                id="room-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My Awesome Room"
                className="font-mono"
              />
            </div>

            <div>
              <Label htmlFor="room-desc" className="font-mono">Description</Label>
              <Textarea
                id="room-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What is this room about?"
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="max-users" className="font-mono">Max Users</Label>
              <Input
                id="max-users"
                type="number"
                value={formMaxUsers}
                onChange={(e) => setFormMaxUsers(e.target.value)}
                min="2"
                max="1000"
                className="font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is-public"
                checked={formIsPublic}
                onCheckedChange={setFormIsPublic}
              />
              <Label htmlFor="is-public" className="font-mono cursor-pointer">
                Make Public (visible to everyone)
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreateDialog(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 font-mono"
                onClick={handleCreateRoom}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Room'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="font-mono max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRoom?.name} - Invites</DialogTitle>
            <DialogDescription>
              Manage invites for this room
            </DialogDescription>
          </DialogHeader>

          {selectedRoom && (
            <div className="space-y-6">
              {/* Generate New Invite */}
              <div className="border-2 border-dashed p-4">
                <h3 className="font-bold mb-3">Generate New Invite</h3>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Max Uses</Label>
                    <Input
                      type="number"
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(e.target.value)}
                      min="1"
                      placeholder="1"
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    className="self-end font-mono"
                    onClick={() => handleGenerateInvite(selectedRoom)}
                  >
                    Generate
                  </Button>
                </div>
              </div>

              {/* Active Invites */}
              <div>
                <h3 className="font-bold mb-3">Active Invites</h3>
                {roomInvites.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No active invites</div>
                ) : (
                  <div className="space-y-2">
                    {roomInvites.map(invite => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-2 border border-foreground/30"
                      >
                        <div className="flex-1">
                          <div className="font-mono font-bold">{invite.inviteCode}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {invite.usesCount} / {invite.maxUses} uses
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteCode(invite.inviteCode)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Members */}
              <div>
                <h3 className="font-bold mb-3">Members ({roomMembers.length}/{selectedRoom.maxUsers})</h3>
                {roomMembers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No members yet</div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {roomMembers.map(member => (
                      <div
                        key={member.id}
                        className="text-xs p-1 border-b border-foreground/20 flex items-center justify-between"
                      >
                        <span>{member.userId}</span>
                        {Number(member.isAdmin) > 0 && (
                          <Badge variant="secondary" className="text-[8px]">ADMIN</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full font-mono"
                onClick={() => setShowInviteDialog(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
