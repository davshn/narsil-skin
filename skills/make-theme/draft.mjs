// A draft page for a theme: a small Claude Desktop mock in the theme's colors, its scene behind, the way the mod paints
// them. Prints what makeColors finds wrong; a line starting "Desktop won't paint" must be fixed before building.
// Needs Node 22.18 or later (it reads the mod's TypeScript).
import { readFileSync, writeFileSync } from 'node:fs'

const { colorsOf, paletteOf } = await import(new URL('../../hooks/look.ts', import.meta.url).href)

const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined }
const need = name => arg(name) ?? (console.error(`missing --${name}`), process.exit(1))
const theme = JSON.parse(readFileSync(need('theme'), 'utf8'))
const scene = arg('scene') ? readFileSync(arg('scene'), 'utf8') : ''
const hex = v => /^#[0-9a-f]{6}$/i.test(v ?? '')
if (!hex(theme.bg) || !hex(theme.text) || !hex(theme.accent)) (console.error('bg, text and accent must be #rrggbb'), process.exit(1))
if (scene && scene.length > 131072) (console.error(`the scene has ${scene.length} characters; the most is 131072`), process.exit(1))

const p = paletteOf(theme.bg.toLowerCase(), theme.text.toLowerCase(), theme.accent.toLowerCase())
const { problems } = colorsOf(theme.name ?? theme.id, p)
const blocking = problems.filter(l => l.startsWith("Desktop won't paint"))
console.log(blocking.length ? blocking.join('\n') : `colors: Desktop paints them (${problems.length} notes under the design system's own bar)`)

// --bare: the scene alone, as the pane's tile shows it (tools/thumbs/capture.ps1, or capture.sh on macOS, takes its picture)
if (process.argv.includes('--bare')) {
  writeFileSync(need('out'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>html, body { margin: 0; height: 100%; overflow: hidden; background: ${p.surfaces[0]}; }
svg { display: block; }</style></head><body>${scene}</body></html>
`)
  console.log('bare page written')
  process.exit(0)
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
const [s0, s1, s2, s3] = p.surfaces, [t0, t1, t2] = p.text
// over a scene the panels are frosted glass tinted with the page color, as the mod asks Desktop for
const glass = scene ? `color-mix(in srgb, ${s0} 60%, transparent)` : null
writeFileSync(need('out'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(theme.name)} Draft</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; }
  body { background: ${s0}; color: ${t0}; font: 14px/1.5 system-ui, sans-serif; color-scheme: ${p.mode}; }
  .scene { position: fixed; inset: 0; } .scene > svg { display: block; width: 100%; height: 100%; }
  .side { position: fixed; left: 0; top: 0; bottom: 0; width: 210px; padding: 16px 14px; box-sizing: border-box; font-size: 13px;
    background: ${glass ?? s1}; ${glass ? 'backdrop-filter: blur(12px);' : ''} }
  .side b { display: block; color: ${p.roles.accent}; margin-bottom: 14px; }
  .side p { margin: 0 0 10px; color: ${t1}; }
  .main { position: fixed; left: 210px; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; }
  .chat { width: min(640px, 86%); padding-top: 60px; display: flex; flex-direction: column; gap: 18px; }
  .you { align-self: flex-end; max-width: 70%; padding: 10px 14px; border-radius: 12px; background: ${glass ?? s2};
    ${glass ? 'backdrop-filter: blur(12px);' : ''} }
  .claude p { margin: 0 0 8px; } .claude a { color: ${p.roles.accent}; }
  .claude code { background: ${s3}; padding: 1px 5px; border-radius: 4px; color: ${p.roles.danger}; }
  .box { position: absolute; bottom: 34px; width: min(640px, 86%); border-radius: 20px; padding: 14px 16px; box-sizing: border-box;
    display: flex; justify-content: space-between; align-items: center; color: ${t2}; background: ${glass ?? s2};
    ${glass ? 'backdrop-filter: blur(12px);' : ''} border: 1px solid color-mix(in srgb, ${t0} 12%, transparent); }
  .send { width: 28px; height: 28px; border-radius: 50%; background: ${p.roles.accent}; }
  .status { position: absolute; bottom: 8px; font-size: 12px; color: ${t2}; }
</style></head><body>
${scene ? `<div class="scene">${scene}</div>` : ''}
<div class="side"><b>Claude</b><p>New session</p><p>Search</p><p>Customize</p><p style="margin-top:24px">${esc(theme.name)}</p></div>
<div class="main">
  <div class="chat">
    <div class="you">Can you make my chat feel like ${esc(theme.name)}?</div>
    <div class="claude">
      <p>Sure. This is how <a href="#">${esc(theme.name)}</a> looks: ${esc(theme.tagline)}.</p>
      <p>Writing stays easy to read, <code>code</code> stands out, and the accent marks what you can press.</p>
    </div>
  </div>
  <div class="box">Describe a task or ask a question<span class="send"></span></div>
  <div class="status">${esc(theme.status?.idle ?? '')}</div>
</div>
</body></html>
`)
console.log('draft written')
