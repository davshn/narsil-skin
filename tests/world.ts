// The engine beneath the mod, for the tests: a disk, the mod's store, the theme it sets and the clock, all in memory.
// Windows paths are built with the separator by code, so no file here holds a backslash to escape.
export const win = (...parts: string[]) => parts.join(String.fromCharCode(92))

export const HOME = win('C:', 'Users', 'me')
export const MINE = win(HOME, '.claude', 'narsil-skin')
export const SESSIONS = win(MINE, '.state', 'sessions')
export const APPDATA = win(HOME, 'AppData', 'Roaming')
export const SLOT = win(APPDATA, 'Claude', 'extensions', 'fmkadmapgofadopljbjfkapdkoienihi')

// hooks: stand-ins for the engine that replace the world's own, by event name (the engine takes one hook per event)
type Options = { store?: Record<string, unknown>; files?: Record<string, string>; env?: Record<string, string>; hooks?: Record<string, any> }

export const world = ($: any, real: any, options: Options = {}) => {
  const defs: Record<string, any> = {}
  const on = (name: string, fn: any) => { defs[name] = fn }
  const files: Record<string, string> = { ...options.files }
  const store: Record<string, unknown> = { ...options.store }
  const env: Record<string, string> = { USERPROFILE: HOME, APPDATA, ...options.env }
  const sets: any[] = [], clears: number[] = [], runs: string[][] = []
  const toasts: string[] = []
  let wake: (() => void) | undefined
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'me' }))
  on('env.get', (_: any, e: any) => ({ value: env[e.name] }))
  on('store.get', (_: any, e: any) => ({ value: store[e.key] }))
  on('store.set', (_: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('theme.set', (_: any, e: any) => { sets.push(e); return { value: { isDrawn: true, requestId: 'look' } } })
  on('theme.clear', () => { clears.push(1); return { value: { isDrawn: false, reason: 'cleared' } } })
  on('fs.exists', (_: any, e: any) => ({ value: e.path in files || Object.keys(files).some(p => p.startsWith(`${e.path}${String.fromCharCode(92)}`)) }))
  on('fs.read', (_: any, e: any) => {
    if (e.path in files) return { value: files[e.path] }
    throw new Error('ENOENT')
  })
  on('fs.write', (_: any, e: any) => { files[e.path] = e.text; return { value: undefined } })
  on('fs.list', (_: any, e: any) => ({
    value: Object.keys(files).filter(p => p.startsWith(`${e.path}${String.fromCharCode(92)}`) && !p.slice(e.path.length + 1).includes(String.fromCharCode(92)))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: files[p]!.length, mtimeMs: 0 })),
  }))
  on('process.run', (_: any, e: any) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => { toasts.push(e.text ?? String(e)); return { value: undefined } })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.sleep', async () => { await new Promise<void>(r => { wake = r }); return { value: undefined } })
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId, text: e.text }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', () => ({ sessionId: 'me' }))
  for (const [name, fn] of Object.entries({ ...defs, ...options.hooks })) real(name, fn)
  // what the Narsil scene draws now, read back from its SVG
  const sky = async () => {
    const source = await scene($, 'narsil')
    return {
      wave: source.includes('fill="#ffc94d"') ? 'waiting' : source.includes('fill="#ff5a6e"') ? 'error' : '',
      tide: source.includes('translate(0 -60)'),
      state: source.includes('class="shoot"') ? 'thinking' : source.includes('class="rim"') ? 'waiting' : 'idle',
      flare: source.includes('animation:flare'),
    }
  }
  return { files, store, env, sets, clears, runs, toasts, sky, wake: () => wake?.() }
}

// the SVG the Backdrop hook draws for a scene, or '' when it leaves it to the engine
export const scene = async ($: any, name: string, surface = 'desktop') => {
  const ui = await $.ui.mount(backdrop(name, surface))
  const node: any = await ui.find({ type: 'Svg' })
  await ui.unmount()
  return String(node?.props?.source ?? node?.source ?? '')
}

// /narsil-skin with its arguments, as the person types it
export const run = ($: any, args: string): Promise<{ text: string }> => $.command.run({ command: 'narsil-skin', args })
// a turn that ends, and a conversation that closes
export const end = ($: any, turnId: string, reason: 'answer' | 'error' = 'answer', agentId?: string) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId, reason, ...(agentId ? { agentId } : {}) })
export const close = ($: any) => $.session.end({ reason: 'other' })
// lets what a resolved promise started run to its end
export const settle = async () => { for (let i = 0; i < 50; i++) await Promise.resolve() }

export const begin = ($: any) => $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

export const PANE = {
  plugin: 'narsil-skin',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'themes',
  props: { title: 'Themes', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

export const backdrop = (scene: string, surface = 'desktop') => ({
  plugin: 'narsil-skin',
  surface,
  component: 'Backdrop',
  requestId: 'look',
  props: { scene, plugin: 'narsil-skin', glass: { blur: 12, opacity: .6 } },
}) as const
