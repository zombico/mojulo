/**
 * brawl moves — the brawler's buttons, over the fight's library (rows on it, not a second library). Three buttons and
 * the stick, Final Fight's simplification of the fight's primitives:
 *
 *   attack (A)   the CHAIN: on the ground, each press while the last blow connected throws the next (jab, jab, body
 *                blow, … the style's); the last knocks down, and with the stick toward the foe on the last press a
 *                different finisher. A whiff ends it: the next press starts it again.
 *                In the air: a jump with a direction its jump kick (the fighter's air.H), a jump straight up its stomp
 *                (air.M).
 *                Holding a body (walk into one, brawl-core.js the clinch): a knee; with the stick toward or away, a
 *                throw that way (taken from behind, the suplex).
 *   jump (J)     a jump the way the stick points (along and across the street), held two frames for an attack with it
 *   A + J        the DESPERATION (the library's `whirl`): invincible, all round, it knocks down what it meets and
 *                costs a slice of health when it lands; it breaks a hold on the held body
 *   special (S)  the fighter's signature special from the library (S with the stick toward or away the special at
 *                that direction, otherwise at neutral; across the street, at down); holding a weapon, it throws it
 *   (attack over a thing on the street picks it up: the core's, brawl-core.js)
 *
 *   BRAWL_STYLES[archetype] = { says, chain, finisher?, grab }   the fighting style: its chain (the fight's slots, in
 *                order), the forward finisher's slot, its grabs' strength (% of the brawl's knee and suplex, of the
 *                fighter's throw)
 *   brawlFighter(recipe, { style? })  → the fight's compiled fighter (versus-compile.js) with the brawler's rows:
 *                `chain.1` … `chain.n` (each following on to the next on a connect), `chain.nf` the forward finisher,
 *                `desperate`, and `brawl` { style, chain, knee, suplex, throw } (the core reads its grabs' strength)
 *   newReader() / readButtons(reader, buttons, body, F) → [pad, reader']: a seat's buttons this frame
 *                ({ x, z, a, j, s }, held) into the core's command (brawl-core.js pad), the press remembered BUFFER
 *                frames until the body takes it
 *
 * Pure: no clock, no dice.
 */
import { compileFighter } from '../versus/versus-compile.js';
import { SPECIALS } from '../versus/versus-library.js';

/** the desperation: the library's special with a price (the whirl) */
export const DESPERATION = Object.keys(SPECIALS).find((id) => SPECIALS[id].price);
/** frames a press is kept for until the body can take it; frames a jump waits for an attack to make it the desperation */
export const BUFFER = 4, JUMP_WAIT = 2;

const style = (says, chain, finisher, grab) => Object.freeze({ says, chain: Object.freeze(chain), finisher, grab: Object.freeze(grab) });
/**
 * THE STYLES, by the fighter's archetype (versus-solver.js ARCHETYPES): the chain (the fight's normals in order, the
 * last the knockdown), the forward finisher, and its grabs (%: the knee and the suplex of the brawl's, the throw of
 * the fighter's own).
 */
export const BRAWL_STYLES = Object.freeze({
  'all-rounder': style('jab, jab, a straight, a roundhouse to the floor; forward on the last, the sweep', ['stand.L', 'stand.L', 'stand.M', 'stand.H'], 'crouch.H', { knee: 100, suplex: 100, throw: 100 }),
  rushdown: style('the fast chain: three jabs, a hook, a kick to the floor; light grabs', ['stand.L', 'stand.L', 'stand.L', 'stand.M', 'stand.H'], 'crouch.H', { knee: 90, suplex: 90, throw: 90 }),
  zoner: style('the long chain: a jab, a long kick, a roundhouse at reach; forward on the last, the sweep', ['stand.L', 'stand.M', 'stand.H'], 'crouch.H', { knee: 100, suplex: 100, throw: 100 }),
  grappler: style('the heavy chain: two hooks and an uppercut; the strongest knees, throws and the piledriver of a suplex', ['stand.M', 'stand.M', 'stand.H'], 'crouch.H', { knee: 130, suplex: 170, throw: 140 }),
});
export const BRAWL_STYLE_IDS = Object.freeze(Object.keys(BRAWL_STYLES));

const KNEE = 40, SUPLEX = 150;   // (the brawl core's knee and suplex, BRAWL_RULES: a style's grabs are its share of them)

