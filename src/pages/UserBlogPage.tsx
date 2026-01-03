import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { BookOpen, Plus, TrendingUp, User, Settings, Shuffle } from 'lucide-react'
import { useMouseoverMining } from '../hooks/use-mining'
import db from '../lib/db-client'
import { getFontFamily } from '../lib/rich-text'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

function BlogCard({ blog }: { blog: any }) {
  const { useAttachTo } = useMouseoverMining('blog', blog.id)
  const elementRef = useRef<HTMLDivElement>(null)
  const fontFamily = getFontFamily(blog.themeFont || 'mono')
  const accentColor = blog.themeColor || '#000000'

  useEffect(() => {
    if (elementRef.current) {
      const cleanup = useAttachTo(elementRef.current)
      return cleanup
    }
  }, [useAttachTo])

  return (
    <Card
      ref={elementRef}
      className="border-2 hover:border-foreground transition-colors"
    >
      <CardHeader>
        {blog.blogName && (
          <div 
            className="text-xs font-bold mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily,
              color: accentColor 
            }}
          >
            {blog.blogName}
          </div>
        )}
        <CardTitle 
          className="text-xl mb-2"
          style={{ fontFamily }}
        >
          {blog.title}
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <User className="w-3 h-3" />
          <span>{blog.authorUsername || 'Anonymous'}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p 
          className="text-sm text-muted-foreground mb-4 line-clamp-3"
          style={{ fontFamily }}
        >
          {blog.content.substring(0, 200)}...
        </p>
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="font-bold">{blog.totalPow || 0}</span>
            <span className="text-muted-foreground">PoW</span>
          </div>
          <Link to={`/blog/${blog.id}`}>
            <Button 
              variant="outline" 
              size="sm" 
              className="font-mono"
              style={{ 
                borderColor: accentColor,
                color: accentColor
              }}
            >
              READ MORE
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function UserBlogPage() {
  const { username } = useParams<{ username: string }>()
  const { authState } = useAuth()
  const [blogs, setBlogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [blogOwner, setBlogOwner] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (username) {
      loadUserBlog()
    }
  }, [username])

  const loadCurrentUser = async () => {
    try {
      if (authState.user?.id) {
        const userRecords = await db.db.users.list({
          where: { id: authState.user.id }
        })
        if (userRecords.length > 0) {
          setCurrentUser({
            ...authState.user,
            username: userRecords[0].username || authState.user.displayName || 'Anonymous'
          })
        }
      }
    } catch (error) {
      console.error('Failed to load current user:', error)
    }
  }

  const loadUserBlog = async () => {
    try {
      // Find the user by username
      const users = await db.db.users.list({
        where: { username }
      })

      if (users.length === 0) {
        toast.error('User not found')
        navigate('/blogs')
        return
      }

      const owner = users[0]
      setBlogOwner(owner)

      // Load their blog posts
      const userBlogs = await db.db.blogPosts.list({
        where: { 
          userId: owner.id,
          published: "1" 
        },
        orderBy: { createdAt: 'desc' }
      })

      setBlogs(userBlogs)
    } catch (error) {
      console.error('Failed to load user blog:', error)
      toast.error('Failed to load blog')
    } finally {
      setLoading(false)
    }
  }

  const goToRandomBlog = async () => {
    try {
      // Get all users with published blogs
      const allBlogs = await db.db.blogPosts.list({
        where: { published: "1" }
      })

      if (allBlogs.length === 0) {
        navigate('/blogs')
        return
      }

      // Get unique usernames
      const uniqueUsernames = Array.from(new Set(allBlogs.map(b => b.authorUsername).filter(Boolean)))
      
      // Filter out current user's blog
      const otherUsernames = uniqueUsernames.filter(u => u !== username)

      if (otherUsernames.length === 0) {
        toast.error('No other active blogs found')
        navigate('/blogs')
        return
      }

      // Pick a random username
      const randomUsername = otherUsernames[Math.floor(Math.random() * otherUsernames.length)]
      navigate(`/blog/user/${randomUsername}`)
    } catch (error) {
      console.error('Failed to find random blog:', error)
      toast.error('Failed to find random blog')
    }
  }

  const isOwnBlog = currentUser?.username === username

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-muted-foreground">Fetching blog</div>
        </div>
      </div>
    )
  }

  // Empty blog state
  if (blogs.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 font-mono flex items-center gap-3">
              <BookOpen className="w-10 h-10" />
              {username?.toUpperCase()}'S BLOG
            </h1>
            <p className="text-muted-foreground">
              Personal blog by {username}
            </p>
          </div>
        </div>

        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-20 h-20 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-mono font-bold mb-2">
              {username} hasn't started {isOwnBlog ? 'your' : 'their'} blog yet
            </h2>
            <p className="text-muted-foreground mb-6 text-center">
              {isOwnBlog ? (
                'Create your first blog post to get started'
              ) : (
                'Want to read an active blog?'
              )}
            </p>
            
            {isOwnBlog ? (
              <div className="flex gap-4">
                <Button 
                  className="font-mono"
                  onClick={() => navigate('/blogs/new')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  CREATE FIRST POST
                </Button>
                <Button 
                  variant="outline"
                  className="font-mono"
                  onClick={() => navigate('/blog/customize')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  CUSTOMIZE BLOG
                </Button>
              </div>
            ) : (
              <Button 
                className="font-mono"
                onClick={goToRandomBlog}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                READ A RANDOM BLOG
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get blog name from first post if available
  const blogName = blogs.length > 0 && blogs[0].blogName ? blogs[0].blogName : null

  // Blog with posts
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 font-mono flex items-center gap-3">
            <BookOpen className="w-10 h-10" />
            {blogName || `${username?.toUpperCase()}'S BLOG`}
          </h1>
          <p className="text-muted-foreground">
            {blogs.length} post{blogs.length !== 1 ? 's' : ''} • Total PoW: {blogs.reduce((sum, b) => sum + (b.totalPow || 0), 0)}
          </p>
        </div>
        
        {isOwnBlog && (
          <div className="flex gap-2">
            <Button 
              variant="outline"
              className="font-mono"
              onClick={() => navigate('/blog/customize')}
            >
              <Settings className="w-4 h-4 mr-2" />
              CUSTOMIZE
            </Button>
            <Button 
              className="font-mono"
              onClick={() => navigate('/blogs/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              NEW POST
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {blogs.map((blog) => (
          <BlogCard key={blog.id} blog={blog} />
        ))}
      </div>

      {/* Navigate to other blogs */}
      <div className="mt-8 flex justify-center">
        <Button 
          variant="outline"
          className="font-mono"
          onClick={goToRandomBlog}
        >
          <Shuffle className="w-4 h-4 mr-2" />
          READ A RANDOM BLOG
        </Button>
      </div>
    </div>
  )
}
