import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeColors, ThemeSetArgs } from 'claude-code'

import type { Mood as State, Theme, Wave } from '../types'
import { colorsOf } from './look'
import { SCENES } from './scenes'
import { THEMES, parseUserTheme, tile } from './themes'

// Themes paint through the mod API: `$.theme.set` with the theme's colors and, for a live wallpaper, a Backdrop
// scene this module draws. Each conversation sets its own at start and follows the choice the others make.

const current = atom({ plugin: 'narsil-skin', key: 'current' } as const, 'claude')
const speed = atom({ plugin: 'narsil-skin', key: 'speed' } as const, 4)
const SPEEDS = [1, 2, 4, 8, 16]
// how opaque the app's panels are over a live wallpaper
const veil = atom({ plugin: 'narsil-skin', key: 'veil' } as const, .6)
const VEILS = [.2, .4, .6, .8]
const sky = atom({ plugin: 'narsil-skin', key: 'sky' } as const,
  { wave: '' as Wave, tide: false, state: 'idle' as State, flare: false })
const legacy = atom({ plugin: 'narsil-skin', key: 'legacy' } as const, false)
// The picker is a side pane (not a strip above the prompt), so it leaves the prompt to other mods
const PANE = 'themes'
const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Themes', focus: true, closeOnEscape: true })

