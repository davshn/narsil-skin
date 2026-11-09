// Narsil Light's only motion: a sun at the top right, its rays turning slowly and its light breathing.
SCENES['narsil-light'] = {
  grid: false,
  cell: (x, y, cols, rows, t) => {
    const mx = Math.round(cols * .84), my = Math.round(rows * .16), R = 4.5, RAYS = 10;
    const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy);
    const breath = .5 + .5 * Math.sin(t * .8);
    if (d <= R) return { bg: '#ffcf4a', fg: '#c98f10', a: .86 + .12 * breath };
    if (d > R + 9) return;
    const turn = (Math.atan2(dy, dx) + t * .06) / (Math.PI * 2) * RAYS;
    const off = Math.abs(turn - Math.round(turn)) * (Math.PI * 2 / RAYS) * d;
    if (d >= R + 1.5 && d <= R + 4 + 1.5 * breath && off < .75) return { bg: '#ffd966', fg: '#c98f10', a: .55 + .3 * breath };
    if (hash(x, y, 5) < .3) return { fg: '#e0a21e', a: (.2 + .3 * breath) * (1 - (d - R) / 9) };
  },
};
