/**
 * THE AUTHORED FOOT (the hero's authored game body, the structured core): the bare foot hero-foot.js draws on the same
 * ankle and toe joints, its rings across the foot from the heel to the ball (ring12), the big toe and the four beside it
 * each a short limb6 tube. Footwear reads one TOES segment, so the toes are read as one: a ring12 block round the five
 * at four places along them (their widest across, their sole and their top), its R slots on the side the foot's own
 * ring's are. The foot is read up to the TOE BASE (a ring there), as the realistic body's is, the toes' block from that
 * ring on. The shank is the leg's own. The upper is those rings stood off by the sock's thickness past the farthest of
 * the bare foot and toes near each (the foot's rings doubled, so a card's footprint pieces have points to read), and a
 * boot's shaft the shank's rings from its share up (a ring interpolated where it starts). Each piece takes the weights of
 * the skin nearest it (the toes' block, the five toes' together). The door draws no foot under a closed shoe
 * (mcp/tools/layered.js wearFeet); a sandal's straps and sole are on the bare foot itself.
 *
 *   authoredFoot(recipe, R) → the adapter (../index.js); null where the body wears no bare foot
 *   footwearAuthored(recipe, R, spec, { id, group }) → wearFootwear on it
 *
 * Pure and deterministic.
 */
import { wearFootwear, footLength } from '../expand.js';
import { bindNearest, mean, unitv } from '../parts.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
/** the share of the library's reference resolution the game body's shoes are drawn at */
export const FACETS = 0.5;
const TOES = ['hallux', 'toe2', 'toe3', 'toe4', 'toe5'];
const RING12 = ['front', 'frontR', 'frontSideR', 'sideR', 'backSideR', 'backR', 'back', 'backL', 'backSideL', 'sideL', 'frontSideL', 'frontL'];
const pw = (t, e) => Math.sign(t) * Math.abs(t) ** (2 / e);
const uOf = (P) => P.stations.map((st, i) => st.u ?? i);

/** the foot as footwear reads it: the bare foot's rings up to the TOE BASE, a ring interpolated there (the realistic
 * body's foot ends at the toe base, and a card's toe cap is laid from it: the game foot's ball ring lies a centimetre past
 * it, and the leather there, tucked under the cap, had let the foot through behind the cap's edge) */
function footTo(P, { ankle, toeBase }) {
  const F = unitv([toeBase[0] - ankle[0], toeBase[1] - ankle[1], 0]), along = (p) => (p[0] - ankle[0]) * F[0] + (p[1] - ankle[1]) * F[1];
  const uT = along(toeBase), mids = P.stations.map((st) => along(mean(Object.values(st.points)))), j = mids.findIndex((u) => u >= uT);
  if (j <= 0) return { foot: P, end: P.stations[P.stations.length - 1].points };
  const a = P.stations[j - 1].points, b = P.stations[j].points, f = (uT - mids[j - 1]) / ((mids[j] - mids[j - 1]) || 1);
  const end = Object.fromEntries(P.slots.map((sl) => [sl, a[sl].map((x, q) => r6(x + (b[sl][q] - x) * f))]));
  const stations = [...P.stations.slice(0, j).map((st, i) => ({ id: st.id, u: i, points: st.points })), { id: `st${j}`, u: j, points: end }];
  return { foot: { ...P, stations, caps: { back: P.caps?.back, tip: mean(Object.values(end)).map((x, q) => r6(x + F[q] * 0.004)) } }, end };
}

/** the five toes as one block: from the foot's ring at the toe base (so the foot and the toes are one run, as the
 * realistic body's are: two tubes meeting at different sections let the foot through between them) on through a ring12
 * at `n − 1` places to their tips, each spanning what the toes span there (across the foot and up from the floor), the
 * top round and the sole flatter as the foot's own sections are */
