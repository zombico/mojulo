// equipment/compose — laws 2: an item is a HILT carrying an END (principles.js laws 8–11).
//
//   hilt   what the hand holds. A sword hilt (pommel → grip → guard, seated from z = 0 up): dagger · one-hand ·
//          hand-and-half · two-hand, its grip counted in hands (law 8). Or a haft (heel → shaft → grip band(s) →
//          collar): wand · arm · long · pole (a pole taken at two bands).
//   end    what does the work, seated on the hilt's top: a `blade` (any outline: parts.blade) or a head (the staff's
//          heads: plain · branch · claw · crescent · block · mace · ringed · spear · axe · halberd). A blade on a haft
//          is a glaive or a naginata; a head on a sword hilt rises on a neck (a sceptre, a sword-hilted mace).
//
// The item names are presets of the two: dagger (dagger + blade), sword (one-hand + blade), greatsword (two-hand +
// blade), staff (its reach's haft — long, arm, wand — + its head). `parts.hilt` and `parts.end` choose either apart;
// `parts.hiltLength` (the grip's or the haft's, cm) and `parts.endLength` (the blade's, cm) size them. The guard is
// sized by the blade it stops (law 9), the pommel balances it (law 10), a head is sized by its haft and a band sits on
// the shaft however it wanders (law 11). The bow and the shield are not hilts and ends: laws 2 draws them as laws 1.
//
// The frame is the item's as before: z along it from its butt, the edge (a blade's) toward +x. Pure and deterministic.
import { focalStone, recedeRole, patternRole, focalGrow, guardSpanOf, pommelOf, GRIP_HANDS, HEAD_SHARE, GUARD_RISE } from './principles.js';
import { mulberry32, r3, P, A, mergeInto, setStone, push, ribbon } from './shapes.js';
import { bladeLoft, guard, grip, pommel, BLADES } from './sword.js';
import { staffHead, GEMLESS_HEADS } from './items.js';
import * as dmath from '../../util/dmath.js';

/** The hilts (law 8): a sword hilt's grip and guard and the blade it is drawn for; a haft's length and where it is held. */
export const HILTS = Object.freeze({
  dagger: { kind: 'sword', grip: GRIP_HANDS.dagger, R: 1.25, guardK: 2.3, guardH: 1.3, guardD: 1.8, blade: { L: 26, W: 3.4, T: 0.5 } },
  'one-hand': { kind: 'sword', grip: GRIP_HANDS['one-hand'], R: 1.45, guardK: 4.2, guardH: 1.7, guardD: 2.3, blade: { L: 76, W: 4.6, T: 0.6 } },
  'hand-and-half': { kind: 'sword', grip: GRIP_HANDS['hand-and-half'], R: 1.5, guardK: 4.6, guardH: 1.9, guardD: 2.5, blade: { L: 90, W: 4.8, T: 0.62 } },
  'two-hand': { kind: 'sword', grip: GRIP_HANDS['two-hand'], R: 1.65, guardK: 5.4, guardH: 2.4, guardD: 3.0, blade: { L: 115, W: 5.6, T: 0.7 } },
  wand: { kind: 'haft', L: 28, R: 1.0, grip: 0.42 },
  arm: { kind: 'haft', L: 62, R: 1.7, grip: 0.3 },
  long: { kind: 'haft', L: 150, R: 1.6, grip: 0.6 },
  pole: { kind: 'haft', L: 185, R: 1.7, grip: 0.52, second: 0.2 },
});
export const HILT_WORDS = Object.freeze(Object.keys(HILTS));
/** the item names as presets: their hilt (a staff's from its reach) */
export const ITEM_HILT = Object.freeze({ dagger: 'dagger', sword: 'one-hand', greatsword: 'two-hand', staff: 'long' });
const STONE_FOCI = new Set(['guard', 'pommel']);

/** The build's hilt and end words, its item's preset under its parts. */
export function hiltAndEnd(item, parts = {}, lang = {}) {
  const hilt = parts.hilt ?? (item === 'staff' ? (lang.reach ?? 'long') : ITEM_HILT[item]);
  const end = parts.end ?? (item === 'staff' ? (lang.head ?? 'plain') : 'blade');
  return { hilt, end };
}
/** Whether an end cradles a stone (it needs one to resolve: a gem with focus 'head'). */
export const stoneEnd = (end) => end !== 'blade' && !GEMLESS_HEADS.includes(end);
/** The foci a hilt and an end take. */
export function fociOf(hilt, end) {
  const sword = HILTS[hilt]?.kind === 'sword';
  return [...(sword ? ['guard', 'pommel'] : []), ...(end === 'blade' ? ['blade'] : ['head']), 'none'];
}

