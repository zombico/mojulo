/**
 * THE ANCHOR STRUCTURE — a town's style language is not a template: it is DECOMPILED from one structure. Its ELEMENTS
 * come first (era/out-anchor-elements.js: the wall and its bond, the cap, the light, the door, the socle, cornice,
 * sills, lintels, quoins, the ornaments, and the street: road, footway, kerb, lamp, post, boundaries), each a set of rules
 * that says what a street holds and what a house may vary. The anchor is then COMPOSED from them as a CITIZEN, the
 * ordinary house at full effort, standing in its slice of street; composed, it is black and white and in PIECES (a
 * mass, a cap on it, openings in a rhythm, an entry, ornaments and details, an annex or tiers, each a piece of a small
 * generic vocabulary carrying only a value and a surface group). Reading it gives the LANGUAGE:
 *
 *   vocabulary   which mass, cap, opening, entry and ornaments, whether it annexes or tiers
 *   proportions  normalised so they rescale: cap pitch or rise, plan aspect, eave, the reach (span) the anchor shows,
 *                openings at a lived storey, ornament counts and sizes, annex scale, tier shrink
 *   values       each role's value and group (the paint colours them, never this)
 *   depths       which pieces a building speaks at which depth: 0 masses and caps, 1 openings and the entry, 2
 *                ornaments, the socle, the cornice and the bond, 3 the fine (frames, shutters, sills, lintels, quoins)
 *   holds        what the street holds (storey height, pitch, eave, the head line, the bond) and what a house may
 *                move (a bay, a light, a rise), and the share of households that carry an optional element
 *   street       the section the citizen stands in, by the route's rank
 *
 * Every building in the town is the language SPOKEN on its own lot and programme (era/out-structures.js keeps the
 * uses, the laws of scale and the eye spot): the plan from the lot and the anchor's reach, storeys from the need, the
 * anchor's cap at the anchor's pitch, its openings in its rhythm, its ornaments at its counts, households varying
 * inside what the street holds. Every other use is a PROMOTION of the citizen: a shop over a counter, a hall that takes
 * the accent and stands over the street, a tower that dares height. It is FRACTAL: what a building cannot hold is the language spoken again, smaller and a depth
 * shallower (an annex), or stacked on itself (tiers); the ring prunes the tree (a far building is depth 0), and the eye
 * spot gates every piece. The anchor itself is the language spoken as the use it is the archetype of, on its own
 * lot at full depth, and the round-trip law checks the decompile was faithful. One anchor, one town; another anchor, another town, with no new code.
 *
 *   ANCHOR_STRUCTURES        three authored anchors (element sets, composed): a timber house, a shell, a tiered house
 *   seedAnchor(seed)         elements drawn by a number, composed: a town style from a number
 *   decompileAnchor(anchor)  → the language
 *   speak(lang, use, lot, style, seed, opts)   → a building (the shape designTown places)
 *
 * Pure; seeded dice only; values only.
 */
import { STRUCTURE_USES, STRUCTURE_USE_IDS, STRUCTURE_RINGS, STRUCTURE_RING_IDS, STRUCTURE_LAWS, COVERINGS, eyeSpot, geometry as G } from './out-structures.js';
import { ELEMENT_SETS, seedElements, composeAnchor, deriveSecondary, build as EB, OPENING_WORDS, ENTRY_WORDS } from './out-anchor-elements.js';
import { lightDress, doorDress, shutterDress } from './out-openings.js';
const pickOf = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

const { face, roof, wallOf, wallQuad, wallPoly, SIDES, shellAt, shellFaces, lens, disc, point, basis, add3, sub, unit, dice, subSeed, r3, clamp, within } = G;

// ── the vocabulary ──────────────────────────────────────────────────────────────────────────────────────────────────
export const PIECE_KINDS = Object.freeze({
  mass: { block: 'walls on a rectangle, storey on storey', drum: 'a round tower of wall', shell: 'a spheroid shell: wall and roof in one' },
  cap: { gable: 'two slopes to a ridge', hip: 'four slopes to a ridge', pyramid: 'four slopes to a point', dome: 'a half spheroid over the walls', cone: 'a cone over a round', flat: 'a flat roof behind a parapet' },
  opening: { rect: 'a square-headed light', arch: 'a round-headed light', round: 'a round light, flush', lens: 'a round light that bulges: a small dome set in' },
  entry: { door: 'a door in the front wall', tunnel: 'an arched way out of a curved mass, the door at its mouth' },
  ornament: { point: 'pointed finials, one or a radial set', chimney: 'a hearth\'s stack through the cap', rib: 'vertical ribs or pilasters', band: 'a horizontal band at each storey', frame: 'timber members over the upper walls', shutters: 'a pair beside each square light', socle: 'a plinth band at the foot', cornice: 'a proud band under the eave', sill: 'a ledge under each light', lintel: 'a beam or a keystone over each light', quoins: 'dressed stones at the corners' },
  relation: { annex: 'the language spoken again behind, smaller, a depth shallower', tiers: 'the language stacked on itself, each storey a smaller tier with its own cap' },
});
/** What can stand on what: the grammar's compatibilities, and the depth each piece is spoken at. */
export const CAPS_FOR = Object.freeze({ block: ['gable', 'hip', 'pyramid', 'flat', 'dome'], drum: ['cone', 'dome', 'flat'], shell: [null] });
export const DEPTHS = Object.freeze({ mass: 0, cap: 0, annex: 0, tiers: 0, courses: 1, opening: 1, entry: 1, point: 2, chimney: 2, rib: 2, band: 2, socle: 2, cornice: 2, bond: 2, frame: 3, shutters: 3, rim: 3, sill: 3, lintel: 3, quoins: 3 });
const PITCHED = new Set(['gable', 'hip', 'pyramid']);
const COVER_OF = (group) => (group || '').replace('str:', '');

// ── three anchors: element sets, composed (era/out-anchor-elements.js) ──────────────────────────────────────────
export const ANCHOR_STRUCTURES = ELEMENT_SETS;
export const ANCHOR_IDS = Object.freeze(Object.keys(ANCHOR_STRUCTURES));

/** An anchor from a number: its elements drawn first, each constraining the next, then the composition they allow. */
export const seedAnchor = (seed = 1) => seedElements(seed);

// ── decompile ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The secondary's language: derived from the anchor's elements by the contrast rules (era/out-anchor-elements.js
 *  SECONDARY_RULES), decompiled like any anchor; compact in plan. Null for an anchor given only as pieces. */
export function secondaryOf(L) {
  const S2 = deriveSecondary(L.anchor);
  if (!S2) return null;
  return { ...decompileAnchor(S2, `${L.id} · secondary`), role: 'secondary', compact: true, of: L.id };
}

/** Read an anchor's pieces into its language. Refuses an anchor the grammar does not allow, saying why. */
export function decompileAnchor(anchor, id = null) {
  const raw = typeof anchor === 'string' ? ANCHOR_STRUCTURES[anchor] : anchor;
  if (!raw) throw new Error(`anchor: '${anchor}' is not an anchor structure (${ANCHOR_IDS.join(', ')}), nor { elements, compose } or { pieces }`);
  const A = composeAnchor(raw);
  const by = (role) => A.pieces.filter((p) => p.role === role), one = (role) => by(role)[0];
  const M = one('mass'), C = one('cap'), O = one('opening'), E = one('entry'), N = one('annex');
  if (!M || !PIECE_KINDS.mass[M.kind]) throw new Error(`anchor: a mass is ${Object.keys(PIECE_KINDS.mass).join(', ')} (got ${M?.kind})`);
  if (!CAPS_FOR[M.kind].includes(C?.kind ?? null)) throw new Error(`anchor: a ${M.kind} carries ${CAPS_FOR[M.kind].map((c) => c ?? 'no cap').join(', ')} (got ${C?.kind ?? 'no cap'})`);
  if (!O || !PIECE_KINDS.opening[O.kind]) throw new Error(`anchor: a light is ${Object.keys(PIECE_KINDS.opening).join(', ')}`);
  if (!E || (M.kind !== 'block' && E.kind !== 'tunnel')) throw new Error('anchor: a curved mass is entered by a tunnel (it has no flat wall for a door)');
  for (const p of by('ornament')) if (!PIECE_KINDS.ornament[p.kind]) throw new Error(`anchor: '${p.kind}' is not an ornament (${Object.keys(PIECE_KINDS.ornament).join(', ')})`);
  for (const p of by('ornament')) if (['sill', 'lintel', 'quoins', 'shutters', 'frame'].includes(p.kind) && M.kind !== 'block') throw new Error(`anchor: ${p.kind} need a flat wall; a ${M.kind} has none`);
  const least = Math.min(M.w, M.d), orn = Object.fromEntries(by('ornament').map((p) => [p.kind, p]));
  return {
    id: id ?? (typeof anchor === 'string' ? anchor : raw.id ?? (A.seeded ? `seeded-${A.seeded}` : 'anchor')), read: A.read, anchor: A, use: A.use, storeys: A.storeys,
    vocab: { mass: M.kind, cap: C?.kind ?? null, capEvery: !!C?.every, opening: O.kind, entry: E.kind, entryShape: E.shape, ornaments: Object.keys(orn), annex: N?.kind ?? null, tiers: !!M.tiers },
    proportions: {
      aspect: r3(Math.max(M.w, M.d) / least), reach: r3(least * 1.15), storeyH: A.storeyH,
      pitch: C && PITCHED.has(C.kind) ? C.pitch : null, rise: M.kind === 'shell' ? M.rise : C?.rise ?? null, eave: C ? r3(C.eave / least) : 0,
      opening: { w: O.w, h: O.h, sill: O.sill ?? 0.85, by: O.rhythm.by, bay: O.rhythm.bay ?? null, count: O.rhythm.count ?? null, ...pickOf(O, OPENING_WORDS) },
      entry: { w: E.w, h: E.h, ...pickOf(E, ENTRY_WORDS) }, annexScale: N?.scale ?? null, tierShrink: M.tiers?.shrink ?? null,
      point: orn.point ? { count: orn.point.count, len: orn.point.len, base: orn.point.base } : null,
      rib: orn.rib ? { count: orn.rib.count, w: orn.rib.w } : null, band: orn.band ? { w: orn.band.w } : null,
      chimney: orn.chimney ? { w: orn.chimney.w } : null, frame: orn.frame ? { member: orn.frame.member } : null,
      socle: orn.socle ? { h: orn.socle.h } : null, cornice: orn.cornice ? { h: orn.cornice.h, proud: orn.cornice.proud } : null,
      sill: orn.sill ? { h: orn.sill.h, over: orn.sill.over } : null, lintel: orn.lintel ? { h: orn.lintel.h, form: orn.lintel.form } : null,
      quoins: orn.quoins ? { w: orn.quoins.w, course: orn.quoins.course } : null,
      ...(orn.shutters?.form ? { shutters: { form: orn.shutters.form } } : {}),
    },
    values: { storeys: M.storeys, cap: C ? { group: C.group, value: C.value } : null, opening: { group: O.group, value: O.value }, ornaments: Object.fromEntries(Object.entries(orn).map(([k, p]) => [k, { group: p.group, value: p.value }])) },
    courses: !!C?.courses, depths: DEPTHS, variation: 0.1, holds: A.holds, street: A.street, bonds: A.bonds, elements: A.elements, compose: A.compose ?? null,
  };
}

