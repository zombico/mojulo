/**
 * The 'forum' layout: the Forum Romanum on a summer day of 79 CE (../record/forum.js), a measured site plan, not a
 * generated one. Each monument stands at its place, size and facing from the record; the buildings come from
 * ../assets/forum.js and their repeated parts (columns, entablature runs, arcade bays) are gathered as `repeats`, one
 * template each, for the World page to draw as instances (a CSS page draws their light stand-ins).
 *
 * The frame: x runs down the square's long axis from the Tabularium (the real north-west) to the Regia (the real
 * south-east), y across it from the Basilica Aemilia's side (the real north-east) to the Basilica Julia's (the real
 * south-west). Positions are the record's sizes laid out against each other the way the plan stands, rounded, not
 * surveyed coordinates: an approximation the eyes gate should check against a plan. The ground is level (the square's
 * 1.4 m rise from Divus Julius to the Rostra is not drawn); the Capitoline and the Palatine stand round it on the
 * World page.
 */
import { localSize, orientBox } from '../assets/kit.js';
import { orientSolid } from '../assets/solids.js';
import { skinLoose } from '../layout-kit.js';
import { podiumTemple, roundTemple, basilica, openBasilica, tabularium, rostra, augustusArch, singleArch, curia, block, divusJulius, statueBase, figure, horseman, rostralColumn, ianusShrine, cloacina, puteal, juturna, tribunal, pavedLetters } from '../assets/forum.js';
import { GLYPH } from '../relief-art.js';
import { FORUM_RECORD } from '../record/forum.js';

const TURN = { n: 0, e: 1, s: 2, w: 3 };
const rec = (id) => FORUM_RECORD.find((e) => e.id === id);

