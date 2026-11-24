/**
 * set-piece-kinds — a set piece SAID IN WORDS: a kind is a card that lays its own site (greybox blocks at any height,
 * some of them breakable) and its set piece (set-piece.js: line, camera keys, beats, prompts, pursuers) from a few
 * words, so a level, a room or a template movie names a set piece instead of drawing one. A new kind is a row.
 *
 *   SET_PIECE_KINDS   { <kind>: { name, about, words: { <word>: default }, lay(words) → { blocks, setPiece, start, heading } } }
 *     rooftop-run   across the roofs: a gap jumped onto a roof whose edge gives (a slowed Grab), a blast beside the run,
 *                   a turn, a drop onto a lower roof and its lip climbed (a mashed Climb); pursuers behind
 *     collapse      down a roof street while the tower beside it comes down block by block: wide on the fall, ahead of
 *                   the hero as the dust comes over, a last jump to the far roof caught (a slowed Grab)
 *     climb         a run to a sheer face, up it hold by hand (a jump to the first stone, a leap to each above, the lip
 *                   pulled over: the ledge), along its top onto a ledge that gives (a shake, dust), a reach across to
 *                   the next roof (a slowed Reach), the camera out beside him on the face, over his shoulder above it
 *
 *   readKindWords(kind, words) → the kind's words, its defaults filled (throws naming what it takes)
 *   layKind(kind, words?)      → { blocks, setPiece, start, heading, rule? } (`rule`: anything more the hero's rule needs)
 *   siteOf(blocks)             → { faces, colliders, breakables } the blocks as the World page takes them: a breakable
 *                                block's faces grouped `break:<id>` and named by `node`, kept out of the colliders (the
 *                                world holds it solid until it breaks: a beat's collapse or break)
 *   blocks: [{ id, x: [x0, x1], y: [y0, y1], z: [z0, z1], fill, breaks?: true, hp? }]
 *
 * Pure.
 */
const r2 = (v) => Math.round(v * 100) / 100;
const ROOF = '#b49a7c', LOW = '#9c8468', LIP = '#8a6f55', STONE = '#a8957a', TOWER = '#8f7c66', LEDGE = '#9a8670', FACE = '#857360';

/** Greybox blocks as the World page takes them (see the header). */
export function siteOf(blocks) {
  const faces = [], colliders = [], breakables = [];
  const quad = (a, b, c, d, fill, group, node) => ({ corners: [a, b, c, d], fill, group, doubleSided: true, ...(node ? { node } : {}) });
  for (const B of blocks) {
    const [x0, x1] = B.x, [y0, y1] = B.y, [z0, z1] = B.z, fill = B.fill ?? STONE;
    const group = B.breaks ? `break:${B.id}` : `site:${B.id}`, node = B.breaks ? B.id : null;
    faces.push(
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], fill, group, node),
      quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], fill, group, node), quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], fill, group, node),
      quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], fill, group, node), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], fill, group, node),
      ...(z0 > 0 ? [quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], fill, group, node)] : []),
    );
    if (B.breaks) breakables.push({ id: B.id, min: [x0, y0, z0], max: [x1, y1, z1], hp: B.hp ?? 6 });
    else colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1], ...(B.hold === false ? { hold: false } : {}) });
  }
  // the ground far below, a street
  const G = 70, step = 10;
  for (let i = -G; i < G; i += step) for (let j = -G; j < G; j += step) faces.push(quad([i, j, 0], [i + step, j, 0], [i + step, j + step, 0], [i, j + step, 0], (i + j) / step % 2 ? '#6e665c' : '#746b60', 'site:street'));
  return { faces, colliders, breakables };
}

