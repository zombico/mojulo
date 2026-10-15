/** dress-silhouette.js — the DRESSED SILHOUETTE read: what the cloth does to the body's own lines, measured on the rings.
 *
 * hero-style-critic.js reads the bare body's proportions against a canon. This reads the dress over it: at the body's
 * landmarks (the waist, the hips, the thigh, the knee, the calf, the ankle) the girth of the outermost copy garment
 * against the girth of the skin under it, ring for ring (a garment ring carries its body ring's station id:
 * body-garment.js), the skin's read by TAPE (the convex hull round the ring and, on the torso, the navel and chest layers over
 * it: what a tape measure reads). Two ratios carry the read a figure is drawn by:
 *   waist    the cloth's waist over its hips against the body's: a waist the cloth fills reads as a box
 *   taper    the cloth's ankle over its calf against the body's: a leg whose taper the cloth erases reads as a tube
 * Skirts and drape panels are left out: they hang by design (principles law 2), and their flare is their cut.
 *
 * Advice, never a refusal (docs/bicycles.md): a line per read out of band, naming what moves it. A machine gate: the
 * numbers say what the rings do; whether the figure reads is the eyes gate's. Pure: a function of the recipe's parts.
 */

const girth = (part, st) => { const p = part.slots.map((s) => st.points[s]); let g = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; g += Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]); } return g; };
const r3 = (x) => Math.round(x * 1000) / 1000;
/** A TAPE MEASURE: the perimeter of the convex hull of points seen from above (what a tape round them reads) */
function tape(pts) {
  const P = pts.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return 0;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...P].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const H = [...lo.slice(0, -1), ...hi.slice(0, -1)]; let g = 0; for (let i = 0; i < H.length; i++) { const q = H[(i + 1) % H.length]; g += Math.hypot(q[0] - H[i][0], q[1] - H[i][1]); } return g;
}
/** the layers that lie over a trunk part (its tape includes them): the chest's and the navel's over the torso */
const LAYERS = { torso: /^(navel|bust|pectoral)[RL]?$/ };
const cm = (x) => Math.round(x * 1000) / 10;

/** The bands the advice reads: how much more the cloth's ratio may be than the body's */
export const SILHOUETTE_BANDS = Object.freeze({ waist: 0.08, taper: 0.06 });

/** Each covered station of `src` (a body part, or its R side): { id, body, cloth } girths in metres, the cloth the
 * outermost copy garment's ring there */
function covered(parts, src) {
  const B = parts[src]; if (!B?.stations) return [];
  const over = Object.keys(parts).filter((n) => parts[n].garment && n.endsWith(`_${src}`) && !/_(skirt|panel)$/.test(n));
  // the body by tape: the part's ring and, on a trunk, the points of the layers over it within a slab about the ring
  const layer = LAYERS[src] ? Object.keys(parts).filter((n) => LAYERS[src].test(n) && parts[n].stations).flatMap((n) => parts[n].stations.flatMap((s) => Object.values(s.points))) : [];
  return B.stations.flatMap((st) => { let best = 0;
    for (const n of over) { const G = parts[n].stations.find((s) => s.id === st.id); if (G) best = Math.max(best, girth(parts[n], G)); }
    const ring = Object.values(st.points), z = ring.reduce((a, p) => a + p[2], 0) / ring.length;
    return best ? [{ id: st.id, body: Math.max(girth(B, st), tape([...ring, ...layer.filter((p) => Math.abs(p[2] - z) < 0.02)])), cloth: best }] : []; });
}

/** The dressed silhouette of a recipe → { landmarks, waist?, taper?, advice } (null with no copy garment) */
export function dressSilhouette(recipe) {
  const parts = recipe?.parts || {}; if (!Object.values(parts).some((p) => p.garment)) return null;
  const torso = covered(parts, 'torso'), pelvis = covered(parts, 'pelvis'), thigh = covered(parts, 'thighR'), shank = covered(parts, 'shankR');
  const minBy = (rows) => rows.reduce((a, b) => (b.body < a.body ? b : a), rows[0]), maxBy = (rows) => rows.reduce((a, b) => (b.body > a.body ? b : a), rows[0]);
  const L = {
    // the waist: the BODY's narrowest torso ring below its widest (the chest; the rings run hem → collar), read only where
    // a garment covers it (a crop top or an open bolero leaves the waist to the skin)
    waist: (() => { const T = parts.torso?.stations || [], g = T.map((st) => girth(parts.torso, st)), chest = g.indexOf(Math.max(...g));
      if (chest < 1) return null; const w = T[g.slice(0, chest).indexOf(Math.min(...g.slice(0, chest)))].id; return torso.find((r) => r.id === w) ?? null; })(), hip: pelvis.length ? maxBy(pelvis) : null,
    thigh: thigh.length ? maxBy(thigh) : null, knee: thigh.length ? thigh[thigh.length - 1] : null,
    calf: shank.length ? maxBy(shank) : null, ankle: shank.length ? shank[shank.length - 1] : null,
  };
  const landmarks = Object.fromEntries(Object.entries(L).filter(([, v]) => v).map(([k, v]) => [k, { at: v.id, body: cm(v.body), cloth: cm(v.cloth), gain: cm(v.cloth - v.body) }]));
  const out = { landmarks, advice: [] };
  if (L.waist && L.hip) { const body = L.waist.body / L.hip.body, cloth = L.waist.cloth / L.hip.cloth; out.waist = { body: r3(body), cloth: r3(cloth) };
    if (cloth - body > SILHOUETTE_BANDS.waist) out.advice.push(`waist: the cloth's waist is ${r3(cloth)} of its hips against the body's ${r3(body)} — the waist is filled; a top's \`fit: 'fitted'\` or \`'skin'\`, or a lower \`fit\` dial, brings it in`); }
  if (L.calf && L.ankle && L.ankle !== L.calf) { const body = L.ankle.body / L.calf.body, cloth = L.ankle.cloth / L.calf.cloth; out.taper = { body: r3(body), cloth: r3(cloth) };
    if (cloth - body > SILHOUETTE_BANDS.taper) out.advice.push(`taper: the cloth's ankle is ${r3(cloth)} of its calf against the body's ${r3(body)} — the leg reads as a tube; trousers cut \`tapered\` or \`skinny\` keep the line (\`straight\` and \`wide\` fall away by design)`); }
  return out;
}
