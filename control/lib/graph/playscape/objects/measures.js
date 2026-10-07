/**
 * measures — a game object read against the object laws (laws.js), the hero's way: measure the built faces, read the
 * measures against the bands its INTEREST sets, and say per law what is out of band and what moves it. Advice, never a
 * refusal (docs/bicycles.md). Pure: a function of the faces and the frame they face.
 *
 *   objectMeasures(faces, { at, N, U }, interest) → {
 *     segments     notches in the front silhouette at play distance, each at least NOTCH_PX frame pixels (the
 *                  pixels inside the silhouette's convex hull it leaves empty, by connected region, that open onto
 *                  the outside: a hole the shape closes all round is not outline)
 *     third        the primary detail's span over the object's (33/66), front view
 *     detailPx     the primary detail's span in frame pixels at play distance (the eye spot)
 *     emboss       the value step across the 66 (body and fill): its darkest to its lightest
 *     bands        { <steps>: [body band, detail band] } under each tone's hard steps
 *     valuesOnly   every face a grey with no texture
 *     status       faces on the accent group
 *   }
 *   objectAdvice(m, interest) → [{ law, line }]
 */
import { INTEREST, EYE_SPOT_PX, NOTCH_PX, THIRD_BAND, EMBOSS_STEP, TONE_STEPS, metresPerPixel } from './laws.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;

// the area of a face (a planar quad or polygon), for weighting means
function area(c) {
  let x = 0, y = 0, z = 0;
  for (let i = 1; i + 1 < c.length; i++) {
    const a = sub(c[i], c[0]), b = sub(c[i + 1], c[0]);
    x += a[1] * b[2] - a[2] * b[1]; y += a[2] * b[0] - a[0] * b[2]; z += a[0] * b[1] - a[1] * b[0];
  }
  return Math.hypot(x, y, z) / 2;
}

function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** The front silhouette as a pixel grid at a scale (metres per pixel): its mask, its hull's mask, its size. */
function raster(polys, mpp) {
  const all = polys.flat();
  const x0 = Math.min(...all.map((q) => q[0])), y0 = Math.min(...all.map((q) => q[1]));
  const W = Math.ceil((Math.max(...all.map((q) => q[0])) - x0) / mpp) + 3, H = Math.ceil((Math.max(...all.map((q) => q[1])) - y0) / mpp) + 3;
  const px = (q) => [(q[0] - x0) / mpp + 1, (q[1] - y0) / mpp + 1];
  const mask = new Uint8Array(W * H), hmask = new Uint8Array(W * H);
  const fillTri = (m, a, b, c) => {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-9) return;
    const xa = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), xb = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const ya = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), yb = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const X = x + 0.5, Y = y + 0.5;
      const l1 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / d, l2 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / d;
      if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) m[y * W + x] = 1;
    }
  };
  for (const poly of polys) { const q = poly.map(px); for (let i = 1; i + 1 < q.length; i++) fillTri(mask, q[0], q[i], q[i + 1]); }
  const h = hull(all).map(px);
  for (let i = 1; i + 1 < h.length; i++) fillTri(hmask, h[0], h[i], h[i + 1]);
  return { mask, hmask, W, H };
}

// the hull's empty regions big enough to read that open onto the outside: each one a break between silhouette
// segments. A hole the shape closes all round (a seam between two leaves, a crack between faces) is not part of the
// outline and does not count. `label` (optional) receives each counted region's number per pixel.
function notches({ mask, hmask, W, H }, label = null) {
  const seen = new Uint8Array(W * H);
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!hmask[i] || mask[i] || seen[i]) continue;
    const region = [i]; seen[i] = 1;
    let opens = false, x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let r = 0; r < region.length; r++) {
      const j = region[r], x = j % W, y = (j - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) {
        if (k < 0 || !hmask[k]) { opens = true; continue; }
        if (!mask[k] && !seen[k]) { seen[k] = 1; region.push(k); }
      }
    }
    // a sliver a pixel or two across along the hull is rasterising, not a break: a notch is at least 3 px each way, and
    // as thick on average (a sliver along a sloped edge has a long box and no depth)
    if (opens && region.length >= NOTCH_PX && x1 - x0 >= 2 && y1 - y0 >= 2 && region.length / Math.max(x1 - x0 + 1, y1 - y0 + 1) >= 3) { n++; if (label) for (const j of region) label[j] = n; }
  }
  return n;
}

/** The front silhouette the segment count reads, as a picture: the grid, its mask, its hull, and each counted notch. */
export function frontSilhouette(faces, frame, interest) {
  const at = frame.at || [0, 0, 0], U = frame.U || [1, 0, 0];
  const g = raster(faces.map((f) => f.corners.map((p) => [dot(sub(p, at), U), p[2]])), metresPerPixel(INTEREST[interest].distance));
  const label = new Uint8Array(g.W * g.H);
  return { ...g, label, count: notches(g, label) };
}

