'use client'

/**
 * WelcomeTour — Onboarding modal shown once on first login.
 * Matches UI Design screen 02 (multi-step welcome tour).
 *
 * Storage: localStorage key 'nexus_tour_completed'
 * Usage: Mount in (dashboard)/layout.tsx — it self-manages visibility.
 */

import { useState, useEffect } from 'react'
import { X, ArrowRight, ArrowLeft, CheckCircle2, BarChart2, Users, Headphones, TrendingUp, Briefcase } from 'lucide-react'
import clsx from 'clsx'

// ── Tour steps ────────────────────────────────────────────────
const STEPS = [
  {
    icon: <Briefcase className="w-10 h-10 text-primary" />,
    title: 'Welcome to Enterprise NeXus',
    description:
      'Your AI-powered command centre for HR, Finance, and Support — all in one platform. Let's take a quick look at what you can do.',
    badge: '1 of 5',
  },
  {
    icon: <Users className="w-10 h-10 text-primary" />,
    title: 'HR — Candidate Screening',
    description:
      'Upload CVs and let our Gemini AI score candidates in seconds. Get shortlist recommendations, confidence levels, and detailed narrative summaries.',
    badge: '2 of 5',
  },
  {
    icon: <TrendingUp className="w-10 h-10 text-primary" />,
    title: 'Finance — Anomaly Detection',
    description:
      'Log transactions and get instant AI anomaly detection. High-severity flags are highlighted so your team can act fast.',
    badge: '3 of 5',
  },
  {
    icon: <Headphones className="w-10 h-10 text-primary" />,
    title: 'Support — AI Ticket Triage',
    description:
      'Submit support queries and receive AI-generated responses with intent, urgency, and sentiment analysis — automatically escalating critical issues.',
    badge: '4 of 5',
  },
  {
    icon: <BarChart2 className="w-10 h-10 text-primary" />,
    title: 'Analytics & Executive Briefings',
    description:
      'Track KPIs across all departments and generate AI executive briefings with one click. Everything you need to stay ahead.',
    badge: '5 of 5',
  },
]

const STORAGE_KEY = 'nexus_tour_completed'

export default function WelcomeTour() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) setVisible(true)
    } catch {
      // SSR or storage blocked — skip tour
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {/* noop */}
    setVisible(false)
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else dismiss()
  }

  const prev = () => setStep((s) => Math.max(0, s - 1))

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      {/* Card */}
      <div className="relative w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-surface-container-high">
          <div
            className="h-1 bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="px-8 pt-10 pb-6 text-center">
          {/* Step badge */}
          <span className="text-label-caps font-mono text-xs uppercase tracking-widest text-on-surface-variant">
            {current.badge}
          </span>

          {/* Icon */}
          <div className="flex justify-center mt-4 mb-5">
            <div className="w-20 h-20 rounded-2xl bg-primary-container/20 flex items-center justify-center">
              {current.icon}
            </div>
          </div>

          {/* Text */}
          <h2 className="text-title-large font-semibold text-on-surface mb-3">
            {current.title}
          </h2>
          <p className="text-body-medium text-on-surface-variant leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 pb-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={clsx(
                'w-2 h-2 rounded-full transition-all duration-300',
                i === step ? 'bg-primary w-5' : 'bg-surface-container-high'
              )}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-outline-variant">
          <button
            onClick={prev}
            disabled={step === 0}
            className={clsx(
              'flex items-center gap-1.5 text-sm font-medium transition-opacity',
              step === 0 ? 'opacity-0 pointer-events-none' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={dismiss}
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Skip tour
          </button>

          <button
            onClick={next}
            className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {isLast ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Get started
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
