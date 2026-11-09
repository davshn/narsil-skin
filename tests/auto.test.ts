import { expect, test } from 'claude-code/testing'

import { isDay } from '../hooks/register'

const SLOT = 'C:\\AppData\\Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi'
const THEME = `${SLOT}\\theme.json`
const PANE = {
  plugin: 'narsil-skin',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'themes',
  props: { title: 'Themes', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// The engine beneath the mod, with the extension installed and the slot's files in memory
const world = (on: any, saved = '{"id":"narsil"}') => {
  const files: Record<string, string> = { [THEME]: saved, [`${SLOT}\\manifest.json`]: '{"content_scripts":[{"js":["theme.js"]}]}' }
  on('command.register', () => ({ value: { command: 'narsil-skin' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId, text: e.text }))
  on('env.get', (_: any, e: any) => ({ value: e.name === 'APPDATA' ? 'C:\\AppData' : e.name === 'REACT_PROFILE' ? '1' : undefined }))
  on('session.id', () => ({ value: 'me' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('fs.read', (_: any, e: any) => {
    if (e.path in files) return { value: files[e.path] }
    throw new Error('ENOENT')
  })
  on('fs.write', (_: any, e: any) => { files[e.path] = e.text; return { value: undefined } })
  on('fs.list', (_: any, e: any) => ({
    value: Object.keys(files).filter(p => p.startsWith(`${e.path}\\`))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: files[p]!.length, mtimeMs: 0 })),
  }))
  return { files, theme: () => JSON.parse(files[THEME]!) }
}
const begin = ($: any) => $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
const open = async ($: any) => {
  await $.command.run({ command: 'narsil-skin', args: 'themes' })
  return $.ui.mount(PANE)
}

test('it is day from 6:00 to 17:59, and night from 18:00 to 5:59', () => {
  expect([0, 5].map(isDay)).toEqual([false, false])
  expect([6, 12, 17].map(isDay)).toEqual([true, true, true])
  expect([18, 23].map(isDay)).toEqual([false, false])
})

test('the auto button writes the day and night themes, each whole, for the page to choose by the hour', async ($, on) => {
  const { theme } = world(on)
  await begin($)
  const ui = await open($)
  await ui.press({ key: 'auto' })
  await ui.unmount()
  const t = theme()
  expect(t).toMatchObject({ id: 'auto', auto: true })
  expect(t.day).toMatchObject({ id: 'narsil-light', bg: '#c9e7f1', wallpaper: 'narsil-light' })
  expect(t.night).toMatchObject({ id: 'narsil', bg: '#0f1a2c', wallpaper: 'narsil' })
})

test('picking a theme by hand turns auto off', async ($, on) => {
  const { theme } = world(on, '{"id":"auto","auto":true,"day":{},"night":{}}')
  await begin($)
  const ui = await open($)
  await ui.press({ key: 'use-narsil' })
  await ui.unmount()
  expect(theme().id).toBe('narsil')
  expect(theme().auto).toBeUndefined()
})

test('pressing auto again turns it off and keeps the theme of the hour', async ($, on) => {
  const { theme } = world(on, '{"id":"auto","auto":true,"day":{},"night":{}}')
  await begin($)
  const ui = await open($)
  await ui.press({ key: 'auto' })
  await ui.unmount()
  expect(theme().auto).toBeUndefined()
  expect(theme().id).toBe(isDay(new Date().getHours()) ? 'narsil-light' : 'narsil')
})

test('changing the wallpaper speed keeps auto on, and both themes get it', async ($, on) => {
  const { theme } = world(on, '{"id":"auto","auto":true,"day":{},"night":{}}')
  await begin($)
  const ui = await open($)
  await ui.press({ key: 'speed' })
  await ui.unmount()
  const t = theme()
  expect(t.auto).toBe(true)
  expect(t.speed).toBe(8)
  expect(t.day.speed).toBe(8)
  expect(t.night.speed).toBe(8)
})

test('a session started under auto keeps auto on and still drives the reactions', async ($, on) => {
  const { files } = world(on, '{"id":"auto","auto":true,"speed":2,"day":{},"night":{}}')
  await begin($)
  await $.turn.start({ text: '', turnId: 't1' })
  expect(JSON.parse(files[`${SLOT}\\event.json`]!)).toMatchObject({ tide: true })
})
