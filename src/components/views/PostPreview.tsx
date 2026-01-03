import { Card } from "../ui/card"
import { BadgesInline } from "../../lib/badge-utils"
import { CircularOrbImage } from "../ui/circular-orb-image"

interface PostPreviewProps {
  post: any
  position: { x: number, y: number }
}

export function PostPreview({ post, position }: PostPreviewProps) {
  if (!post) return null

  // Calculate position to keep it on screen
  // This is a simple implementation, might need refinement
  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x + 20,
    top: position.y - 20,
    zIndex: 50,
    maxWidth: '400px',
    pointerEvents: 'none' // Don't let it interfere with mouse
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div style={style}>
      <Card className="border border-gunmetal bg-celadon shadow-xl overflow-hidden">
        <div className="border-b border-gunmetal bg-deep-teal px-2 py-1 font-mono text-xs font-bold text-white flex gap-2">
           <span className="flex items-center gap-1">
             {post.username || 'Anonymous'}
             <BadgesInline user={post} className="inline-flex" />
           </span>
           {post.tripcode && <span className="text-emerald">{post.tripcode}</span>}
           <span className="opacity-70">{formatDate(post.createdAt)}</span>
           <span>No.{post.post_number || post.postNumber}</span>
        </div>
        <div className="p-2 text-sm bg-white text-gunmetal">
          {post.imageUrl && (
            <div className="float-left mr-2 mb-1">
               <CircularOrbImage 
                 src={post.imageUrl} 
                 alt="Preview" 
                 size={64}
                 className="border border-gunmetal" 
               />
            </div>
          )}
          <div className="whitespace-pre-wrap break-words">
            {post.content}
          </div>
        </div>
      </Card>
    </div>
  )
}
