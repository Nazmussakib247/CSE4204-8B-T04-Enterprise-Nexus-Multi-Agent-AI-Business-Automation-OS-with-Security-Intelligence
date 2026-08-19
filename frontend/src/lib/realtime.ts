'use client'

/**
 * Supabase Realtime helpers — replaces setInterval polling.
 * Uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Degrades gracefully: when env is missing, hooks fall back to slow polling.
 */
import { useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let warned = false

export function getRealtimeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || key.includes('your-anon-key')) {
    if (!warned) {
      console.warn('[realtime] NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY not configured — falling back to polling')
      warned = true
    }
    return null
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

export interface RealtimeChangePayload {
  eventType: string
  new: Record<string, unknown> | null
  old: Record<string, unknown> | null
  table: string
}

/**
 * Subscribe to INSERT/UPDATE/DELETE on the given tables and invoke onChange.
 * Falls back to interval polling (fallbackMs) when Realtime is unavailable.
 */
export function useRealtimeRefresh(
  tables: string[],
  onChange: (payload?: RealtimeChangePayload) => void,
  fallbackMs = 60_000,
) {
  const cbRef = useRef(onChange)
  cbRef.current = onChange

  // Stable key so a caller passing a new array literal each render doesn't
  // tear down and recreate the subscription.
  const tablesKey = tables.join(',')

  useEffect(() => {
    const supa = getRealtimeClient()

    if (!supa) {
      const t = setInterval(() => cbRef.current(), fallbackMs)
      return () => clearInterval(t)
    }

    const tableList = tablesKey.split(',').filter(Boolean)
    const channel = supa.channel(`nexus:${tableList.join('+')}`)
    for (const table of tableList) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: { eventType: string; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) =>
          cbRef.current({ ...payload, table }),
      )
    }
    channel.subscribe()

    return () => { supa.removeChannel(channel) }
  }, [tablesKey, fallbackMs])
}
