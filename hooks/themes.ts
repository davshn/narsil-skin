import type { Theme } from '../types'
import { PALETTES, mix, paletteOf } from './look'
import { THUMBS } from './thumbs'

export const THEMES: Theme[] = [
  { id: 'claude', name: 'Claude', tagline: "Claude's own colors" },
  // Narsil, the mascot of the narsil-pet mod, over a night sea
  {
    id: 'narsil', name: 'Narsil', tagline: 'A night sea with a crescent moon breathing over it',
    palette: PALETTES.narsil, wallpaper: 'narsil',
    status: { idle: '🌙 Narsil', tool: '🌊 {tool}…', error: '⚔ {tool} failed', done: '✨ done' },
  },
  // Narsil by day, for light mode: a sun in place of the moon and the stars
  {
    id: 'narsil-light', name: 'Narsil Light', tagline: 'Narsil by day: sky blue water and a slow turning sun',
    palette: PALETTES['narsil-light'], wallpaper: 'narsil-light',
    status: { idle: '☀️ Narsil', tool: '🌊 {tool}…', error: '⚔ {tool} failed', done: '✨ done' },
  },
]

// the most characters a scene may hold, as the Backdrop's Svg takes it
export const SCENE_MAX = 131072

export const preview = (t: Theme) => {
  const bg = t.palette?.surfaces[0] ?? '#262624', text = t.palette?.text[0] ?? '#f5f4ef'
  const accent = t.palette?.roles.accent ?? '#d97757'
  const side = mix(bg, text, .04), bubble = mix(bg, text, .1), muted = mix(text, bg, .55)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
<clipPath id="w"><rect width="240" height="140" rx="10"/></clipPath><g clip-path="url(#w)">
<rect width="240" height="140" fill="${bg}"/>
<rect width="56" height="140" fill="${side}"/>
<rect x="9" y="14" width="38" height="6" rx="3" fill="${accent}"/>
<rect x="9" y="28" width="32" height="5" rx="2.5" fill="${muted}"/>
<rect x="9" y="39" width="36" height="5" rx="2.5" fill="${muted}"/>
<rect x="9" y="50" width="26" height="5" rx="2.5" fill="${muted}"/>
<rect x="148" y="12" width="82" height="22" rx="6" fill="${bubble}"/>
<text x="158" y="27" font-family="'Segoe UI', sans-serif" font-size="10" fill="${text}">Hi, Claude!</text>
<text x="66" y="54" font-family="'Segoe UI', sans-serif" font-size="10" fill="${text}">Hi! What shall we make?</text>
<rect x="66" y="62" width="150" height="5" rx="2.5" fill="${muted}"/>
<rect x="66" y="72" width="120" height="5" rx="2.5" fill="${muted}"/>
<rect x="66" y="102" width="164" height="28" rx="12" fill="${bubble}" stroke="${mix(bubble, text, .15)}"/>
<circle cx="216" cy="116" r="8" fill="${accent}"/>
</g>
</svg>`
}

// What the Backdrop refuses in a scene, by its documented rules: a scene holding one is not drawn at all
const REFUSED = /<image|feImage|foreignObject|data:|base64|@import|@font-face|image-set\(|<!DOCTYPE|<!ENTITY|CDATA|<\?|\\|href\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i
export const sceneTaken = (svg: string) => svg.length <= SCENE_MAX && /^\s*<svg[\s>]/.test(svg) && !REFUSED.test(svg)

// A person's own theme: <id>.json with its page, text and accent colors; svg: its <id>.svg scene, when there is one
export const parseUserTheme = (json: string, svg?: string): Theme | undefined => {
  let t: Record<string, unknown>
  try { t = JSON.parse(json) } catch { return undefined }
  const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
  const hex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
  if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(t.id)) return undefined
  if (!str(t.name, 60) || !hex(t.bg) || !hex(t.text) || !hex(t.accent)) return undefined
  const s = t.status as Record<string, unknown> | undefined
  const status = s && ['idle', 'tool', 'error', 'done'].every(k => str(s[k], 80))
    ? { idle: String(s.idle), tool: String(s.tool), error: String(s.error), done: String(s.done) } : undefined
  const scene = svg && sceneTaken(svg) ? svg : undefined
  return {
    id: t.id, name: String(t.name), tagline: str(t.tagline, 200) ? String(t.tagline) : '',
    palette: paletteOf(t.bg.toLowerCase(), t.text.toLowerCase(), t.accent.toLowerCase()),
    wallpaper: scene ? t.id : undefined, scene, status,
  }
}

export const tile = (t: Theme, on: boolean) => {
  const ring = on ? `<rect x="2" y="2" width="236" height="136" rx="12" fill="none" stroke="${t.palette?.roles.accent ?? '#d97757'}" stroke-width="5"/>` : ''
  const shot = t.thumb ?? (t.wallpaper && THUMBS[t.wallpaper])
  if (!shot) return preview(t).replace('</svg>', `${ring}</svg>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="140" viewBox="0 0 240 140">
<clipPath id="w"><rect width="240" height="140" rx="12"/></clipPath>
<image clip-path="url(#w)" width="240" height="140" preserveAspectRatio="xMidYMid slice" href="${shot}" xlink:href="${shot}"/>${ring}
</svg>`
}
