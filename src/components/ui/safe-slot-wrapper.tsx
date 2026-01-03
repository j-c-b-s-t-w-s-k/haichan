/**
 * Safe Slot Wrapper Component
 * Prevents null/undefined children errors in Radix UI Slot components
 * This wrapper ensures Slot always receives valid React elements
 */

import React from 'react'
import { Slot } from '@radix-ui/react-slot'

interface SafeSlotWrapperProps {
  asChild?: boolean
  children?: React.ReactNode
  className?: string
  [key: string]: any
}

/**
 * SafeSlotWrapper ensures that Slot components never receive null/undefined children
 * If children are null/undefined, it renders nothing instead of letting Slot fail
 */
export const SafeSlotWrapper = React.forwardRef<HTMLDivElement, SafeSlotWrapperProps>(
  ({ asChild = false, children, ...props }, ref) => {
    // If no valid children, don't use Slot (which would error)
    if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) {
      return null
    }

    const Component = asChild ? Slot : 'div'
    return (
      <Component ref={ref} {...props}>
        {children}
      </Component>
    )
  }
)

SafeSlotWrapper.displayName = 'SafeSlotWrapper'

export default SafeSlotWrapper
