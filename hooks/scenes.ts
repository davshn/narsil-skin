// The live wallpapers as SVG scenes for the Backdrop: drawn again on each change of what the conversations are doing.
// Each loop is offset by the wall clock, so a redraw picks every animation up where it was instead of starting it over.

import type { Mood, Wave } from '../types'

// What a scene shows: the pooled wave of every conversation, this one's mood, a turn that just ended, and the speed
export type Sky = { wave: Wave; tide: boolean; state: Mood; flare: boolean; speed: number; now: number }
export const CALM: Sky = { wave: '', tide: false, state: 'idle', flare: false, speed: 4, now: 0 }

const CELL = 14
const GLYPHS = 'St%;:X', LOOSE = ".:',o"
const hash = (a: number, b: number, c = 0) => {
  let h = Math.imul(a + 4096, 374761393) ^ Math.imul(b + 4096, 668265263) ^ Math.imul(c, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const glyph = (set: string, x: number, y: number) => set[Math.floor(hash(x, y, 9) * set.length)]!
const r1 = (v: number) => Math.round(v * 10) / 10

// One cell of a body drawn in characters: a rounded tile with its glyph, or a loose glyph alone
const tileAt = (cx: number, cy: number, x: number, y: number, bg: string, fg: string) => {
  const px = cx + x * CELL, py = cy + y * CELL
  return `<rect x="${px - CELL / 2 + 2}" y="${py - CELL / 2 + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="3" fill="${bg}"/>`
    + `<text x="${px}" y="${py + 3}" fill="${fg}">${glyph(GLYPHS, x, y)}</text>`
}
const looseAt = (cx: number, cy: number, x: number, y: number, fg: string, a: number) =>
  `<text x="${cx + x * CELL}" y="${cy + y * CELL + 3}" fill="${fg}" opacity="${r1(a)}">${esc(glyph(LOOSE, x, y))}</text>`
const esc = (s: string) => s.replace(/'/g, '&apos;')

// The moon and the sun stand in a 1000 by 620 box centered at the top of any window, a little right of the middle:
// over the chat column, clear of the side panes Desktop docks at the right, which it draws opaque over the scene
const CX = 600, CY = 140

const MOON = (() => {
  const R = 5.5, body: string[] = [], halo: string[] = []
  for (let y = -8; y <= 8; y++)
    for (let x = -8; x <= 8; x++) {
      const d1 = Math.hypot(x, y), d2 = Math.hypot(x - 3, y + 1.6)
      if (d1 <= R && d2 > R * .85) body.push(tileAt(CX, CY, x, y, '#e8d9a0', '#4a4126'))
      else if (d1 <= R + 1.5 && d2 > R * .85 + .6 && hash(x, y, 5) < .45) halo.push(looseAt(CX, CY, x, y, '#e8d9a0', 1))
    }
  return { body: body.join(''), halo: halo.join('') }
})()

const SUN = (() => {
  const R = 4.5, RAYS = 10, body: string[] = [], rays: string[] = [], halo: string[] = []
  for (let y = -14; y <= 14; y++)
    for (let x = -14; x <= 14; x++) {
      const d = Math.hypot(x, y)
      if (d <= R) { body.push(tileAt(CX, CY, x, y, '#ffcf4a', '#c98f10')); continue }
      if (d > R + 9) continue
      const turn = Math.atan2(y, x) / (Math.PI * 2) * RAYS
      const off = Math.abs(turn - Math.round(turn)) * (Math.PI * 2 / RAYS) * d
      if (d >= R + 1.5 && d <= R + 5.5 && off < .75) rays.push(tileAt(CX, CY, x, y, '#ffd966', '#c98f10'))
      else if (hash(x, y, 5) < .3) halo.push(looseAt(CX, CY, x, y, '#e0a21e', .5 * (1 - (d - R) / 9)))
    }
  return { body: body.join(''), rays: rays.join(''), halo: halo.join('') }
})()

const STARS = [[30, 40, 1.5, '#dce6fa'], [120, 150, 1, '#dce6fa'], [210, 80, 1.5, '#9cc8ff'], [260, 220, 1, '#dce6fa'],
  [80, 260, 2, '#ffffff'], [170, 290, 1, '#9cc8ff']]
  .map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')

// a loop of `dur` seconds that a redraw picks up where it was
const loop = (name: string, dur: number, now: number, extra = 'linear infinite') =>
  `animation:${name} ${r1(dur * 100) / 100}s ${extra};animation-delay:-${r1(((now / 1000) % dur) * 100) / 100}s`

// One path, not a pattern (a pattern's tiles leave a seam): 14 crests of 400, wider than any window plus one roll
const WAVE_PATH = (h: number) => {
  const m = Math.round(h * 22 / 46), top = Math.round(h * 6 / 46), crests = 14
  const ts = Array.from({ length: crests * 4 - 1 }, (_, i) => `T${i * 100 - 200} ${m}`).join(' ')
  return `M-400 ${m} Q-350 ${top} -300 ${m} ${ts} V${h} H-400 Z`
}

type Tones = { calm: string; waiting: string; error: string; base: number; tide: number; lit: number; rim: string; streak: string }
const SEA: Tones = { calm: '#5aaeff', waiting: '#ffc94d', error: '#ff5a6e', base: .2, tide: .4, lit: .55, rim: '#5aaeff', streak: '#dce6fa' }
const DAY: Tones = { calm: '#71c4e2', waiting: '#f7b529', error: '#ff5a6e', base: .28, tide: .36, lit: .38, rim: '#1f83a8', streak: '#ffffff' }

// The wave along the bottom, the shooting star while thinking and the rim while waiting: what both scenes share
const reactions = (s: Sky, t: Tones) => {
  const h = s.tide ? 60 : 46
  const fill = s.wave === 'waiting' ? t.waiting : s.wave === 'error' ? t.error : t.calm
  const opacity = s.wave ? t.lit : s.tide ? t.tide : t.base
  const shoot = s.state === 'thinking'
    ? `<svg width="100%" height="100%" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"><g class="shoot">`
      + `<line x1="100" y1="72" x2="250" y2="121" stroke="url(#streak)" stroke-width="2" stroke-linecap="round"/></g></svg>` : ''
  const rim = s.state === 'waiting'
    ? `<rect class="rim" width="100%" height="100%" fill="none" stroke="${t.rim}" stroke-width="90" filter="url(#soft)"/>` : ''
  const defs = `<linearGradient id="streak"><stop offset="0" stop-color="${t.streak}" stop-opacity="0"/><stop offset="1" stop-color="${t.streak}" stop-opacity=".9"/></linearGradient>`
    + `<filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="28"/></filter>`
  const body = `${shoot}${rim}<svg y="100%" width="100%" height="1" overflow="visible"><g class="roll">`
    + `<path transform="translate(0 -${h})" d="${WAVE_PATH(h)}" fill="${fill}" opacity="${opacity}"/></g></svg>`
  const style = `.roll{${loop('roll', 14, s.now)}}`
    + `.shoot{opacity:0;${loop('shoot', 3.2, s.now, 'ease-in infinite')}}`
    + `.rim{opacity:.6;${loop('pulse', 3, s.now, 'ease-in-out infinite')}}`
    + '@keyframes roll{from{transform:translateX(0)}to{transform:translateX(-400px)}}'
    + '@keyframes shoot{0%{opacity:0;transform:translate(0,0)}10%{opacity:.9}45%,100%{opacity:0;transform:translate(600px,196px)}}'
    + '@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.7}}'
  return { defs, body, style }
}

// how fast the moon breathes and the sun turns: the pane's speed, three times faster while Claude thinks
const pace = (s: Sky) => Math.max(.1, Math.min(16, s.speed)) * (s.state === 'thinking' ? 3 : 1)

const frame = (defs: string, style: string, body: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" font-family="Consolas, 'Cascadia Code', monospace" `
  + `font-size="8" font-weight="700" text-anchor="middle"><title>${label}</title><defs>${defs}</defs><style>${style}</style>${body}</svg>`

const corner = (inner: string) =>
  `<svg width="100%" height="100%" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMin meet">${inner}</svg>`

// Narsil: a night sea under a crescent moon whose light breathes slowly
export const narsilScene = (s: Sky) => {
  const r = reactions(s, SEA), breath = 7.85 / pace(s)
  const defs = '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1322"/>'
    + '<stop offset=".55" stop-color="#0f1a2c"/><stop offset="1" stop-color="#132640"/></linearGradient>'
    + `<pattern id="stars" width="300" height="300" patternUnits="userSpaceOnUse">${STARS}</pattern>${r.defs}`
  const style = (s.flare ? '.stars{opacity:.3;animation:flare 1.2s ease-in both}' : `.stars{opacity:.45;${loop('twinkle', 8, s.now, 'ease-in-out infinite')}}`)
    + `.moon{opacity:.86;${loop('breath', breath, s.now, 'ease-in-out infinite')}}`
    + `.halo{opacity:.27;${loop('glow', breath, s.now, 'ease-in-out infinite')}}`
    + '@keyframes twinkle{0%,100%{opacity:.3}50%{opacity:.55}}@keyframes flare{from{opacity:.9}to{opacity:.3}}'
    + '@keyframes breath{0%,100%{opacity:.78}50%{opacity:.95}}@keyframes glow{0%,100%{opacity:.15}50%{opacity:.4}}' + r.style
  const body = '<rect width="100%" height="100%" fill="url(#sky)"/><rect class="stars" width="100%" height="100%" fill="url(#stars)"/>'
    + corner(`<g class="halo">${MOON.halo}</g><g class="moon">${MOON.body}</g>`) + r.body
  return frame(defs, style, body, 'A night sea under a crescent moon')
}

// Narsil Light: a sky blue sea under a sun whose rays turn slowly
export const narsilLightScene = (s: Sky) => {
  const r = reactions(s, DAY), p = pace(s), breath = 7.85 / p, turn = 1047 / p
  const defs = '<linearGradient id="sky"><stop offset="0" stop-color="#86d1e8"/><stop offset=".24" stop-color="#b7deed"/>'
    + '<stop offset=".58" stop-color="#c9e7f1"/></linearGradient>'
    + '<radialGradient id="flare" cx=".6" cy=".16" r=".7"><stop offset="0" stop-color="#ffd666" stop-opacity=".6"/>'
    + `<stop offset="1" stop-color="#ffd666" stop-opacity="0"/></radialGradient>${r.defs}`
  const style = `.rays{transform-origin:${CX}px ${CY}px;opacity:.7;${loop('turn', turn, s.now)}}`
    + `.sun{opacity:.92;${loop('breath', breath, s.now, 'ease-in-out infinite')}}`
    + `.halo{opacity:.35;${loop('glow', breath, s.now, 'ease-in-out infinite')}}`
    + (s.flare ? '.flare{opacity:0;animation:flare 1.2s ease-in both}' : '.flare{opacity:0}')
    + '@keyframes turn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
    + '@keyframes breath{0%,100%{opacity:.86}50%{opacity:.98}}@keyframes glow{0%,100%{opacity:.2}50%{opacity:.5}}'
    + '@keyframes flare{from{opacity:.9}to{opacity:0}}' + r.style
  const body = '<rect width="100%" height="100%" fill="url(#sky)"/>'
    + corner(`<g class="halo">${SUN.halo}</g><g class="rays">${SUN.rays}</g><g class="sun">${SUN.body}</g>`)
    + '<rect class="flare" width="100%" height="100%" fill="url(#flare)"/>' + r.body
  return frame(defs, style, body, 'A sky blue sea under a turning sun')
}

export const SCENES: Record<string, (s: Sky) => string> = { narsil: narsilScene, 'narsil-light': narsilLightScene }
