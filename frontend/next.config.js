/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Keep API calls on the Vercel origin so the httpOnly session cookie stays
  // first-party, then let Vercel's rewrite proxy the request to Render. This
  // avoids routing cold-starting Render requests through a time-limited
  // serverless function. Auth uses one session cookie, so the rewrite can
  // forward it without the old multi-cookie limitation.
  async rewrites() {
    const backendOrigin = (process.env.BACKEND_API_ORIGIN || 'https://enterprise-nexus-backend.onrender.com').replace(/\/$/, '')
    return [
      { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
    ]
  },
}

module.exports = nextConfig
