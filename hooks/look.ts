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

// a line that makes Desktop ignore the whole theme
export const BLOCKING = "Desktop won't paint"
export const paints = (problems: string[]) => !problems.some(l => l.startsWith(BLOCKING))

type Colors = { theme: ThemeColors; problems: string[] }
// The whole color theme of a palette, and the lines makeColors found wrong with it. When Desktop would not paint the
// palette as given, simpler forms of it are tried, each leaving more to the design system: first the page, the text and
// every role, then the page, the text and the accent, then the page and the text alone. A palette whose text is too
// faint for any of them gets more contrast, step by step: its text toward white or black, its page the other way.
// The first that paints wins; when none does, the last one's lines say why.
export const colorsOf = (label: string, p: Palette): Colors => {
  const [s0, s1, s2, s3] = p.surfaces, [t0, t1, t2] = p.text
  const full = { 'surface-0': s0, 'surface-1': s1, 'surface-2': s2, 'surface-3': s3, 'text-primary': t0, 'text-secondary': t1, 'text-muted': t2 }
  const tries: { anchors: Record<string, string>; roles: Palette['roles'] | Partial<Palette['roles']> }[] = [{ anchors: full, roles: p.roles }]
  const [far, near] = p.mode === 'dark' ? ['#ffffff', '#000000'] : ['#000000', '#ffffff']
  for (const k of [0, .25, .5, .75]) {
    const page = mix(s0, near, k / 2), ink = mix(t0, far, k)
    const bare = { 'surface-0': page, 'text-primary': ink, 'text-secondary': mix(ink, page, .1), 'text-muted': mix(ink, page, .18) }
    tries.push({ anchors: bare, roles: p.roles }, { anchors: bare, roles: { accent: p.roles.accent } }, { anchors: bare, roles: {} })
  }
  let last: Colors | undefined, error: unknown
  for (const { anchors, roles } of tries) {
    try {
      last = makeColors({ label, only: p.mode, roles, [p.mode]: { gray: { anchors: anchors as { 'surface-0': string; 'text-primary': string } } } })
      if (paints(last.problems)) return last
    } catch (err) {
      error = err // (a ramp makeColors can't build: the next, simpler form may)
    }
  }
  if (last) return last
  throw error
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

// A person's own theme, from its page, text and accent: its other surfaces and texts mixed between them. Light text on
// its page makes a dark theme, dark text a light one, whatever the page's own lightness.
export const paletteOf = (bg: string, text: string, accent: string): Palette => {
  const mode = luma(text) > luma(bg) ? 'dark' : 'light'
  const up = (k: number) => mix(bg, mode === 'dark' ? text : '#ffffff', k)
  const surfaces: Palette['surfaces'] = mode === 'dark'
    ? [bg, up(.04), up(.07), up(.09)]
    : [bg, up(.35), up(.65), up(.65)]
  const base = PALETTES[mode === 'dark' ? 'narsil' : 'narsil-light'].roles
  return { mode, surfaces, text: [text, mix(text, bg, .2), mix(text, bg, .35)], roles: { ...base, accent } }
}