// ROOFTOP RUN: the stunt room's own (east, a gap, the far roof, north, a drop and a lip)
function rooftopRun(W) {
  const H = W.height;
  const blocks = [
    { id: 'roof-a', x: [-3, 18], y: [-4, 4], z: [0, H], fill: ROOF },
    { id: 'roof-b', x: [21, 42], y: [-4, 4], z: [0, H], fill: ROOF },
    { id: 'roof-c', x: [34, 42], y: [4, 20], z: [0, H], fill: ROOF },
    { id: 'roof-d', x: [34, 42], y: [22.5, 36], z: [0, H - 2], fill: LOW },
    { id: 'lip', x: [34, 42], y: [36, 37], z: [0, H - 0.9], fill: LIP },
  ];
  const setPiece = {
    id: W.id, line: [[0, 0], [38, 0], [38, 34]], half: 2.6, z: H,
    cams: [{ at: 0, frame: 'chase' }, { at: 7, frame: 'lead', fov: 68 }, { at: 17, frame: 'low', cut: true }, { at: 24, frame: 'chase' }, { at: 30, frame: 'wide', shake: 0.5 }, { at: 40, frame: 'profile', cut: true }, { at: 55, frame: 'over' }],
    beats: [{ at: 21.5, id: 'edge', do: [{ shake: 0.5 }, { puff: { at: [21.5, 0, H], is: 'dust' } }] }, ...(W.blast ? [{ at: 31, id: 'blast', do: [{ explode: { at: [36, -6, H] } }, { shake: 0.9 }] }] : [])],
    prompts: [{ at: 22.5, id: `${W.id}-grab`, says: 'Grab', slow: 0.3 }, { at: 62, id: `${W.id}-climb`, kind: 'mash', count: 5, window: 1.2, says: 'Climb' }],
    ...(W.pursuers ? { pursuers: Array.from({ length: W.pursuers }, (_, i) => ({ id: `${W.id}-pursuer-${i + 1}`, gap: 7 + 2 * i })) } : {}),
  };
  return { blocks, setPiece, start: [1, 0, H], heading: 0 };
}

// COLLAPSE: a roof street east, the tower on its north side coming down a course at a time as the hero passes, the
// last roof reached by a jump the dust has caught up with
function collapse(W) {
  const H = W.height, courses = W.courses, ch = 3;
  const tower = Array.from({ length: courses }, (_, k) => ({ id: `tower:${k + 1}`, x: [18, 26], y: [5, 12], z: [H + k * ch, H + (k + 1) * ch], fill: TOWER, breaks: true }));
  const blocks = [
    { id: 'street', x: [-3, 46], y: [-4, 4], z: [0, H], fill: STONE },
    { id: 'tower-foot', x: [18, 26], y: [5, 12], z: [0, H], fill: TOWER },
    ...tower,
    { id: 'far-roof', x: [49, 64], y: [-4, 4], z: [0, H + 0.5], fill: ROOF },
  ];
  const setPiece = {
    id: W.id, line: [[0, 0], [62, 0]], half: 2.8, z: H,
    cams: [{ at: 0, frame: 'chase' }, { at: 8, frame: 'wide', fov: 62 }, { at: 22, frame: 'lead', fov: 70, shake: 0.6 }, { at: 40, frame: 'low', cut: true }, { at: 50, frame: 'chase' }],
    beats: [
      { at: 10, id: 'groan', do: [{ shake: 0.4 }, { puff: { at: [22, 5, H], is: 'dust' } }] },
      { at: 16, id: 'falls', do: [{ collapse: { group: 'tower', how: 'whole', stagger: 0.25 } }, { shake: 1 }] },
      { at: 30, id: 'dust', do: [{ puff: { at: [30, 3, H], is: 'dust' } }, { shake: 0.5 }] },
    ],
    prompts: [{ at: 45.5, id: `${W.id}-grab`, says: 'Grab', slow: 0.3 }],
    ...(W.pursuers ? { pursuers: Array.from({ length: W.pursuers }, (_, i) => ({ id: `${W.id}-pursuer-${i + 1}`, gap: 8 + 2 * i })) } : {}),
  };
  return { blocks, setPiece, start: [1, 0, H], heading: 0 };
}

