/**
 * THE PLAY LAYER — what LEVEL DESIGN places on a block of a planned map to make its walk interesting (the scene
 * composer kai's work: a department of its own, handed the cast, the scenario and the terrain the geocube built). Saved on
 * the level in PURE VECTOR SPACE: each piece a point in world metres and a yaw, so a terrain rebuilt under it never
 * loses a piece; a piece the new land no longer suits is flagged (`pieces-fit`), with the nearest spot that does, to be
 * dragged there.
 *
 *   play: { <segment>: { pieces: [piece], suggestions?: [suggestion] } }
 *   piece        { id, kind, at: [x, y, z], yaw?: degrees (0 faces +x, counter-clockwise), scale?, of?, beat?, why? }
 *     foe        `of` a bestiary id: one foe standing there, facing its yaw (LEVEL DESIGN casts: a block's placed foes
 *                stand in place of its encounter marks' rings, whatever kind the marks named)
 *     obstacle   `of` a shape of OBSTACLES (crate, barricade, log, wall, pillar, ledge, arch): built in the world's
 *                style (the kit's own wood and stone), solid
 *     cover      the same shapes, low: something to fight round
 *     pickup     `of` the item, found where it lies (into the bag)
 *     gate       `of` what opens it (an item, a power, a flag): a barrier across the way, solid until opened
 *     hazard     `of` a word (spikes, fire, drop): a marked danger, not solid
 *     marker     `of` a word: a thing seen from afar the walk steers by (a banner, a cairn), not solid
 *   suggestion   { from, say, authority: must | should | may, about?: { beat?, kind?, of? } }: another department's word to
 *                level design: a must is not overridden; a should is overridden only with a reason (`overrides`); a may
 *                is a hint. With `about`, a suggestion is kept when a piece of the block has every field it names
 *   overrides    [{ suggestion: <its index>, why }]: the shoulds the block overrides, each with its reason
 *
 *   readPlay(play, P, at?, { beats? })   → { <segment>: { pieces, suggestions } } (P: readPlan's or readGrid's plan); throws
 *   playBuild(pieces, { rock, wood })    → { faces, colliders }: the solid pieces in the world's colours, flat-shaded
 *   playLaws(pieces, { ground, box, colliders }) → [{ law, ok, value, drift? }]: `pieces-fit`
 *   settlePieces(pieces, ground) → the pieces with each z made the land's where it stands (the vertical drag: what a
 *                rebuilt land asks of every piece first)
 *   authorityLaws(block, { beats? }) → [{ law, ok, value }]: `suggestions-kept` (every must kept; every should kept or
 *                overridden with its reason) and `casting` (the foes the block stands against the scenario's for its
 *                beats: level design casts, unless a must says otherwise)
 * Pure.
 */
export const PIECE_KINDS = Object.freeze(['foe', 'obstacle', 'cover', 'pickup', 'gate', 'hazard', 'marker']);
// each shape: its box (m: along its yaw, across, up), its material (the kit's wood or stone), how many blocks it is
export const OBSTACLES = Object.freeze({
  crate: { size: [1.2, 1.2, 1.2], mat: 'wood' },
  barricade: { size: [3.2, 0.5, 1.3], mat: 'wood' },
  log: { size: [3.6, 0.7, 0.7], mat: 'wood' },
  wall: { size: [4, 0.7, 2.2], mat: 'rock' },
  pillar: { size: [0.9, 0.9, 3.2], mat: 'rock' },
  ledge: { size: [3, 2.2, 1.1], mat: 'rock' },
  arch: { size: [4, 0.8, 3.4], mat: 'rock', arch: true },
});
const COVER = 0.6;   // cover stands at this share of its shape's height
const SOLID = new Set(['obstacle', 'cover', 'gate']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`level: ${m}`);
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

