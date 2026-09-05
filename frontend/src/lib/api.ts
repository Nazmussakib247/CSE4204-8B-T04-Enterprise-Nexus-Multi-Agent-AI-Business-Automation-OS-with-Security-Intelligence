import axios from 'axios'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

/** Extract the backend's error message from an unknown thrown value. */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
  }
  return fallback
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const url = original?.url || ''
    const isAuthCheck =
      url.includes('/auth/me') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register')
    if (err.response?.status === 401 && !original._retry && !isAuthCheck) {
      original._retry = true
      try {
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
        return api(original)
      } catch {
        if (typeof window !== 'undefined') {
          const authPaths = ['/login', '/register', '/forgot-password', '/reset-password']
          const onAuthPage = authPaths.some((p) => window.location.pathname.startsWith(p))
          if (!onAuthPage) window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  registerExternal: (name: string, email: string, password: string, role: 'customer' | 'candidate') =>
    api.post('/auth/register-external', { name, email, password, role }),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateMe: (data: { name?: string; password?: string; notification_prefs?: Record<string, boolean> }) =>
    api.patch('/auth/me', data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
}

export const jobsApi = {
  getOpen: () => api.get('/jobs'),
  get: (id: string) => api.get(`/jobs/${id}`),
  getAllForStaff: () => api.get('/jobs/admin/all'),
  create: (data: Record<string, unknown>) => api.post('/jobs', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/jobs/${id}`, data),
  remove: (id: string) => api.delete(`/jobs/${id}`),
  apply: (id: string, formData: FormData) => api.post(`/jobs/${id}/applications`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getApplications: (id: string) => api.get(`/jobs/${id}/applications`),
  updateApplication: (jobId: string, applicationId: string, status: string) => api.patch(`/jobs/${jobId}/applications/${applicationId}`, { status }),
  removeApplication: (jobId: string, applicationId: string) => api.delete(`/jobs/${jobId}/applications/${applicationId}`),
  confirmAndNotify: (id: string, application_ids: string[], message?: string) => api.post(`/jobs/${id}/applications/confirm-notify`, { application_ids, message }),
}

export const ordersApi = {
  create: (product_id: string, quantity = 1) => api.post('/orders', { product_id, quantity }),
  getAll: (params?: Record<string, unknown>) => api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
}

export interface StoreProduct {
  id: string; slug: string; name: string; tagline: string; description: string
  price: number; icon: string; highlights: string[]; specs: { label: string; value: string }[]
}

export const productsApi = {
  list: () => api.get('/products'),
  getBySlug: (slug: string) => api.get(`/products/${slug}`),
}

export const reviewsApi = {
  getForProduct: (productId: string) => api.get(`/reviews/products/${productId}`),
  create: (data: { product_id: string; rating: number; comment: string }) => api.post('/reviews', data),
  getFlagged: () => api.get('/reviews/flagged'),
}

export const hrApi = {
  getReports: (params?: Record<string, unknown>) =>
    api.get('/hr/reports', { params }),
  getReport: (id: string) => api.get(`/hr/reports/${id}`),
  createReport: (data: Record<string, unknown>) => api.post('/hr/reports', data),
  updateReport: (id: string, data: Record<string, unknown>) =>
    api.patch(`/hr/reports/${id}`, data),
  deleteReport: (id: string) => api.delete(`/hr/reports/${id}`),
  getStats: () => api.get('/hr/stats'),
}

export const hrUploadApi = {
  uploadCV: (formData: FormData) =>
    api.post('/hr/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export const financeApi = {
  getRecords: (params?: Record<string, unknown>) =>
    api.get('/finance/records', { params }),
  getRecord: (id: string) => api.get(`/finance/records/${id}`),
  createRecord: (data: Record<string, unknown>) => api.post('/finance/records', data),
  updateRecord: (id: string, data: Record<string, unknown>) =>
    api.patch(`/finance/records/${id}`, data),
  deleteRecord: (id: string) => api.delete(`/finance/records/${id}`),
  getAnomalies: () => api.get('/finance/anomalies'),
  getSummary: () => api.get('/finance/summary'),
  uploadInvoice: (formData: FormData) =>
    api.post('/finance/upload/invoice', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  bulkUpload: (formData: FormData) =>
    api.post('/finance/upload/bulk', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export const supportApi = {
  getTickets: (params?: Record<string, unknown>) =>
    api.get('/support/tickets', { params }),
  getTicket: (id: string) => api.get(`/support/tickets/${id}`),
  createTicket: (data: Record<string, unknown>) => api.post('/support/tickets', data),
  updateTicket: (id: string, data: Record<string, unknown>) =>
    api.patch(`/support/tickets/${id}`, data),
  escalateTicket: (id: string) => api.patch(`/support/tickets/${id}/escalate`),
  resolveTicket: (id: string) => api.patch(`/support/tickets/${id}/resolve`),
  getSentimentReport: () => api.get('/support/sentiment-report'),
}

export const analyticsApi = {
  getReports: (params?: Record<string, unknown>) =>
    api.get('/analytics/reports', { params }),
  getReport: (id: string) => api.get(`/analytics/reports/${id}`),
  createReport: (data: Record<string, unknown>) => api.post('/analytics/reports', data),
  generateReport: () => api.post('/analytics/generate'),
  getLatestKPI: () => api.get('/analytics/kpi'),
  deleteReport: (id: string) => api.delete(`/analytics/reports/${id}`),
}

export const executiveApi = {
  getReports: () => api.get('/executive/reports'),
  getLatestReport: () => api.get('/executive/reports/latest'),
  createReport: (data: Record<string, unknown>) => api.post('/executive/reports', data),
  getDailyBriefing: () => api.get('/executive/briefing'),
  downloadBriefingPdf: () =>
    api.get('/executive/briefing/pdf', { responseType: 'blob' }),
  askAI: (question: string) => api.post('/executive/ask', { question }),
}

export const tasksApi = {
  getTasks: (params?: Record<string, unknown>) => api.get('/tasks', { params }),
  createTask: (agent_type: string, load?: Record<string, unknown>) =>
    api.post('/tasks', { agent_type, load }),
  getTask: (id: string) => api.get(`/tasks/${id}`),
  updateTaskStatus: (id: string, status: string, result?: Record<string, unknown>) =>
    api.patch(`/tasks/${id}/status`, { status, result }),
}

export const securityApi = {
  getAuditLogs: (params?: Record<string, unknown>) =>
    api.get('/security/audit-logs', { params }),
  getStats: () => api.get('/security/stats'),
}

export const notificationsApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
}

export const searchApi = {
  search: (q: string, limit = 8) =>
    api.get('/search', { params: { q, limit } }),
}

export interface KnowledgeDoc {
  source_id: string
  title: string
  chunks: number
  created_at: string
}

export interface AgentActivityEntry {
  id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown> | null
  success: boolean
  created_at: string
}

export const agentActivityApi = {
  list: (limit = 50) =>
    api.get<{ data: AgentActivityEntry[] }>('/v1/agents/activity', { params: { limit } }),
}

export const knowledgeApi = {
  list: () => api.get<{ data: KnowledgeDoc[] }>('/v1/admin/knowledge'),
  upload: (file: File, title?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (title) fd.append('title', title)
    return api.post('/v1/admin/knowledge', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  remove: (sourceId: string) => api.delete(`/v1/admin/knowledge/${sourceId}`),
}

export const adminApi = {
  listUsers: (params?: Record<string, unknown>) =>
    api.get('/admin/users', { params }),
  listRoles: () => api.get('/admin/roles'),
  updateUserRole: (id: string, role: string) =>
    api.patch(`/admin/users/${id}/role`, { role }),
  toggleUserStatus: (id: string, is_active: boolean) =>
    api.patch(`/admin/users/${id}/status`, { is_active }),
}

export interface AgentStep {
  tool: string
  args: Record<string, unknown>
  result_summary: string
  success: boolean
}
export interface AgentSource {
  title: string
  snippet: string
}
export interface AgentChatResponse {
  agent: string
  answer: string
  sources?: AgentSource[]
  steps: AgentStep[]
}

export const agentsApi = {
  // Agents are exposed under /api/v1 only (no legacy /api alias)
  chat: (agent: 'hr' | 'finance' | 'support' | 'analytics', message: string) =>
    api.post<AgentChatResponse>(`/v1/agents/${agent}/chat`, { message }),
}

// ── Executive orchestrator chat ───────────────────────────────
export interface Delegation {
  agent: string
  label?: string
  question?: string
  status: 'started' | 'completed' | 'failed'
  answer_preview?: string
  sub_steps?: string[]
}
export interface AgentConversation {
  id: string
  title: string | null
  summary: string | null
  created_at: string
  updated_at: string
}
export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  metadata: { delegations?: Delegation[] } | null
  created_at: string
}

export const executiveChatApi = {
  conversations: () => api.get<{ data: AgentConversation[] }>('/v1/executive/conversations'),
  messages: (id: string) =>
    api.get<{ data: AgentMessage[] }>(`/v1/executive/conversations/${id}/messages`),
}

export interface AskStreamHandlers {
  onToken: (text: string) => void
  onDelegation: (d: Delegation) => void
  onDone: (payload: { conversation_id: string; delegations: Delegation[] }) => void
  onError: (message: string) => void
}

/** Stream POST /v1/executive/ask via fetch + ReadableStream (SSE). */
export async function executiveAskStream(
  question: string,
  conversationId: string | null,
  handlers: AskStreamHandlers,
): Promise<void> {
  const res = await fetch(`${API_URL}/v1/executive/ask`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ question, ...(conversationId ? { conversation_id: conversationId } : {}) }),
  })

  if (!res.ok || !res.body) {
    let msg = 'Agent request failed'
    try {
      const j = await res.json()
      msg = j.error || msg
    } catch { /* not json */ }
    handlers.onError(msg)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleFrame = (frame: string) => {
    let event = 'message'
    let data = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim()
      else if (line.startsWith('data: ')) data += line.slice(6)
    }
    if (!data) return
    try {
      const parsed = JSON.parse(data)
      if (event === 'token') handlers.onToken(parsed.text)
      else if (event === 'delegation') handlers.onDelegation(parsed)
      else if (event === 'done') handlers.onDone(parsed)
      else if (event === 'error') handlers.onError(parsed.message || 'Agent error')
    } catch { /* skip malformed frame */ }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      handleFrame(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 2)
    }
  }
  if (buffer.trim()) handleFrame(buffer)
}
