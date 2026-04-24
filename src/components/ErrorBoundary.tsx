'use client'

// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Error Boundary
// Catches React render errors, displays fallback UI
// ═══════════════════════════════════════════════════════════════════

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Structured log (server-side won't see this, but console is available)
    console.error('[ErrorBoundary] Module crash:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              {this.props.fallbackTitle || 'Modul Hatasi'}
            </h3>
            <p className="text-sm text-text-tertiary max-w-md">
              Bu modulde beklenmeyen bir hata olustu. Sayfayi yenileyebilir veya asagidaki butona tiklayabilirsiniz.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400/60 mt-2 font-mono max-w-lg break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-3 border border-stroke text-sm text-text-secondary hover:bg-surface-4 hover:text-white transition-all"
          >
            <RefreshCw size={14} />
            Tekrar Dene
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
