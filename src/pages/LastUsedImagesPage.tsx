import { ImageLibrary } from '../components/views/ImageLibrary'
import { Button } from '../components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function LastUsedImagesPage() {
  const navigate = useNavigate()
  
  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/images')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold font-mono border-b-2 border-foreground pb-2">
              LAST USED IMAGES
            </h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          Your recently used images.
        </p>
      </div>
      
      <div className="h-[600px]">
        <ImageLibrary sortBy="used" />
      </div>
    </div>
  )
}
