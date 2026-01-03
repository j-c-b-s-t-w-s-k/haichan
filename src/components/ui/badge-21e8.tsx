import React from 'react';
import { cn } from '../../lib/utils';

interface Badge21e8Props {
  className?: string;
  showTooltip?: boolean;
}

/**
 * 21e8 Badge Component - Displays a neon cyan/green badge for Twitter 21e8 badge holders
 * Styled as a compact badge similar to X/Twitter verification badges
 */
export const Badge21e8: React.FC<Badge21e8Props> = ({ className, showTooltip = true }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center relative',
        'w-5 h-5 ml-1.5',
        'rounded-full',
        'bg-gradient-to-br from-cyan-500 via-cyan-400 to-green-400',
        'border border-cyan-300/50',
        'shadow-lg shadow-cyan-500/50',
        'animate-pulse',
        className
      )}
      title={showTooltip ? '21e8 Badge Holder' : undefined}
    >
      <div className="absolute inset-0.5 rounded-full bg-black/80 flex items-center justify-center">
        <span className="text-xs font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-green-400">
          ∞
        </span>
      </div>
    </div>
  );
};

export default Badge21e8;
