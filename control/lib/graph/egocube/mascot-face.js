/**
 * THE MASCOT'S FACE: the eyes, a mouth, lids and brows, and the EXPRESSIONS they make (docs/mascot.md, law 4: the eyes
 * carry the character, a mouth only when it acts). Every moving feature is a lens on its own bone, turned by a rig chain
 * about a pivot inside the head, so an expression is bone motion: it plays in the World's clips and exports in the
 * skinned GLB like any other channel.
 *
 *   lids    a lens of the face's colour above each eye, hidden inside the head when open (its pivot sits forward of
 *           the head's centre, so turned up it sinks) and turned down over the eye to close it: `lidR`, `lidL`
 *           (degrees down from the rest face)
 *   mouth   a dark lens with a tongue in it, and two LIPS of the face's colour over it: the upper lip turned down covers
 *           the mouth from the top (a smile: what shows is the bowl of the mouth under the lip's arc), the lower lip
 *           turned up covers it from the bottom (a frown); both apart is an open mouth, both met a closed one:
 *           `lipU`, `lipD` (degrees down)
 *   brows   a short bar over each eye: `browLift` (degrees up, both) and `browR`, `browL` (degrees the inner end drops)
 *
 * The REST face is the sheet's expression, built into the geometry, so a still shows it; a clip's channel values are the
 * other expressions' differences from it. Pure and deterministic.
 */
import { ringPoints, SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const V = (p) => p.map(r4);
const add = (a, b) => a.map((x, i) => x + b[i]); const sub = (a, b) => a.map((x, i) => x - b[i]); const mul = (a, s) => a.map((x) => x * s);
const len = (v) => Math.hypot(...v); const unit = (v) => mul(v, 1 / len(v));
const rad = (deg) => (deg * Math.PI) / 180; const deg = (r) => (r * 180) / Math.PI;
/** a vector turned about +x by `a` degrees (+ turns the front up), and about +y (+ drops the +x end) */
const turnX = (v, a) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
const turnY = (v, a) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return [v[2] * s + v[0] * c, v[1], v[2] * c - v[0] * s]; };

/** The expressions: how much of each eye the lid covers (0 open … 1 shut; a side each when they differ), how much of the
 *  mouth each lip covers (lipU from the top, lipD from the bottom: 0 … 1), and the brows (lift degrees, tilt degrees the
 *  inner end drops; a side each when they differ). First readings for the eyes gate. */
export const EXPRESSION_FACE = Object.freeze({
  happy: { lid: 0, lipU: 0.45, lipD: 0, brow: { lift: 4, tilt: -6 } },
  grin: { lid: 0.12, lipU: 0.26, lipD: 0, brow: { lift: 6, tilt: -4 } },
  content: { lid: 0.38, lipU: 0.47, lipD: 0.47, brow: { lift: 0, tilt: -3 } },
  determined: { lid: 0.28, lipU: 0.5, lipD: 0.4, brow: { lift: -3, tilt: 14 } },
  smirk: { lid: { R: 0.08, L: 0.42 }, lipU: 0.47, lipD: 0.43, brow: { R: { lift: 9, tilt: -8 }, L: { lift: -2, tilt: 10 } } },
  surprised: { lid: 0, lipU: 0.1, lipD: 0.1, brow: { lift: 13, tilt: -4 } },
  sad: { lid: 0.3, lipU: 0, lipD: 0.52, brow: { lift: 3, tilt: -16 } },
  angry: { lid: 0.32, lipU: 0.28, lipD: 0.5, brow: { lift: -5, tilt: 22 } },
  sleepy: { lid: 0.72, lipU: 0.5, lipD: 0.5, brow: { lift: -3, tilt: -2 } },
});
export const EXPRESSION_IDS = Object.freeze(Object.keys(EXPRESSION_FACE));
const side = (v, S) => (v && typeof v === 'object' && S in v ? v[S] : v);

/** a lens at `c` facing `n`: a short loft along the normal, its ring [half-width, half-height] (frame 'keep': front up) */
function lensAt(name, c, n, w, h, group, bind, mirror = name.endsWith('R') ? 'name' : 'plane') {
  const at = (s) => V(add(c, mul(n, s)));
  return { name, kind: 'loft', frame: 'keep', slots: 'ring12', mirror, group, bind,
    stations: [{ at: at(-0.09 * h * 4), r: [r4(w * 0.9), r4(h * 0.9)] }, { at: at(0), r: [r4(w), r4(h)] }, { at: at(0.016 * h * 4), r: [r4(w * 0.72), r4(h * 0.72)] }],
    caps: { back: at(-0.11 * h * 4), tip: at(0.024 * h * 4) } };
}
/** a bar at `c` facing `n`, its long axis turned `tilt` degrees (+ drops its inner end, the one toward the midline):
 *  a rings part, so its ring can lie across the normal at any angle. Each side is its own part (mirror null), so the
 *  two can rest differently. */
