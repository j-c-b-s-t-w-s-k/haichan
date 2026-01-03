import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { ArrowLeft, TrendingUp, User, Calendar } from 'lucide-react'
import { useMouseoverMining } from '../hooks/use-mining'
import db from '../lib/db-client'
import { processRichText, getFontFamily } from '../lib/rich-text'
import toast from 'react-hot-toast'

export function BlogPostPage() {
  const { id } = useParams<{ id: string }>()
  const [blog, setBlog] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { useAttachTo } = useMouseoverMining('blog', id || '')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      loadBlog()
    }
  }, [id])

  useEffect(() => {
    if (cardRef.current) {
      const cleanup = useAttachTo(cardRef.current)
      return cleanup
    }
  }, [useAttachTo])

  const loadBlog = async () => {
    try {
      const allBlogs = await db.db.blogPosts.list({
        where: { id }
      })
      
      if (allBlogs.length > 0) {
        setBlog(allBlogs[0])
      } else {
        toast.error('Blog post not found')
        navigate('/blogs')
      }
    } catch (error) {
      console.error('Failed to load blog:', error)
      toast.error('Failed to load blog post')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-muted-foreground">Fetching blog post</div>
        </div>
      </div>
    )
  }

  if (!blog) {
    return null
  }

  const fontFamily = getFontFamily(blog.themeFont || 'mono')
  const accentColor = blog.themeColor || '#000000'

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => navigate('/blogs')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO BLOGS
        </button>
      </div>

      <Card 
        ref={cardRef}
        className="border-2"
      >
        <CardHeader className="border-b-2">
          {/* Blog Name (if set) */}
          {blog.blogName && (
            <div 
              className="text-sm font-bold mb-2 uppercase tracking-wider"
              style={{ 
                fontFamily,
                color: accentColor 
              }}
            >
              {blog.blogName}
            </div>
          )}

          {/* Title */}
          <h1 
            className="text-4xl font-bold mb-4"
            style={{ fontFamily }}
          >
            {blog.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-mono">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>By <strong>{blog.authorUsername || 'Anonymous'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(blog.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span><strong>{blog.totalPow || 0}</strong> PoW</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Blog Content with Rich Text */}
          <div 
            className="prose prose-sm max-w-none"
            style={{ 
              fontFamily,
              fontSize: '16px',
              lineHeight: '1.7'
            }}
          >
            <style>{`
              .prose a {
                color: ${accentColor};
                text-decoration: underline;
              }
              .prose a:hover {
                text-decoration: none;
              }
              .prose strong {
                color: ${accentColor};
              }
            `}</style>
            {processRichText(blog.content)}
          </div>

          {/* Mining Info */}
          <div className="mt-8 p-4 border-2 border-dashed font-mono text-xs">
            <p className="text-muted-foreground">
              💎 Hover over this blog post to mine proof-of-work and boost its ranking
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Back Button */}
      <div className="mt-6 flex justify-center">
        <Button
          variant="outline"
          className="font-mono"
          onClick={() => navigate('/blogs')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          BACK TO ALL BLOGS
        </Button>
      </div>
    </div>
  )
}
