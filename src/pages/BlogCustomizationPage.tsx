import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { ArrowLeft, Palette, Save } from 'lucide-react'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { BLOG_FONT_OPTIONS } from '../lib/rich-text'

export function BlogCustomizationPage() {
  const { authState } = useAuth()
  const [blogName, setBlogName] = useState('')
  const [themeFont, setThemeFont] = useState('mono')
  const [themeColor, setThemeColor] = useState('#000000')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadUserSettings()
  }, [authState.user?.id])

  const loadUserSettings = async () => {
    try {
      if (!authState.user?.id) {
        return
      }
      
      const userRecords = await db.db.users.list({
        where: { id: authState.user.id }
      })
      
      if (userRecords.length > 0) {
          
        // Try to load existing blog customization from any published blog post
        const userBlogs = await db.db.blogPosts.list({
          where: { userId: authState.user.id },
          orderBy: { createdAt: 'desc' },
          limit: 1
        })
        
        if (userBlogs.length > 0) {
          const lastBlog = userBlogs[0]
          setBlogName(lastBlog.blogName || '')
          setThemeFont(lastBlog.themeFont || 'mono')
          setThemeColor(lastBlog.themeColor || '#000000')
        }
      }
    } catch (error) {
      toast.error('Please log in first')
      navigate('/login')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!authState.user?.id) {
      toast.error('User not authenticated')
      return
    }

    setLoading(true)

    try {
      // Update all user's blog posts with new settings
      const userBlogs = await db.db.blogPosts.list({
        where: { userId: authState.user.id }
      })

      // Update each blog post
      for (const blog of userBlogs) {
        await db.db.blogPosts.update(blog.id, {
          blogName: blogName.trim() || null,
          themeFont: themeFont,
          themeColor: themeColor
        })
      }

      toast.success('Blog customization saved!')
      
      // Navigate to user's blog page
      setTimeout(() => {
        navigate(`/blog/user/${user.username}`)
      }, 500)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save customization')
      console.error('Error saving customization:', error)
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
            <Palette className="w-8 h-8" />
            <div>
              <CardTitle className="text-3xl font-bold font-mono">BLOG CUSTOMIZATION</CardTitle>
              <CardDescription className="font-mono mt-2">
                Customize the appearance of your blog. Changes apply to all your blog posts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <Label htmlFor="blogName" className="font-mono">
                BLOG NAME (Optional)
              </Label>
              <Input
                id="blogName"
                type="text"
                value={blogName}
                onChange={(e) => setBlogName(e.target.value)}
                className="font-mono mt-2 border-2"
                placeholder="e.g., 'My Tech Blog', 'Random Thoughts'..."
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground font-mono mt-2">
                Give your blog a unique name that appears on all your posts
              </p>
            </div>

            <div>
              <Label htmlFor="themeFont" className="font-mono">
                FONT STYLE
              </Label>
              <Select value={themeFont} onValueChange={setThemeFont} disabled={loading}>
                <SelectTrigger id="themeFont" className="font-mono mt-2 border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_FONT_OPTIONS.map((font) => (
                    <SelectItem 
                      key={font.value} 
                      value={font.value}
                      style={{ fontFamily: font.family }}
                    >
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground font-mono mt-2">
                Choose a font style for your blog posts
              </p>
            </div>

            <div>
              <Label htmlFor="themeColor" className="font-mono">
                ACCENT COLOR
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="themeColor"
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-20 h-10 border-2 cursor-pointer"
                  disabled={loading}
                />
                <Input
                  type="text"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="font-mono border-2 flex-1"
                  placeholder="#000000"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-2">
                Choose a color for links and accents
              </p>
            </div>

            {/* Preview Section */}
            <div className="border-2 p-6 space-y-4">
              <h3 className="font-mono font-bold mb-4">PREVIEW</h3>
              
              {blogName && (
                <div 
                  className="text-sm font-bold mb-2 uppercase tracking-wider"
                  style={{ 
                    fontFamily: BLOG_FONT_OPTIONS.find(f => f.value === themeFont)?.family,
                    color: themeColor 
                  }}
                >
                  {blogName}
                </div>
              )}
              
              <h2 
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: BLOG_FONT_OPTIONS.find(f => f.value === themeFont)?.family }}
              >
                Sample Blog Post Title
              </h2>
              
              <p 
                className="text-sm"
                style={{ fontFamily: BLOG_FONT_OPTIONS.find(f => f.value === themeFont)?.family }}
              >
                This is how your blog posts will look with the selected font and color scheme.{' '}
                <a href="#" style={{ color: themeColor, textDecoration: 'underline' }}>
                  This is a link
                </a>{' '}
                and this is regular text.
              </p>
            </div>

            <div className="bg-muted border-2 border-dashed p-4 rounded font-mono text-sm">
              <p className="font-bold mb-2">INFO:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>These settings apply to ALL your blog posts</li>
                <li>Changes take effect immediately</li>
                <li>You can update these settings anytime</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                className="font-mono flex-1"
                disabled={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'SAVING...' : 'SAVE CUSTOMIZATION'}
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
