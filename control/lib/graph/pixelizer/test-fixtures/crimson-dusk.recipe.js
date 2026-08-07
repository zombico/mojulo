/**
 * crimson-dusk — a detailed 16-bit screen as one declarative recipe.
 *
 * The 16-bit register at full stretch on a single static frame,
 * 256×224 (the SNES canvas): a six-layer tile lattice — starfield →
 * gradient dusk sky with dithered band seams → setting sun → hazy far
 * ridge → dark near ridge → forest silhouette → detailed ground — with
 * sprite placements over it (sunset streak clouds, distant birds, a
 * 24×32 shaded hero, a hearts HUD). Palette budget 15+transparent per
 * raster (hex cell chars); rim light falls from screen right, where
 * the sun sits.
 *
 * Everything repetitive is built by deterministic helpers (loops, no
 * dice — same module load, same cells); everything characterful is
 * authored cell strings. No animation tracks: a screen, not a scene.
 */

const W = 256;
const H = 224;
const COLS = 32; // 8px tile columns

const at = (lead, s, width = 24) => '.'.repeat(lead) + s + '.'.repeat(width - lead - s.length);
const mid = (s, width = 24) => {
  const pad = width - s.length;
  const l = Math.floor(pad / 2);
  return '.'.repeat(l) + s + '.'.repeat(pad - l);
};
const row = (ch, n = COLS) => ch.repeat(n);
const scatter = (base, ch, cols, n = COLS) => {
  const r = base.repeat(n).split('');
  for (const c of cols) r[c] = ch;
  return r.join('');
};

const solidTile = (color) => ({
  size: [8, 8],
  palette: [color],
  cells: Array.from({ length: 8 }, () => '11111111'),
});

// Band-seam dither: solid A → sparse → 1×1 checker → sparse → solid B,
// blended vertically inside the tile so seams read as gradient, not stripe.
const ditherTile = (a, b) => ({
  size: [8, 8],
  palette: [a, b],
  cells: Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      if (y < 2) return '1';
      if (y < 3) return x % 4 === 1 ? '2' : '1';
      if (y < 5) return (x + y) % 2 ? '2' : '1';
      if (y < 6) return x % 4 === 3 ? '1' : '2';
      return '2';
    }).join('')),
});

const starTile = (bg, star, px) => {
  const t = solidTile(bg);
  t.palette = [bg, star];
  t.cells = t.cells.map((r, y) => {
    const hit = px.filter(([, py]) => py === y).map(([x]) => x);
    return hit.length ? scatter('1', '2', hit, 8) : r;
  });
  return t;
};

// Ridge slope tiles: 'u' rises to the right, 'd' falls; first lit px is rim light.
const slopeTiles = (fill, rim) => ({
  up: { size: [8, 8], palette: [fill, rim], cells: Array.from({ length: 8 }, (_, y) => '.'.repeat(7 - y) + '2' + '1'.repeat(y)) },
  down: { size: [8, 8], palette: [fill, rim], cells: Array.from({ length: 8 }, (_, y) => '1'.repeat(y) + '2' + '.'.repeat(7 - y)) },
  fill: solidTile(fill),
});

/** Merge triangle peaks into ridge rows: apex 'ud' at {col,top}, widening by one tile per row. */
function ridgeRows({ peaks, fillFrom, fillTo }) {
  const rows = [];
  for (let y = 0; y <= fillTo; y++) {
    if (y >= fillFrom) {
      rows.push(row('f'));
      continue;
    }
    const cells = new Array(COLS).fill('.');
    for (const { col, top } of peaks) {
      const k = y - top;
      if (k < 0) continue;
      const lo = col - k;
      const hi = col + 1 + k;
      for (let x = Math.max(0, lo + 1); x <= Math.min(COLS - 1, hi - 1); x++) cells[x] = 'f';
      if (lo >= 0 && cells[lo] === '.') cells[lo] = 'u';
      if (hi < COLS && cells[hi] === '.') cells[hi] = 'd';
    }
    rows.push(cells.join(''));
  }
  return rows;
}

// 24×24 sun disc, 3-shade radial ramp, generated (deterministic circle math).
const sunTile = () => {
  const cells = [];
  for (let y = 0; y < 24; y++) {
    const r = [];
    for (let x = 0; x < 24; x++) {
      const d = Math.sqrt((x - 11.5) ** 2 + (y - 11.5) ** 2);
      r.push(d > 11.5 ? '.' : d < 6 ? '1' : d < 9.5 ? '2' : '3');
    }
    cells.push(r.join(''));
  }
  return { size: [24, 24], palette: ['#f8ecc0', '#f8cc70', '#f0a050'], cells };
};

