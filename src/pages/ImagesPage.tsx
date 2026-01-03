import { ImageLibrary } from '../components/views/ImageLibrary'
import { Button } from '../components/ui/button'
import { Database } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ImagesPage() {
  const navigate = useNavigate()
  
  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold font-mono border-b-2 border-foreground pb-2">
            IMAGE LIBRARY
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/images/migrate')}
            className="font-mono"
          >
            <Database className="w-3 h-3 mr-1" />
            Import Old Images
          </Button>
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          Upload and manage your images. All files are stored securely.
        </p>
      </div>
      
      <div className="h-[600px]">
        <ImageLibrary />
      </div>
    </div>
  )
}