/** The play layer read against its plan. */
export function readPlay(play, P, at = 'level.play', { beats = null } = {}) {
  if (play === undefined) return null;
  if (!isObj(play)) throw fail(`${at} is { <segment>: { pieces, suggestions? } }: what level design places on each block`);
  const segs = Object.keys(P.segments ?? P.at), out = {}, ids = new Set();
  for (const [S, v] of Object.entries(play)) {
    const w = `${at}.${S}`;
    if (!segs.includes(S)) throw fail(`${w}: no such block in the plan (${segs.join(', ')})`);
    if (!isObj(v)) throw fail(`${w} is { pieces, suggestions? }`);
    for (const k of Object.keys(v)) if (!['pieces', 'suggestions', 'overrides'].includes(k)) throw fail(`${w}.${k} is not a block's word (pieces, suggestions, overrides)`);
    const pieces = v.pieces ?? [];
    if (!Array.isArray(pieces)) throw fail(`${w}.pieces is [{ id, kind, at: [x, y, z], yaw?, scale?, of?, beat?, why? }]`);
    const suggestions = readSuggestions(v.suggestions, `${w}.suggestions`), overrides = v.overrides ?? [];
    if (!Array.isArray(overrides) || overrides.some((o) => !isObj(o) || !Number.isInteger(o.suggestion) || typeof o.why !== 'string' || !o.why.trim())) throw fail(`${w}.overrides is [{ suggestion: <its index>, why }]: a should overridden, and why`);
    for (const o of overrides) {
      const sg = suggestions[o.suggestion];
      if (!sg) throw fail(`${w}.overrides: no suggestion ${o.suggestion} (the block has ${suggestions.length})`);
      if (sg.authority === 'must') throw fail(`${w}.overrides: suggestion ${o.suggestion} is a must ('${sg.say}', from ${sg.from}): it is not overridden`);
    }
    out[S] = { pieces: pieces.map((p, i) => readPiece(p, `${w}.pieces[${i}]`, ids, beats, S)), suggestions, overrides: overrides.map((o) => ({ suggestion: o.suggestion, why: o.why })) };
  }
  return out;
}

function readPiece(p, w, ids, beats, S) {
  const KEYS = ['id', 'kind', 'at', 'yaw', 'scale', 'of', 'beat', 'why'];
  if (!isObj(p)) throw fail(`${w} is { id, kind, at, yaw?, scale?, of?, beat?, why? }`);
  for (const k of Object.keys(p)) if (!KEYS.includes(k)) throw fail(`${w}.${k} is not a piece's word (${KEYS.join(', ')})`);
  if (typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) throw fail(`${w}.id is a name (lower case, digits, hyphens)`);
  if (ids.has(p.id)) throw fail(`${w}.id '${p.id}' is another piece's`);
  ids.add(p.id);
  if (!PIECE_KINDS.includes(p.kind)) throw fail(`${w}.kind is ${PIECE_KINDS.join(', ')}`);
  if (!Array.isArray(p.at) || p.at.length !== 3 || !p.at.every(Number.isFinite)) throw fail(`${w}.at is [x, y, z] in world metres`);
  if (p.yaw !== undefined && !Number.isFinite(p.yaw)) throw fail(`${w}.yaw is degrees (0 faces +x, counter-clockwise)`);
  if (p.scale !== undefined && !(Number.isFinite(p.scale) && p.scale >= 0.25 && p.scale <= 4)) throw fail(`${w}.scale is 0.25 to 4`);
  if ((p.kind === 'obstacle' || p.kind === 'cover') && !OBSTACLES[p.of]) throw fail(`${w}.of is a shape: ${Object.keys(OBSTACLES).join(', ')}`);
  if (['foe', 'pickup', 'gate', 'hazard', 'marker'].includes(p.kind) && (typeof p.of !== 'string' || !p.of)) throw fail(`${w}.of: a ${p.kind} names ${p.kind === 'foe' ? 'its bestiary id' : p.kind === 'pickup' ? 'its item' : p.kind === 'gate' ? 'what opens it' : 'what it is'}`);
  if (p.beat !== undefined && beats && !beats.some((b) => b.id === p.beat && b.at === S)) throw fail(`${w}.beat '${p.beat}' is no beat of block ${S}`);
  if (p.why !== undefined && typeof p.why !== 'string') throw fail(`${w}.why is words`);
  return { id: p.id, kind: p.kind, at: p.at.map(r3), yaw: p.yaw ?? 0, ...(p.scale !== undefined ? { scale: p.scale } : {}), ...(p.of !== undefined ? { of: p.of } : {}), ...(p.beat !== undefined ? { beat: p.beat } : {}), ...(p.why !== undefined ? { why: p.why } : {}), segment: S };
}

export const AUTHORITY = Object.freeze(['must', 'should', 'may']);
function readSuggestions(v, w) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw fail(`${w} is [{ from, say, authority: must | should | may, about? }]`);
  return v.map((s, i) => {
    if (!isObj(s) || typeof s.from !== 'string' || typeof s.say !== 'string') throw fail(`${w}[${i}] is { from, say, authority, about? }: who suggests, what`);
    if (!AUTHORITY.includes(s.authority)) throw fail(`${w}[${i}].authority is must (not overridable), should (overridable with a reason) or may (a hint)`);
    if (s.about !== undefined && !isObj(s.about)) throw fail(`${w}[${i}].about is { beat?, kind?, of? }`);
    return { from: s.from, say: s.say, authority: s.authority, ...(s.about ? { about: { ...s.about } } : {}) };
  });
}

