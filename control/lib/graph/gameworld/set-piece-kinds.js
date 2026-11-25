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
 *     truck-top     along the roofs of a convoy driving down a road: off each trailer onto its cab, a jump to the next
 *                   truck, pursuers on the roofs behind, a blast on the road beside, the last and widest gap caught (a
 *                   slowed Grab); the camera low beside the trucks as the road streams by
 *     train-roof    along the roofs of a train: car to car over the couplings, the widest gap caught (a slowed Grab), up
 *                   onto the taller engine (a mashed Climb), steam from its stack
 *     slide         down a scree slope from a crest (the slide: slide.js), boulders narrowing the run, off its foot over
 *                   a gap into a catch on the far shelf's lip (the ledge), a slowed Grab; the camera ahead looking back up
 *                   at him, low beside him as he goes off, beside him for the catch
 *   A moving kind's vehicles are carriers (worlds/controllable/rules-basic.js `mover`, core.js carry), each on one path
 *   at one pace, and its set piece rides the first (`rides`): its line, its prompts' checkpoints and its pursuers in the
 *   convoy's frame, its beats at a body (`who`), never at a place the road leaves behind.
 *
 *   readKindWords(kind, words) → the kind's words, its defaults filled (throws naming what it takes)
 *   layKind(kind, words?)      → { blocks, setPiece, start, heading, jumps, rule?, entities?, faces?, slides? } (`jumps`: metres
 *                                along the line where a gap is jumped, for a bot or a gate; `rule`: anything more the
 *                                hero's rule needs; `entities` and `faces`: a moving kind's vehicles and its road;
 *                                `slides`: the slopes a body slides down, slide.js, their faces among the kind's `faces`)
 *   siteOf(blocks, { street? }) → { faces, colliders, breakables } the blocks as the World page takes them: a breakable
 *                                block's faces grouped `break:<id>` and named by `node`, kept out of the colliders (the
 *                                world holds it solid until it breaks: a beat's collapse or break)
 *   blocks: [{ id, x: [x0, x1], y: [y0, y1], z: [z0, z1], fill, breaks?: true, hp? }]
 *
 * Pure.
 */
const r2 = (v) => Math.round(v * 100) / 100;
const ROOF = '#b49a7c', LOW = '#9c8468', LIP = '#8a6f55', STONE = '#a8957a', TOWER = '#8f7c66', LEDGE = '#9a8670', FACE = '#857360';

/** Greybox blocks as the World page takes them (see the header). */
export function siteOf(blocks, { street = true } = {}) {
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
  // the ground far below, a street (a moving kind lays its own road)
  const G = street ? 70 : 0, step = 10;
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
  return { blocks, setPiece, start: [1, 0, H], heading: 0, jumps: [17] };
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
  return { blocks, setPiece, start: [1, 0, H], heading: 0, jumps: [45.2] };
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
  return { blocks, setPiece, start: [1, 0, H], heading: 0, jumps: [19.2, 39.4] };
}

// A CONVOY: vehicles in a row driving east along the line, nose to tail with a gap between each, all carriers on one path
// at one pace; the line laid along their roofs in their own frame. `cars` from the rear: { id, len, top, width, gap }
// (the gap after it, before the next), each a box from its `floor` up to its top. The road under it runs the whole drive.
const DRIVE_S = 120;
function convoyOf(W, cars, { floor, road }) {
  const D = W.speed * DRIVE_S, entities = [], gaps = [];
  let x = 0;
  for (const [k, c] of cars.entries()) {
    const h = c.top - floor, cx = x + c.len / 2, cz = floor + h / 2;
    entities.push({ id: `${W.id}-${c.id}`, rule: { type: 'mover', path: [[r2(cx), 0, r2(cz)], [r2(cx + D), 0, r2(cz)]], period: DRIVE_S, mode: 'loop' },
      body: { type: 'mesh', shape: 'box', size: [c.len, c.width, r2(h)], color: c.fill, marker: false, carrier: true, carryHalf: [r2(c.len / 2), r2(c.width / 2)], deck: r2(h / 2) },
      transform: { pos: [r2(cx), 0, r2(cz)] } });
    x += c.len;
    if (k < cars.length - 1) { gaps.push({ at: x, gap: c.gap, next: cars[k + 1] }); x += c.gap; }
  }
  // a pacer beside the convoy, a body of nothing driving with it: a beat's blast stands at it, the road beside the run
  entities.push({ id: `${W.id}-pacer`, rule: { type: 'mover', path: [[0, -7, 0], [D, -7, 0]], period: DRIVE_S, mode: 'loop' }, body: { type: 'none' }, transform: { pos: [0, -7, 0] } });
  // the road the whole drive and on past it, posts beside it every 30 m so the speed reads
  const faces = [], quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group, doubleSided: true });
  for (let u = -40, n = 0; u < D + x + 60; u += 20, n++) {
    faces.push(quad([u, -12, 0], [u + 20, -12, 0], [u + 20, 12, 0], [u, 12, 0], n % 2 ? road.a : road.b, 'site:road'));
    for (const y of road.marks) faces.push(quad([u + 2, y - 0.08, 0.02], [u + (road.dash ?? 20) - 2, y - 0.08, 0.02], [u + (road.dash ?? 20) - 2, y + 0.08, 0.02], [u + 2, y + 0.08, 0.02], road.mark, 'site:road'));
    if (n % 3 === 0) {
      const px = u, py0 = -9.15, py1 = -8.85;
      faces.push(quad([px, py0, 0], [px + 0.3, py0, 0], [px + 0.3, py0, 3], [px, py0, 3], '#4a4640', 'site:posts'), quad([px, py1, 0], [px + 0.3, py1, 0], [px + 0.3, py1, 3], [px, py1, 3], '#4a4640', 'site:posts'),
        quad([px, py0, 0], [px, py1, 0], [px, py1, 3], [px, py0, 3], '#4a4640', 'site:posts'), quad([px + 0.3, py0, 0], [px + 0.3, py1, 0], [px + 0.3, py1, 3], [px + 0.3, py0, 3], '#4a4640', 'site:posts'));
    }
  }
  return { entities, faces, gaps, len: x, rides: `${W.id}-${cars[0].id}` };
}

