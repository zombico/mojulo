/**
 * brawl kinetics — rupa's KNOCKBACK on the street: a power's blow carries energy, joules, as well as damage, and what it
 * does to a body is the body's mass against it (docs/rupa.md, "Natural knockback"; the law worlds/controllable/knock.js
 * moves a world's bodies by, held to the same numbers by brawl-kinetics.test.js). That page builder is import-free by its
 * contract and this module is inlined into the street's page (brawl-page.js BRAWL_PAGE_MODULES), so the law is written
 * here again and the test holds the two together.
 *
 *   KINETIC  a direct hit's energy pushes what it strikes along the blow
 *   IMPACT   energy released where a power meets the ground (a nova where it lands, a storm round its caster): the ground
 *            takes seven tenths (GROUND: the dust ring the page draws), and the rest spreads as a shock, each body near
 *            taking the share its frontal area fills of the hemisphere at its distance, A / 2π(d + r₀)², so it falls off
 *            with distance and a big body takes more than a small one
 *   HOLD     a standing body holds by its footing, μ·m·g over a short slip (μ 0.6, 15 cm); in the air nothing holds it
 *   THROW    what passes its hold is thrown: v = √(2·(E − hold)/m), the play cap over it. Light things fly, heavy things
 *            only stagger: past TOPPLE (7 m/s) a knockdown, under it a stagger
 *   SLIDE    a thrown body flies its arc, then slides until friction stops it (μₖ·g)
 *
 * POWER SETS THE FICTION, THE CAP THE PLAY (rupa's posture): the law's speed decides who is floored and who staggers and
 * by how much; the street plays the motion at its own pace (PACE, its cap STREET_CAP), so a thrown body crosses a
 * beat-em-up's distance and never the whole screen in a beat.
 *
 * A body's MASS is its frame's: a person's 75 kg at 1.8 m, scaled by the cube of its height, and a big body (a grappler's
 * frame: a heavy, a boss) HEAVY times that; its frontal AREA a person's 0.5 m² by the square of its height.
 *
 *   KINETICS                     the law's numbers (rupa's and the street's play)
 *   massOf(F) · areaOf(F)        a compiled fighter's mass (kg) and frontal area (m²)
 *   holdOf(b, m) · throwSpeed(m, joules, hold) · shareOf(area, d)   the law
 *   readKnock(v, at?)            → { kinetic?, impact?, lift? } a power's energy as written (joules, or a word: tap, light,
 *                                heavy, massive), checked
 *   kick(s, ctx, { by, hit?, kin, from, face, touchable }) → the blow's energy laid on the street: `hit` (the body struck)
 *                                pushed along the blow by its kinetic; an impact at `from` ({ x, z } mm, its first landing
 *                                only) spread over every touchable body of the other side; events `impact` { x, z, ground }
 *                                and `thrown` { p, v } (v the law's, m/s)
 *   landSlide(p) · slideOn(p)    a thrown body landing (its way becomes its slide), and sliding on a frame
 *
 * Pure: plain numbers, no clock, no dice.
 */
export const KINETICS = Object.freeze({
  G: 9.81, MU: 0.6, MU_K: 0.5, SLIP: 0.15, R0: 0.5, GROUND: 0.7, TOPPLE: 7, CAP: 40,
  MASS: 75, AREA: 0.5, HEAVY: 1.8,
  // (the street's play: the thrown body's speed on the street a share of the law's, held to its cap, m/s)
  PACE: 0.5, STREET_CAP: 6,
});
export const KNOCK_WORDS = Object.freeze({ tap: 50, light: 300, heavy: 3000, massive: 30000 });
const K = KINETICS, MM = 1000 / 60;   // m/s → mm a frame

const heightOf = (F) => (F && F.body && F.body.height > 0 ? F.body.height : 1800) / 1800;
const big = (F) => !!(F && F.brawl && F.brawl.style === 'grappler');
export const massOf = (F) => Math.round(K.MASS * heightOf(F) ** 3 * (big(F) ? K.HEAVY : 1));
export const areaOf = (F) => Math.round(K.AREA * heightOf(F) ** 2 * (big(F) ? 1.3 : 1) * 1000) / 1000;
const standing = (b) => b.y <= 0 && b.st !== 'fall';
export const holdOf = (b, m) => (standing(b) ? K.MU * m * K.G * K.SLIP : 0);
export const throwSpeed = (m, joules, hold) => (joules > hold ? Math.min(K.CAP, Math.sqrt((2 * (joules - hold)) / m)) : 0);
export const shareOf = (area, d) => Math.min(1, area / (2 * Math.PI * Math.pow(Math.max(0, d) + K.R0, 2)));