// ── speak ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const LEVEL = { near: { lon: 16, lat: 6, arc: 5, sides: 8 }, mid: { lon: 10, lat: 4, arc: 3, sides: 6 }, far: { lon: 6, lat: 2, arc: 1, sides: 4 } };

/** The anchor's own laws, beside the uses' laws of scale (STRUCTURE_LAWS: storey, door, one-leads, value-order,
 *  eye-spot, budget, programme). */
export const ANCHOR_LAWS = Object.freeze([
  { id: 'speaks-the-anchor', want: 'every piece built is in the anchor\'s vocabulary', why: 'one language: a town reads as one place because nothing in it is foreign', test: (m) => m.foreign.length === 0, show: (m) => (m.foreign.length ? m.foreign.join(', ') : `${m.used.length} kinds, all the anchor's`) },
  { id: 'reach', want: 'no mass wider across its short side than the anchor reaches', why: 'the anchor shows how far its construction spans; past that a building breaks into an annex', test: (m) => m.spans.every((s) => s <= m.reach + 1e-9), show: (m) => `${Math.max(...m.spans)} of ${m.reach}` },
  { id: 'sheds', want: 'a pitched cap at least as steep as its covering sheds', why: 'a roof sheds what falls on it', test: (m) => m.pitch === null || m.pitch >= m.pitchMin - 1e-9, show: (m) => (m.pitch === null ? 'no pitched cap' : `${m.pitch}° ≥ ${m.pitchMin}°`) },
  { id: 'rise', want: 'a shell rises inside the anchor\'s rise (× 0.7–1.35; a tower to 3.4 × its radius)', why: 'the anchor\'s silhouette, at any size', test: (m) => m.rise === null || within(m.rise, m.riseRail), show: (m) => (m.rise === null ? 'no shell' : `${m.rise} in ${m.riseRail.join('–')}`) },
  { id: 'rhythm', want: 'lights in the anchor\'s rhythm: bays of 2.2–3.6 m, or one to four to a band (a focus rings them)', why: 'the rhythm is the language\'s; a building that breaks it speaks another', test: (m) => (m.by === 'bays' ? within(m.bay, [2.2, 3.6]) || m.bays === 1 : m.focus ? m.lights >= 5 : within(m.lights, [1, 4])), show: (m) => (m.by === 'bays' ? `${m.bays} × ${m.bay}` : `${m.lights} lights`) },
  { id: 'ornament-even', want: 'radial ornaments at the anchor\'s count, evenly round', why: 'an ornament is counted: three points are three, a third of a turn apart', test: (m) => m.points === 0 || m.points === m.pointCount, show: (m) => (m.points ? `${m.points} of ${m.pointCount}` : 'not at this depth') },
]);
const SCALE_LAWS = ['storey', 'door', 'one-leads', 'value-order', 'eye-spot', 'budget', 'programme'];

/**
 * A building: the language spoken on a lot for a use, read at a ring. `depth` defaults from the ring and the use's
 * interest (a focus, a landmark or the accent at 3; near 3, mid 2, far 0). `band` [lo, hi] is the town's heartbeat
 * here: a citizen's storeys inside it (a shell as far as its rise allows). Returns the shape the town places.
 */
