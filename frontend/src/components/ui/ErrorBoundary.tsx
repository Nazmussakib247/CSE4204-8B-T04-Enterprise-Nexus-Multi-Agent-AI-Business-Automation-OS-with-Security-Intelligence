'use client'

import React from 'react'

interface Props { children: React.ReactNode; fallback?: React.ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-error-container flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[24px] text-error icon-filled">error</span>
          </div>
          <h2 className="font-display text-[16px] font-semibold text-on-surface mb-1">Something went wrong</h2>
          <p className="font-body text-[13px] text-on-surface-variant max-w-sm mb-4">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
