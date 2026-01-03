/**
 * PlanetClaim Component
 * Allows authenticated users to claim a free Urbit planet from the star allocation
 */

import { useState } from 'react'
import { useUrbit } from '../../hooks/use-urbit'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Loader2, Globe, Check, Copy, ExternalLink } from 'lucide-react'

export function PlanetClaim() {
  const { isAuthenticated } = useAuth()
  const {
    isConfigured,
    isLoading,
    error,
    availablePlanets,
    userPlanets,
    pendingInvite,
    claimPlanet
  } = useUrbit()

  const [copied, setCopied] = useState(false)
  const [claiming, setClaiming] = useState(false)

  const handleClaim = async () => {
    setClaiming(true)
    await claimPlanet()
    setClaiming(false)
  }

  const copyInviteCode = () => {
    if (pendingInvite?.code) {
      navigator.clipboard.writeText(pendingInvite.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Not logged in
  if (!isAuthenticated) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Claim Your Planet
          </CardTitle>
          <CardDescription>
            Log in to claim your free Urbit planet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As a Hai member, you're entitled to a free Urbit planet - your permanent
            digital identity. Log in to claim yours.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Star not configured yet
  if (!isConfigured) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Urbit Integration
          </CardTitle>
          <CardDescription>
            Coming Soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The Urbit star is being configured. Once activated, you'll be able
            to claim your free planet here.
          </p>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>256 planets</strong> will be available for Hai members.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // User already has a planet
  if (userPlanets.length > 0) {
    const planet = userPlanets[0]
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-500" />
            Your Planet
          </CardTitle>
          <CardDescription>
            You've claimed your Urbit identity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <code className="text-lg font-mono">{planet.patp}</code>
            <Badge variant={planet.claimed ? 'default' : 'secondary'}>
              {planet.claimed ? 'Active' : 'Pending'}
            </Badge>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Your planet is your permanent identity on the Urbit network.
            Use it to access decentralized apps and communicate with other ships.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Has pending invite
  if (pendingInvite) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Claim Your Planet
          </CardTitle>
          <CardDescription>
            Your planet invite is ready
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Your Planet</p>
            <code className="text-lg font-mono block">{pendingInvite.patp}</code>
          </div>

          <div className="p-4 border rounded-lg space-y-2">
            <p className="text-sm font-medium">Invite Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-muted p-2 rounded">
                {pendingInvite.code}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyInviteCode}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Button className="w-full" asChild>
              <a
                href="https://bridge.urbit.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Claim at Bridge
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Expires: {pendingInvite.expiresAt.toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Can claim a planet
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Claim Your Planet
        </CardTitle>
        <CardDescription>
          Get your free Urbit identity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Available Planets</span>
            <Badge variant="outline">{availablePlanets} / 256</Badge>
          </div>
          <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(availablePlanets / 256) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          className="w-full"
          onClick={handleClaim}
          disabled={isLoading || claiming || availablePlanets === 0}
        >
          {(isLoading || claiming) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Invite...
            </>
          ) : availablePlanets === 0 ? (
            'All Planets Claimed'
          ) : (
            'Claim My Planet'
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Each Hai member can claim one free Urbit planet. Your planet is a
          permanent digital identity that you fully own.
        </p>
      </CardContent>
    </Card>
  )
}

export default PlanetClaim
