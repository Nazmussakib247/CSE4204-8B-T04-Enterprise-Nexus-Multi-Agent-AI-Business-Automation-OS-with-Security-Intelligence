import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
        return api(original)
      } catch {
        window.location.href = '/login'
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

export const adminApi = {
  listUsers: (params?: Record<string, unknown>) =>
    api.get('/admin/users', { params }),
  listRoles: () => api.get('/admin/roles'),
  updateUserRole: (id: string, role: string) =>
    api.patch(`/admin/users/${id}/role`, { role }),
  toggleUserStatus: (id: string, is_active: boolean) =>
    api.patch(`/admin/users/${id}/status`, { is_active }),
}
