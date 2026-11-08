import { expect, test } from 'claude-code/testing'

import { fileOf, withoutOurs } from '../hooks/register'
import { THEMES, parseUserTheme, tile } from '../hooks/themes'
import { sceneModule } from '../tools/assemble.mjs'

test('a person\'s own theme is read as a simple theme, and a bad one is refused', async () => {
  const good = parseUserTheme(JSON.stringify({ id: 'my-dusk', name: 'My Dusk', tagline: 't', bg: '#112233', text: '#eeeeee',
    accent: '#ff8800', vars: { 'cds-radius': '6px', 'Bad Key': 'x' }, wallpaper: 'moonlit' }), 'html{}')
  expect(good?.css).toBe('html{}')
  expect(good?.vars).toEqual({ 'cds-radius': '6px' })
  expect(good?.wallpaper).toBeUndefined()
  const own = { id: 'snowy', name: 'Snowy', bg: '#000000', text: '#ffffff', accent: '#ff0000', wallpaper: 'snowy' }
  expect(parseUserTheme(JSON.stringify(own), undefined, true)?.wallpaper).toBe('snowy')
  expect(parseUserTheme(JSON.stringify(own))?.wallpaper).toBeUndefined()
  expect(parseUserTheme(JSON.stringify({ ...own, wallpaper: 'moonlit' }), undefined, true)?.wallpaper).toBeUndefined()
  expect(parseUserTheme('{"id":"x y","name":"n","bg":"#000000","text":"#ffffff","accent":"#ff0000"}')).toBeUndefined()
  expect(parseUserTheme('{"id":"ok-id","name":"n","bg":"red","text":"#ffffff","accent":"#ff0000"}')).toBeUndefined()
  expect(parseUserTheme('not json')).toBeUndefined()
})

test('every theme has a tile the desktop takes, and Claude writes no colors', async () => {
  for (const t of THEMES) expect(tile(t, true).length < 131072).toBe(true)
  expect(fileOf(THEMES[0]!)).toBe('{}')
  expect(THEMES.map(t => t.id)).toEqual(['claude', 'narsil', 'night-sea', 'moonlit', 'jellyfish'])
  expect(THEMES.find(t => t.id === 'narsil')).toMatchObject({ bg: '#0f1a2c', text: '#dce6fa', accent: '#5aaeff', wallpaper: 'narsil' })
  expect(THEMES.find(t => t.id === 'narsil')?.vars?.['wall-sky']).toBe('#0f1a2c')
  const sea = JSON.parse(fileOf(THEMES[2]!, 'html{}'))
  expect(sea.accent).toBe('#5aaeff')
  expect(sea.css).toBe('html{}')
  expect(sea.vars['cds-radius']).toBe('8px')
  const look = JSON.parse(fileOf(THEMES[2]!, '', { motion: 'grid', speed: 2, cell: 14, veil: .6 }))
  expect(look.motion).toBe('grid')
  expect(look.speed).toBe(2)
  expect(look.cell).toBe(14)
  expect(look.veil).toBe(.6)
  expect(JSON.parse(fileOf(THEMES[2]!, '', undefined, 'scenes/snowy.js?v=1')).scene).toBe('scenes/snowy.js?v=1')
  expect(sceneModule("SCENES['snowy'] = {}")).toMatch(/^const \{ [^}]*\bsketch\b[^}]*\} = globalThis\.themesForClaude;\nSCENES/)
})

test('removing takes out only our entries from a shared slot, and the whole slot when it was ours', async () => {
  const war = [{ resources: ['theme.json', 'event.json'], matches: ['<all_urls>'] }]
  const shared = withoutOurs({ content_scripts: [{ js: ['splash.js'] }, { js: ['theme.js'] }], web_accessible_resources: war })
  expect(shared?.content_scripts).toEqual([{ js: ['splash.js'] }])
  expect(shared?.web_accessible_resources).toEqual([])
  expect(withoutOurs({ content_scripts: [{ js: ['theme.js'] }], web_accessible_resources: war })).toBeUndefined()
})