export function planForum({ culture = 'forum', festival = false } = {}, K) {
  const P = K.palette, { w: Wf, d: Df } = K.site.frame;
  const boxes = [], grounds = [], worldBoxes = [], reps = new Map(), placed = [];
  // place a build in a world rect turned to `facing`, lifted `z`; its instances join the repeats
  const place = (id, build, rect, facing, { z = 0, world = false, record = id } = {}) => {
    const { W, D } = localSize(rect, facing), r = build({ W, D }), into = world ? worldBoxes : boxes;
    for (const b of r.boxes) {
      const o = { ...orientBox(b, rect, facing), ...orientSolid(b, facing, (rr) => orientBox(rr, rect, facing)), z0: b.z0 + z, z1: b.z1 + z, building: id };
      if (o.pts) o.pts = o.pts.map(([x, y, zz]) => [x, y, zz + z]);
      for (const k of ['a', 'b']) if (Array.isArray(o[k])) o[k] = [o[k][0], o[k][1], o[k][2] + z];
      into.push(o);
    }
    // a build's own floors (grounds), turned and lifted with it
    for (const g of r.grounds || []) grounds.push({ ...orientBox(g, rect, facing), z: g.z + z });
    for (const i of r.inst) {
      const p = orientBox({ x: i.x, y: i.y, w: 0, d: 0 }, rect, facing), turn = i.key.startsWith('col:') ? 0 : (i.turn + TURN[facing]) % 4;   // a column is the same from every side
      const key = i.turn === turn ? i.key : i.key.replace(/:\d$/, `:${turn}`);
      let e = reps.get(key);
      if (!e) {
        // a part turned by the building is rebuilt turned (its template is baked lit, so its turn is its own)
        const base = i.turn === turn ? i : { ...i, turn };
        const remake = (f) => () => { const ms = f(); return turn === i.turn ? ms : turnFrom(ms, i.turn, turn); };
        e = { key, make: remake(base.make), low: remake(base.low), transforms: [], world };
        reps.set(key, e);
      }
      e.transforms.push({ pos: [p.x, p.y, i.z + z] });
    }
    const R = record && rec(record);
    placed.push({ id, rect, facing, ...(R ? { record, state: R.state } : {}) });
    return r;
  };

  // ── the ground: the frame's earth, the square's travertine, the streets' basalt (one plane each, never overlapping) ──
  const SQ = { x: 68, y: 38, w: 122, d: 52 };
  grounds.push({ kind: 'ground', x: 0, y: 0, w: Wf, d: Df, z: 0.01, fill: P.ground, surface: 'mud' });
  grounds.push({ kind: 'square', ...SQ, z: 0.05, fill: P.square, surface: 'flagstone' });
  const streets = [
    { name: 'sacra-via', x: 64, y: 90, w: 136, d: 5.5 },
    { name: 'clivus-capitolinus', x: 12, y: 84, w: 52, d: 8 },
    { name: 'vicus-iugarius', x: 62, y: 95.5, w: 4, d: Df - 95.5 },
    { name: 'vicus-tuscus', x: 167, y: 95.5, w: 5, d: Df - 95.5 },
    { name: 'argiletum', x: 87.6, y: 0, w: 5.4, d: 27 },
  ];
  for (const s of streets) grounds.push({ kind: 'street', x: s.x, y: s.y, w: s.w, d: s.d, z: 0.05, fill: P.street, surface: 'flagstone' });
  // the Comitium's marble and the open plot where the Temple of Vespasian will stand (record: temple-vespasian, held from 80)
  grounds.push({ kind: 'comitium', x: 60, y: 27.2, w: 27.6, d: 10.8, z: 0.05, fill: P.luna, surface: 'flagstone' });
  grounds.push({ kind: 'court', x: 12, y: 72, w: 24, d: 12, z: 0.05, fill: P.court, surface: 'flagstone' });

  // ── the west end: the Tabularium, Concord, Saturn, the Rostra ──
  place('tabularium', (f) => tabularium(f, { P }), { x: 4, y: 10, w: 8, d: 73.6 }, 'e');
  const CO = rec('temple-concord').dims;
  // Concord: the wide cella on its podium against the Tabularium, the pronaos before it
  place('concord-cella', (f) => {
    const out = [{ kind: 'podium', x: 0, y: 0, w: f.W, d: f.D, z0: 0, z1: 3.5, tint: P.luna }];
    for (const m of block(f, { h: 14.5 + 2.6, tint: P.luna, P, door: false }).boxes) out.push({ ...m, z0: m.z0 + 3.5, z1: m.z1 + 3.5, ...(m.pts ? { pts: m.pts.map(([x, y, z]) => [x, y, z + 3.5]) } : {}), ...(m.a ? { a: [m.a[0], m.a[1], m.a[2] + 3.5], b: [m.b[0], m.b[1], m.b[2] + 3.5] } : {}) });
    return { boxes: out, inst: [] };
  }, { x: 12, y: 25, w: CO.cella.d, d: CO.cella.w }, 'e', { record: 'temple-concord' });
  place('concord-pronaos', (f) => podiumTemple(f, { ph: 3.5, order: 'corinthian', colD: CO.columns.D, colH: CO.columns.h, front: CO.columns.front, flank: 1, cella: false, festival, P }), { x: 36, y: 30.5, w: 18, d: CO.pronaos.w }, 'e', { record: 'temple-concord' });
  // Saturn: the record's 11 m column on the card's ten diameters (the 1.43 m diameter is the late porch's)
  const SA = rec('temple-saturn').dims;
  place('saturn', (f) => podiumTemple(f, { ph: SA.podium.h, order: 'corinthian', colD: SA.columns.h / 10, colH: SA.columns.h, front: SA.columns.front, flank: SA.columns.flank, dedication: 'bronze-letters', festival, P }), { x: 22, y: 92, w: SA.podium.d, d: SA.podium.w }, 'e', { record: 'temple-saturn' });
  const RO = rec('rostra-augusti').dims;
  place('rostra', (f) => rostra(f, { h: RO.h, P }), { x: 58, y: 52, w: RO.d, d: RO.w }, 'e', { record: 'rostra-augusti' });
  place('arch-tiberius', (f) => singleArch(f, { P }), { x: 57, y: 80, w: 6.3, d: 9 }, 'e');
  boxes.push({ kind: 'milliarium', solid: 'drum', x: 65.9, y: 78.4, w: 1.17, d: 1.17, z0: 0, z1: 3.6, tint: P.gilt, sides: 16, building: 'milliarium-aureum' });
  placed.push({ id: 'milliarium-aureum', rect: { x: 65.9, y: 78.4, w: 1.17, d: 1.17 }, facing: 'e', record: 'milliarium-aureum', state: rec('milliarium-aureum').state });

  // ── the long sides: the Curia, the Basilica Aemilia (north-east), the Basilica Julia (south-west) ──
  const CU = rec('curia-julia').dims;
  place('curia', (f) => curia(f, { P, h: CU.h }), { x: 70, y: 2, w: CU.w, d: CU.d }, 's', { record: 'curia-julia' });
  place('basilica-aemilia', (f) => basilica(f, { bays: 18, D: 0.95, aisle: 8, shops: true, frieze: 'doric-frieze', captives: true, festival, P }), { x: 93, y: 2, w: 90, d: 36 }, 's');
  const BJ = rec('basilica-julia').dims;
  // the Basilica Julia opened: walk in off the Sacra Via, up its steps, into the aisles and the coloured-marble nave
  place('basilica-julia', (f) => openBasilica(f, { bays: BJ.piers.long, ends: BJ.piers.short, D: 1.05, aisle: BJ.aisle, nave: BJ.nave, festival, P }), { x: 66, y: 96.5, w: BJ.w, d: BJ.d }, 'n', { z: 0.9 });

  // ── the south-east end: Castor, Divus Julius, the Arch of Augustus, the Regia, Vesta, the House of the Vestals ──
  const CA = rec('temple-castor').dims;
  place('castor', (f) => podiumTemple(f, { ph: CA.podium.h, tribunal: CA.tribunal, order: 'corinthian', colD: CA.columns.D, colH: CA.columns.h, front: CA.columns.front, peripteral: true, flankN: CA.columns.flank, festival, P }), { x: 172, y: 95.5, w: CA.podium.d, d: CA.podium.w }, 'w', { record: 'temple-castor' });
  place('divus-julius', (f) => divusJulius(f, { P, festival }), { x: 192, y: 50, w: 30, d: 27 }, 'w', { record: 'temple-divus-julius' });
  place('arch-augustus', (f) => augustusArch(f, { P }), { x: 200, y: 77.5, w: 3.6, d: 17.75 }, 'w');
  place('regia', (f) => block(f, { h: 7.5, tint: P.luna, P }), { x: 226, y: 70, w: 22, d: 8 }, 's');
  const VE = rec('temple-vesta').dims;
  place('vesta', (f) => roundTemple(f, { ph: VE.podium.h, n: VE.columns.n, colD: VE.columns.D, colH: VE.columns.D * 10, P }), { x: 224, y: 100, w: VE.diameter + 4, d: VE.diameter }, 'e', { record: 'temple-vesta' });
  place('atrium-vestae', (f) => block(f, { h: 9, tint: P.brick, P }), { x: 246, y: 92, w: 24, d: 38 }, 'w');

  // ── in the square (records in ../record/forum.js; Pliny's "still stands" anchors most): the Lacus Curtius with the
  // Curtius relief on its balustrade, the fig, the olive and the vine with Marsyas, the tribunal, Surdinus's letters ──
  const mark = (id, record, rect, ms) => { for (const m of ms) boxes.push({ ...m, building: id }); placed.push({ id, rect, facing: 'n', record, state: rec(record).state }); };
  const LC = { x: 99, y: 58, w: 10, d: 9 };
  mark('lacus-curtius', 'lacus-curtius', LC, [
    ...[[LC.x, LC.y, LC.w, 0.4], [LC.x, LC.y + LC.d - 0.4, LC.w, 0.4], [LC.x, LC.y, 0.4, LC.d], [LC.x + LC.w - 0.4, LC.y, 0.4, LC.d]].map(([x, y, w, d]) => ({ kind: 'kerb', x, y, w, d, z0: 0, z1: 1.25, tint: P.travertine })),
    ...puteal(LC.x + LC.w - 1.6, LC.y + LC.d - 1.6, P),
  ]);
  grounds.push({ kind: 'court', x: LC.x + 0.4, y: LC.y + 0.4, w: LC.w - 0.8, d: LC.d - 0.8, z: 0.08, fill: P.tufa });
  mark('curtius-relief', 'curtius-relief', { x: LC.x - 0.12, y: LC.y + 3.6, w: 0.12, d: 1.8 }, [{ kind: 'relief', solid: 'frustum', x: LC.x - 0.12, y: LC.y + 3.6, w: 0.12, d: 1.8, z0: 0.05, z1: 1.3, top: { x: LC.x - 0.12, y: LC.y + 3.6, w: 0.12, d: 1.8 }, tint: P.luna, skin: 'curtius-relief' }]);
  const FI = { x: 91, y: 66, w: 4, d: 4 };
  const fic = [];
  for (const [x, y, w, d] of [[FI.x, FI.y, FI.w, 0.3], [FI.x, FI.y + FI.d - 0.3, FI.w, 0.3], [FI.x, FI.y, 0.3, FI.d], [FI.x + FI.w - 0.3, FI.y, 0.3, FI.d]]) fic.push({ kind: 'kerb', x, y, w, d, z0: 0, z1: 0.35, tint: P.luna });
  for (const [cx, cy, h, r] of [[FI.x + 1.4, FI.y + 1.6, 5.5, 1.6], [FI.x + 2.8, FI.y + 3, 4.2, 1.3]]) {
    fic.push({ kind: 'trunk', solid: 'drum', x: cx - 0.15, y: cy - 0.15, w: 0.3, d: 0.3, z0: 0, z1: h * 0.55, tint: '#5b4a36', sides: 6 });
    fic.push({ kind: 'crown', solid: 'dome', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0: h * 0.45, z1: h, tint: P.fig, sides: 10 });
  }
  mark('ficus', 'ficus-olea-vitis', FI, [...fic, ...statueBase(FI.x + FI.w + 1.4, FI.y + 1.2, 1.2, 1.2, 1.4, P.luna), ...figure(FI.x + FI.w + 1.4, FI.y + 1.2, 1.4, 1.8, P.bronze, { dir: Math.PI / 2, raised: true })]);   // Marsyas, his wineskin on his shoulder
  grounds.push({ kind: 'court', x: FI.x + 0.3, y: FI.y + 0.3, w: FI.w - 0.6, d: FI.d - 0.6, z: 0.08, fill: P.ground, surface: 'mud' });
  mark('tribunal-praetoris', 'tribunal-praetoris', { x: 81, y: 44, w: 6, d: 4 }, tribunal(84, 46, P));
  mark('surdinus-inscription', 'surdinus-inscription', { x: 76, y: 53.5, w: 13, d: 0.4 }, pavedLetters('L·NAEVIVS·L·F·SVRDINVS·PR', 76, 53.5, 0.3, P, { glyphs: GLYPH }));

  // ── by the Rostra: Octavian's horseman on it, the Sibyls and the Hercules beside it, the rostral columns ──
  mark('octavian-equestrian', 'octavian-equestrian', { x: 61, y: 56, w: 3.2, d: 1.6, on: 'rostra' }, [...statueBase(62.6, 57, 3.2, 1.6, 2, P.luna).map((m) => ({ ...m, z0: m.z0 + RO.h, z1: m.z1 + RO.h })), ...horseman(62.6, 57, RO.h + 2, 1.25, P.bronze, { dir: Math.PI / 2 })]);
  mark('sibyls-hercules', 'sibyls-hercules', { x: 69.4, y: 43.4, w: 1.2, d: 6.2 }, [
    ...[44, 46.5, 49].flatMap((y) => [...statueBase(70, y, 1.1, 1.1, 1.5, P.luna), ...figure(70, y, 1.5, 1.85, P.bronze, { dir: Math.PI / 2 })]),
  ]);
  mark('hercules-tunicatus', 'sibyls-hercules', { x: 69.4, y: 78.9, w: 1.2, d: 1.2 }, [...statueBase(70, 79.5, 1.2, 1.2, 1.5, P.luna), ...figure(70, 79.5, 1.5, 2.1, P.bronze, { dir: Math.PI / 2 })]);
  mark('columna-duilius', 'columna-duilius', { x: 73.7, y: 45.7, w: 1.6, d: 1.6 }, rostralColumn(74.5, 46.5, { h: 8, D: 0.9, tint: P.luna, beakTint: P.bronze, P }));
  mark('columna-octavian', 'columna-octavian', { x: 73.7, y: 82.2, w: 1.6, d: 1.6 }, rostralColumn(74.5, 83, { h: 9, D: 0.95, tint: P.gilt, beakTint: P.gilt, statue: { h: 2.2, tint: P.gilt }, P }));

  // ── round the square's edges: Ianus Geminus at the Argiletum, Venus Cloacina, the Lapis Niger, Vortumnus, Caesar's statue, Juturna ──
  place('ianus-geminus', (f) => ianusShrine(f, { P }), { x: 88.4, y: 28, w: 3.6, d: 6.2 }, 's');
  mark('venus-cloacina', 'venus-cloacina', { x: 118.8, y: 40.3, w: 2.4, d: 2.4 }, cloacina(120, 41.5, P));
  grounds.push({ kind: 'lapis-edge', x: 76.2, y: 29.6, w: 5.2, d: 4.2, z: 0.07, fill: P.luna }, { kind: 'lapis-niger', x: 76.8, y: 30.2, w: 4, d: 3, z: 0.09, fill: P.black });
  placed.push({ id: 'lapis-niger', rect: { x: 76.2, y: 29.6, w: 5.2, d: 4.2 }, facing: 'n', record: 'lapis-niger', state: rec('lapis-niger').state });
  mark('vortumnus', 'vortumnus', { x: 168.9, y: 96.4, w: 1.2, d: 1.2 }, [...statueBase(169.5, 97, 1.2, 1.2, 1.2, P.travertine), ...figure(169.5, 97, 1.2, 1.9, P.bronze, { dir: -Math.PI / 2 })]);
  mark('caesar-loricata', 'caesar-loricata', { x: 186.3, y: 44.3, w: 1.4, d: 1.4 }, [...statueBase(187, 45, 1.4, 1.4, 1.8, P.luna), { kind: 'tablet', solid: 'frustum', x: 186.5, y: 45.7, w: 1, d: 0.04, z0: 0.5, z1: 1.3, top: { x: 186.5, y: 45.7, w: 1, d: 0.04 }, tint: P.bronze }, ...figure(187, 45, 1.8, 2.2, P.bronze, { dir: -Math.PI / 2, raised: true })]);
  place('juturna', (f) => juturna(f, { P }), { x: 206, y: 129, w: 10, d: 10 }, 'n', { record: 'juturna-dioscuri' });
  // Hercules and Mercury at the foot of Concord's stair
  mark('concord-statues', 'concord-statues', { x: 54.6, y: 30.6, w: 1.2, d: 34 }, [31.2, 63.8].flatMap((y) => [...statueBase(55.2, y, 1.2, 1.2, 1.6, P.luna), ...figure(55.2, y, 1.6, 2.2, P.bronze, { dir: Math.PI / 2 })]));

  // ── round it, for the World page: the Capitoline with the rebuilt Temple of Jupiter under its gilt-bronze tiles
  // (record: capitoline-jupiter, bronze), the Palatine, the Templum Pacis's wall ──
  const hill = 21;
  worldBoxes.push({ kind: 'hill', x: -110, y: -40, w: 114, d: 230, z0: 0, z1: hill, tint: P.rock });
  place('capitoline-jupiter', (f) => podiumTemple(f, { ph: 4, order: 'corinthian', colD: 2.1, colH: 21, front: 6, flank: 3, P, roofTint: P.gilt }), { x: -78, y: 95, w: 60, d: 55 }, 'e', { z: hill, world: true });
  worldBoxes.push({ kind: 'hill', solid: 'frustum', x: 150, y: Df + 2, w: 190, d: 150, z0: 0, z1: 34, top: { x: 165, y: Df + 30, w: 160, d: 110 }, tint: P.slope });
  worldBoxes.push({ kind: 'precinct-wall', x: 112, y: -150, w: 145, d: 4, z0: 0, z1: 18, tint: P.peperino });

  skinLoose(boxes, K);
  skinLoose(worldBoxes, K);
  const repeats = [...reps.values()].map((e) => ({ key: e.key, template: e.make(), low: e.low(), transforms: e.transforms, ...(e.world ? { world: true } : {}) }));

  // ── views, at eye height ──
  const views = {
    // from the foot of Divus Julius down the square to the Tabularium, Concord and Saturn
    forum: { eye: [186, 64, 1.7], at: [40, 62, 12] },
    // at the square's south-east corner, up at Castor's front and its tribunal
    castor: { eye: [138, 80, 1.7], at: [178, 111, 11] },
    // on the Sacra Via by the Basilica Julia, east to Castor, the arch and Divus Julius
    sacra: { eye: [112, 93, 1.7], at: [205, 84, 8] },
    // on the Rostra, over the square to Divus Julius
    rostra: { eye: [64, 64, 3 + 1.7], at: [190, 64, 6] },
    // in the square by the fig and Marsyas: the Lacus Curtius with its relief, the Rostra's statues behind
    lacus: { eye: [88, 61, 1.7], at: [104, 62, 1.2] },
    // under Divus Julius: its beaked platform, the frieze and the dedication
    julius: { eye: [170, 66, 1.7], at: [196, 63.5, 15] },
    // inside the Basilica Julia: down the nave over its coloured marble, the arcades and the clerestory
    basilica: { eye: [80, 120.5, 0.9 + 1.7], at: [150, 120.5, 9] },
    // in its front aisle by the steps, the gaming boards underfoot
    aisle: { eye: [100, 101.5, 0.9 + 1.7], at: [112, 104, 0.6] },
    // from the Capitoline's brow behind the Tabularium, over Concord's roof, down the forum
    capitol: { eye: [-6, 40, 40], at: [120, 66, 0] },
  };
  return {
    boxes, grounds, views, frame: { w: Wf, d: Df }, hAt: () => 0,
    repeats,
    world: { boxes: worldBoxes, skirt: { width: 160, cell: 20, fill: P.ground } },
    stats: {
      culture, precinct: SQ, square: SQ, streets,
      monuments: placed.map(({ id, rect, facing }) => ({ id, rect, facing })),
      states: Object.fromEntries(placed.filter((q) => q.record).map((q) => [q.record, q.state])),
      instances: repeats.reduce((n, r) => n + r.transforms.length, 0), templates: repeats.length,
    },
  };
}

/** Re-turn a part built at quarter turn `from` to `to` (both about its origin). */
function turnFrom(ms, from, to) {
  const k = ((to - from) % 4 + 4) % 4, tp = ([x, y]) => [[x, y], [-y, x], [-x, -y], [y, -x]][k];
  const tr = (r) => { const ps = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map(tp), xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) }; };
  return ms.map((m) => ({ ...m, ...tr(m), ...(m.top ? { top: tr(m.top) } : {}), ...(m.pts ? { pts: m.pts.map(([x, y, z]) => [...tp([x, y]), z]) } : {}), ...(m.out ? { out: [...tp([m.out[0], m.out[1]]), m.out[2]] } : {}), ...(m.a ? { a: [...tp([m.a[0], m.a[1]]), m.a[2]] } : {}), ...(m.b ? { b: [...tp([m.b[0], m.b[1]]), m.b[2]] } : {}) }));
}