/**
 * Build a laws-2 item (resolved by expand.js: { item, card, d, law, lean, roles, gem, parts, seed }) → { monomers,
 * sockets, trace }. `trace.hold` says how a hand holds it (hero-gear.js): 'blade' (a sword hilt, or a haft short
 * enough to swing) or 'haft' (a long haft or a pole).
 */
export function composeItem({ item, card, d, law, lean, roles, gem: g, parts, seed }) {
  const language = card.language || {};
  const lang = { ...(language[item] || {}), ...parts };
  const { hilt, end } = hiltAndEnd(item, parts, lang);
  const H = HILTS[hilt];
  const pick = (slot) => parts[slot] ?? language[item]?.[slot] ?? language[slot];
  const rng = mulberry32(seed * 7919 + hilt.length * 131 + end.length * 17 + (card.id || '').length);
  const m = {}, trace = { variants: { hilt, end } };
  // the stone, where the focus asks for one and the end or the hilt can hold it (law 1); the fittings recede (law 5)
  const wantsStone = (H.kind === 'sword' && STONE_FOCI.has(d.focus)) || (d.focus === 'head' && stoneEnd(end));
  const gem = g && wantsStone ? { ...g, glow: (g.glow || 0) + (H.kind === 'haft' || d.focus === 'head' ? 0.35 * d.stylize : 0) } : null;
  if (gem) roles = { ...roles, fittings: recedeRole(roles.fittings, d.stylize) };
  const shaftRole = lang.shaft ?? language.staff?.shaft ?? roles.shaft ?? ['wood', '#6b4a2e'];
  roles = { ...roles, shaft: shaftRole };
  const edge = card.edge || {}, fg = focalGrow(d.stylize);
  const blade = { variant: pick('blade') ?? 'straight' };

  let sockets, length, hold;
  if (H.kind === 'sword') {
    // ── a sword hilt: the blade it is drawn for sizes its guard (law 9) and its pommel (law 10) ──
    const bL = (parts.endLength ?? H.blade.L) * law.bladeL * lean.L, bW = H.blade.W * law.bladeW * lean.W, bT = H.blade.T * law.bladeT * lean.T;
    const gR = H.R * law.hilt ** 0.5 * lean.T ** 0.3, gL = (parts.hiltLength ?? H.grip) * law.gripL * lean.grip;
    // (a head's neck is stopped by a collar of a guard: sized by the neck, not by a blade it does not carry)
    const span = (end === 'blade' ? guardSpanOf({ W: bW, L: bL, k: H.guardK, stylize: d.stylize }) : guardSpanOf({ W: gR * 2.2, L: H.blade.L * 0.42, k: H.guardK * 0.8, stylize: d.stylize })) * lean.span;
    const gH = H.guardH * law.hilt * Math.sqrt(lean.T), gD = H.guardD * law.hilt * lean.T;
    const pomR = pommelOf({ L: bL, W: bW, T: bT, gripR: gR, stylize: d.stylize }) * lean.pommel;
    const minF = law.minFeature * (bL + gL);
    const stone = gem ? focalStone({ stylize: d.stylize, host: d.focus === 'pommel' ? pomR * 1.1 : gH }) : null;
    const gemLit = gem ? { ...gem, glow: (gem.glow || 0) + (stone?.glowBoost || 0) } : null;
    if (stone) trace.focal = { at: d.focus, gem: gem.gem, size: r3(stone.size), setting: stone.setting, share: r3(stone.size / (d.focus === 'pommel' ? pomR * 2 : gH)) };
    const pv = pick('pommel') ?? 'wheel', pStone = d.focus === 'pommel' ? stone : null;
    const pomH = pommel(pv, { R: pomR, top: 0, roles, stone: pStone, gem: gemLit, gripR: gR }).H;
    mergeInto(m, pommel(pv, { R: pomR, top: pomH, roles, stone: pStone, gem: gemLit, gripR: gR }).out);
    let z = pomH;
    const gv = pick('grip') ?? 'leather'; mergeInto(m, grip(gv, { L: gL, R: gR, z0: z, roles, pitch: law.pitch, minF }));
    const gripMid = z + gL / 2; z += gL;
    // law 9: the guard's rise (a crescent's horns, a wing's sweep, a spike) fitted inside its share of the span
    const guv = pick('guard') ?? 'bar', gm = guard(guv, { span, H: gH, D: gD, z0: z, roles, minF });
    const rise = fitRise(gm, z, GUARD_RISE * span + gH);
    mergeInto(m, gm);
    if (d.focus === 'guard' && stone) mergeInto(m, setStone({ at: [0, 0, z + gH / 2], axis: [0, 1, 0], st: stone, gem: gemLit, roles, group: 'guard', bossDepth: Math.max(gD * 0.5, stone.r * 0.5) }));
    const focalZ = d.focus === 'pommel' ? pomH / 2 : z + gH / 2;
    z += gH * (guv === 'disc' ? 0.55 : 1);
    Object.assign(trace.variants, { pommel: pv, grip: gv, guard: guv });
    trace.guard = { span: r3(span), H: r3(gH), rise: r3(rise) }; trace.pommel = { R: r3(pomR) }; trace.grip = { L: r3(gL), R: r3(gR) };
    const zGuard = z;
    let tip;
    if (end === 'blade') {
      tip = bladeEnd(m, { variant: blade.variant, L: bL, W: bW, T: bT, z0: z, edge, law, d, rng, roles, seed });
      trace.variants.blade = blade.variant; trace.blade = { L: r3(bL), W: r3(bW) };
    } else {
      // a head on a sword hilt rises on a neck of the fittings (a sceptre, a sword-hilted mace or axe)
      const neck = (parts.endLength ?? H.blade.L * 0.42) * law.length, R = gR * 0.85;
      push(m, 'lathes', { group: 'neck', axisFrom: P(0, 0, z - 0.4), axisTo: P(0, 0, z + neck), profile: [{ t: 0, radius: r3(R * 1.25) }, { t: 0.15, radius: r3(R) }, { t: 1, radius: r3(R * 0.92) }], ...matOf(roles.fittings) });
      tip = headEnd(m, { head: end, R, z0: z + neck, gem: d.focus === 'head' ? gemLit : null, d, law, lang, rng, roles, minF, fg, edge, haftL: neck * 2.2 });
      if (tip.focal) trace.focal ??= tip.focal.trace;
    }
    length = tip.z;
    sockets = {
      grip: { origin: A(0, 0, gripMid), axis: [0, 0, 1], edge: [1, 0, 0], length: r3(gL) },
      guard: { origin: A(0, 0, zGuard) },
      tip: { origin: A(tip.x ?? 0, 0, tip.z) },
      ...(stone ? { focal: { origin: A(0, 0, focalZ) } } : tip.focal ? { focal: { origin: tip.focal.origin } } : {}),
    };
    trace.minFeature = r3(minF);
    hold = 'blade';
  } else {
    // ── a haft: its length the hilt's (or parts.hiltLength), the end sized by it (law 11) ──
    const L = (parts.hiltLength ?? H.L) * law.length, R = H.R * law.hilt ** 0.5 * d.mass ** 0.5;
    const minF = law.minFeature * (L * 1.15);
    push(m, 'lathes', { group: 'heel', axisFrom: P(0, 0, 0), axisTo: P(0, 0, Math.min(6, L * 0.08)), profile: [{ t: 0, radius: r3(R * 0.55) }, { t: 0.2, radius: r3(R * 1.12) }, { t: 1, radius: r3(R * 1.08) }], ...matOf(roles.fittings) });
    // the shaft (turned, or grown: the axis wanders and swells at knots) and the point of it at a height
    let at = () => [0, 0];
    const z0 = Math.min(5, L * 0.07);
    if (lang.shaftForm === 'gnarled') {
      const path = [], n = 36, knots = [0.18, 0.41, 0.63, 0.86].map((k) => k + 0.05 * (rng() - 0.5));
      for (let i = 0; i <= n; i++) { const t = i / n; path.push([1.1 * R * dmath.sin(2.3 * Math.PI * t + 0.7) * (0.6 + 0.4 * rng()), 0.9 * R * dmath.sin(1.7 * Math.PI * t), z0 + t * (L - z0 + 0.5)]); }
      push(m, 'lofts', ribbon({ path, w: (t) => R * (1.08 - 0.18 * t) * (1 + knots.reduce((a, k) => a + 0.28 * dmath.exp(-(((t - k) / 0.025) ** 2)), 0)), h: () => 0, round: true, role: roles.shaft, group: 'shaft', minF }));
      // law 11: a band and a collar sit on the shaft where it is at their height
      at = (z) => { const t = Math.max(0, Math.min(1, (z - z0) / (L - z0 + 0.5))), f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i; return [path[i][0] + (path[i + 1][0] - path[i][0]) * u, path[i][1] + (path[i + 1][1] - path[i][1]) * u]; };
    } else push(m, 'lathes', { group: 'shaft', axisFrom: P(0, 0, z0), axisTo: P(0, 0, L + 0.5), profile: [{ t: 0, radius: r3(R) }, { t: 0.5, radius: r3(R * 0.94) }, { t: 1, radius: r3(R * 0.9) }], ...matOf(roles.shaft) });
    const band = (gz, gl) => { const [x, y] = at(gz); push(m, 'lathes', { group: 'grip', axisFrom: P(x, y, gz - gl / 2), axisTo: P(x, y, gz + gl / 2), profile: Array.from({ length: 9 }, (_, i) => ({ t: r3(i / 8), radius: r3(R * (i % 2 ? 1.13 : 1.06)) })), ...matOf(roles.wrap) }); };
    const gz = H.grip * L, gl = Math.min(22, 0.3 * L);
    band(gz, gl);
    if (H.second) band(H.second * L, Math.min(18, 0.12 * L));
    const [cx, cy] = at(L);
    push(m, 'lathes', { group: 'collar', axisFrom: P(cx, cy, L - 3 * law.hilt), axisTo: P(cx, cy, L + 1), profile: [{ t: 0, radius: r3(R * 0.95) }, { t: 0.4, radius: r3(R * 1.3) }, { t: 1, radius: r3(R * 1.15) }], ...matOf(roles.accent) });
    let tip;
    if (end === 'blade') {
      // a blade on a haft (a glaive, a naginata): on a socket up the shaft's top, sized by the haft (law 11)
      const bL = (parts.endLength ?? HEAD_SHARE.blade * L) * law.bladeL * lean.L, bW = Math.max(R * 3.4, 4) * law.bladeW * lean.W, bT = R * 0.42 * law.bladeT;
      push(m, 'lathes', { group: 'socket', axisFrom: P(cx, cy, L), axisTo: P(cx, cy, L + R * 4), profile: [{ t: 0, radius: r3(R * 1.15) }, { t: 0.5, radius: r3(R * 1.05) }, { t: 1, radius: r3(R * 0.85) }], ...matOf(roles.fittings) });
      tip = bladeEnd(m, { variant: blade.variant, L: bL, W: bW, T: bT, z0: L + R * 3.6, edge, law, d, rng, roles, seed, x0: cx, y0: cy });
      trace.variants.blade = blade.variant; trace.blade = { L: r3(bL), W: r3(bW) };
    } else {
      tip = headEnd(m, { head: end, R, z0: L, gem, d, law, lang, rng, roles, minF, fg, edge, haftL: L, x0: cx, y0: cy });
      if (tip.focal) trace.focal = tip.focal.trace;
    }
    length = tip.z;
    sockets = { grip: { origin: A(at(gz)[0], at(gz)[1], gz), axis: [0, 0, 1], length: r3(gl) }, tip: { origin: A(0, 0, tip.z) }, heel: { origin: A(0, 0, 0) }, ...(tip.focal ? { focal: { origin: tip.focal.origin } } : {}) };
    if (H.second) sockets.second = { origin: A(...at(H.second * L), H.second * L) };
    trace.variants.reach = hilt === 'pole' ? 'long' : hilt;
    trace.haft = { L: r3(L), R: r3(R) };
    trace.minFeature = r3(minF);
    hold = hilt === 'arm' || hilt === 'wand' ? 'blade' : 'haft';
    // law 7: a barked shaft wears the trees' bark (its tile in stem radii, coarser as it stylizes)
    if (lang.bark) {
      const tile = r3(law.barkTile * 1.6);
      for (const k of ['lathes', 'lofts']) for (const s of m[k] || []) if (['shaft', 'branches'].includes(s.group) && s.tint === roles.shaft[1]) s.bark = { species: lang.bark, tile };
      trace.bark = lang.bark;
    }
  }
  return { monomers: m, sockets, trace: { ...trace, hold, length: r3(length) } };
}

