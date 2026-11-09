import type { Theme } from '../types'
import { THUMBS } from './thumbs'

export const THEMES: Theme[] = [
  { id: 'claude', name: 'Claude', tagline: "Claude's own colors" },
  // Narsil, the mascot of the narsil-pet mod, with a night sea palette and its soft blue shadows
  ((t: Theme) => ({ ...t, vars: { ...t.vars, 'cds-shadow-md': '0 6px 22px rgba(90, 174, 255, .12)',
    'cds-shadow-lg': '0 12px 34px rgba(90, 174, 255, .16)' } }))(
    live('narsil', 'Narsil', 'A night sea with a crescent moon breathing over it',
      ['#0f1a2c', '#dce6fa', '#5aaeff'], '#0f1a2c',
      'rgba(15, 26, 44, .6)', 'rgba(90, 174, 255, .3)', 'Mar en calma, código en marcha 🌊',
      { idle: '🌙 Narsil', tool: '🌊 {tool}…', error: '⚔ {tool} failed', done: '✨ done' })),
  // Narsil by day, for light mode: a sun in place of the moon and the stars
  ((t: Theme) => ({ ...t, vars: { ...t.vars, 'cds-shadow-md': '0 6px 22px rgba(31, 131, 168, .14)',
    'cds-shadow-lg': '0 12px 34px rgba(31, 131, 168, .18)' } }))(
    live('narsil-light', 'Narsil Light', 'Narsil by day: sky blue water and a slow turning sun',
      ['#c9e7f1', '#0f2f47', '#1f83a8'], 'linear-gradient(90deg, #86d1e8, #b7deed 24%, #c9e7f1 58%)',
      'rgba(255, 255, 255, .62)', 'rgba(31, 131, 168, .3)', 'Cielo claro, código en marcha ☀️',
      { idle: '☀️ Narsil', tool: '🌊 {tool}…', error: '⚔ {tool} failed', done: '✨ done' })),
]

function live(id: string, name: string, tagline: string, [bg, text, accent]: [string, string, string], sky: string,
  glass: string, rim: string, greet: string, status: NonNullable<Theme['status']>): Theme {
  return {
    id, name, tagline, bg, text, accent, wallpaper: id, status,
    vars: {
      'cds-radius': '8px', 'cds-radius-composer': '16px', 'cds-panel-radius': '14px',
      'wall-sky': sky, 'wall-halo': bg, 'wall-glass': glass, 'wall-rim': rim, 'wall-greet': JSON.stringify(greet),
    },
  }
}

const mix = (a: string, b: string, k: number) =>
  '#' + [1, 3, 5].map(i => {
    const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16)
    return Math.round(x + (y - x) * k).toString(16).padStart(2, '0')
  }).join('')

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
const px = (v: string | undefined, fallback: number) => (v && /^\d+(\.\d+)?px$/.test(v) ? parseFloat(v) : fallback)

export const preview = (t: Theme) => {
  const bg = t.bg ?? '#262624', text = t.text ?? '#f5f4ef', accent = t.accent ?? '#d97757'
  const side = mix(bg, text, .04), bubble = mix(bg, text, .1), muted = mix(text, bg, .55)
  const font = esc(t.font ?? "'Segoe UI', sans-serif")
  const r = Math.min(px(t.vars?.['cds-radius'], 6), 11), box = Math.min(px(t.vars?.['cds-radius-composer'], 12), 14)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
<clipPath id="w"><rect width="240" height="140" rx="10"/></clipPath><g clip-path="url(#w)">
<rect width="240" height="140" fill="${bg}"/>
<rect width="56" height="140" fill="${side}"/>
<rect x="9" y="14" width="38" height="6" rx="3" fill="${accent}"/>
<rect x="9" y="28" width="32" height="5" rx="2.5" fill="${muted}"/>
<rect x="9" y="39" width="36" height="5" rx="2.5" fill="${muted}"/>
<rect x="9" y="50" width="26" height="5" rx="2.5" fill="${muted}"/>
<rect x="148" y="12" width="82" height="22" rx="${r}" fill="${bubble}"/>
<text x="158" y="27" font-family="${font}" font-size="10" fill="${text}">Hi, Claude!</text>
<text x="66" y="54" font-family="${font}" font-size="10" fill="${text}">Hi! What shall we make?</text>
<rect x="66" y="62" width="150" height="5" rx="2.5" fill="${muted}"/>
<rect x="66" y="72" width="120" height="5" rx="2.5" fill="${muted}"/>
<rect x="66" y="102" width="164" height="28" rx="${box}" fill="${bubble}" stroke="${mix(bubble, text, .15)}"/>
<circle cx="216" cy="116" r="8" fill="${accent}"/>
${t.deco ?? ''}</g>
</svg>`
}

// scene: the person's own <id>.js sits beside the file, so a wallpaper named after the theme's own id is kept
export const parseUserTheme = (json: string, css?: string, scene = false): Theme | undefined => {
  let t: Record<string, unknown>
  try { t = JSON.parse(json) } catch { return undefined }
  const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
  const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
  if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(t.id)) return undefined
  if (!str(t.name, 60) || !hex(t.bg) || !hex(t.text) || !hex(t.accent)) return undefined
  const vars = Object.fromEntries(Object.entries(t.vars && typeof t.vars === 'object' ? t.vars : {})
    .filter(([k, v]) => /^[a-z][a-z0-9-]{0,80}$/.test(k) && str(v, 500)))
  const s = t.status as Record<string, unknown> | undefined
  const status = s && ['idle', 'tool', 'error', 'done'].every(k => str(s[k], 80))
    ? { idle: String(s.idle), tool: String(s.tool), error: String(s.error), done: String(s.done) } : undefined
  return {
    id: t.id, name: String(t.name), tagline: str(t.tagline, 200) ? String(t.tagline) : '',
    wallpaper: scene && t.wallpaper === t.id ? t.id : undefined,
    bg: String(t.bg), text: String(t.text), accent: String(t.accent),
    font: str(t.font, 200) ? String(t.font) : undefined, vars, status,
    deco: str(t.deco, 40000) ? String(t.deco) : undefined, css: css || undefined,
  }
}

export const tile = (t: Theme, on: boolean) => {
  const ring = on ? `<rect x="2" y="2" width="236" height="136" rx="12" fill="none" stroke="${t.accent ?? '#d97757'}" stroke-width="5"/>` : ''
  const shot = t.thumb ?? (t.wallpaper && THUMBS[t.wallpaper])
  if (!shot) return preview(t).replace('</svg>', `${ring}</svg>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="140" viewBox="0 0 240 140">
<clipPath id="w"><rect width="240" height="140" rx="12"/></clipPath>
<image clip-path="url(#w)" width="240" height="140" preserveAspectRatio="xMidYMid slice" href="${shot}" xlink:href="${shot}"/>${ring}
</svg>`
}