export function speak(L, use, lot, style, seed = 1, { ring = 'near', corner = false, accent = false, crown = 0, over = {}, depth = null, band = null } = {}) {
  const U = STRUCTURE_USES[use];
  if (!U) throw new Error(`structures: '${use}' is not a use (${STRUCTURE_USE_IDS.join(', ')})`);
  if (!STRUCTURE_RINGS[ring]) throw new Error(`structures: '${ring}' is not a ring (${STRUCTURE_RING_IDS.join(', ')})`);
  if (!(lot?.w > 0 && lot?.d > 0)) throw new Error('structures: a lot is { w, d } in metres');
  if (lot.w < U.lot.w - 1e-9 || lot.d < U.lot.d - 1e-9) throw new Error(`structures: a ${use} needs a lot of at least ${U.lot.w} × ${U.lot.d} m (got ${lot.w} × ${lot.d})`);
  const V = L.vocab, P = L.proportions, VA = L.values, D = dice(subSeed(seed, `speak:${L.id}:${use}`)), ch = style.tokens.chunk, eye = eyeSpot(ring), why = [], parts = [], used = new Set();
  const X = (k, rail) => (over[k] ?? D.roll(rail));
  // households vary inside the language: what the street holds does not move; what a house may move moves no further
  // than its element allows; an optional element is carried by its share of households
  const H = L.holds, held = (k) => H.street.includes(k);
  const vary = (k, v) => (over[k] ?? (held(k) ? v : r3(v * (1 + (D.R() * 2 - 1) * (H.house[k] ?? L.variation)))));
  const has = (kind) => V.ornaments.includes(kind) && (over.full || H.share[kind] === undefined || D.R() < H.share[kind]);
  const citizen = use === 'dwelling' || use === 'shop';
  // the ring sets the depth; a thing that matters (a focus, a landmark, the accent) speaks one deeper, never past 3
  const dep = depth ?? Math.min(3, { near: 3, mid: 2, far: 0 }[ring] + (U.focus || U.dare || accent ? 1 : 0));
  const at = (kind) => dep >= (L.depths[kind] ?? 2);
  const gate = (name, span, fallback) => {
    const built = span >= eye - 1e-9 ? 'geometry' : fallback, row = parts.find((p) => p.part === name && p.built === built);
    if (row) { row.span = r3(Math.min(row.span, span)); row.n++; } else parts.push({ part: name, span: r3(span), built, n: 1 });
    return built === 'geometry';
  };
  const Lv = LEVEL[ring], faces = [], tile = [];
  // a household may mirror its plan: door bay, lights and annex to the other hand
  const mirror = D.R() < 0.5 ? -1 : 1;
  let dared = false;
  const tag = (from, fromT, mass, group, kind) => { for (let i = from; i < faces.length; i++) { faces[i].mass ??= mass; faces[i].group ??= group(faces[i]); } for (let i = fromT; i < tile.length; i++) { tile[i].mass ??= mass; tile[i].group ??= group(tile[i]); } if (kind) used.add(kind); };
  const round = V.mass !== 'block', tw = use === 'tower';

  // ── the plot ──
  const front = r3(U.focus ? X('front', [2.4, 3.6]) : X('front', tw ? [0.6, 1.1] : [0.8, 2.4]));
  const side = r3(round ? Math.min(X('side', [0.5, 1.2]), lot.w * 0.08) : lot.w >= 9 ? X('side', [0.6, 1.4]) : 0);
  const rear = r3(X('rear', tw ? [0.5, 1] : [1.5, 3]));
  const bw = r3(lot.w - 2 * side), bd = r3(lot.d - front - rear), need = tw ? 0 : r3(X('area', U.area));
  // a citizen's storey is the anchor's: the street holds it, so its eaves and its lights' heads line up
  let storeyH = r3(over.storeyH ?? (citizen && held('storeyH') ? clamp(P.storeyH, U.storeyH[0], U.storeyH[1]) : D.roll(U.storeyH)));
  const reach = P.reach;
  if (!round && side === 0) why.push(`frontage ${lot.w} m < 9: wall to wall, the side walls party walls`);

  // ── the plan: the short side within the anchor's reach, in the anchor's aspect ──
  let W0, D0, axis = 'x';
  // (a fortified town's keep is given its plan: the fort's scale, not the anchor's reach, binds it)
  if (tw) { W0 = D0 = r3(Math.min(over.plan ?? X('side', U.side) * (round ? 1.15 : 1), bw, bd, over.plan ? Infinity : reach)); }
  // a compact language (the secondary) stands square and upright, as wide as its reach allows
  else if (L.compact) { W0 = D0 = r3(Math.min(bw, bd, reach)); axis = 'y'; }
  else if (round) { const asp = Math.max(1.05, Math.min(1.3, P.aspect)); W0 = Math.min(bw, reach); D0 = r3(Math.min(bd, reach, W0 * asp)); W0 = r3(Math.min(W0, D0 * asp)); axis = 'y'; }
  else if (U.focus || U.gableEnd) { W0 = r3(Math.min(bw, reach)); D0 = r3(clamp(need / W0, Math.min(W0 * 1.2, bd), bd)); axis = 'y'; }
  else if (bw <= reach) { W0 = bw; D0 = r3(clamp(need / (W0 * U.storeys[0]), Math.min(W0 * 1.05, bd), bd)); axis = D0 >= W0 ? 'y' : 'x'; }
  else { D0 = r3(Math.min(bd, reach)); W0 = r3(clamp(need / (D0 * U.storeys[0]), Math.min(bw, D0 * P.aspect), bw)); axis = W0 >= D0 ? 'x' : 'y'; }
  const least = Math.min(W0, D0);
  why.push(`a ${V.mass} ${W0} × ${D0} m on a ${bw} × ${bd} m plot (the anchor reaches ${reach} m)`);

  // ── storeys: as few as hold the programme; tiers shrink; a shell rises with them inside the anchor's rise ──
  const shrink = V.tiers ? vary('shrink', P.tierShrink) : 1, riseC = P.rise ? vary('rise', P.rise) : null;
  const riseRail = tw ? [2.2, 3.4] : riseC ? [r3(P.rise * 0.7), r3(P.rise * 1.35)] : null;
  const hShell = (n) => r3(Math.min(riseRail[1] * least / 2, Math.max(riseRail[0] * least / 2, Math.max(riseC * least / 2, n * storeyH + 1.2))));
  const floorOf = (n) => {
    if (V.mass === 'shell') { const h = hShell(n); return r3(Array.from({ length: n }, (_, i) => (Math.PI / 4) * W0 * D0 * Math.max(0, 1 - ((i + 0.5) * storeyH / h) ** 2)).reduce((a, b) => a + b, 0)); }
    const k = V.mass === 'drum' ? Math.PI / 4 : 1;
    return r3(Array.from({ length: n }, (_, i) => k * W0 * D0 * shrink ** (2 * i)).reduce((a, b) => a + b, 0));
  };
  let n = tw ? X('storeys', U.storeys) : U.storeys[0];
  while (!tw && n < U.storeys[1] && floorOf(n) < 0.85 * need && (V.mass !== 'shell' || (n + 1) * storeyH + 0.6 <= riseRail[1] * least / 2)) n++;
  // the heartbeat: the town's height here, which a citizen keeps to (a shell as high as its rise lets it)
  let bandCapped = false;
  if (band && citizen) {
    if (V.mass === 'shell') { while (n < band[0] && (n + 1) * storeyH + 0.6 <= riseRail[1] * least / 2) n++; bandCapped = n < band[0]; } else n = Math.max(n, band[0]);
    n = Math.min(n, band[1]);
    why.push(`the heartbeat here: ${band[0] === band[1] ? band[0] : `${band[0]}–${band[1]}`} storey${band[1] > 1 ? 's' : ''}${bandCapped ? ' (the shell\'s rise holds it lower)' : ''}`);
  }
  if (corner && V.mass !== 'shell' && !U.focus && use !== 'barn') { n += 1; why.push('on a corner: rises a storey'); }
  let h = V.mass === 'shell' ? hShell(n) : r3(n * storeyH);
  if (corner && V.mass === 'shell') { h = r3(Math.min(riseRail[1] * least / 2, h * 1.15)); why.push('on a corner: rises (the shell 15 % taller)'); }
  if (V.mass === 'shell' && tw) { while (n < U.storeys[1] && (n + 1) * storeyH + 1.2 <= h) n++; }
  if (crown && V.mass === 'shell' && h < crown) { h = r3(Math.min(riseRail[1] * least / 2, crown)); why.push(`dares height: rises ${h} m over the street's ${r3(crown)}`); }
  let floor = floorOf(n);
  why.push(`${n} storey${n > 1 ? 's' : ''} of ${storeyH} m${V.tiers ? `, each tier ${shrink} of the one under it` : ''}`);

  // ── the masses ──
  const stGroup = (i) => VA.storeys[Math.min(i, VA.storeys.length - 1)];
  const capV = VA.cap, masses = [], pitchMin = capV && PITCHED.has(V.cap) ? COVERINGS[COVER_OF(capV.group)]?.min ?? 25 : null;
  let pitch = V.cap && PITCHED.has(V.cap) ? r3(Math.max(pitchMin, vary('pitch', P.pitch) + (U.focus ? 6 : 0))) : null;
  const eave = r3(Math.max(0.3, vary('eave', P.eave * least)));
  let capK = V.cap === 'dome' || V.cap === 'cone' ? vary('capRise', P.rise ?? 0.8) : null;
  // dare height: a focus asked to crown over the street takes a taller storey inside its use's rail, then a steeper cap
  if (crown && V.mass !== 'shell') {
    const topLeast = least * (V.tiers ? shrink ** (n - 1) : 1), capRise = () => (pitch !== null ? (topLeast / 2) * Math.tan((pitch * Math.PI) / 180) : capK !== null ? capK * (topLeast / 2) : V.cap === 'flat' ? 0.7 : 0);
    while (n * storeyH + capRise() < crown) {
      // a tower climbs by storeys first, as many as its use allows
      if (tw && n < U.storeys[1]) n += 1;
      else if (storeyH < U.storeyH[1] - 1e-9) storeyH = r3(Math.min(U.storeyH[1], storeyH + 0.1));
      else if (pitch !== null && pitch < 60) pitch = r3(pitch + 1);
      else if (capK !== null && capK < (P.rise ?? 0.8) * 1.35) capK = r3(capK + 0.05);
      // a focus whose cap cannot rise further rises a tier: its own language once more, smaller, on top
      else if (!dared) { dared = true; n += 1; }
      else break;
    }
    h = r3(n * storeyH);
    why.push(`dares height: crowns ${r3(n * storeyH + capRise())} m over the street's ${r3(crown)}${dared ? ' (a tier more: the language once more, on top)' : ''}`);
  }
  const laid = L.courses && at('courses') ? { out: tile, course: (COVERINGS[COVER_OF(capV?.group)]?.course ?? 0) * ch, cap: (COVERINGS[COVER_OF(capV?.group)]?.cap ?? 0.2) * ch, capGeo: false } : null;
  if (laid) laid.capGeo = gate('ridge cap', laid.cap, 'tile');
  let ridge = 0, eaveZ = 0, S0 = null, ST = null;
  const capOn = (rect, z, m, last) => {
    const t0 = faces.length, u0 = tile.length, w = rect[2] - rect[0], d = rect[3] - rect[1], c = [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2];
    if (!V.cap) return z;
    let top = z;
    if (PITCHED.has(V.cap)) {
      const form = V.cap === 'pyramid' || (V.cap === 'hip' && Math.max(w, d) / Math.min(w, d) < 1.05) ? (V.cap === 'gable' ? 'gable' : V.cap === 'hip' ? 'hip' : 'pyramid') : V.cap;
      const R = roof(faces, rect, z, { form, axis: w >= d ? 'x' : 'y', e: eave, p: pitch, mat: capV.group, value: capV.value, gableMat: stGroup(n - 1).group, gableValue: stGroup(n - 1).value, courses: laid });
      top = R.ridge;
    } else if (V.cap === 'dome' || V.cap === 'cone') {
      const rx = w / 2 + eave * 0.4, ry = d / 2 + eave * 0.4, rise = capK * Math.min(rx, ry);
      if (V.cap === 'dome') shellFaces(faces, shellAt(c, rx, ry, rise, z), { lon: Lv.lon, lat: Math.max(2, Lv.lat - 2) }, 'roof', capV.value);
      else { const k = Lv.lon, P0 = (j) => [c[0] + rx * Math.cos((2 * Math.PI * j) / k), c[1] + ry * Math.sin((2 * Math.PI * j) / k), z], apex = [c[0], c[1], z + rise]; for (let j = 0; j < k; j++) face(faces, [P0(j), P0(j + 1), apex], [Math.cos((2 * Math.PI * (j + 0.5)) / k), Math.sin((2 * Math.PI * (j + 0.5)) / k), 0.5], 'roof', capV.value); }
      top = r3(z + rise);
    } else if (V.cap === 'flat') {
      const par = 0.7;
      for (const s of Object.keys(SIDES)) { const W = wallOf(rect, s); wallQuad(faces, W, 0, W.len, z, z + par, 0, 'wall', capV.value); }
      face(faces, [[rect[0], rect[1], z + 0.05], [rect[2], rect[1], z + 0.05], [rect[2], rect[3], z + 0.05], [rect[0], rect[3], z + 0.05]], [0, 0, 1], 'roof', Math.max(0.1, capV.value - 0.1));
      top = r3(z + par);
    }
    tag(t0, u0, m, (f) => (f.part === 'wall' && !f.mat?.startsWith('str:') ? capV.group : f.part === 'wall' ? f.mat : capV.group), V.cap);
    return top;
  };
  // at depth 0 a mass is one envelope: its walls one band to the eave, its lower storeys' materials marks in its tile
  const envelope = dep === 0 || ring === 'far';
  const block = (rect, z0, i, m, z1 = z0 + storeyH) => { const t0 = faces.length, u0 = tile.length; for (const s of Object.keys(SIDES)) { const W = wallOf(rect, s); wallQuad(faces, W, 0, W.len, z0, z1, 0, 'wall', stGroup(i).value); if (envelope && stGroup(0).group !== stGroup(i).group && (s === 'front' || s === 'right')) wallQuad(tile, W, 0, W.len, 0, storeyH, 0.01, 'wall', stGroup(0).value, { tile: true, group: stGroup(0).group }); } tag(t0, u0, m, () => stGroup(i).group, 'block'); };
  const drum = (c, rx, ry, z0, z1, i, m) => { const t0 = faces.length, k = Lv.lon, P0 = (j, z) => [c[0] + rx * Math.cos((2 * Math.PI * j) / k), c[1] + ry * Math.sin((2 * Math.PI * j) / k), z]; for (let j = 0; j < k; j++) face(faces, [P0(j, z0), P0(j + 1, z0), P0(j + 1, z1), P0(j, z1)], [Math.cos((2 * Math.PI * (j + 0.5)) / k), Math.sin((2 * Math.PI * (j + 0.5)) / k), 0], 'wall', stGroup(i).value); tag(t0, tile.length, m, () => stGroup(i).group, 'drum'); };
  const rect0 = [0, 0, W0, D0], rects = [];
  if (V.mass === 'block') {
    for (let i = 0; i < n; i++) {
      if (envelope && !V.tiers && !dared) { for (let j = 0; j < n; j++) rects.push(rect0); block(rect0, 0, n - 1, 'main', r3(n * storeyH)); break; }
      const s = V.tiers ? shrink ** i : dared && i === n - 1 ? 0.72 : 1, rc = V.tiers || (dared && i === n - 1) ? [r3((W0 * (1 - s)) / 2), r3((D0 * (1 - s)) / 2), r3(W0 - (W0 * (1 - s)) / 2), r3(D0 - (D0 * (1 - s)) / 2)] : rect0;
      rects.push(rc);
      block(rc, r3(i * storeyH), i, V.tiers || dared ? `tier-${i}` : 'main');
      // each tier's own cap is spoken from depth 1: at depth 0 the stack is read by its crowning cap alone
      if ((V.tiers && V.capEvery && i < n - 1 && dep >= 1) || (dared && i === n - 2)) capOn(rc, r3((i + 1) * storeyH), `tier-${i}`, false);
    }
    eaveZ = r3(n * storeyH);
    ridge = capOn(rects[n - 1], eaveZ, V.tiers || dared ? `tier-${n - 1}` : 'main', true);
    if (V.tiers) used.add('tiers');
    if (dared && !V.tiers) used.add(V.mass);
  } else if (V.mass === 'drum') {
    if (envelope && !dared) { for (let j = 0; j < n; j++) rects.push(rect0); drum([W0 / 2, D0 / 2], W0 / 2, D0 / 2, 0, r3(n * storeyH), n - 1, 'main'); }
    else for (let i = 0; i < n; i++) { const k = dared && i === n - 1 ? 0.72 : 1; rects.push(k < 1 ? [r3(W0 * 0.14), r3(D0 * 0.14), r3(W0 * 0.86), r3(D0 * 0.86)] : rect0); drum([W0 / 2, D0 / 2], (W0 / 2) * k, (D0 / 2) * k, r3(i * storeyH), r3((i + 1) * storeyH), i, k < 1 ? 'tier' : 'main'); if (dared && i === n - 2) capOn(rect0, r3((i + 1) * storeyH), 'main', false); }
    eaveZ = r3(n * storeyH); ridge = capOn(rect0, eaveZ, 'main', true);
  } else {
    rects.push(rect0);
    S0 = shellAt([W0 / 2, D0 / 2], W0 / 2, D0 / 2, h, 0);
    const t0 = faces.length; shellFaces(faces, S0, Lv, 'shell', stGroup(0).value); tag(t0, tile.length, 'main', () => stGroup(0).group, 'shell');
    eaveZ = r3(n * storeyH); ridge = h;
    // a focus its rise cannot carry high enough: the language once more, a smaller shell set on its crown
    if (crown && h < crown) {
      const rt = r3(least * 0.22), zt = r3(h * 0.86), ht = r3(Math.min(rt * 1.6 * (P.rise ?? 1), Math.max(rt, crown - zt)));
      ST = shellAt([W0 / 2, D0 / 2], rt, rt, ht, zt);
      const t1 = faces.length; shellFaces(faces, ST, { lon: Math.max(6, Lv.lon - 6), lat: Math.max(2, Lv.lat - 2) }, 'shell', stGroup(0).value); tag(t1, tile.length, 'tier', () => stGroup(0).group, 'shell');
      ridge = r3(zt + ht); dared = true; why.push(`dares height: a smaller shell on its crown, crowning ${ridge} m (the language once more)`);
    }
  }
  masses.push({ id: 'main', rect: rect0, n, storeyH, eave: ridge });

  // ── the annex: the language spoken again, smaller and a depth shallower ──
  let underRidge = Infinity;
  const deficit = r3(need - floor), rest = r3(bd - D0);
  if (V.annex && !tw && deficit > 4 && rest >= 2.4 && dep >= 1) {
    const sc = vary('annexScale', P.annexScale), aw = r3(Math.min(W0 * sc, least - (pitch ? 1.2 / Math.tan((pitch * Math.PI) / 180) : 1))), ad = r3(Math.min(rest + (round ? aw * 0.3 : 0), Math.max(3, deficit / Math.max(1, aw * Math.max(1, n - 1)))));
    if (aw >= 3 && ad >= 2.4) {
      const left = D.R() < 0.5, x0 = left ? 0 : r3(W0 - aw), arect = round ? [r3(W0 / 2 + (left ? -1 : 1) * (W0 / 2 - aw * 0.45) - aw / 2), r3(D0 - aw * 0.3), 0, 0] : [x0, D0, r3(x0 + aw), r3(D0 + ad)];
      if (round) { arect[2] = r3(arect[0] + aw); arect[3] = r3(arect[1] + aw); }
      const sub = speakMass(L, arect, Math.max(1, n - 1), storeyH, Lv, dep - 1, round, stGroup, capV, pitch, eave, laid, faces, tile, used, at, r3(ridge - 0.6));
      floor = r3(floor + sub.floor); underRidge = r3(ridge - sub.ridge);
      masses.push({ id: 'annex', rect: arect, n: sub.n, storeyH, eave: sub.ridge });
      why.push(`${deficit} m² short: the language again behind, ${r3(sc * 100)} % its size (an annex, a depth shallower)`);
    }
  }

  // ── openings: the anchor's light in the anchor's rhythm; the entry the mass needs ──
  const doorW = r3(X('doorW', U.door.w)), doorH = r3(X('doorH', U.door.h));
  const OP = P.opening, oh = (hh) => r3(Math.min(storeyH - 1.1, hh * Math.max(1, storeyH / L.proportions.storeyH) * (U.focus ? 1.25 : 1)));
  const shape = (kind, uc, z0, w, hh) => {
    const u0 = uc - w / 2, u1 = uc + w / 2, z1 = z0 + hh;
    if (kind === 'arch' || kind === 'door-arch') return [[u0, z0], [u1, z0], [u1, z1 - w / 2], ...Array.from({ length: Lv.arc }, (_, k) => { const a = (Math.PI * (k + 1)) / (Lv.arc + 1); return [uc + (w / 2) * Math.cos(a), z1 - w / 2 + (w / 2) * Math.sin(a)]; }), [u0, z1 - w / 2]];
    return [[u0, z0], [u1, z0], [u1, z1], [u0, z1]];
  };
  const openings = [], openOn = [];
  let bays = 0, bay = 0, lights = 0;
  const party = !round && side === 0 ? ['left', 'right'] : [];
  const shut = has('shutters'), DV = VA.ornaments, flatLight = V.opening === 'rect' || V.opening === 'arch';
  // (the openings as architecture: only where the language writes them, so a language without them speaks as it did)
  const dressedLight = OP.frame !== undefined || OP.glazing !== undefined, dressedDoor = ENTRY_WORDS.some((k) => P.entry[k] !== undefined), offLane = new Set();
  if (at('opening') || dep === 0) {
    // at depth 0 there is no entry piece: its door is a mark in the tile
    const t0 = faces.length, u0t = tile.length, geo = at('opening');
    if (!round) {
      bay = vary('bay', OP.bay ?? 2.8);
      const front0 = rects[0];
      const fw = front0[2] - front0[0];
      bays = [Math.floor(fw / bay), Math.ceil(fw / bay)].filter((k) => k >= 1 && within(fw / k, [2.2, 3.6])).sort((a, b) => Math.abs(fw / a - bay) - Math.abs(fw / b - bay))[0] ?? 1;
      bay = r3(fw / bays);
      const doorBay = bays % 2 || mirror > 0 ? Math.floor(bays / 2) : bays / 2 - 1, faceArea = fw * eaveZ, open = () => openings.reduce((a, [w, hh]) => a + w * hh, 0);
      const putLight = (W, uc, z0, w, hh, i) => {
        if (open() + w * hh > 0.35 * faceArea && W.n[1] === -1 && i === 0) return;
        const ok = geo && gate('light', Math.min(w, hh), 'tile'), out = ok ? faces : tile, ex = ok ? {} : { tile: true };
        if (OP.kind === 'round' || V.opening === 'round') disc(out, W.at(uc, z0 + hh / 2, 0), W.n, w / 2, Lv.sides + 2, 'opening', VA.opening.value, ex);
        else if (V.opening === 'lens') { if (ok) lens(out, W.at(uc, z0 + hh / 2, 0), W.n, w / 2, Lv.sides, 'lens', VA.opening.value, ring === 'near' ? 2 : 1); else disc(out, W.at(uc, z0 + hh / 2, 0), W.n, w / 2, 6, 'lens', VA.opening.value, ex); }
        else wallPoly(out, W, shape(V.opening, uc, z0, w, hh), 0.03, 'opening', VA.opening.value, ex);
        // the light built (era/out-openings.js): its frame standing out round it, its glazing, where the language says
        if (ok && flatLight && dressedLight && at('sill')) {
          const f0 = out.length;
          lightDress(out, W, { kind: V.opening, uc, z0, w, hh, pts: shape(V.opening, uc, z0, w, hh) }, OP, { sill: !!(P.sill && at('sill')) });
          if (W.n[1] !== -1) for (let k = f0; k < out.length; k++) offLane.add(out[k]);
        }
        // the light's sill and lintel: the anchor's, at depth 3
        if (flatLight && P.sill && at('sill')) { const sh = r3(P.sill.h * ch), g = gate('sill', sh, 'tile'); EB.sill(g ? faces : tile, W, uc, z0, w, sh, P.sill.over, DV.sill.value, DV.sill.group, g); used.add('sill'); }
        if (flatLight && P.lintel && at('lintel') && z0 + hh + P.lintel.h * ch < (i + 1) * storeyH - 0.05) { const lh = r3(P.lintel.h * ch), g = gate('lintel', lh, 'tile'); EB.lintel(g ? faces : tile, W, uc, z0 + hh, w, lh, P.lintel.form, DV.lintel.value, DV.lintel.group, g); used.add('lintel'); }
        // shutters beside a square light: the anchor's, at depth 3, hung by the households that hang them
        if (shut && V.opening === 'rect' && at('shutters')) {
          const g = gate('shutters', w / 2, 'tile');
          // (a framed light's shutters hang beside its frame; leaves with a form stand out of the wall)
          const fo = dressedLight && OP.frame ? r3(Math.max(0.06, OP.frame * 0.9)) : 0, sf = P.shutters?.form;
          for (const s of [-1, 1]) {
            const a = s < 0 ? uc - w - 0.04 - fo : uc + w / 2 + 0.04 + fo, b = s < 0 ? uc - w / 2 - 0.04 - fo : uc + w + 0.04 + fo;
            if (g && sf && sf !== 'flat') shutterDress(faces, W, r3(a), r3(b), z0, z0 + hh, sf, VA.ornaments.shutters.value, { group: VA.ornaments.shutters.group });
            else wallQuad(g ? faces : tile, W, a, b, z0, z0 + hh, 0.03, 'shutter', VA.ornaments.shutters.value, { ...(g ? {} : { tile: true }), group: VA.ornaments.shutters.group });
          }
          used.add('shutters');
        }
        if (W.n[1] === -1 && i === 0) openings.push([w, hh]);
        lights++;
      };
      for (let i = 0; i < n; i++) {
        const rc = rects[i], z0 = r3(i * storeyH);
        for (const s of ['front', 'right', 'left', 'back']) {
          if (party.includes(s)) continue;
          const W = wallOf(rc, s), nb = s === 'front' || s === 'back' ? (V.tiers ? Math.max(1, Math.round(W.len / bay)) : bays) : Math.max(1, Math.round(W.len / bay)), bb = W.len / nb;
          for (let b = 0; b < nb; b++) {
            if (s === 'front' && i === 0 && b === doorBay) continue;
            if (s !== 'front' && D.R() > (s === 'back' ? 0.4 : 0.7)) continue;
            const w = r3(Math.min(OP.w, bb - 1.24)), hh = oh(OP.h);
            if (w >= 0.55) putLight(W, (b + 0.5) * bb, z0 + (i === 0 ? OP.sill : 0.8), w, hh, i);
          }
        }
      }
      // the door: the anchor's entry, on the lane face
      const W = wallOf(rects[0], 'front'), du = clamp((doorBay + 0.5) * bay, 0.62 + doorW / 2, W.len - 0.62 - doorW / 2);
      const dk = V.entryShape === 'arch' ? 'door-arch' : 'rect', dg = gate('door', doorW, 'tile');
      wallPoly(dg ? faces : tile, W, shape(dk, du, 0, doorW, doorH), 0.03, accent ? 'accent' : 'door', 0.3, dg ? {} : { tile: true });
      // the door built (era/out-openings.js): its leaf, fanlight, surround and steps, where the language says
      if (dg && dressedDoor && at('sill')) doorDress(faces, W, { kind: dk, uc: du, w: doorW, h: doorH, pts: shape(dk, du, 0, doorW, doorH), room: r3(storeyH - doorH - 0.15) }, P.entry,
        { value: 0.3, group: accent ? 'str:accent' : 'str:timber', trim: OP.trim, trimValue: OP.trimValue, stone: DV.socle?.group ?? DV.sill?.group ?? 'str:stone', stoneValue: DV.socle?.value ?? DV.sill?.value ?? 0.6, glass: VA.opening.group, glassValue: VA.opening.value, arc: Lv.arc });
      openings.push([doorW, doorH]);
    } else {
      // round masses: a band of lights to a storey on the lane half; the tunnel to the door
      const count = U.focus ? 7 : tw ? n : Math.max(1, Math.min(4, Math.round(vary('lights', OP.count ?? 2))));
      const lr = r3(OP.w / 2 * Math.sqrt(ch)), bands = tw ? n : Math.min(n, 2), Hh = V.mass === 'shell' ? h : eaveZ;
      for (let k = 0; k < count; k++) {
        const b = tw ? k : k % bands, j = tw ? k : Math.floor(k / bands), t = U.focus ? -Math.PI / 2 + ((k - 3) * Math.PI) / 7.5 : -Math.PI / 2 + mirror * (j % 2 ? 1 : -1) * (0.55 + 0.45 * Math.floor(j / 2)) * (tw ? 0.5 : 1) + (count % 2 && !tw ? mirror * 0.25 : 0);
        const z = tw ? b * storeyH + storeyH * 0.6 : Math.min(b * storeyH + storeyH * 0.62, 0.6 * Hh);
        if (z + lr >= Hh * 0.92) continue;
        let p, nn;
        if (S0) { const f = Math.asin(Math.min(0.98, z / h)); p = S0.P(t, f); nn = S0.N(t, f); } else { p = [W0 / 2 + (W0 / 2) * Math.cos(t), D0 / 2 + (D0 / 2) * Math.sin(t), z]; nn = [Math.cos(t), Math.sin(t), 0]; }
        const ok = geo && gate('light', 2 * lr, 'tile');
        if (V.opening === 'lens' && ok) lens(faces, p, nn, lr, Lv.sides, 'lens', VA.opening.value, ring === 'near' ? 2 : 1);
        else if (V.opening === 'arch' || V.opening === 'rect') { const [t1, t2] = basis(nn), q = shape(V.opening, 0, -lr * 1.2, lr * 1.6, lr * 2.4).map(([u, zz]) => add3(add3(p, nn, 0.03), [t1, t2].reduce((acc, e, ii) => add3(acc, e, ii ? 0 : u), [0, 0, 0]).map((v, ii) => v + [0, 0, zz][ii]))); face(ok ? faces : tile, q, nn, 'opening', VA.opening.value, ok ? {} : { tile: true }); }
        else disc(ok ? faces : tile, p, nn, lr, 8, V.opening === 'lens' ? 'lens' : 'opening', VA.opening.value, ok ? {} : { tile: true });
        if (at('rim') && V.opening === 'lens') { const g = gate('rim', 0.16 * ch, 'tile'); disc(g ? faces : tile, p, nn, r3(lr * 1.22), 10, 'motif', 0.62, g ? { group: VA.ornaments.rib?.group ?? 'str:motif' } : { tile: true, group: 'str:motif' }); }
        lights++;
      }
      if (!at('entry')) {
        // no entry piece at this depth: the door is a mark on the mass's front, in its tile
        const fp = S0 ? S0.P(-Math.PI / 2, Math.asin(Math.min(0.5, doorH / 2 / h))) : [W0 / 2, 0, doorH / 2], fn = S0 ? S0.N(-Math.PI / 2, 0.2) : [0, -1, 0];
        disc(tile, fp, fn, doorW / 2, 6, accent ? 'accent' : 'door', 0.3, { tile: true });
      } else {
      // the tunnel: each edge runs back until it meets the mass
      const ve = r3(doorW + 0.7 * ch), vh = r3(doorH + 0.5), y0 = -0.55, arc = Lv.arc;
      const prof = V.entryShape === 'arch' ? [[-ve / 2, 0], [ve / 2, 0], [ve / 2, vh - ve / 2], ...Array.from({ length: arc }, (_, k) => { const a = (Math.PI * (k + 1)) / (arc + 1); return [(ve / 2) * Math.cos(a), vh - ve / 2 + (ve / 2) * Math.sin(a)]; }), [-ve / 2, vh - ve / 2]] : [[-ve / 2, 0], [ve / 2, 0], [ve / 2, vh], [-ve / 2, vh]];
      const yS = (u, z) => r3(D0 / 2 - (D0 / 2) * Math.sqrt(Math.max(0, 1 - (u / (W0 / 2)) ** 2 - (S0 ? (z / h) ** 2 : 0))) + 0.05);
      const atp = (u, z, y) => [r3(W0 / 2 + u), r3(y), r3(z)], tt = faces.length;
      face(faces, prof.map(([u, z]) => atp(u, z, y0)), [0, -1, 0], 'shell', stGroup(0).value * 0.92);
      for (let k = 1; k < prof.length; k++) { const a = prof[k], b2 = prof[(k + 1) % prof.length], m = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2 - vh / 2]; face(faces, [atp(a[0], a[1], y0), atp(b2[0], b2[1], y0), atp(b2[0], b2[1], yS(b2[0], b2[1])), atp(a[0], a[1], yS(a[0], a[1]))], [m[0], 0, m[1]], 'shell', stGroup(0).value * 0.95); }
      for (let i = tt; i < faces.length; i++) faces[i].group = stGroup(0).group;
      const dp = shape(V.entryShape === 'arch' ? 'door-arch' : 'rect', 0, 0, doorW, doorH), dg = gate('door', doorW, 'tile');
      face(dg ? faces : tile, dp.map(([u, z]) => atp(u, z, y0 - 0.03)), [0, -1, 0], accent ? 'accent' : 'door', 0.3, dg ? {} : { tile: true });
      }
      if (at('entry')) used.add('tunnel'); openings.push([doorW, doorH]);
    }
    tag(t0, u0t, 'main', (f) => (f.part === 'door' ? 'str:timber' : f.part === 'accent' ? 'str:accent' : f.part === 'lens' ? VA.opening.group : f.part === 'opening' ? VA.opening.group : f.part === 'motif' ? 'str:motif' : stGroup(0).group), V.opening);
    used.add(V.entry);
  }

  // ── details: the anchor's socle, cornice, quoins and bond ──
  const sidesOf = (all) => (all ? ['front', 'right', 'left', 'back'] : ['front', 'right']).filter((x) => !party.includes(x));
  // a ring on a round mass at height zz (`d` proud): on a drum's round, or on the shell's surface
  const ringAt = (t, zz, d) => { if (S0) { if (zz >= h) return null; const f = Math.asin(Math.min(0.999, zz / h)); return add3(S0.P(t, f), S0.N(t, f), d); } return [W0 / 2 + (W0 / 2 + d) * Math.cos(t), D0 / 2 + (D0 / 2 + d) * Math.sin(t), zz]; };
  const ringBand = (z0, z1, d, part, value, group, geo) => { const k = Lv.lon, out = geo ? faces : tile; for (let j = 0; j < k; j++) { const ta = (2 * Math.PI * j) / k, tb = (2 * Math.PI * (j + 1)) / k, q = [ringAt(ta, z0, d), ringAt(tb, z0, d), ringAt(tb, z1, d), ringAt(ta, z1, d)]; if (q.every(Boolean)) face(out, q, [Math.cos((ta + tb) / 2), Math.sin((ta + tb) / 2), 0], part, value, geo ? { group } : { tile: true, group }); } };
  if (!envelope && P.socle && at('socle')) {
    const sh = r3(P.socle.h), g = gate('socle', sh, 'tile');
    if (V.mass === 'block') for (const s of sidesOf(true)) { const W = wallOf(rects[0], s); EB.socle(g ? faces : tile, W, 0, W.len, sh, DV.socle.value, DV.socle.group, g); }
    else ringBand(0.01, sh, 0.05, 'socle', DV.socle.value, DV.socle.group, g);
    used.add('socle');
  }
  if (!envelope && P.cornice && at('cornice') && V.mass !== 'shell') {
    const chh = r3(P.cornice.h * ch), g = gate('cornice', chh, 'tile'), along = (rc) => (rc[2] - rc[0] >= rc[3] - rc[1] ? ['front', 'back'] : ['left', 'right']);
    if (V.mass === 'block') {
      // under every eave a tier has (each tier its own cap), along the eaves (a gable's ends have none)
      const under = V.tiers && V.capEvery ? rects.map((rc, i) => [rc, r3((i + 1) * storeyH)]) : [[rects[n - 1], eaveZ]];
      for (const [rc, z] of under) for (const s of sidesOf(true)) { if (V.cap === 'gable' && !along(rc).includes(s)) continue; const W = wallOf(rc, s); EB.cornice(g ? faces : tile, W, 0, W.len, z, chh, P.cornice.proud, DV.cornice.value, DV.cornice.group, g); }
    } else ringBand(r3(eaveZ - chh), eaveZ, P.cornice.proud, 'cornice', DV.cornice.value, DV.cornice.group, g);
    used.add('cornice');
  }
  if (!envelope && P.quoins && at('quoins') && V.mass === 'block' && VA.storeys.some((x) => x.group === 'str:stone')) {
    const qc = r3(P.quoins.course), g = gate('quoin', qc, 'tile');
    // quoins dress a masonry storey's corners: where a storey is not stone they stop
    for (let i = 0; i < n; i++) if (stGroup(i).group === 'str:stone') for (const s of sidesOf(false)) EB.quoins(g ? faces : tile, wallOf(rects[i], s), r3(i * storeyH), r3((i + 1) * storeyH), P.quoins.w, qc, DV.quoins.value, DV.quoins.group, g);
    used.add('quoins');
  }
  // the bond: marks in the tile where its joints are spaced wider than the eye spot (nearer, the wall is a value)
  if (!envelope && at('bond') && V.mass === 'block' && L.bonds.some((b) => b && b !== 'none')) {
    const SPACE = { coursed: 0.45, ashlar: 0.5, brick: 0.3, rubble: 0.4, boards: 0.28, panels: 1.2 };
    let marks = 0;
    for (let i = 0; i < n; i++) { const b = L.bonds[Math.min(i, L.bonds.length - 1)]; if (!b || b === 'none' || SPACE[b] < eye) continue; for (const s of sidesOf(false)) marks += EB.bond(tile, wallOf(rects[i], s), 0, wallOf(rects[i], s).len, r3(i * storeyH + (i === 0 && P.socle ? P.socle.h : 0)), r3((i + 1) * storeyH), b, stGroup(i).value, stGroup(i).group, subSeed(seed, `bond:${i}:${s}`)); }
    if (marks) parts.push({ part: 'bond', span: 0, built: 'tile', n: marks });
  }

  // ── ornaments: the anchor's, at depth 2 (frames at 3) ──
  let points = 0;
  const O = P, OV = VA.ornaments;
  if (V.ornaments.includes('point') && at('point')) {
    const t0 = faces.length, rb = r3(O.point.base * ch * (U.focus || tw ? 1.3 : 1)), len = r3(clamp(O.point.len * least, 0.6, 2.4) * ch * (U.focus ? 1.3 : 1));
    if (gate('point', 2 * rb, 'dropped')) {
      const c = O.point.count, t0r = X('turn', [0, Math.PI * 2]);
      for (let k = 0; k < c; k++) {
        let p, a;
        if (S0) { const Sx = ST ?? S0, f = (tw ? 0.86 : 0.72) * (Math.PI / 2), t = t0r + (k * 2 * Math.PI) / c; p = c === 1 ? [W0 / 2, D0 / 2, Sx.z0 + Sx.h] : Sx.P(t, f); a = c === 1 ? [0, 0, 1] : unit(add3(Sx.N(t, f), [0, 0, 1], 1.4)); }
        else if (V.cap === 'gable') { const top = rects[n - 1], al = top[2] - top[0] >= top[3] - top[1]; const u = c === 1 ? 0.5 : (k + 0.5) / c; p = al ? [top[0] + (top[2] - top[0]) * u, (top[1] + top[3]) / 2, ridge] : [(top[0] + top[2]) / 2, top[1] + (top[3] - top[1]) * u, ridge]; a = [0, 0, 1]; }
        else { const top = rects[n - 1], cc = [(top[0] + top[2]) / 2, (top[1] + top[3]) / 2], t = t0r + (k * 2 * Math.PI) / c, rr = c === 1 ? 0 : Math.min(top[2] - top[0], top[3] - top[1]) * 0.18; p = [cc[0] + rr * Math.cos(t), cc[1] + rr * Math.sin(t), ridge - (c === 1 ? 0 : 0.4)]; a = unit([Math.cos(t) * (c === 1 ? 0 : 0.3), Math.sin(t) * (c === 1 ? 0 : 0.3), 1]); }
        point(faces, p, a, rb, len, Lv.sides === 4 ? 4 : 6, 'spike', OV.point.value);
        points++;
      }
    }
    tag(t0, tile.length, 'crown', () => OV.point.group, 'point');
  }
  if (V.ornaments.includes('chimney') && U.hearth && PITCHED.has(V.cap) && at('chimney')) {
    const t0 = faces.length, c = r3(O.chimney.w * ch), top = rects[n - 1];
    if (gate('chimney', c, 'dropped')) {
      const al = top[2] - top[0] >= top[3] - top[1], cx = al ? top[0] + Math.min((top[2] - top[0]) / 2, (top[3] - top[1]) / 2 + 0.3) : (top[0] + top[2]) / 2 - c / 2, cy = al ? (top[1] + top[3]) / 2 - c / 2 : top[1] + Math.min((top[3] - top[1]) / 2, (top[2] - top[0]) / 2 + 0.3);
      const r = [r3(cx), r3(cy), r3(cx + c), r3(cy + c)], zt = r3(ridge + 0.6 * ch);
      for (const s of Object.keys(SIDES)) { const W = wallOf(r, s); wallQuad(faces, W, 0, W.len, r3(ridge - 0.5), zt, 0, 'wall', OV.chimney.value); }
      face(faces, [[r[0], r[1], zt], [r[2], r[1], zt], [r[2], r[3], zt], [r[0], r[3], zt]], [0, 0, 1], 'chimney', OV.chimney.value);
    }
    tag(t0, tile.length, 'chimney', () => OV.chimney.group, 'chimney');
  }
  if (at('rib') && has('rib')) {
    const t0 = faces.length, u0 = tile.length, wr = r3(O.rib.w * ch), g = gate('rib', wr, 'tile'), out = g ? faces : tile, ex = g ? {} : { tile: true };
    if (S0) {
      const fTop = Math.asin(Math.min(0.95, (n * storeyH * 0.95) / h)), ts = O.rib.count >= 4 ? [-0.28, 0.28, -1.15, 1.15] : [-0.28, 0.28];
      for (const dt of ts.slice(0, O.rib.count)) { const t = -Math.PI / 2 + dt; for (let i = 0; i < Lv.lat; i++) { const fa = 0.02 + ((fTop - 0.02) * i) / Lv.lat, fb = 0.02 + ((fTop - 0.02) * (i + 1)) / Lv.lat, da = wr / (2 * Math.max(0.5, Math.cos(fa) * least / 2)), db = wr / (2 * Math.max(0.5, Math.cos(fb) * least / 2)); face(out, [S0.P(t - da, fa), S0.P(t + da, fa), S0.P(t + db, fb), S0.P(t - db, fb)].map((p, k) => add3(p, S0.N(t, k < 2 ? fa : fb), 0.03)), S0.N(t, (fa + fb) / 2), 'motif', OV.rib.value, ex); } }
    } else if (V.mass === 'drum') {
      // ribs up a drum: strips on its round, between the lights
      const k = O.rib.count, rx = W0 / 2, ry = D0 / 2;
      for (let j = 0; j < k; j++) { const t = -Math.PI / 2 + ((j - (k - 1) / 2) * Math.PI) / (k + 1), dt = wr / (2 * Math.min(rx, ry)), P0 = (tt, z) => [W0 / 2 + (rx + 0.03) * Math.cos(tt), D0 / 2 + (ry + 0.03) * Math.sin(tt), z]; face(out, [P0(t - dt, 0), P0(t + dt, 0), P0(t + dt, eaveZ), P0(t - dt, eaveZ)], [Math.cos(t), Math.sin(t), 0], 'motif', OV.rib.value, ex); }
    } else for (let i = 0; i < n; i++) { const W = wallOf(rects[i], 'front'), nb = Math.max(1, Math.round(W.len / (bay || 2.8))); for (let b = 0; b <= nb; b++) { const u = clamp((b * W.len) / nb, wr / 2, W.len - wr / 2); wallQuad(out, W, u - wr / 2, u + wr / 2, r3(i * storeyH), r3((i + 1) * storeyH), 0.02, 'motif', OV.rib.value, ex); } }
    tag(t0, u0, 'main', () => OV.rib.group, 'rib');
    why.push('ribs up the walls between the lights');
  }
  if (V.ornaments.includes('band') && at('band')) {
    const t0 = faces.length, u0 = tile.length, wb = r3(O.band.w * ch), g = gate('band', wb, 'tile'), out = g ? faces : tile, ex = g ? {} : { tile: true };
    for (let i = 1; i <= n; i++) {
      const rc = rects[Math.min(i, n - 1)], z = r3(i * storeyH);
      if (V.mass === 'block') { for (const s of ['front', 'right', 'left', 'back']) { if (party.includes(s)) continue; const W = wallOf(i < n ? rects[i - 1] : rc, s); wallQuad(out, W, 0, W.len, r3(z - wb), z, 0.025, 'motif', OV.band.value, ex); } continue; }
      // a band round a drum or a shell: a ring at the storey line, on the surface
      const k = Lv.lon, ring = (t, zz) => { if (S0) { if (zz >= h) return null; const f = Math.asin(zz / h); return add3(S0.P(t, f), S0.N(t, f), 0.03); } return [W0 / 2 + (W0 / 2 + 0.03) * Math.cos(t), D0 / 2 + (D0 / 2 + 0.03) * Math.sin(t), zz]; };
      for (let j = 0; j < k; j++) { const ta = (2 * Math.PI * j) / k, tb = (2 * Math.PI * (j + 1)) / k, q = [ring(ta, z - wb), ring(tb, z - wb), ring(tb, z), ring(ta, z)]; if (q.every(Boolean)) face(out, q, [Math.cos((ta + tb) / 2), Math.sin((ta + tb) / 2), 0], 'motif', OV.band.value, ex); }
    }
    tag(t0, u0, 'main', () => OV.band.group, 'band');
  }
  if (V.ornaments.includes('frame') && V.mass === 'block' && n >= 2 && at('frame')) {
    const t0 = faces.length, u0 = tile.length, mw = r3(O.frame.member * ch), g = gate('frame', mw, 'tile'), out = g ? faces : tile, ex = g ? {} : { tile: true };
    for (let i = 1; i < n; i++) for (const s of ['front', 'right']) { if (party.includes(s)) continue; const W = wallOf(rects[i], s), z0 = r3(i * storeyH), z1 = r3((i + 1) * storeyH), nb = Math.max(1, Math.round(W.len / (bay || 2.8))); wallQuad(out, W, 0, W.len, z0, z0 + mw, 0.012, 'frame', OV.frame.value, ex); wallQuad(out, W, 0, W.len, z1 - mw, z1, 0.012, 'frame', OV.frame.value, ex); for (let b = 0; b <= nb; b++) { const u = clamp((b * W.len) / nb, mw / 2, W.len - mw / 2); wallQuad(out, W, u - mw / 2, u + mw / 2, z0, z1, 0.012, 'frame', OV.frame.value, ex); } }
    tag(t0, u0, 'main', () => OV.frame.group, 'frame');
  }

  // ── the budget: past the ring's (a focus spends the next ring in's), the finest goes into the tile first ──
  const budget = STRUCTURE_RINGS[U.focus || U.dare || accent ? STRUCTURE_RING_IDS[Math.max(0, STRUCTURE_RING_IDS.indexOf(ring) - 1)] : ring].budget;
  const count = () => faces.reduce((a, f) => a + f.corners.length - 2, 0);
  // (the openings' dressing, era/out-openings.js, goes before the language's own ornaments: off the lane face first)
  const ORDER = dressedLight || dressedDoor ? ['quoin', 'lintel', 'sill', 'shutter', 'glazing:off', 'surround:off', 'frame', 'cornice', 'socle', 'glazing', 'surround', 'joint', 'panel'] : ['quoin', 'lintel', 'sill', 'shutter', 'frame', 'cornice', 'socle'];
  for (const p0 of ORDER) {
    if (count() <= budget) break;
    const [p, off] = p0.split(':'), moved = faces.filter((f) => f.part === p && (!off || offLane.has(f)));
    if (!moved.length) continue;
    for (const f of moved) { f.tile = true; tile.push(f); }
    const keep = faces.filter((f) => !moved.includes(f)); faces.length = 0; faces.push(...keep);
    for (const row of parts.filter((r) => r.part === (p === 'shutter' ? 'shutters' : p) && r.built === 'geometry')) row.built = 'tile (budget)';
    why.push(`over the ${ring} budget: its ${p}s${off ? ' off the lane face' : ''} into the tile`);
  }
  // still over: the lights off the lane face go into the tile, the lane's own kept
  if (count() > budget) {
    const off = faces.filter((f) => (f.part === 'opening' || f.part === 'lens') && !(Math.abs(f.normal[1] + 1) < 0.3));
    for (const f of off) { f.tile = true; tile.push(f); }
    const keep = faces.filter((f) => !off.includes(f)); faces.length = 0; faces.push(...keep);
    if (off.length) why.push(`over the ${ring} budget: the lights off the lane face into the tile`);
  }

  // ── measures and laws ──
  for (const f of [...faces, ...tile]) f.group ??= stGroup(0).group;
  const tris = count(), geomParts = parts.filter((p) => p.built === 'geometry');
  const vol = (m) => (m.rect[2] - m.rect[0]) * (m.rect[3] - m.rect[1]) * m.eave;
  const vocabKinds = new Set([V.mass, V.cap, V.opening, V.entry, ...V.ornaments, V.annex ? 'annex' : null, V.tiers ? 'tiers' : null].filter(Boolean));
  const capValue = capV ? capV.value : VA.opening.value === 0.04 ? 0.5 : VA.opening.value;
  const top = stGroup(n - 1).value;
  const measures = {
    use: U, storeyH, door: { w: doorW, h: doorH, side: 'front' }, lead: r3(vol(masses[0]) / masses.reduce((a, m) => a + vol(m), 0)), under: underRidge,
    values: [top, capV ? capValue : Math.min(capValue, top - 0.1), 0.04], leastPart: geomParts.length ? Math.min(...geomParts.map((p) => p.span)) : Infinity, eye, tris,
    // a thing that matters speaks a depth deeper, and may spend the next ring in's budget to do it
    budget,
    band: band && citizen ? { band, ok: (n >= band[0] && n <= band[1] + (corner && V.mass !== 'shell' && !U.focus ? 1 : 0)) || bandCapped } : null,
    floor, need: tw ? floor : need, held: tw ? 1 : r3(floor / Math.max(1, need)), ridge, eaveZ, footprint: [W0, D0], storeys: n,
    used: [...used], foreign: [...used].filter((k) => !vocabKinds.has(k)), reach, spans: [least], pitch, pitchMin,
    rise: V.mass === 'shell' ? r3(h / (least / 2)) : null, riseRail: riseRail ?? [0, 0], by: round ? 'band' : 'bays', bay, bays, lights, focus: !!U.focus, points, pointCount: P.point?.count ?? 0,
  };
  const laws = [...STRUCTURE_LAWS.filter((l) => SCALE_LAWS.includes(l.id)), ...ANCHOR_LAWS].map((l) => ({ law: l.id, want: l.want, why: l.why, ok: l.test(measures), value: l.show(measures) }));
  const sig = [n, masses.length, lights, Math.round((pitch ?? h) * 2), V.tiers ? Math.round(shrink * 10) : 0, Math.round(W0), used.has('rib'), used.has('shutters'), mirror].join(' ');
  return { use, lot, ring, seed, depth: dep, kitId: style.kitId, tokens: style.tokens, language: L.id,
    dims: { front, side, rear, W0, D0, storeyH, n, axis, form: V.cap ?? V.mass, pitch: pitch ?? 0, eave, jetty: 0, doorW, doorH, bays, bay, need, ground: stGroup(0).group, upper: stGroup(n - 1).group, covering: capV?.group ?? stGroup(0).group, construction: V.mass, ...(P.entry.steps >= 0.5 ? { steps: Math.round(P.entry.steps) } : {}) },
    why, masses, faces, tile, parts, measures, laws, sig };
}