const PANE = {
  plugin: 'narsil-skin',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'themes',
  props: { title: 'Themes', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('/narsil-skin themes opens the side pane, a button per theme, and Close closes it', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const opened: string[] = [], closed: string[] = []
  on('ui.open', ($, e) => { opened.push(e.id); return { value: { isPlaced: true } } })
  on('ui.close', ($, e) => { closed.push(e.id); return { value: undefined } })
  // the extension is copied and Claude Desktop restarted once `restarted` is true
  let restarted = false
  on('env.get', ($, e) =>
    ({ value: e.name === 'APPDATA' ? 'C:\\AppData' : e.name === 'REACT_PROFILE' && restarted ? '1' : undefined }))
  on('fs.read', ($, e) => {
    if (restarted && e.path.endsWith('manifest.json')) return { value: '{"content_scripts":[{"js":["theme.js"]}]}' }
    throw new Error('ENOENT')
  })
  const props = { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 }
  const result = await $.command.run({ command: 'narsil-skin', args: 'themes' })
  expect(result.text).toMatch(/side pane/)
  expect(opened).toEqual(['themes'])
  // nothing is drawn above the prompt any more
  const band = await $.ui.mount({ plugin: 'narsil-skin', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await band.find({ key: 'close' })).toBeUndefined()
  expect(await band.find({ key: 'install' })).toBeUndefined()
  await band.unmount()
  const bare = await $.ui.mount(PANE)
  expect(await bare.find({ key: 'install' })).toBeDefined()
  for (const t of THEMES) expect(await bare.find({ key: `use-${t.id}` })).toBeUndefined()
  await bare.unmount()
  restarted = true
  await $.command.run({ command: 'narsil-skin', args: 'themes' })
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'install' })).toBeUndefined()
  expect(await ui.find({ key: 'remove' })).toBeDefined()
  for (const t of THEMES) expect(await ui.find({ key: `use-${t.id}` })).toBeDefined()
  await ui.press({ key: 'close' })
  await ui.unmount()
  expect(closed).toEqual(['themes'])
})


test('on macOS the pane installs into Application Support and sets REACT_PROFILE with launchctl, and removes both', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const home = '/Users/p', support = `${home}/Library/Application Support`
  const slot = `${support}/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi`
  const agent = `${home}/Library/LaunchAgents/com.github.0toshigami.themes-for-claude.plist`
  // a small disk: what the mod writes, and its own extension's files as a stand-in
  const disk = new Map<string, string>()
  const runs: string[][] = []
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? home : undefined }))
  // (run on Windows, the engine hands these hooks /Users/p as E:\Users\p)
  const posix = (p: string) => p.replace(/^[A-Za-z]:/, '').replaceAll('\\', '/')
  on('fs.exists', ($, e) => ({ value: posix(e.path) === `${support}/Claude` || disk.has(posix(e.path)) }))
  on('fs.list', () => ({ value: [] }))
  on('fs.write', ($, e) => { disk.set(posix(e.path), e.text); return { value: undefined } })
  on('fs.read', ($, e) => {
    const path = posix(e.path)
    if (disk.has(path)) return { value: disk.get(path)! }
    if (path.endsWith('/extension/manifest.json'))
      return { value: '{"content_scripts":[{"matches":["<all_urls>"],"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}' }
    if (path.includes('/extension/src/')) return { value: '' }
    throw new Error('ENOENT')
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const props = { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 }

  await $.command.run({ command: 'narsil-skin', args: 'themes' })
  const bare = await $.ui.mount(PANE)
  await bare.press({ key: 'install' })
  await bare.unmount()
  expect(disk.has(`${slot}/theme.js`)).toBe(true)
  expect(disk.get(`${slot}/manifest.json`)).toMatch(/"theme\.js"/)
  expect(disk.get(agent)).toMatch(/<string>REACT_PROFILE<\/string><string>1<\/string>/)
  expect(runs).toContainEqual(['launchctl', 'setenv', 'REACT_PROFILE', '1'])

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /Cmd\+Q/ }))?.text).toMatch(/Quit Claude Desktop fully \(Cmd\+Q\)/)
  await ui.press({ key: 'remove' })
  await ui.unmount()
  expect(runs).toContainEqual(['launchctl', 'unsetenv', 'REACT_PROFILE'])
  expect(runs).toContainEqual(['rm', '-f', agent])
  expect(runs).toContainEqual(['rm', '-rf', slot])
})

