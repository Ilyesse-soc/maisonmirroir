import type { CSSProperties } from 'react'

export const theme = {
  gold: '#c9a227',
  goldLight: '#e8d08a',
  goldDark: '#8c6d14',
  cream: '#fdf9ef',
  creamDark: '#f3e4b8',
  marble: '#f8f5f0',
  textDark: '#2c2416',
  textMid: '#5a4a2e',
} as const

export const fonts = {
  display: "'Cormorant Garamond', Georgia, serif",
  script: "'Great Vibes', cursive",
  body: "'Jost', sans-serif",
} as const

export const pageMaxWidth = 1152 // ~max-w-6xl

export function dividerStyle(width: number): CSSProperties {
  return {
    width,
    height: 1,
    background: `linear-gradient(90deg, transparent, ${theme.gold}, transparent)`,
    margin: '0 auto',
  }
}

export function buttonGoldStyle(options?: { fontSize?: number; fullWidth?: boolean }): CSSProperties {
  return {
    display: options?.fullWidth ? 'block' : 'inline-block',
    width: options?.fullWidth ? '100%' : undefined,
    textAlign: 'center',
    color: 'white',
    fontFamily: fonts.body,
    fontWeight: 400,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    fontSize: options?.fontSize ?? 12,
    padding: '14px 36px',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
  }
}

export function buttonOutlineGoldStyle(options?: { fontSize?: number; fullWidth?: boolean }): CSSProperties {
  return {
    display: options?.fullWidth ? 'block' : 'inline-block',
    width: options?.fullWidth ? '100%' : undefined,
    textAlign: 'center',
    background: 'transparent',
    color: theme.gold,
    fontFamily: fonts.body,
    fontWeight: 400,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    fontSize: options?.fontSize ?? 12,
    padding: '13px 36px',
    border: `1px solid ${theme.gold}`,
    cursor: 'pointer',
    textDecoration: 'none',
  }
}

export const inputLuxuryStyle: CSSProperties = {
  width: '100%',
  background: 'white',
  border: `1px solid ${theme.goldLight}`,
  padding: '12px 16px',
  fontFamily: fonts.body,
  fontSize: 14,
  color: theme.textDark,
  outline: 'none',
}
