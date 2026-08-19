import { describe, it, expect } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import { getApiErrorMessage } from '@/lib/api'

const axiosErrorWith = (data: unknown): AxiosError =>
  new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    { status: 400, data } as unknown as AxiosResponse
  )

describe('getApiErrorMessage', () => {
  it('extracts the backend error field from an axios error', () => {
    const err = axiosErrorWith({ error: 'Invalid credentials' })
    expect(getApiErrorMessage(err, 'fallback')).toBe('Invalid credentials')
  })

  it('uses the fallback when the response has no error field', () => {
    const err = axiosErrorWith({ message: 'nope' })
    expect(getApiErrorMessage(err, 'Something went wrong')).toBe('Something went wrong')
  })

  it('uses the fallback for a network error with no response', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK')
    expect(getApiErrorMessage(err, 'Offline?')).toBe('Offline?')
  })

  it('uses the fallback for non-axios errors', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fb')).toBe('fb')
    expect(getApiErrorMessage('a string', 'fb')).toBe('fb')
    expect(getApiErrorMessage(undefined, 'fb')).toBe('fb')
  })
})
