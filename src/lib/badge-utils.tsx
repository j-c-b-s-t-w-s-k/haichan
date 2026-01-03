import React from 'react'
import { Badge21e8 } from '../components/ui/badge-21e8'

/**
 * Badge utility for rendering user badges based on their attributes
 * Supports 21e8 and other future badges
 */

export interface BadgeProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Get all applicable badges for a user
 * Returns array of badge components to render
 */
export function getUserBadges(user: any): React.ReactNode[] {
  const badges: React.ReactNode[] = []

  if (!user) return badges

  // 21e8 Badge - Twitter badge holder
  if (Number(user.twitterBadgeHolder) > 0) {
    badges.push(
      <Badge21e8
        key="21e8"
        className="w-4 h-4 ml-1"
        showTooltip={true}
      />
    )
  }

  // Add future badges here as needed
  // Example:
  // if (user.diamondLevel >= 3) {
  //   badges.push(<DiamondBadge key="diamond" />)
  // }

  return badges
}

/**
 * Render all badges for a user inline
 * Used for consistent badge rendering across the app
 */
export function BadgesInline({ user, className = '' }: { user: any; className?: string }) {
  const badges = getUserBadges(user)

  if (badges.length === 0) return null

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {badges}
    </span>
  )
}

/**
 * Render username with inline badges
 * Combines username text with badge components
 */
export function UsernameWithBadges({
  user,
  username,
  className = '',
  badgeSize = 'sm'
}: {
  user: any
  username: string
  className?: string
  badgeSize?: 'sm' | 'md' | 'lg'
}) {
  const badges = getUserBadges(user)

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span>{username}</span>
      {badges.length > 0 && (
        <span className="inline-flex items-center gap-0.5 ml-1">
          {badges}
        </span>
      )}
    </span>
  )
}
