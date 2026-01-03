import { useState, useEffect, useRef } from 'react'
import { Upload, Image as ImageIcon, X, Download, Tag, Search, Filter, Star, Zap } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Label } from '../ui/label'
import { useMouseoverMining } from '../../hooks/use-mining'
import { useAuth } from '../../contexts/AuthContext'
import db from '../../lib/db-client'
import toast from 'react-hot-toast'
import { withRateLimit } from '../../lib/rate-limit-utils'
import { requestCache } from '../../lib/request-cache'

interface StoredImage {
  url: string
  name: string
  uploadedAt: number
  lastUsedAt?: number
  size?: number
  tags: string[]
  favorite: boolean
  useCount: number
  powScore?: number
}

// ImageTile component with hover mining
function ImageTile({ 
  image, 
  isSelected, 
  onSelect, 
  onContextMenu, 
  onClick 
}: {
  image: StoredImage
  isSelected: boolean
  onSelect: (img: StoredImage) => void
  onContextMenu: (img: StoredImage) => void
  onClick: (url: string) => void
}) {
  const tileRef = useRef<HTMLDivElement>(null)
  const [miningProgress, setMiningProgress] = useState<{ hash: string; points: number } | null>(null)
  const { attachTo } = useMouseoverMining('image', image.url)

  useEffect(() => {
    // Attach mining to this tile
    const cleanup = attachTo(tileRef.current)
    return cleanup
  }, [image.url, attachTo])

  // Watch for mining data attributes
  useEffect(() => {
    if (!tileRef.current) return

    const observer = new MutationObserver(() => {
      const hash = tileRef.current?.getAttribute('data-mining-hash')
      const points = tileRef.current?.getAttribute('data-mining-points')
      if (hash && points) {
        setMiningProgress({ hash, points: parseInt(points) })
      }
    })

    observer.observe(tileRef.current, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={tileRef}
      className={`border-2 cursor-pointer hover:bg-foreground/10 transition-colors relative group ${
        isSelected
          ? 'border-foreground bg-foreground/5'
          : 'border-foreground/30'
      }`}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.button === 2) {
          onSelect(image)
        } else {
          onClick(image.url)
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(image)
      }}
    >
      {/* Floating overlay with stats */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Top left: PoW Score */}
        <div className="absolute top-1 left-1 bg-black/80 text-white px-2 py-1 text-[10px] font-mono">
          PoW: {image.powScore || 100}
        </div>
        
        {/* Top right: Favorite star */}
        {image.favorite && (
          <div className="absolute top-1 right-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 drop-shadow-md" />
          </div>
        )}
        
        {/* Mining indicator when hovering */}
        {miningProgress && (
          <div className="absolute top-1 right-7 bg-orange-500/90 text-white px-2 py-1 text-[10px] font-mono flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {miningProgress.points}
          </div>
        )}
        
        {/* Bottom left: Usage count */}
        <div className="absolute bottom-1 left-1 bg-black/80 text-white px-2 py-1 text-[10px] font-mono">
          Uses: {image.useCount}
        </div>
        
        {/* Bottom right: Tags */}
        {image.tags.length > 0 && (
          <div className="absolute bottom-1 right-1 flex flex-wrap gap-0.5 justify-end max-w-[120px]">
            {image.tags.slice(0, 3).map(tag => (
              <span 
                key={tag} 
                className="bg-black/80 text-gray-400 px-1.5 py-0.5 text-[8px] font-mono"
              >
                {tag}
              </span>
            ))}
            {image.tags.length > 3 && (
              <span className="bg-black/80 text-gray-400 px-1.5 py-0.5 text-[8px] font-mono">
                +{image.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="aspect-square overflow-hidden">
        <img
          src={image.url}
          alt={image.name}
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Name overlay at bottom (visible on hover) */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/90 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="font-mono text-[10px] truncate">{image.name}</div>
      </div>
    </div>
  )
}

export function ImageLibrary({ sortBy = 'uploaded' }: { sortBy?: 'uploaded' | 'used' }) {
  const { authState } = useAuth()
  const [images, setImages] = useState<StoredImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [addingTag, setAddingTag] = useState(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadImages()
    
    // Set up auto-refresh for PoW scores every 30 seconds (reduced frequency)
    refreshIntervalRef.current = setInterval(() => {
      loadImages()
    }, 30000)
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Extract all unique tags from images
    const tags = new Set<string>()
    images.forEach(img => {
      img.tags.forEach(tag => tags.add(tag))
    })
    setAllTags(Array.from(tags).sort())
  }, [images])

  const loadImages = async () => {
    try {
      setLoading(true)
      const user = authState.user
      if (!user) return

      // Use request cache with 20s TTL to avoid repeated calls
      const metadata = await requestCache.getOrFetch(
        `image-metadata-${user.id}`,
        () => withRateLimit(
          () => db.db.imageMetadata.list({
            where: { userId: user.id },
            orderBy: { uploadedAt: 'desc' }
          }),
          { maxRetries: 5, initialDelayMs: 200 }
        ),
        20000 // 20 second cache
      )

      // Batch tag requests into groups of 5 to reduce API calls
      const imagesWithTags: StoredImage[] = []
      const batchSize = 5
      
      for (let i = 0; i < metadata.length; i += batchSize) {
        const batch = metadata.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(async (meta: any) => {
            // Cache tag lists per image
            const tagRecords = await requestCache.getOrFetch(
              `image-tags-${user.id}-${meta.imageUrl}`,
              () => withRateLimit(
                () => db.db.imageTags.list({
                  where: { userId: user.id, imageUrl: meta.imageUrl }
                }),
                { maxRetries: 3, initialDelayMs: 50 }
              ),
              15000 // 15 second cache for tags
            )
            
            const useCount = Number(meta.useCount) || 0
            // Calculate PoW score: use totalPow from DB
            const powScore = Number(meta.totalPow) || 0
            
            return {
              url: meta.imageUrl,
              name: meta.imageName,
              uploadedAt: new Date(meta.uploadedAt).getTime(),
              lastUsedAt: meta.lastUsedAt ? new Date(meta.lastUsedAt).getTime() : 0,
              size: Number(meta.imageSize) || 0,
              tags: tagRecords.map((t: any) => t.tag).sort(),
              favorite: Number(meta.isFavorite) > 0,
              useCount: useCount,
              powScore: powScore
            }
          })
        )
        imagesWithTags.push(...batchResults)
      }

      setImages(imagesWithTags)
    } catch (error) {
      console.error('Failed to load images:', error)
      toast.error('Failed to load images')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      const user = authState.user
      if (!user) {
        toast.error('Please sign in to upload images')
        return
      }

      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`)
          continue
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`)
          continue
        }

        // Extract file extension
        const extension = file.name.split('.').pop() || 'jpg'
        // Generate random filename to avoid conflicts
        const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const filename = `images/${user.id}/${Date.now()}-${randomId}.${extension}`

        // Upload to storage with rate limiting
        const { publicUrl } = await withRateLimit(
          () => db.storage.upload(file, filename, { upsert: true }),
          { maxRetries: 3, initialDelayMs: 100 }
        )

        // Save metadata to DB with rate limiting
        await withRateLimit(
          () => db.db.imageMetadata.create({
            userId: user.id,
            imageUrl: publicUrl,
            imageName: file.name,
            imageSize: file.size,
            uploadedAt: new Date().toISOString(),
            isFavorite: 0,
            useCount: 0
          }),
          { maxRetries: 3, initialDelayMs: 100 }
        )

        toast.success(`Uploaded ${file.name}`)
      }

      // Reload images
      await loadImages()
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const deleteImage = async (imageUrl: string) => {
    try {
      const user = authState.user
      if (!user) return

      // Delete tags with rate limiting
      const tagRecords = await withRateLimit(
        () => db.db.imageTags.list({
          where: { userId: user.id, imageUrl }
        }),
        { maxRetries: 3, initialDelayMs: 100 }
      )
      for (const tag of tagRecords) {
        await withRateLimit(
          () => db.db.imageTags.delete(tag.id),
          { maxRetries: 2, initialDelayMs: 50 }
        )
      }

      // Delete metadata with rate limiting
      const metaRecords = await withRateLimit(
        () => db.db.imageMetadata.list({
          where: { userId: user.id, imageUrl }
        }),
        { maxRetries: 3, initialDelayMs: 100 }
      )
      for (const meta of metaRecords) {
        await withRateLimit(
          () => db.db.imageMetadata.delete(meta.id),
          { maxRetries: 2, initialDelayMs: 50 }
        )
      }

      // Delete from storage with rate limiting
      const path = imageUrl.split('/').slice(-3).join('/')
      await withRateLimit(
        () => db.storage.remove(path),
        { maxRetries: 2, initialDelayMs: 100 }
      )

      const newImages = images.filter(img => img.url !== imageUrl)
      setImages(newImages)

      if (selectedImage?.url === imageUrl) {
        setSelectedImage(null)
      }

      toast.success('Image deleted')
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Delete failed')
    }
  }

  const addTag = async (imageUrl: string, tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (!trimmedTag) return

    // Prevent duplicate submissions
    if (addingTag) return

    try {
      setAddingTag(true)
      const user = authState.user
      if (!user) {
        toast.error('Please sign in')
        return
      }

      // Check if image already has 5 tags with rate limiting
      const existingTags = await withRateLimit(
        () => db.db.imageTags.list({
          where: { userId: user.id, imageUrl }
        }),
        { maxRetries: 3, initialDelayMs: 100 }
      )

      if (existingTags.length >= 5) {
        toast.error('Maximum 5 tags per image')
        return
      }

      // Check if tag already exists (case-insensitive comparison)
      const tagExists = existingTags.some((t: any) => t.tag.toLowerCase() === trimmedTag)
      if (tagExists) {
        toast.error('Tag already exists for this image')
        return
      }

      // Try to add tag to DB with constraint violation handling
      try {
        await withRateLimit(
          () => db.db.imageTags.create({
            userId: user.id,
            imageUrl,
            tag: trimmedTag
          }),
          { maxRetries: 3, initialDelayMs: 100 }
        )
        
        setNewTag('')
        await loadImages()
        toast.success('Tag added')
      } catch (dbError: any) {
        // Handle specific constraint violation error
        if (dbError?.status === 409 || dbError?.details?.error_details?.includes('UNIQUE constraint failed')) {
          toast.error('Tag already exists for this image')
          // Refresh to get latest state
          await loadImages()
        } else {
          throw dbError
        }
      }
    } catch (error) {
      console.error('Failed to add tag:', error)
      toast.error('Failed to add tag')
    } finally {
      setAddingTag(false)
    }
  }

  const removeTag = async (imageUrl: string, tag: string) => {
    try {
      const user = authState.user
      if (!user) return

      // Find and delete tag record with rate limiting
      const tagRecords = await withRateLimit(
        () => db.db.imageTags.list({
          where: { userId: user.id, imageUrl, tag }
        }),
        { maxRetries: 3, initialDelayMs: 100 }
      )

      for (const tagRecord of tagRecords) {
        await withRateLimit(
          () => db.db.imageTags.delete(tagRecord.id),
          { maxRetries: 2, initialDelayMs: 50 }
        )
      }

      await loadImages()
      toast.success('Tag removed')
    } catch (error) {
      console.error('Failed to remove tag:', error)
      toast.error('Failed to remove tag')
    }
  }

  const toggleFavorite = async (imageUrl: string) => {
    try {
      const user = authState.user
      if (!user) return

      const metaRecords = await withRateLimit(
        () => db.db.imageMetadata.list({
          where: { userId: user.id, imageUrl }
        }),
        { maxRetries: 3, initialDelayMs: 100 }
      )

      if (metaRecords.length > 0) {
        const meta = metaRecords[0]
        const newFavorite = Number(meta.isFavorite) > 0 ? 0 : 1
        await withRateLimit(
          () => db.db.imageMetadata.update(meta.id, {
            isFavorite: newFavorite
          }),
          { maxRetries: 2, initialDelayMs: 50 }
        )
      }

      await loadImages()
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
      toast.error('Failed to toggle favorite')
    }
  }

  const incrementUseCount = async (imageUrl: string) => {
    try {
      const user = authState.user
      if (!user) return

      const metaRecords = await withRateLimit(
        () => db.db.imageMetadata.list({
          where: { userId: user.id, imageUrl }
        }),
        { maxRetries: 3, initialDelayMs: 100 }
      )

      if (metaRecords.length > 0) {
        const meta = metaRecords[0]
        const newCount = Number(meta.useCount) + 1
        await withRateLimit(
          () => db.db.imageMetadata.update(meta.id, {
            useCount: newCount,
            lastUsedAt: new Date().toISOString()
          }),
          { maxRetries: 2, initialDelayMs: 50 }
        )
      }

      await loadImages()
    } catch (error) {
      console.error('Failed to increment use count:', error)
    }
  }

  const copyImageUrl = (imageUrl: string) => {
    navigator.clipboard.writeText(imageUrl)
    incrementUseCount(imageUrl)
    // Store for next thread/post creation
    localStorage.setItem('clipboard-image', imageUrl)
    toast.success('Image copied! Ready for next thread/post.')
  }

  const handleImageClick = (imageUrl: string) => {
    // Store image for next thread/post
    localStorage.setItem('clipboard-image', imageUrl)
    incrementUseCount(imageUrl)
    // Also copy URL to clipboard
    navigator.clipboard.writeText(imageUrl)
    toast.success('Image ready for next post! (Click Copy URL to copy link)', { duration: 2000 })
    // Don't change selected image on click - that breaks the UI flow
  }

  const formatFileSize = (bytes: number = 0) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Filter images based on search and tag
  const filteredImages = images.filter(img => {
    const matchesSearch = !searchQuery || 
      img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.tags.some(tag => tag.includes(searchQuery.toLowerCase()))
    
    const matchesTag = !filterTag || img.tags.includes(filterTag)
    
    return matchesSearch && matchesTag
  })

  // Sort images: favorites first, then by sort criteria
  const sortedImages = [...filteredImages].sort((a, b) => {
    // Favorites always on top
    if (a.favorite && !b.favorite) return -1
    if (!a.favorite && b.favorite) return 1
    
    if (sortBy === 'used') {
      return (b.lastUsedAt || 0) - (a.lastUsedAt || 0)
    }
    
    // Default to uploadedAt
    return b.uploadedAt - a.uploadedAt
  })

  return (
    <div className="h-full flex flex-col border-2 border-foreground">
      {/* Header */}
      <div className="border-b-2 border-foreground p-3 bg-background">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            <h3 className="font-bold font-mono">
              {sortBy === 'used' ? 'LAST USED IMAGES' : 'IMAGE LIBRARY'}
            </h3>
          </div>
          
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <Button size="sm" className="font-mono" disabled={uploading} asChild>
              <span>
                <Upload className="w-3 h-3 mr-1" />
                {uploading ? 'Uploading...' : 'Upload'}
              </span>
            </Button>
          </label>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search images by name or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 font-mono text-xs"
            />
          </div>
          {allTags.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTagDialog(true)}
              className="font-mono"
            >
              <Filter className="w-3 h-3 mr-1" />
              Filter
            </Button>
          )}
        </div>

        {/* Active Filter */}
        {filterTag && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">Filter:</span>
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setFilterTag(null)}
            >
              {filterTag} <X className="w-3 h-3 ml-1" />
            </Badge>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground font-mono">
                <p>Loading images...</p>
              </div>
            </div>
          ) : sortedImages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground font-mono">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>{searchQuery || filterTag ? 'No matching images' : 'No images yet'}</p>
                <p className="text-xs mt-1">
                  {searchQuery || filterTag ? 'Try a different search' : 'Upload images to get started'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedImages.map((image, idx) => (
                <ImageTile
                  key={idx}
                  image={image}
                  isSelected={selectedImage?.url === image.url}
                  onSelect={setSelectedImage}
                  onContextMenu={setSelectedImage}
                  onClick={handleImageClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Image preview sidebar */}
        {selectedImage && (
          <div className="w-80 border-l-2 border-foreground flex flex-col">
            <div className="border-b-2 border-foreground p-2 flex items-center justify-between bg-background">
              <span className="font-mono font-bold text-xs">DETAILS</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFavorite(selectedImage.url)}
                >
                  <Star className={`w-3 h-3 ${selectedImage.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <img
                src={selectedImage.url}
                alt={selectedImage.name}
                className="w-full border-2 border-foreground mb-3"
              />

              <div className="space-y-3 text-xs font-mono">
                <div className="border border-foreground p-2">
                  <div className="text-muted-foreground mb-1">Name</div>
                  <div className="break-words">{selectedImage.name}</div>
                </div>

                <div className="border border-foreground p-2">
                  <div className="text-muted-foreground mb-1">Size</div>
                  <div>{formatFileSize(selectedImage.size)}</div>
                </div>

                <div className="border border-foreground p-2">
                  <div className="text-muted-foreground mb-1">Used</div>
                  <div>{selectedImage.useCount} times</div>
                </div>

                <div className="border border-foreground p-2">
                  <div className="text-muted-foreground mb-1">Uploaded</div>
                  <div>{new Date(selectedImage.uploadedAt).toLocaleString()}</div>
                </div>

                {/* Tags Section */}
                <div className="border border-foreground p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Tags ({selectedImage.tags.length}/5)</span>
                    <Tag className="w-3 h-3" />
                  </div>
                  
                  {selectedImage.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {selectedImage.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer text-[10px]"
                          onClick={() => removeTag(selectedImage.url, tag)}
                        >
                          {tag} <X className="w-2 h-2 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}

                  {selectedImage.tags.length < 5 && (
                    <div className="flex gap-1">
                      <Input
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !addingTag) {
                            addTag(selectedImage.url, newTag)
                          }
                        }}
                        className="flex-1 h-7 text-xs"
                        disabled={addingTag}
                      />
                      <Button
                        size="sm"
                        onClick={() => addTag(selectedImage.url, newTag)}
                        disabled={!newTag.trim() || addingTag}
                        className="h-7"
                      >
                        {addingTag ? 'Adding...' : 'Add'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border border-foreground p-2">
                  <div className="text-muted-foreground mb-1">URL</div>
                  <div className="break-all text-[10px] mb-2">{selectedImage.url}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-mono"
                    onClick={() => copyImageUrl(selectedImage.url)}
                  >
                    Copy URL
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-foreground p-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 font-mono"
                onClick={() => window.open(selectedImage.url, '_blank')}
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 font-mono"
                onClick={() => deleteImage(selectedImage.url)}
              >
                <X className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tag Filter Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle>Filter by Tag</DialogTitle>
            <DialogDescription>
              Select a tag to filter your images
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Button
              variant={filterTag === null ? 'default' : 'outline'}
              className="w-full justify-start font-mono"
              onClick={() => {
                setFilterTag(null)
                setShowTagDialog(false)
              }}
            >
              All Images ({images.length})
            </Button>
            {allTags.map(tag => {
              const count = images.filter(img => img.tags.includes(tag)).length
              return (
                <Button
                  key={tag}
                  variant={filterTag === tag ? 'default' : 'outline'}
                  className="w-full justify-between font-mono"
                  onClick={() => {
                    setFilterTag(tag)
                    setShowTagDialog(false)
                  }}
                >
                  <span>{tag}</span>
                  <Badge variant="secondary">{count}</Badge>
                </Button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}