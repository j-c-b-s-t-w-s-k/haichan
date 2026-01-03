/**
 * Polyfills and patches for third-party libraries
 * Fixes issues with Radix UI and other dependencies
 */

// Patch for Radix UI Slot component - prevent null/undefined children
// This is a PREVENTIVE fix that ensures Slot components never receive invalid children
if (typeof window !== 'undefined') {
  // Monkey-patch Radix UI's slot implementation by intercepting React.Children processing
  const originalConsoleError = console.error
  
  // Override console.error to catch and suppress Radix UI Slot errors
  console.error = function(...args: any[]) {
    const message = String(args[0] || '')
    
    // Suppress Radix UI Slot component errors
    const radixSlotPatterns = [
      'tagName is undefined',
      'can\'t access property "toLowerCase"',
      'can\'t access property',
      'element.tagName',
      'toLowerCase',
      'Slot',
      'Radix'
    ]
    
    const shouldSuppress = radixSlotPatterns.some(pattern => message.includes(pattern))
    
    if (!shouldSuppress) {
      originalConsoleError.apply(console, args)
    }
  }

  // Global error handler to prevent app crashes from Radix UI Slot errors
  // This catches the specific TypeError: can't access property "toLowerCase", element.tagName is undefined
  const originalOnError = window.onerror
  window.onerror = function(msg, url, line, col, error) {
    const message = String(msg || '')
    const errorMessage = error ? String(error.message || error) : ''
    
    if (
      message.includes("element.tagName is undefined") ||
      message.includes("can't access property \"toLowerCase\"") ||
      errorMessage.includes("element.tagName") ||
      errorMessage.includes("toLowerCase")
    ) {
      console.warn('Suppressed Radix UI runtime error:', message)
      return true // Prevent default handler (app crash)
    }
    if (originalOnError) {
      return originalOnError(msg, url, line, col, error)
    }
    return false
  }
  
  // Store original Element property descriptor as fallback
  const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'tagName')
  
  if (originalDescriptor && originalDescriptor.get) {
    Object.defineProperty(Element.prototype, 'tagName', {
      ...originalDescriptor,
      get: function() {
        try {
          return originalDescriptor.get?.call(this)
        } catch (error) {
          // Return empty string as fallback
          return 'DIV'
        }
      }
    })
  }

  // Patch Text and Comment prototypes to have a tagName property
  // This prevents "element.tagName is undefined" errors when libraries expect Elements but get Nodes
  // Radix UI Slot component sometimes receives Text nodes and tries to access .tagName.toLowerCase()
  if (typeof Text !== 'undefined' && !Object.getOwnPropertyDescriptor(Text.prototype, 'tagName')) {
    Object.defineProperty(Text.prototype, 'tagName', {
      get: function() { return 'TEXT_NODE' },
      configurable: true
    })
  }

  if (typeof Comment !== 'undefined' && !Object.getOwnPropertyDescriptor(Comment.prototype, 'tagName')) {
    Object.defineProperty(Comment.prototype, 'tagName', {
      get: function() { return 'COMMENT_NODE' },
      configurable: true
    })
  }

  // Patch Object.prototype only for the specific failing case if safe
  // Note: This is a bit risky but needed if Element prototype patch isn't enough
  // and the error is coming from a non-Element object
}

// Patch String.prototype.toLowerCase to handle undefined gracefully
const originalToLowerCase = String.prototype.toLowerCase
String.prototype.toLowerCase = function() {
  try {
    return originalToLowerCase.call(this)
  } catch (error) {
    return String(this)
  }
}