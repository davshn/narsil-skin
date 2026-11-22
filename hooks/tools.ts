import { TOOL_FACES, TOOL_SIZE } from './heads'
import { MODE_STYLE } from './spinner'

// Narsil's face beside a tool call's row in the transcript, telling how the call is going: focused while it
// runs, happy once it has run, wincing when it fails and asleep when it was interrupted. Light in light mode
// and dark in dark mode, drawn one grid cell to a pixel so her edges stay sharp.

export type ToolFace = keyof typeof TOOL_FACES

export const TOOL_PX = TOOL_SIZE
const BOB = 1 // pixels she bobs while working
const BOB_PERIOD = 1.2 // seconds for one bob

// an interrupted call is also errored, so it is asked about first
export const faceOf = (p: { isRunning: boolean; isErrored: boolean; isInterrupted: boolean }): ToolFace =>
  p.isInterrupted ? 'stopped' : p.isErrored ? 'failed' : p.isRunning ? 'working' : 'done'

export const toolFace = (face: ToolFace) => {
  const art = TOOL_FACES[face]
  const moving = face === 'working'
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-BOB};0 0;0 ${BOB};0 0" ` +
      `dur="${BOB_PERIOD}s" repeatCount="indefinite"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TOOL_SIZE} ${TOOL_SIZE}" width="${TOOL_PX}" height="${TOOL_PX}" ` +
    `shape-rendering="crispEdges">${MODE_STYLE}<g>${moving}` +
    `<g class="light">${art.light}</g><g class="dark">${art.dark}</g></g></svg>`
}
