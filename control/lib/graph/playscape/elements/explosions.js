/**
 * playscape explosions — BLASTS set off at a place or a character's feet (the cast's `explode { at | who, is }`, and a
 * beam's impact). An explosion is parts, each a function of time the moment channel already draws (sprays, a star,
 * rings) or a few of its own (a scorch, a comic burst), lowered by readExplosion to the moment channel's spec:
 *
 *   flash     { size, life }            a white star at the middle, swelling and gone
 *   fireball  { radius, rise, life, puffs }   puffs thrown out that slow and stop at radius (drag), rising, white to
 *                                       the colour to dark (a ramp)
 *   smoke     { rise, life, puffs }     dark puffs rising and lingering after
 *   debris    { count, speed }          chips thrown up, falling, spinning
 *   sparks    { count, speed }          streaks thrown out, falling
 *   shock     { radius, life }          a ring running out along the ground
 *   shell     { radius, life }          a ring of air round the middle, faster
 *   scorch    { radius, life }          a dark mark left on the ground
 *   comic     { size, spikes, life }    a white starburst with a black ink edge (black and white first)
 *   stem      { height }                a mushroom's column: puffs climbing, and the fireball rides it up
 *   implode   { radius, life }          a ring and lights closing in first; every other part waits for it
 *   light     { k }  ·  shake: 0..1  ·  sprays: [spray] (anything else, elements.js)
 *   count, spread (m), stagger (s)      a chain: count blasts scattered round the spot, one after another
 *
 *   EXPLOSIONS / EXPLOSION_NAMES   presets, by what they do
 *   readExplosion(v, where, table) a preset's name, a name in play.explosions, or its parts → the moment spec
 *   readExplosions(play)           play.explosions, read
 *   explosionSignature(X)          what reads with the colour taken out
 */
import { readColor, colorRGB, readSpray } from './elements.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
export const EXPLOSION_PARTS = Object.freeze(['color', 'flash', 'fireball', 'smoke', 'debris', 'sparks', 'shock', 'shell', 'scorch', 'comic', 'stem', 'implode', 'light', 'shake', 'sprays', 'count', 'spread', 'stagger']);
// each part's fields: [default, lo, hi, what it is]
const FIELDS = {
  flash: { size: [1.6, 0.1, 20, 'its size (m)'], life: [0.25, 0.05, 3, 'seconds'] },
  fireball: { radius: [1.4, 0.1, 30, 'how far it billows (m)'], rise: [0.6, 0, 20, 'how fast it climbs (m/s²)'], life: [1.4, 0.2, 10, 'seconds'], puffs: [26, 1, 80, 'how many puffs'] },
  smoke: { rise: [1.2, 0, 20, 'how fast it climbs (m/s²)'], life: [3, 0.3, 20, 'seconds'], puffs: [16, 1, 80, 'how many puffs'] },
  debris: { count: [14, 1, 80, 'how many chips'], speed: [6, 0.5, 60, 'm/s'] },
  sparks: { count: [24, 1, 120, 'how many'], speed: [8, 0.5, 80, 'm/s'] },
  shock: { radius: [4, 0.2, 60, 'how far it runs (m)'], life: [0.6, 0.05, 6, 'seconds'] },
  shell: { radius: [3, 0.2, 60, 'how far it swells (m)'], life: [0.35, 0.05, 6, 'seconds'] },
  scorch: { radius: [1.6, 0.1, 30, 'its size (m)'], life: [4, 0.3, 30, 'seconds it lingers'] },
  comic: { size: [3, 0.2, 30, 'its size (m)'], spikes: [14, 5, 40, 'how many points'], life: [0.5, 0.1, 4, 'seconds'] },
  stem: { height: [5, 0.5, 60, 'how high it climbs (m)'] },
  implode: { radius: [2.5, 0.2, 30, 'where it closes in from (m)'], life: [0.5, 0.1, 4, 'seconds'] },
  light: { k: [3, 0, 20, 'how bright'] },
};