// CLIMB: a run to a sheer face, up it by its stones (each a hold, 1.6 m over the last, the first a jump from the
// approach, the face's own lip the last), a ledge along its top that gives, a reach to the next roof
export const CLIMB_STEP = 1.6;
function climb(W) {
  const H = W.height, face = W.face, top = H + face;
  const stones = [];
  for (let z = H + 2.6; z < top - 0.5; z += CLIMB_STEP) stones.push(z);   // (the first high enough that the feet leave the ground)
  // (the last stone sits a step under the lip, or less: the lip is reached from it)
  const blocks = [
    { id: 'approach', x: [-3, 20], y: [-4, 4], z: [0, H], fill: STONE },
    { id: 'face', x: [20, 24], y: [-6, 6], z: [0, top], fill: FACE },
    ...stones.map((z, k) => ({ id: `stone-${k + 1}`, x: [19.7, 20], y: [-1.5, 1.5], z: [z - 0.3, z], fill: LIP })),
    { id: 'ledge', x: [24, 40], y: [-1.5, 1.5], z: [0, H + face], fill: LEDGE },
    { id: 'next-roof', x: [43, 58], y: [-5, 5], z: [0, H + face - 1], fill: ROOF },
  ];
  const setPiece = {
    id: W.id, line: [[0, 0], [56, 0]], half: 1.4, z: H,
    // (the face seen from out beside it, the camera rising with him; over his shoulder once he is over its top)
    cams: [{ at: 0, frame: 'chase' }, { at: 16, frame: 'profile', side: 9, up: 3, ahead: 1.5 }, { at: 25, frame: 'over', cut: true }, { at: 31, frame: 'lead', fov: 66 }, { at: 39, frame: 'low', cut: true }, { at: 46, frame: 'chase' }],
    beats: [{ at: 33, id: 'gives', do: [{ shake: 0.6 }, { puff: { at: [33, 0, top], is: 'dust' } }] }],
    prompts: [{ at: 40, id: `${W.id}-reach`, says: 'Reach', slow: 0.3 }],
  };
  return { blocks, setPiece, start: [1, 0, H], heading: 0 };
}

export const SET_PIECE_KINDS = Object.freeze({
  'rooftop-run': { name: 'Rooftop run', about: 'across the roofs: a gap, an edge that gives, a blast beside the run, a drop and a lip to climb', words: { height: 6, pursuers: 2, blast: true }, lay: rooftopRun },
  collapse: { name: 'Collapse', about: 'down a roof street while the tower beside it comes down a course at a time, a last jump caught', words: { height: 6, courses: 5, pursuers: 0 }, lay: collapse },
  climb: { name: 'Climb', about: 'up a sheer face hold by hand, over its lip onto a ledge that gives, a reach across to the next roof', words: { height: 4, face: 7 }, lay: climb },
});
export const SET_PIECE_KIND_IDS = Object.freeze(Object.keys(SET_PIECE_KINDS));

const RANGES = Object.freeze({ height: [2, 20], pursuers: [0, 3], courses: [2, 10], face: [3, 14] });

/** A kind's words, read (see the header). */
export function readKindWords(kind, words = {}) {
  const K = SET_PIECE_KINDS[kind];
  if (!K) throw new Error(`set piece kind is ${SET_PIECE_KIND_IDS.join(', ')}; '${kind}' is none`);
  const out = { ...K.words };
  for (const [k, v] of Object.entries(words ?? {})) {
    if (k === 'id' || k === 'kind') continue;
    if (!(k in K.words)) throw new Error(`${kind}: ${k} is not its word (${Object.keys(K.words).join(', ')})`);
    if (typeof K.words[k] === 'boolean') { if (typeof v !== 'boolean') throw new Error(`${kind}: ${k} is true or false`); out[k] = v; continue; }
    const [lo, hi] = RANGES[k];
    if (!(Number.isFinite(v) && v >= lo && v <= hi)) throw new Error(`${kind}: ${k} is ${lo}–${hi}`);
    out[k] = k === 'pursuers' || k === 'courses' ? Math.round(v) : v;
  }
  out.id = typeof words?.id === 'string' && /^[a-z0-9-]+$/.test(words.id) ? words.id : kind;
  return out;
}

/** A kind laid (see the header). */
export function layKind(kind, words = {}) {
  const W = readKindWords(kind, words);
  const L = SET_PIECE_KINDS[kind].lay(W);
  return { ...L, blocks: L.blocks.map((b) => ({ ...b, x: b.x.map(r2), y: b.y.map(r2), z: b.z.map(r2) })) };
}
