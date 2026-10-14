/** face-tint.js — the FACE TINT: a per-corner colour multiplier on the landmark head's skin, the vertex colour shipped
 * faces paint where a texture would: a soft OCCLUSION where the skin turns in on itself (the eye's corners, the
 * nostrils, the mouth's corners, the fold under the lip) and a warm BLUSH over the cheeks, the nose's tip and the ears.
 * Read off the geometry alone (no texture, no light), so it rides any pose and any light the corner shade takes.
 *
 *   faceTint(mesh, { ao, blush })   per face, its three corners' [r, g, b] multipliers, or null where it touches nothing
 *
 * `ao`: { k, lo, hi } — a corner darkens by up to k as its CAVITY (the welded neighbours' centroid in front of it along
 * its normal, over the mean edge) rises from lo to hi. `blush`: { amount, tint } — the cheeks (under each eye, toward the
 * mouth's corner), the nose's tip and the ears take `tint` by `amount` times a smooth falloff. `socket`: { k, lower, shade }
 * — the EYE SOCKET's shadow, the brow's over the eye: the skin from the eye's top up to the brow darkens by up to k,
 * the most just inside the eye's middle toward the nose, and the hollow under the lower lid by `lower` times that;
 * `shade` the share each channel loses (a skin's shadow keeps its red). Placed and sized off each eye and its brow (in
 * the eye's own width and the eye-to-brow gap, no metres), so it follows any face the dials make.
 * Deterministic: a function of the rest mesh. */
const SKIN = /^(cranium|jaw|ear[RL])$/;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const smooth = (lo, hi, x) => { const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };
const mean = (pts) => (pts.length ? [0, 1, 2].map((k) => pts.reduce((t, p) => t + p[k], 0) / pts.length) : null);

