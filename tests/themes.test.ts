import { expect, test } from 'claude-code/testing'

import { colorsOf } from '../hooks/look'
import { lookOf, withoutOurs } from '../hooks/register'
import { CALM, SCENES } from '../hooks/scenes'
import { SCENE_MAX, THEMES, parseUserTheme, tile } from '../hooks/themes'
import { HOME, MINE, PANE, begin, run, scene, win, world } from './world'

const OWN = { id: 'my-dusk', name: 'My Dusk', tagline: 't', bg: '#112233', text: '#eeeeee', accent: '#ff8800' }
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="100%" height="100%" fill="#112233"/></svg>'

test('a person\'s own theme is read from its colors, its scene from its svg, and a bad one is refused', () => {
  const plain = parseUserTheme(JSON.stringify(OWN))
  expect(plain?.palette).toMatchObject({ mode: 'dark', roles: { accent: '#ff8800' } })
  expect([plain?.palette?.surfaces[0], plain?.palette?.text[0]]).toEqual(['#112233', '#eeeeee'])
  expect(plain?.wallpaper).toBeUndefined()
  const light = parseUserTheme(JSON.stringify({ ...OWN, bg: '#F4EFE6', text: '#2a241d' }))
  expect(light?.palette?.mode).toBe('light')
  expect(light?.palette?.surfaces[0]).toBe('#f4efe6')
  const live = parseUserTheme(JSON.stringify(OWN), SVG)
  expect(live).toMatchObject({ wallpaper: 'my-dusk', scene: SVG })
  expect(parseUserTheme(JSON.stringify(OWN), 'not svg')?.wallpaper).toBeUndefined()
  expect(parseUserTheme(JSON.stringify(OWN), `<svg>${'x'.repeat(SCENE_MAX)}</svg>`)?.wallpaper).toBeUndefined()
  expect(parseUserTheme('{"id":"x y","name":"n","bg":"#000000","text":"#ffffff","accent":"#ff0000"}')).toBeUndefined()
  expect(parseUserTheme('{"id":"ok-id","name":"n","bg":"red","text":"#ffffff","accent":"#ff0000"}')).toBeUndefined()
  expect(parseUserTheme('not json')).toBeUndefined()
})

test('every theme paints on Desktop, has a tile the desktop takes, and Claude has no colors', () => {
  expect(THEMES.map(t => t.id)).toEqual(['claude', 'narsil', 'narsil-light'])
  expect(THEMES[0]!.palette).toBeUndefined()
  for (const t of THEMES) expect(tile(t, true).length < SCENE_MAX).toBe(true)
  const own = parseUserTheme(JSON.stringify(OWN))!
  for (const t of [...THEMES.filter(t => t.palette), own]) {
    const { problems } = colorsOf(t.name, t.palette!)
    expect(problems.filter(l => l.startsWith("Desktop won't paint"))).toEqual([])
  }
  const sea = THEMES.find(t => t.id === 'narsil')?.palette, day = THEMES.find(t => t.id === 'narsil-light')?.palette
  expect([sea?.mode, sea?.surfaces[0], sea?.roles.accent]).toEqual(['dark', '#0f1a2c', '#5aaeff'])
  expect([day?.mode, day?.surfaces[0], day?.roles.accent]).toEqual(['light', '#c9e7f1', '#1f83a8'])
  expect(lookOf(THEMES[1]!, .4).backdrop).toEqual({ scene: 'narsil', glass: { blur: 12, tint: '#0f1a2c', opacity: .4 } })
  expect(lookOf(own, .4).backdrop).toBeUndefined()
})

