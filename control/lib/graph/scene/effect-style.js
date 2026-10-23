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
 *   A COMPOSED floor (juice-style.js juiceFloor: the game's register, anime or western, and its game type's time)
 *   carries the same rules at its own numbers, and over them: an attack's black edge turned to glow, sparks reshaped by
 *   its glyphs, preset puffs made styleable, soft puffs lingering (and tinted) by the register, a halo ring and glints
 *   drifting up where it draws them, shakes by its share, the whole effect played at its rate (speeds × rate, times ÷
 *   rate) and drawn on its drawings a second when a dial asks (`fps`, the page's)
 *
 *   FX_STYLE                       the floor's numbers
 *   styleBeam(B, seed, colour?, F?)      an attack raised to the floor (F: FX_STYLE, or a composed floor)
 *   styleExplosion(X, seed, F?)          an explosion's moment spec raised to the floor
 *   styleEvents(events, F?)              a world's lowered events with every beam and explosion raised (its landings re-read)
 *   puffSpec(is)                   a preset puff as an explosion's spec, or null when it stays the moment's own
 *   (a composed floor's events also carry `rim`, the characters' rim light from the effects (effect-rim.js), and their
 *   statuses' coats in the look's rim)
 */
import { beamLanding } from '../playscape/elements/beams.js';
import { MOMENTS, MOMENT_KEYS } from '../playscape/elements/moments.js';
import { AURAS, scaleAura } from '../playscape/elements/aura.js';

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
export function styleBeam(B, seed = '', colour = null, F = FX_STYLE) {
  if (!B || !Array.isArray(B.strands) || !B.strands.length) return B;
  const core = B.strands[0], chir = hand(seed || JSON.stringify(core));
  if (!(core.width >= F.thin)) return B;   // a line: left as it is
  const out = { ...B, strands: [...B.strands] };
  const bolt = core.form === 'bolt', laser = core.form === 'ray' && core.width < F.laser;
  // the material its colour asks for (materialOf): fire on a warm bolt's head, lightning across a pale ray
  const mat = materialOf(B, colour);
  if (mat === 'fire' && !core.fire) out.strands[0] = { ...out.strands[0], fire: true };
  if (mat === 'lightning' && !core.jag) out.strands[0] = { ...out.strands[0], jag: +Math.max(0.25, core.width * 6).toFixed(3), flicker: 14, forks: 2 };
  // 4 · anticipation: a charge before release
  if (!out.charge && F.charge.time > 0) out.charge = { time: F.charge.time, size: +(core.width * F.charge.size).toFixed(3), at: 'hand' };
  const wait = out.charge ? out.charge.time : 0;
  // the core: stretched along its flight, a bolt on a gentle arc (a ray is a beam: straight)
  out.strands[0] = { ...out.strands[0], ...(core.edge !== 'glow' && core.ink == null && F.ink ? { ink: F.ink } : {}), ...(core.stretch == null && bolt && F.stretch ? { stretch: F.stretch } : {}), ...(bolt && !core.arc && !core.bow && F.arc ? { arc: +(F.arc * Math.min(core.speed, 12) / 4).toFixed(3) } : {}), ...(core.form === 'ray' && !core.pulse ? { pulse: F.pulse } : {}), delay: Math.max(core.delay || 0, wait) };
  // the copies are the core's path without its material (one bolt of lightning, companions plain), but a flame's echoes
  // burn too: a trail of smaller, fainter flames behind the head
  const { fire: _f, jag: _j, flicker: _fl, forks: _fk, ...plain } = out.strands[0], trail = out.strands[0].fire ? { ...plain, fire: true } : plain;
  // 1 + 3 · companions braiding round the core, an analogous hue, one hand
  if (!decorated(B) && !laser && F.companions !== false) {
    const C = F.companion, w = +(core.width * C.width).toFixed(4), amp = +(core.width * C.radius).toFixed(4);
    for (const phase of [0, 0.5]) out.strands.push({ ...plain, width: w, head: 1, edge: 'glow', twist: chir * C.twist, wave: [amp, 0], phase, hue: chir * C.hue, stretch: 0 });
  }
  // 1 + 4 · echoes: a bolt's afterimages, each later, narrower, fainter (follow-through)
  if (bolt) for (let k = 1; k <= F.echoes; k++) out.strands.push({ ...trail, width: +(core.width * F.echoShrink ** k).toFixed(4), delay: +(out.strands[0].delay + F.echoLag * k).toFixed(3), alpha: +(F.echoFade ** k).toFixed(3), edge: 'glow', stretch: 0 });
  // 1 · a ray's rings; 4 · secondary action and exaggeration
  if (core.form === 'ray' && !laser && !out.rings) out.rings = { ...F.rings };
  if (!out.sparks) out.sparks = { ...F.sparks };
  if (!out.impact) out.impact = 'flash';
  return F.composed ? composeBeam(out, seed, F) : out;
}

/** An explosion's moment spec raised to the floor: its sprays swirl and spin one way, its shock ring echoed. */
export function styleExplosion(X, seed = '', F = FX_STYLE) {
  if (!X || !Array.isArray(X.parts)) return X;
  const chir = hand(seed || 'blast');
  const parts = X.parts.map((p) => ({ ...p, ...(p.swirl ? {} : { swirl: chir * F.swirl }), ...(p.spin ? {} : { spin: chir * F.spin }) }));
  // the ground's shock ring echoed: a second, tighter and later, when the ground has only the one
  const ground = Array.isArray(X.rings) ? X.rings.filter((g) => !g.air) : [];
  const rings = ground.length === 1 ? [...X.rings, { ...ground[0], r: +(ground[0].r * 0.7).toFixed(3), delay: +((ground[0].delay || 0) + 0.09).toFixed(3) }] : X.rings;
  const out = { ...X, parts, ...(rings ? { rings } : {}) };
  return F.composed ? composeExplosion(out, F) : out;
}

// ── a composed floor (juice-style.js): the register's look and the game type's time over the floor's rules ─────────
// the puffs a composed floor may restyle: sprays, a star and a light only (a bolt or a ring is the moment's own, global)
const RESTYLED = new Set(Object.keys(MOMENTS).filter((k) => !MOMENTS[k].bolt && !MOMENTS[k].ring));
/** A preset puff as an explosion's spec (its key parts named), so a composed floor can style it; null when it stays global. */
export const puffSpec = (is) => (RESTYLED.has(is) ? { ...MOMENTS[is], key: MOMENT_KEYS[is] } : null);

const sc = (v, k) => +(v * k).toFixed(4);
// a spray played `r` times as fast: its speeds × r, its times ÷ r, its fall × r² (the same path, sooner)
function fastSpray(p, r) {
  if (r === 1) return p;
  const o = { ...p };
  for (const k of ['life', 'lag', 'delay', 'stagger']) if (num(o[k])) o[k] = sc(o[k], 1 / r);
  for (const k of ['v', 'swirl', 'spin', 'drag']) if (num(o[k])) o[k] = sc(o[k], r);
  if (num(o.gravity)) o.gravity = sc(o.gravity, r * r);
  if (Array.isArray(o.go)) o.go = o.go.map((x) => sc(x, r));
  return o;
}
const num = (v) => typeof v === 'number' && Number.isFinite(v);
// a spray's shape through the floor's glyph map, its sparks counted by the floor's share
const reshape = (p, F) => {
  const glyph = F.glyphs[p.glyph] ?? p.glyph, sparky = p.glyph === 'spark' || p.glyph === 'streak';
  return { ...p, glyph, ...(sparky && p.count > 1 ? { count: Math.max(1, Math.round(p.count * F.sparkK)) } : {}) };
};

/** An attack under a composed floor: its sparks reshaped, its preset impact made styleable, its shake, its pace and
 * its drawings a second. Its landing is re-read by whoever lands it (styleEvents). */
function composeBeam(B, seed, F) {
  const r = F.rate, out = { ...B };
  // a look with no ink line turns an attack's own black edge to its glow; a cel look outlines its core (not its
  // companions or echoes) in its own dark tone, and lays flat bands across every strand
  if (F.edge === 'glow') out.strands = out.strands.map((S) => (S.edge && S.edge !== 'glow' ? { ...S, edge: 'glow' } : S));
  else if (F.edge) out.strands = out.strands.map((S) => (S.alpha == null && S.hue == null && S.edge !== F.edge ? { ...S, edge: F.edge, ...(F.ink && S.ink == null ? { ink: F.ink } : {}) } : S));
  if (F.cel) out.strands = out.strands.map((S) => ({ ...S, cel: true }));
  if (out.sparks) out.sparks = fastSpray(reshape(out.sparks, F), r);
  if (out.impact && !out.impactSpec) { const X = puffSpec(out.impact); if (X) out.impactSpec = X; }
  if (num(out.shake)) out.shake = +Math.min(1, out.shake * F.shakeK).toFixed(3);
  if (out.charge) out.charge = { ...out.charge, time: sc(out.charge.time, 1 / r) };
  if (r !== 1) out.strands = out.strands.map((S) => ({ ...S, speed: sc(S.speed, r), ...['hold', 'delay', 'stagger'].reduce((a, k) => (num(S[k]) ? { ...a, [k]: sc(S[k], 1 / r) } : a), {}), ...['pulse', 'flicker'].reduce((a, k) => (num(S[k]) && S[k] ? { ...a, [k]: sc(S[k], r) } : a), {}) }));
  if (F.fps) out.fps = F.fps;
  return out;
}

// how long an explosion plays: its last part out (explosions.js readExplosion's reckoning)
function durOf(X) {
  const ends = [...X.parts.map((p) => (p.delay || 0) + (p.stagger || 0) + p.life * 1.15 + ((p.trail || 1) - 1) * (p.lag || 0)), ...(X.rings || []).map((g) => (g.delay || 0) + g.life),
    X.star ? (X.star.delay || 0) + X.star.life : 0, X.aura ? X.aura.delay + X.aura.life : 0, X.scorch ? (X.scorch.delay || 0) + X.scorch.life : 0, X.comic ? (X.comic.delay || 0) + X.comic.life : 0];
  return Math.round((Math.max(...ends) + 0.1) * 1000) / 1000;
}

// an explosion's own colour: its `color`, else its first key part's, else a warm white
const ownColour = (X) => (Array.isArray(X.color) ? X.color : (X.key && X.parts[X.key[0]] && Array.isArray(X.parts[X.key[0]].color) ? X.parts[X.key[0]].color : [1, 0.95, 0.8]));
// a grey pulled toward a tone (a colour of its own is left)
const tintGrey = (c, pale, k) => (Array.isArray(c) && Math.max(...c) - Math.min(...c) < 0.15 ? c.map((x, i) => +(x + (pale[i] - x) * k).toFixed(3)) : c);

/** An explosion under a composed floor: its sprays reshaped, its soft puffs lingering by the register (and tinted toward
 * its colour), its flash and light, a halo ring and glints drifting up where the register draws them (a comic burst
 * where it is asked for), its shake, its pace and its drawings a second. */
function composeExplosion(X, F) {
  const r = F.rate, t = (o) => (o ? { ...o, life: sc(o.life, 1 / r), ...(num(o.delay) ? { delay: sc(o.delay, 1 / r) } : {}) } : o);
  // the tone grey smoke is pulled toward: a deeper tone of the colour (a warm cloud, not a cream one), a lighter one in a
  // cel look (its flat two-tone puff in a light tone of the fire, not mud)
  const own = ownColour(X), pale = own.map((x) => +(F.cel ? x + (1 - x) * 0.3 : x * 0.5).toFixed(3));
  // a fire's body (a soft puff whose ramp starts hot) burns as added light where the register glows; smoke and dust stay soft
  const hot = (p) => Array.isArray(p.ramp) && Array.isArray(p.ramp[0]) && Math.min(...p.ramp[0]) > 0.4 && Math.max(...p.ramp[0]) > 0.95;
  const soft = (p0) => {
    if (p0.glyph !== 'soft') return p0;
    // (its fire burns from its own colour, fewer puffs, so the added light does not blow out to white)
    const p = { ...p0, life: sc(p0.life, F.smokeK), ...(F.glow && hot(p0) ? { glyph: 'dot', ramp: p0.ramp.slice(1), count: Math.max(1, Math.round(p0.count * 0.6)) } : {}),
      // (a cel look draws a cloud as a few bold flat shapes: fewer, larger puffs)
      ...(F.cel ? { count: Math.max(1, Math.round(p0.count * 0.35)), size: sc(p0.size, 1.5) } : {}) };
    return { ...p, ...(F.tint && p.color ? { color: tintGrey(p.color, pale, F.tint) } : {}), ...(F.tint && Array.isArray(p.ramp) ? { ramp: p.ramp.map((c) => tintGrey(c, pale, F.tint)) } : {}) };
  };
  // a look that draws fire as spirit onions (aura.js): the fire's body (a soft puff whose ramp starts hot) becomes overlapping
  // onion shells spinning their own ways with rings of spikes round them, sized to the fire, for as long as it burns
  const fire = F.onions ? X.parts.find(hot) : null;
  const parts = X.parts.filter((p) => p !== fire).map((p) => fastSpray(reshape(soft(p), F), r));
  const out = { ...X, parts };
  if (X.star) out.star = t({ ...X.star, size: sc(X.star.size, F.starK) });
  if (X.light) out.light = t({ ...X.light, k: sc(X.light.k, F.lightK) });
  if (X.rings) out.rings = X.rings.map(t);
  // a halo: a clean ring of light where the blow lands, when it has no ring of air of its own
  const flash = out.star || out.light;
  if (F.halo && flash && !(X.rings || []).some((g) => g.air)) out.rings = [...(out.rings || []), { r: out.star ? sc(out.star.size, 0.9) : 1.2, life: sc(0.32, 1 / r), delay: flash.delay || 0, air: true }];
  // motes: glints drifting up after the blow, in its colour (a cue's colour paints them: a key part)
  if (F.motes && (out.star || out.light)) {
    const at = (out.star && out.star.delay) || 0;
    parts.push(fastSpray({ ...FX_STYLE.sparks, glyph: F.cel ? F.glyphs.dot ?? 'cdot' : F.glyphs.spark ?? 'spark', count: 10, from: 'shell', r: 0.55, z: [0.4, 1.5], v: 0.5, el: [40, 90], gravity: -0.9, life: 1.2, size: 0.11, env: 'ends', delay: +(at * r + 0.12).toFixed(3), color: own }, r));
    out.key = [...(X.key || []), parts.length - 1];
  }
  // debris: dark specks thrown from the blow (not a key part: a cue's colour leaves them dark)
  if (F.debris && flash) parts.push(fastSpray({ ...FX_STYLE.sparks, glyph: 'chip', count: 16, from: 'point', z: [0.3, 0.3], v: 6.5, el: [15, 75], gravity: 9.8, spin: 3, life: 0.9, size: 0.07, env: 'steady', delay: +(((flash.delay || 0) * r)).toFixed(3), color: [0.11, 0.11, 0.13] }, r));
  if (fire) out.aura = { A: { ...scaleAura(AURAS.burst, +(fire.size / 0.75).toFixed(3)), color: own.map((x, i) => +(x + ([1, 0.82, 0.15][i] - x) * 0.35).toFixed(3)) }, life: sc(fire.life, 0.9 / r), delay: sc(fire.delay || 0, 1 / r) };
  if (X.comic) out.comic = t(X.comic);
  else if (F.comic && X.star) out.comic = { size: sc(out.star.size, 0.8), spikes: 12, life: sc(X.star.life * 1.6, 1 / r), delay: out.star.delay || 0 };
  if (X.scorch && num(X.scorch.delay)) out.scorch = { ...X.scorch, delay: sc(X.scorch.delay, 1 / r) };
  if (X.chain) out.chain = { ...X.chain, stagger: sc(X.chain.stagger, 1 / r) };
  if (num(X.shake)) out.shake = +Math.min(1, X.shake * F.shakeK).toFixed(3);
  if (F.fps) out.fps = F.fps;
  out.dur = durOf(out);
  return out;
}

/** A party battle's juice under a composed floor: its attacks styled (their landings re-read), its holds and flashes
 *  at the game type's pace, its shakes by its share. */
function styleJuice(J, F) {
  if (!J || !J.fx) return J;
  const beams = Object.fromEntries(Object.entries(J.fx.beams || {}).map(([k, B]) => { const S = styleBeam(B, k, null, F); return [k, S.impactSpec ? { ...S, impactSpec: styleExplosion(S.impactSpec, S.impact, F) } : S]; }));
  const step = (s) => (s.beam && beams[s.beam] ? { ...s, land: beamLanding(beams[s.beam]) }
    : s.hold ? { ...s, hold: sc(s.hold, 1 / F.rate) }
      : s.shake ? { ...s, shake: +Math.min(1, s.shake * F.shakeK).toFixed(3), ...(num(s.for) ? { for: sc(s.for, 1 / F.rate) } : {}) }
        : s.flash !== undefined && num(s.for) ? { ...s, for: sc(s.for, 1 / F.rate) } : s);
  const each = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, steps]) => [k, steps.map(step)]));
  return { ...J, on: each(J.on), also: each(J.also), fx: { ...J.fx, beams } };
}

