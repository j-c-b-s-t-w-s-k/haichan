import { useState, useEffect } from 'react'
import { isValidPoWAvailable } from '../lib/pow-validation'
import { MiningManager } from '../lib/mining/MiningManager'

/**
 * Hook to track if valid PoW is currently available
 * Returns true if PoW with hash starting with required prefix and points exists
 * Updates when mining sessions change
 */
export function usePoWValidity(minPrefix: string = '21e8', minPoints: number = 15): boolean {
  const [isValid, setIsValid] = useState<boolean>(isValidPoWAvailable(minPrefix, minPoints))

  useEffect(() => {
    const manager = MiningManager.getInstance()
    
    // Initial check
    setIsValid(isValidPoWAvailable(minPrefix, minPoints))

    // Subscribe to mining updates
    const unsubscribe = manager.subscribe(() => {
      setIsValid(isValidPoWAvailable(minPrefix, minPoints))
    })

    return unsubscribe
  }, [minPrefix, minPoints]) // Re-run if requirements change

  return isValid
}