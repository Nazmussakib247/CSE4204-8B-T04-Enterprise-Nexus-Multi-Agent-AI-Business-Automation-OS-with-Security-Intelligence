/**
 * Storefront mock catalogue — standalone for now, will be replaced by
 * GET /api/products once the storefront is wired into the backend.
 * Kept in one file so swapping to a real fetch later is a one-line change.
 */

export interface StoreProduct {
  slug: string
  name: string
  tagline: string
  price: number
  icon: string
  accent: 'primary' | 'tertiary' | 'secondary'
  description: string
  highlights: string[]
  specs: { label: string; value: string }[]
}

export const STORE_PRODUCTS: StoreProduct[] = [
  {
    slug: 'nexus-edge-hub',
    name: 'NeXus Edge Hub',
    tagline: 'Plug-and-play gateway into your agent pipeline',
    price: 349,
    icon: 'router',
    accent: 'primary',
    description:
      'NeXus Edge Hub connects your existing office systems — POS terminals, document scanners, badge readers — directly into your Enterprise NeXus agents, so data reaches HR, Finance and Support without any manual upload.',
    highlights: [
      'Auto-syncs scanned invoices straight to the Finance Agent',
      'One-tap CV intake from a front-desk scanner to the HR Agent',
      'Encrypted local buffer — keeps working through a network drop',
    ],
    specs: [
      { label: 'Connectivity', value: 'Wi-Fi 6, Gigabit Ethernet' },
      { label: 'Power', value: 'USB-C, 15W' },
      { label: 'Dimensions', value: '98 × 98 × 24 mm' },
      { label: 'In the box', value: 'Hub, USB-C cable, mounting plate' },
    ],
  },
  {
    slug: 'nexus-pulse-display',
    name: 'NeXus Pulse Display',
    tagline: 'A wall-mounted window into your live KPIs',
    price: 229,
    icon: 'monitor',
    accent: 'tertiary',
    description:
      'A 13" always-on display for the office wall. NeXus Pulse Display cycles through the Analytics Agent\'s live KPI cards and the Executive Agent\'s daily briefing, so the whole team sees the same numbers without opening a dashboard.',
    highlights: [
      'Rotates HR, Finance and Support KPIs automatically',
      'Shows the Executive Agent\'s daily briefing each morning',
      'Matte anti-glare panel, readable across a meeting room',
    ],
    specs: [
      { label: 'Screen', value: '13" IPS, 1920×1080' },
      { label: 'Mount', value: 'VESA 75×75' },
      { label: 'Power', value: 'USB-C, 20W' },
      { label: 'In the box', value: 'Display, wall bracket, power adapter' },
    ],
  },
  {
    slug: 'nexus-voice-node',
    name: 'NeXus Voice Node',
    tagline: 'Talk to your Executive Agent, hands-free',
    price: 179,
    icon: 'mic',
    accent: 'secondary',
    description:
      'A desk or meeting-room microphone puck that opens a voice channel straight to the Executive Agent. Ask "what are the top finance anomalies this week" out loud and hear the answer read back — no keyboard needed.',
    highlights: [
      'Wake word activates the Executive Agent\'s Q&A tool',
      'Far-field mic array — works from across a meeting table',
      'Mute switch is a physical circuit, not just software',
    ],
    specs: [
      { label: 'Microphone', value: '4-mic far-field array' },
      { label: 'Connectivity', value: 'Wi-Fi 6, Bluetooth 5.2' },
      { label: 'Power', value: 'USB-C, 10W' },
      { label: 'In the box', value: 'Voice Node, USB-C cable' },
    ],
  },
]

export const getProductBySlug = (slug: string) =>
  STORE_PRODUCTS.find(p => p.slug === slug)
