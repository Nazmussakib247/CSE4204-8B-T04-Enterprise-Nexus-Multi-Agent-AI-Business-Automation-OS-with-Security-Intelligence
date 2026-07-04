/**
 * badgeColor(type, value) → Badge variant string
 *
 * Single source of truth for all colour mappings.
 * Replaces the 8+ inline switch/ternary chains scattered across pages.
 *
 * Usage:
 *   import { badgeColor } from '@/lib/badgeColor'
 *   <Badge label={status} variant={badgeColor('ticketStatus', status)} />
 */

import type { Variant } from '@/components/ui/Badge'
import type {
  RecommendationType,
  SeverityLevel,
  TicketStatus,
  UrgencyLevel,
  SentimentType,
  PerformanceRating,
  ConfidenceLevel,
  TaskStatus,
  NotificationType,
} from '@/constants'

// ── Map types ─────────────────────────────────────────────────

const RECOMMENDATION_COLORS: Record<RecommendationType, Variant> = {
  shortlist: 'success',
  reject: 'error',
  review: 'warning',
}

const SEVERITY_COLORS: Record<SeverityLevel, Variant> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
}

const TICKET_STATUS_COLORS: Record<TicketStatus, Variant> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  escalated: 'error',
}

const URGENCY_COLORS: Record<UrgencyLevel, Variant> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
}

const SENTIMENT_COLORS: Record<SentimentType, Variant> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'error',
}

const PERFORMANCE_COLORS: Record<PerformanceRating, Variant> = {
  excellent: 'success',
  good: 'info',
  average: 'warning',
  poor: 'error',
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, Variant> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
}

const TASK_STATUS_COLORS: Record<TaskStatus, Variant> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'error',
}

const NOTIFICATION_TYPE_COLORS: Record<NotificationType, Variant> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
}

// ── Discriminated lookup ──────────────────────────────────────

type BadgeColorType =
  | 'recommendation'
  | 'severity'
  | 'ticketStatus'
  | 'urgency'
  | 'sentiment'
  | 'performance'
  | 'confidence'
  | 'taskStatus'
  | 'notificationType'

const MAPS: Record<BadgeColorType, Record<string, Variant>> = {
  recommendation: RECOMMENDATION_COLORS,
  severity: SEVERITY_COLORS,
  ticketStatus: TICKET_STATUS_COLORS,
  urgency: URGENCY_COLORS,
  sentiment: SENTIMENT_COLORS,
  performance: PERFORMANCE_COLORS,
  confidence: CONFIDENCE_COLORS,
  taskStatus: TASK_STATUS_COLORS,
  notificationType: NOTIFICATION_TYPE_COLORS,
}

/**
 * Returns the Badge `variant` for a given category + value.
 * Falls back to `'neutral'` for any unknown value.
 */
export function badgeColor(type: BadgeColorType, value: string | undefined | null): Variant {
  if (!value) return 'neutral'
  return MAPS[type]?.[value] ?? 'neutral'
}
