import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import { Database, CheckCircle, AlertCircle } from 'lucide-react'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function MigrateImagesPage() {
  const { authState } = useAuth()
  const [migrating, setMigrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{
    total: number
    migrated: number
    skipped: number
    errors: number
  } | null>(null)

  const migrateImages = async () => {
    setMigrating(true)
    setProgress(0)
    setResults(null)

    try {
      if (!authState.user?.id) {
        toast.error('Please log in first')
        return
      }

      let total = 0
      let migrated = 0
      let skipped = 0
      let errors = 0

      // Get all threads by this user
      const threads: any[] = await db.db.threads.list({
        where: { userId: authState.user.id }
      })

      total += threads.length

      // Migrate thread images
      for (let i = 0; i < threads.length; i++) {
        const thread = threads[i]
        setProgress((i / threads.length) * 50) // First 50% for threads

        if (thread.imageUrl) {
          try {
            // Check if already in library
            const existing = await db.db.imageMetadata.list({
              where: { userId: user.id, imageUrl: thread.imageUrl }
            })

            if (existing.length === 0) {
              // Add to library
              await db.db.imageMetadata.create({
                userId: user.id,
                imageUrl: thread.imageUrl,
                imageName: `Thread: ${thread.title}`,
                imageSize: 0,
                uploadedAt: thread.createdAt,
                isFavorite: 0,
                useCount: 1
              })
              migrated++
            } else {
              skipped++
            }
          } catch (error) {
            console.error(`Failed to migrate thread image:`, error)
            errors++
          }
        }
      }

      // Get all posts by this user
      const posts: any[] = await db.db.posts.list({
        where: { userId: user.id }
      })

      total += posts.length

      // Migrate post images
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i]
        setProgress(50 + (i / posts.length) * 50) // Second 50% for posts

        if (post.imageUrl) {
          try {
            // Check if already in library
            const existing = await db.db.imageMetadata.list({
              where: { userId: user.id, imageUrl: post.imageUrl }
            })

            if (existing.length === 0) {
              // Add to library
              await db.db.imageMetadata.create({
                userId: user.id,
                imageUrl: post.imageUrl,
                imageName: `Post #${post.post_number || post.postNumber || 'Unknown'}`,
                imageSize: 0,
                uploadedAt: post.createdAt,
                isFavorite: 0,
                useCount: 1
              })
              migrated++
            } else {
              // Increment use count
              await db.db.imageMetadata.update(existing[0].id, {
                useCount: Number(existing[0].useCount) + 1
              })
              skipped++
            }
          } catch (error) {
            console.error(`Failed to migrate post image:`, error)
            errors++
          }
        }
      }

      setProgress(100)
      setResults({ total, migrated, skipped, errors })
      
      if (migrated > 0) {
        toast.success(`Migrated ${migrated} images to library!`)
      } else {
        toast.success('All images are already in library')
      }
    } catch (error) {
      console.error('Migration failed:', error)
      toast.error('Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-mono border-b-2 border-foreground pb-2 mb-2">
          MIGRATE IMAGES TO LIBRARY
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          Import all your existing thread and post images into the image library
        </p>
      </div>

      <Card className="border-2 border-foreground">
        <CardHeader className="border-b-2 border-foreground bg-foreground text-background">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <div>
              <CardTitle className="font-mono">IMAGE MIGRATION</CardTitle>
              <CardDescription className="font-mono text-xs text-background/80 mt-1">
                This will scan all your threads and posts and add their images to your library
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-mono font-bold text-sm">What this does:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm font-mono text-muted-foreground">
                <li>Scans all your threads and posts for images</li>
                <li>Adds images to your image library if not already present</li>
                <li>Updates use counts for existing images</li>
                <li>Preserves original upload dates</li>
              </ul>
            </div>

            {migrating && (
              <div className="space-y-2">
                <p className="text-sm font-mono">Migrating images...</p>
                <Progress value={progress} />
                <p className="text-xs font-mono text-muted-foreground text-right">
                  {Math.round(progress)}%
                </p>
              </div>
            )}

            {results && (
              <div className="border-2 border-foreground p-4 space-y-2">
                <h3 className="font-mono font-bold text-sm mb-3">MIGRATION RESULTS:</h3>
                <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span>Total processed:</span>
                    <span className="font-bold ml-auto">{results.total}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Migrated:</span>
                    <span className="font-bold ml-auto">{results.migrated}</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Already in library:</span>
                    <span className="font-bold ml-auto">{results.skipped}</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Errors:</span>
                    <span className="font-bold ml-auto">{results.errors}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={migrateImages}
              disabled={migrating}
              className="w-full font-mono"
            >
              <Database className="w-4 h-4 mr-2" />
              {migrating ? 'MIGRATING...' : 'START MIGRATION'}
            </Button>

            {results && results.migrated > 0 && (
              <p className="text-center text-sm font-mono text-green-600">
                ✓ Migration complete! Visit the image library to see your images.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
