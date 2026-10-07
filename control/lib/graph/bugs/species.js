// The BUG ROSTER: worked arthropods, each a BAUPLAN — a form per part (forms.js) plus the numbers that make it that
// animal — built into a ring plan by build.js. There is no family table: two species share a part by naming the same
// form (the honey bee and the house fly stand on the same walking leg). `resolveBug` finds the closest worked species
// for a bug nobody has built, from the part forms it is described by, and wears those forms over it.
import { buildBug, bugReadout, assembleBug } from './build.js';
import { ORDER_PRIORS } from './forms.js';
import { bug as honeyBee } from './roster/honeyBee.js';
import { bug as houseFly } from './roster/houseFly.js';
import { bug as grasshopper } from './roster/grasshopper.js';
import { bug as ladybird } from './roster/ladybird.js';
import { bug as stagBeetle } from './roster/stagBeetle.js';
import { bug as monarch } from './roster/monarch.js';
import { bug as carpenterAnt } from './roster/carpenterAnt.js';
import { bug as prayingMantis } from './roster/prayingMantis.js';
import { bug as dragonfly } from './roster/dragonfly.js';
import { bug as gardenSpider } from './roster/gardenSpider.js';
import { bug as mosquito } from './roster/mosquito.js';
import { bug as cockroach } from './roster/cockroach.js';
import { bug as centipede } from './roster/centipede.js';
import { bug as millipede } from './roster/millipede.js';
import { bug as woodlouse } from './roster/woodlouse.js';
import { bug as scorpion } from './roster/scorpion.js';
import { bug as greenCrab } from './roster/greenCrab.js';
import { bug as shieldBug } from './roster/shieldBug.js';
import { bug as cicada } from './roster/cicada.js';
import { bug as weevil } from './roster/weevil.js';
import { bug as lacewing } from './roster/lacewing.js';
import { bug as mayfly } from './roster/mayfly.js';
import { bug as stickInsect } from './roster/stickInsect.js';
import { bug as earwig } from './roster/earwig.js';
import { bug as flea } from './roster/flea.js';
import { bug as tick } from './roster/tick.js';
import { bug as harvestman } from './roster/harvestman.js';
import { bug as lobster } from './roster/lobster.js';
import { bug as horseshoeCrab } from './roster/horseshoeCrab.js';
import { bug as spinyLobster } from './roster/spinyLobster.js';
import { bug as slipperLobster } from './roster/slipperLobster.js';
import { bug as europeanLobster } from './roster/europeanLobster.js';
import { bug as crayfish } from './roster/crayfish.js';
import { bug as langoustine } from './roster/langoustine.js';
import { bug as herculesBeetle } from './roster/herculesBeetle.js';
import { bug as rhinoBeetle } from './roster/rhinoBeetle.js';
import { bug as goliathBeetle } from './roster/goliathBeetle.js';
import { bug as dungBeetle } from './roster/dungBeetle.js';
import { bug as cockchafer } from './roster/cockchafer.js';
import { bug as firefly } from './roster/firefly.js';
import { bug as potatoBeetle } from './roster/potatoBeetle.js';
import { bug as tigerBeetle } from './roster/tigerBeetle.js';
import { bug as divingBeetle } from './roster/divingBeetle.js';
import { bug as longhornBeetle } from './roster/longhornBeetle.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Each worked bug lives in its own file under roster/ (its thesis above it: silhouette, stance, the one or two
 * diagnostic parts, the size and its source); `order` is the taxon (the matcher's prior), `length` metres head front to
 * tail tip. */
export const BUG_SPECIES = { honeyBee, houseFly, grasshopper, ladybird, stagBeetle, monarch, carpenterAnt, prayingMantis, dragonfly, gardenSpider, mosquito, cockroach, centipede, millipede, woodlouse, scorpion, greenCrab,
  shieldBug, cicada, weevil, lacewing, mayfly, stickInsect, earwig, flea, tick, harvestman, lobster, horseshoeCrab,
  spinyLobster, slipperLobster, europeanLobster, crayfish, langoustine, herculesBeetle, rhinoBeetle, goliathBeetle, dungBeetle, cockchafer, firefly, potatoBeetle, tigerBeetle, divingBeetle, longhornBeetle };

/** The roster's bauplans, each a fresh copy. */
export function bugParams(id) { const s = BUG_SPECIES[id]; return s ? clone(s) : null; }
/** A worked species' ring plan, freshly built. */
export function bugPlan(id) { const p = bugParams(id); return p ? buildBug(p) : null; }
export { buildBug, bugReadout, assembleBug, ORDER_PRIORS };

// ── THE MATCHER: the closest worked bug for one nobody has built ──

const formOf = (v) => (v === null || v === undefined || v === false ? null : typeof v === 'string' ? v : v.form ?? null);
/** a bauplan's TRAITS: the form it wears per part (what the matcher compares and what a query names) */
export function traitsOf(B) {
  const legs = B.legs || {};
  return {
    head: B.head === 'fused' ? 'fused' : formOf(B.head ?? 'hypognathous'), trunk: formOf(B.trunk ?? 'compact'), tail: formOf(B.tail ?? 'oval'),
    legs: legs.form ?? 'walker', foreLegs: legs.fore?.form ?? legs.form ?? 'walker', hindLegs: legs.hind?.form ?? legs.form ?? 'walker',
    antennae: formOf(B.antennae), mouth: formOf(B.mouth ?? 'mandibles'), eyes: formOf(B.eyes ?? 'compound'), palps: B.palps ? (B.palps.form ?? 'palp') : null,
    wings: B.wings ? (Array.isArray(B.wings) ? B.wings : B.wings.pairs || []).map(formOf) : null,
    extras: (B.extras || []).map((x) => x.kind),
  };
}
const WEIGHTS = { trunk: 3, tail: 2, head: 1, legs: 2, foreLegs: 2, hindLegs: 2, antennae: 1.5, mouth: 1.5, wings: 3, eyes: 1, palps: 2, extras: 1 };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** RESOLVE a bug from a description: { like?: <worked id>, order?: <ORDER_PRIORS key>, traits?: { head, trunk, tail,
 * legs, foreLegs, hindLegs, antennae, mouth, eyes, palps, wings: [forms] | null, wingPose, extras: [kinds] }, length?
 * (m), name?, colors?, over?: { <any bauplan field> } }. The order's prior fills the traits not given; every worked
 * species is scored on the traits (weighted matches, an order bonus, a size penalty) and the best is the BASIS; each
 * trait that differs from it is then WORN (that part swapped to the asked form, its tuned numbers dropped), then the
 * length, colours and `over`. Returns { bauplan, basis, score, ranked, worn }. */
export function resolveBug(Q = {}) {
  const prior = Q.order ? ORDER_PRIORS[Q.order] : null;
  if (Q.order && !prior) throw new Error(`bug: order '${Q.order}' is not one of ${Object.keys(ORDER_PRIORS).join(', ')}`);
  if (Q.like && !BUG_SPECIES[Q.like]) throw new Error(`bug: like '${Q.like}' is not a worked bug (${Object.keys(BUG_SPECIES).join(', ')})`);
  const { over: _po, ...priorTraits } = prior || {};
  const P = prior ? { ...priorTraits, foreLegs: prior.foreLegs ?? prior.legs, hindLegs: prior.hindLegs ?? prior.legs } : {};
  // an order's prior names every part it wears: palps it does not name are absent (no scorpion pincers on a moth)
  if (prior && !('palps' in prior)) P.palps = null;
  const T = { ...P, ...(Q.traits || {}) };
  if (T.legs && !Q.traits?.foreLegs && !prior?.foreLegs) T.foreLegs = T.legs;
  if (T.legs && !Q.traits?.hindLegs && !prior?.hindLegs) T.hindLegs = T.legs;
  const ranked = Object.entries(BUG_SPECIES).map(([id, S]) => {
    const t = traitsOf(S); let score = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) if (k in T) score += same(t[k], T[k]) ? w : 0;
    if (Q.order && S.order === Q.order) score += 2;
    if (Q.length > 0) score -= 0.5 * Math.abs(Math.log(Q.length / S.length));
    return { id, score: Math.round(score * 100) / 100 };
  }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const basis = Q.like || ranked[0].id, B = clone(BUG_SPECIES[basis]), have = traitsOf(B), worn = [];
  const wear = (k, fn) => { if (k in T && !same(have[k], T[k])) { fn(T[k]); worn.push(`${k}: ${JSON.stringify(have[k])} → ${JSON.stringify(T[k])}`); } };
  wear('head', (v) => { B.head = v; }); wear('trunk', (v) => { B.trunk = v; delete B.pronotum; }); wear('tail', (v) => { B.tail = v; });
  // legs worn anew drop the paint on the old legs' parts (a chela's palm is gone with the cheliped)
  const legPaintGone = () => { if (B.markings) B.markings = B.markings.filter((m) => typeof m.on !== 'string' || !/^leg\d/.test(m.on)); };
  wear('legs', (v) => { B.legs = { form: v }; legPaintGone(); });
  wear('foreLegs', (v) => { B.legs = { ...(B.legs || {}), fore: { form: v } }; legPaintGone(); });
  wear('hindLegs', (v) => { B.legs = { ...(B.legs || {}), hind: { form: v } }; legPaintGone(); });
  wear('antennae', (v) => { B.antennae = v; }); wear('mouth', (v) => { B.mouth = v ?? 'none'; }); wear('eyes', (v) => { B.eyes = v ?? 'none'; });
  wear('palps', (v) => { if (v) B.palps = { form: v }; else delete B.palps; });
  wear('wings', (v) => { if (!v || !v.length) delete B.wings; else B.wings = { pose: T.wingPose ?? B.wings?.pose ?? 'flat', pairs: v }; });
  if (T.wingPose && B.wings && !Array.isArray(B.wings) && B.wings.pose !== T.wingPose) { worn.push(`wingPose: ${B.wings.pose} → ${T.wingPose}`); B.wings.pose = T.wingPose; delete B.wings.poseOver; B.wings.pairs = B.wings.pairs.map((w) => { if (!w || typeof w !== 'object') return w; const { poseOver: _p, ...rest } = w; return rest; }); }
  wear('extras', (v) => { B.extras = v.map((kind) => (B.extras || []).find((x) => x.kind === kind) || { kind, len: kind === 'metasoma' ? 1 : 0.1, r: kind === 'metasoma' ? 0.05 : 0.01 }); });
  // markings painted on a part the bug no longer wears are dropped with it
  // (a wing marking needs a blade of that pair; an elytron marking needs elytra)
  const pairs = B.wings ? (Array.isArray(B.wings) ? B.wings : B.wings.pairs || []).map(formOf) : [];
  const parts = new Set(['head', 'trunk', 'tail', 'legs', ...(B.pronotum ? ['pronotum'] : []), ...(B.neck ? ['neck'] : []),
    ...(pairs.includes('elytra') ? ['elytron'] : []), ...(pairs[0] && pairs[0] !== 'elytra' ? ['wingFore'] : []), ...(pairs[1] && pairs[1] !== 'elytra' ? ['wingHind'] : [])]);
  if (B.markings) B.markings = B.markings.filter((m) => typeof m.on !== 'string' || parts.has(m.on) || /^(leg|palp)/.test(m.on));
  if (Q.length > 0) B.length = Q.length;
  if (Q.name) B.name = Q.name;
  if (Q.colors) B.colors = { ...(B.colors || {}), ...Q.colors };
  for (const [k, v] of Object.entries({ ...(prior?.over || {}), ...(Q.over || {}) })) B[k] = v && typeof v === 'object' && !Array.isArray(v) && B[k] && typeof B[k] === 'object' && !Array.isArray(B[k]) ? { ...B[k], ...clone(v) } : clone(v);
  B.order = Q.order ?? B.order;
  return { bauplan: B, basis, score: ranked.find((r) => r.id === basis).score, ranked: ranked.slice(0, 3), worn };
}
