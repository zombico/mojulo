/**
 * EFFECT STYLE — the style floor every effect is raised to (`fxStyle`, opt-in on a world whose cues fire beams or
 * explosions). Nothing is authored per effect: the RULES read an attack as it is and add what the floor asks for, and an
 * attack that already does a thing keeps its own.
 *
 *   1  NEVER A SIMPLE SHAPE, unless thin (a strand under FX_STYLE.thin wide is a line, and lines are left alone; a ray
 *      under FX_STYLE.laser is a laser, which may stay one beam):
 *      a bolt trails ECHOES (afterimages along its path, each later, narrower and fainter), a ray carries pulse bands
 *      and riding rings, and every attack sprays sparks round its heads
 *   2  LAYERED COLOUR: two companion strands in an analogous hue (FX_STYLE.companion.hue round from the attack's own,
 *      as an offset, so a cue's colour still leads); an ink edge drawn in the attack's own colour, darkened, never black
 *   3  CHIRALITY: the companions braid round the core, turning one way, the hand seeded by the attack (an attack always
 *      turns its own way); an explosion's sprays swirl and spin with it
 *   MATERIAL by colour (materialOf): a warm bolt burns (its head drawn as flame, noise turbulence), a pale ray crackles
 *      (lightning across its spine, forking); anything else stays energy
 *   4  THE PRINCIPLES OF ANIMATION: anticipation (a charge before release when it has none), squash and stretch (a
 *      head stretches along its flight), follow-through (the echoes lag), arcs (a bolt rises on a gentle arc),
 *      secondary action (the sparks), exaggeration (a flash where it lands when it lands on nothing); an explosion's
 *      shock ring is echoed by a second, later and tighter
 *
 *   FX_STYLE                       the floor's numbers
 *   styleBeam(B, seed)             an attack raised to the floor
 *   styleExplosion(X, seed)        an explosion's moment spec raised to the floor
 *   styleEvents(events)            a world's lowered events with every beam and explosion raised (its landings re-read)
 */
import { beamLanding } from '../playscape/elements/beams.js';

export const FX_STYLE = Object.freeze({
  thin: 0.03,                     // metres: a strand this narrow is a line
  laser: 0.08,                    // metres: a ray this narrow is a laser, and a laser may be one beam (no companions)
  ink: 0.38,                      // an ink edge in the attack's own colour at this share, not black: blended, not cut out
  echoes: 3, echoLag: 0.085, echoShrink: 0.74, echoFade: 0.5,
  companion: Object.freeze({ width: 0.28, radius: 1.6, twist: 0.75, hue: 40 }),
  pulse: 7,                       // hz of a ray's bands
  rings: Object.freeze({ every: 1.3, size: 3.2 }),
  charge: Object.freeze({ time: 0.3, size: 2.4 }),   // × the core's width
  stretch: 0.8,
  arc: 0.08,                      // × the strand's speed, metres of rise
  burn: Object.freeze({ hue: [335, 55], chroma: 0.45 }),  // a bolt in these hues (degrees, wrapping), this vivid, burns
  crackle: Object.freeze({ chroma: 0.35, light: 0.72 }),   // a ray this pale (little chroma, light) crackles
  sparks: Object.freeze({ glyph: 'spark', count: 10, from: 'point', r: 0.5, z: [0, 0], v: 1.5, el: [-90, 90], go: [0, 0, 0], gravity: -0.6, swirl: 0, life: 0.45, grow: 0, spin: 0, size: 0.07, env: 'out', delay: 0, stagger: 0, trail: 1, lag: 0.04, drag: 0 }),
  swirl: 0.7, spin: 2.5,
});

// the attack's hand: one way or the other, by a hash of what it is (an attack always turns its own way)
function hand(seed) { let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h & 1 ? 1 : -1; }
const decorated = (B) => B.strands.length > 1 || B.strands.some((S) => S.twist || (S.wave && S.wave[0]));

// the attack's colour as its hue (degrees), chroma (max − min: HSL's saturation calls every pale tint full) and
// lightness, a cue's own colour leading
const rgbOf = (c, B) => (Array.isArray(c) ? c : typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) : Array.isArray(B.color) ? B.color : [1, 1, 1]);
function hcl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d, l];
}
/** The material an attack's colour asks for: a warm bolt BURNS (a head drawn as flame), a pale ray CRACKLES (lightning
 * across its spine), anything else stays energy. */
export function materialOf(B, colour) {
  const core = B.strands && B.strands[0]; if (!core) return null;
  const [h, c, l] = hcl(rgbOf(colour, B));
  if (core.form === 'bolt' && c >= FX_STYLE.burn.chroma && (h <= FX_STYLE.burn.hue[1] || h >= FX_STYLE.burn.hue[0])) return 'fire';
  if (core.form === 'ray' && c <= FX_STYLE.crackle.chroma && l >= FX_STYLE.crackle.light) return 'lightning';
  return null;
}

