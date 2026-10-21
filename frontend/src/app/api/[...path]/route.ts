import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const backendOrigin = () =>
  (process.env.BACKEND_API_ORIGIN || 'https://enterprise-nexus-backend.onrender.com').replace(/\/$/, '')

async function proxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const upstreamUrl = new URL(`${backendOrigin()}/api/${params.path.join('/')}`)
  upstreamUrl.search = request.nextUrl.search

  const headers = new Headers(request.headers)
  // These belong to the incoming Vercel request and must be recalculated by
  // fetch for the Render request. Keep Cookie, Content-Type and Authorization.
  headers.delete('host')
  headers.delete('content-length')

  const method = request.method
  const upstream = await fetch(upstreamUrl, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    // The browser must receive this header from the Vercel origin. This is the
    // critical difference from the previous external rewrite implementation.
    if (key.toLowerCase() === 'set-cookie') responseHeaders.append(key, value)
    else if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) responseHeaders.set(key, value)
  })
  responseHeaders.set('cache-control', 'no-store, private')

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