/** Law 9: scale a guard's monomers along z about its base so nothing rises or drops past `bound` from it; → the rise. */
function fitRise(gm, z0, bound) {
  const zs = [];
  for (const list of Object.values(gm)) for (const s of list || []) {
    if (s.axisFrom) zs.push(zOf(s.axisFrom), zOf(s.axisTo));
    if (Array.isArray(s.path)) for (const p of s.path) zs.push(zOf(p));
  }
  const reach = Math.max(0, ...zs.map((z) => Math.abs(z - z0)));
  if (!(reach > bound)) return reach;
  const f = bound / reach, sz = (z) => z0 + (z - z0) * f;
  for (const list of Object.values(gm)) for (const s of list || []) {
    if (s.axisFrom) { s.axisFrom = setZ(s.axisFrom, sz); s.axisTo = setZ(s.axisTo, sz); }
    if (Array.isArray(s.path)) s.path = s.path.map((p) => setZ(p, sz));
  }
  return bound;
}
const zOf = (p) => (Array.isArray(p) ? p[2] : p.z);
const setZ = (p, f) => (Array.isArray(p) ? A(p[0], p[1], f(p[2])) : P(p.x, p.y, f(p.z)));

const matOf = (role) => (Array.isArray(role) ? { material: role[0], tint: role[1] } : { material: role });

