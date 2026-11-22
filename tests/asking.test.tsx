import { expect, test } from 'claude-code/testing'

import { ASKING, ASK_SIZE } from '../hooks/heads'
import { ASK_PX, BAND, SVG_LIMIT, SWAY, WAVE_PERIOD, asking } from '../hooks/asking'
import { begin, world } from './world'

const card = (surface = 'desktop') => ({
  plugin: 'narsil-skin',
  surface,
  component: 'AskUserQuestion',
  requestId: 'main',
  props: {
    tool: 'AskUserQuestion',
    questions: [{ question: 'Which one?', header: 'Pick', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
  },
}) as const

// stands for the engine drawing the question card itself: its own node, which a tree must hold once
const ENGINE = {
  'ui.render': () => ({ type: 'engine', ref: 0 }),
}

// what the card draws: its picture, if any, and how many times the engine's own card is in it
const draw = async ($: any, surface = 'desktop') => {
  const ui = await $.ui.mount(card(surface))
  const svg: any = await ui.find({ type: 'Svg' })
  const words: any = await ui.find({ type: 'Text', text: /pregunta/ })
  const cards = (JSON.stringify(await ui.drawn()).match(/"type":"engine"/g) ?? []).length
  await ui.unmount()
  return { source: String(svg?.props?.source ?? ''), cards, words: words?.text ?? '' }
}

for (const current of ['narsil', 'narsil-light', 'auto'])
  test(`under ${current} the question card shows Narsil asking, light and dark, above the card`, async ($, on) => {
    world($, on, { store: { current }, hooks: ENGINE })
    await begin($)
    const { source, cards, words } = await draw($)
    expect(source).toContain(ASKING.light)
    expect(source).toContain(ASKING.dark)
    expect(source).toContain('prefers-color-scheme: dark')
    expect(words).toBe('Narsil tiene una pregunta para ti')
    expect(cards).toBe(1)
  })

test('she is drawn one grid cell to a pixel, within the length the app draws', () => {
  const source = asking()
  expect(source).toContain(`width="${ASK_PX}" height="${ASK_PX}"`)
  expect(ASK_SIZE).toBe(80)
  expect(source.length).toBeLessThan(SVG_LIMIT)
})

test('a wave runs down her, band by band, with no keySplines and only links inside the picture', () => {
  const source = asking()
  const sways = [...source.matchAll(/type="translate" values="([^"]+)"/g)]
  expect(sways).toHaveLength(2 * Math.ceil(ASK_SIZE / BAND))
  const xs = sways[0]![1]!.split(';').map(v => Number(v.split(' ')[0]))
  expect(Math.max(...xs)).toBe(SWAY)
  expect(Math.min(...xs)).toBe(-SWAY)
  const begins = [...source.matchAll(/begin="(-?[\d.]+)s"/g)].map(m => Number(m[1]))
  expect(begins[1]!).toBeLessThan(begins[0]!)
  expect(source).toContain(`dur="${WAVE_PERIOD}s"`)
  expect(source).not.toContain('keySplines')
  for (const m of source.matchAll(/(?:href="|url\()([^")]+)/g)) expect(m[1]!.startsWith('#')).toBe(true)
})

test("Claude's own colors keep the app's question card alone", async ($, on) => {
  world($, on, { store: { current: 'claude' }, hooks: ENGINE })
  await begin($)
  const { source, cards } = await draw($)
  expect(source).toBe('')
  expect(cards).toBe(1)
})

test("the terminal keeps its own question card under Narsil's themes", async ($, on) => {
  world($, on, { store: { current: 'narsil' }, hooks: ENGINE })
  await begin($)
  const { source, cards } = await draw($, 'terminal')
  expect(source).toBe('')
  expect(cards).toBe(1)
})
