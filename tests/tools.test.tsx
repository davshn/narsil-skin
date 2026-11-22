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
