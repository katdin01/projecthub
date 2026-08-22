import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Something went wrong</h1>
          <p className="max-w-md text-sm text-slate-500">{this.state.error.message}</p>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
