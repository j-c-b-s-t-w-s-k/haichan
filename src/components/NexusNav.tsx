/**
 * NexusNav - Shared navigation across Hai ecosystem
 * Links all sites through Urbit identity
 */

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUrbitService } from '../lib/urbit'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Globe, MessageSquare, Key, Network, ExternalLink, ChevronDown, Music } from 'lucide-react'

interface NexusSite {
  id: string
  name: string
  description: string
  url: string
  icon: React.ReactNode
  active?: boolean
}

const NEXUS_SITES: NexusSite[] = [
  {
    id: 'hai',
    name: 'Hai',
    description: 'PoW Discussion Board',
    url: '/',
    icon: <MessageSquare className="h-4 w-4" />,
    active: true
  },
  {
    id: 'xallarap',
    name: 'Xallarap',
    description: 'Identity & Attestations',
    url: 'http://localhost:5173',
    icon: <Key className="h-4 w-4" />
  },
  {
    id: 'scr0b',
    name: 'Scr0b',
    description: 'Music & Media Scrobbler',
    url: 'http://localhost:5174',
    icon: <Music className="h-4 w-4" />
  },
  {
    id: 'urbit',
    name: 'Your Planet',
    description: 'Claim free Urbit identity',
    url: '/planet',
    icon: <Globe className="h-4 w-4" />
  }
]

export function NexusNav() {
  const { authState } = useAuth()
  const urbit = getUrbitService()
  const [open, setOpen] = useState(false)

  const userPlanets = authState.user?.id
    ? urbit.getPlanetsForUser(authState.user.id)
    : []
  const hasPlanet = userPlanets.length > 0
  const planetPatp = hasPlanet ? userPlanets[0].patp : null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Network className="h-4 w-4" />
          <span className="hidden sm:inline">Nexus</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Hai Network</span>
          {planetPatp && (
            <code className="text-xs font-mono text-muted-foreground">
              {planetPatp}
            </code>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {NEXUS_SITES.map((site) => (
          <DropdownMenuItem
            key={site.id}
            className="flex items-start gap-3 p-3 cursor-pointer"
            onClick={() => {
              if (site.url.startsWith('http')) {
                window.open(site.url, '_blank')
              } else {
                window.location.href = site.url
              }
              setOpen(false)
            }}
          >
            <div className="p-1.5 bg-muted rounded-md">
              {site.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{site.name}</span>
                {site.active && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                    HERE
                  </span>
                )}
                {site.url.startsWith('http') && (
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {site.description}
              </p>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <div className="p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Connected via Urbit</span>
            <span className="font-mono">
              {hasPlanet ? '256 members' : 'Join →'}
            </span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NexusNav
