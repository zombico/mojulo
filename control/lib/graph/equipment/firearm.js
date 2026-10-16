// equipment/firearm — a modern or a future world's arms as equipment: the pistol, the carbine and the shotgun, built
// from the same boxes the carry holds were measured on (firearm-shapes.js, the carry's CARRIED), so a gun worn as gear and a
// gun carried in a clip are one thing. Generic proxies: no make or model.
//
// The item's frame is the carry's: the bore along +z (the muzzle at the far end), +y up (the sights), x across, in
// centimetres. Each box is one extrude; a box's colour in the carry table names its ROLE here:
//   metal      the slide, the barrel, the receiver (the carry's METAL)
//   body       the frame, the stock, the handguard, the grip (POLY)
//   furniture  a wooden stock and fore-end (WOOD)
//   lit        a FUTURE card's lit band: one strip down each side of the first box, its role a lit material (`neon`)
// A card's `round` (0–1) rounds every box's corners toward a capsule: a service arm is square-edged (0.15), a future
// one smooth (0.85). Sockets: `grip` (the strong hand's place, its axis the grip's line up into the bore), `tip` (the
// muzzle), `stock` (the butt; the pistol's is its grip's heel).
//
// Pure and deterministic: no dice (a build's seed changes nothing here).
import { FIREARM_SHAPES, METAL, POLY, WOOD } from './firearm-shapes.js';
import { r3, P, A, push } from './shapes.js';

export const FIREARM_ITEMS = Object.freeze(['pistol', 'carbine', 'shotgun']);
/** the carry table's box colours → the card's roles */
const ROLE_OF = Object.freeze({ [METAL]: 'metal', [POLY]: 'body', [WOOD]: 'furniture' });
const ROLE = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && /^#[0-9a-f]{6}$/i.test(v[1]);
const FIREARM_ROLES = Object.freeze(['metal', 'body', 'furniture']);

/**
 * The firearm cards: PURE DATA, as the blade cards are. `roles` each [material, '#hex'] (metal, body, furniture; `lit`
 * optional), `round` 0–1. A style is a sample: a new direction is a new card.
 */
export const FIREARM_STYLES = Object.freeze({
  service: {
    "id": "service",
    "round": 0.15,
    "roles": { "metal": ["gunmetal", "#3b3f45"], "body": ["rubber", "#26282b"], "furniture": ["wood", "#7a5230"] }
  },
  future: {
    "id": "future",
    "round": 0.85,
    "roles": { "metal": ["gunmetal", "#59616c"], "body": ["satin", "#d9dde2"], "furniture": ["satin", "#d9dde2"], "lit": ["neon", "#2fd8ff"] }
  },
});
export const DEFAULT_FIREARM_STYLE = 'service';

export const isFirearm = (item) => FIREARM_ITEMS.includes(item);

/** Why a firearm card is invalid (sentences); empty when valid. */
export function validateFirearmCard(card, path = 'style') {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return [`${path}: a firearm style is a sample name (${Object.keys(FIREARM_STYLES).join(', ')}) or a card { roles: { metal, body, furniture, lit? }, round? }`];
  const errs = [];
  for (const role of FIREARM_ROLES) if (!ROLE(card.roles?.[role])) errs.push(`${path}.roles.${role}: required, ['<material>', '#rrggbb']`);
  if (card.roles?.lit !== undefined && !ROLE(card.roles.lit)) errs.push(`${path}.roles.lit: ['<material>', '#rrggbb']`);
  for (const k of Object.keys(card.roles || {})) if (![...FIREARM_ROLES, 'lit'].includes(k)) errs.push(`${path}.roles.${k}: not a firearm role — use ${[...FIREARM_ROLES, 'lit'].join(', ')}`);
  if (card.round !== undefined && !(Number.isFinite(card.round) && card.round >= 0 && card.round <= 1)) errs.push(`${path}.round: a number 0–1`);
  return errs;
}
export const firearmCardOf = (style) => (typeof style === 'string' ? FIREARM_STYLES[style] : style);

/** Build a firearm (valid item and card) → { monomers, sockets, trace }. */
export function buildFirearm(item, card) {
  const C = FIREARM_SHAPES[item], round = card.round ?? 0.15, roles = card.roles, m = {};
  const mat = (role) => ({ material: roles[role][0], tint: roles[role][1] });
  let zLo = Infinity, zHi = -Infinity;
  C.boxes.forEach(([lo, hi, colour], i) => {
    const w = hi[0] - lo[0], h = hi[1] - lo[1], cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
    zLo = Math.min(zLo, lo[2]); zHi = Math.max(zHi, hi[2]);
    push(m, 'extrudes', { group: i === 0 ? 'receiver' : `part${i}`, profile: { rect: { w: r3(w), h: r3(h), r: r3(round * Math.min(w, h) / 2) } }, axisFrom: P(r3(cx), r3(cy), r3(lo[2])), axisTo: P(r3(cx), r3(cy), r3(hi[2])), ...mat(ROLE_OF[colour] ?? 'body') });
  });
  if (roles.lit) {
    // the lit band: a thin strip proud of each side of the first box, along its middle two thirds
    const [lo, hi] = C.boxes[0], L = hi[2] - lo[2], y = lo[1] + 0.62 * (hi[1] - lo[1]), t = 0.25, hh = Math.max(0.4, 0.14 * (hi[1] - lo[1]));
    for (const x of [lo[0] - t / 2, hi[0] + t / 2]) push(m, 'extrudes', { group: 'lit', profile: { rect: { w: t, h: r3(hh), r: 0 } }, axisFrom: P(r3(x), r3(y), r3(lo[2] + L / 6)), axisTo: P(r3(x), r3(y), r3(hi[2] - L / 6)), ...mat('lit') });
  }
  const st = C.stations.strong;
  const butt = C.stations.butt?.at ?? [st.at[0], st.at[1] - 4, st.at[2] - 3];
  const sockets = { grip: { origin: A(...st.at.map(r3)), axis: st.c.map(r3), length: 10 }, tip: { origin: A(...C.muzzle.map(r3)) }, stock: { origin: A(...butt.map(r3)) } };
  return { monomers: m, sockets, trace: { variants: { round: r3(round), lit: !!roles.lit }, length: r3(zHi - zLo), back: r3(zLo), minFeature: 0.25 } };
}
