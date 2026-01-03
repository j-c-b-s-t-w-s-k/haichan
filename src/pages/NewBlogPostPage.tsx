import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { BookOpen, ArrowLeft, Settings, Shuffle, Bold, Italic, Link2, Image as ImageIcon, Zap } from 'lucide-react'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

const RANDOM_TITLES = [
  "The Mystery of the Midnight Code",
  "Reflections from the Digital Void",
  "Tales from the Command Line",
  "Observations on the Network",
  "Musings in Binary",
  "The Hacker's Diary",
  "Chronicles of the Terminal",
  "Thoughts in Monospace",
  "Notes from the Matrix",
  "Dispatches from Cyberspace"
]

export function NewBlogPostPage() {
  const { authState } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [blogSettings, setBlogSettings] = useState<any>({ blogName: '', themeFont: 'mono', themeColor: '#000000' })
  const [mining, setMining] = useState(false)
  const [miningProgress, setMiningProgress] = useState(0)
  const [uploadingImage, setUploadingImage] = useState(false)
  const navigate = useNavigate()

  // Session persistence for content
  useEffect(() => {
    const savedContent = sessionStorage.getItem('newblogpost')
    if (savedContent) {
      try {
        const parsed = JSON.parse(savedContent)
        setTitle(parsed.title || '')
        setContent(parsed.content || '')
      } catch (e) {
        console.error('Failed to restore session:', e)
      }
    }
  }, [])

  // Save content to session on change
  useEffect(() => {
    if (title || content) {
      sessionStorage.setItem('newblogpost', JSON.stringify({ title, content }))
    }
  }, [title, content])

  useEffect(() => {
    getUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getUser = async () => {
    try {
      // Use authState from context instead of fetching
      if (authState.user?.id) {
        const userRecords = await db.db.users.list({
          where: { id: authState.user.id }
        })
        
        if (userRecords.length > 0) {
          // Merge auth user with DB user to get username
          setUser({
            ...authState.user,
            username: userRecords[0].username || userRecords[0].displayName || 'Anonymous'
          })
          
          // Load existing blog settings from user's previous posts
          const existingBlogs = await db.db.blogPosts.list({
            where: { userId: authState.user.id },
            orderBy: { createdAt: 'desc' },
            limit: 1
          })
          
          if (existingBlogs.length > 0) {
            const lastBlog = existingBlogs[0]
            setBlogSettings({
              blogName: lastBlog.blogName || '',
              themeFont: lastBlog.themeFont || 'mono',
              themeColor: lastBlog.themeColor || '#000000'
            })
          }
        } else {
          setUser(authState.user)
        }
      } else {
        setUser(authState.user)
      }
    } catch (error) {
      toast.error('Please log in first')
      navigate('/login')
    }
  }

  const generateRandomTitle = () => {
    const randomTitle = RANDOM_TITLES[Math.floor(Math.random() * RANDOM_TITLES.length)]
    setTitle(randomTitle)
    toast.success('Random title generated!')
  }

  const quickMine = async () => {
    setMining(true)
    setMiningProgress(0)
    
    try {
      // Simulate quick mining puzzle (simple PoW)
      const challenge = Math.random().toString(36).substring(2, 15)
      let nonce = 0
      let hash = ''
      let found = false
      
      // Find hash starting with "21e" (easier than 21e8)
      while (!found && nonce < 10000) {
        hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(challenge + nonce))
          .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
        
        if (hash.startsWith('21e')) {
          found = true
          toast.success(`Quick PoW solved! Hash: ${hash.substring(0, 8)}...`)
        }
        nonce++
        
        if (nonce % 100 === 0) {
          setMiningProgress(Math.min((nonce / 10000) * 100, 95))
        }
      }
      
      if (!found) {
        toast('Puzzle timeout - continue anyway', { icon: '⏱️' })
      }
      
      setMiningProgress(100)
    } catch (error) {
      console.error('Mining error:', error)
      toast.error('Mining failed')
    } finally {
      setTimeout(() => {
        setMining(false)
        setMiningProgress(0)
      }, 500)
    }
  }

  const insertFormatting = (format: 'bold' | 'italic' | 'link') => {
    const textarea = document.getElementById('content') as HTMLTextAreaElement
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const beforeText = content.substring(0, start)
    const afterText = content.substring(end)
    
    let newText = ''
    let cursorOffset = 0
    
    switch (format) {
      case 'bold':
        newText = `**${selectedText || 'bold text'}**`
        cursorOffset = selectedText ? newText.length : 2
        break
      case 'italic':
        newText = `*${selectedText || 'italic text'}*`
        cursorOffset = selectedText ? newText.length : 1
        break
      case 'link':
        newText = `[${selectedText || 'link text'}](https://example.com)`
        cursorOffset = selectedText ? newText.length : 1
        break
    }
    
    setContent(beforeText + newText + afterText)
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset)
    }, 0)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    
    setUploadingImage(true)
    
    try {
      const randomId = Math.random().toString(36).substring(2, 15)
      const ext = file.name.split('.').pop()
      const filename = `blog-images/${user.id}/${Date.now()}-${randomId}.${ext}`
      
      const { publicUrl } = await db.storage.upload(file, filename, { upsert: true })
      
      // Insert image markdown at cursor position
      const textarea = document.getElementById('content') as HTMLTextAreaElement
      const cursorPos = textarea?.selectionStart || content.length
      const imageMarkdown = `\n![Image](${publicUrl})\n`
      const newContent = content.substring(0, cursorPos) + imageMarkdown + content.substring(cursorPos)
      setContent(newContent)
      
      toast.success('Image uploaded!')
    } catch (error) {
      console.error('Image upload failed:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!content.trim()) {
      toast.error('Content is required')
      return
    }

    setLoading(true)

    try {
      // Ensure we have the username from the user object
      const authorUsername = user.username || user.displayName || 'Anonymous'
      
      const newBlogPost = await db.db.blogPosts.create({
        userId: user.id,
        authorUsername: authorUsername,
        title: title.trim(),
        content: content.trim(),
        blogName: blogSettings.blogName || null,
        themeFont: blogSettings.themeFont || 'mono',
        themeColor: blogSettings.themeColor || '#000000',
        published: "1",
        totalPow: 0,
        powHash: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      // Clear session storage on successful submission
      sessionStorage.removeItem('newblogpost')

      toast.success('Blog post created successfully!')
      
      // Navigate to user's blog page after a short delay
      setTimeout(() => {
        navigate(`/blog/user/${user.username}`)
      }, 500)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create blog post')
      console.error('Error creating blog post:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-muted-foreground">Verifying authentication</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/blog/user/${user.username}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO MY BLOG
        </button>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8" />
            <div>
              <CardTitle className="text-3xl font-bold font-mono">NEW BLOG POST</CardTitle>
              <CardDescription className="font-mono mt-2">
                Create a new blog post. Mining will start automatically when posted.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="title" className="font-mono">
                  TITLE *
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateRandomTitle}
                  className="font-mono text-xs"
                  disabled={loading}
                >
                  <Shuffle className="w-3 h-3 mr-1" />
                  Random
                </Button>
              </div>
              <Input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-mono border-2"
                placeholder="Enter blog post title..."
                required
                disabled={loading}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="content" className="font-mono">
                  CONTENT *
                </Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertFormatting('bold')}
                    className="font-mono text-xs p-1 h-7"
                    disabled={loading}
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertFormatting('italic')}
                    className="font-mono text-xs p-1 h-7"
                    disabled={loading}
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertFormatting('link')}
                    className="font-mono text-xs p-1 h-7"
                    disabled={loading}
                    title="Link"
                  >
                    <Link2 className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    className="font-mono text-xs p-1 h-7"
                    disabled={loading || uploadingImage}
                    title="Upload Image"
                  >
                    <ImageIcon className="w-3 h-3" />
                  </Button>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono border-2 min-h-96"
                placeholder="Enter your blog post content...\n\nFormatting:\n**bold** *italic* [link](url) ![image](url)\n\nYouTube links will be automatically embedded"
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground font-mono mt-2">
                {content.length} / 10000 characters
              </p>
            </div>

            <div className="bg-muted border-2 border-dashed p-4 rounded font-mono text-sm space-y-3">
              <div>
                <p className="font-bold mb-2">INFO:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                  <li>Your blog post will be published immediately upon creation</li>
                  <li>Mouseover the post to start mining proof-of-work</li>
                  <li>Posts are ranked by total proof-of-work accumulated</li>
                  <li>Want to customize your blog appearance? Visit <button onClick={() => navigate('/blog/customize')} className="underline">Blog Customization</button></li>
                </ul>
              </div>
              <div className="border-t pt-3">
                <p className="font-bold mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  QUICK MINING:
                </p>
                <p className="text-muted-foreground text-xs mb-2">
                  Solve a quick PoW puzzle to boost your post (optional)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={quickMine}
                  disabled={mining || loading}
                  className="font-mono w-full"
                >
                  {mining ? `MINING... ${miningProgress.toFixed(0)}%` : 'START QUICK MINE'}
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                className="font-mono flex-1"
                disabled={loading}
              >
                {loading ? 'CREATING...' : 'CREATE POST'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="font-mono"
                onClick={() => navigate('/blog/customize')}
                disabled={loading}
              >
                <Settings className="w-4 h-4 mr-2" />
                CUSTOMIZE
              </Button>
              <Button
                type="button"
                variant="outline"
                className="font-mono"
                onClick={() => navigate(`/blog/user/${user.username}`)}
                disabled={loading}
              >
                CANCEL
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
