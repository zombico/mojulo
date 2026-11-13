/**
 * SKANDART'S VESSELS — what a room kept and left, standing in groups against its walls where they were stored (a kit's
 * card's `vessels`, or its use's: era/skandart-derive.js USES). A card names ROLES (a crate, a barrel, a keg, a chest, a
 * basket, a pot, an urn, a jar) and the room's LOOK says what form each takes, so a crypt keeps wooden crates and clay
 * urns and a military bay steel drums and footlockers, never a cooper's barrel:
 *
 *   old         wood and clay: crates, barrels, kegs, chests, baskets, pots, urns, jars (a room of stone, render, brick)
 *   industrial  painted steel: steel crates on skids, drums, footlockers (a room of metal or concrete)
 *   clean       moulded plastic: totes, plastic drums, hard cases (a room of board: a lab, an office)
 *
 * The look the card names (`look`), else read off what the room's walls are made of (era/skandart-derive.js
 * matterOfTile). Every surface a flat colour, no grain: a vessel reads by its shape and its colour, never by a texture
 * that pulls the eye. They are a room's leavings like its heaps (era/skandart.js), so the room's amount says how they were
 * left: the further gone, the more lie tipped on their sides and the more are already broken where they stood (a clay
 * one's lower part with its sherds about it, a wooden one's planks; steel and plastic do not break where they stand: they
 * lie tipped). Each standing or tipped vessel is one THING (a solid doodad of its own, its faces named, its matter its
 * form's), so a game that lets objects break (playscape/destruct/breakability.js: `destruction`, objects and up) breaks
 * it like any crate or pot, and under `physical` a steel drum dents and a pot shatters. A group takes a bay in a heap's
 * place (skandartStamps, before the wall's heap rhythm). A standing crate may carry another (VESSELS.stack), each its own
 * thing: break the one under, and the top comes down.
 *
 *   VESSELS                                      the numbers: the roles, the forms, the looks
 *   vesselLook(kit, card)                        the look a room's vessels take
 *   readVessels(v)                               a card's `vessels` checked: { kinds: { role: weight }, every?, look? }
 *   skandartVessels(plan, bays, { amount, read, seed, card }) → { faces, anchors, laws, readout }
 *     bays    [{ x, y, len, N, U, out }]: each bay's middle at the wall's foot, its length, the wall's normal into the
 *             room and along it, how far out of the wall the floor begins (its plinth)
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { P, r5 } from './geom.js';
import { buildProp, propSurfaces } from './props.js';
import { debrisPiece } from './debris-shelf.js';
import { skandartRead } from './skandart.js';
import { matterOfTile } from './skandart-derive.js';

const F = Object.freeze;
export const VESSELS = F({
  roles: F(['crate', 'barrel', 'keg', 'chest', 'basket', 'pot', 'urn', 'jar']),
  // each look: the form each role takes, and the colours its forms come in (a form's `body`, its `trim` a shade darker)
  looks: F({
    old: F({ forms: F({ crate: 'crate', barrel: 'barrel', keg: 'keg', chest: 'chest', basket: 'basket', pot: 'pot', urn: 'urn', jar: 'jar' }) }),
    industrial: F({ forms: F({ crate: 'steel-crate', barrel: 'drum', keg: 'drum', chest: 'footlocker', basket: 'steel-crate', pot: 'drum', urn: 'drum', jar: 'drum' }),
      colours: F({ drum: F([F([0.32, 0.36, 0.22]), F([0.42, 0.44, 0.46]), F([0.17, 0.24, 0.38]), F([0.5, 0.16, 0.1])]), 'steel-crate': F([F([0.33, 0.36, 0.23]), F([0.4, 0.42, 0.44])]), footlocker: F([F([0.3, 0.33, 0.21]), F([0.2, 0.22, 0.26])]) }) }),
    clean: F({ forms: F({ crate: 'tote', barrel: 'plastic-drum', keg: 'tote', chest: 'case', basket: 'tote', pot: 'plastic-drum', urn: 'plastic-drum', jar: 'plastic-drum' }),
      colours: F({ 'plastic-drum': F([F([0.15, 0.33, 0.62]), F([0.82, 0.82, 0.8])]), tote: F([F([0.55, 0.57, 0.6]), F([0.2, 0.38, 0.62]), F([0.75, 0.75, 0.72])]), case: F([F([0.11, 0.11, 0.12]), F([0.6, 0.6, 0.62])]) }) }),
  }),
  // each form: its half breadth on the floor (m), the thing it is to the breakables, its matter when not its class's,
  // and what it breaks to where it stands (none: it lies tipped instead) with that piece's size range (m) and colour
  forms: F({
    pot: F({ r: 0.22, cls: 'pot', breaks: 'sherd', size: F([0.12, 0.24]), tint: F([0.62, 0.42, 0.3]) }),
    urn: F({ r: 0.25, cls: 'urn', breaks: 'sherd', size: F([0.14, 0.26]), tint: F([0.46, 0.34, 0.28]) }),
    jar: F({ r: 0.21, cls: 'amphora', breaks: 'sherd', size: F([0.12, 0.24]), tint: F([0.62, 0.42, 0.3]) }),
    crate: F({ r: 0.38, cls: 'crate', breaks: 'plank', size: F([0.35, 0.7]), tint: F([0.5, 0.4, 0.3]) }),
    barrel: F({ r: 0.33, cls: 'barrel', breaks: 'plank', size: F([0.3, 0.6]), tint: F([0.38, 0.3, 0.23]) }),
    chest: F({ r: 0.44, cls: 'chest', breaks: 'plank', size: F([0.3, 0.6]), tint: F([0.33, 0.26, 0.2]) }),
    keg: F({ r: 0.21, cls: 'barrel', breaks: 'plank', size: F([0.22, 0.4]), tint: F([0.38, 0.3, 0.23]) }),
    basket: F({ r: 0.26, cls: 'basket', breaks: 'splinter', size: F([0.15, 0.3]), tint: F([0.62, 0.5, 0.32]) }),
    'steel-crate': F({ r: 0.38, cls: 'crate', matter: F({ matter: 'sheet-metal', fill: 0.02 }) }),
    drum: F({ r: 0.32, cls: 'barrel', matter: F({ matter: 'sheet-metal', fill: 0.02 }) }),
    footlocker: F({ r: 0.46, cls: 'chest', matter: F({ matter: 'sheet-metal', fill: 0.03 }) }),
    tote: F({ r: 0.33, cls: 'crate', matter: F({ matter: 'plastic', fill: 0.04 }) }),
    'plastic-drum': F({ r: 0.33, cls: 'barrel', matter: F({ matter: 'plastic', fill: 0.04 }) }),
    case: F({ r: 0.44, cls: 'chest', matter: F({ matter: 'plastic', fill: 0.05 }) }),
  }),
  // the old look's wood, flat: a crate's boards, a barrel's or a chest's darker staves
  wood: F({ light: F([0.52, 0.42, 0.31]), dark: F([0.36, 0.28, 0.21]) }),
  // what stacks on what stands: a crate on a crate (each its own thing: the top falls when the one under it breaks), the
  // share of standing crates that carry one (by role: a steel crate or a tote stacks as a crate does)
  stack: F({ crate: 0.45 }),
  // a wall's bays that hold a group (one in `every`), the group's size, the gap between two vessels (m)
  every: 3, group: F([2, 4]), gap: 0.08,
  // the share tipped at the amount's ends, and the share already broken (from `from` of the amount, at most `most`)
  tipped: F([0.1, 0.6]), broken: F({ from: 0.35, most: 0.6 }), pieces: F([7, 11]),
  // a broken clay vessel's lower part left standing (of its height)
  rest: F([0.25, 0.5]),
});
/** A form → the thing it is to the breakables (a jar is an amphora; a drum a barrel; a footlocker or a case a chest). */
export const CLASS_OF = F(Object.fromEntries(Object.entries(VESSELS.forms).map(([k, f]) => [k, f.cls])));

