/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // `/api/*` is handled by src/app/api/[...path]/route.ts. Unlike an external
  // rewrite, that route explicitly forwards Set-Cookie headers from Render so
  // browser sessions survive a full page reload on Vercel.
}

module.exports = nextConfig
