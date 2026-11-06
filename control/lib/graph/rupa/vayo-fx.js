/**
 * rupa/vayo-fx.js — the effects lowered onto RUPA-VAYO's flow (rupa/vayo.js) when a world's composed effect style asks
 * for it (`fxStyle: { flow: true }`): a blast and a power-up drawn as the air moves them, in bold soft shapes, rather
 * than as random sprays, spheres and rings of spikes. What an author wrote keeps its meaning: each part of an explosion
 * is read for what it is and given the flow that part has in the world.
 *
 *   AN EXPLOSION (flowExplosion: an explosion's moment spec, explosions.js readExplosion, raised to its floor)
 *     the fire's body  its CORE, out on the front and rolled up into a ring as it lifts: fewer puffs, larger (a bold
 *                      shape, not a cloud of dots), as wide as the fireball was
 *     the glow inside  the hot core of the core: smaller, sooner, white-hot to the colour (core and shell)
 *     the stem         gone: the ring's roll makes the cap a mushroom needs, and the plume its column
 *     the smoke        a PLUME from the top of the fire, climbing and leaning with the wind
 *     the chips        DEBRIS, thrown along the open ways
 *     the sparks       EMBERS: a third as many, cooling white to red to dark as they slow (a spark is a hot fragment)
 *     an implosion     INFLOW, drawn in on a spiral
 *     the ground ring  the dust SKIRT the blast runs along the ground (a ring of air stays, thin, as the haze)
 *     an author's own sprays keep their flight
 *   A POWER-UP (flowLook: a status's look with an aura, elements.js): its aura's onions and rings of spikes give way to
 *     the flame COLUMN rising and turning round the body, MOTES drawn in to it, pebbles lifting off the ground (MOTES)
 *     and a GUST of dust pushed out along it; its coat stays
 *
 *   flowExplosion(X, F?)   → the spec drawn on the flow ({ …, flow: { size } }); F a composed floor (its glyph map)
 *   flowLook(L, F?)        → the look with its aura drawn on the flow, or the look as it was when it has none
 */

const r3 = (x) => Math.round(x * 1000) / 1000;
const hotRamp = (p) => Array.isArray(p.ramp) && Array.isArray(p.ramp[0]) && Math.min(...p.ramp[0]) > 0.4 && Math.max(...p.ramp[0]) > 0.95;
const greyRamp = (p) => Array.isArray(p.ramp) && p.ramp.every((c) => Array.isArray(c) && Math.max(...c) - Math.min(...c) < 0.15 && Math.max(...c) < 0.6);
const isSoft = (g) => g === 'soft' || g === 'cblob';
// what a part of an explosion is (readExplosion lays them out so: a part says it by its glyph, its source and its ramp)
export function roleOf(p) {
  if (!p || typeof p !== 'object') return 'spray';
  if (p.from === 'shell' && p.v < 0) return 'implode';
  if (isSoft(p.glyph) && p.from === 'ground') return 'stem';
  if (isSoft(p.glyph) && hotRamp(p)) return 'fire';
  if ((p.glyph === 'dot' || p.glyph === 'cdot') && hotRamp(p)) return 'glow';
  if (isSoft(p.glyph) && greyRamp(p)) return 'smoke';
  if (p.glyph === 'chip') return 'debris';
  if (p.glyph === 'streak' || p.glyph === 'spark') return 'sparks';
  return 'spray';
}
const EMBER = [[1, 1, 0.9], [1, 0.72, 0.32], [0.85, 0.28, 0.08], [0.22, 0.08, 0.04]];
const DUST = [0.64, 0.6, 0.54];