/** An attack raised to the floor (a new object; the attack given is not changed). `colour`: a cue's own, when it names one. */
export function styleBeam(B, seed = '', colour = null) {
  if (!B || !Array.isArray(B.strands) || !B.strands.length) return B;
  const core = B.strands[0], F = FX_STYLE, chir = hand(seed || JSON.stringify(core));
  if (!(core.width >= F.thin)) return B;   // a line: left as it is
  const out = { ...B, strands: [...B.strands] };
  const bolt = core.form === 'bolt', laser = core.form === 'ray' && core.width < F.laser;
  // the material its colour asks for (materialOf): fire on a warm bolt's head, lightning across a pale ray
  const mat = materialOf(B, colour);
  if (mat === 'fire' && !core.fire) out.strands[0] = { ...out.strands[0], fire: true };
  if (mat === 'lightning' && !core.jag) out.strands[0] = { ...out.strands[0], jag: +Math.max(0.25, core.width * 6).toFixed(3), flicker: 14, forks: 2 };
  // 4 · anticipation: a charge before release
  if (!out.charge) out.charge = { time: F.charge.time, size: +(core.width * F.charge.size).toFixed(3), at: 'hand' };
  const wait = out.charge.time;
  // the core: stretched along its flight, a bolt on a gentle arc (a ray is a beam: straight)
  out.strands[0] = { ...out.strands[0], ...(core.edge !== 'glow' && core.ink == null ? { ink: F.ink } : {}), ...(core.stretch == null && bolt ? { stretch: F.stretch } : {}), ...(bolt && !core.arc && !core.bow ? { arc: +(F.arc * Math.min(core.speed, 12) / 4).toFixed(3) } : {}), ...(core.form === 'ray' && !core.pulse ? { pulse: F.pulse } : {}), delay: Math.max(core.delay || 0, wait) };
  // the copies are the core's path without its material (one bolt of lightning, companions plain), but a flame's echoes
  // burn too: a trail of smaller, fainter flames behind the head
  const { fire: _f, jag: _j, flicker: _fl, forks: _fk, ...plain } = out.strands[0], trail = out.strands[0].fire ? { ...plain, fire: true } : plain;
  // 1 + 3 · companions braiding round the core, an analogous hue, one hand
  if (!decorated(B) && !laser) {
    const C = F.companion, w = +(core.width * C.width).toFixed(4), amp = +(core.width * C.radius).toFixed(4);
    for (const phase of [0, 0.5]) out.strands.push({ ...plain, width: w, head: 1, edge: 'glow', twist: chir * C.twist, wave: [amp, 0], phase, hue: chir * C.hue, stretch: 0 });
  }
  // 1 + 4 · echoes: a bolt's afterimages, each later, narrower, fainter (follow-through)
  if (bolt) for (let k = 1; k <= F.echoes; k++) out.strands.push({ ...trail, width: +(core.width * F.echoShrink ** k).toFixed(4), delay: +(out.strands[0].delay + F.echoLag * k).toFixed(3), alpha: +(F.echoFade ** k).toFixed(3), edge: 'glow', stretch: 0 });
  // 1 · a ray's rings; 4 · secondary action and exaggeration
  if (core.form === 'ray' && !laser && !out.rings) out.rings = { ...F.rings };
  if (!out.sparks) out.sparks = { ...F.sparks };
  if (!out.impact) out.impact = 'flash';
  return out;
}

/** An explosion's moment spec raised to the floor: its sprays swirl and spin one way, its shock ring echoed. */
export function styleExplosion(X, seed = '') {
  if (!X || !Array.isArray(X.parts)) return X;
  const chir = hand(seed || 'blast'), F = FX_STYLE;
  const parts = X.parts.map((p) => ({ ...p, ...(p.swirl ? {} : { swirl: chir * F.swirl }), ...(p.spin ? {} : { spin: chir * F.spin }) }));
  // the ground's shock ring echoed: a second, tighter and later, when the ground has only the one
  const ground = Array.isArray(X.rings) ? X.rings.filter((g) => !g.air) : [];
  const rings = ground.length === 1 ? [...X.rings, { ...ground[0], r: +(ground[0].r * 0.7).toFixed(3), delay: +((ground[0].delay || 0) + 0.09).toFixed(3) }] : X.rings;
  return { ...X, parts, ...(rings ? { rings } : {}) };
}

/** A world's lowered events with every beam and explosion raised to the floor; a beam's landing is re-read from it. */
export function styleEvents(events) {
  if (!events || !Array.isArray(events.reactions)) return events;
  const reactions = events.reactions.map((r) => {
    if (r && r.op === 'beam' && r.spec) {
      const styled = styleBeam(r.spec, r.name || r.by || r.who || '', r.color ?? null), spec = styled.impactSpec ? { ...styled, impactSpec: styleExplosion(styled.impactSpec, styled.impact) } : styled;
      return { ...r, spec, land: beamLanding(spec) };
    }
    if (r && r.op === 'puff' && r.spec && Array.isArray(r.spec.parts)) return { ...r, spec: styleExplosion(r.spec, r.is || '') };
    return r;
  });
  return { ...events, reactions };
}
