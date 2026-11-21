import { expect, test } from 'claude-code/testing'

import { pool } from '../hooks/register'
import { SESSIONS, begin, close, end, settle, win, world } from './world'

const mood = (state: string, failed = false, at = Date.now()) => JSON.stringify({ state, failed, at })
// a Narsil theme in place, and the other conversations' reports
const sea = ($: any, on: any, others: Record<string, string> = {}) => world($, on, {
  store: { current: 'narsil' },
  files: Object.fromEntries(Object.entries(others).map(([id, text]) => [win(SESSIONS, `${id}.json`), text])),
})
const turn = (turnId: string, agentId?: string) => ({ text: '', turnId, ...(agentId ? { agentId } : {}) })

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
  const { sky } = sea($, on)
  on('tool.call', () => ({ result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  expect(await sky()).toMatchObject({ tide: true, wave: '', state: 'thinking' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await sky()).toMatchObject({ tide: true, wave: '' })
  await end($, 't1')
  expect(await sky()).toMatchObject({ tide: false, wave: '', state: 'idle' })
})

test('a background subagent keeps the tide up after its conversation\'s turn ended', async ($, on) => {
  const { sky } = sea($, on)
  await begin($)
  await $.turn.start(turn('main'))
  await $.turn.start(turn('sub', 'a1'))
  await end($, 'main')
  expect(await sky()).toMatchObject({ tide: true })
  await end($, 'sub', 'answer', 'a1')
  expect(await sky()).toMatchObject({ tide: false })
})

test('a failed tool holds the wave red until a tool works, and until the next message at the latest', async ($, on) => {
  const { sky } = sea($, on)
  let fails = true
  on('tool.call', () => (fails ? { result: {}, isError: true, text: 'boom' } : { result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(await sky()).toMatchObject({ wave: 'error', tide: true })
  await end($, 't1')
  expect(await sky()).toMatchObject({ wave: 'error', tide: false })
  await $.turn.start(turn('t2'))
  expect(await sky()).toMatchObject({ wave: '' })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(await sky()).toMatchObject({ wave: 'error' })
  fails = false
  await $.tool.call({ tool: 'Bash', command: 'true' })
  expect(await sky()).toMatchObject({ wave: '' })
})

test('an API error that ends the turn turns the wave red, a subagent\'s failed tool does not', async ($, on) => {
  const { sky } = sea($, on)
  on('tool.call', () => ({ result: {}, isError: true, text: 'boom' }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'false', agentId: 'a1' })
  expect(await sky()).toMatchObject({ wave: '' })
  await end($, 't1', 'error')
  expect(await sky()).toMatchObject({ wave: 'error' })
})

test('a permission prompt holds the wave yellow and lowers the tide until the person answers', async ($, on) => {
  const { sky, files } = sea($, on)
  let during: any
  on('tool.check', () => ({ decision: 'ask' }))
  // (the scene can't be drawn while the prompt is open, so this reads the conversation's own report)
  on('classic.PermissionRequest', () => {
    during = JSON.parse(files[win(SESSIONS, 'me.json')]!)
    return { decision: { behavior: 'allow' } }
  })
  on('tool.call', () => ({ result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'rm x' })
  expect(during).toMatchObject({ state: 'waiting' })
  expect(await sky()).toMatchObject({ wave: '', tide: true, state: 'thinking' })
})

test('refusing a permission prompt is not an error', async ($, on) => {
  const { sky } = sea($, on)
  on('tool.call', () => ({
    result: {}, isError: true,
    text: "The user doesn't want to proceed with this tool use. The tool use was rejected.",
  }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'Bash', command: 'rm x' })
  expect(await sky()).toMatchObject({ wave: '' })
})

test('AskUserQuestion holds the wave yellow while it is open', async ($, on) => {
  const { sky, files } = sea($, on)
  let during: any
  on('tool.call', () => { during = JSON.parse(files[win(SESSIONS, 'me.json')]!); return { result: {} } })
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] })
  expect(during).toMatchObject({ state: 'waiting' })
  expect(await sky()).toMatchObject({ wave: '' })
})

test('a turn that closes blocked on the person stays yellow until the next message', async ($, on) => {
  const { sky } = sea($, on)
  on('tool.call', () => ({ result: {} }))
  await begin($)
  await $.turn.start(turn('t1'))
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'x', blocked: true })
  await end($, 't1')
  expect(await sky()).toMatchObject({ wave: 'waiting', tide: false })
  await $.turn.start(turn('t2'))
  expect(await sky()).toMatchObject({ wave: '' })
})

test('another conversation\'s state counts, whichever conversation writes last', async ($, on) => {
  const { sky } = sea($, on, { other: mood('waiting') })
  await begin($)
  await $.turn.start(turn('t1'))
  await end($, 't1')
  expect(await sky()).toMatchObject({ wave: 'waiting', state: 'waiting', tide: false })
})

test('a conversation that stopped reporting no longer counts, and its file is removed', async ($, on) => {
  const { sky, runs } = sea($, on, { gone: mood('thinking', true, Date.now() - 60_000) })
  await begin($)
  await $.turn.start(turn('t1'))
  await end($, 't1')
  expect(await sky()).toMatchObject({ wave: '', tide: false })
  expect(runs.flat().join(' ')).toContain('gone.json')
})

test('closing a conversation drops its state at once', async ($, on) => {
  const { files } = sea($, on)
  await begin($)
  await $.turn.start(turn('t1'))
  expect(JSON.parse(files[win(SESSIONS, 'me.json')]!).state).toBe('thinking')
  await close($)
  expect(JSON.parse(files[win(SESSIONS, 'me.json')]!).state).toBe('idle')
})

test('a finished turn flares the sky for a moment', async ($, on) => {
  const { sky, wake } = sea($, on)
  await begin($)
  await $.turn.start(turn('t1'))
  await end($, 't1')
  expect(await sky()).toMatchObject({ flare: true })
  wake()
  await settle()
  expect(await sky()).toMatchObject({ flare: false })
})

test('with Claude\'s own colors nothing reports, so the wave stays calm', async ($, on) => {
  const { sky, files } = world($, on)
  await begin($)
  await $.turn.start(turn('t1'))
  expect(await sky()).toMatchObject({ tide: false })
  expect(Object.keys(files).some(p => p.startsWith(SESSIONS))).toBe(false)
})