// TRUCK-TOP: a convoy of trucks, each a trailer and a lower cab ahead of it; off the trailer onto the cab, a jump to the
// next truck's trailer, the last gap the widest and caught
function truckTop(W) {
  const TRAILER = 4, CAB = 3.4, cars = [];
  for (let k = 0; k < W.trucks; k++) {
    const last = k === W.trucks - 2;
    // (the rear truck's trailer long enough that the hero and the pursuers behind them all start on it)
    cars.push({ id: `trailer-${k + 1}`, len: k === 0 ? 16 : 11, top: TRAILER, width: 2.5, gap: 0.4, fill: '#8f8578' });
    cars.push({ id: `cab-${k + 1}`, len: 2.6, top: CAB, width: 2.4, gap: last ? 3.2 : 2.6, fill: '#6f6a64' });
  }
  const C = convoyOf(W, cars, { floor: 1.1, road: { a: '#5f5a54', b: '#635e57', marks: [0], mark: '#c9c1a8', dash: 8 } });
  // the jumps: off each cab's front to the next trailer (the cab's own step down is walked off)
  const jumps = C.gaps.filter((g) => g.next.id.startsWith('trailer')).map((g) => r2(g.at - 0.4)), last = C.gaps.filter((g) => g.next.id.startsWith('trailer')).pop();
  const end = r2(C.len - 0.5), blast = r2(jumps[1] != null ? jumps[1] + 6 : end / 2);
  const setPiece = {
    id: W.id, line: [[0, 0], [end, 0]], half: 1, z: TRAILER, rides: C.rides,
    cams: [{ at: 0, frame: 'chase' }, { at: 10.5, frame: 'lead', fov: 68 }, { at: r2(jumps[0] - 1.5), frame: 'low', cut: true }, { at: r2(jumps[0] + 5), frame: 'profile', cut: true },
      ...(W.blast ? [{ at: r2(blast - 3), frame: 'wide', shake: 0.5 }] : []), { at: r2(last.at - 2.5), frame: 'low', cut: true }, { at: r2(last.at + 5), frame: 'over' }].sort((a, b) => a.at - b.at),
    beats: [{ at: 14, id: 'swerve', do: [{ shake: 0.4 }] }, ...(W.blast ? [{ at: blast, id: 'blast', do: [{ explode: { who: `${W.id}-pacer` } }, { shake: 0.9 }] }] : [])],
    prompts: [{ at: r2(last.at + 1.2), id: `${W.id}-grab`, says: 'Grab', slow: 0.3 }],
    ...(W.pursuers ? { pursuers: Array.from({ length: W.pursuers }, (_, i) => ({ id: `${W.id}-pursuer-${i + 1}`, gap: 6.5 + 1.5 * i })) } : {}),
  };
  return { blocks: [], setPiece, start: [9, 0, TRAILER], heading: 0, jumps, entities: C.entities, faces: C.faces };
}