/** An explosion's moment spec drawn on the flow. */
export function flowExplosion(X, F = {}) {
  if (!X || !Array.isArray(X.parts)) return X;
  const g = (k) => (F.glyphs && F.glyphs[k]) || k;
  const roles = X.parts.map(roleOf), fire = X.parts[roles.indexOf('fire')], glow = X.parts[roles.indexOf('glow')];
  const stem = roles.includes('stem');
  // the fireball's reach: its body's size was three quarters of it, its glow's 1.1 (readExplosion)
  const R = r3(fire ? fire.size / 0.75 : glow ? glow.size / 1.1 : X.star ? X.star.size * 0.7 : 1);
  const parts = [], map = new Map();
  X.parts.forEach((p, i) => {
    const role = roles[i], n = (k, lo) => Math.max(lo, Math.round(p.count * k));
    let q = null;
    if (role === 'stem') return;
    if (role === 'fire') q = { ...p, flow: 'core', r: R, count: n(0.55, 6), size: r3(p.size * 1.45), front: 0.22, rise: stem ? 1.7 : 1, roll: stem ? 2 : 1.5, swirl: 0.35, grow: 0.5, env: 'steady' };
    else if (role === 'glow') q = { ...p, flow: 'core', r: r3(R * 0.6), count: n(0.5, 4), size: r3(p.size * 1.15), front: 0.18, rise: 1, roll: 1.2, swirl: 0.5, grow: 0.4 };
    else if (role === 'smoke') q = { ...p, flow: 'smoke', r: R, count: n(0.6, 5), size: r3(p.size * 1.7), rise: stem ? 1.6 : 1, grow: 1.6, swirl: 0.25 };
    else if (role === 'debris') q = { ...p, flow: 'debris', r: R, v: p.v, drag: 0.6, gravity: 1 };
    else if (role === 'sparks') { const { color: _c, ...rest } = p; q = { ...rest, flow: 'embers', r: R, count: n(1 / 3, 4), v: r3(p.v * 1.1), drag: 2.2, gravity: 0.25, life: r3(p.life * 1.2), ramp: EMBER }; }
    else if (role === 'implode') q = { ...p, flow: 'inflow', r: p.r, swirl: 1.2 };
    else q = p;
    map.set(i, parts.length);
    parts.push(q);
  });
  // the ground's ring: the dust the blast runs along the ground (an echo of it, the floor's, is the same ring)
  const ground = (X.rings || []).filter((r) => !r.air && !r.inward && !r.dark);
  if (ground.length) {
    const reach = Math.max(...ground.map((r) => r.r)), first = ground.reduce((a, b) => ((a.delay || 0) <= (b.delay || 0) ? a : b));
    parts.push({ glyph: g('soft'), flow: 'skirt', count: 20, trail: 1, life: r3(first.life * 2.6), size: r3(R * 0.55), r: R, reach: r3(Math.max(1.2, reach / R)), front: 0.3, lift: 0.35, env: 'ends', delay: first.delay || 0, stagger: 0, color: DUST });
  }
  const rings = (X.rings || []).filter((r) => r.air || r.inward || r.dark);
  const out = { ...X, parts, rings, key: (X.key || []).filter((i) => map.has(i)).map((i) => map.get(i)), flow: { size: R } };
  // how long it plays: its last part out (as readExplosion reckons it)
  const ends = [...parts.map((p) => (p.delay || 0) + (p.stagger || 0) + p.life * 1.15 + ((p.trail || 1) - 1) * (p.lag || 0)), ...rings.map((r) => (r.delay || 0) + r.life),
    out.star ? (out.star.delay || 0) + out.star.life : 0, out.scorch ? (out.scorch.delay || 0) + out.scorch.life : 0, out.comic ? (out.comic.delay || 0) + out.comic.life : 0,
    out.pool ? (out.pool.delay || 0) + out.pool.life : 0, out.bloom ? (out.bloom.delay || 0) + out.bloom.life : 0];
  out.dur = Math.round((Math.max(...ends) + 0.1) * 1000) / 1000;
  return out;
}

/** A status's look with its aura drawn on the flow (its coat kept); a look with no aura as it was. */
export function flowLook(L, F = {}) {
  if (!L || !L.aura) return L;
  const g = (k) => (F.glyphs && F.glyphs[k]) || k, c = Array.isArray(L.color) ? L.color : [1, 0.84, 0.28];
  const hot = c.map((x) => r3(x + (1 - x) * 0.55));
  const { aura: _a, ...rest } = L;
  const drift = [
    // the flames: a coloured shell rising round the body and turning (a bold shape that keeps its colour on any ground),
    // and inside it a white-hot core of added light
    { glyph: 'tongue', flow: 'column', count: 22, trail: 1, life: 0.8, size: 0.7, r: 0.5, height: 2.5, swirl: 0.35, env: 'ends', color: c },
    { glyph: g('dot'), flow: 'column', count: 14, trail: 1, life: 0.6, size: 0.55, r: 0.35, height: 2.0, swirl: 0.5, env: 'ends', color: hot },
    // motes drawn in to it on a spiral, from round the chest
    { glyph: g('spark'), flow: 'inflow', count: 12, trail: 1, life: 0.75, size: 0.09, r: 1.8, z: 1, swirl: 1.2, env: 'in', color: hot },
    // pebbles lifting off the ground round the feet
    { glyph: 'chip', flow: 'motes', count: 10, trail: 1, life: 2.4, size: 0.12, r: 0.9, height: 1.3, env: 'ends', spin: 0.6, color: [0.38, 0.34, 0.3] },
    // a ring of dust pushed out along the ground
    { glyph: g('soft'), flow: 'gust', count: 12, trail: 1, life: 1.2, size: 0.45, r: 0.5, reach: 3.2, from: 0.3, lift: 0.1, env: 'ends', color: DUST },
  ];

  return { ...rest, drift: [...drift, ...(Array.isArray(L.drift) ? L.drift.filter((s) => !(s.gravity < 0 && (s.glyph === 'spark' || s.glyph === 'streak'))) : [])] };
}