function readPart(v, k, where) {
  if (v === undefined || v === false) return null;
  const o = v === true ? {} : v;
  if (!isObj(o)) throw new Error(`${where}.${k} is { ${Object.keys(FIELDS[k]).join(', ')} } or true`);
  const bad = Object.keys(o).filter((f) => !FIELDS[k][f]);
  if (bad.length) throw new Error(`${where}.${k} has no ${bad.join(', ')}: it is { ${Object.keys(FIELDS[k]).join(', ')} }`);
  const out = {};
  for (const [f, [d, lo, hi, say]] of Object.entries(FIELDS[k])) {
    const x = o[f] ?? d;
    if (!(num(x) && x >= lo && x <= hi)) throw new Error(`${where}.${k}.${f} is ${say}, ${lo} to ${hi}`);
    out[f] = x;
  }
  return out;
}

const S = (o) => readSpray(o, 'explosion');
const SMOKE = [[0.36, 0.34, 0.31], [0.2, 0.19, 0.18]];
/** An explosion: a preset's name (or one in `table`, play.explosions read), or its parts → the moment channel's spec
 *  { dur, parts, star?, rings, scorch?, comic?, light?, shake?, chain? }. */
export function readExplosion(v, where, table = null) {
  if (typeof v === 'string') {
    const X = (table && table[v]) || EXPLOSIONS[v];
    if (!X) throw new Error(`${where} '${v}' is not an explosion: name a preset (${EXPLOSION_NAMES.join(', ')}), one in play.explosions, or give its parts`);
    return X;
  }
  if (!isObj(v)) throw new Error(`${where} is an explosion: a preset's name, or its parts { ${EXPLOSION_PARTS.join(', ')} }`);
  const bad = Object.keys(v).filter((k) => !EXPLOSION_PARTS.includes(k));
  if (bad.length) throw new Error(`${where} has no ${bad.join(', ')}: an explosion's parts are ${EXPLOSION_PARTS.join(', ')}`);
  const c = colorRGB(v.color === undefined ? [1, 0.55, 0.2] : readColor(v.color, `${where}.color`));
  const P = Object.fromEntries(Object.keys(FIELDS).map((k) => [k, readPart(v[k], k, where)]));
  const parts = [], rings = [], key = [];
  // an implosion comes first: everything else waits for it
  const wait = P.implode ? P.implode.life : 0;
  const out = { color: c, parts, rings };
  if (P.implode) {
    rings.push({ r: P.implode.radius, life: P.implode.life, inward: true });
    parts.push(S({ glyph: 'dot', count: 24, trail: 3, lag: 0.03, from: 'shell', r: P.implode.radius, z: [0.2, 1.6], v: -P.implode.radius / P.implode.life, el: [-20, 20], life: P.implode.life, size: 0.14, env: 'in', color: c }));
  }
  if (P.flash) out.star = { size: P.flash.size, life: P.flash.life, z: 0.8, delay: wait, key: true };
  const rise = P.stem ? P.stem.height / 1.6 : 0;
  if (P.stem) parts.push(S({ glyph: 'soft', count: 24, from: 'ground', r: 0.35, z: 0.2, go: [0, 0, rise], life: 1.8, stagger: 0.6, grow: 1.4, size: 0.7, env: 'ends', delay: wait, ramp: [[1, 0.95, 0.85], c, SMOKE[0]] }));
  if (P.fireball) {
    const F = P.fireball, drag = 4;
    key.push(parts.length);
    // the body: its colour, burnt dark, then smoke; it holds till it has gone to smoke
    parts.push(S({ glyph: 'soft', count: F.puffs, from: 'point', z: F.radius * 0.35, v: F.radius * drag, el: [-35, 90], drag, gravity: -F.rise, go: [0, 0, rise * 0.85], life: F.life, grow: 1.3, size: F.radius * 0.75, env: 'steady', delay: wait, ramp: [[1, 0.8, 0.45], c, [c[0] * 0.45, c[1] * 0.35, c[2] * 0.3], SMOKE[0], SMOKE[1]] }));
    // the glow inside it: added light, white-hot to its colour, gone before the smoke
    key.push(parts.length);
    parts.push(S({ glyph: 'dot', count: Math.ceil(F.puffs * 0.6), from: 'point', z: F.radius * 0.35, v: F.radius * drag * 0.8, el: [-35, 90], drag, gravity: -F.rise, go: [0, 0, rise * 0.85], life: F.life * 0.5, grow: 1, size: F.radius * 1.1, env: 'out', delay: wait, ramp: [[1, 1, 0.85], [1, 0.75, 0.3], c] }));
  }
  if (P.smoke) parts.push(S({ glyph: 'soft', count: P.smoke.puffs, from: 'point', z: 0.6 + (P.stem ? P.stem.height : 0), v: 1.6, el: [0, 90], drag: 1.5, gravity: -P.smoke.rise * 0.3, life: P.smoke.life, grow: 2.4, size: 0.7, env: 'ends', delay: wait + 0.15, ramp: SMOKE }));
  if (P.debris) parts.push(S({ glyph: 'chip', count: P.debris.count, from: 'point', z: 0.3, v: P.debris.speed, el: [25, 80], gravity: 9.8, spin: 2, life: 1.8, size: 0.09, env: 'steady', delay: wait, color: [0.3, 0.27, 0.24] }));
  if (P.sparks) parts.push(S({ glyph: 'streak', count: P.sparks.count, from: 'point', z: 0.5, v: P.sparks.speed, el: [-15, 80], gravity: 9.8, life: 0.9, size: 0.08, env: 'out', delay: wait, color: [1, 0.8, 0.45] }));
  if (P.shock) rings.push({ r: P.shock.radius, life: P.shock.life, delay: wait });
  if (P.shell) rings.push({ r: P.shell.radius, life: P.shell.life, delay: wait, air: true });
  if (P.scorch) out.scorch = { r: P.scorch.radius, life: P.scorch.life, delay: wait };
  if (P.comic) out.comic = { size: P.comic.size, spikes: P.comic.spikes, life: P.comic.life, delay: wait };
  if (P.light || P.flash || P.fireball) out.light = { k: P.light ? P.light.k : 3, life: 0.45, z: 1, delay: wait };
  if (v.sprays !== undefined) (Array.isArray(v.sprays) ? v.sprays : [v.sprays]).forEach((x, i) => parts.push(readSpray(x, `${where}.sprays[${i}]`)));
  if (v.shake !== undefined) { if (!(num(v.shake) && v.shake > 0 && v.shake <= 1)) throw new Error(`${where}.shake is 0..1`); out.shake = v.shake; }
  if (v.count !== undefined || v.spread !== undefined || v.stagger !== undefined) {
    const count = v.count ?? 3, spread = v.spread ?? 3, stagger = v.stagger ?? 0.2;
    if (!(Number.isInteger(count) && count >= 1 && count <= 16)) throw new Error(`${where}.count is how many blasts in the chain (1 to 16)`);
    if (!(num(spread) && spread >= 0 && spread <= 60)) throw new Error(`${where}.spread is metres round the spot`);
    if (!(num(stagger) && stagger >= 0 && stagger <= 5)) throw new Error(`${where}.stagger is seconds between blasts`);
    if (count > 1) out.chain = { count, spread, stagger };
  }
  if (!parts.length && !rings.length && !out.star && !out.comic && !out.scorch) throw new Error(`${where} has no parts: give at least one of flash, fireball, smoke, debris, sparks, shock, shell, scorch, comic`);
  out.key = key;
  // how long it plays: the last part out
  const ends = [...parts.map((p) => p.delay + p.stagger + p.life * 1.15 + (p.trail - 1) * p.lag), ...rings.map((r) => (r.delay || 0) + r.life), out.star ? wait + out.star.life : 0, out.scorch ? wait + out.scorch.life : 0, out.comic ? wait + out.comic.life : 0];
  out.dur = Math.round((Math.max(...ends) + 0.1) * 1000) / 1000;
  return out;
}