// Paths join with the separator the base path already uses: Windows paths hold a backslash, macOS ones never do
const join = (base: string, ...parts: string[]) => [base, ...parts].join(base.includes('\\') ? '\\' : '/')
const homeOf = async ($: EngineInterface) => (await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || undefined
const MINE = ['.claude', 'narsil-skin']
const mineDir = async ($: EngineInterface) => {
  const home = await homeOf($)
  return home ? join(home, ...MINE) : undefined
}

// ---- The old extension, which Claude Desktop 6.28899 and later no longer loads: found, read once and removed ----

// The React DevTools slot under Claude Desktop's userData, loaded only by older versions with REACT_PROFILE=1.
// userData on Windows: %LOCALAPPDATA%\Claude-Data\claude_<id> on newer installs (the Store app among them), else
// %APPDATA%\Claude; on macOS: ~/Library/Application Support/Claude.
const SLOT = ['extensions', 'fmkadmapgofadopljbjfkapdkoienihi']
const DATA_ROOT = 'Claude-Data'
const MAC_SUPPORT = ['Library', 'Application Support']
// macOS: what set REACT_PROFILE=1 again at each login
const AGENT = 'com.github.0toshigami.themes-for-claude'

type Host = { os: 'windows' | 'macos'; home: string; userData: string }
const hostOf = async ($: EngineInterface): Promise<Host | undefined> => {
  const appData = await $.env.get('APPDATA')
  if (appData) {
    const home = (await $.env.get('USERPROFILE')) ?? ''
    return { os: 'windows', home, userData: (await claudeData($)) ?? join(appData, 'Claude') }
  }
  const home = await $.env.get('HOME')
  const userData = home && join(home, ...MAC_SUPPORT, 'Claude')
  return userData && (await $.fs.exists(userData).catch(() => false)) ? { os: 'macos', home: home!, userData } : undefined
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

const checkLegacy = async ($: EngineInterface) => {
  const dir = await slot($)
  const manifest = dir ? String(await $.fs.read(join(dir, 'manifest.json')).catch(() => '')) : ''
  await update($, legacy, () => manifest.includes('"theme.js"'))
}

// the choice the old extension's theme.json kept, read once when the store holds none
const legacyChoice = async ($: EngineInterface) => {
  const dir = await slot($)
  if (!dir) return {}
  try {
    const saved = JSON.parse(String(await $.fs.read(join(dir, 'theme.json'))))
    return { id: typeof saved.id === 'string' ? saved.id : undefined, speed: saved.speed as unknown }
  } catch {
    return {}
  }
}

type Manifest = { content_scripts?: { js?: string[] }[]; web_accessible_resources?: { resources?: string[] }[] }
// the old extension's web-accessible files, the scenes among them a pattern; with theme.js, the files removed
const OURS = ['theme.json', 'event.json', 'scenes/*.js']
const SESSIONS = 'sessions'
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

const clearProfile = async ($: EngineInterface, h: Host) => {
  if (h.os === 'windows') {
    // (SetEnvironmentVariable, not reg delete: it tells Windows, so apps started later see the change)
    await $.process.run(['powershell', '-NoProfile', '-Command',
      "[Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User')"])
    return
  }
  await $.process.run(['launchctl', 'unsetenv', 'REACT_PROFILE'])
  await $.process.run(['rm', '-f', join(h.home, 'Library', 'LaunchAgents', `${AGENT}.plist`)])
}

const removeLegacy = async ($: EngineInterface) => {
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
  await update($, legacy, () => false)
  $.ui.toast(exitCode === 0 ? 'Old extension removed.' : `Could not remove every file. Delete them by hand in ${dir}`)
}

// ---- The person's own themes ----

let mine: Theme[] = []
const loadMine = async ($: EngineInterface) => {
  const dir = await mineDir($)
  if (!dir || !(await $.fs.exists(dir).catch(() => false))) return void (mine = [])
  const files = await $.fs.list(dir)
  const has = (name: string) => files.find(f => f.kind === 'file' && f.name === name)
  const found: Theme[] = []
  for (const f of files) {
    if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
    const id = f.name.slice(0, -5)
    const svg = has(`${id}.svg`) ? String(await $.fs.read(join(dir, `${id}.svg`))) : undefined
    const t = parseUserTheme(String(await $.fs.read(join(dir, f.name))), svg)
    if (!t || t.id !== id || THEMES.some(b => b.id === t.id)) continue
    const jpg = has(`${id}.jpg`)
    // (a missing, large or broken picture leaves the tile drawn from the theme's colors)
    const pic = t.wallpaper && jpg && jpg.size < 16000
      ? (await $.fs.read(join(dir, `${id}.jpg`), { as: 'bytes' }).catch(() => undefined))?.base64 : undefined
    if (pic?.startsWith('/9j/')) t.thumb = `data:image/jpeg;base64,${pic}`
    found.push(t)
  }
  mine = found
}
const allThemes = () => [...THEMES, ...mine]

// ---- The theme of this conversation ----

// The automatic option: Narsil Light by day and Narsil by night, by this computer's clock
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

const colorsCache = new Map<string, ThemeColors>()
const colorsFor = (t: Theme) => {
  let c = colorsCache.get(t.id)
  if (!c) colorsCache.set(t.id, c = colorsOf(t.name, t.palette!).theme)
  return c
}
export const lookOf = (t: Theme, glass: number): ThemeSetArgs => ({
  colors: colorsFor(t),
  ...(t.wallpaper ? { backdrop: { scene: t.wallpaper, glass: { blur: 12, tint: t.palette!.surfaces[0], opacity: glass } } } : {}),
})

// what this conversation last set: undefined at start, so a Claude choice never clears another mod's theme
let drawn: string | undefined
const apply = async ($: EngineInterface, force = false) => {
  const t = await active($)
  const glass = await read($, veil)
  const key = t ? `${t.id}@${glass}` : ''
  if (!force && key === (drawn ?? '')) return
  if (!t) {
    if (drawn) await $.theme.clear()
    drawn = ''
    return
  }
  await $.theme.set(lookOf(t, glass))
  drawn = key
}

const statusOf = (t: Theme | undefined, kind: 'idle' | 'tool' | 'error' | 'done', tool = '') =>
  t?.status?.[kind].split('{tool}').join(tool)

const choose = async ($: EngineInterface, id: string, label: string) => {
  await update($, current, () => id)
  await $.store.set('current', id)
  await apply($, true)
  $.ui.status(statusOf(await active($), 'idle'))
  $.ui.toast(`Theme: ${label}`)
}
const pick = ($: EngineInterface, t: Theme) => choose($, t.id, t.name)
const pickAuto = ($: EngineInterface) => choose($, AUTO, 'Narsil Light by day, Narsil by night')

const next = <T,>(list: T[]) => (v: T) => list[(list.indexOf(v) + 1) % list.length]!
const nextSpeed = async ($: EngineInterface) => {
  const v = await update($, speed, next(SPEEDS))
  await $.store.set('speed', v)
}
const nextVeil = async ($: EngineInterface) => {
  const v = await update($, veil, next(VEILS))
  await $.store.set('veil', v)
  await apply($)
}

// the choice another conversation made: picked up at each beat
const follow = async ($: EngineInterface) => {
  const [id, pace, glass] = await Promise.all(['current', 'speed', 'veil'].map(k => $.store.get(k)))
  if (typeof id === 'string' && (id === AUTO || id === 'claude' || allThemes().some(t => t.id === id)))
    await update($, current, was => (was === id ? was : id))
  if (SPEEDS.includes(pace as number)) await update($, speed, was => (was === pace ? was : pace as number))
  if (VEILS.includes(glass as number)) await update($, veil, was => (was === glass ? was : glass as number))
  await apply($)
}

// ---- What every conversation is doing, pooled into the wave ----

type Mood = { state: State; failed: boolean }
// Every conversation reports to .state/sessions/<id>.json and pools all of them. BEAT refreshes the report; one older
// than LIVE is a conversation that closed or died
const STATE = ['.state', 'sessions']
const BEAT = 10_000
const LIVE = 30_000

// All the conversations together. Yellow beats red: it blocks work and ends when answered, while a red can linger
export const pool = (moods: Mood[]) => {
  const waiting = moods.some(m => m.state === 'waiting')
  const tide = moods.some(m => m.state === 'thinking')
  return {
    state: (waiting ? 'waiting' : tide ? 'thinking' : 'idle') as State,
    wave: (waiting ? 'waiting' : moods.some(m => m.failed) ? 'error' : '') as Wave,
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

// one at a time, so this conversation's own reports stay in order
let queue: Promise<void> = Promise.resolve()
const publish = ($: EngineInterface) => {
  queue = queue.then(async () => {
    const dir = await mineDir($)
    if (!dir || !(await active($))) return
    const folder = join(dir, ...STATE), at = Date.now(), own = `${await $.session.id()}.json`
    await $.fs.write(join(folder, own), JSON.stringify({ state: stateNow(), failed, at }))
    const moods: Mood[] = [], gone: string[] = []
    for (const f of await $.fs.list(folder)) {
      if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
      const m = await readMood($, join(folder, f.name))
      if (m && at - m.at < LIVE) moods.push(m)
      else if (m) gone.push(join(folder, f.name))
    }
    if (gone.length) {
      const windows = folder.includes('\\')
      await $.process.run(windows ? ['cmd', '/c', 'del', '/q', ...gone] : ['rm', '-f', '--', ...gone]).catch(() => {})
    }
    const now = pool(moods)
    await update($, sky, s => (s.wave === now.wave && s.tide === now.tide && s.state === now.state ? s : { ...s, ...now }))
  }).catch(() => {})
  return queue
}

// the stars, or the sun, flare for a moment when a turn ends
const flare = async ($: EngineInterface) => {
  await update($, sky, s => ({ ...s, flare: true }))
  void $.clock.sleep(1300).then(() => update($, sky, s => ({ ...s, flare: false }))).catch(() => {})
}

// every BEAT: this conversation's report, the pooled wave, and the choice another conversation made
const beat = ($: EngineInterface) => publish($).then(() => follow($))

// ---- Commands and the pane ----

const HELP = [
  'Narsil Skin commands:',
  '  /narsil-skin themes   open the theme pane',
  '  /narsil-skin:make-theme   make your own theme from an idea or a picture',
].join('\n')

// /narsil-skin themes: refresh what the pane shows, then open it
const showThemes = async ($: EngineInterface) => {
  await checkLegacy($).catch(() => {})
  await loadMine($).catch(() => {})
  const opened = await openPane($)
  return opened.isPlaced ? 'Themes opened in the side pane.' : `Themes pane not shown: ${opened.reason}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // (one command for the mod, so it does not take a name other plugins may want)
    await $.command.register({ name: 'narsil-skin', description: 'Narsil Skin: themes (open the theme pane), help' })
    try {
      await loadMine($).catch(() => {})
      await checkLegacy($).catch(() => {})
      if ((await $.store.get('current')) === undefined) {
        const old = await legacyChoice($)
        if (old.id) await $.store.set('current', old.id)
        if (SPEEDS.includes(old.speed as number)) await $.store.set('speed', old.speed)
      }
      await follow($)
      $.ui.status(statusOf(await active($), 'idle'))
      $.clock.every(BEAT, () => void beat($).catch(() => {}))
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

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== 'narsil-skin' || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    const els = $.ui.resolve(e)
    const draw = SCENES[e.props.scene], own = mine.find(t => t.wallpaper === e.props.scene)
    if (!('Svg' in els) || (!draw && !own?.scene)) return next(e)
    const { Svg } = els
    const source = own?.scene ?? draw!({ ...(await read($, sky)), speed: await read($, speed), now: Date.now() })
    return <Svg source={source} alt={own ? own.tagline || own.name : 'A sea, its wave showing what Claude is doing'} isInteractive />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = 'Svg' in els ? els.Svg : undefined
    const now = await read($, current)
    const old = await read($, legacy)
    const pace = await read($, speed)
    const glass = await read($, veil)
    const worn = now === AUTO ? ofTheHour() : allThemes().find(t => t.id === now) ?? THEMES[0]!
    const row = (title: string, themes: Theme[]) => (
      <Box key={`row-${title}`} flexDirection="column" gap="xs">
        <Text dimColor>{title}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {themes.map(t => (
            <Box key={`tile-${t.id}`} flexDirection="column" alignItems="center" gap="xs">
              {Svg ? <Svg source={tile(t, t.id === now)} alt={`Preview of ${t.name}`} width={120} /> : null}
              <Button key={`use-${t.id}`} label={t.id === now ? `✓ ${t.name}` : t.name} dimColor={t.id !== now}
                onPress={() => pick($, t)} />
            </Box>
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
          <Button key="close" role="dismiss" label="Close" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
        {old ? (
          <Box key="legacy" flexDirection="column" gap="xs" padding={1} borderStyle="round" borderColor="warning">
            <Text color="warning" weight="semibold">The old extension is still installed</Text>
            <Text>Claude Desktop no longer loads it: the themes now paint without it. You can remove it.</Text>
            <Box flexDirection="row">
              <Button key="remove" label="Remove old extension" onPress={() => removeLegacy($)} />
            </Box>
          </Box>
        ) : null}
        {worn.wallpaper ? (
          <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Text dimColor>Wallpaper:</Text>
            <Text dimColor>speed</Text>
            <Button key="speed" label={`${pace}×`} onPress={() => nextSpeed($)} />
            <Text dimColor>panels</Text>
            <Button key="veil" label={`${Math.round(glass * 100)}%`} onPress={() => nextVeil($)} />
          </Box>
        ) : null}
        <Box key="auto-row" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
          <Button key="auto" label={now === AUTO ? '✓ Auto day and night' : 'Auto day and night'} dimColor={now !== AUTO}
            onPress={() => (now === AUTO ? pick($, ofTheHour()) : pickAuto($))} />
          <Text dimColor>Narsil Light from 6:00 to 17:59, Narsil from 18:00 to 5:59</Text>
        </Box>
        {row('Live wallpapers', THEMES.filter(t => t.wallpaper))}
        {row('Color themes', THEMES.filter(t => !t.wallpaper))}
        {mine.length ? row('Your themes', mine) : null}
      </Box>
    )
  })

  on('turn.start', async ($, e, next) => {
    turns.add(e.turnId)
    if (!e.agentId) blocked = failed = false // (the person, or the conversation, moved on)
    if (!e.agentId) await follow($).catch(() => {}) // (a theme picked elsewhere shows before the beat brings it)
    await publish($)
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id) {
      asks.add(e.tool_use_id)
      await publish($)
    }
    return verdict
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const t = await active($).catch(() => undefined)
    if (e.tool === ASKS) asks.add(e.tool_use_id)
    await publish($)
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
    await publish($)
    if (t && broke) $.ui.status(statusOf(t, 'error', e.tool))
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    turns.delete(e.turnId)
    if (!e.agentId) {
      asks.clear()
      if (e.reason === 'error') failed = true
    }
    await publish($)
    const t = e.agentId ? undefined : await active($).catch(() => undefined)
    if (t) {
      await flare($)
      $.ui.status(statusOf(t, 'done'))
    }
    return next(e)
  })
}