// TRAIN-ROOF: cars nose to tail behind a taller engine; car to car over the couplings, the widest gap caught, up onto the
// engine by a mashed climb, steam from its stack
function trainRoof(W) {
  const CAR = 4.3, ENGINE = 5.1, cars = [], wide = Math.max(0, W.cars - 3);
  for (let k = 0; k < W.cars; k++) cars.push({ id: `car-${k + 1}`, len: 15, top: CAR, width: 2.9, gap: k === wide ? 3 : 2, fill: k % 2 ? '#7d7468' : '#776e63' });
  cars.push({ id: 'engine', len: 17, top: ENGINE, width: 3, gap: 0, fill: '#5d5852' });
  const C = convoyOf(W, cars, { floor: 1.1, road: { a: '#6b6258', b: '#675e55', marks: [-0.75, 0.75], mark: '#3b3733', dash: 20 } });
  const jumps = C.gaps.map((g) => r2(g.at - 0.4)), widest = C.gaps[wide], engine = C.gaps[C.gaps.length - 1], end = r2(C.len - 0.5);
  const setPiece = {
    id: W.id, line: [[0, 0], [end, 0]], half: 1.2, z: CAR, rides: C.rides,
    cams: [{ at: 0, frame: 'chase' }, { at: 10, frame: 'lead', fov: 68 }, { at: 16, frame: 'profile', cut: true }, { at: r2(widest.at - 2.5), frame: 'low', cut: true }, { at: r2(widest.at + 5), frame: 'chase' },
      { at: r2(engine.at - 6), frame: 'wide', fov: 62 }, { at: r2(engine.at + 3), frame: 'over' }].sort((a, b) => a.at - b.at),
    beats: [{ at: r2(engine.at - 4), id: 'steam', do: [{ puff: { who: `${W.id}-engine`, is: 'smoke' } }, { shake: 0.4 }] }],
    prompts: [{ at: r2(widest.at + 1.2), id: `${W.id}-grab`, says: 'Grab', slow: 0.3 }, { at: r2(engine.at + 0.2), id: `${W.id}-climb`, kind: 'mash', count: 5, window: 1.2, says: 'Climb' }],
    ...(W.pursuers ? { pursuers: Array.from({ length: W.pursuers }, (_, i) => ({ id: `${W.id}-pursuer-${i + 1}`, gap: 6.5 + 1.5 * i })) } : {}),
  };
  return { blocks: [], setPiece, start: [9, 0, CAR], heading: 0, jumps, entities: C.entities, faces: C.faces };
}

