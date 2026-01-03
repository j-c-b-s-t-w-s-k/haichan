/**
 * Application-wide constants
 */

/**
 * Display name for the platform
 */
export const PLATFORM_NAME = 'Haichan'

/**
 * Minimum password length
 */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Userbase expansion epochs
 * Each epoch grants users 1 invite code (admin gets 10)
 */
export const EXPANSION_EPOCHS = [256, 512, 1024, 2048]

/**
 * Number of invite codes admin gets per epoch
 */
export const ADMIN_CODES_PER_EPOCH = 10

/**
 * Number of invite codes regular users get per epoch
 */
export const USER_CODES_PER_EPOCH = 1

/**
 * Username validation regex - alphanumeric only (A-Z, 0-9)
 */
export const USERNAME_REGEX = /^[A-Z0-9]+$/i

/**
 * Minimum username length
 */
export const MIN_USERNAME_LENGTH = 3

/**
 * Maximum username length
 */
export const MAX_USERNAME_LENGTH = 20

/**
 * Default PoW target points
 * Each point represents difficulty exponentially
 * 15 = ~10 seconds on average CPU
 * Must align with edge function minimum validation (21e8 = 15 points)
 */
export const POW_TARGET_POINTS = 15

/**
 * Estimated mining time in seconds for UI display
 */
export const POW_ESTIMATED_TIME = 10
