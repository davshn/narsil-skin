import type { ThemeColors } from 'claude-code'

import type { Palette } from '../types'
import { makeColors } from './make-colors.js'

// Narsil: a night sea; Narsil Light: the same sea by day
export const PALETTES: Record<'narsil' | 'narsil-light', Palette> = {
  narsil: {
    mode: 'dark',
    surfaces: ['#0f1a2c', '#142339', '#192a44', '#1c2f4c'],
    text: ['#dce6fa', '#b4c4e0', '#93a6c8'],
    roles: { accent: '#5aaeff', danger: '#ff5a6e', success: '#5fd3a0', warning: '#ffc94d', pro: '#a98bff' },
  },
  'narsil-light': {
    mode: 'light',
    surfaces: ['#c9e7f1', '#d8eef6', '#e8f5fa', '#e8f5fa'],
    text: ['#0f2f47', '#26475f', '#3a5b72'],
    roles: { accent: '#1f83a8', danger: '#c2334a', success: '#2e8a5a', warning: '#b07a12', pro: '#6a4fb0' },
  },
}

// The whole color theme of a palette, and the lines makeColors found wrong with it
export const colorsOf = (label: string, p: Palette): { theme: ThemeColors; problems: string[] } => {
  const [s0, s1, s2, s3] = p.surfaces, [t0, t1, t2] = p.text
  return makeColors({
    label,
    only: p.mode,
    roles: p.roles,
    [p.mode]: {
      gray: {
        anchors: {
          'surface-0': s0, 'surface-1': s1, 'surface-2': s2, 'surface-3': s3,
          'text-primary': t0, 'text-secondary': t1, 'text-muted': t2,
        },
      },
    },
  })
}

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const toHex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
export const mix = (a: string, b: string, k: number) => {
  const x = hex(a), y = hex(b)
  return toHex(x.map((v, i) => v + (y[i]! - v) * k))
}
export const luma = (h: string) => {
  const [r, g, b] = hex(h).map(v => {
    const c = v / 255
    return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4
  })
  return .2126 * r! + .7152 * g! + .0722 * b!
}

// A person's own theme, from its page, text and accent: its other surfaces and texts mixed between them
export const paletteOf = (bg: string, text: string, accent: string): Palette => {
  const mode = luma(bg) > .5 ? 'light' : 'dark'
  const up = (k: number) => mix(bg, mode === 'dark' ? text : '#ffffff', k)
  const surfaces: Palette['surfaces'] = mode === 'dark'
    ? [bg, up(.04), up(.07), up(.09)]
    : [bg, up(.35), up(.65), up(.65)]
  const base = PALETTES[mode === 'dark' ? 'narsil' : 'narsil-light'].roles
  return { mode, surfaces, text: [text, mix(text, bg, .2), mix(text, bg, .35)], roles: { ...base, accent } }
}