test('only /narsil-skin is registered: its themes opens the pane, and anything else shows the help', async ($, on) => {
  const registered: string[] = []
  on('command.register', ($, e) => { registered.push(e.name); return { value: { command: e.name } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const opened: string[] = []
  on('ui.open', ($, e) => { opened.push(e.id); return { value: { isPlaced: true } } })
  on('env.get', () => ({ value: undefined }))
  on('fs.read', () => { throw new Error('ENOENT') })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(registered).toEqual(['narsil-skin'])
  const viaGroup = await $.command.run({ command: 'narsil-skin', args: 'themes' })
  expect(viaGroup.text).toMatch(/side pane/)
  expect(opened).toEqual(['themes'])
  for (const args of ['', 'help', 'nope']) {
    const help = await $.command.run({ command: 'narsil-skin', args })
    expect(help.text).toMatch(/\/narsil-skin themes/)
    expect(help.text).toMatch(/\/narsil-skin:make-theme/)
    expect(help.text).not.toMatch(/\/themes/)
  }
  expect(opened).toEqual(['themes'])
})

// (Windows paths built with the separator by code, so this file holds no backslash to escape)
const win = (...parts: string[]) => parts.join(String.fromCharCode(92))
const slash = (p: string) => p.split(String.fromCharCode(92)).join('/')

test('on Windows the pane installs into the Claude-Data folder the app reads, when there is one', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const local = win('C:', 'Users', 'p', 'AppData', 'Local'), dataRoot = win(local, 'Claude-Data')
  const data = win(dataRoot, 'claude_abc'), slot = win(data, 'extensions', 'fmkadmapgofadopljbjfkapdkoienihi')
  const devtools = JSON.stringify({ name: 'React Developer Tools',
    content_scripts: [{ matches: ['<all_urls>'], js: ['build/prepareInjection.js'] }],
    web_accessible_resources: [{ resources: ['build/*.js'] }] })
  const disk = new Map<string, string>([[win(slot, 'manifest.json'), devtools]])
  const runs: string[][] = []
  const env: Record<string, string> = { APPDATA: win('C:', 'Users', 'p', 'AppData', 'Roaming'), LOCALAPPDATA: local, USERPROFILE: win('C:', 'Users', 'p') }
  on('env.get', ($, e) => ({ value: env[e.name] }))
  on('fs.exists', ($, e) => ({ value: e.path === dataRoot || e.path === win(data, 'Local State') || disk.has(e.path) }))
  on('fs.list', ($, e) => ({ value: e.path === dataRoot ? [{ name: 'claude_abc', kind: 'dir' }] : [] }))
  on('fs.write', ($, e) => { disk.set(e.path, e.text); return { value: undefined } })
  on('fs.read', ($, e) => {
    if (disk.has(e.path)) return { value: disk.get(e.path)! }
    if (slash(e.path).endsWith('/extension/manifest.json'))
      return { value: '{"content_scripts":[{"matches":["<all_urls>"],"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}' }
    if (slash(e.path).includes('/extension/src/')) return { value: '' }
    throw new Error('ENOENT')
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.command.run({ command: 'narsil-skin', args: 'themes' })
  const bare = await $.ui.mount(PANE)
  await bare.press({ key: 'install' })
  await bare.unmount()
  expect(disk.has(win(slot, 'theme.js'))).toBe(true)
  const manifest = JSON.parse(disk.get(win(slot, 'manifest.json'))!)
  expect(manifest.name).toBe('React Developer Tools')
  expect(manifest.content_scripts.map((s: { js: string[] }) => s.js[0])).toEqual(['build/prepareInjection.js', 'theme.js'])
  expect([...disk.keys()].some(k => k.includes('Roaming'))).toBe(false)
  expect(runs).toContainEqual(['setx', 'REACT_PROFILE', '1'])
})

test('on Windows without a Claude-Data folder the pane keeps installing into AppData Roaming', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const roaming = win('C:', 'Users', 'p', 'AppData', 'Roaming')
  const slot = win(roaming, 'Claude', 'extensions', 'fmkadmapgofadopljbjfkapdkoienihi')
  const disk = new Map<string, string>()
  const env: Record<string, string> = { APPDATA: roaming, LOCALAPPDATA: win('C:', 'Users', 'p', 'AppData', 'Local'), USERPROFILE: win('C:', 'Users', 'p') }
  on('env.get', ($, e) => ({ value: env[e.name] }))
  on('fs.exists', ($, e) => ({ value: disk.has(e.path) }))
  on('fs.list', () => ({ value: [] }))
  on('fs.write', ($, e) => { disk.set(e.path, e.text); return { value: undefined } })
  on('fs.read', ($, e) => {
    if (disk.has(e.path)) return { value: disk.get(e.path)! }
    if (slash(e.path).endsWith('/extension/manifest.json'))
      return { value: '{"content_scripts":[{"matches":["<all_urls>"],"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}' }
    if (slash(e.path).includes('/extension/src/')) return { value: '' }
    throw new Error('ENOENT')
  })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.command.run({ command: 'narsil-skin', args: 'themes' })
  const bare = await $.ui.mount(PANE)
  await bare.press({ key: 'install' })
  await bare.unmount()
  expect(disk.has(win(slot, 'theme.js'))).toBe(true)
  expect(disk.get(win(slot, 'manifest.json'))).toMatch(/"theme\.js"/)
})