const joules = (v) => (typeof v === 'number' && v > 0 ? v : KNOCK_WORDS[v] || 0);
/** A power's energy as written: { kinetic?, impact?, lift? } in joules or words. */
export function readKnock(v, at = 'knock') {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`brawl: ${at} is { kinetic?, impact?, lift? } (joules, or ${Object.keys(KNOCK_WORDS).join(', ')})`);
  for (const k of Object.keys(v)) if (!['kinetic', 'impact', 'lift'].includes(k)) throw new Error(`brawl: ${at}.${k} is not a knock's word (kinetic, impact, lift)`);
  for (const k of ['kinetic', 'impact']) if (v[k] !== undefined && !(joules(v[k]) > 0 && joules(v[k]) <= 1e7)) throw new Error(`brawl: ${at}.${k} is joules (up to 1e7) or ${Object.keys(KNOCK_WORDS).join(', ')}`);
  if (v.lift !== undefined && !(typeof v.lift === 'number' && v.lift >= 0 && v.lift <= 1)) throw new Error(`brawl: ${at}.lift is how much the blow lifts, 0 to 1`);
  return { ...(v.kinetic !== undefined ? { kinetic: joules(v.kinetic) } : {}), ...(v.impact !== undefined ? { impact: joules(v.impact) } : {}), ...(v.lift !== undefined ? { lift: v.lift } : {}) };
}

/** A body thrown at the law's speed `v` (m/s) away along `dir` (±1 along the street, `dz` across), lifted by `lift`. */
function throwBody(s, b, v, dir, dz, lift) {
  if (!(v > 0)) return;
  const play = Math.round(Math.min(K.STREET_CAP, v * K.PACE) * MM), side = Math.round(play * dz);
  if (v >= K.TOPPLE || b.ko) {
    // (a knockdown: up and away in an arc, then the slide)
    b.st = 'fall'; b.sf = 0; b.mv = null; b.air = 0;
    b.rx = { k: 'down', h: 1, w: 2, c: 0 };
    b.vx = dir * play; b.vz = side; b.vy = Math.round(30 + play * (0.4 + lift));
    if (b.y <= 0) b.y = 1;
    b.ks = 1; b.jug = (b.jug ?? 0) + 1;
  } else if (b.st !== 'fall' && b.st !== 'down' && b.st !== 'ko') {
    // (a stagger: shoved back on its feet, as far as the law lets it)
    b.st = 'hit'; b.sf = 0; b.mv = null; b.stun = Math.max(b.stun ?? 0, 12 + Math.round(v * 2));
    b.rx = { k: 'hit', h: 1, w: 1, c: 0 };
    b.pushv = dir * Math.max(1, Math.round(play / 2)); b.pushn = 8;
  }
  s.events.push({ t: 'thrown', p: b.id, v: Math.round(v * 10) / 10 });
}

/** The blow's energy on the street: the struck body pushed along it, an impact's shock over the other side's bodies. */
export function kick(s, ctx, { by, hit = null, kin, from, face, touchable = () => true }) {
  const lift = kin.lift ?? 0.2;
  if (hit && kin.kinetic) {
    const F = ctx.fighters[hit.fi], m = massOf(F);
    throwBody(s, hit, throwSpeed(m, kin.kinetic, holdOf(hit, m)), face, 0, lift);
  }
  if (kin.impact && from) {
    const rest = (1 - K.GROUND) * kin.impact;
    s.events.push({ t: 'impact', p: by.id, x: from.x, z: from.z, ground: Math.round(K.GROUND * kin.impact) });
    for (const o of s.bodies) {
      if (o.side === by.side || o.gone || o.aw || !touchable(o)) continue;
      const F = ctx.fighters[o.fi], m = massOf(F), dx = (o.x - from.x) / 1000, dz = (o.z - from.z) / 1000, d = Math.hypot(dx, dz);
      const v = throwSpeed(m, rest * shareOf(areaOf(F), d), holdOf(o, m));
      // (away from where it landed: along the street, a little across it; one right on it goes the way the blow went)
      const dir = d > 0.05 ? Math.sign(dx) || face : face, across = d > 0.05 ? dz / d : 0;
      throwBody(s, o, v, dir, across * 0.5, Math.min(1, lift + 0.5 / (1 + d)));
    }
  }
}

/** A thrown body on the floor slides on, friction stopping it (μₖ·g); its slide kept in hundredths of a mm a frame, so
 * the state stays whole numbers. */
const DRAG = Math.round((K.MU_K * K.G * 100000) / 3600);
/** a thrown body landing: its way along the floor becomes its slide */
export function landSlide(p) {
  if (!p.ks) return;
  delete p.ks;
  if (p.vx) p.sx = p.vx * 100;
  if (p.vz) p.sz = p.vz * 100;
}
export function slideOn(p) {
  if (!p.sx) return;
  p.x += Math.round(p.sx / 100); if (p.sz) p.z += Math.round(p.sz / 100);
  const n = Math.abs(p.sx) - DRAG;
  if (n <= 0) { delete p.sx; delete p.sz; return; }
  if (p.sz) p.sz = Math.round((p.sz * n) / Math.abs(p.sx));
  p.sx = Math.sign(p.sx) * n;
}
