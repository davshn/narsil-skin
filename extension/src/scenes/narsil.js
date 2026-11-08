// The Narsil theme's only motion: a crescent moon, its light breathing slowly. Everything else is the Night Sea
// background of themes/narsil.css, so this scene draws no grid and nothing but the moon.
SCENES.narsil = {
  grid: false,
  cell: (x, y, cols, rows, t) => {
    const mx = Math.round(cols * .84), my = Math.round(rows * .16), R = 5.5;
    const d1 = Math.hypot(x - mx, y - my), d2 = Math.hypot(x - mx - 3, y - my + 1.6);
    const breath = .5 + .5 * Math.sin(t * .8);
    if (d1 <= R && d2 > R * .85) return { bg: '#e8d9a0', fg: '#4a4126', a: .78 + .17 * breath };
    if (d1 <= R + 1.5 && d2 > R * .85 + .6 && hash(x, y, 5) < .45) return { fg: '#e8d9a0', a: .15 + .25 * breath };
  },
};