const mix = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const flat = (tint) => ({ key: null, scale: 1, tint: [...tint], group: 'stage:prop' });

/** The look a room's vessels take: the card's, else what its walls are made of (metal or concrete industrial, board
 *  clean, anything else old). */
export function vesselLook(kit, card) {
  if (card?.look) return card.look;
  const T = kit?.tiles || {}, ms = [T.wall, T.wallUpper, T.upper].map(matterOfTile).filter(Boolean);
  if (ms.some((m) => m === 'metal' || m === 'concrete')) return 'industrial';
  if (ms.some((m) => m === 'board' || m === 'glass')) return 'clean';
  return 'old';
}

export function readVessels(v, at = 'skandart.vessels') {
  if (v === undefined || v === null || v === false) return null;
  const roles = VESSELS.roles.join(' | ');
  if (typeof v !== 'object' || Array.isArray(v) || !v.kinds || typeof v.kinds !== 'object') throw new Error(`stage: ${at} is { kinds: { <${roles}>: how many of each, by share }, every?, look? }`);
  for (const [k, n] of Object.entries(v.kinds)) {
    if (!VESSELS.roles.includes(k)) throw new Error(`stage: ${at}.kinds: '${k}' is no vessel (${VESSELS.roles.join(', ')}; the room's look gives each its form)`);
    if (!(typeof n === 'number' && n > 0)) throw new Error(`stage: ${at}.kinds.${k} is how many, by share: a number over 0`);
  }
  if (v.every !== undefined && !(Number.isInteger(v.every) && v.every >= 1)) throw new Error(`stage: ${at}.every is one bay in so many holding a group: a whole number, 1 or more`);
  if (v.look !== undefined && !VESSELS.looks[v.look]) throw new Error(`stage: ${at}.look is ${Object.keys(VESSELS.looks).join(', ')} (absent: read off the room's walls)`);
  return { kinds: v.kinds, every: v.every ?? VESSELS.every, ...(v.look ? { look: v.look } : {}) };
}