// (a box's corners about its foot, turned by its yaw: [along, across, up])
function boxAt(at, yaw, size) {
  const c = Math.cos(yaw), s = Math.sin(yaw), [L, W, H] = size;
  const pt = (u, v, z) => [r3(at[0] + u * c - v * s), r3(at[1] + u * s + v * c), r3(at[2] + z)];
  const u = [-L / 2, L / 2], v = [-W / 2, W / 2];
  return { pt, u, v, H };
}
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * k)))); return `#${ch.map((x) => x.toString(16).padStart(2, '0')).join('')}`; };

/** The solid pieces as faces and colliders, in the world's colours (`rock`, `wood`: the kit's own fills). */
export function playBuild(pieces, { rock = '#8e8a80', wood = '#7a5a3a' } = {}) {
  const faces = [], colliders = [];
  for (const p of pieces) {
    if (!SOLID.has(p.kind) && p.kind !== 'marker' && p.kind !== 'hazard') continue;
    const O = p.kind === 'gate' ? OBSTACLES.barricade : p.kind === 'marker' ? OBSTACLES.pillar : p.kind === 'hazard' ? { size: [2, 2, 0.15], mat: 'rock' } : OBSTACLES[p.of];
    const k = p.scale ?? 1, size = [O.size[0] * k, O.size[1] * k, O.size[2] * k * (p.kind === 'cover' ? COVER : 1)];
    const fill = p.kind === 'hazard' ? '#a8402a' : p.kind === 'marker' ? '#c9a24a' : O.mat === 'wood' ? wood : rock, yaw = (p.yaw * Math.PI) / 180;
    const parts = O.arch ? [[-0.5, -0.32, 1], [0.32, 0.5, 1], [-0.5, 0.5, 0.25, 0.75]] : [[-0.5, 0.5, 1]];
    for (const [a, b, hk, z0k = 0] of parts) {
      const B = boxAt(p.at, yaw, size), u0 = size[0] * a, u1 = size[0] * b, z0 = size[2] * z0k, z1 = size[2] * (z0k + hk);
      const P = (u, v, z) => B.pt(u, v, z), v0 = B.v[0], v1 = B.v[1];
      const quad = (cs, n, kk) => faces.push({ corners: cs, normal: n, group: `play:${p.kind}`, fill: shade(fill, kk) });
      const c = Math.cos(yaw), s = Math.sin(yaw);
      quad([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], [0, 0, 1], 1.08);
      quad([P(u0, v0, z0), P(u0, v1, z0), P(u1, v1, z0), P(u1, v0, z0)], [0, 0, -1], 0.6);
      quad([P(u0, v0, z0), P(u1, v0, z0), P(u1, v0, z1), P(u0, v0, z1)], [r3(s), r3(-c), 0], 0.82);
      quad([P(u1, v1, z0), P(u0, v1, z0), P(u0, v1, z1), P(u1, v1, z1)], [r3(-s), r3(c), 0], 0.9);
      quad([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], [r3(c), r3(s), 0], 0.96);
      quad([P(u0, v1, z0), P(u0, v0, z0), P(u0, v0, z1), P(u0, v1, z1)], [r3(-c), r3(-s), 0], 0.74);
      if (SOLID.has(p.kind)) {
        const cs = [P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), P(u0, v1, z0)];
        colliders.push({ min: [Math.min(...cs.map((q) => q[0])), Math.min(...cs.map((q) => q[1])), r3(p.at[2] + z0 - 0.3)], max: [Math.max(...cs.map((q) => q[0])), Math.max(...cs.map((q) => q[1])), r3(p.at[2] + z1)], of: `play:${p.id}` });
      }
    }
  }
  return { faces, colliders };
}

/** Whether each piece still fits the land under it: on it, in its block, out of anything solid; the nearest spot that
 * does for one that drifted. `ground(x, y)` the land's height, `box` [x0, y0, x1, y1] the block's, `colliders` the rest. */
