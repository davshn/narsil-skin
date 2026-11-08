import { expect, test } from 'claude-code/testing'

import { pool } from '../hooks/register'

const SLOT = 'C:\\AppData\\Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi'
const EVENT = `${SLOT}\\event.json`
const SESSIONS = `${SLOT}\\sessions`
const mood = (state: string, failed = false, at = Date.now()) => JSON.stringify({ state, failed, at })

// The engine beneath the mod: a Narsil theme in place and the slot's files in memory
const world = ($: any, on: any, others: Record<string, string> = {}) => {
  const files: Record<string, string> = { [`${SLOT}\\theme.json`]: '{"id":"narsil"}' }
  for (const [id, text] of Object.entries(others)) files[`${SESSIONS}\\${id}.json`] = text
  on('command.register', () => ({ value: { command: 'narsil-skin' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('env.get', (_: any, e: any) => ({ value: e.name === 'APPDATA' ? 'C:\\AppData' : undefined }))
  on('session.id', () => ({ value: 'me' }))
  on('fs.read', (_: any, e: any) => {
    if (e.path in files) return { value: files[e.path] }
    throw new Error('ENOENT')
  })
  on('fs.write', (_: any, e: any) => { files[e.path] = e.text; return { value: undefined } })
  on('fs.list', (_: any, e: any) => ({
    value: Object.keys(files).filter(p => p.startsWith(`${e.path}\\`))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: files[p]!.length, mtimeMs: 0 })),
  }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId, text: e.text }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', () => ({ sessionId: 'me' }))
  return { files, event: () => JSON.parse(files[EVENT]!) }
}
const begin = ($: any) => $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
const turn = (turnId: string, agentId?: string) => ({ text: '', turnId, ...(agentId ? { agentId } : {}) })
const end = (turnId: string, reason = 'answer', agentId?: string) =>
  ({ answer: '', durationMs: 1, isAborted: false, turnId, reason, ...(agentId ? { agentId } : {}) })

test('the wave is yellow while any conversation needs an answer, else red on an error, and the tide rises while any works', () => {
  const idle = { state: 'idle' as const, failed: false }, busy = { state: 'thinking' as const, failed: false }
  const asking = { state: 'waiting' as const, failed: false }, broken = { state: 'idle' as const, failed: true }
  expect(pool([])).toEqual({ state: 'idle', wave: '', tide: false })
  expect(pool([idle, idle])).toEqual({ state: 'idle', wave: '', tide: false })
  expect(pool([idle, busy])).toEqual({ state: 'thinking', wave: '', tide: true })
  expect(pool([busy, asking])).toEqual({ state: 'waiting', wave: 'waiting', tide: true })
  expect(pool([idle, broken])).toEqual({ state: 'idle', wave: 'error', tide: false })
  expect(pool([broken, busy])).toEqual({ state: 'thinking', wave: 'error', tide: true })
  expect(pool([broken, asking])).toEqual({ state: 'waiting', wave: 'waiting', tide: false })
})

test('the tide stays up for the whole turn, tools or not, and falls when it ends', async ($, on) => {
  const { event } = world($, on)
  on('tool.call', () => ({ result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  expect(event()).toMatchObject({ tide: true, wave: '', state: 'thinking' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(event()).toMatchObject({ tide: true, wave: '' })
  await $.turn.complete(end('t1'))
  expect(event()).toMatchObject({ tide: false, wave: '', state: 'idle' })
})

test('a background subagent keeps the tide up after its conversation\'s turn ended', async ($, on) => {
  const { event } = world($, on)
  await begin($)
  await $.turn.start(turn('main'))
  await $.turn.start(turn('sub', 'a1'))
  await $.turn.complete(end('main'))
  expect(event()).toMatchObject({ tide: true })
  await $.turn.complete(end('sub', 'answer', 'a1'))
  expect(event()).toMatchObject({ tide: false })
})

test('a failed tool holds the wave red until a tool works, and until the next message at the latest', async ($, on) => {
  const { event } = world($, on)
  let fails = true
  on('tool.call', () => (fails ? { result: {}, isError: true, text: 'boom' } : { result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(event()).toMatchObject({ kind: 'error', wave: 'error', tide: true })
  await $.turn.complete(end('t1'))
  expect(event()).toMatchObject({ wave: 'error', tide: false })
  await $.turn.start(turn('t2'))
  expect(event()).toMatchObject({ wave: '' })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(event()).toMatchObject({ wave: 'error' })
  fails = false
  await $.tool.call({ tool: 'Bash', command: 'true' })
  expect(event()).toMatchObject({ wave: '' })
})

test('an API error that ends the turn turns the wave red, a subagent\'s failed tool does not', async ($, on) => {
  const { event } = world($, on)
  on('tool.call', () => ({ result: {}, isError: true, text: 'boom' }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'false', agentId: 'a1' })
  expect(event()).toMatchObject({ wave: '' })
  await $.turn.complete(end('t1', 'error'))
  expect(event()).toMatchObject({ wave: 'error' })
})

test('a permission prompt holds the wave yellow and lowers the tide until the person answers', async ($, on) => {
  const { event } = world($, on)
  let during: any
  on('tool.check', () => ({ decision: 'ask' }))
  on('classic.PermissionRequest', () => {
    during = event()
    return { decision: { behavior: 'allow' } }
  })
  on('tool.call', () => ({ result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'rm x' })
  expect(during).toMatchObject({ wave: 'waiting', tide: false, state: 'waiting' })
  expect(event()).toMatchObject({ wave: '', tide: true, state: 'thinking' })
})

test('refusing a permission prompt is not an error', async ($, on) => {
  const { event } = world($, on)
  on('tool.call', () => ({
    result: {}, isError: true,
    text: "The user doesn't want to proceed with this tool use. The tool use was rejected.",
  }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'rm x' })
  expect(event()).toMatchObject({ wave: '' })
})

test('AskUserQuestion holds the wave yellow while it is open', async ($, on) => {
  const { event } = world($, on)
  let during: any
  on('tool.call', () => { during = event(); return { result: {} } })
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] })
  expect(during).toMatchObject({ wave: 'waiting' })
  expect(event()).toMatchObject({ wave: '' })
})

test('a turn that closes blocked on the person stays yellow until the next message', async ($, on) => {
  const { event } = world($, on)
  on('tool.call', () => ({ result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'x', blocked: true })
  await $.turn.complete(end('t1'))
  expect(event()).toMatchObject({ wave: 'waiting', tide: false })
  await $.turn.start(turn('t2'))
  expect(event()).toMatchObject({ wave: '' })
})

test('another conversation\'s state counts, whichever conversation writes last', async ($, on) => {
  const { event } = world($, on, { other: mood('waiting') })
  await begin($)
  await $.turn.start(turn('t1'))
  await $.turn.complete(end('t1'))
  expect(event()).toMatchObject({ wave: 'waiting', state: 'waiting', tide: false })
})

test('a conversation that stopped reporting no longer counts, and its file is removed', async ($, on) => {
  const { event } = world($, on, { gone: mood('thinking', true, Date.now() - 60_000) })
  const ran: string[][] = []
  on('process.run', (_: any, e: any) => { ran.push(e.command ?? e.argv ?? e.args); return { value: { exitCode: 0, stdout: '', stderr: '' } } })
  await begin($)
  await $.turn.start(turn('t1'))
  await $.turn.complete(end('t1'))
  expect(event()).toMatchObject({ wave: '', tide: false })
  expect(ran.flat().join(' ')).toContain('gone.json')
})

test('closing a conversation drops its state at once', async ($, on) => {
  const { files } = world($, on)
  await begin($)
  await $.turn.start(turn('t1'))
  expect(JSON.parse(files[`${SESSIONS}\\me.json`]!).state).toBe('thinking')
  await $.session.end({ reason: 'other' })
  expect(JSON.parse(files[`${SESSIONS}\\me.json`]!).state).toBe('idle')
})
