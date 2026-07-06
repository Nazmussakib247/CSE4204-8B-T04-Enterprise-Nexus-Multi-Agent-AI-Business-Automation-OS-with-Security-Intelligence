'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTableRows } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

interface User {
  id: string
  name: string
  email: string
  is_active: boolean
  created_at: string
  roles?: { name: string } | null
}

interface Role {
  id: string
  name: string
  description: string
}

const roleBadge = (role: string) =>
  role === 'admin' ? 'bg-error-container text-on-error-container' :
  role === 'manager' ? 'bg-primary-container/10 text-primary' :
  'bg-surface-container text-on-surface-variant'

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Redirect non-admins
  useEffect(() => {
    const u = user as { role?: string } | null
    if (u && u.role && u.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  const fetchUsers = useCallback((q = '') => {
    setLoading(true)
    const params: Record<string, unknown> = { limit: 50 }
    if (q) params.search = q
    adminApi.listUsers(params)
      .then(r => { setUsers(r.data.data ?? []); setTotal(r.data.total ?? 0) })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchUsers()
    adminApi.listRoles().then(r => setRoles(r.data.data ?? [])).catch(() => {})
  }, [fetchUsers])

  // Search with debounce
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(search), 300)
    return () => clearTimeout(t)
  }, [search, fetchUsers])

  const handleRoleChange = async (userId: string, role: string) => {
    setActionLoading(`role-${userId}`)
    try {
      await adminApi.updateUserRole(userId, role)
      setUsers(u => u.map(x => x.id === userId ? { ...x, roles: { name: role } } : x))
      toast.success('Role updated')
    } catch {
      toast.error('Failed to update role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleStatus = async (u: User) => {
    setActionLoading(`status-${u.id}`)
    try {
      await adminApi.toggleUserStatus(u.id, !u.is_active)
      setUsers(users => users.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x))
      toast.success(`User ${!u.is_active ? 'activated' : 'deactivated'}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      <PageHeader
        title="Admin Panel"
        subtitle="User management, roles, and access control"
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: total, icon: 'group', color: 'text-primary-container', bg: 'bg-primary-container/10' },
          { label: 'Active', value: users.filter(u => u.is_active).length, icon: 'check_circle', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Inactive', value: users.filter(u => !u.is_active).length, icon: 'block', color: 'text-error', bg: 'bg-error-container' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-outline-variant/50 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
              <span className={`material-symbols-outlined text-[20px] icon-filled ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <p className="font-display text-[26px] font-bold text-on-surface leading-none">{s.value}</p>
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-wrap gap-3">
          <h3 className="font-display text-[15px] font-semibold text-on-surface">Users</h3>
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body text-[13px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container transition-all w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-surface-container-low">
                {['User', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <SkeletonTableRows cols={6} rows={8} />
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="p-10">
                  <EmptyState icon="group" title="No users found" description={search ? 'Try a different search term.' : 'No users registered yet.'} />
                </td></tr>
              ) : users.map(u => (
                <tr key={u.id} className={`hover:bg-surface-container-low/50 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                  {/* Name + avatar */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                        style={{ background: u.is_active ? 'linear-gradient(135deg, #00c2a8, #006b5c)' : '#94a3b8' }}>
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-body text-[13px] font-medium text-on-surface">{u.name}</p>
                        {u.id === (user as { id?: string })?.id && (
                          <span className="font-mono text-[9px] text-primary-container uppercase tracking-wider">You</span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 font-mono text-[12px] text-on-surface-variant">{u.email}</td>

                  {/* Role selector */}
                  <td className="px-5 py-4">
                    <div className="relative">
                      <select
                        value={u.roles?.name ?? 'employee'}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        disabled={actionLoading === `role-${u.id}` || u.id === (user as { id?: string })?.id}
                        className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg border appearance-none pr-6 cursor-pointer transition-all disabled:cursor-not-allowed ${roleBadge(u.roles?.name ?? 'employee')} border-transparent focus:border-primary-container focus:outline-none`}
                      >
                        {roles.length > 0 ? roles.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        )) : (
                          ['admin', 'manager', 'employee'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))
                        )}
                      </select>
                      <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none text-current opacity-60">
                        {actionLoading === `role-${u.id}` ? 'hourglass_empty' : 'expand_more'}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${u.is_active ? 'bg-primary-container/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Joined date */}
                  <td className="px-5 py-4 font-mono text-[11px] text-on-surface-variant">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>

                  {/* Toggle active */}
                  <td className="px-5 py-4">
                    {u.id !== (user as { id?: string })?.id && (
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={actionLoading === `status-${u.id}`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider border transition-all disabled:opacity-50 ${
                          u.is_active
                            ? 'border-error/30 text-error hover:bg-error-container/20'
                            : 'border-primary-container/40 text-primary hover:bg-primary-container/10'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {actionLoading === `status-${u.id}` ? 'hourglass_empty' : u.is_active ? 'block' : 'check_circle'}
                        </span>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
