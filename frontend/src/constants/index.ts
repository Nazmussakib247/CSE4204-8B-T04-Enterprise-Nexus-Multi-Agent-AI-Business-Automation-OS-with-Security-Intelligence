// ── Roles ─────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// ── HR ────────────────────────────────────────────────────────
export const RECOMMENDATION_TYPES = {
  SHORTLIST: 'shortlist',
  REJECT: 'reject',
  REVIEW: 'review',
} as const

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[keyof typeof RECOMMENDATION_TYPES]

export const CONFIDENCE_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS]

// ── Finance ───────────────────────────────────────────────────
export const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

export type SeverityLevel = (typeof SEVERITY_LEVELS)[keyof typeof SEVERITY_LEVELS]

export const FINANCE_CATEGORIES = [
  'Travel',
  'Software',
  'Hardware',
  'Marketing',
  'Salaries',
  'Infrastructure',
  'Training',
  'Legal',
  'Office',
  'Other',
] as const

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number]

// ── Support ───────────────────────────────────────────────────
export const TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated',
} as const

export type TicketStatus = (typeof TICKET_STATUSES)[keyof typeof TICKET_STATUSES]

export const URGENCY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

export type UrgencyLevel = (typeof URGENCY_LEVELS)[keyof typeof URGENCY_LEVELS]

export const SENTIMENT_TYPES = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
} as const

export type SentimentType = (typeof SENTIMENT_TYPES)[keyof typeof SENTIMENT_TYPES]

// ── Analytics ─────────────────────────────────────────────────
export const PERFORMANCE_RATINGS = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  AVERAGE: 'average',
  POOR: 'poor',
} as const

export type PerformanceRating = (typeof PERFORMANCE_RATINGS)[keyof typeof PERFORMANCE_RATINGS]

// ── Tasks ─────────────────────────────────────────────────────
export const TASK_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES]

export const AGENT_TYPES = {
  HR: 'hr',
  FINANCE: 'finance',
  SUPPORT: 'support',
  ANALYTICS: 'analytics',
  EXECUTIVE: 'executive',
} as const

export type AgentType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES]

// ── Notifications ─────────────────────────────────────────────
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

// ── Pagination ────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