test('every scene, in every mood, stays under the Svg limit and holds nothing the Backdrop refuses', () => {
  const moods = [CALM, { ...CALM, state: 'thinking', tide: true }, { ...CALM, state: 'waiting', wave: 'waiting' },
    { ...CALM, wave: 'error', flare: true }, { ...CALM, speed: 16, now: 123_456_789 }] as const
  for (const [name, draw] of Object.entries(SCENES))
    for (const m of moods) {
      const svg = draw(m)
      expect(svg.length < SCENE_MAX).toBe(true)
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
      for (const bad of ['data:', 'base64', '<image', 'href', 'foreignObject', '@import', '@font-face', 'CDATA', '<!DOCTYPE', '<?'])
        expect(`${name}: ${svg.includes(bad) ? bad : ''}`).toBe(`${name}: `)
      expect(svg.includes(String.fromCharCode(92))).toBe(false)
      expect(svg.match(/url\((?!#)/g)).toBeNull()
      expect(svg.match(/&(?!amp;|lt;|gt;|quot;|apos;)/g)).toBeNull()
      expect(svg.match(/<style>/g)?.length).toBe(1)
    }
})

test('each wave and mood shows in the scene, in both themes', () => {
  for (const [name, draw] of Object.entries(SCENES)) {
    expect(draw(CALM)).not.toMatch(/class="shoot"|class="rim"|animation:flare/)
    expect(draw({ ...CALM, state: 'thinking' })).toMatch(/class="shoot"/)
    expect(draw({ ...CALM, state: 'waiting' })).toMatch(/class="rim"/)
    expect(draw({ ...CALM, flare: true })).toMatch(/animation:flare/)
    expect(draw({ ...CALM, tide: true })).toMatch(/translate\(0 -60\)/)
    expect(draw(CALM)).toMatch(/translate\(0 -46\)/)
    const calm = draw(CALM), yellow = draw({ ...CALM, wave: 'waiting' }), red = draw({ ...CALM, wave: 'error' })
    expect(new Set([calm, yellow, red]).size).toBe(3)
    expect(red).toMatch(/fill="#ff5a6e"/)
    expect(name).toBeDefined()
  }
  // (Narsil Light's yellow is a softer one, so the words over it read)
  expect(SCENES.narsil!({ ...CALM, wave: 'waiting' })).toMatch(/fill="#ffc94d"/)
  expect(SCENES['narsil-light']!({ ...CALM, wave: 'waiting' })).toMatch(/fill="#f7b529"/)
})

test('the Backdrop draws its own scenes on desktop and mobile, and leaves the rest to the engine', async ($, on) => {
  world($, on, { files: { [win(MINE, 'my-dusk.json')]: JSON.stringify(OWN), [win(MINE, 'my-dusk.svg')]: SVG } })
  on('ui.render', { component: 'Backdrop' }, ($, e) => $.ui.resolve(e).Box({}))
  await begin($)
  expect(await scene($, 'narsil')).toMatch(/crescent moon/)
  expect(await scene($, 'narsil-light', 'mobile')).toMatch(/turning sun/)
  expect(await scene($, 'my-dusk')).toBe(SVG)
  expect(await scene($, 'unknown')).toBe('')
})

test('removing takes out only our entries from a shared slot, and the whole slot when it was ours', () => {
  const war = [{ resources: ['theme.json', 'event.json'], matches: ['<all_urls>'] }]
  const shared = withoutOurs({ content_scripts: [{ js: ['splash.js'] }, { js: ['theme.js'] }], web_accessible_resources: war })
  expect(shared?.content_scripts).toEqual([{ js: ['splash.js'] }])
  expect(shared?.web_accessible_resources).toEqual([])
  expect(withoutOurs({ content_scripts: [{ js: ['theme.js'] }], web_accessible_resources: war })).toBeUndefined()
})

test('/narsil-skin themes opens the side pane with a button per theme and no install step, and Close closes it', async ($, on) => {
  const opened: string[] = [], closed: string[] = []
  world($, on, {
    files: { [win(MINE, 'my-dusk.json')]: JSON.stringify(OWN) },
    hooks: {
      'ui.open': ($: any, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } },
      'ui.close': ($: any, e: any) => { closed.push(e.id); return { value: undefined } },
    },
  })
  const result = await run($, 'themes')
  expect(result.text).toMatch(/side pane/)
  expect(opened).toEqual(['themes'])
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'install' })).toBeUndefined()
  expect(await ui.find({ key: 'remove' })).toBeUndefined()
  for (const id of [...THEMES.map(t => t.id), 'my-dusk']) expect(await ui.find({ key: `use-${id}` })).toBeDefined()
  await ui.press({ key: 'close' })
  await ui.unmount()
  expect(closed).toEqual(['themes'])
})