function barAt(name, c, n, w, h, tilt, group, bind) {
  const fam = SLOT_FAMILIES.ring12, up = unit(sub([0, 0, 1], mul(n, n[2]))), cr = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]];
  const across = unit(cr[0] < 0 ? mul(cr, -1) : cr);   // toward +x
  // the bar's short axis leans toward the end that rises: the outer end on the right (+x), the inner end on the left
  const t = rad(tilt), front = unit(add(mul(up, Math.cos(t)), mul(across, Math.sin(t) * (c[0] > 0 ? -1 : 1))));
  const st = (s, k) => ({ points: Object.fromEntries(Object.entries(ringPoints(add(c, mul(n, s)), n, [w * k, h * k], fam, 2, front)).map(([q, p]) => [q, V(p)])) });
  return { name, kind: 'rings', slots: 'ring12', mirror: null, group, bind, stations: [st(-0.6 * h, 0.9), st(0, 1), st(0.5 * h, 0.75)], caps: { back: V(add(c, mul(n, -0.8 * h))), tip: V(add(c, mul(n, 0.75 * h))) } };
}

/** where a direction from the centre `C` meets an ellipsoid of radii (rx, ry, rz) about it */
const surface = (E, u) => add(E.C, mul(u, 1 / Math.hypot(u[0] / E.rx, u[1] / E.ry, u[2] / E.rz)));
const inside = (E, p, margin = 0) => Math.hypot((p[0] - E.C[0]) / E.rx, (p[1] - E.C[1]) / E.ry, (p[2] - E.C[2]) / E.rz) < 1 - margin;
const dirOf = (az, el) => [Math.cos(rad(el)) * Math.sin(rad(az)), Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el))];

/**
 * The face's moving parts for a head H (centre C, radii rx, ry, rz), its eyes (the R eye's centre direction and its
 * half-height in head radii), the mouth's ellipsoid and direction, the groups and the bone everything rides.
 *   → { segments, joints, bones, chains, rest, channels(expression) }
 */
