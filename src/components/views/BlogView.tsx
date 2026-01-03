import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, TrendingUp, User } from 'lucide-react'
import db from '../../lib/db-client'

export function BlogView() {
  const [blogs, setBlogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBlogs()
  }, [])

  const loadBlogs = async () => {
    try {
      const allBlogs = await db.db.blogPosts.list({
        where: { published: "1" },
        orderBy: { totalPow: 'desc' },
        limit: 5
      })
      setBlogs(allBlogs)
    } catch (error) {
      console.error('Failed to load blogs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="border-2 border-black bg-white">
      {/* Header */}
      <div className="border-b-2 border-black bg-black text-white px-3 py-1 font-mono text-sm font-bold">
        RECENT BLOGS
      </div>

      {/* Blog List */}
      <div className="p-3 space-y-3 font-mono text-xs">
        {loading && (
          <div className="text-center text-gray-500 py-4">Loading blogs...</div>
        )}

        {!loading && blogs.length === 0 && (
          <div className="text-center text-gray-500 py-4">No blogs published yet</div>
        )}

        {blogs.map((blog) => (
          <Link
            key={blog.id}
            to={`/blog/${blog.id}`}
            className="block border-2 border-black p-2 hover:bg-black hover:text-white transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {blog.blogName && (
                  <div className="text-[10px] font-bold mb-1 uppercase tracking-wider text-gray-500 group-hover:text-gray-300">
                    {blog.blogName}
                  </div>
                )}
                <div className="font-bold mb-1 line-clamp-1">{blog.title}</div>
                <div className="flex items-center gap-1 text-gray-500 group-hover:text-gray-300 text-[10px] mb-1">
                  <User className="w-3 h-3" />
                  <span>{blog.authorUsername || 'Anonymous'}</span>
                </div>
                <div className="text-gray-600 group-hover:text-gray-300 line-clamp-2 mb-1">
                  {blog.content.substring(0, 100)}...
                </div>
                <div className="text-gray-500 group-hover:text-gray-300 text-[10px]">
                  {formatDate(blog.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-1 text-black group-hover:text-white">
                <TrendingUp className="w-3 h-3" />
                <span className="font-bold">{blog.totalPow || 0}</span>
              </div>
            </div>
          </Link>
        ))}

        <Link
          to="/blogs"
          className="block text-center border-2 border-black p-2 hover:bg-black hover:text-white transition-colors font-bold"
        >
          <BookOpen className="w-3 h-3 inline mr-1" />
          VIEW ALL BLOGS →
        </Link>
      </div>
    </div>
  )
}