// ---- the dusk sky: zenith → horizon ramp, seams dithered, stars up top ----
const DUSK = ['#181034', '#302050', '#583468', '#904868', '#c86458', '#f09048'];
const skyLayer = {
  tileSize: [8, 8],
  bank: {
    s0: solidTile(DUSK[0]), s1: solidTile(DUSK[1]), s2: solidTile(DUSK[2]),
    s3: solidTile(DUSK[3]), s4: solidTile(DUSK[4]), s5: solidTile(DUSK[5]),
    d01: ditherTile(DUSK[0], DUSK[1]), d12: ditherTile(DUSK[1], DUSK[2]),
    d23: ditherTile(DUSK[2], DUSK[3]), d34: ditherTile(DUSK[3], DUSK[4]),
    d45: ditherTile(DUSK[4], DUSK[5]),
    x0: starTile(DUSK[0], '#e8e4f8', [[3, 2], [6, 6]]),
    x1: starTile(DUSK[1], '#c8bce0', [[5, 3]]),
  },
  legend: { a: 's0', b: 's1', c: 's2', d: 's3', e: 's4', f: 's5', g: 'd01', h: 'd12', i: 'd23', j: 'd34', k: 'd45', x: 'x0', y: 'x1' },
  rows: [
    scatter('a', 'x', [3, 11, 22, 29]),
    scatter('a', 'x', [7, 17, 26]),
    row('a'),
    scatter('a', 'x', [1, 14, 31]),
    row('g'),
    row('b'),
    scatter('b', 'y', [5, 20]),
    row('b'),
    row('h'),
    row('c'),
    row('c'),
    row('i'),
    row('d'),
    row('d'),
    row('j'),
    row('e'),
    row('e'),
    row('k'),
    ...Array.from({ length: 10 }, () => row('f')),
  ],
};

const sunLayer = {
  tileSize: [24, 24],
  bank: { sun: sunTile() },
  legend: { s: 'sun' },
  rows: ['..........', '..........', '..........', '..........', '.......s..'],
};

const farLayer = {
  tileSize: [8, 8],
  bank: slopeTiles('#6a4278', '#a878a0'),
  legend: { u: 'up', d: 'down', f: 'fill' },
  rows: ridgeRows({ peaks: [{ col: 4, top: 15 }, { col: 13, top: 16 }, { col: 22, top: 15 }, { col: 29, top: 16 }], fillFrom: 19, fillTo: 21 }),
};

const nearLayer = {
  tileSize: [8, 8],
  bank: slopeTiles('#402a58', '#6a4a78'),
  legend: { u: 'up', d: 'down', f: 'fill' },
  rows: ridgeRows({ peaks: [{ col: 9, top: 17 }, { col: 18, top: 18 }, { col: 27, top: 17 }], fillFrom: 20, fillTo: 21 }),
};

const forestLayer = {
  tileSize: [8, 8],
  bank: {
    'canopy-a': {
      size: [8, 8],
      palette: ['#182820', '#243c2c', '#3c6044'],
      cells: ['..33...3', '.3223.32', '32222322', '22222222', '22122212', '21222122', '12211221', '11111111'],
    },
    'canopy-b': {
      size: [8, 8],
      palette: ['#182820', '#243c2c', '#3c6044'],
      cells: ['3...33..', '23.3223.', '22322223', '22222222', '21222122', '22122212', '12212211', '11111111'],
    },
    'forest-fill': {
      size: [8, 8],
      palette: ['#182820', '#243c2c'],
      cells: ['11211121', '11111111', '12111211', '11111111', '11121112', '11111111', '21112111', '11111111'],
    },
  },
  legend: { a: 'canopy-a', b: 'canopy-b', c: 'forest-fill' },
  rows: [
    ...Array.from({ length: 20 }, () => row('.')),
    Array.from({ length: COLS }, (_, i) => (i % 2 ? 'b' : 'a')).join(''),
    row('c'),
  ],
};

const groundLayer = {
  tileSize: [8, 8],
  bank: {
    grass: {
      size: [8, 8],
      palette: ['#78a040', '#3c6c2c', '#284c20', '#e08890'],
      cells: ['11211121', '11111111', '22222222', '22232223', '22222222', '32223222', '22222222', '22322232'],
    },
    'grass-flower': {
      size: [8, 8],
      palette: ['#78a040', '#3c6c2c', '#284c20', '#e08890'],
      cells: ['11211121', '11111111', '22422222', '22232223', '22222422', '32223222', '22222222', '22322232'],
    },
    'grass-deep': {
      size: [8, 8],
      palette: ['#3c6c2c', '#284c20'],
      cells: ['11111111', '12111211', '11111111', '11211121', '11111111', '12111211', '11111111', '11121112'],
    },
    dirt: {
      size: [8, 8],
      palette: ['#5c3c28', '#443020', '#785438'],
      cells: ['11111111', '12111311', '11211111', '13111121', '11112111', '21111113', '11311211', '11111111'],
    },
    'dirt-deep': {
      size: [8, 8],
      palette: ['#443020', '#34241a', '#5c3c28'],
      cells: ['11111111', '11211131', '13111111', '11111211', '21113111', '11111111', '11121113', '31111111'],
    },
  },
  legend: { g: 'grass', w: 'grass-flower', h: 'grass-deep', d: 'dirt', e: 'dirt-deep' },
  rows: [
    ...Array.from({ length: 22 }, () => row('.')),
    scatter('g', 'w', [4, 13, 25]),
    row('h'),
    row('d'),
    row('d'),
    row('e'),
    row('e'),
  ],
};

