import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"
import { AlertTriangle } from 'lucide-react'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const navigate = useNavigate()
  const { authState, logout } = useAuth()
  const [settings, setSettings] = useState({
    ditheringEnabled: true,
    autoPlayGifs: true,
    showMiningStats: true,
    compactMode: false,
    theme: 'haichan' // default
  })

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('haichan-settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSettings(prev => ({ ...prev, ...parsed }))
        // Apply theme from saved settings
        if (parsed.theme) {
          document.documentElement.setAttribute('data-theme', parsed.theme)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
  }, [])

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem('haichan-settings', JSON.stringify(newSettings))
    
    // Apply theme immediately if changed
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value)
    }
    
    toast.success('Setting updated')
  }

  const handleGhostMode = async () => {
    if (!authState.user) return
    
    if (confirm('Are you sure? "Ghost Mode" makes your account read-only. You cannot reply or interact, but your history remains. This cannot be undone.')) {
      try {
        await db.db.users.update(authState.user.id, {
          role: 'ghost'
        })
        toast.success('You are now a ghost.')
        logout()
        navigate('/')
      } catch (error) {
        toast.error('Failed to enter ghost mode')
      }
    }
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-black font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

        <div className="border-4 border-black bg-black text-white p-3 mb-6">
          <h1 className="text-2xl font-bold font-mono">
            SETTINGS
          </h1>
          <p className="text-xs font-mono mt-1 text-gray-300">
            Configure your Haichan experience
          </p>
        </div>

        <Card className="border-4 border-black">
          <CardHeader className="bg-black text-white border-b-4 border-black">
            <CardTitle className="text-xl font-mono">PREFERENCES</CardTitle>
            <CardDescription className="font-mono text-xs text-gray-300 mt-1">
              Customize how you interact with the site
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Theme Selector */}
            <div className="p-4 border-2 border-black">
              <Label className="font-mono font-bold text-base mb-3 block">
                THEME
              </Label>
              <RadioGroup 
                value={settings.theme || 'haichan'} 
                onValueChange={(val) => updateSetting('theme', val)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="haichan" id="haichan" />
                  <Label htmlFor="haichan" className="font-mono">Haichan (Dark/Mint)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yotsuba" id="yotsuba" />
                  <Label htmlFor="yotsuba" className="font-mono">Yotsuba (Light/Orange)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yotsuba-b" id="yotsuba-b" />
                  <Label htmlFor="yotsuba-b" className="font-mono">Yotsuba B (Blue/Grey)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Dithering Toggle */}
            <div className="flex items-center justify-between p-4 border-2 border-black">
              <div className="space-y-1">
                <Label htmlFor="dithering" className="font-mono font-bold text-base">
                  AUTO DITHERING
                </Label>
                <p className="text-xs text-gray-600 font-mono">
                  Apply retro dithering effect to all images automatically
                </p>
              </div>
              <Switch
                id="dithering"
                checked={settings.ditheringEnabled}
                onCheckedChange={(checked) => updateSetting('ditheringEnabled', checked)}
                className="data-[state=checked]:bg-black"
              />
            </div>

            {/* Auto-play GIFs */}
            <div className="flex items-center justify-between p-4 border-2 border-black">
              <div className="space-y-1">
                <Label htmlFor="autoplay" className="font-mono font-bold text-base">
                  AUTO-PLAY GIFS
                </Label>
                <p className="text-xs text-gray-600 font-mono">
                  Automatically play animated GIFs when visible
                </p>
              </div>
              <Switch
                id="autoplay"
                checked={settings.autoPlayGifs}
                onCheckedChange={(checked) => updateSetting('autoPlayGifs', checked)}
                className="data-[state=checked]:bg-black"
              />
            </div>

            {/* Mining Stats */}
            <div className="flex items-center justify-between p-4 border-2 border-black">
              <div className="space-y-1">
                <Label htmlFor="mining-stats" className="font-mono font-bold text-base">
                  SHOW MINING STATS
                </Label>
                <p className="text-xs text-gray-600 font-mono">
                  Display mining status in bottom toolbar
                </p>
              </div>
              <Switch
                id="mining-stats"
                checked={settings.showMiningStats}
                onCheckedChange={(checked) => updateSetting('showMiningStats', checked)}
                className="data-[state=checked]:bg-black"
              />
            </div>

            {/* Compact Mode */}
            <div className="flex items-center justify-between p-4 border-2 border-black">
              <div className="space-y-1">
                <Label htmlFor="compact" className="font-mono font-bold text-base">
                  COMPACT MODE
                </Label>
                <p className="text-xs text-gray-600 font-mono">
                  Reduce spacing and padding for denser content
                </p>
              </div>
              <Switch
                id="compact"
                checked={settings.compactMode}
                onCheckedChange={(checked) => updateSetting('compactMode', checked)}
                className="data-[state=checked]:bg-black"
              />
            </div>

            {/* Ghost Mode */}
            <div className="flex items-center justify-between p-4 border-2 border-red-600 bg-red-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <Label className="font-mono font-bold text-base text-red-600">
                    BECOME A GHOST
                  </Label>
                </div>
                <p className="text-xs text-red-800 font-mono">
                  Permanently set your account to read-only. You can never reply again.
                </p>
              </div>
              <Button 
                onClick={handleGhostMode}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white font-mono text-xs"
              >
                LEAVE HAICHAN
              </Button>
            </div>

            <div className="pt-4">
              <Button
                onClick={() => {
                  localStorage.removeItem('haichan-settings')
                  setSettings({
                    ditheringEnabled: true,
                    autoPlayGifs: true,
                    showMiningStats: true,
                    compactMode: false,
                    theme: 'haichan'
                  })
                  document.documentElement.setAttribute('data-theme', 'haichan')
                  toast.success('Settings reset to defaults')
                }}
                variant="outline"
                className="font-mono w-full border-2 border-black"
              >
                RESET TO DEFAULTS
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
