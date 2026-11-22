import { expect, test } from 'claude-code/testing'

import { HEADS } from '../hooks/heads'
import { PERIOD, TILT, head } from '../hooks/spinner'
import { begin, world } from './world'

const spinner = (surface = 'desktop', mode = 'thinking') => ({
  plugin: 'narsil-skin',
  surface,
  component: 'Spinner',
  requestId: 'main',
  props: { word: 'Working', message: null, suffix: '…', mode },
}) as const

// stands for the engine drawing a row the mod leaves to it
const ENGINE = {
  'ui.render': ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  },
}

// what the thinking row draws: its picture, if any, and its words
const draw = async ($: any, surface = 'desktop') => {
  const ui = await $.ui.mount(spinner(surface))
  const svg: any = await ui.find({ type: 'Svg' })
  const text: any = await ui.find({ type: 'Text' })
  await ui.unmount()
  return { source: String(svg?.props?.source ?? ''), words: JSON.stringify(text?.props?.children ?? text?.children ?? '') }
}

for (const current of ['narsil', 'narsil-light', 'auto'])
  test(`under ${current} the thinking row shows Narsil's head, light and dark, and keeps its words`, async ($, on) => {
    world($, on, { store: { current } })
    await begin($)
    const { source, words } = await draw($)
    expect(source).toContain(HEADS.light)
    expect(source).toContain(HEADS.dark)
    expect(source).toContain('prefers-color-scheme: dark')
    expect(words).toContain('Working')
  })

test('the head tilts up to 30 degrees to either side over 4 seconds, with no keySplines', () => {
  const source = head(0)
  const values = source.match(/type="rotate" values="([^"]+)"/)![1]!.split(';').map(v => Number(v.split(' ')[0]))
  expect(Math.max(...values)).toBe(TILT)
  expect(Math.min(...values)).toBe(-TILT)
  expect(TILT).toBe(30)
  expect(source).toContain(`dur="${PERIOD}s"`)
  expect(PERIOD).toBe(4)
  expect(source).not.toContain('keySplines')
})

test('a redraw carries the swing on where the clock has it', () => {
  expect(head(0)).toContain('begin="-0.00s"')
  expect(head(1500)).toContain('begin="-1.50s"')
  expect(head(PERIOD * 1000 + 250)).toContain('begin="-0.25s"')
})

test("Claude's own colors keep the app's thinking row", async ($, on) => {
  world($, on, { store: { current: 'claude' }, hooks: ENGINE })
  await begin($)
  const { source, words } = await draw($)
  expect(source).toBe('')
  expect(words).toContain('engine')
})

test("the terminal keeps its own thinking line under Narsil's themes", async ($, on) => {
  world($, on, { store: { current: 'narsil' }, hooks: ENGINE })
  await begin($)
  const { source, words } = await draw($, 'terminal')
  expect(source).toBe('')
  expect(words).toContain('engine')
})
