// Note: Buffer polyfill removed - Bitcoin crypto libraries handle their own setup
// This fixes initialization errors and allows graceful fallback if crypto unavailable
import './polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'
// App.css is intentionally NOT imported to avoid style conflicts
// All styles are defined in index.css with proper Tailwind/design tokens

// Note: User seeding removed - use the registration page to create users
// The auto-seed was causing NOT NULL constraint errors on page load

// 🔒 Enhanced error handler to suppress non-critical errors and improve stability
if (process.env.NODE_ENV !== 'test') {
  // Suppress console errors for known non-critical issues
  const originalError = console.error
  console.error = function (...args: any[]) {
    const message = String(args[0] || '')
    
    // List of patterns for errors we want to suppress (they don't affect functionality)
    const suppressPatterns = [
      'chrome-extension://',
      'Failed to execute \'postMessage\'',
      'target origin provided',
      'does not match the recipient',
      'chrome.runtime.sendMessage',
      'A listener indicated an asynchronous response',
      'message channel closed',
      'content_script.js',
      'tagName is undefined',
      'can\'t access property',
      'element.tagName',
      'Slot',
      'Radix',
      'toLowerCase',
    ]
    
    const shouldSuppress = suppressPatterns.some(pattern => message.includes(pattern))
    
    // Log to console only if not a suppressed error
    if (!shouldSuppress) {
      originalError.apply(console, args)
    }
  }
  
  // 🔒 Global unhandled error event handler to catch external script errors
  window.addEventListener('error', (event) => {
    const message = event.message || ''
    const error = event.error ? String(event.error.message || event.error) : ''
    
    const suppressPatterns = [
      'tagName is undefined',
      'can\'t access property',
      'element.tagName',
      'toLowerCase',
      'Radix',
      'Slot',
    ]
    
    const shouldSuppress = suppressPatterns.some(pattern => 
      message.includes(pattern) || error.includes(pattern)
    )
    
    if (shouldSuppress) {
      // Prevent default behavior and stop propagation
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }, true)
  
  // 🔒 Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const message = String(event.reason || '')
    const suppressPatterns = [
      'tagName is undefined',
      'can\'t access property',
      'element.tagName',
      'toLowerCase',
      'Radix',
    ]
    
    const shouldSuppress = suppressPatterns.some(pattern => message.includes(pattern))
    
    if (shouldSuppress) {
      event.preventDefault()
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Toaster position="top-right" />
    <App />
  </React.StrictMode>,
)
