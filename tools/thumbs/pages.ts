// Writes thumb-<id>.html for each live wallpaper, its scene filling the page. Run with npx tsx, then capture.ps1, then
// embed.mjs.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CALM, SCENES } from '../../hooks/scenes'
import { THEMES } from '../../hooks/themes'

const out = fileURLToPath(new URL('.', import.meta.url))
for (const t of THEMES.filter(t => t.wallpaper)) {
  const scene = SCENES[t.wallpaper!]!({ ...CALM, now: 20_000 })
  writeFileSync(`${out}/thumb-${t.id}.html`, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>html, body { margin: 0; height: 100%; overflow: hidden; } svg { display: block; }
* { animation-play-state: paused !important; }</style></head><body>${scene}</body></html>`)
}
console.log('pages', THEMES.filter(t => t.wallpaper).map(t => t.id).join(' '))