test('only /narsil-skin is registered: its themes opens the pane, and anything else shows the help', async ($, on) => {
  const registered: string[] = []
  world($, on, { hooks: { 'command.register': ($: any, e: any) => { registered.push(e.name); return { value: { command: e.name } } } } })
  await begin($)
  expect(registered).toEqual(['narsil-skin'])
  expect((await run($, 'themes')).text).toMatch(/side pane/)
  for (const args of ['', 'help', 'nope']) {
    const help = await run($, args)
    expect(help.text).toMatch(/\/narsil-skin themes/)
    expect(help.text).toMatch(/\/narsil-skin:make-theme/)
  }
})

const OLD = '{"content_scripts":[{"matches":["<all_urls>"],"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}'

test('on macOS the old extension is offered for removal, and removing it takes its folder and REACT_PROFILE', async ($, on) => {
  const home = '/Users/p', support = `${home}/Library/Application Support`
  const slot = `${support}/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi`
  const agent = `${home}/Library/LaunchAgents/com.github.0toshigami.themes-for-claude.plist`
  // (run on Windows, the engine hands these hooks /Users/p as E:\Users\p)
  const posix = (p: string) => p.replace(/^[A-Za-z]:/, '').split(String.fromCharCode(92)).join('/')
  const { runs } = world($, on, {
    env: { USERPROFILE: '', APPDATA: '', HOME: home },
    hooks: {
      'fs.exists': ($: any, e: any) => ({ value: posix(e.path) === `${support}/Claude` }),
      'fs.read': ($: any, e: any) => {
        if (posix(e.path) === `${slot}/manifest.json`) return { value: OLD }
        throw new Error('ENOENT')
      },
    },
  })
  await run($, 'themes')
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /old extension/ }))?.text).toMatch(/still installed/)
  await ui.press({ key: 'remove' })
  expect(await ui.find({ key: 'remove' })).toBeUndefined()
  await ui.unmount()
  expect(runs).toContainEqual(['launchctl', 'unsetenv', 'REACT_PROFILE'])
  expect(runs).toContainEqual(['rm', '-f', agent])
  expect(runs).toContainEqual(['rm', '-rf', slot])
})

test('on Windows the old extension is found in the Claude-Data folder, and a shared slot keeps the other mod', async ($, on) => {
  const local = win(HOME, 'AppData', 'Local'), data = win(local, 'Claude-Data', 'claude_abc')
  const slot = win(data, 'extensions', 'fmkadmapgofadopljbjfkapdkoienihi')
  const shared = '{"content_scripts":[{"js":["splash.js"]},{"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}'
  const { runs, files } = world($, on, {
    env: { LOCALAPPDATA: local },
    files: { [win(data, 'Local State')]: '{}', [win(slot, 'manifest.json')]: shared },
    hooks: {
      'fs.list': ($: any, e: any) =>
        ({ value: e.path === win(local, 'Claude-Data') ? [{ name: 'claude_abc', kind: 'dir', size: 0, mtimeMs: 0 }] : [] }),
    },
  })
  await run($, 'themes')
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'remove' })
  await ui.unmount()
  expect(JSON.parse(files[win(slot, 'manifest.json')]!).content_scripts).toEqual([{ js: ['splash.js'] }])
  expect(runs[0]!.slice(0, 3)).toEqual(['cmd', '/c', 'del'])
  expect(runs[0]).toContain(win(slot, 'theme.js'))
  expect(runs.flat()).not.toContain('rmdir')
})