/** A blade end from z0 (the edge toward +x), as the sword draws its blade: a two-tone core, a fuller, barbs. → its tip. */
function bladeEnd(m, { variant, L, W, T, z0, edge: cardEdge, law, d, rng, roles, seed, x0 = 0, y0 = 0 }) {
  const edge = { ...cardEdge, barbs: cardEdge.barbs ? Math.max(1, Math.round(cardEdge.barbs * law.notches)) : 0 };
  const at = (lo) => ((x0 || y0) ? { ...lo, path: lo.path.map(([x, y, z]) => A(x + x0, y + y0, z)) } : lo);
  if (cardEdge.twoTone) {
    push(m, 'lofts', { group: 'blade', ...at(bladeLoft({ variant, L, W, T: T * 0.62, z0, edge: { ...edge, fuller: 0 }, rng: mulberry32(seed), role: patternRole(roles.edge || roles.blade, L, d.stylize) })) });
    push(m, 'lofts', { group: 'blade-core', ...at(bladeLoft({ variant, L: L * 0.93, W: W * 0.66, T, z0, edge: { ...edge, bevel: 0.7 }, rng: mulberry32(seed), role: patternRole(roles.blade, L, d.stylize) })) });
  } else push(m, 'lofts', { group: 'blade', ...at(bladeLoft({ variant, L, W, T, z0, edge, rng, role: patternRole(roles.blade, L, d.stylize) })) });
  return { z: z0 + L, x: (BLADES[variant]?.path ? BLADES[variant].path(1, L) : 0) + x0 };
}