/** Turn `pts` about the axis `ax` (unit, through `o`) by `a` (Rodrigues). */
const turn = (p, o, ax, a) => {
  const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]], c = Math.cos(a), s = Math.sin(a), d = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2];
  const cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]];
  return [0, 1, 2].map((k) => o[k] + v[k] * c + cr[k] * s + ax[k] * d * (1 - c));
};

export function skandartVessels(plan, bays, { amount, read = skandartRead(), seed = 1, card }) {
  const A = VESSELS, V = readVessels(card), faces = [], anchors = [], laws = [], count = {};
  if (!V) return { faces, anchors, laws };
  const look = vesselLook(plan.kit, V), L = A.looks[look];
  // (the surfaces: the old look's wood flat, its stone the kit's; a modern form its colour off its look's palette)
  const S0 = { ...propSurfaces(plan.kit.dress?.props ?? {}), wood: flat(A.wood.light), dark: flat(A.wood.dark) };
  const surfaces = (form, d) => {
    const C = L.colours?.[form]; if (!C) return S0;
    const body = C[Math.floor(d * C.length) % C.length];
    return { ...S0, body: flat(body), trim: flat(body.map((v) => v * 0.68)) };
  };
  const roles = Object.entries(V.kinds), total = roles.reduce((a, [, n]) => a + n, 0);
  const pick = (d) => { let acc = 0; for (const [k, n] of roles) { acc += n / total; if (d < acc) return k; } return roles[roles.length - 1][0]; };
  const tipShare = mix(A.tipped[0], A.tipped[1], amount), breakShare = Math.min(A.broken.most, Math.max(0, (amount - A.broken.from) / (1 - A.broken.from)) * A.broken.most);
  let standing = 0, tipped = 0, broken = 0, stacked = 0;
  bays.forEach((b, bi) => {
    const h = (q) => hash3(seed, bi, 7601 + q), n = A.group[0] + Math.floor(h(1) * (A.group[1] - A.group[0] + 1));
    // (its roles by their shares: the dice fed scrambled whole numbers, so neighbouring bays and places draw apart)
    const group = Array.from({ length: n }, (_, k) => pick(hash3(seed * 7919 + bi * 104729 + k * 1009, k * 31 + 7, 7611)));
    // (along the bay, side by side, the group centred in it; as many as fit)
    const widths = group.map((role) => 2 * A.forms[L.forms[role]].r + A.gap);
    while (widths.reduce((a, w) => a + w, 0) > b.len && group.length > 1) { group.pop(); widths.pop(); }
    let u = -widths.reduce((a, w) => a + w, 0) / 2;
    group.forEach((role, k) => {
      const form = L.forms[role], K = A.forms[form], g = (q) => hash3(seed * 13 + bi, k, 7621 + q), uc = u + widths[k] / 2;
      u += widths[k];
      const p = P([b.x + b.U[0] * uc + b.N[0] * b.out, b.y + b.U[1] * uc + b.N[1] * b.out, 0]), sd = Math.round(g(9) * 1e6), S = surfaces(form, g(11));
      // (a form that does not break where it stands lies tipped instead)
      const state = g(1) < breakShare ? (K.breaks ? 'broken' : 'tipped') : g(2) < tipShare ? 'tipped' : 'standing';
      if (state === 'broken') {
        // (broken where it stood: a clay one's lower part still standing, open at the break, its pieces about its foot,
        // none under the eye spot)
        if (K.breaks === 'sherd') { const rest = []; buildProp(form, rest, p, b.N, b.U, 0, sd, { ...S, cut: mix(A.rest[0], A.rest[1], g(7)) }); for (const f of rest) faces.push({ ...f, group: 'stage:prop', doubleSided: true }); }
        const m = Math.round(mix(A.pieces[0], A.pieces[1], g(3)));
        for (let j = 0; j < m; j++) {
          const w = mix(K.size[0], K.size[1], hash3(sd, j, 7631)); if (w < read.least) continue;
          const a = hash3(sd, j, 7633) * 2 * Math.PI, r = K.r * mix(0.2, 1.6, hash3(sd, j, 7635)), at = add(add(p, mul(b.N, K.r)), [Math.cos(a) * r, Math.sin(a) * r, 0]);
          for (const f of debrisPiece(K.breaks, w, sd * 31 + j).faces) faces.push({ corners: f.corners.map((c) => P(add(at, c))), normal: f.normal, outNormal: f.normal, tint: K.tint, group: 'stage:prop', doubleSided: true });
        }
        broken++;
        return;
      }
      const id = `${role}-sk-${(count[role] = (count[role] || 0) + 1)}`, mine = [];
      buildProp(form, mine, p, b.N, b.U, 0, sd, S);
      let out = mine;
      if (state === 'tipped') {
        // (on its side, fallen away from the wall: turned about the level line across its fall, at its foot, then let
        // down to rest on the floor)
        const t = unit(add(mul(b.N, 0.6 + 0.4 * g(4)), mul(b.U, (g(5) - 0.5) * 1.6))), ax = unit([-t[1], t[0], 0]), o = add(p, mul(b.N, K.r));
        const a = (Math.PI / 2) * mix(0.82, 0.97, g(6));
        out = mine.map((f) => ({ ...f, corners: f.corners.map((c) => turn(c, o, ax, a)), normal: turn(f.normal, [0, 0, 0], ax, a), outNormal: turn(f.outNormal ?? f.normal, [0, 0, 0], ax, a) }));
        const low = Math.min(...out.flatMap((f) => f.corners.map((c) => c[2])));
        out = out.map((f) => ({ ...f, corners: f.corners.map((c) => P([c[0], c[1], c[2] - low])), normal: f.normal.map(r5), outNormal: f.outNormal.map(r5) }));
        tipped++;
      } else standing++;
      const thing = (tid, at, more = {}) => ({ id: tid, kind: 'doodad', form: K.cls, vessel: role, shape: form, at, N: P(b.N), solid: true, ...(K.matter ? K.matter : {}), ...more });
      for (const f of out) faces.push({ ...f, group: 'stage:prop-doodad', doubleSided: true, node: id });
      anchors.push(thing(id, p, state === 'tipped' ? { tipped: true } : {}));
      // (a STACK: a standing crate carries another on its lid, the top its own thing resting on it)
      if (state === 'standing' && A.stack[role] && g(8) < A.stack[role]) {
        const lid = Math.max(...out.flatMap((f) => f.corners.map((c) => c[2]))), top = [], tid = `${role}-sk-${(count[role] = (count[role] || 0) + 1)}`, pt = P([p[0], p[1], lid]);
        // (no bigger than the one under it: its breadth that one's height, less a little)
        buildProp(form, top, pt, b.N, b.U, 0, sd + 1, { ...S, size: r5((lid - p[2]) * mix(0.72, 0.94, g(10))) });
        for (const f of top) faces.push({ ...f, group: 'stage:prop-doodad', doubleSided: true, node: tid });
        anchors.push(thing(tid, pt, { on: id }));
        stacked++;
      }
    });
  });
  // the laws: none floating, none sunk through the floor
  const low = faces.length ? Math.min(...faces.flatMap((f) => f.corners.map((c) => c[2]))) : 0;
  laws.push({ law: 'on-the-floor', what: `the vessels' lowest point ${r5(low)} m`, ok: low >= -0.02 });
  laws.push({ law: 'placed', what: `${standing} standing (${stacked} with another on it), ${tipped} tipped, ${broken} broken`, ok: standing + tipped + broken > 0 || !bays.length });
  return { faces, anchors, laws, readout: { look, standing, tipped, broken, ...(stacked ? { stacked } : {}) } };
}