/** The language spoken again for an annex: a smaller mass under the same cap, a depth shallower (its lights at 1). */
function speakMass(L, rect, n, storeyH, Lv, dep, round, stGroup, capV, pitch, eave, laid, faces, tile, used, at, under = Infinity) {
  const V = L.vocab, w = rect[2] - rect[0], d = rect[3] - rect[1], t0 = faces.length, u0 = tile.length;
  let ridge;
  if (V.mass === 'shell') {
    const hs = r3(Math.min(under, 1.35 * L.proportions.rise * Math.min(w, d) / 2, Math.max(n * storeyH + 1, Math.min(w, d) / 2)));
    shellFaces(faces, shellAt([(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2], w / 2, d / 2, hs, 0), { lon: Math.max(6, Lv.lon - 4), lat: Math.max(2, Lv.lat - 2) }, 'shell', stGroup(0).value);
    ridge = hs;
  } else {
    for (let i = 0; i < n; i++) for (const s of Object.keys(SIDES)) { if (s === 'front') continue; const W = wallOf(rect, s); if (V.mass === 'drum') { /* a drum's annex is a smaller drum */ } wallQuad(faces, W, 0, W.len, r3(i * storeyH), r3((i + 1) * storeyH), 0, 'wall', stGroup(i).value, { group: stGroup(i).group }); }
    const z = r3(n * storeyH);
    if (V.cap && PITCHED.has(V.cap)) ridge = roof(faces, rect, z, { form: V.cap === 'pyramid' ? 'hip' : V.cap, axis: w >= d ? 'x' : 'y', e: eave, p: pitch, mat: capV.group, value: capV.value, gableMat: stGroup(n - 1).group, gableValue: stGroup(n - 1).value, courses: laid }).ridge;
    else if (V.cap === 'dome') { const rise = (L.proportions.rise ?? 0.8) * Math.min(w, d) / 2; shellFaces(faces, shellAt([(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2], w / 2, d / 2, rise, z), { lon: Math.max(6, Lv.lon - 4), lat: 2 }, 'roof', capV.value); ridge = r3(z + rise); }
    else { face(faces, [[rect[0], rect[1], z], [rect[2], rect[1], z], [rect[2], rect[3], z], [rect[0], rect[3], z]], [0, 0, 1], 'roof', capV?.value ?? 0.5); ridge = z; }
  }
  for (let i = t0; i < faces.length; i++) { faces[i].mass ??= 'annex'; faces[i].group ??= ['roof', 'edge', 'cap', 'course'].includes(faces[i].part) ? capV?.group ?? stGroup(0).group : faces[i].part === 'wall' && faces[i].mat?.startsWith?.('str:') ? faces[i].mat : stGroup(0).group; }
  for (let i = u0; i < tile.length; i++) { tile[i].mass ??= 'annex'; tile[i].group ??= capV?.group ?? stGroup(0).group; }
  used.add('annex');
  const k = V.mass === 'shell' || V.mass === 'drum' ? Math.PI / 4 : 1;
  void at; void dep; void round;
  return { ridge, n, floor: r3(k * w * d * n * 0.9) };
}

/** Speak the language back on the anchor's own lot, at full depth, and say how faithful the decompile was. */
export function roundTrip(L, style, seed = 1) {
  // the anchor's own programme: the floor its own mass holds, storey by storey
  const A = L.anchor, M = A.pieces.find((p) => p.role === 'mass'), k = M.kind === 'block' ? 1 : Math.PI / 4, sh = M.tiers?.shrink ?? 1;
  const area = r3(Array.from({ length: L.storeys }, (_, i) => k * M.w * M.d * sh ** (2 * i)).reduce((a, x) => a + x, 0) * 0.92);
  const b = speak(L, A.use, A.lot, style, seed, { depth: 3, band: [L.storeys, L.storeys], over: { area, full: true } });
  const checks = [
    ['vocabulary', b.measures.foreign.length === 0 && b.measures.used.includes(L.vocab.mass) && (!L.vocab.cap || b.measures.used.includes(L.vocab.cap)), `${b.measures.used.join(', ')}`],
    ['cap', L.proportions.pitch === null || Math.abs(b.dims.pitch - L.proportions.pitch) <= L.proportions.pitch * (L.variation + 0.2), `${b.dims.pitch || '—'} for ${L.proportions.pitch ?? '—'}`],
    ['ornaments', !L.proportions.point || b.measures.points === L.proportions.point.count, `${b.measures.points} points for ${L.proportions.point?.count ?? 0}`],
    ['light', b.measures.lights >= 1, `${b.measures.lights} ${L.vocab.opening} lights`],
  ];
  return { building: b, laws: [{ law: 'round-trip', ok: checks.every((c) => c[1]), value: checks.map(([k, ok, v]) => `${k} ${ok ? '✓' : '✗'} ${v}`).join(' · '), want: 'the language spoken back on the anchor\'s own lot rebuilds the anchor\'s vocabulary, cap and ornaments' }] };
}

