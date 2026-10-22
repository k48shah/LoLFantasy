import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="hex-clip h-14 w-14 bg-red-500/70" />
        <h1 className="font-display text-2xl text-gold-100">Something broke</h1>
        <p className="text-sm text-slate-400">The page hit an unexpected error. Your picks and rosters are safe on the server — reload to carry on.</p>
        <pre className="max-h-32 w-full overflow-auto rounded-lg bg-black/40 p-3 text-left text-xs text-red-300">{this.state.error.message}</pre>
        <button className="btn-gold" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
