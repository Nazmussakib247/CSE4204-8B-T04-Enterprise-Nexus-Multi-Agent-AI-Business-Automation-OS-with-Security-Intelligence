import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}))

const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  authApi: {
    me: vi.fn().mockRejectedValue(new Error('unauthenticated')),
    login: vi.fn(),
  },
}))

import { authApi } from '@/lib/api'
import { AuthProvider } from '@/lib/auth'
import LoginPage from '@/app/(auth)/login/page'

const renderLogin = () =>
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  )

describe('Login flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email, password and submit controls', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('rejects an empty submit without calling the API', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(toastError).toHaveBeenCalledWith('Email and password required')
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('logs in and redirects to the dashboard on success', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: { user: { id: '1', name: 'Test', email: 't@x.com', role: 'admin' } },
    } as Awaited<ReturnType<typeof authApi.login>>)

    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 't@x.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('t@x.com', 'secret123')
      expect(push).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows an error toast on invalid credentials and does not redirect', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('401'))

    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 't@x.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Invalid credentials')
    })
    expect(push).not.toHaveBeenCalled()
  })

  it('toggles password visibility', async () => {
    renderLogin()
    const passInput = screen.getByPlaceholderText('••••••••')
    expect(passInput).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByText('visibility').closest('button') as HTMLElement)
    expect(passInput).toHaveAttribute('type', 'text')
  })
})
