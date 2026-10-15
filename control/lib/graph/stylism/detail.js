/**
 * detail.js — THE DETAIL SOLVER: the `detail` budget spent as units of technique, in a character designer's order,
 * lowered to what the outfit build already compiles (its `detail` list of binding and embroidery on the garment's
 * roles, its `ornament` dial, and the catalogue's fittings). It decides WHERE and HOW MUCH; the register (index.js) has
 * already decided how big.
 *
 *   HIERARCHY       the FOCAL zone is spent first and stays the richest: no other zone ever holds as many units of
 *                   technique (an emblem 3, a border or a broad fitting 2, a binding or a small ring of metal 1)
 *   REPETITION      one motif family (the genre's, or `stylism.motif`), ECHOED once at another zone at another scale
 *   REST            the remaining edges get quiet bindings; what is left unspent is rest, part of the design
 *   MATERIAL        one metal fitting near the focal, from heroic up (grounded: metal only where it works, the
 *                   construction's own buckles and buttons)
 *   WHAT SHOWS      a technique sits only on a role the outfit shows: a gown or a robe buries the shirt's chest and hem,
 *                   so the work moves to a fitting worn over it
 *
 *   detailMoves({ G, r, d, outline, focal?, motif?, language, pieces, room?, drawn?, own? (the first `own` pieces are the
 *     hero's own: never trimmed) }) → { ornament, detail: [{ prim, role, motif? }],
 *     pieces: [{ kind, why }], trims: { <piece index>: { hem?, cuffs?, chest?, motif? } } (a designed piece's own trim), spent: [{ technique, zone, role?, cost }], budget, left, focal, motif }
 * Pure and deterministic.
 */
export const DETAIL_ZONES = Object.freeze(['neck', 'chest', 'back', 'waist', 'arms', 'wrists', 'hem']);
// the zone a garment role sits in
const ZONE_OF = { yoke: 'neck', chest: 'chest', back: 'back', waist: 'waist', sleeveBand: 'arms', cuffs: 'wrists', hem: 'hem', skirtHem: 'hem', legHem: 'hem' };
// the focal an outline draws the eye to: the shoulders' breadth leads to the chest, a bell's and an X's to the waist,
// a needle's to the face
export const FOCAL_OF = Object.freeze({ wedge: 'chest', column: 'chest', needle: 'neck', bell: 'waist', barrel: 'waist', hourglass: 'waist' });
// what a designed piece covers: the roles of the cloth beneath it are buried
const COVERS = { gown: ['chest', 'back', 'yoke', 'hem', 'waist', 'skirtHem', 'legHem'], robe: ['chest', 'back', 'yoke', 'hem', 'waist', 'skirtHem', 'legHem'],
  wizardRobe: ['chest', 'back', 'yoke', 'hem', 'waist', 'skirtHem', 'legHem', 'cuffs', 'sleeveBand'], tunic: ['chest', 'back', 'yoke', 'hem', 'waist'],
  cloak: ['back'], mantle: ['yoke', 'back'], chestPlate: ['chest'] };
// the costs, in units: an emblem is the richest single technique
const COST = { emblem: 3, border: 2, fitting: 2, binding: 1 };
// a fitting's cost: a small ring of metal is a binding's, a hanging or broad one an edge's
const FITTING_COST = { torc: 1, armRings: 1, anklets: 1, wraps: 1 };
const fittingCost = (kind) => FITTING_COST[kind] ?? COST.fitting;
// one necklace: a medallion and a chain both hang from the neck
const NECKLACES = new Set(['medallion', 'chain']);
// the detail a piece already worn spends (a signature's bows are detail: their count is the budget's), and its zone
const WORN_ZONE = { bow: (p) => ({ back: 'waist', collar: 'neck', wrists: 'wrists' }[p.at ?? 'back']), medallion: () => 'chest', chain: () => 'chest', torc: () => 'neck',
  armRings: () => 'arms', bracers: () => 'wrists', wraps: () => 'wrists', anklets: () => 'hem', sash: () => 'waist' };
const WORN_COST = { bow: 1, ...FITTING_COST };
/** the detail zone a worn piece sits in (null: a silhouette mass, not detail) */
export const zoneOfPiece = (p) => WORN_ZONE[p.kind]?.(p) ?? null;
const EDGE_ROLES = new Set(['cuffs', 'hem', 'waist', 'legHem', 'skirtHem']);
const lerpUnits = (d) => Math.round(d * 10);