// SLIDE: a crest, a scree slope down from its edge (boulders off the line narrowing it), a gap at its foot and a shelf
// beyond whose lip stands where a body going off the foot level at speed meets it at hand height (the ledge catches it)
const SCREE = '#9b8c78', SCREE_SIDE = '#7f725f', BOULDER = '#6f6558';
function slideKind(W) {
  const H = W.height, top = H + W.drop, x0 = 8, x1 = x0 + W.length, gap = 3, lip = H + 1.3;
  const at = (x) => top - (W.drop * (x - x0)) / W.length;
  const blocks = [
    { id: 'crest', x: [-3, x0], y: [-3, 3], z: [0, top], fill: STONE },
    { id: 'shelf', x: [x1 + gap, x1 + gap + 14], y: [-3, 3], z: [0, lip], fill: LEDGE },
  ];
  // under the slope a stair of boxes just below its surface: solid to the camera's clear view, no hold for the hands; it
  // stops short of the foot, so a body going off it is in the air at once and never stood on its last tread
  const foot = x1 - 0.6;
  for (let x = x0, k = 1; x < foot - 1e-6; x += 2, k++) blocks.push({ id: `under-${k}`, x: [x, r2(Math.min(x + 2, foot))], y: [-3, 3], z: [0, r2(at(Math.min(x + 2, foot)) - 0.05)], fill: SCREE_SIDE, hold: false });
  // the boulders: off the line on either side, standing a metre over the slope
  for (let k = 0; k < W.boulders; k++) {
    const x = x0 + (W.length * (k + 1)) / (W.boulders + 1), side = k % 2 ? -1 : 1, z = at(x);
    blocks.push({ id: `boulder-${k + 1}`, x: [r2(x - 0.6), r2(x + 0.6)], y: side > 0 ? [1.1, 2.3] : [-2.3, -1.1], z: [r2(z - 0.4), r2(z + 1)], fill: BOULDER, hold: false });
  }
  // the slope's own face, and its sides
  const quad = (a, b, c, d, fill) => ({ corners: [a, b, c, d], fill, group: 'site:slope', doubleSided: true });
  const faces = [quad([x0, -3, top], [x1, -3, H], [x1, 3, H], [x0, 3, top], SCREE),
    quad([x0, -3, 0], [x1, -3, 0], [x1, -3, H], [x0, -3, top], SCREE_SIDE), quad([x0, 3, 0], [x1, 3, 0], [x1, 3, H], [x0, 3, top], SCREE_SIDE)];
  const end = r2(x1 + gap + 12), grab = r2(x1 + 1);
  const setPiece = {
    id: W.id, line: [[0, 0], [end, 0]], half: 2.4, z: top,
    cams: [{ at: 0, frame: 'chase' }, { at: r2(x0 - 1), frame: 'lead', fov: 66, cut: true }, { at: r2(x1 - 4), frame: 'low', cut: true }, { at: r2(x1 + 1.5), frame: 'profile', cut: true }, { at: r2(x1 + gap + 4), frame: 'over' }],
    beats: [{ at: r2(x0 + 1), id: 'scree', do: [{ puff: { who: 'hero', is: 'dust' } }, { shake: 0.3 }] }, { at: r2(x0 + W.length / 2), id: 'rumble', do: [{ puff: { who: 'hero', is: 'dust' } }, { shake: 0.5 }] }],
    // (a miss is back on the crest, to slide again)
    prompts: [{ at: grab, id: `${W.id}-grab`, says: 'Grab', slow: 0.3, back: r2(grab - (x0 - 3)) }],
  };
  return { blocks, setPiece, start: [1, 0, top], heading: 0, jumps: [], faces, slides: [{ id: `${W.id}-slope`, a: [x0, 0, top], b: [x1, 0, H], half: 3 }] };
}

export const SET_PIECE_KINDS = Object.freeze({
  'rooftop-run': { name: 'Rooftop run', about: 'across the roofs: a gap, an edge that gives, a blast beside the run, a drop and a lip to climb', words: { height: 6, pursuers: 2, blast: true }, lay: rooftopRun },
  collapse: { name: 'Collapse', about: 'down a roof street while the tower beside it comes down a course at a time, a last jump caught', words: { height: 6, courses: 5, pursuers: 0 }, lay: collapse },
  climb: { name: 'Climb', about: 'up a sheer face hold by hand, over its lip onto a ledge that gives, a reach across to the next roof', words: { height: 4, face: 7 }, lay: climb },
  'truck-top': { name: 'Truck top', about: 'along the roofs of a convoy down a road, truck to truck, pursuers behind, a blast beside, the widest gap caught', words: { trucks: 4, speed: 9, pursuers: 2, blast: true }, lay: truckTop },
  slide: { name: 'Slide', about: 'down a scree slope, boulders narrowing the run, off its foot over a gap into a catch on the far lip', words: { height: 4, drop: 10, length: 28, boulders: 3 }, lay: slideKind },
  'train-roof': { name: 'Train roof', about: 'along the roofs of a train, car to car, the widest gap caught, up onto the engine', words: { cars: 5, speed: 12, pursuers: 2 }, lay: trainRoof },
});
export const SET_PIECE_KIND_IDS = Object.freeze(Object.keys(SET_PIECE_KINDS));

const RANGES = Object.freeze({ height: [2, 20], pursuers: [0, 3], courses: [2, 10], face: [3, 14], trucks: [2, 8], cars: [2, 10], speed: [2, 25], drop: [3, 30], length: [10, 80], boulders: [0, 6] });

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
    out[k] = ['pursuers', 'courses', 'trucks', 'cars', 'boulders'].includes(k) ? Math.round(v) : v;
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
