import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design System Tokens (Material Design 3 — Enterprise NeXus)
        primary: '#006b5c',
        'primary-container': '#00c2a8',
        'on-primary': '#ffffff',
        'on-primary-container': '#00493e',
        'on-primary-fixed-variant': '#005045',
        'primary-fixed': '#65fade',
        'primary-fixed-dim': '#41ddc2',
        'inverse-primary': '#41ddc2',

        secondary: '#5d5e65',
        'secondary-container': '#e2e2eb',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#63646c',
        'secondary-fixed': '#e2e2eb',
        'secondary-fixed-dim': '#c5c6ce',
        'on-secondary-fixed': '#191b22',
        'on-secondary-fixed-variant': '#45464e',

        tertiary: '#732ee4',
        'tertiary-container': '#bc9bff',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#5200b6',
        'tertiary-fixed': '#eaddff',
        'tertiary-fixed-dim': '#d2bbff',
        'on-tertiary-fixed': '#25005a',
        'on-tertiary-fixed-variant': '#5a00c6',

        surface: '#f8f9fa',
        'surface-dim': '#d9dadb',
        'surface-bright': '#f8f9fa',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f3f4f5',
        'surface-container': '#edeeef',
        'surface-container-high': '#e7e8e9',
        'surface-container-highest': '#e1e3e4',
        'surface-variant': '#e1e3e4',
        'surface-tint': '#006b5c',
        'on-surface': '#191c1d',
        'on-surface-variant': '#3c4a46',
        'inverse-surface': '#2e3132',
        'inverse-on-surface': '#f0f1f2',

        background: '#f8f9fa',
        'on-background': '#191c1d',

        outline: '#6c7a76',
        'outline-variant': '#bbcac4',

        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error': '#ffffff',
        'on-error-container': '#93000a',
      },
      fontFamily: {
        display: ['Geist', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-lg': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label-caps': ['11px', { lineHeight: '1.2', letterSpacing: '0.1em', fontWeight: '700' }],
        'label-mono': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.375rem',
        xl: '0.5rem',
        '2xl': '0.75rem',
        full: '9999px',
      },
      spacing: {
        xs: '8px',
        sm: '16px',
        md: '24px',
        lg: '32px',
        xl: '48px',
        'sidebar-width': '260px',
        'topbar-height': '64px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08)',
        auth: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)',
        primary: '0 4px 14px 0 rgba(0, 194, 168, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
