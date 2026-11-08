// Narsil, a chibi sea serpent, swims the night sea: a crescent moon, jellyfish drifting up, waves at the bottom.
// Her colors: a slate-blue back with gold spots, a pale belly, blue fins with gold spines, big amber eyes.
const NARSIL = {
  B: { bg: '#3d5674', fg: '#1e2c40', a: .95 },
  b: { bg: '#a8bad2', fg: '#5d6f8a', a: .92 },
  s: { bg: '#e6b23a', fg: '#6b4a10', a: .95 },
  g: { bg: '#e6b23a', fg: '#6b4a10', a: .9 },
  F: { bg: '#6aa6e8', fg: '#2b4f80', a: .85 },
  E: { bg: '#f4a53c', fg: '#f4a53c', ch: '', a: 1 },
  P: { bg: '#1a1420', fg: '#1a1420', ch: '', a: 1 },
  W: { bg: '#ffffff', fg: '#ffffff', ch: '', a: 1 },
  m: { bg: '#e07a8a', fg: '#7a2a3a', a: .95 },
};

// Her head, facing right: dorsal fin with gold spines, a big amber eye with a white glint, a smile, a side fin
// that paddles (two frames)
const HEAD_W = 13, HEAD_H = 10;
const HEAD_TOP = [[2, 3, 'BBBBBBBB'], [3, 2, 'BBsBBBBBBB'], [4, 1, 'BBBBBBBWEEB'], [6, 0, 'FFbbbbbbbEEbb'],
  [8, 3, 'bbbbbbbb'], [9, 4, 'bbbbbb']];
const HEADS = [
  sketch(HEAD_W, HEAD_H, [[0, 4, 'g'], [0, 8, 'g'], [1, 3, 'gF'], [1, 7, 'gFF'], ...HEAD_TOP,
    [5, 0, 'FBBBBBBbEPPb'], [7, 1, 'F bbbbbbbbmb']]),
  sketch(HEAD_W, HEAD_H, [[0, 5, 'g'], [0, 9, 'g'], [1, 4, 'gF'], [1, 8, 'gF'], ...HEAD_TOP,
    [5, 1, 'BBBBBBbEPPb'], [7, 0, 'FFFbbbbbbbbmb']]),
];

// Her body, upright as in her picture and worked out each frame: an S-wave runs from the neck down to the tail,
// wider at the neck, swinging more toward the tail, with a fin at its end
const BODY_W = 12, BODY_H = 15;
const spine = (gy, t) => 6 + (.4 + gy * .14) * Math.sin(gy * .45 - t * 2.4);
const body = t => (gx, gy) => {
  const hw = Math.max(.8, 2.6 - gy * .12), d = gx - spine(gy, t);
  if (Math.abs(d) <= hw) {
    if (d < -hw * .15) return { c: NARSIL.b };
    return { c: hash(gx, gy, 13) < .14 ? NARSIL.s : NARSIL.B };
  }
  const fin = gy - (BODY_H - 4);
  if (fin > 0 && Math.abs(d) <= hw + fin * .9 && hash(gx, gy, 17) < .85) return { c: NARSIL.F };
};

// Jellyfish from the deep, smaller and dimmer than Narsil
const jelly = ph => sketch(13, 22, [
  ...(ph ? [[0, 4, 'BBBBB'], [1, 2, 'BBBBBBBBB'], [2, 1, 'BBpBBBBBpBB'], [3, 0, 'RRRRRRRRRRRRR']]
    : [[0, 3, 'BBBBBBB'], [1, 1, 'BBBBBBBBBBB'], [2, 1, 'BBpBBBBBpBB'], [3, 1, 'RRRRRRRRRRR']]),
  [4, 3, 'kkkkkkk'],
  ...[1, 3, 5, 7, 9, 11].flatMap((c, k) => Array.from({ length: 16 }, (_, i) => {
    const r = hash(k, i, 7);
    return r < .18 ? [] : [[5 + i, c, r < .42 ? 'o' : 'l']];
  }).flat()),
]);
const JELLIES = [jelly(0), jelly(1)];
const jellyPal = c => ({
  B: { bg: c, fg: shade(c, -.6), a: .72 }, p: { bg: shade(c, .55), fg: c, a: .85 }, R: { bg: shade(c, .15), fg: shade(c, -.6), a: .78 },
  k: { bg: shade(c, -.15), fg: shade(c, -.65), a: .6 }, l: { bg: c, fg: shade(c, -.6), a: .62 }, o: { ch: 'o', fg: shade(c, .3), a: .5 },
});
const JELLY = [[.8, jellyPal('#7fb4ef'), .7, .5], [.92, jellyPal('#9a7fe0'), .55, .42]];

const BUBBLE = sketch(1, 1, [[0, 0, 'o']]);
const BUBBLE_PAL = { o: { ch: 'o', fg: '#bfe0ff', a: .7 } };

SCENES.narsil = {
  cell: (x, y, cols, rows, t) => {
    // the crescent moon, top right, with a soft rim
    const mx = Math.round(cols * .84), my = Math.round(rows * .16), R = 5.5;
    const d1 = Math.hypot(x - mx, y - my), d2 = Math.hypot(x - mx - 3, y - my + 1.6);
    if (d1 <= R && d2 > R * .85) return { bg: '#e8d9a0', fg: '#4a4126', a: .88 };
    if (d1 <= R + 1.5 && d2 > R * .85 + .6 && hash(x, y, 5) < .45) return { fg: '#e8d9a0', a: .22 + .12 * Math.sin(t * 2 + x) };
    // waves along the bottom
    const top = rows - 2.4 + .8 * Math.sin(x * .35 + t * 1.2);
    if (Math.abs(y - top) < .5) return { ch: '~', fg: '#9cc8ff', a: .55, floor: .4 };
    if (y > top) return { bg: '#5aaeff', fg: '#1d4d80', a: .22 };
    // specks rising through the water, and stars
    if (rising(x, y, t, .6, .006)) return { ch: '.', fg: '#9cc8ff', a: .3 };
    return twinkle(x, y, t, '#dce6fa', .014);
  },
  sprites: (cols, rows, t) => {
    // in the left margin, beside the chat, bobbing gently
    const x0 = cols * .255 - BODY_W / 2 + Math.sin(t * .25) * 1.5, y0 = rows * .42 + Math.sin(t * .6) * 1.2;
    const hx = x0 + spine(0, t) - 6.5, hy = y0 - HEAD_H + .4;
    return [
      ...JELLY.map(([fx, pal, v, a], i) => {
        const span = rows + 34;
        return { art: frame(JELLIES, t, 1.1, i * .5), pal, a, key: 10 + i,
          x: fx * cols + Math.sin(t * .35 + i) * 2.5 - 6.5, y: rows + 4 - ((t * v + i * span / 2) % span) };
      }),
      { field: body(t), w: BODY_W, h: BODY_H, x: x0, y: y0, key: 1, shadow: '#050a14' },
      { art: frame(HEADS, t, 1.4), pal: NARSIL, x: hx, y: hy, key: 2, shadow: '#050a14', halo: '#5aaeff',
        glow: { r: 9, color: '#5aaeff', a: .18 } },
      ...Array.from({ length: 6 }, (_, i) => {
        const p = (t * .35 + i / 6) % 1;
        return { art: BUBBLE, pal: BUBBLE_PAL, key: 20 + i, a: 1 - p,
          x: hx + 12 + Math.sin(t * 2 + i * 1.7) * 1.2, y: hy + 7 - p * 14 };
      }),
    ];
  },
};