function toesBlock(parts, S, { ankle, toeBase }, n = 4) {
  const toes = TOES.map((t) => parts[`${t}${S}`]); if (toes.some((P) => !P)) return null;
  const F = unitv([toeBase[0] - ankle[0], toeBase[1] - ankle[1], 0]), side0 = [-F[1], F[0], 0];
  const isPt = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  const pts = toes.flatMap((P) => [...P.stations.flatMap((st) => Object.values(st.points)), ...Object.values(P.caps || {})]).filter(isPt);
  const rel = (p) => [p[0] - ankle[0], p[1] - ankle[1]], along = (p) => { const d = rel(p); return d[0] * F[0] + d[1] * F[1]; };
  // (the R side as the foot's own ring at the toe base has it, so the block winds as the foot does: on the mirrored left
  // foot its R slots run to the outer side, not the big toe's)
  const { end: ball } = footTo(parts[`foot${S}`], { ankle, toeBase }), uB = along(mean(Object.values(ball))), bc = mean(Object.values(ball));
  const sgn = Math.sign((ball.sideR[0] - bc[0]) * side0[0] + (ball.sideR[1] - bc[1]) * side0[1]) || 1;
  const Sd = side0.map((x) => x * sgn), across = (p) => { const d = rel(p); return d[0] * Sd[0] + d[1] * Sd[1]; };
  const u1 = Math.max(...pts.map(along)), win = (u1 - uB) / (n - 1);
  const stations = [{ id: 'st0', u: 0, points: Object.fromEntries(RING12.map((sl) => [sl, ball[sl].map(r6)])) }, ...Array.from({ length: n - 1 }, (_, j) => {
    const i = j + 1, u = uB + (u1 - uB) * ((0.94 * i) / (n - 1)), near = pts.filter((p) => Math.abs(along(p) - u) <= win * 0.75), q = near.length ? near : pts;
    const s0 = Math.min(...q.map(across)), s1 = Math.max(...q.map(across)), zb = Math.min(...q.map((p) => p[2])), zt = Math.max(...q.map((p) => p[2]));
    const sc = (s0 + s1) / 2, zc = (zb + zt) / 2, base = [ankle[0] + F[0] * u + Sd[0] * sc, ankle[1] + F[1] * u + Sd[1] * sc];
    const points = Object.fromEntries(RING12.map((sl, k) => { const t = (2 * Math.PI * k) / RING12.length, ct = Math.cos(t), st = Math.sin(t);
      const v = ct >= 0 ? (zt - zc) * pw(ct, 2.4) : (zc - zb) * pw(ct, 3.2), h = ((s1 - s0) / 2) * pw(st, 2.6);
      return [sl, [r6(base[0] + Sd[0] * h), r6(base[1] + Sd[1] * h), r6(zc + v)]]; }));
    return { id: `st${i}`, u: r6((2 * i) / (n - 1)), points };
  })];
  const mid = (st) => mean(Object.values(st.points)), c0 = mid(stations[0]), c1 = mid(stations[n - 1]);
  const block = { layer: 1, closure: 'closed', slots: RING12, stations, caps: { back: c0.map((x, q) => r6(x - F[q] * 0.004)), tip: c1.map((x, q) => r6(x + F[q] * 0.004)) }, group: toes[0].group ?? 'Skin' };
  // (its weights the five toes' together: a reference part of all their rings, each ring's own blend)
  const ref = { bind: { bone: toes[0].bind?.bone ?? `toes${S}`, blend: {} }, stations: [] };
  toes.forEach((P, j) => { for (const st of P.stations) { const id = `${TOES[j]}_${st.id}`; ref.stations.push({ id, points: st.points }); const w = P.bind?.blend?.[st.id]; if (w) ref.bind.blend[id] = w; } });
  return { ...block, bind: bindNearest(block, ref, { rings: true }) };
}
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));

/** a ring of `P` at `u`, between the stations either side of it */
function ringAt(P, u) {
  const U = uOf(P); let i = 0; while (i < U.length - 2 && U[i + 1] < u) i++;
  const f = Math.max(0, Math.min(1, (u - U[i]) / ((U[i + 1] - U[i]) || 1)));
  return Object.fromEntries(P.slots.map((sl) => [sl, P.stations[i].points[sl].map((x, q) => x + (P.stations[i + 1].points[sl][q] - x) * f)]));
}
/** the leather over `P` from `u` on: its rings (one interpolated at `u`) stood off its middle by `thick`, closed, its
 * weights the skin's nearest. With `over` (the bare foot's and toes' points) and `F` (the foot's forward line, the axis
 * its rings are cross-sections of), each point stood `thick` off the farthest bare point near it in its direction too,
 * so nothing of the foot (a toe beside the ball, the heel's cap) shows through; its caps the bare part's own, stood off */
