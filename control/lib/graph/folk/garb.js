/**
 * THE TOWN'S WARDROBE AND STANCES: what each of a town's people wears and how each stands, so a street is not one
 * outfit and one idle repeated. The CULTURE stays the town's (its kit's underlayer: hero-looks.js UNDERLAYERS, its
 * family of cloth and its shoes); the CUT is the person's: their role's garb, varied by their own dice within it.
 *
 *   garbOf(person, rail)  → the outfit language over the rail's (outfit/styles.js: top { sleeve, hem }, bottom
 *                           { leg } or { kind: 'skirt', leg, cut }, outer { … }, feet): by role, then the person's dice
 *     townie, partner     a tunic or a shirt, its sleeve one of four lengths; long legs or capris; a grown woman of the
 *                         house in a long skirt as often as not
 *     keeper              a shirt with its sleeves to the elbow under an open vest: the counter's
 *     master, apprentice  short sleeves, legs to the calf, boots: the work floor's
 *     farmhand, hand      short sleeves, legs to the knee or the calf, boots: the fields'
 *     elder               a long coat over a long top: the hall's
 *     child               short sleeves, legs to the knee
 *     the watch, a rank   their uniform (the service's, bodies.js wearUniform), not varied here
 *   stanceOf(person)      → { gesture, idle } how they stand: `gesture` the hero door's stand (hero-gesture.js: relaxed,
 *                           hand-on-hip, a turn or a tilt of the head) minted into their body, `idle` which plays while
 *                           they stand: 'own' (the gesture held), 'library' (the shared idle, breathing) or 'crouch'
 *                           (the library's crouch: a worker at the work floor, a farmhand, a child at play)
 *
 * Pure: a person's dice are their path's, so a town dresses the same on every read and only grows.
 */
const hash = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
// the n-th die of a person, 0 to 1
const die = (p, n) => (hash(`${p.path}:${n}`) % 10007) / 10007;
const pick = (p, n, xs) => xs[Math.floor(die(p, n) * xs.length)];

const isChild = (p) => p.sheet?.facets?.age === 'child';
const isWoman = (p) => p.sheet?.facets?.pole === 'female';

export function garbOf(p, rail) {
  const L = rail?.language ?? {}, top0 = L.top ?? {}, bottom0 = L.bottom ?? {};
  // (the culture's own: its shoes under every cut but the work's boots)
  const shod = (o) => (L.feet !== undefined && o.feet === undefined ? { ...o, feet: L.feet } : o);
  return shod(cutOf(p, L, top0, bottom0));
}
function cutOf(p, L, top0, bottom0) {
  const top = (o) => ({ ...top0, ...o }), trousers = (o) => ({ ...bottom0, kind: 'trousers', ...o });
  if (isChild(p)) return { top: top({ sleeve: 'short', hem: 'hip' }), bottom: trousers({ leg: 'knee' }) };
  const role = p.as === 'hand' ? 'farmhand' : p.as === 'apprentice' ? 'master' : p.role;
  if (role === 'keeper') return { top: top({ sleeve: 'elbow', hem: 'hip' }), bottom: trousers({ leg: 'long' }), outer: { family: top0.family ?? 'woven', sleeve: 'none', hem: 'hip', open: true } };
  if (role === 'master') return { top: top({ sleeve: 'short', hem: 'hip' }), bottom: trousers({ leg: 'capri' }), feet: 'boots' };
  if (role === 'farmhand') return { top: top({ sleeve: 'short', hem: 'hip' }), bottom: trousers({ leg: pick(p, 1, ['knee', 'capri']) }), feet: 'boots' };
  if (role === 'elder') return { top: top({ sleeve: 'long', hem: 'hip' }), bottom: trousers({ leg: 'long' }), outer: { family: top0.family ?? 'woven', sleeve: 'long', hem: pick(p, 1, ['midi', 'maxi']), open: false } };
  // a townie, a partner: the house's own clothes, cut by the person's dice
  const sleeve = pick(p, 2, ['short', 'elbow', 'threeQuarter', 'long']), hem = pick(p, 3, ['hip', 'tunic']);
  const skirt = isWoman(p) && die(p, 4) < 0.5;
  return { top: top({ sleeve, hem: skirt ? 'hip' : hem }), bottom: skirt ? { family: bottom0.family ?? 'woven', kind: 'skirt', leg: pick(p, 5, ['midi', 'maxi']), cut: pick(p, 6, ['aline', 'full']) } : trousers({ leg: pick(p, 5, ['long', 'long', 'capri']) }) };
}

// the stands a grown person may hold (hero-gesture.js GESTURE_PRESETS and their head words); a child stands relaxed (the
// other stands are drawn for grown casts)
const STANDS = Object.freeze([['relaxed'], ['hand-on-hip'], ['relaxed', { head: { yaw: 18 } }], ['relaxed', { head: { pitch: -10 } }], ['hand-on-hip', { head: { yaw: -15 } }]]);
export function stanceOf(p) {
  if (isChild(p)) return { gesture: ['relaxed'], idle: die(p, 7) < 0.4 ? 'crouch' : 'library' };
  const role = p.as === 'hand' ? 'farmhand' : p.as === 'apprentice' ? 'master' : p.role;
  // (at their work: a worker crouched at it as often as not; one at a counter or a hall holds their stand)
  if ((role === 'master' || role === 'farmhand') && die(p, 7) < 0.5) return { gesture: ['relaxed'], idle: 'crouch' };
  if (role === 'keeper' || role === 'elder') return { gesture: pick(p, 8, [['relaxed'], ['hand-on-hip']]), idle: 'own' };
  return { gesture: pick(p, 8, STANDS), idle: die(p, 9) < 0.55 ? 'own' : 'library' };
}
