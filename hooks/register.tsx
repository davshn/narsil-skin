import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Theme } from '../types'
import { assemble, sceneModule } from '../tools/assemble.mjs'
import { THEMES, parseUserTheme, tile } from './themes'

// The React DevTools slot under Claude Desktop's userData. Claude Desktop loads it when REACT_PROFILE=1.
// userData on Windows: %LOCALAPPDATA%\Claude-Data\claude_<id> on newer installs (the Store app among them), else
// %APPDATA%\Claude; on macOS: ~/Library/Application Support/Claude.
const SLOT = ['extensions', 'fmkadmapgofadopljbjfkapdkoienihi']
const DATA_ROOT = 'Claude-Data'
const MAC_SUPPORT = ['Library', 'Application Support']
// macOS: what sets REACT_PROFILE=1 again at each login (launchctl setenv lasts until a restart)
const AGENT = 'com.github.0toshigami.themes-for-claude'
const QUIT = { windows: 'also from the tray', macos: 'Cmd+Q' } as const
const BY_HAND = {
  windows: 'Set the user environment variable REACT_PROFILE=1 by hand',
  macos: 'Run launchctl setenv REACT_PROFILE 1 in Terminal',
} as const
const current = atom({ plugin: 'narsil-skin', key: 'current' } as const, 'claude')
// missing: no extension; restart: copied, but Claude Desktop has not loaded it yet
type Setup = 'missing' | 'restart' | 'ready'
const setup = atom({ plugin: 'narsil-skin', key: 'setup' } as const, 'missing' as Setup)
type Motion = 'smooth' | 'grid'
type Look = { motion: Motion; speed: number; cell: number; veil: number }
const LOOK: Look = { motion: 'grid', speed: 4, cell: 14, veil: .4 }
const motion = atom({ plugin: 'narsil-skin', key: 'motion' } as const, LOOK.motion)
const MOTIONS: Record<Motion, string> = { smooth: 'Smooth', grid: 'Cell by cell' }
const speed = atom({ plugin: 'narsil-skin', key: 'speed' } as const, LOOK.speed)
const SPEEDS = [1, 2, 4, 8, 16]
const cell = atom({ plugin: 'narsil-skin', key: 'cell' } as const, LOOK.cell)
const CELLS: Record<number, string> = { 14: 'Small', 18: 'Medium', 22: 'Large' }
const veil = atom({ plugin: 'narsil-skin', key: 'veil' } as const, LOOK.veil)
const VEILS = [0, .2, .4, .6, .8]
// The picker is a side pane (not a strip above the prompt), so it leaves the prompt to other mods
const PANE = 'themes'
const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Themes', focus: true, closeOnEscape: true })

// Paths join with the separator the base path already uses: Windows paths hold a backslash, macOS ones never do
const join = (base: string, ...parts: string[]) => [base, ...parts].join(base.includes('\\') ? '\\' : '/')

// home: where the person's own themes folder is (empty when unknown); undefined: neither Windows nor macOS with
// Claude Desktop
type Host = { os: 'windows' | 'macos'; home: string; userData: string }
const hostOf = async ($: EngineInterface): Promise<Host | undefined> => {
  const appData = await $.env.get('APPDATA')
  if (appData) {
    const home = (await $.env.get('USERPROFILE')) ?? ''
    return { os: 'windows', home, userData: (await claudeData($)) ?? join(appData, 'Claude') }
  }
  const home = await $.env.get('HOME')
  const userData = home && join(home, ...MAC_SUPPORT, 'Claude')
  return userData && (await $.fs.exists(userData)) ? { os: 'macos', home: home!, userData } : undefined
}

// The Claude-Data userData a newer Windows install keeps (the one holding its Local State), when there is one
const claudeData = async ($: EngineInterface) => {
  const local = await $.env.get('LOCALAPPDATA')
  const root = local && join(local, DATA_ROOT)
  if (!root || !(await $.fs.exists(root).catch(() => false))) return undefined
  const dirs = (await $.fs.list(root).catch(() => []))
    .filter(f => f.kind === 'dir' && /^claude/i.test(f.name)).map(f => join(root, f.name)).sort()
  for (const dir of dirs) if (await $.fs.exists(join(dir, 'Local State')).catch(() => false)) return dir
  return undefined
}

