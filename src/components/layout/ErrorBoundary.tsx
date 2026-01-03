import React, { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary Component
 * Catches errors that occur in child components and prevents them from crashing the app
 * This is especially useful for catching Radix UI Slot errors gracefully
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log errors
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Show error UI for real errors
      return (
        <div className='w-full h-screen flex items-center justify-center p-6'>
          <div className='max-w-md w-full border-2 border-red-500 p-6 rounded'>
            <h1 className='text-2xl font-bold font-mono text-red-600 mb-4'>Error</h1>
            <p className='font-mono text-sm mb-4'>An unexpected error occurred:</p>
            <pre className='font-mono text-xs overflow-auto max-h-32 p-3 bg-red-50 border border-red-200 rounded mb-4'>
              {this.state.error.message}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className='w-full px-4 py-2 bg-red-600 text-white font-mono text-sm rounded hover:bg-red-700'
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