/** play.explosions: { name: parts }, read. */
export function readExplosions(play) {
  const L = play && play.explosions;
  if (L === undefined) return {};
  if (!isObj(L)) throw new Error('play.explosions is { name: { flash?, fireball?, … } }');
  const out = {};
  for (const [k, v] of Object.entries(L)) {
    if (!/^[a-z][a-z0-9-]*$/.test(k)) throw new Error(`play.explosions: '${k}' is a lower-case word`);
    out[k] = readExplosion(v, `play.explosions.${k}`);
  }
  return out;
}

// ── presets: named by what they do ───────────────────────────────────────────────────────────────────────────────
const X = (spec) => readExplosion(spec, 'preset');
export const EXPLOSIONS = Object.freeze({
  // a small burst: a flash, a few sparks, a puff of fire
  pop: X({ flash: { size: 0.9, life: 0.2 }, fireball: { radius: 0.55, rise: 0.4, life: 0.7, puffs: 10 }, sparks: { count: 12, speed: 5 }, shell: { radius: 0.9, life: 0.25 } }),
  // a grenade: fire that billows and stops, smoke after, chips, a ring on the ground, a mark left
  blast: X({ flash: { size: 1.8 }, fireball: { radius: 1.5 }, smoke: {}, debris: {}, sparks: {}, shock: { radius: 4 }, shell: { radius: 2.6 }, scorch: {}, shake: 0.5 }),
  // a column climbing, the fire riding it up into a cap, a ring running far
  mushroom: X({ color: [1, 0.5, 0.15], flash: { size: 3.5, life: 0.4 }, stem: { height: 6 }, fireball: { radius: 2.4, rise: 0.3, life: 3, puffs: 34 }, smoke: { rise: 1.5, life: 4.5, puffs: 22 }, shock: { radius: 10, life: 1.2 }, shell: { radius: 6, life: 0.5 }, scorch: { radius: 3.5, life: 6 }, light: { k: 6 }, shake: 1 }),
  // the manga burst: a white star with a black ink edge, speed lines, no fire
  comic: X({ color: [1, 1, 1], comic: { size: 3.2, spikes: 14, life: 0.55 }, flash: { size: 1.1, life: 0.15 }, sparks: { count: 16, speed: 12 }, shake: 0.4 }),
  // blasts going off one after another round the spot
  chain: X({ flash: { size: 1.1 }, fireball: { radius: 0.9, life: 1, puffs: 14 }, debris: { count: 8 }, scorch: { radius: 1 }, shell: { radius: 1.6 }, count: 5, spread: 3.5, stagger: 0.18, shake: 0.4 }),
  // a ring and lights closing in, then a burst out
  implode: X({ color: [0.62, 0.32, 1], implode: { radius: 2.6, life: 0.55 }, flash: { size: 1.5 }, shell: { radius: 2.6, life: 0.3 }, sparks: { count: 20, speed: 7 }, fireball: { radius: 0.8, life: 0.8, puffs: 12 } }),
});
export const EXPLOSION_NAMES = Object.freeze(Object.keys(EXPLOSIONS));

/** What an explosion reads as with the colour taken out: which parts it has, how big, chained. */
export function explosionSignature(X) {
  const big = (r) => (r > 2 ? 'big' : r > 0.8 ? 'mid' : 'small');
  return [X.comic ? 'ink burst' : '', X.star ? `flash ${big(X.star.size)}` : '', X.parts.map((p) => `${p.glyph}${p.v < 0 ? ' in' : ''}`).join(' '),
    X.rings.map((r) => (r.inward ? 'closing' : r.air ? 'shell' : `ring ${big(r.r / 2)}`)).join(' '), X.scorch ? 'scorch' : '', X.chain ? `chain ${X.chain.count}` : ''].join(' | ');
}