export function playLaws(pieces, { ground, box = null, colliders = [] }) {
  const inside = (x, y) => colliders.some((c) => x >= c.min[0] && x <= c.max[0] && y >= c.min[1] && y <= c.max[1] && !/^play:/.test(c.of ?? ''));
  const inBox = (x, y) => !box || (x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]);
  const drift = [];
  for (const p of pieces) {
    const [x, y, z] = p.at, g = ground(x, y), why = [];
    // (settled onto the land when built: a land that moved more than a step under it may no longer suit it)
    if (Math.abs(z - g) > 1.5) why.push(`${r3(z - g)} m off the land`);
    if (!inBox(x, y)) why.push('outside its block');
    if (inside(x, y)) why.push('inside something solid');
    if (!why.length) continue;
    // (the nearest spot that fits: its own ground first, else a ring outward)
    let to = null;
    for (let r = 0; r <= 12 && !to; r += 1.5) for (let a = 0; a < 16 && !to; a++) {
      const qx = x + (r ? r * Math.cos((a * Math.PI) / 8) : 0), qy = y + (r ? r * Math.sin((a * Math.PI) / 8) : 0);
      if (inBox(qx, qy) && !inside(qx, qy)) to = [r3(qx), r3(qy), r3(ground(qx, qy))];
      if (!r) break;
    }
    drift.push({ id: p.id, why: why.join(', '), ...(to ? { to } : {}) });
  }
  return [{ law: 'pieces-fit', ok: !drift.length, value: drift.length ? `${drift.length} piece${drift.length === 1 ? '' : 's'} to drag: ${drift.map((d) => `${d.id} (${d.why}${d.to ? `; fits at ${d.to.join(', ')}` : ''})`).join('; ')}` : `every one of ${pieces.length} piece${pieces.length === 1 ? '' : 's'} on the land, in its block`, ...(drift.length ? { drift } : {}) }];
}

/** A block's suggestions kept or overridden, and its casting against the scenario's (level design casts, a must aside). */
export function authorityLaws(block, { beats = null, segment = null } = {}) {
  const P = block.pieces, kept = (sg) => !sg.about || P.some((p) => Object.entries(sg.about).every(([k, v]) => p[k] === v));
  const over = new Map(block.overrides.map((o) => [o.suggestion, o.why])), missed = [], reasons = [];
  block.suggestions.forEach((sg, i) => {
    if (kept(sg)) return;
    if (sg.authority === 'must') missed.push(`a must from ${sg.from} is not kept: '${sg.say}'`);
    else if (sg.authority === 'should') { if (over.has(i)) reasons.push(`'${sg.say}' (${sg.from}) overridden: ${over.get(i)}`); else missed.push(`a should from ${sg.from} is neither kept nor overridden with a reason: '${sg.say}'`); }
  });
  const unchecked = block.suggestions.filter((sg) => !sg.about).length;
  const laws = [{ law: 'suggestions-kept', ok: !missed.length, value: missed.length ? missed.join('; ') : `${block.suggestions.length} suggestion${block.suggestions.length === 1 ? '' : 's'}: every must kept${reasons.length ? `; ${reasons.join('; ')}` : ''}${unchecked ? ` (${unchecked} said in words only: the creator's to read)` : ''}` }];
  // (the casting: the foes it stands against the ones the scenario's beats on the block named)
  const scen = (beats ?? []).filter((b) => b.at === segment && b.foes), stood = {};
  for (const p of P) if (p.kind === 'foe') stood[p.of] = (stood[p.of] ?? 0) + 1;
  if (scen.length && Object.keys(stood).length) {
    const asked = {}; for (const b of scen) for (const [k, n] of Object.entries(b.foes)) asked[k] = (asked[k] ?? 0) + n;
    const same = JSON.stringify(Object.entries(asked).sort()) === JSON.stringify(Object.entries(stood).sort());
    const say = (o) => Object.entries(o).map(([k, n]) => `${n} ${k}`).join(', ');
    const forbidden = block.suggestions.some((sg) => sg.authority === 'must' && sg.about?.kind === 'foe' && !kept(sg));
    laws.push({ law: 'casting', ok: !forbidden, value: same ? `the block stands the scenario's foes (${say(stood)})` : `level design recast the block: ${say(stood)} where the scenario named ${say(asked)}` });
  }
  return laws;
}

/** Each piece settled onto the land where it stands: its z the land's (the vertical drag). */
export function settlePieces(pieces, ground) {
  return pieces.map((p) => ({ ...p, at: [p.at[0], p.at[1], r3(ground(p.at[0], p.at[1]))] }));
}
