import { HEADS, HEAD_SIZE } from './heads'

// Narsil's head in place of the desktop's thinking indicator, tilting slowly from side to side.
// Both heads ride in one SVG and its own CSS shows the light one in light mode and the dark one in
// dark mode: the API does not say which mode the app is in, and the SVG's frame follows it.

const PAD = 1 // the face does not reach the corners, so a turn needs little room
export const TILT = 30 // degrees to either side
export const PERIOD = 4 // seconds for a whole swing, one side and back to the other
const STEPS = 16 // points along a sine, drawn linearly: the desktop drops keySplines
export const HEAD_PX = 44 // the row's height caps it: a bigger box draws no bigger

const c = HEAD_SIZE / 2
const rotations = Array.from({ length: STEPS + 1 }, (_, i) => TILT * Math.sin((2 * Math.PI * i) / STEPS))
  .map(a => `${a.toFixed(1)} ${c} ${c}`).join(';')

// shows what is classed light in light mode and what is classed dark in dark mode
export const MODE_STYLE =
  `<style>.dark{display:none}@media (prefers-color-scheme: dark){.light{display:none}.dark{display:inline}}</style>`

// a picture's light and dark versions, each shown only in its own mode
const byMode = (art: { light: string; dark: string }) =>
  `${MODE_STYLE}<g class="light">${art.light}</g><g class="dark">${art.dark}</g>`

// `begin` sets the swing where the clock has it, so a redraw mid-turn carries on instead of starting over
export const head = (now: number) => {
  const phase = ((now / 1000) % PERIOD).toFixed(2)
  const box = HEAD_SIZE + 2 * PAD
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${box} ${box}" width="${box}" height="${box}" ` +
    `shape-rendering="crispEdges"><g>` +
    `<animateTransform attributeName="transform" type="rotate" values="${rotations}" ` +
    `dur="${PERIOD}s" begin="-${phase}s" repeatCount="indefinite"/>` +
    `${byMode(HEADS)}</g></svg>`
}