/** the roles the outfit shows, from its language (the card's under its own) and the designed pieces over it */
export function shownRoles(language = {}, pieces = [], drawn = null) {
  // a second skin is paint, not cloth: it has no hem, cuff or yoke to work. A DRAWN anime figure wears an unfitted knit
  // as one (outfit/expand.js `drawnFit`: law 10)
  const drawnFit = (x) => (x && typeof x === 'object' && x.kind !== 'skirt' && x.fit === undefined && !['straight', 'wide'].includes(x.cut) && drawn === 'anime' ? { ...x, fit: (x.family ?? 'knit') === 'knit' ? 'skin' : 'fitted' } : x);
  const cloth = (x) => (x && x.fit !== 'skin' ? x : null);
  const top = cloth(drawnFit(language.top)), bottom = cloth(language.bottom && drawnFit({ family: 'woven', ...language.bottom })), outer = cloth(language.outer), dress = !!language.dress, R = new Set();
  const body = !!(top || outer);
  if (body) { R.add('chest'); R.add('back'); R.add('yoke'); }
  if ((top && !dress) || outer) R.add('hem');
  const sleeve = (s) => s && s.sleeve && s.sleeve !== 'none';
  if (sleeve(top) || sleeve(outer)) { R.add('cuffs'); R.add('sleeveBand'); }
  if (bottom && bottom.kind === 'skirt') { R.add('skirtHem'); if (!dress) R.add('waist'); }
  else if (bottom) { R.add('legHem'); R.add('waist'); }
  // a sleeved gown, robe or tunic covers the sleeves' roles too
  for (const p of pieces) for (const role of [...(COVERS[p.kind] || []), ...(p.sleeve && ['gown', 'robe', 'tunic'].includes(p.kind) ? ['cuffs', 'sleeveBand'] : [])]) R.delete(role);
  return R;
}

// a designed piece's own trim roles (outfit-plan.js `trimOf`): its hem, its cuffs when sleeved, its bodice's chest
// (a breastplate's own surface is its chest: the motif embossed there, armor/principles.js law 15, never a medallion hung
// over the plate)
const PIECE_TRIM = { gown: ['chest', 'hem', 'cuffs'], robe: ['chest', 'hem', 'cuffs'], wizardRobe: ['chest', 'hem', 'cuffs'], tunic: ['chest', 'hem', 'cuffs'], cloak: ['hem'], chestPlate: ['chest'] };
const sleeved = (p) => p.kind === 'wizardRobe' ? p.sleeve !== 'none' : !!p.sleeve && p.sleeve !== 'none';
const PIECE_ZONE = { chest: 'chest', hem: 'hem', cuffs: 'wrists' };