function leather(P, from, thick, group, { over = null, F = null, dense = false } = {}) {
  const U = uOf(P), lo = Math.min(...U), keep = P.stations.filter((st, i) => U[i] > from + 1e-6);
  const whole = !(from > lo + 1e-6), rings = [...(from > lo + 1e-6 ? [{ u: from, points: ringAt(P, from) }] : []), ...keep.map((st) => ({ u: st.u ?? P.stations.indexOf(st), points: st.points }))];
  if (rings.length < 2) return null;
  // (dense: a ring between each two, the foot's: its rings are few, and a card's footprint pieces (a heel's seat, a sole's
  // outline) are read off the leather's points near the floor)
  if (dense) for (let i = rings.length - 1; i > 0; i--) { const a = rings[i - 1], b = rings[i]; rings.splice(i, 0, { u: (a.u + b.u) / 2, points: Object.fromEntries(P.slots.map((sl) => [sl, a.points[sl].map((x, q) => (x + b.points[sl][q]) / 2)])) }); }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const stations = rings.map((g, i) => { const c = mean(Object.values(g.points));
    return { id: `st${i}`, u: r6(g.u), points: Object.fromEntries(P.slots.map((sl) => { const p = g.points[sl], v = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      if (!over || !F) { const d = unitv(v); return [sl, p.map((x, q) => r6(x + d[q] * thick))]; }
      // (in the ring's own plane: out from its middle, as far as the bare foot reaches there (2 cm either side of the ring,
      // about half the foot's ring spacing, so the straight leather between two rings clears it), and `thick` past it)
      const a = dot(v, F), w = v.map((x, q) => x - F[q] * a), r = Math.hypot(...w), d = unitv(w);
      let reach = r;
      for (const o of over) { const t = [o[0] - c[0], o[1] - c[1], o[2] - c[2]]; if (Math.abs(dot(t, F) - a) > 0.02) continue; const along = dot(t, d), perp = Math.hypot(...t.map((x, q) => x - F[q] * dot(t, F) - d[q] * along)); if (along > reach && perp < 0.012) reach = along; }
      return [sl, c.map((x, q) => r6(x + F[q] * a + d[q] * (reach + thick)))]; })) }; });
  const mid = (st) => mean(Object.values(st.points)), end = (a, b, cap) => { const c = mid(a), d = unitv(c.map((x, q) => x - mid(b)[q])), o = cap && whole ? cap : c;
    return o.map((x, q) => r6(x + d[q] * (thick + 0.002))); };
  const n = stations.length, part = { layer: 1, closure: 'closed', garment: true, slots: P.slots, stations, caps: { back: end(stations[0], stations[1], P.caps?.back), tip: end(stations[n - 1], stations[n - 2], P.caps?.tip) }, ...(group ? { group } : {}) };
  return { ...part, bind: bindNearest(part, P, { rings: true }) };
}

export function authoredFoot(recipe, R) {
  const J = R?.joints ?? recipe.rig?.joints ?? {}, at = (k) => (Array.isArray(J[k]) ? J[k] : J[k]?.at);   // (an array's own `.at` is a method)
  // (the bare foot only: a shod game body's foot is the shoe's two boxes, no foot to wear a card over)
  if (!['R', 'L'].every((S) => recipe.parts[`foot${S}`] && recipe.parts[`hallux${S}`])) return null;
  const joints = (S) => ({ ankle: at(`ankle${S}`), toeBase: at(`toeBase${S}`), toeTip: at(`toeTip${S}`) });
  const block = Object.fromEntries(['R', 'L'].flatMap((S) => [[`toes${S}`, toesBlock(recipe.parts, S, joints(S))], [`foot${S}`, footTo(recipe.parts[`foot${S}`], joints(S)).foot]]));
  const bare = (name) => block[name] ?? recipe.parts[name];
  const A = {
    sides: ['R', 'L'],
    seg: (kind, S) => (bare(`${kind}${S}`) ? `${kind}${S}` : null),
    joints,
    bare,
    // (`k`: the foot's size over the reference's, the leather's thickness scaled with it)
    upper(sock, { id, group, k = 1 }) {
      const thick = (sock.thick || 0.004) * k, out = {};
      for (const S of ['R', 'L']) {
        const { ankle, toeBase } = joints(S), F = unitv([toeBase[0] - ankle[0], toeBase[1] - ankle[1], 0]);
        const over = ['foot', ...TOES].map((t) => recipe.parts[`${t}${S}`]).filter(Boolean).flatMap((P) => [...pointsOf(P), ...Object.values(P.caps || {}).filter((q) => Array.isArray(q) && q.length === 3)]);
        for (const kind of ['foot', 'toes']) { const P = bare(`${kind}${S}`), L = P && leather(P, -Infinity, thick, group, { over, F, dense: kind === 'foot' }); if (L) out[`${id}_${kind}${S}`] = L; }
        // (a boot's shaft: the shank from its share up to the ankle)
        const sh = recipe.parts[`shank${S}`];
        if (sock.height === 'boot' && sh) { const L = leather(sh, A.u('shank', 1 - (sock.shaft ?? 0.3)), thick, group); if (L) out[`${id}_shank${S}`] = L; }
      }
      return out;
    },
    u: (kind, share) => { const P = bare(`${kind}R`); if (!P) return 2 * share; const U = uOf(P), lo = Math.min(...U), hi = Math.max(...U); return lo + (hi - lo) * share; },
  };
  A.size = () => footLength(A);
  // (the game body's polygons: the soles' outlines, the toe cap and the wraps at half the reference's)
  A.facets = FACETS;
  return A;
}

/** The footwear on the authored body (null where it wears no bare foot). */
export const footwearAuthored = (recipe, R, spec = 'shoes', opts = {}) => { const A = authoredFoot(recipe, R); return A ? wearFootwear(A, spec, opts) : null; };