/** A world's lowered events with every beam and explosion raised to the floor (FX_STYLE, or a composed one,
 *  juice-style.js juiceFloor); a beam's landing is re-read from it. A composed floor also styles the preset puffs it
 *  can (puffSpec), the camera's shakes and a party battle's juice. */
export function styleEvents(events, F = FX_STYLE) {
  if (!events || !Array.isArray(events.reactions)) return events;
  const reactions = events.reactions.map((r) => {
    if (r && r.op === 'beam' && r.spec) {
      const styled = styleBeam(r.spec, r.name || r.by || r.who || '', r.color ?? null, F), spec = styled.impactSpec ? { ...styled, impactSpec: styleExplosion(styled.impactSpec, styled.impact, F) } : styled;
      return { ...r, spec, land: beamLanding(spec) };
    }
    if (r && r.op === 'puff' && r.spec && Array.isArray(r.spec.parts)) return { ...r, spec: styleExplosion(r.spec, r.is || '', F), ...(F.composed && num(r.shake) ? { shake: +Math.min(1, r.shake * F.shakeK).toFixed(3) } : {}) };
    if (F.composed && r && r.op === 'puff') { const X = puffSpec(typeof r.is === 'string' ? r.is : 'smoke'); return { ...r, ...(X ? { spec: styleExplosion(X, r.is || '', F) } : {}), ...(num(r.shake) ? { shake: +Math.min(1, r.shake * F.shakeK).toFixed(3) } : {}) }; }
    if (F.composed && r && r.op === 'shake' && num(r.k)) return { ...r, k: +Math.min(1, r.k * F.shakeK).toFixed(3) };
    return r;
  });
  const rpg = F.composed && events.rpg && events.rpg.juice ? { rpg: { ...events.rpg, juice: styleJuice(events.rpg.juice, F) } } : {};
  // the characters' rim (effect-rim.js): the look's rim at the game type's strength; a status's coat in the look's rim
  // (as narrow, a cel band where the look draws one, lifted by its share)
  const rim = F.composed && F.rim && F.rim.k > 0 ? { rim: { k: F.rim.k, p: F.rim.p, band: F.rim.band } } : {};
  const looks = F.composed && F.rim && events.looks ? { looks: Object.fromEntries(Object.entries(events.looks).map(([n, L]) => [n, L && L.coat ? { ...L, coat: { ...L.coat, p: F.rim.p, k: +Math.min(1.5, L.coat.k * F.rim.coat).toFixed(3), ...(F.rim.band ? { band: F.rim.band } : {}) } } : L])) } : {};
  return { ...events, reactions, ...rpg, ...rim, ...looks };
}
