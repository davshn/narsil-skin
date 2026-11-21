import { expect, test } from 'claude-code/testing'

import { isDay } from '../hooks/register'
import { PANE, SLOT, begin, scene, win, world } from './world'

const hourTheme = () => (isDay(new Date().getHours()) ? 'narsil-light' : 'narsil')
const last = (sets: any[]) => sets[sets.length - 1]

test('it is day from 6:00 to 17:59, and night from 18:00 to 5:59', () => {
  expect([0, 5].map(isDay)).toEqual([false, false])
  expect([6, 12, 17].map(isDay)).toEqual([true, true, true])
  expect([18, 23].map(isDay)).toEqual([false, false])
})

test('the auto button keeps auto and paints the theme of the hour, colors and scene', async ($, on) => {
  const { store, sets } = world($, on)
  await begin($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'auto' })
  await ui.unmount()
  expect(store.current).toBe('auto')
  expect(last(sets).backdrop).toMatchObject({ scene: hourTheme(), glass: { opacity: .6 } })
  expect(last(sets).colors).toBeDefined()
})

test('picking a theme by hand turns auto off', async ($, on) => {
  const { store, sets } = world($, on, { store: { current: 'auto' } })
  await begin($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'use-narsil' })
  await ui.unmount()
  expect(store.current).toBe('narsil')
  expect(last(sets).backdrop.scene).toBe('narsil')
})

test('pressing auto again turns it off and keeps the theme of the hour', async ($, on) => {
  const { store, sets } = world($, on, { store: { current: 'auto' } })
  await begin($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'auto' })
  await ui.unmount()
  expect(store.current).toBe(hourTheme())
  expect(last(sets).backdrop.scene).toBe(hourTheme())
})

test('changing the wallpaper speed keeps auto on, is kept, and the scene moves faster', async ($, on) => {
  const { store } = world($, on, { store: { current: 'auto' } })
  await begin($)
  const breath = async () => Number(/animation:breath ([\d.]+)s/.exec(await scene($, hourTheme()))?.[1])
  const before = await breath()
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'speed' })
  await ui.unmount()
  expect(store.current).toBe('auto')
  expect(store.speed).toBe(8)
  expect(Math.round((before / await breath()) * 10) / 10).toBe(2)
})

test('the panels button makes the app\'s panels more opaque over the wallpaper, and is kept', async ($, on) => {
  const { store, sets } = world($, on, { store: { current: 'narsil' } })
  await begin($)
  expect(last(sets).backdrop.glass.opacity).toBe(.6)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'veil' })
  await ui.unmount()
  expect(store.veil).toBe(.8)
  expect(last(sets).backdrop.glass).toMatchObject({ opacity: .8, tint: '#0f1a2c' })
})

test('a session started under auto paints the theme of the hour and still drives the reactions', async ($, on) => {
  const { sets, sky } = world($, on, { store: { current: 'auto' } })
  await begin($)
  expect(last(sets).backdrop.scene).toBe(hourTheme())
  await $.turn.start({ text: '', turnId: 't1' })
  expect(await sky()).toMatchObject({ tide: true })
})

test('the first start after the update takes the old extension\'s choice and speed', async ($, on) => {
  const { store, sets } = world($, on, { files: { [win(SLOT, 'theme.json')]: '{"id":"narsil-light","speed":8}' } })
  await begin($)
  expect(store).toMatchObject({ current: 'narsil-light', speed: 8 })
  expect(last(sets).backdrop.scene).toBe('narsil-light')
})

test('a theme picked in another conversation reaches this one at its next turn, and is set once', async ($, on) => {
  const { store, sets } = world($, on, { store: { current: 'narsil' } })
  await begin($)
  expect(last(sets).backdrop.scene).toBe('narsil')
  store.current = 'narsil-light'
  await $.turn.start({ text: '', turnId: 't1' })
  expect(last(sets).backdrop.scene).toBe('narsil-light')
  const count = sets.length
  await $.turn.start({ text: '', turnId: 't2' })
  expect(sets.length).toBe(count)
})

test('Claude clears the theme this conversation set, and a start on Claude clears nobody\'s', async ($, on) => {
  const { clears } = world($, on)
  await begin($)
  expect(clears.length).toBe(0)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'use-narsil' })
  await ui.press({ key: 'use-claude' })
  await ui.unmount()
  expect(clears.length).toBe(1)
})