const span = (polys) => {
  const all = polys.flat();
  if (!all.length) return 0;
  return Math.max(Math.max(...all.map((q) => q[0])) - Math.min(...all.map((q) => q[0])), Math.max(...all.map((q) => q[1])) - Math.min(...all.map((q) => q[1])));
};
const mean = (fs) => { let a = 0, v = 0; for (const f of fs) { const w = area(f.corners); a += w; v += w * f.value; } return a ? v / a : null; };
// a value on a band's edge is in the band above it (an area-weighted mean of 0.4s comes back a hair under 0.4)
const band = (v, steps) => Math.min(steps - 1, Math.floor(v * steps + 1e-9));

export function objectMeasures(faces, frame, interest) {
  const I = INTEREST[interest], mpp = metresPerPixel(I.distance);
  const at = frame.at || [0, 0, 0], U = frame.U || [1, 0, 0];
  const front = (f) => f.corners.map((p) => [dot(sub(p, at), U), p[2]]);
  // a face's role is its part when the part names one (body, fill, detail, handle), else its group's (obj:detail):
  // an entry that names its parts by element (a bridge's posts, planks, ropes) is judged by the role each plays
  const ROLES = { body: 'body', fill: 'fill', detail: 'detail', handle: 'handle', 'obj:body': 'body', 'obj:fill': 'fill', 'obj:detail': 'detail', 'obj:status': 'handle' };
  const role = (f) => ROLES[f.part] ?? ROLES[f.group] ?? f.part;
  const polys = faces.map(front), detail = faces.filter((f) => role(f) === 'detail');
  const of = (name) => faces.filter((f) => role(f) === name);
  const fill = [...of('body'), ...of('fill')].map((f) => f.value);
  const body = mean(of('body')), det = mean(detail);
  return {
    segments: notches(raster(polys, mpp)),
    third: detail.length ? r3(span(detail.map(front)) / span(polys)) : 0,
    detailPx: detail.length ? r3(span(detail.map(front)) / mpp) : 0,
    emboss: fill.length ? r3(Math.max(...fill) - Math.min(...fill)) : 0,
    bands: Object.fromEntries(TONE_STEPS.map((s) => [s, det === null ? null : [band(body, s), band(det, s)]])),
    valuesOnly: faces.every((f) => !f.texture && Array.isArray(f.tint) && f.tint[0] === f.tint[1] && f.tint[1] === f.tint[2]),
    status: faces.filter((f) => f.group === 'obj:status').length,
  };
}

export function objectAdvice(m, interest) {
  const I = INTEREST[interest], out = [];
  const say = (law, line) => out.push({ law, line });
  if (m.segments < I.segments[0]) say('inverse-interest', `${m.segments} silhouette segment breaks; a ${interest} shows at least ${I.segments[0]}: let a part stand past the outline (a strap's end, a header's overhang).`);
  if (m.segments > I.segments[1]) say('inverse-interest', `${m.segments} silhouette segment breaks; a ${interest} shows at most ${I.segments[1]}: merge parts into the main mass so it stays quiet.`);
  if (I.third) {
    if (!m.third) say('thirty-three', 'no primary detail: name one part the 33.');
    else if (m.third < THIRD_BAND[0]) say('thirty-three', `the primary detail spans ${m.third} of the object; grow it toward a third (${THIRD_BAND.join('–')}).`);
    else if (m.third > THIRD_BAND[1]) say('thirty-three', `the primary detail spans ${m.third} of the object; it is competing with the main mass: bring it toward a third.`);
    if (m.third && m.detailPx < EYE_SPOT_PX) say('thirty-three', `the primary detail is ${m.detailPx} px at play distance; under the ${EYE_SPOT_PX} px eye spot it does not read.`);
  }
  if (m.emboss < EMBOSS_STEP) say('emboss-fill', `the 66 steps ${m.emboss} in value; shade it in (grooves, straps, lines) by at least ${EMBOSS_STEP}.`);
  for (const [s, b] of Object.entries(m.bands)) if (b && b[0] === b[1]) say('detail-holds-band', `under ${s} hard steps the detail and the mass share band ${b[0]}: push the detail's value away from the body's.`);
  if (!m.valuesOnly) say('values-only', 'a face carries colour or a texture; build in greys and leave colour to the tone.');
  if (m.status && !I.accent) say('accent-is-use', `a ${interest} carries the accent; keep it for what can be used.`);
  if (!m.status && I.accent) say('accent-is-use', `a ${interest} has no accent part; mark what the player uses with obj:status.`);
  return out;
}