/** The brawler's fighter: the fight's compiled record and the brawler's rows over it. */
export function brawlFighter(recipe, { style: id } = {}) {
  const sid = id ?? recipe.archetype ?? 'all-rounder';
  const S = BRAWL_STYLES[sid];
  if (!S) throw new Error(`brawl: a style is one of ${BRAWL_STYLE_IDS.join(', ')}`);
  const F = compileFighter(recipe);
  // (the desperation compiled on the same body and stance, as a special at down; the brawler's own slot)
  const D = compileFighter({ ...recipe, specials: { ...(recipe.specials ?? {}), down: { id: DESPERATION } } }).moves['special.down.M'];
  const moves = { ...F.moves, desperate: { ...D, slot: 'desperate' } };
  const n = S.chain.length;
  S.chain.forEach((src, k) => {
    if (!F.moves[src]) throw new Error(`brawl: style ${sid}'s chain names ${src}, which the fighter has not`);
    const last = k === n - 1;
    const next = last ? [] : k === n - 2 && S.finisher ? [`chain.${n}`, `chain.${n}f`] : [`chain.${k + 2}`];
    moves[`chain.${k + 1}`] = { ...F.moves[src], slot: `chain.${k + 1}`, chain: next, ...(last ? { knock: 'down' } : {}) };
  });
  if (S.finisher) moves[`chain.${n}f`] = { ...F.moves[S.finisher], slot: `chain.${n}f`, chain: [], knock: 'down' };
  const pct = (v, p) => Math.round((v * p) / 100);
  return { ...F, moves, brawl: { style: sid, chain: n, knee: pct(KNEE, S.grab.knee), suplex: pct(SUPLEX, S.grab.suplex), throw: pct(F.moves.throw.damage, S.grab.throw) } };
}

/** A seat's reader: the presses it remembers. */
export const newReader = () => ({ pa: 0, pj: 0, ps: 0, a: 99, j: 99, s: 99, want: null, keep: 0, jump: -1, hold: null, hk: 0, kn: 0, tk: 0 });

/** What the next press of attack is, for this body now. */
function attackOf(body, F, x) {
  if (body.st === 'air' || body.st === 'prejump') return body.jx ? 'air.H' : 'air.M';
  const n = F.brawl.chain;
  const k = body.mv && body.mv.startsWith('chain.') ? parseInt(body.mv.slice(6), 10) : 0;
  if (!k) return 'chain.1';
  if (k >= n) return null;
  return k + 1 === n && x === body.face && F.moves[`chain.${n}f`] ? `chain.${n}f` : `chain.${k + 1}`;
}
function specialOf(body, F, x, z) {
  const dir = x && x === body.face ? 'forward' : x ? 'back' : z ? 'down' : 'neutral';
  for (const d of [dir, 'neutral', 'forward', 'back', 'down']) if (F.moves[`special.${d}.M`]) return `special.${d}.M`;
  return null;
}

/** A seat's buttons this frame → [the core's pad, the reader after]. */
export function readButtons(reader, buttons, body, F) {
  const r = { ...reader };
  const x = Math.sign(buttons.x ?? 0), z = Math.sign(buttons.z ?? 0);
  const aP = !!buttons.a && !r.pa, jP = !!buttons.j && !r.pj, sP = !!buttons.s && !r.ps;
  r.pa = buttons.a ? 1 : 0; r.pj = buttons.j ? 1 : 0; r.ps = buttons.s ? 1 : 0;
  r.a = aP ? 0 : Math.min(99, r.a + 1); r.j = jP ? 0 : Math.min(99, r.j + 1); r.s = sP ? 0 : Math.min(99, r.s + 1);
  // (a press taken: the body has started what it asked for)
  if (r.want && body.mv === r.want) { r.want = null; r.keep = 0; }
  if (r.keep > 0) r.keep--; else r.want = null;
  const pad = { x, z };
  // holding a body: a knee, or a throw toward or away (kept, as a press is, until the body is free to take it)
  if (body.st === 'hold') {
    // (taken once the body has kneed since the press)
    if (r.hk > 0 && body.kn !== r.kn) r.hk = 0;
    if (aP) { r.hold = x === body.face ? 'forward' : x === -body.face ? 'back' : 'knee'; r.hk = BUFFER; r.kn = body.kn; }
    const out = { x: 0, z: 0 };
    if (r.hk > 0) { out.hold = r.hold; r.hk--; }
    return [out, r];
  }
  r.hk = 0;
  // attack and jump together, within the jump's wait: the desperation (the jump not taken)
  if ((aP && r.j <= JUMP_WAIT) || (jP && r.a <= JUMP_WAIT)) {
    r.want = 'desperate'; r.keep = BUFFER; r.jump = -1; r.a = 99; r.j = 99;
  } else {
    if (jP) r.jump = JUMP_WAIT;
    if (aP) { const w = attackOf(body, F, x); if (w) { r.want = w; r.keep = BUFFER; } }
    if (sP && body.wpn) r.tk = BUFFER;
    else if (sP) { const w = specialOf(body, F, x, z); if (w) { r.want = w; r.keep = BUFFER; } }
  }
  if (r.jump >= 0 && r.jump-- === 0) pad.jump = true;
  // (a throw of the weapon, kept until the body is free to throw it)
  if (r.tk > 0) { if (body.wpn) { pad.toss = true; r.tk--; } else r.tk = 0; }
  if (r.want) pad.mv = r.want;
  return [pad, r];
}
