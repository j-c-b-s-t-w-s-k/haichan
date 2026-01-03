/**
 * Polyfills for third-party library compatibility
 * Note: Removed prototype modifications that could cause security issues
 */

// Add tagName to Text/Comment nodes for libraries that expect Elements
// This is a safe patch that doesn't modify String.prototype
if (typeof window !== 'undefined') {
  // Patch Text nodes to have a tagName property (read-only)
  if (typeof Text !== 'undefined' && !Object.getOwnPropertyDescriptor(Text.prototype, 'tagName')) {
    Object.defineProperty(Text.prototype, 'tagName', {
      get: function() { return 'TEXT_NODE' },
      configurable: true
    })
  }

  // Patch Comment nodes to have a tagName property (read-only)
  if (typeof Comment !== 'undefined' && !Object.getOwnPropertyDescriptor(Comment.prototype, 'tagName')) {
    Object.defineProperty(Comment.prototype, 'tagName', {
      get: function() { return 'COMMENT_NODE' },
      configurable: true
    })
  }
}
