/**
 * MASCOT SHEET → BODY: a mascot sheet (mascot.js rollMascot) compiled into a first `create_character` call, a ring plan
 * on the creature door that rigs, plays its clips and exports like any creature (docs/mascot.md). The laws are numbers
 * here: head-heavy forms on a round core (laws 3, 5), big eyes at the head's middle as lenses that hug it (4), the hook
 * in the accent's family (2, 5), big hands and feet on thin limbs (6), an owned palette in harmony or contrast (7),
 * every form a smooth ball, egg or cone (8), a symmetric body whose idle is never still (9), on any topology that
 * animates (10). Every amount is a FIRST READING the character loop iterates in place (`update_character` patch ops),
 * never a verdict.
 *
 *   mascotPlan(sheet, { title? })          → { plan, H, height }   the ring plan, the head (centre and radii), the height
 *   mascotPlanFromSheet(sheet, { title? }) → { door: 'creature', thesis, create, after, ledger }
 *
 * Pure and deterministic: the same sheet, the same call. No dice: the sheet already threw them.
 */
import { readMascotDerive, HUES } from './mascot.js';
import { PLAN_SCHEMA } from '../polygonizer/station-loft-plan.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const V = (p) => p.map(r4);
const add = (a, b) => a.map((x, i) => x + b[i]); const sub = (a, b) => a.map((x, i) => x - b[i]); const mul = (a, s) => a.map((x) => x * s);
const unit = (v) => mul(v, 1 / Math.hypot(...v));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const rad = (deg) => (deg * Math.PI) / 180;

// ══════════ the forms: the laws as first readings ══════════

/** The forms' base measures, metres (law 3: the head a third of the height or more; 6: big, medium, small).
 *  headR the head's radius · bodyR, bodyH the body's half-width and length (the orb has none: the head is the body) ·
 *  leg hip to ankle · arm shoulder to wrist · hand the hand's radius · foot [half-width, half-length, half-height] */
export const FORM_MEASURES = Object.freeze({
  orb: Object.freeze({ headR: 0.27, bodyR: 0, bodyH: 0, leg: 0.05, arm: 0.07, hand: 0.075, foot: Object.freeze([0.08, 0.13, 0.055]) }),
  sprout: Object.freeze({ headR: 0.24, bodyR: 0.13, bodyH: 0.24, leg: 0.17, arm: 0.2, hand: 0.05, foot: Object.freeze([0.06, 0.12, 0.05]) }),
  toon: Object.freeze({ headR: 0.21, bodyR: 0.15, bodyH: 0.4, leg: 0.36, arm: 0.33, hand: 0.052, foot: Object.freeze([0.062, 0.13, 0.05]) }),
});
/** a derive's step: the knob moved by this share of itself (a direction, never a verdict) */
export const STEP = 0.12;
/** the eyes by family, in head radii and degrees (law 4: big, tall, at the head's middle; a big pupil, one glint).
 *  az the eye's centre off the midline · el its height above the head's centre · w, h its half-width, half-height ·
 *  pupil [w, h] · nudge the pupil's turn toward the nose (degrees) · glint its radius */
export const EYE_FORMS = Object.freeze({
  pair: Object.freeze({ az: 15, el: 0, w: 0.15, h: 0.27, pupil: Object.freeze([0.085, 0.17]), nudge: -2, glint: 0.04 }),
  joined: Object.freeze({ az: 11, el: 3, w: 0.22, h: 0.29, pupil: Object.freeze([0.085, 0.17]), nudge: 2.5, glint: 0.036 }),
  dots: Object.freeze({ az: 21, el: 3, w: 0, h: 0, pupil: Object.freeze([0.072, 0.1]), nudge: 0, glint: 0.032 }),
});
/** the limbs' radius as a share of the hand's (law 6: rubber hose against mitts) */
const LIMB_OF_HAND = Object.freeze({ nubs: 0.62, gloves: 0.36, paws: 0.5 });
/** the hand's size by extremities (gloves over-size it) */
const HAND_SCALE = Object.freeze({ nubs: 1, gloves: 1.35, paws: 1.05 });

