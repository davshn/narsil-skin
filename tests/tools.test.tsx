import { expect, test } from 'claude-code/testing'

import { TOOL_FACES } from '../hooks/heads'
import { TOOL_PX, toolFace } from '../hooks/tools'
import { begin, world } from './world'

const row = (surface: string, state: { isRunning?: boolean; isErrored?: boolean; isInterrupted?: boolean } = {}) => ({
  plugin: 'narsil-skin',
  surface,
  component: 'ToolUse',
  requestId: 'toolu_1',
  props: {
    tool_use_id: 'toolu_1',
    tool: 'Bash',
    input: { command: 'npm test' },
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
    ...state,
  },
}) as const

// stands for the engine drawing the tool call's row itself: its own node, which a tree must keep
const ENGINE = {
  'ui.render': () => ({ type: 'engine', ref: 0 }),
}

// what the row draws: its picture, if any, and how many times the engine's own row is in it
const draw = async ($: any, surface: string, state = {}) => {
  const ui = await $.ui.mount(row(surface, state))
  const svg: any = await ui.find({ type: 'Svg' })
  const rows = (JSON.stringify(await ui.drawn()).match(/"type":"engine"/g) ?? []).length
  await ui.unmount()
  return { source: String(svg?.props?.source ?? ''), width: svg?.props?.width, rows }
}

const STATES = [
  ['working', 'while it runs', { isRunning: true }],
  ['done', 'once it has run', {}],
  ['failed', 'when it fails', { isErrored: true }],
  ['stopped', 'when it is interrupted', { isInterrupted: true, isErrored: true }],
] as const

for (const current of ['narsil', 'narsil-light'])
  for (const [face, when, state] of STATES)
    test(`under ${current} a tool row shows Narsil's ${face} face ${when}, light and dark, and keeps the row`, async ($, on) => {
      world($, on, { store: { current }, hooks: ENGINE })
      await begin($)
      const { source, width, rows } = await draw($, 'desktop', state)
      expect(source).toContain(TOOL_FACES[face].light)
      expect(source).toContain(TOOL_FACES[face].dark)
      expect(source).toContain('prefers-color-scheme: dark')
      for (const other of Object.keys(TOOL_FACES).filter(k => k !== face))
        expect(source).not.toContain(TOOL_FACES[other as keyof typeof TOOL_FACES].dark)
      expect(width).toBe(TOOL_PX)
      expect(rows).toBe(1)
    })

test('only the working face moves', () => {
  expect(toolFace('working')).toContain('animateTransform')
  for (const face of ['done', 'failed', 'stopped'] as const) expect(toolFace(face)).not.toContain('animateTransform')
  expect(toolFace('working')).not.toContain('keySplines')
})

test("Claude's own colors keep the app's tool row alone", async ($, on) => {
  world($, on, { store: { current: 'claude' }, hooks: ENGINE })
  await begin($)
  const { source, rows } = await draw($, 'desktop', { isRunning: true })
  expect(source).toBe('')
  expect(rows).toBe(1)
})

test("the terminal keeps its own tool row under Narsil's themes", async ($, on) => {
  world($, on, { store: { current: 'narsil' }, hooks: ENGINE })
  await begin($)
  const { source, rows } = await draw($, 'terminal', { isRunning: true })
  expect(source).toBe('')
  expect(rows).toBe(1)
})

const group = (surface: string, calls: Array<{ isRunning?: boolean; isErrored?: boolean; isInterrupted?: boolean }>, isExpanded = false) => ({
  plugin: 'narsil-skin',
  surface,
  component: 'ToolGroup',
  requestId: 'group_1',
  props: {
    calls: calls.map((c, i) => ({
      tool_use_id: `toolu_${i}`, tool: 'Read', input: { file_path: `/f${i}` },
      isRunning: false, isErrored: false, isInterrupted: false, ...c,
    })),
    isActive: calls.some(c => c.isRunning),
    isExpanded,
  },
}) as const

const drawGroup = async ($: any, surface: string, calls: any[], isExpanded = false) => {
  const ui = await $.ui.mount(group(surface, calls, isExpanded))
  const svg: any = await ui.find({ type: 'Svg' })
  const lines = (JSON.stringify(await ui.drawn()).match(/"type":"engine"/g) ?? []).length
  await ui.unmount()
  return { source: String(svg?.props?.source ?? ''), lines }
}

const GROUPS = [
  ['working', 'while any of its calls runs', [{}, { isRunning: true }, { isErrored: true }]],
  ['stopped', 'when one was interrupted', [{}, { isInterrupted: true, isErrored: true }, { isErrored: true }]],
  ['failed', 'when one failed', [{}, { isErrored: true }]],
  ['done', 'once all ran well', [{}, {}, {}]],
] as const

for (const [face, when, calls] of GROUPS)
  test(`under narsil a folded group shows Narsil's ${face} face ${when}, and keeps its line`, async ($, on) => {
    world($, on, { store: { current: 'narsil' }, hooks: ENGINE })
    await begin($)
    const { source, lines } = await drawGroup($, 'desktop', [...calls])
    expect(source).toContain(TOOL_FACES[face].light)
    expect(source).toContain(TOOL_FACES[face].dark)
    expect(lines).toBe(1)
  })

test('an unfolded group adds no face of its own: each of its rows has one', async ($, on) => {
  world($, on, { store: { current: 'narsil' }, hooks: ENGINE })
  await begin($)
  const { source, lines } = await drawGroup($, 'desktop', [{}, {}], true)
  expect(source).toBe('')
  expect(lines).toBe(1)
})

test("Claude's own colors and the terminal keep the app's group line", async ($, on) => {
  world($, on, { store: { current: 'claude' }, hooks: ENGINE })
  await begin($)
  expect((await drawGroup($, 'desktop', [{ isRunning: true }])).source).toBe('')
  expect((await drawGroup($, 'terminal', [{ isRunning: true }])).source).toBe('')
})