/** A head end on a shaft of radius R topped at z0, its budget from its haft (law 11). → its tip and focal. */
function headEnd(m, { head, R, z0, gem, d, law, lang, rng, roles, minF, fg, edge, haftL, x0 = 0, y0 = 0 }) {
  const st = gem && stoneEnd(head) ? focalStone({ stylize: d.stylize, host: R * 2.6 }) : null;
  // a blade head (a spear's point, an axe's blade, a halberd's both) a share of its haft, never under the laws-1 size
  const own = { spear: R * 15 * fg, axe: R * 7 * fg, halberd: R * 15 * fg }[head];
  const blade = own === undefined ? undefined : Math.max(own, (HEAD_SHARE[head] ?? 0) * haftL * fg ** 0.5);
  const HH = st ? st.size * 1.9 + R * 2 : head === 'plain' ? R * 5 : blade ?? R * 9 * fg;
  const sub = {};
  const focal = staffHead(sub, { head, R, zTop: z0, L: z0 + HH, st, gem: st ? gem : null, law, lang, rng, d, roles, minF, focalGrow: fg, blade, edge });
  // seat the head on the shaft where the shaft is (a grown shaft's top wanders)
  for (const [k, list] of Object.entries(sub)) for (const s of list) (m[k] ||= []).push((x0 || y0) ? shift(s, x0, y0) : s);
  return { z: z0 + HH, ...(focal ? { focal: { origin: (x0 || y0) ? A(focal[0] + x0, focal[1] + y0, focal[2]) : focal, trace: st ? { at: 'head', gem: gem.gem, size: r3(st.size), share: r3(st.size / (2 * R)), setting: st.setting } : undefined } } : {}) };
}

/** a monomer moved across by (dx, dy): its axis, its path, its field's centres */
function shift(s, dx, dy) {
  const o = { ...s };
  const mv = (p) => (Array.isArray(p) ? A(p[0] + dx, p[1] + dy, p[2]) : P(p.x + dx, p.y + dy, p.z));
  if (o.axisFrom) { o.axisFrom = mv(o.axisFrom); o.axisTo = mv(o.axisTo); }
  if (Array.isArray(o.path)) o.path = o.path.map(mv);
  if (Array.isArray(o.terms)) o.terms = o.terms.map((t) => (t.shape?.center ? { ...t, shape: { ...t.shape, center: mv(t.shape.center) } } : t));
  return o;
}