/** The knobs after the sheet's derives: a scale knob moves by a STEP of itself, a shift knob counts its steps. */
function measuresOf(sheet) {
  const f = sheet.facets, B = FORM_MEASURES[f.form], M = { ...B, foot: [...B.foot] };
  const k = { head: 1, body: 1, legs: 1, arms: 1, width: 1, size: 1, lift: 0, gap: 0, pupil: 1, hands: 1, feet: 1, saturation: 0, value: 0, lean: 0, stance: 0, bounce: 0 };
  const SHIFTS = ['lift', 'gap', 'saturation', 'value', 'lean', 'stance', 'bounce'];
  for (const d of Object.values(sheet.derives).flat()) {
    const { key, dir } = readMascotDerive(d), s = dir === '+' ? 1 : -1;
    if (SHIFTS.includes(key)) k[key] += s;
    else k[key] *= 1 + s * STEP;
  }
  if (f.hook === 'snout') k.lift += 2;   // the eyes climb above a snout
  M.headR *= k.head; M.bodyR *= k.body; M.bodyH *= k.body; M.leg *= k.legs; M.arm *= k.arms;
  M.hand *= k.hands * HAND_SCALE[f.extremities]; M.foot = M.foot.map((x) => x * k.feet);
  return { M, k };
}

// ══════════ the palette (law 7) ══════════

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHex = (c) => `#${c.map((x) => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
function toHsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
const hsl = (hex, fn) => rgbHex(fromHsl(fn(toHsl(hexRgb(hex)))));
const mix = (a, b, t) => rgbHex(hexRgb(a).map((x, i) => x + (hexRgb(b)[i] - x) * t));
/** the pale front: a warm cream, tinted by the body (a cool body's front reads tan, never grey) */
const CREAM = '#f7deb6';

/** The owned palette: the body in its hue, a pale front, the accent a warmer, deeper neighbour (harmony) or across the
 *  wheel (contrast), white gloves, the eyes unlit (Sclera, Pupil). */
export function mascotPalette(sheet, k = { saturation: 0, value: 0 }) {
  const f = sheet.facets, grey = f.hue === 'white';
  const body = hsl(HUES[f.hue], ([h, s, l]) => [h, clamp(s + 0.08 * k.saturation, 0, 1), clamp(l + 0.06 * k.value, 0.12, 0.92)]);
  const accent = grey ? (sheet.accord === 'harmony' ? '#f28fb4' : '#e0302c')
    : sheet.accord === 'harmony' ? hsl(body, ([h, s, l]) => [(h + 18) % 360, clamp(s + 0.08, 0, 1), clamp(l - 0.14, 0.2, 0.8)])
      : hsl(body, ([h, s]) => [(h + 165) % 360, clamp(Math.max(s, 0.72), 0, 1), 0.5]);
  const belly = f.hue === 'yellow' ? mix(body, '#fff4cf', 0.55) : grey ? mix(body, CREAM, 0.3) : mix(CREAM, body, 0.12);
  return {
    Body: body, Belly: belly, Accent: accent, Shoe: f.extremities === 'paws' ? body : accent,
    Sole: f.extremities === 'paws' ? belly : f.extremities === 'gloves' ? '#f4efe4' : hsl(accent, ([h, s, l]) => [h, s, clamp(l - 0.12, 0.1, 0.9)]),
    Glove: f.extremities === 'gloves' ? '#f7f6f1' : body, Tip: hsl(body, ([h, s, l]) => [h, s * 0.4, 0.16]),
    Sclera: '#ffffff', Pupil: '#17182b', Cheek: '#ec5a63',
    ...(f.promise === 'pride' ? { Jersey: accent } : {}),
  };
}

// ══════════ the shapes: every form a ball, an egg or a cone (law 8) ══════════

/** a profile: the ring's share of its radius at t ∈ [0, 1] along the shape */
const PROFILES = Object.freeze({
  ball: (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
  egg: (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * (0.86 + 0.14 * t),
  cone: (t) => (t < 0.22 ? Math.sqrt(Math.max(0, 1 - ((0.22 - t) / 0.22) ** 2)) : 1 - (t - 0.22) / 0.78),
  bud: (t) => (t < 0.3 ? 0.45 : Math.sqrt(Math.max(0, 1 - ((t - 0.65) / 0.35) ** 2))),   // a stalk swelling to a ball
});
const TS = Object.freeze([0.05, 0.16, 0.3, 0.5, 0.7, 0.84, 0.95]);

/** A loft from A to B along a profile, its ring `r` a radius or [half-width, half-height] (frame 'keep': a run mostly
 *  along y keeps its front up). The tip of a cone keeps `tip` of the radius. A right part (its name ends in R) mirrors by
 *  name; any other must lie on the midline. `e` squares the rings (the block accent). */
function shape(name, A, B, r, profile, { group, bind, tip = 0.06, e, ts = TS } = {}) {
  const P = PROFILES[profile], d = sub(B, A), sc = (t) => Math.max(P(t), profile === 'cone' ? tip : 0.12);
  const ring = (t) => (Array.isArray(r) ? r.map((x) => r4(x * sc(t))) : r4(r * sc(t)));
  return { name, kind: 'loft', frame: 'keep', mirror: name.endsWith('R') ? 'name' : 'plane', group, bind, ...(e && e !== 2 ? { e } : {}),
    stations: ts.map((t) => ({ at: V(add(A, mul(d, t))), r: ring(t) })), caps: { back: V(A), tip: V(B) } };
}

// ══════════ the body ══════════

/** a point on the head's ellipsoid (centre C, radii rx, ry, rz) along a direction at azimuth (from +y toward +x) and
 *  elevation, and its outward normal */
function onHead(H, az, el) {
  const d = [Math.cos(rad(el)) * Math.sin(rad(az)), Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el))];
  const t = 1 / Math.hypot(d[0] / H.rx, d[1] / H.ry, d[2] / H.rz);
  const P = add(H.C, mul(d, t));
  const n = unit([(P[0] - H.C[0]) / (H.rx * H.rx), (P[1] - H.C[1]) / (H.ry * H.ry), (P[2] - H.C[2]) / (H.rz * H.rz)]);
  return { P, n };
}
/** a point on the head at head-radius coordinates (x across, y front, z up) */
const onHeadAt = (H) => (x, y, z) => V([H.C[0] + x * H.rx, H.C[1] + y * H.ry, H.C[2] + z * H.rz]);

/** a lens hugging the head: a short loft along the normal, its ring [half-width, half-height] (frame 'keep': the ring's
 *  front stays up), sunk at its back so its rim meets the head, proud at its face by `out` head radii */
function lens(name, H, az, el, w, h, out, group, bind) {
  const { P, n } = onHead(H, az, el), R = H.rz, at = (s) => V(add(P, mul(n, s * R)));
  return { name, kind: 'loft', frame: 'keep', slots: 'ring12', mirror: name.endsWith('R') ? 'name' : 'plane', group, bind,
    stations: [{ at: at(out - 0.09), r: [r4(w * R * 0.9), r4(h * R * 0.9)] }, { at: at(out), r: [r4(w * R), r4(h * R)] }, { at: at(out + 0.016), r: [r4(w * R * 0.72), r4(h * R * 0.72)] }],
    caps: { back: at(out - 0.11), tip: at(out + 0.024) } };
}

/** a ball trunk: `n` stations up an ellipsoid (centre z, half-height rz, radii rx, ry) */
function ballTrunk(name, cz, rz, rx, ry, n, group, bind) {
  const stations = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (Math.PI * (i + 0.5)) / n; return { z: r4(cz + rz * Math.sin(a)), r: [r4(rx * Math.cos(a)), r4(ry * Math.cos(a))] }; });
  return { name, kind: 'trunk', mirror: 'plane', group, bind, stations, caps: { back: [0, 0, r4(cz - rz)], tip: [0, 0, r4(cz + rz)] } };
}

/** The ring plan: { plan, H, height }. */
export function mascotPlan(sheet, { title = 'a mascot' } = {}) {
  const f = sheet.facets, { M, k } = measuresOf(sheet), orb = f.form === 'orb';
  const wx = 1 + 0.05 * Math.round(Math.log(k.width) / Math.log(1 + STEP));   // a wide promise widens the head and the body
  // ── the vertical layout: soles on z = 0 ──
  const [fw, fl, fh] = M.foot, R = M.headR;
  const ankleZ = r4(fh * 1.3), hipZ = r4(ankleZ + M.leg), neckZ = orb ? 0 : r4(hipZ + M.bodyH);
  const H = orb ? { C: [0, 0, r4(fh * 1.1 + R * 0.92)], rx: r4(R * wx), ry: r4(R * 0.96), rz: r4(R * 0.92) }
    : { C: [0, 0, r4(neckZ + R * 0.72)], rx: r4(R * wx), ry: r4(R * 0.94), rz: r4(R * 0.9) };
  const top = r4(H.C[2] + H.rz), headBind = orb ? 'torso' : 'head';
  // ── the joints (the right side; the rig's and the limbs') ──
  const hipX = orb ? r4(H.rx * 0.38) : r4(M.bodyR * 0.55);
  const shZ = orb ? r4(H.C[2] - H.rz * 0.15) : r4(neckZ - M.bodyH * 0.12), shX = orb ? r4(H.rx * 0.82) : r4(M.bodyR * wx * 0.82);
  const armDir = unit(orb ? [0.85, 0.15, -0.5] : [0.62, 0.08, -0.78]);
  const sh = [shX, 0, shZ], elbow = add(sh, mul(armDir, M.arm * 0.5)), wrist = add(sh, mul(armDir, M.arm)), knuckles = add(wrist, mul(armDir, M.hand * 1.2));
  const J = {
    hip: [hipX, 0, hipZ], knee: [hipX, r4(M.leg * 0.12), r4((hipZ + ankleZ) / 2)], ankle: [hipX, r4(-fl * 0.3), ankleZ],
    toeBase: [hipX, r4(fl * 0.3), r4(fh * 0.9)], toeTip: [hipX, r4(fl * 0.85), r4(fh * 0.8)],
    shoulder: sh, elbow: V(elbow), wrist: V(wrist), knuckles: V(knuckles),
  };
  const hand = M.hand, limb = hand * LIMB_OF_HAND[f.extremities], legR = orb ? limb * 0.9 : limb * 1.15;
  const body = orb ? [] : [{ name: 'body', kind: 'trunk', mirror: 'plane', group: 'Body',
    // a pear (law 6: the mass low), its top drawn in under the head (law 3: no neck)
    stations: [0, 0.18, 0.4, 0.62, 0.82, 1].map((t, i) => { const rr = M.bodyR * [0.62, 0.93, 1, 0.94, 0.8, 0.55][i]; return { z: r4(hipZ - M.bodyR * 0.45 + t * (M.bodyH + M.bodyR * 0.45)), r: [r4(rr * wx), r4(rr * 0.92)] }; }),
    caps: { back: [0, 0, r4(hipZ - M.bodyR * 0.62)], tip: [0, 0, r4(neckZ + M.bodyR * 0.2)] },
    bind: { bone: 'torso', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 1 }, st2: { pelvis: 0.5, torso: 0.5 }, tip: { torso: 0.6, head: 0.4 } } } }];
  // the shoe: an egg from the heel to past the toe, its sole on the ground (law 6: big feet carry the pose)
  const heel = [hipX, r4(-fl * 0.95), r4(fh)], toe = [hipX, r4(fl * 1.05), r4(fh)];
  const segments = [
    ...body,
    ballTrunk('head', H.C[2], H.rz, H.rx, H.ry, 11, 'Body', headBind),
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: r4(legR), rB: r4(legR * 0.92), mirror: 'name', group: 'Body', bind: { bone: 'thighR', prev: 'pelvis', next: 'shinR' } },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'ankle', rA: r4(legR * 0.92), rB: r4(legR * 0.85), mirror: 'name', group: 'Body', bind: { bone: 'shinR', prev: 'thighR', next: 'metaR' } },
    shape('shoeR', heel, toe, [r4(fw), r4(fh)], 'egg', { group: 'Shoe', bind: 'metaR' }),
    { name: 'upperArmR', kind: 'segment', from: 'shoulder', to: 'elbow', rA: r4(limb), rB: r4(limb * 0.92), mirror: 'name', group: 'Body', bind: { bone: 'upperArmR', prev: 'torso', next: 'foreArmR' } },
    { name: 'foreArmR', kind: 'segment', from: 'elbow', to: 'wrist', rA: r4(limb * 0.92), rB: r4(limb * (f.extremities === 'gloves' ? 1.5 : 0.9)), mirror: 'name', group: 'Body', bind: { bone: 'foreArmR', prev: 'upperArmR', next: 'handR' } },
    shape('handR', V(sub(wrist, mul(armDir, hand * 0.4))), V(add(wrist, mul(armDir, hand * 2))), r4(hand), 'ball', { group: 'Glove', bind: 'handR' }),
    ...eyes(f, H, k),
    ...(f.eyes === 'dots' ? [lens('cheekR', H, 44, -24, 0.13, 0.11, 0.006, 'Cheek', headBind)] : []),
    ...hookParts(f, H, { M, hipZ, neckZ, headBind, orb }),
  ];
  const joints = Object.fromEntries(Object.entries(J).map(([n, p]) => [n, V(p)]));
  for (const s of segments) for (const [n, p] of Object.entries(s.joints || {})) joints[n] = V(p);
  for (const s of segments) delete s.joints;
  // the parts each dial turns, by what was built: the head's own (bound with it) and everything above the legs
  const twin = (n) => `${n.slice(0, -1)}L`;
  const bound = Object.fromEntries(segments.flatMap((x) => { const b = typeof x.bind === 'string' ? x.bind : x.bind?.bone; return x.mirror === 'name' ? [[x.name, b], [twin(x.name), b]] : [[x.name, b]]; }));
  const names = Object.keys(bound);
  const { rig, clips, dials } = rigOf(f, { J, H, hipZ, neckZ, top, orb, k, headParts: names.filter((n) => bound[n] === 'head'), upper: names.filter((n) => !/^(thigh|shin|shoe)[RL]$/.test(n)) });
  const paint = [
    ...(orb ? [] : [{ part: 'body', t: [0, 0.42], run: [0.12, 0.8], group: 'Belly' }]),
    ...(f.promise === 'pride' && !orb ? [{ part: 'body', t: [0.42, 1], run: [0.3, 1], group: 'Jersey' }, { part: 'body', t: [0, 0.42], run: [0.55, 1], group: 'Jersey' }] : []),
    ...(f.eyes === 'joined' ? [{ part: 'head', t: [0, 0.36], run: [0.1, 0.42], group: 'Belly' }] : []),
    ...(f.extremities === 'gloves' ? [{ part: 'foreArm', run: [0.7, 1], group: 'Glove' }] : []),
    { part: 'shoe', t: [0.7, 1], group: 'Sole' },
    ...(f.hook === 'ears' && f.accent === 'spike' ? [{ part: 'ear', run: [0.6, 1], group: 'Tip' }] : []),
  ];
  const height = r4(Math.max(top, ...segments.flatMap((s) => (s.kind === 'loft' ? [s.caps.tip[2], ...s.stations.map((x) => x.at[2])] : [])).filter(Number.isFinite)));
  const plan = {
    schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y', note: `metres; ${title}, soles on z = 0` },
    symmetry: { plane: 'x=0', policy: 'midline parts: right half authored, left half mirrored by name; limbs: right authored, left mirrored in x with R ↔ L renamed' },
    style: { slots: 'ring12', limbSlots: 'ring8', e: 2 },
    joints, segments, dials, rig, clips, paint,
    palette: mascotPalette(sheet, k),
  };
  return { plan, H, height };
}

/** The eyes (law 4): the white, the pupil turned a little toward the nose, one glint up and out. */
function eyes(f, H, k) {
  const X = EYE_FORMS[f.eyes], s = k.size, az = X.az + 2.5 * k.gap, el = X.el + 7 * k.lift, bind = f.form === 'orb' ? 'torso' : 'head';
  const out = [];
  if (X.w) out.push(lens('eyeR', H, az, el, X.w * s, X.h * s, 0.004, 'Sclera', bind));
  const pz = X.w ? 0.022 : 0.006, [pw, ph] = X.pupil.map((x) => x * s * k.pupil), deg = 180 / Math.PI;
  const paz = az + X.nudge, pel = X.w ? el - 1.5 : el;
  out.push(lens('pupilR', H, paz, pel, pw, ph, pz, 'Pupil', bind));
  out.push(lens('glintR', H, paz + 0.3 * pw * deg, pel + 0.35 * ph * deg, X.glint * s, X.glint * s, pz + 0.02, 'Sclera', bind));
  return out;
}

/** The hook (law 2), drawn in the accent's family (law 5): pointed, round or squared. Each part carries its joints. */
function hookParts(f, H, { M, hipZ, neckZ, headBind, orb }) {
  const R = H.rz, at = onHeadAt(H), spike = f.accent === 'spike', block = f.accent === 'block', e = block ? 4 : undefined;
  const g = (group = 'Body', bind = headBind) => ({ group, bind, e });
  switch (f.hook) {
    case 'ears': {
      if (spike) return [shape('earR', at(0.42, -0.06, 0.62), at(0.74, -0.14, 1.6), [r4(0.2 * R), r4(0.08 * R)], 'cone', { ...g(), tip: 0.1 })];
      if (block) return [shape('earR', at(0.5, -0.06, 0.55), at(0.66, -0.1, 1.3), [r4(0.17 * R), r4(0.08 * R)], 'egg', g())];
      return [shape('earR', at(0.55, -0.1, 0.62), at(0.8, -0.14, 1.12), [r4(0.26 * R), r4(0.09 * R)], 'ball', g())];
    }
    case 'quills': {
      const tip = spike || block ? 0.06 : 0.3;
      return [
        shape('quill0', at(0, -0.3, 0.75), at(0, -1.65, 0.62), r4(0.32 * R), 'cone', { ...g(), tip }),
        shape('quill1R', at(0.3, -0.45, 0.32), at(0.58, -1.6, 0.14), r4(0.3 * R), 'cone', { ...g(), tip }),
        shape('quill2R', at(0.26, -0.5, -0.15), at(0.44, -1.5, -0.46), r4(0.28 * R), 'cone', { ...g(), tip }),
      ];
    }
    case 'snout': return [shape('snout', at(0, 0.3, -0.38), at(0, 1.75, -0.2), [r4(0.62 * R), r4(0.55 * R)], 'egg', g())];
    case 'tuft': {
      if (f.accent === 'round') return [shape('tuft', at(0, 0.1, 0.88), at(0, 0.38, 1.45), r4(0.24 * R), 'bud', g('Accent'))];
      return [shape('tuft', at(0, 0.05, 0.85), at(0, 0.5, 1.45), r4(0.15 * R), block ? 'egg' : 'cone', { ...g('Accent'), tip: 0.06 })];
    }
    case 'antenna': return [
      { name: 'stalk', kind: 'segment', from: 'stalkA', to: 'stalkB', joints: { stalkA: at(0, -0.05, 0.92), stalkB: at(0, 0.05, 1.6) }, rA: r4(0.035 * R), rB: r4(0.03 * R), mirror: 'plane', group: 'Body', bind: headBind },
      shape('bulb', at(0, 0.05, 1.5), at(0, 0.07, spike ? 2.05 : 1.9), r4(0.14 * R), spike ? 'cone' : block ? 'egg' : 'ball', { ...g('Accent'), tip: 0.06 }),
    ];
    case 'tail': {
      const s = orb ? R : M.bodyR * 1.6, bind = orb ? 'torso' : 'pelvis';
      const base = orb ? at(0, -0.9, -0.5) : V([0, -M.bodyR * 0.8, hipZ + M.bodyR * 0.15]);
      if (spike) {
        const mid = V(add(base, [0, -0.5 * s, 0.4 * s])), tip = V(add(base, [0, -0.55 * s, 1.25 * s]));
        return [shape('tail0', base, mid, r4(0.14 * s), 'egg', g('Body', bind)), shape('tail1', V(sub(mid, [0, -0.03 * s, 0.05 * s])), tip, [r4(0.07 * s), r4(0.24 * s)], 'egg', { ...g('Body', bind), e: 4 })];
      }
      if (block) return [shape('tail0', base, V(add(base, [0, -0.62 * s, 0.25 * s])), r4(0.2 * s), 'egg', g('Body', bind))];
      return [shape('tail0', V(add(base, [0, 0.08 * s, 0])), V(add(base, [0, -0.42 * s, 0.08 * s])), r4(0.26 * s), 'ball', g('Belly', bind))];
    }
    case 'spines': {
      const rows = orb ? [[-0.25, 0.95], [-0.78, 0.6], [-0.98, 0.1]] : [[-0.35, 0.92], [-0.85, 0.5], [-1, 0]];
      const out = rows.map(([y, z], i) => { const b = at(0, y * 0.92, z * 0.92), d = unit([0, y, z]), r = 0.2 * R * (1 - 0.12 * i);
        return shape(`spine${i}`, b, V(add(b, mul(d, 0.45 * R))), r4(r), spike ? 'cone' : 'egg', { ...g('Accent'), tip: 0.06 }); });
      if (!orb) { const b = V([0, -M.bodyR * 0.82, neckZ - M.bodyH * 0.3]); out.push(shape('spine3', b, V(add(b, [0, -0.38 * R, 0.1 * R])), r4(0.16 * R), spike ? 'cone' : 'egg', { ...g('Accent', 'torso'), tip: 0.06 })); }
      return out;
    }
    default: return [];
  }
}

// ══════════ the rig, the clips, the dials (laws 9, 10) ══════════

function rigOf(f, { J, H, hipZ, neckZ, top, orb, k, headParts, upper }) {
  const bodyTop = orb ? H.C[2] : neckZ;
  const rig = {
    joints: {
      pelvisHub: { at: [0, 0, hipZ] }, navel: { at: [0, 0, r4(orb ? H.C[2] - H.rz * 0.2 : (hipZ + bodyTop) / 2)] }, neckHub: { at: [0, 0, r4(bodyTop)] },
      headBase: { at: [0, 0, r4(orb ? H.C[2] + H.rz * 0.2 : neckZ + H.rz * 0.15)] }, headTop: { at: [0, 0, top] },
      hip$S: { at: J.hip }, knee$S: { at: J.knee }, ankle$S: { at: J.ankle }, toeBase$S: { at: J.toeBase }, toeTip$S: { at: J.toeTip },
      shoulder$S: { at: J.shoulder }, elbow$S: { at: J.elbow }, wrist$S: { at: J.wrist }, knuckles$S: { at: J.knuckles, rides: 'foreArm$S' },
    },
    bones: [
      { id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }, { id: 'torso', head: 'navel', tail: 'neckHub', aux: ['shoulderL', 'shoulderR'] },
      { id: 'neck', head: 'neckHub', tail: 'headBase' }, { id: 'head', head: 'headBase', tail: 'headTop' },
      { perSide: [
        { id: 'upperArm$S', head: 'shoulder$S', tail: 'elbow$S' }, { id: 'foreArm$S', head: 'elbow$S', tail: 'wrist$S' }, { id: 'hand$S', head: 'wrist$S', tail: 'knuckles$S' },
        { id: 'thigh$S', head: 'hip$S', tail: 'knee$S' }, { id: 'shin$S', head: 'knee$S', tail: 'ankle$S' }, { id: 'meta$S', head: 'ankle$S', tail: 'toeBase$S' }, { id: 'toes$S', head: 'toeBase$S', tail: 'toeTip$S' },
      ] },
    ],
    legs: Object.fromEntries(['R', 'L'].map((S) => [S, { hip: `hip${S}`, knee: `knee${S}`, hock: `ankle${S}`, toeBase: `toeBase${S}`, toeTip: `toeTip${S}`, pole: [0, 1, 0] }])),
    reach: 'clamp',
  };
  // the ready pose: arms a little out from the body, never hanging dead (a mascot is always presenting)
  const arms = { armL: { x: -0.55, y: 0.18, z: -0.8 }, armR: { x: 0.55, y: 0.18, z: -0.8 }, elbowL: 'slight', elbowR: 'slight' };
  const up = { armL: { x: -0.45, y: 0.15, z: 0.88 }, armR: { x: 0.45, y: 0.15, z: 0.88 }, elbowL: 'slight', elbowR: 'slight' };
  const stance = r4(1 + 0.15 * Math.max(0, k.stance)), READY = { ...arms, crouch: 0.04, stance };
  const dip = r4(clamp(0.22 + 0.08 * k.bounce, 0.1, 0.4)), hopLift = r4(0.3 * top);
  const IDLE = {
    bouncy: [READY, { ...READY, crouch: dip, armL: { x: -0.7, y: 0.2, z: -0.6 }, armR: { x: 0.7, y: 0.2, z: -0.6 } }, READY, { ...READY, crouch: dip }],
    zippy: [READY, { ...READY, heelR: -28 }, READY, { ...READY, heelR: -28 }],
    floaty: [{ ...READY, crouch: 0, lift: r4(0.04 * top), support: 'none' }, { ...READY, crouch: 0, lift: r4(0.1 * top), support: 'none', armL: { x: -0.75, y: 0.1, z: -0.4 }, armR: { x: 0.75, y: 0.1, z: -0.4 } }],
    sturdy: [{ ...READY, stance: r4(stance * 1.2) }, { ...READY, stance: r4(stance * 1.2), crouch: 0.09 }],
    swaying: [READY, { ...READY, spine: { sideBend: ['left', 0.35] } }, READY, { ...READY, spine: { sideBend: ['right', 0.35] } }],
  };
  const clips = {
    idle: IDLE[f.energy],
    hop: [READY, { ...READY, crouch: 0.35 }, { ...up, crouch: 0, lift: hopLift, support: 'none' }, { ...READY, crouch: 0.2 }, READY],
    cheer: [READY, { ...up, crouch: 0.12 }, { ...READY, crouch: 0.02 }, { ...up, crouch: 0.12 }],
    // the hand clear of the face: the whole arm swings out and back, the elbow nearly straight
    wave: [READY, { ...READY, armR: { x: 0.72, y: 0.25, z: 0.65 } }, { ...READY, armR: { x: 0.97, y: 0.2, z: 0.15 } }, { ...READY, armR: { x: 0.72, y: 0.25, z: 0.65 } }],
  };
  const dials = {
    lean: { min: -12, max: 20, rest: 0, doc: 'degrees the body, the head and the arms hinge forward about the hips; the legs stay planted', op: 'hinge', parts: upper, pivot: orb ? 'head/back' : 'body/back', axis: 'x', sign: -1 },
    // the head cocks (the orb has no separate head: the whole ball leans instead)
    ...(orb ? {} : { tilt: { min: -18, max: 18, rest: 0, doc: 'degrees the head cocks to the side about the base of the head (+ toward its right): the asymmetric life on a symmetric body', op: 'hinge', parts: headParts, pivot: 'head/back', axis: 'y', sign: 1 } }),
  };
  return { rig, clips, dials };
}

// ══════════ the call, the ledger, the thesis ══════════

/** where each channel's notes land in the call */
const AT = Object.freeze({
  promise: 'the facets the promise leaned (the whole sheet)', frame: 'plan.joints, plan.segments (head, body, limbs): the form\'s measures',
  face: 'plan.segments eye*, pupil*, glint*, cheek* (lenses hugging the head)', silhouette: 'the round core and the hook\'s segments',
  extremities: 'plan.segments hand*, shoe*, the limbs\' radii', palette: 'plan.palette, plan.paint', motion: 'plan.clips idle, hop, cheer, wave; the lean and tilt dials',
});
/** the lean and the tilt a promise sets after the mint (law 9: the asymmetric life) */
export const PROMISE_POSE = Object.freeze({ speed: { lean: 8 }, cheer: { tilt: 6 }, mischief: { lean: -4, tilt: -9 }, might: { lean: 4 }, comfort: {}, pride: {}, wonder: { tilt: 5 } });

/** The first create_character call for a mascot sheet: { door, thesis, create, after, ledger }. */
export function mascotPlanFromSheet(sheet, { title } = {}) {
  if (sheet?.tuning !== 'mascot') throw new Error('mascot: a mascot sheet (rollMascot) compiles here');
  const f = sheet.facets;
  const name = title || `${f.hue} ${f.promise} mascot (mascot seed ${sheet.seed})`;
  const { plan, H, height } = mascotPlan(sheet, { title: name });
  const heads = Math.round((height / (2 * H.rz)) * 10) / 10;
  const thesis = `${f.form}, ${heads} heads · a round core, a ${f.accent} accent (${sheet.accord}) · ${f.eyes} eyes · ${f.hook === 'none' ? 'no hook' : f.hook} · ${f.extremities} · ${f.energy} · ${Math.round(height * 100) / 100} m`;
  const lean = (sheet.derives.motion || []).includes('motion.lean +') ? 4 : 0;
  const pose = { ...PROMISE_POSE[f.promise] };
  if (lean && !pose.lean) pose.lean = lean;
  const after = Object.entries(pose).filter(([d]) => plan.dials[d]).map(([d, value]) => ({ op: 'set', path: `/dials/${d}`, value }));
  const ledger = Object.entries(sheet.notes).flatMap(([ch, notes]) => notes.map((n) => ({ channel: ch, line: n.line, from: n.from, at: AT[ch] })));
  return { door: 'creature', thesis, create: { as: 'creature', title: name, spec: { plan, hullShade: true, toon: { light: true } } }, after, ledger };
}