// ---- sprites: the characterful, hand-authored cells ----

const HERO_PALETTE = [
  '#140c1c', // 1 outline
  '#801c24', // 2 red shadow
  '#c03028', // 3 red
  '#e85840', // 4 red light
  '#f88860', // 5 rim glow
  '#f8c898', // 6 skin
  '#c8845c', // 7 skin shadow
  '#88e0e8', // 8 visor
  '#307888', // 9 visor deep
  '#98a0b8', // a metal light
  '#485068', // b metal dark
  '#f8f8f8', // c glint
];

const hero = {
  size: [24, 32],
  palette: HERO_PALETTE,
  cells: [
    mid('111111'),
    mid('1123334411'),
    mid('112333334411'),
    mid('12233333334411'),
    mid('1223333333445511'),
    mid('1233333333444511'),
    mid('1122111111114451'),
    mid('121988888c891451'),
    mid('121988888c891451'),
    mid('1219988888991451'),
    mid('11221111112211'),
    mid('1b76671'),
    mid('11aab333333baa11'),
    mid('1aaaab333333baaaa1'),
    mid('1aabb23333334bbaa1'),
    mid('1ab1b2333334b1ba1'),
    mid('1a11b233c3334b11a1'),
    mid('1611b2333334b1161'),
    mid('111b23333334b111'),
    mid('1b23333334b1'),
    mid('1bb111111bb1'),
    mid('122211112221'),
    mid('1231....1321'),
    mid('1231....1321'),
    mid('1231....1321'),
    mid('1231....1321'),
    mid('1bb31..13bb1'),
    mid('1bbb31..13bbb1'),
    mid('1bbbb1..1bbbb1'),
    mid('1bbbb1..1bbbb1'),
    mid('111111..111111'),
    mid(''),
  ],
};

const HEART_PALETTE = ['#2c1024', '#f04858', '#a02030', '#f8f8f8', '#583040'];
const heartFull = {
  size: [16, 14],
  palette: HEART_PALETTE,
  cells: [
    '...111....111...',
    '..12221..12221..',
    '.12222211222221.',
    '1244222222222331',
    '1242222222233331',
    '1222222222233331',
    '.12222222233331.',
    '.12222222233331.',
    '..122222233331..',
    '...1222233331...',
    '....12223331....',
    '.....122331.....',
    '......1331......',
    '.......11.......',
  ],
};
const heartEmpty = {
  size: [16, 14],
  palette: HEART_PALETTE,
  cells: heartFull.cells.map((r) => r.replace(/[234]/g, '5')),
};

const CLOUD_PALETTE = ['#f8dcc0', '#e8a898', '#c07c94'];
const cloudBig = {
  size: [40, 6],
  palette: CLOUD_PALETTE,
  cells: [
    at(13, '11111111111', 40),
    at(6, '1112222222222222222221111', 40),
    at(2, '11222222222222222222222222222211', 40),
    at(0, '2222333222222222222222222233322222', 40),
    at(4, '3333222233333333333322223333', 40),
    at(12, '333333333333', 40),
  ],
};
const cloudSmall = {
  size: [28, 4],
  palette: CLOUD_PALETTE,
  cells: [
    at(9, '111111111', 28),
    at(4, '112222222222222211', 28),
    at(1, '22333222222222222333222', 28),
    at(7, '3333333333', 28),
  ],
};

const bird = {
  size: [7, 3],
  palette: ['#100c1c'],
  cells: ['11...11', '..1.1..', '...1...'],
};

export const CRIMSON_DUSK_RECIPE = {
  kind: 'pixel-map',
  register: '16bit',
  size: [W, H],
  background: DUSK[0],
  tiles: [skyLayer, sunLayer, farLayer, nearLayer, forestLayer, groundLayer],
  sprites: {
    hero,
    'heart-full': heartFull,
    'heart-empty': heartEmpty,
    'cloud-big': cloudBig,
    'cloud-small': cloudSmall,
    bird,
  },
  placements: [
    { id: 'cloud-a', sprite: 'cloud-big', cell: [22, 22] },
    { id: 'cloud-b', sprite: 'cloud-small', cell: [136, 52] },
    { id: 'bird-a', sprite: 'bird', cell: [58, 60] },
    { id: 'bird-b', sprite: 'bird', cell: [74, 66] },
    { id: 'bird-c', sprite: 'bird', cell: [96, 56] },
    { id: 'hero', sprite: 'hero', cell: [104, 144], facing: 'W' },
    { id: 'hp-1', sprite: 'heart-full', cell: [8, 8] },
    { id: 'hp-2', sprite: 'heart-full', cell: [26, 8] },
    { id: 'hp-3', sprite: 'heart-empty', cell: [44, 8] },
  ],
};
