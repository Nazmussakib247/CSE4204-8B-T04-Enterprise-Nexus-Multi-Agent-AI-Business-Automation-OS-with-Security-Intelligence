import { describe, it, expect } from 'vitest'
import { badgeColor } from '@/lib/badgeColor'

describe('badgeColor', () => {
  it('maps known values to the correct variant', () => {
    expect(badgeColor('recommendation', 'shortlist')).toBe('success')
    expect(badgeColor('recommendation', 'reject')).toBe('error')
    expect(badgeColor('severity', 'high')).toBe('error')
    expect(badgeColor('ticketStatus', 'open')).toBe('info')
    expect(badgeColor('ticketStatus', 'escalated')).toBe('error')
    expect(badgeColor('sentiment', 'neutral')).toBe('neutral')
    expect(badgeColor('performance', 'excellent')).toBe('success')
    expect(badgeColor('taskStatus', 'running')).toBe('info')
    expect(badgeColor('notificationType', 'warning')).toBe('warning')
  })

  it('falls back to neutral for unknown values', () => {
    expect(badgeColor('severity', 'catastrophic')).toBe('neutral')
    expect(badgeColor('taskStatus', '')).toBe('neutral')
  })

  it('falls back to neutral for null/undefined', () => {
    expect(badgeColor('urgency', null)).toBe('neutral')
    expect(badgeColor('confidence', undefined)).toBe('neutral')
  })

  it('never returns undefined for any category', () => {
    const categories = [
      'recommendation', 'severity', 'ticketStatus', 'urgency', 'sentiment',
      'performance', 'confidence', 'taskStatus', 'notificationType',
    ] as const
    for (const c of categories) {
      expect(typeof badgeColor(c, 'anything')).toBe('string')
    }
  })
})
