/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Browser requests stay on the Vercel origin. This makes httpOnly session
  // cookies first-party instead of relying on Vercel -> Render third-party
  // cookies, which many browsers block.
  async rewrites() {
    const backendOrigin = (process.env.BACKEND_API_ORIGIN || 'https://enterprise-nexus-backend.onrender.com').replace(/\/$/, '')
    return [
      { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
    ]
  },
}

module.exports = nextConfig
