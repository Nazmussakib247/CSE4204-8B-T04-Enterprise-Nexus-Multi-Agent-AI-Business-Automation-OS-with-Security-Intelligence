'use client'

import { useState } from 'react'

interface DemoCredentialsProps {
  title: string
  email: string
  password: string
}

export default function DemoCredentials({ title, email, password }: DemoCredentialsProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (key: string, value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const input = document.createElement('textarea')
        input.value = value
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setCopied(key)
      window.setTimeout(() => setCopied(current => current === key ? null : current), 1400)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-label={`${title} credentials`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary text-[19px] mt-0.5">present_to_all</span>
          <div>
            <p className="font-body text-[13px] font-semibold text-on-surface">{title}</p>
            <p className="font-body text-[11px] text-on-surface-variant mt-0.5">Quick access for exhibition preview</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => copy('all', `Email: ${email}\nPassword: ${password}`)}
          className="shrink-0 rounded-lg border border-primary/30 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
        >
          {copied === 'all' ? 'Copied' : 'Copy all'}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {[
          { key: 'email', label: 'Email', value: email },
          { key: 'password', label: 'Password', value: password },
        ].map(item => (
          <div key={item.key} className="flex items-center gap-2 rounded-lg bg-white/70 border border-outline-variant/60 px-3 py-2">
            <span className="w-[62px] shrink-0 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">{item.label}</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-on-surface">{item.value}</code>
            <button
              type="button"
              onClick={() => copy(item.key, item.value)}
              aria-label={`Copy demo ${item.label.toLowerCase()}`}
              className="shrink-0 text-primary hover:text-primary-container transition-colors p-1"
            >
              <span className="material-symbols-outlined text-[17px]">{copied === item.key ? 'check' : 'content_copy'}</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