export function faceTint(mesh, { ao = null, blush = null, groove = null, socket = null } = {}) {
  if (!ao && !blush && !groove && !socket) return null;
  const V = mesh.vertices, F = mesh.faces, partOf = (fi) => mesh.provenance[F[fi][0]].part;
  const head = []; F.forEach((t, fi) => { if (SKIN.test(partOf(fi)) && mesh.groups[fi] === 'Skin') head.push(fi); });
  if (!head.length) return null;
  // the weld: the skin's corners by position (the cranium and the jaw meet on a coincident seam)
  const q = 1e-5, key = (p) => `${Math.round(p[0] / q)},${Math.round(p[1] / q)},${Math.round(p[2] / q)}`;
  const id = new Map(), pos = [], nrm = [], nbr = [];
  const wid = (vi) => { const k = key(V[vi]); let i = id.get(k); if (i === undefined) { i = pos.length; id.set(k, i); pos.push(V[vi]); nrm.push([0, 0, 0]); nbr.push(new Set()); } return i; };
  const W = head.map((fi) => F[fi].map(wid));
  head.forEach((fi, h) => { const [a, b, c] = W[h], n = cross(sub(pos[b], pos[a]), sub(pos[c], pos[a]));
    for (const i of W[h]) { nrm[i][0] += n[0]; nrm[i][1] += n[1]; nrm[i][2] += n[2]; }
    nbr[a].add(b); nbr[a].add(c); nbr[b].add(a); nbr[b].add(c); nbr[c].add(a); nbr[c].add(b); });
  // the occlusion: concave corners darken
  const occ = pos.map((p, i) => {
    if (!ao) return 1; const n = nrm[i], l = len(n); if (!(l > 0) || !nbr[i].size) return 1;
    const ns = [...nbr[i]].map((j) => pos[j]), c = mean(ns), e = ns.reduce((t, x) => t + len(sub(x, p)), 0) / ns.length;
    return 1 - ao.k * smooth(ao.lo, ao.hi, dot(sub(c, p), n) / l / (e || 1));
  });
  // the blush's places, off the head's own parts: the eyes, the mouth, the nose's tip
  const pts = (re) => { const o = []; mesh.provenance.forEach((pv, vi) => { if (re.test(pv.part)) o.push(V[vi]); }); return o; };
  const eyes = [mean(pts(/^eyeR$/)), mean(pts(/^eyeL$/))].filter(Boolean), mouth = mean(pts(/^mouth[RL]$/));
  let tip = null; for (const p of pts(/^cranium$/)) if (Math.abs(p[0]) < 0.006 && (!tip || p[1] > tip[1])) tip = p;
  const spots = [];
  if (blush && eyes.length === 2 && mouth) {
    const drop = eyes[0][2] - mouth[2], r = 0.55 * Math.abs(drop);
    for (const e of eyes) spots.push({ c: [e[0] * 1.05, e[1] - 0.004, e[2] - 0.5 * drop], r, w: 1 });
    if (tip) spots.push({ c: tip, r: 0.35 * r, w: 0.7 });
  }
  const warm = (p, part) => {
    if (!blush) return 0; let w = /^ear/.test(part) ? 0.6 : 0;
    for (const s of spots) w = Math.max(w, s.w * (1 - smooth(0.4, 1, len(sub(p, s.c)) / s.r)));
    return w * blush.amount;
  };
  // the ALAR GROOVE (`groove`: { k, r, band }): the crease round each nostril's wing into the cheek, a ring `r` round the
  // wing's centre (over the nostril, out to its side), darkened on its cheek side (behind the wing's front)
  const wings = groove ? [pts(/^nostrilR$/), pts(/^nostrilL$/)].filter((a) => a.length).map((a) => { const c = mean(a); return [c[0] * 1.35, c[1] - 0.002, c[2] + 0.004]; }) : [];
  const crease = (p) => { let d = 0; for (const c of wings) { if (p[1] > c[1] + 0.003 || Math.sign(p[0]) !== Math.sign(c[0])) continue; const x = Math.abs(len(sub(p, c)) - groove.r) / groove.band; d = Math.max(d, 1 - smooth(0, 1, x)); } return 1 - groove.k * d; };
  // the SOCKET: per eye its box (the eye part) and its brow's underside (the brow part on its side; none ⇒ an eye's width
  // above); a point's place in the eye's units: u across (0 the eye's middle, −1 its inner corner), v up from the eye's
  // top over the gap to the brow, w down from the eye's bottom over the eye's height
  const box = (a) => { const lo = [0, 1, 2].map((k) => Math.min(...a.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...a.map((p) => p[k]))); return { lo, hi }; };
  const sockets = socket ? ['R', 'L'].flatMap((sd) => {
    const e = pts(new RegExp(`^eye${sd}$`)); if (!e.length) return [];
    const E = box(e), b = pts(new RegExp(`^brow${sd}$`)), a = (E.hi[0] - E.lo[0]) / 2, h = E.hi[2] - E.lo[2], cx = (E.hi[0] + E.lo[0]) / 2;
    const top = b.length ? box(b).lo[2] : E.hi[2] + 2 * a;
    return a > 0 && h > 0 ? [{ cx, cy: (E.hi[1] + E.lo[1]) / 2, a, h, eT: E.hi[2], eB: E.lo[2], g: Math.max(top - E.hi[2], 0.5 * h) }] : [];
  }) : [];
  const shadow = (p) => {
    let d = 0;
    for (const S of sockets) {
      if (Math.sign(p[0]) !== Math.sign(S.cx) || Math.abs(p[1] - S.cy) > 1.5 * S.a) continue;
      const u = (Math.abs(p[0]) - Math.abs(S.cx)) / S.a, v = (p[2] - S.eT) / S.g, w = (S.eB - p[2]) / S.h;
      // the upper socket: the brow's shadow, its heart under the brow's inner half; the lid's crease, the skin under the brow
      const up = 1 - smooth(0.35, 1, Math.hypot((u + 0.2) / 1.35, (v - 0.4) / 0.75));
      // the lower: the hollow under the lid, a narrower band
      const low = socket.lower * (1 - smooth(0.3, 1, Math.hypot((u + 0.05) / 1.15, (w - 0.5) / 0.5)));
      d = Math.max(d, up, low);
    }
    return d;
  };
  const dark = (p) => { const d = sockets.length ? socket.k * shadow(p) : 0; return [0, 1, 2].map((k) => 1 - d * socket.shade[k]); };
  const out = new Array(F.length).fill(null);
  head.forEach((fi, h) => { const part = partOf(fi);
    out[fi] = W[h].map((i) => { const a = occ[i] * (groove ? crease(pos[i]) : 1), b = warm(pos[i], part), s = socket ? dark(pos[i]) : null; return [0, 1, 2].map((k) => +(a * (1 + (blush ? blush.tint[k] - 1 : 0) * b) * (s ? s[k] : 1)).toFixed(4)); });
  });
  return out;
}