export function detailMoves({ G, r, d, outline, focal, motif, language, pieces = [], room: cap = Infinity, drawn = null, own = 0 }) {
  const budget = lerpUnits(d), roles = shownRoles(language, pieces, drawn), worn = new Set(pieces.map((p) => p.kind));
  const F = focal ?? FOCAL_OF[outline] ?? 'chest', M = motif ?? G.motifs[0], fit = G.fittings || {};
  const count = Object.fromEntries(DETAIL_ZONES.map((z) => [z, 0])), weight = { ...count }, detail = [], added = [], spent = [];
  let left = budget;
  const used = new Set();
  // what is worn already: its zone counted, its detail charged to the budget
  for (const p of pieces) { const z = WORN_ZONE[p.kind]?.(p); if (!z) continue; count[z]++; const c = WORN_COST[p.kind] ?? COST.fitting; weight[z] += c; left -= c; spent.push({ technique: `worn ${p.kind}`, zone: z, cost: c }); }
  const spend = (technique, zone, cost, lower, role) => { if (cost > left || !room(zone, cost)) return false; left -= cost; count[zone]++; weight[zone] += cost; spent.push({ technique, zone, ...(role ? { role } : {}), cost }); lower(); if (role) used.add(role); return true; };
  // the hierarchy holds: a zone other than the focal never reaches the focal's weight
  function room(zone, cost = 1) { return zone === F || weight[zone] + cost < weight[F]; }
  // the roles a zone offers: the cloth's own, then the designed pieces' trim (`piece:<i>:<role>`), the outermost first
  const pieceRoles = pieces.flatMap((p, i) => (i < own ? [] : PIECE_TRIM[p.kind] || []).filter((role) => role !== 'cuffs' || sleeved(p)).map((role) => ({ key: `piece:${i}:${role}`, zone: PIECE_ZONE[role], i, role }))).reverse();
  const rolesIn = (zone) => [...Object.keys(ZONE_OF).filter((role) => ZONE_OF[role] === zone && roles.has(role)), ...pieceRoles.filter((x) => x.zone === zone).map((x) => x.key)].filter((role) => !used.has(role));
  const trims = {};
  // a role's lowering: the outfit's detail list, or the piece's own trim
  const lower = (role, prim) => () => { const m = /^piece:(\d+):(\w+)$/.exec(role);
    if (!m) { detail.push({ prim, role, ...(prim === 'embroidery' ? { motif: M } : {}) }); return; }
    const T = (trims[m[1]] ??= {}); T[m[2]] = m[2] === 'chest' ? 'emblem' : prim; if (prim !== 'binding') T.motif = M; };
  const isEdge = (role) => EDGE_ROLES.has(role) || /:(hem|cuffs)$/.test(role);
  const isField = (role) => role === 'chest' || role === 'back' || /:chest$/.test(role);
  const necklace = () => [...worn].some((k) => NECKLACES.has(k));
  const fittingAt = (zone) => (added.length < cap ? (fit[zone] || []).find((k) => !worn.has(k) && !(NECKLACES.has(k) && necklace())) : undefined);
  const wear = (kind, why) => { added.push({ kind, why }); worn.add(kind); };
  // 1, 2 · the focal: its richest technique, then a second
  const focalOnce = () => {
    const field = rolesIn(F).find(isField);
    if (field && spend('emblem', F, COST.emblem, lower(field, 'embroidery'), field)) return true;
    const edge = rolesIn(F).find((role) => !isField(role) && (isEdge(role) || role === 'yoke' || role === 'sleeveBand'));
    if (edge && spend('border', F, COST.border, lower(edge, 'embroidery'), edge)) return true;
    const k = fittingAt(F);
    if (k && spend(`fitting ${k}`, F, fittingCost(k), () => wear(k, `the focal: a ${k} at the ${F}`))) return true;
    return false;
  };
  // the focal outranks every zone: it is spent until it holds more than any other (two at the least)
  const most = () => Math.max(0, ...DETAIL_ZONES.filter((z) => z !== F).map((z) => weight[z]));
  for (let i = 0; i < 4 && left > 0 && (count[F] < 2 || weight[F] <= most()); i++) if (!focalOnce()) break;
  // 3 · the echo: the motif once more at another zone, at another scale (a border where the focal was an emblem)
  for (const zone of ['hem', 'wrists', 'neck', 'waist', 'arms']) {
    if (zone === F || !room(zone, COST.border)) continue; const role = rolesIn(zone).find((x) => !isField(x));
    if (role && spend('echo', zone, COST.border, lower(role, 'embroidery'), role)) break;
  }
  // 4 · rest: quiet bindings on the remaining edges, never past the focal
  for (const zone of ['wrists', 'hem', 'neck', 'waist']) { if (zone === F || !room(zone, COST.binding)) continue;
    const role = rolesIn(zone).find(isEdge); if (role) spend('binding', zone, COST.binding, lower(role, 'binding'), role); }
  // 5 · material: one metal fitting near the focal, from heroic up
  if (r >= 0.6 && added.length < cap) for (const zone of [F, 'arms', 'wrists', 'neck', 'hem']) { const k = (G.metalFittings || []).find((x) => (fit[zone] || []).includes(x) && !worn.has(x));
    if (k && spend(`metal ${k}`, zone, fittingCost(k), () => wear(k, `metal near the focal: a ${k}`))) break; }
  const ornament = d <= 0 ? 1 : d < 0.5 ? 2 : d < 0.9 ? 2 : 3;
  // the focal could not outrank: its cloth covered, its fittings worn
  const stalled = count[F] < 2 && left > 1 && !rolesIn(F).length ? pieces.filter((p) => (COVERS[p.kind] || []).some((role) => ZONE_OF[role] === F)).map((p) => `by the ${p.kind}`).join(', ') || 'nothing there to work' : null;
  return { budget, left: Math.max(0, left), ...(stalled ? { stalled } : {}), focal: F, motif: M, ornament, detail, pieces: added, trims, spent, count, weight };
}