export function buildFace({ H, eye, mouth, brows, rest = 'happy', groups, ride }) {
  const R = H.rz, F = EXPRESSION_FACE, restF = F[rest] ?? F.happy;
  const segments = [], joints = {}, bones = [], chains = {};
  const J = (name, p) => { joints[name] = { at: V(p), rides: ride }; };
  J('faceC', H.C);

  // ── the lids ──
  const eyeP = surface(H, dirOf(eye.az, eye.el)), lidPivot = add(H.C, mul(sub(eyeP, H.C), 0.35));
  const dEye = len(sub(eyeP, lidPivot)), dLid = dEye + eye.lidOut * R, ue = unit(sub(eyeP, lidPivot));
  const aEye = deg(Math.atan((eye.h * R) / dEye)), lidH = eye.h * 1.15, lidW = eye.w * 1.3, aLid = deg(Math.atan((lidH * R) / dLid));
  // hidden: the least turn up at which the lid's face, its edges and its tip are inside the head
  let hide = aEye + aLid + 4;
  for (; hide < 85; hide += 1) { const u = turnX(ue, hide); if ([0, -aLid, aLid].every((a) => inside(H, add(lidPivot, mul(turnX(ue, hide + a), dLid + 0.03 * R)), 0.005)) && inside(H, add(lidPivot, mul(u, dLid + 0.03 * R)))) break; }
  const lidAngle = (c) => (c <= 0 ? hide : aEye + aLid - c * 2 * aEye);   // degrees up from the eye's centre
  const lidRest = { R: lidAngle(side(restF.lid, 'R')), L: lidAngle(side(restF.lid, 'L')) };
  const mx = (S) => (S === 'R' ? (p) => p : (p) => [-p[0], p[1], p[2]]);
  for (const S of ['R', 'L']) {
    const m = mx(S), u = turnX(ue, lidRest[S]);
    J(`lidBase${S}`, m(lidPivot)); J(`lidTip${S}`, m(add(lidPivot, mul(u, dLid))));
    bones.push({ id: `lid${S}`, head: `lidBase${S}`, tail: `lidTip${S}` });
    chains[`lid${S}`] = { axis: 'x', sign: -1, links: [{ pivot: `lidBase${S}`, joints: [`lidTip${S}`] }] };
    // each side its own part, at its own rest (the smirk rests one lid lower)
    segments.push(lensAt(`lid${S}`, m(add(lidPivot, mul(u, dLid))), m(u), lidW * R, lidH * R, groups.lid, `lid${S}`, null));
  }

  // ── the mouth ──
  const M = mouth.E, mu = unit(dirOf(0, mouth.el)), mP = surface(M, mu), mPivot = add(M.C, mul(sub(mP, M.C), 0.25));
  const um = unit(sub(mP, mPivot)), dM = len(sub(mP, mPivot)), mw = mouth.w * R, mh = mouth.h * R;
  segments.push(lensAt('mouth', add(mP, mul(um, 0.006 * R)), um, mw, mh, 'Mouth', ride));
  { const u = turnX(um, -deg(Math.atan((mh * 0.45) / dM))), p = add(mPivot, mul(u, dM + 0.014 * R)); segments.push(lensAt('tongue', p, u, mw * 0.55, mh * 0.42, 'Tongue', ride)); }
  const dLip = dM + 0.04 * R, lipW = mw * 1.45, lipH = mh * 1.15, aM = deg(Math.atan(mh / dM)), aLip = deg(Math.atan(lipH / dLip));
  const lipAngle = { lipU: (o) => aM + aLip - o * 2 * aM, lipD: (o) => -(aM + aLip) + o * 2 * aM };   // degrees up from the mouth's centre
  J('mouthC', mPivot);
  for (const L of ['lipU', 'lipD']) {
    const a = lipAngle[L](restF[L]), u = turnX(um, a);
    J(`${L}Tip`, add(mPivot, mul(u, dLip)));
    bones.push({ id: L, head: 'mouthC', tail: `${L}Tip` });
    chains[L] = { axis: 'x', sign: -1, links: [{ pivot: 'mouthC', joints: [`${L}Tip`] }] };
    segments.push(lensAt(L, add(mPivot, mul(u, dLip)), u, lipW, lipH, groups.lip, L));
  }

  // ── the brows ──
  const browEl = eye.el + deg(Math.atan(eye.h * 1.25)) + 6, browW = Math.max(eye.w * 1.1, 0.1), browH = brows.h;
  if (brows.on) {
    const restB = (S) => side(restF.brow, S) ?? { lift: 0, tilt: 0 };
    const u0 = dirOf(eye.az, browEl);
    for (const S of ['R', 'L']) {
      const m = mx(S), b = restB(S);
      const c = surface(H, turnX(u0, b.lift)), n = unit(sub(c, H.C)), cOut = add(c, mul(n, 0.012 * R));
      J(`browBase${S}`, m(cOut));
      // the bar's long axis, turned by the rest tilt: its outer end is the bone's tail (+ tilt: the outer end rises)
      J(`browSide${S}`, m(add(cOut, turnY([0.1 * R, 0, 0], -b.tilt))));
      bones.push({ id: `brow${S}`, head: `browBase${S}`, tail: `browSide${S}` });
      segments.push(barAt(`brow${S}`, m(cOut), m(n), browW * R, browH * R, b.tilt, groups.brow, `brow${S}`));
    }
    // a lift turns a brow about the head's centre; the tilt then turns it about its own middle
    for (const S of ['R', 'L']) chains[`browLift${S}`] = { axis: 'x', sign: 1, links: [{ pivot: 'faceC', joints: [`browBase${S}`, `browSide${S}`] }] };
    chains.browR = { axis: 'y', sign: -1, links: [{ pivot: 'browBaseR', joints: ['browSideR'] }] };
    chains.browL = { axis: 'y', sign: 1, links: [{ pivot: 'browBaseL', joints: ['browSideL'] }] };
  }

  /** an expression's channel values: its differences from the rest face, in each channel's degrees */
  const channels = (name) => {
    const E = F[name]; if (!E) throw new Error(`mascot: unknown expression '${name}' (known: ${EXPRESSION_IDS.join(', ')})`);
    const out = {};
    for (const S of ['R', 'L']) out[`lid${S}`] = r4(lidRest[S] - lidAngle(side(E.lid, S)));
    for (const L of ['lipU', 'lipD']) out[L] = r4(lipAngle[L](restF[L]) - lipAngle[L](E[L]));
    if (brows.on) {
      const e = (S) => side(E.brow, S), r = (S) => side(restF.brow, S);
      for (const S of ['R', 'L']) { out[`browLift${S}`] = r4(e(S).lift - r(S).lift); out[`brow${S}`] = r4(e(S).tilt - r(S).tilt); }
    }
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== 0));
  };
  /** the blink: both lids shut from the rest face */
  const blink = () => Object.fromEntries(['R', 'L'].map((S) => [`lid${S}`, r4(lidRest[S] - lidAngle(1))]));
  return { segments, joints, bones, chains, channels, blink };
}
