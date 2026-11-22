import { ASKING, ASK_SIZE } from './heads'
import { MODE_STYLE } from './spinner'

// Narsil's surprised face above the card where Claude asks you a question, a wave running down her from
// crest to chin, light in light mode and dark in dark mode as the thinking indicator does. She is drawn
// one grid cell to a pixel, so her edges stay sharp instead of showing blocks.
// Each face is drawn once and shown again through horizontal bands, each band swaying sideways a little
// behind the one above: copying the face per band would pass the app's limit on an SVG's length.

export const SWAY = 1 // pixels each band moves to either side: a faint ripple, not a sway
export const WAVE_PERIOD = 2.4 // seconds for one sway
export const BAND = 4 // pixels of her height in one band: fewer bands keep the SVG within the app's limit
const LAG = 0.04 // seconds each pixel row trails the one above, so the wave runs down
const PAD = Math.ceil(SWAY) + 1 // room for the sway on either side
export const ASK_PX = ASK_SIZE + 2 * PAD
export const SVG_LIMIT = 131072 // the longest SVG source the app draws

const bands = Array.from({ length: Math.ceil(ASK_SIZE / BAND) }, (_, i) => i * BAND)

// every band of one face, each clipped to its strip and swaying on its own beat
const waving = (id: string) => bands.map(y =>
  `<g clip-path="url(#b${y})"><use href="#${id}">` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;${SWAY} 0;0 0;${-SWAY} 0;0 0" ` +
  `dur="${WAVE_PERIOD}s" begin="${(-y * LAG).toFixed(2)}s" repeatCount="indefinite"/></use></g>`).join('')

export const asking = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${ASK_PX} ${ASK_PX}" width="${ASK_PX}" height="${ASK_PX}" ` +
  `shape-rendering="crispEdges">${MODE_STYLE}<defs>` +
  `<g id="fl">${ASKING.light}</g><g id="fd">${ASKING.dark}</g>` +
  bands.map(y => `<clipPath id="b${y}"><rect x="${-PAD}" y="${y}" width="${ASK_PX}" height="${BAND}"/></clipPath>`).join('') +
  `</defs><g class="light">${waving('fl')}</g><g class="dark">${waving('fd')}</g></svg>`
