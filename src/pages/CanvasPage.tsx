import { useState } from 'react'
import { MultiplayerCanvas } from '../components/views/MultiplayerCanvas'
import { DoodleMining } from '../components/views/DoodleMining'
import { Palette, Sparkles, ChevronDown } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Button } from '../components/ui/button'

export function CanvasPage() {
  const [activeTab, setActiveTab] = useState('doodle')

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 font-mono flex items-center gap-3">
            <Palette className="w-10 h-10" />
            CANVAS STUDIO
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI-enhanced doodles & collaborative drawing • Textures, brushes, effects • Record & export as GIF
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="font-mono min-w-[180px] justify-between bg-background">
              {activeTab === 'doodle' ? 'Single Player' : 'Multi Player'}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px] font-mono">
            <DropdownMenuItem onClick={() => setActiveTab('doodle')}>
              Single Player
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('multiplayer')}>
              Multi Player
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 border-2 border-foreground font-mono">
          <TabsTrigger value="doodle" className="font-mono">
            (a) DOODLE MINING
          </TabsTrigger>
          <TabsTrigger value="multiplayer" className="font-mono">
            (b) MULTIPLAYER CANVAS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="doodle" className="space-y-4">
          <div className="text-sm text-muted-foreground font-mono mb-4 p-3 border border-foreground bg-muted">
            <p className="font-bold mb-1">DOODLE MINING (a)</p>
            <p>Single-user canvas for creative drawing and AI enhancement. Upload images, draw, refine with AI prompts, and export to threads.</p>
          </div>
          <DoodleMining />
        </TabsContent>

        <TabsContent value="multiplayer" className="space-y-4">
          <div className="text-sm text-muted-foreground font-mono mb-4 p-3 border border-foreground bg-muted">
            <p className="font-bold mb-1">MULTIPLAYER CANVAS (b)</p>
            <p>Real-time collaborative drawing sessions. Start a session, share ID with others, draw together, apply AI textures, and record as GIF.</p>
          </div>
          <MultiplayerCanvas />
        </TabsContent>
      </Tabs>
    </div>
  )
}