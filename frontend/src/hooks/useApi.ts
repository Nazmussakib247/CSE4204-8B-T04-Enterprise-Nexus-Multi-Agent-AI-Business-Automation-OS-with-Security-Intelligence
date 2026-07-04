/**
 * SWR-based data hooks for Enterprise NeXus
 * Replaces all useState+useEffect fetch patterns across pages.
 *
 * Usage:
 *   const { reports, total, isLoading, mutate } = useHRReports({ page: 1, recommendation: 'shortlist' })
 */

import useSWR from 'swr'
import { hrApi, financeApi, supportApi, analyticsApi, executiveApi, notificationsApi } from '@/lib/api'

// ── Generic fetcher ───────────────────────────────────────────
// SWR key is [apiFn, ...args]; apiFn is called as the fetcher.
const fetcher = async <T>([fn, ...args]: [(...a: unknown[]) => Promise<{ data: T }>, ...unknown[]]) => {
  const res = await fn(...args)
  return res.data as T
}

// ── Types ─────────────────────────────────────────────────────
export interface HRReport {
  id: string
  candidate_name: string
  job_title: string
  ai_score: number
  confidence: string
  recommendation: string
  narrative_summary: string
  score_breakdown: Record<string, number>
  created_at: string
}

export interface HRStats {
  total: number
  shortlisted: number
  rejected: number
  review: number
  avg_score: number
}

export interface FinanceRecord {
  id: string
  category: string
  amount: number
  expense_date: string
  description: string
  is_anomaly: boolean
  severity: string
  ai_note: string
  created_at: string
}

export interface FinanceStats {
  total_records: number
  total_amount: number
  anomaly_count: number
  anomaly_percentage: number
  categories: { category: string; total: number; count: number }[]
}

export interface SupportTicket {
  id: string
  query: string
  ai_response: string
  intent: string
  urgency: string
  sentiment: string
  confidence: string
  status: string
  escalated: boolean
  created_at: string
}

export interface SupportStats {
  total: number
  open: number
  in_progress: number
  resolved: number
  escalated: number
}

// ── HR Hooks ──────────────────────────────────────────────────
interface HRReportsParams {
  page?: number
  limit?: number
  recommendation?: string
}

export function useHRReports(params: HRReportsParams = {}) {
  const key = ['hrReports', JSON.stringify(params)]
  const { data, error, isLoading, mutate } = useSWR<{ data: HRReport[]; total: number }>(
    key,
    () => hrApi.getReports(params).then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  )
  return {
    reports: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  }
}

export function useHRReport(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: HRReport }>(
    id ? ['hrReport', id] : null,
    () => hrApi.getReport(id!).then((r) => r.data),
    { revalidateOnFocus: false }
  )
  return { report: data?.data ?? null, isLoading, error, mutate }
}

export function useHRStats() {
  const { data, error, isLoading, mutate } = useSWR<{ stats: HRStats }>(
    'hrStats',
    () => hrApi.getStats().then((r) => r.data),
    { revalidateOnFocus: false, refreshInterval: 30_000 }
  )
  return { stats: data?.stats ?? null, isLoading, error, mutate }
}

// ── Finance Hooks ─────────────────────────────────────────────
interface FinanceRecordsParams {
  page?: number
  limit?: number
  category?: string
  severity?: string
  from?: string
  to?: string
}

export function useFinanceRecords(params: FinanceRecordsParams = {}) {
  const { data, error, isLoading, mutate } = useSWR<{ data: FinanceRecord[]; total: number }>(
    ['financeRecords', JSON.stringify(params)],
    () => financeApi.getRecords(params).then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  )
  return {
    records: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  }
}

export function useFinanceRecord(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: FinanceRecord }>(
    id ? ['financeRecord', id] : null,
    () => financeApi.getRecord(id!).then((r) => r.data),
    { revalidateOnFocus: false }
  )
  return { record: data?.data ?? null, isLoading, error, mutate }
}

export function useFinanceStats() {
  const { data, error, isLoading, mutate } = useSWR<{ stats: FinanceStats }>(
    'financeStats',
    () => financeApi.getStats().then((r) => r.data),
    { revalidateOnFocus: false, refreshInterval: 30_000 }
  )
  return { stats: data?.stats ?? null, isLoading, error, mutate }
}

// ── Support Hooks ─────────────────────────────────────────────
interface SupportTicketsParams {
  page?: number
  limit?: number
  status?: string
  urgency?: string
  sentiment?: string
  escalated?: boolean
}

export function useSupportTickets(params: SupportTicketsParams = {}) {
  const { data, error, isLoading, mutate } = useSWR<{ data: SupportTicket[]; total: number }>(
    ['supportTickets', JSON.stringify(params)],
    () => supportApi.getTickets(params).then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  )
  return {
    tickets: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  }
}

export function useSupportTicket(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: SupportTicket }>(
    id ? ['supportTicket', id] : null,
    () => supportApi.getTicket(id!).then((r) => r.data),
    { revalidateOnFocus: false }
  )
  return { ticket: data?.data ?? null, isLoading, error, mutate }
}

export function useSupportStats() {
  const { data, error, isLoading, mutate } = useSWR<{ stats: SupportStats }>(
    'supportStats',
    () => supportApi.getStats().then((r) => r.data),
    { revalidateOnFocus: false, refreshInterval: 30_000 }
  )
  return { stats: data?.stats ?? null, isLoading, error, mutate }
}

// ── Analytics Hook ────────────────────────────────────────────
export function useAnalytics() {
  const { data, error, isLoading, mutate } = useSWR(
    'analytics',
    () => analyticsApi.getReport().then((r) => r.data),
    { revalidateOnFocus: false, refreshInterval: 60_000 }
  )
  return { analytics: data ?? null, isLoading, error, mutate }
}

// ── Executive Hook ────────────────────────────────────────────
export function useExecutive() {
  const { data, error, isLoading, mutate } = useSWR(
    'executive',
    () => executiveApi.getBriefing().then((r) => r.data),
    { revalidateOnFocus: false, refreshInterval: 60_000 }
  )
  return { briefing: data ?? null, isLoading, error, mutate }
}

// ── Notifications Hook ────────────────────────────────────────
export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR(
    'notifications',
    () => notificationsApi.getAll().then((r) => r.data),
    { revalidateOnFocus: true, refreshInterval: 15_000 }
  )
  return {
    notifications: data?.data ?? [],
    unreadCount: data?.unread_count ?? 0,
    isLoading,
    error,
    mutate,
  }
}