const slot = async ($: EngineInterface) => {
  const h = await hostOf($)
  return h && join(h.userData, ...SLOT)
}
const agentFile = (h: Host) => join(h.home, 'Library', 'LaunchAgents', `${AGENT}.plist`)
const AGENT_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${AGENT}</string>
  <key>ProgramArguments</key>
  <array><string>/bin/launchctl</string><string>setenv</string><string>REACT_PROFILE</string><string>1</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`

// scene: the module path of the person's own scene, which the page imports
export const fileOf = (t: Theme, css = '', look: Look = LOOK, scene?: string) =>
  JSON.stringify(t.bg
    ? { id: t.id, bg: t.bg, text: t.text, accent: t.accent, font: t.font, vars: t.vars, wallpaper: t.wallpaper, scene, ...look, css }
    : {})

const statusOf = (t: Theme | undefined, kind: 'idle' | 'tool' | 'error' | 'done', tool = '') =>
  t?.status?.[kind].split('{tool}').join(tool)

let mine: Theme[] = []
const MINE = ['.claude', 'narsil-skin']
const mineDir = async ($: EngineInterface) => {
  const h = await hostOf($)
  return h?.home ? join(h.home, ...MINE) : undefined
}
// when each of the person's scenes last changed: the page loads it again on a new time
let sceneAt: Record<string, number> = {}

const loadMine = async ($: EngineInterface) => {
  const dir = await mineDir($)
  if (!dir || !(await $.fs.exists(dir))) return void (mine = [])
  const files = await $.fs.list(dir)
  const at = (name: string) => files.find(f => f.kind === 'file' && f.name === name)?.mtimeMs
  const found: Theme[] = []
  for (const f of files) {
    if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
    const id = f.name.slice(0, -5)
    const css = at(`${id}.css`) ? String(await $.fs.read(join(dir, `${id}.css`))) : undefined
    const t = parseUserTheme(String(await $.fs.read(join(dir, f.name))), css, at(`${id}.js`) !== undefined)
    if (t?.wallpaper && t.id !== id) t.wallpaper = undefined // (its scene is <id>.js by the file's name)
    const jpg = files.find(f => f.kind === 'file' && f.name === `${id}.jpg`)
    // (a missing, large or broken picture leaves the tile drawn from the theme's colors)
    const pic = t?.wallpaper && jpg && jpg.size < 16000
      ? (await $.fs.read(join(dir, `${id}.jpg`), { as: 'bytes' }).catch(() => undefined))?.base64 : undefined
    if (t && pic?.startsWith('/9j/')) t.thumb = `data:image/jpeg;base64,${pic}`
    if (t && !THEMES.some(b => b.id === t.id)) found.push(t)
  }
  mine = found
  sceneAt = Object.fromEntries(found.filter(t => t.wallpaper).map(t => [t.id, Math.round(at(`${t.id}.js`)!)]))
}
const allThemes = () => [...THEMES, ...mine]

let n = Date.now() // (so a reloaded module never repeats an event number)
// The automatic option: `current` is AUTO, theme.json holds both themes and the page picks one by its own clock
const AUTO = 'auto'
const DAY = 'narsil-light'
const NIGHT = 'narsil'
export const isDay = (hour: number) => hour >= 6 && hour < 18
const ofTheHour = () => THEMES.find(t => t.id === (isDay(new Date().getHours()) ? DAY : NIGHT))!
const active = async ($: EngineInterface) => {
  const id = await read($, current)
  if (id === AUTO) return ofTheHour()
  return id === 'claude' ? undefined : allThemes().find(t => t.id === id)
}
type State = 'thinking' | 'waiting' | 'idle'
type Mood = { state: State; failed: boolean }
// Every conversation reports here (sessions/<id>.json) and writes event.json for all of them, so none overwrites another.
// BEAT refreshes the report; one older than LIVE is a conversation that closed or died
const SESSIONS = 'sessions'
const BEAT = 10_000
const LIVE = 30_000

// All the conversations together. Yellow beats red: it blocks work and ends when answered, while a red can linger
export const pool = (moods: Mood[]) => {
  const waiting = moods.some(m => m.state === 'waiting')
  const tide = moods.some(m => m.state === 'thinking')
  return {
    state: (waiting ? 'waiting' : tide ? 'thinking' : 'idle') as State,
    wave: waiting ? 'waiting' : moods.some(m => m.failed) ? 'error' : '',
    tide,
  }
}

// This conversation: its running turns (subagents' too), its open questions to the person, and how the last work ended
const turns = new Set<string>()
const asks = new Set<string>()
let blocked = false // (its last turn closed waiting on the person)
let failed = false
const stateNow = (): State => (asks.size || blocked ? 'waiting' : turns.size ? 'thinking' : 'idle')
// the text a call refused by the person or a permission rule answers with: a choice, not a failure
const REFUSED = /doesn't want to (proceed|take this action)|^Permission to use /
const ASKS = 'AskUserQuestion'
const WRAP_UP = 'mcp__ccd_turn__wrap_up'

const readMood = async ($: EngineInterface, path: string) => {
  try {
    const m = JSON.parse(String(await $.fs.read(path)))
    return typeof m.at === 'number' && typeof m.state === 'string' ? m as Mood & { at: number } : undefined
  } catch {
    return undefined // (caught mid-write: the next beat reads it)
  }
}

const isIdle = (p: ReturnType<typeof pool>) => p.state === 'idle' && !p.wave

// one at a time, so this conversation's own reports stay in order
let queue: Promise<void> = Promise.resolve()
const publish = ($: EngineInterface, kind: '' | 'tool' | 'error' | 'done' = '', tool = '') => {
  queue = queue.then(async () => {
    const dir = await slot($)
    if (!dir || !(await active($))) return
    const folder = join(dir, SESSIONS), at = Date.now(), own = `${await $.session.id()}.json`
    await $.fs.write(join(folder, own), JSON.stringify({ state: stateNow(), failed, at }))
    const moods: Mood[] = [], gone: string[] = []
    for (const f of await $.fs.list(folder)) {
      if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
      const m = await readMood($, join(folder, f.name))
      if (m && at - m.at < LIVE) moods.push(m)
      else if (m) gone.push(join(folder, f.name))
    }
    if (gone.length) {
      const h = await hostOf($)
      await $.process.run(h?.os === 'windows' ? ['cmd', '/c', 'del', '/q', ...gone] : ['rm', '-f', '--', ...gone]).catch(() => {})
    }
    const now = pool(moods), event = join(dir, 'event.json')
    // (an idle beat rewrites only what is out of date; anything else refreshes `at`, which the page holds it up by)
    if (!kind && isIdle(now)) {
      const was = (await readMood($, event)) as { state: State; wave?: string; tide?: boolean } | undefined
      if (was?.state === 'idle' && !was.wave && !was.tide) return
    }
    await $.fs.write(event, JSON.stringify({ n: ++n, kind, tool, ...now, at }))
  }).catch(() => {})
  return queue
}

const check = async ($: EngineInterface) => {
  const dir = await slot($)
  const manifest = dir ? await $.fs.read(join(dir, 'manifest.json')).catch(() => '') : ''
  // setx and launchctl setenv reach only processes started after them, so REACT_PROFILE shows here once Claude Desktop restarted
  const loaded = (await $.env.get('REACT_PROFILE')) === '1'
  await update($, setup, was => !String(manifest).includes('"theme.js"') ? 'missing'
    : loaded && was !== 'restart' ? 'ready' : 'restart')
}

// theme.js: the mod's scenes (the person's own load on their own, see pick)
const build = async ($: EngineInterface) => {
  const ext = `${$.plugin.root}/extension`
  const read = async (f: string) => String(await $.fs.read(`${ext}/src/${f}`))
  const scenes = (await $.fs.list(`${ext}/src/scenes`)).filter(f => f.kind === 'file' && f.name.endsWith('.js')).map(f => f.name).sort()
  return assemble(await read('core.js'), await Promise.all(scenes.map(f => read(`scenes/${f}`))), await read('engine.js'))
}

// the slot's manifest with our entries in (the slot is React DevTools' and other mods may share it)
const withOurs = async ($: EngineInterface, dir: string) => {
  const fresh = JSON.parse(String(await $.fs.read(`${$.plugin.root}/extension/manifest.json`)))
  let manifest = fresh
  try {
    manifest = JSON.parse(String(await $.fs.read(join(dir, 'manifest.json'))))
  } catch {}
  if (manifest !== fresh) {
    const scripts: { js?: string[]; run_at?: string }[] = (manifest.content_scripts ??= [])
    if (!scripts.some(s => s.js?.includes('theme.js'))) scripts.push(fresh.content_scripts[0])
    const war: { resources?: string[] }[] = (manifest.web_accessible_resources ??= [])
    const ours = war.find(w => w.resources?.includes('theme.json'))
    if (ours) ours.resources = [...new Set([...(ours.resources ?? []), ...OURS])]
    else war.push(fresh.web_accessible_resources[0])
  }
  return JSON.stringify(manifest, null, 2)
}

// after a mod update: its scenes into theme.js, its entries into the manifest; the page loads both at start
const rebuild = async ($: EngineInterface) => {
  const dir = await slot($)
  if (!dir || (await read($, setup)) === 'missing') return
  const now = async (f: string) => String(await $.fs.read(join(dir, f)).catch(() => ''))
  const js = await build($), manifest = await withOurs($, dir)
  if ((await now('theme.js')) === js && JSON.stringify(JSON.parse(await now('manifest.json'))) === JSON.stringify(JSON.parse(manifest))) return
  await $.fs.write(join(dir, 'theme.js'), js)
  await $.fs.write(join(dir, 'manifest.json'), manifest)
  $.ui.toast('The extension is updated. Restart Claude Desktop to see the changes.')
}

// REACT_PROFILE=1 for the apps started from now on, and after the next login
const setProfile = async ($: EngineInterface, h: Host) => {
  if (h.os === 'windows') return (await $.process.run(['setx', 'REACT_PROFILE', '1'])).exitCode
  await $.fs.write(agentFile(h), AGENT_PLIST)
  return (await $.process.run(['launchctl', 'setenv', 'REACT_PROFILE', '1'])).exitCode
}
const clearProfile = async ($: EngineInterface, h: Host) => {
  if (h.os === 'windows') {
    // (SetEnvironmentVariable, not reg delete: it tells Windows, so apps started later see the change)
    await $.process.run(['powershell', '-NoProfile', '-Command',
      "[Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User')"])
    return
  }
  await $.process.run(['launchctl', 'unsetenv', 'REACT_PROFILE'])
  await $.process.run(['rm', '-f', agentFile(h)])
}

const install = async ($: EngineInterface) => {
  const h = await hostOf($)
  const dir = await slot($)
  if (!h || !dir) {
    $.ui.toast('Only Windows and macOS are supported for now.')
    return
  }
  await $.fs.write(join(dir, 'theme.js'), await build($))
  if (!(await $.fs.exists(join(dir, 'theme.json')))) await $.fs.write(join(dir, 'theme.json'), '{}')
  if (!(await $.fs.exists(join(dir, 'event.json')))) await $.fs.write(join(dir, 'event.json'), '{}')
  await $.fs.write(join(dir, 'manifest.json'), await withOurs($, dir))
  const exitCode = await setProfile($, h)
  await update($, setup, () => 'restart')
  $.ui.toast(exitCode === 0
    ? `Installed. Quit Claude Desktop fully (${QUIT[h.os]}) and open it again to use the themes.`
    : 'The extension is copied, but REACT_PROFILE=1 could not be set.')
}

type Manifest = { content_scripts?: { js?: string[] }[]; web_accessible_resources?: { resources?: string[] }[] }
// our web-accessible files, the scenes among them a pattern; with theme.js, the files we delete on remove
const OURS = ['theme.json', 'event.json', 'scenes/*.js']
// The slot is React DevTools' and other mods may share it, so take out only our entries;
// undefined when nothing but ours was there
export const withoutOurs = (m: Manifest): Manifest | undefined => {
  const scripts = (m.content_scripts ?? []).filter(s => !s.js?.includes('theme.js'))
  if (!scripts.length) return undefined
  const war = (m.web_accessible_resources ?? [])
    .map(w => ({ ...w, resources: w.resources?.filter(r => !OURS.includes(r)) }))
    .filter(w => w.resources?.length)
  return { ...m, content_scripts: scripts, web_accessible_resources: war }
}

const remove = async ($: EngineInterface) => {
  const h = await hostOf($)
  const dir = await slot($)
  if (!h || !dir) return
  let manifest: Manifest | undefined
  try {
    manifest = JSON.parse(String(await $.fs.read(join(dir, 'manifest.json'))))
  } catch {}
  // an unreadable manifest may still belong to another mod: then delete only our files, never the folder
  const rest = manifest && withoutOurs(manifest)
  let exitCode: number | null
  if (!manifest || rest) {
    if (rest) await $.fs.write(join(dir, 'manifest.json'), JSON.stringify(rest, null, 2))
    const files = ['theme.js', ...OURS, `${SESSIONS}/*.json`].map(f => join(dir, ...f.split('/')))
    // (del expands the *.js and *.json patterns itself; rm takes those files by name, as their folders hold no others)
    const named: string[] = []
    if (h.os === 'macos') for (const name of ['scenes', SESSIONS]) {
      const folder = join(dir, name)
      if (await $.fs.exists(folder)) named.push(...(await $.fs.list(folder)).filter(f => f.kind === 'file').map(f => join(folder, f.name)))
    }
    ;({ exitCode } = await $.process.run(h.os === 'windows'
      ? ['cmd', '/c', 'del', '/q', ...files]
      : ['rm', '-f', '--', ...files.filter(f => !f.includes('*')), ...named]))
  } else {
    await clearProfile($, h)
    ;({ exitCode } = await $.process.run(h.os === 'windows' ? ['cmd', '/c', 'rmdir', '/s', '/q', dir] : ['rm', '-rf', dir]))
  }
  await update($, setup, () => 'missing')
  await update($, current, () => 'claude')
  $.ui.status(undefined)
  $.ui.toast(exitCode === 0
    ? 'Extension removed. Restart Claude Desktop; then you can uninstall the plugin.'
    : `Could not remove every file. Delete them by hand in ${dir}`)
}

const lookNow = async ($: EngineInterface): Promise<Look> =>
  ({ motion: await read($, motion), speed: await read($, speed), cell: await read($, cell), veil: await read($, veil) })

// the theme's file as the page reads it
const fileFor = async ($: EngineInterface, dir: string, t: Theme) => {
  const css = async (name: string) => String(await $.fs.read(`${$.plugin.root}/themes/${name}.css`).catch(() => ''))
  const wall = t.wallpaper ? await css('_wallpaper') : ''
  // the person's own scene: copied in as a module beside theme.js, a new ?v= each time the file changes
  const own = t.wallpaper && Object.hasOwn(sceneAt, t.id) ? await mineDir($) : undefined
  if (own) await $.fs.write(join(dir, 'scenes', `${t.id}.js`), sceneModule(String(await $.fs.read(join(own, `${t.id}.js`)))))
  return fileOf(t, `${await css('_base')}\n${wall}\n${t.css ?? (await css(t.id))}`, await lookNow($),
    own ? `scenes/${t.id}.js?v=${sceneAt[t.id]}` : undefined)
}

const pick = async ($: EngineInterface, t: Theme) => {
  const dir = await slot($)
  if (!dir) return
  await $.fs.write(join(dir, 'theme.json'), await fileFor($, dir, t))
  await update($, current, () => t.id)
  $.ui.status(statusOf(t, 'idle'))
  $.ui.toast(`Theme: ${t.name}`)
}

const pickAuto = async ($: EngineInterface) => {
  const dir = await slot($)
  if (!dir) return
  const of = async (id: string) => JSON.parse(await fileFor($, dir, THEMES.find(t => t.id === id)!))
  await $.fs.write(join(dir, 'theme.json'),
    JSON.stringify({ id: AUTO, auto: true, ...(await lookNow($)), day: await of(DAY), night: await of(NIGHT) }))
  await update($, current, () => AUTO)
  $.ui.status(statusOf(ofTheHour(), 'idle'))
  $.ui.toast('Theme: Narsil Light by day, Narsil by night')
}

const next = <T,>(list: T[]) => (v: T) => list[(list.indexOf(v) + 1) % list.length]!
const repick = async ($: EngineInterface) => {
  if ((await read($, current)) === AUTO) return pickAuto($)
  const now = await active($)
  if (now) await pick($, now)
}
const toggleMotion = async ($: EngineInterface) => { await update($, motion, next(Object.keys(MOTIONS) as Motion[])); await repick($) }
const nextSpeed = async ($: EngineInterface) => { await update($, speed, next(SPEEDS)); await repick($) }
const nextCell = async ($: EngineInterface) => { await update($, cell, next(Object.keys(CELLS).map(Number))); await repick($) }
const nextVeil = async ($: EngineInterface) => { await update($, veil, next(VEILS)); await repick($) }

const HELP = [
  'Narsil Skin commands:',
  '  /narsil-skin themes   open the theme pane',
  '  /narsil-skin:make-theme   make your own theme from an idea or a picture',
].join('\n')

// /narsil-skin themes: refresh what the pane shows, then open it
const showThemes = async ($: EngineInterface) => {
  await check($).catch(() => {})
  await loadMine($).catch(() => {})
  await rebuild($).catch(() => {})
  const opened = await openPane($)
  return opened.isPlaced ? 'Themes opened in the side pane.' : `Themes pane not shown: ${opened.reason}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // (one command for the mod, so it does not take a name other plugins may want)
    await $.command.register({ name: 'narsil-skin', description: 'Narsil Skin: themes (open the theme pane), help' })
    try {
      await loadMine($).catch(() => {})
      const dir = await slot($)
      const saved = dir ? JSON.parse(String(await $.fs.read(join(dir, 'theme.json')))) : {}
      await update($, current, () => (typeof saved.id === 'string' ? saved.id : 'claude'))
      await update($, motion, () => (Object.hasOwn(MOTIONS, saved.motion) ? saved.motion : LOOK.motion))
      await update($, speed, () => (SPEEDS.includes(saved.speed) ? saved.speed : LOOK.speed))
      await update($, cell, () => (CELLS[saved.cell] ? saved.cell : LOOK.cell))
      await update($, veil, () => (VEILS.includes(saved.veil) ? saved.veil : LOOK.veil))
      $.ui.status(statusOf(await active($), 'idle'))
      $.clock.every(BEAT, () => void publish($))
    } catch {}
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    turns.clear()
    asks.clear()
    blocked = failed = false
    await publish($)
    return next(e)
  })

  on('command.run', { command: 'narsil-skin' }, async ($, e) =>
    ({ text: e.args.trim() === 'themes' ? await showThemes($) : HELP }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = 'Svg' in els ? els.Svg : undefined
    const now = await read($, current)
    const stage = await read($, setup)
    const move = await read($, motion)
    const pace = await read($, speed)
    const size = await read($, cell)
    const shade = await read($, veil)
    const os = (await hostOf($))?.os ?? 'windows'
    const worn = now === AUTO ? ofTheHour() : allThemes().find(t => t.id === now) ?? THEMES[0]!
    const row = (title: string, themes: Theme[]) => (
      <Box key={`row-${title}`} flexDirection="column" gap="xs">
        <Text dimColor>{title}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {themes.map(t => (
            <Box key={`tile-${t.id}`} flexDirection="column" alignItems="center" gap="xs">
              {Svg ? <Svg source={tile(t, t.id === now)} alt={`Preview of ${t.name}`} width={120} /> : null}
              <Button key={`use-${t.id}`} label={t.id === now ? `✓ ${t.name}` : t.name} dimColor={t.id !== now}
                onPress={() => pick($, t)} />            </Box>
          ))}
        </Box>
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text>
            <Text weight="semibold">Themes</Text>
            <Text dimColor>{`  ·  ${worn.name}: ${worn.tagline}`}</Text>
          </Text>
          <Box flexDirection="row" gap={1}>
            {stage === 'missing' ? null
              : <Button key="remove" label="Remove extension" dimColor onPress={() => remove($)} />}
            <Button key="close" role="dismiss" label="Close" onPress={() => $.ui.close({ id: PANE })} />
          </Box>
        </Box>
        {stage === 'missing' ? (
          <Box key="notice" flexDirection="column" gap="xs" padding={1} borderStyle="round" borderColor="warning">
            <Text color="warning" weight="semibold">One step first: install the extension</Text>
            <Text>It paints the themes on Claude Desktop. After it is installed, restart Claude Desktop.</Text>
            <Box flexDirection="row">
              <Button key="install" label="Install extension" variant="primary" onPress={() => install($)} />
            </Box>
          </Box>
        ) : stage === 'restart' ? (
          <Box key="notice" flexDirection="column" gap="xs" padding={1} borderStyle="round" borderColor="success">
            <Text color="success" weight="semibold">Installed. Now restart Claude Desktop</Text>
            <Text>{`Quit Claude Desktop fully (${QUIT[os]}), open it again, then type /narsil-skin themes.`}</Text>
            <Text dimColor>{`Still here after a restart? ${BY_HAND[os]}, then restart again.`}</Text>
          </Box>
        ) : worn.wallpaper && (
          <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Text dimColor>Wallpaper:</Text>
            <Text dimColor>motion</Text>
            <Button key="motion" label={MOTIONS[move]} onPress={() => toggleMotion($)} />
            <Text dimColor>speed</Text>
            <Button key="speed" label={`${pace}×`} onPress={() => nextSpeed($)} />
            <Text dimColor>size</Text>
            <Button key="cell" label={CELLS[size]} onPress={() => nextCell($)} />
            <Text dimColor>chat backdrop</Text>
            <Button key="veil" label={shade ? `${Math.round(shade * 100)}%` : 'Off'} onPress={() => nextVeil($)} />
          </Box>
        )}
        {stage === 'ready' ? (
          <Box key="auto-row" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Button key="auto" label={now === AUTO ? '✓ Auto day and night' : 'Auto day and night'} dimColor={now !== AUTO}
              onPress={() => (now === AUTO ? pick($, ofTheHour()) : pickAuto($))} />
            <Text dimColor>Narsil Light from 6:00 to 17:59, Narsil from 18:00 to 5:59</Text>
          </Box>
        ) : null}
        {stage === 'ready' ? row('Live wallpapers', THEMES.filter(t => t.wallpaper)) : null}
        {stage === 'ready' ? row('Color themes', THEMES.filter(t => !t.wallpaper)) : null}
        {stage === 'ready' && mine.length ? row('Your themes', mine) : null}
      </Box>
    )
  })

  on('turn.start', async ($, e, next) => {
    turns.add(e.turnId)
    if (!e.agentId) blocked = failed = false // (the person, or the conversation, moved on)
    await publish($)
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id) {
      asks.add(e.tool_use_id)
      await publish($, '', e.tool)
    }
    return verdict
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const t = await active($).catch(() => undefined)
    if (e.tool === ASKS) asks.add(e.tool_use_id)
    await publish($, 'tool', e.tool)
    if (t) $.ui.status(statusOf(t, 'tool', e.tool))
    let result
    try {
      result = await next(e)
    } finally {
      asks.delete(e.tool_use_id) // (answered or not, it no longer waits on the person)
    }
    const broke = result.isError === true && !REFUSED.test(result.text ?? '')
    if (!e.agentId && e.tool === WRAP_UP) blocked = (e as unknown as { blocked?: unknown }).blocked === true
    if (!e.agentId && !result.deny) failed = broke
    await publish($, broke ? 'error' : '', e.tool)
    if (t && broke) $.ui.status(statusOf(t, 'error', e.tool))
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    turns.delete(e.turnId)
    if (!e.agentId) {
      asks.clear()
      if (e.reason === 'error') failed = true
    }
    await publish($, e.agentId ? '' : 'done')
    const t = e.agentId ? undefined : await active($).catch(() => undefined)
    if (t) $.ui.status(statusOf(t, 'done'))
    return next(e)
  })
}
