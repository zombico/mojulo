/**
 * TECH READOUT — a crafted thing read through the world's camera (tech-eras.js): how wide its facets read on today's
 * screen at the distance its tier is met at (the widest, against the style's limit: chunky is the look, crude is not;
 * the median, against the narrowest worth its triangles), its triangles under its rank's ceiling (the hero leads), its
 * silhouette segments at the meet distance against its rank (playscape/objects/laws.js), whether its main mass is shaded
 * in, its render groups, and the atlas page its paint needs. The machine gate of the technology design loop: it advises,
 * never refuses.
 *
 * Reads any face list a crafter makes: blocks (`{ corners, group, value, tile? }`, a mark drawn into the tile is not a
 * triangle) and workbench faces (`{ corners, fill, texture?, material? }`, a value from the fill's luminance).
 *
 *   facets(faces) → [{ width, angle }]   every facet of a round: a face between two soft edges (neighbours turned 4–40°)
 *                                         no more than three times as wide as its neighbours on the curve,
 *                                         its width across that edge in metres
 *   techReadout(faces, { tier, rank?, camera?, style?, U? }) → { camera, tier, rank, distance, triangles, ceiling,
 *     facetPx: { widest, median, band }, segments, segmentBand, emboss, renderGroups, atlases, atlas, advice }
 *
 * Pure.
 */
import { objectMeasures } from '../playscape/objects/measures.js';
import { INTEREST, EMBOSS_STEP } from '../playscape/objects/laws.js';
import { DEFAULT_TECH_CAMERA, DEFAULT_TECH_STYLE, TECH_STYLES, meetDistance, pxPerMetre, triangleCeiling, atlasPage } from './tech-eras.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
/** A face's value (0…1): its own, or its fill's luminance. */
function valueOf(f) {
  if (typeof f.value === 'number') return f.value;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(f.fill ?? ''));
  if (!m) return 0.5;
  const n = parseInt(m[1], 16), [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return r3((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
/** Newell's normal and the area of a planar-ish polygon. */
function normalArea(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const L = len(n);
  return { n: L ? n.map((v) => v / L) : [0, 0, 1], area: L / 2 };
}
// a chamfer (45°) is a hard edge by design, even tilted by a taper; a curve's facets turn less
const SOFT = [4, 40];
export function facets(faces) {
  const key = (p) => p.map((v) => Math.round(v * 1e4)).join(','), edges = new Map(), info = faces.map((f) => normalArea(f.corners));
  faces.forEach((f, i) => f.corners.forEach((a, j) => {
    const b = f.corners[(j + 1) % f.corners.length], ka = key(a), kb = key(b);
    if (ka === kb) return;
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (!edges.has(k)) edges.set(k, { at: [a, b], faces: [] });
    edges.get(k).faces.push(i);
  }));
  // a facet of a round lies between two soft edges: a flat run beside a curve (a track's straight, a fin) has one
  const soft = faces.map(() => []);
  for (const { at, faces: fs } of edges.values()) {
    if (fs.length !== 2) continue;
    const [i, j] = fs, d = Math.max(-1, Math.min(1, info[i].n.reduce((s, v, k) => s + v * info[j].n[k], 0))), angle = (Math.acos(Math.abs(d)) * 180) / Math.PI;
    if (angle <= SOFT[0] || angle >= SOFT[1]) continue;
    const e = len(sub(at[1], at[0]));
    soft[i].push({ e, angle, by: j }); soft[j].push({ e, angle, by: i });
  }
  // and is about as wide as the facets either side of it: a straight run between two bends (a track's) is not
  const width = soft.map((S, f) => (S.length >= 2 ? info[f].area / (S.reduce((a, x) => a + x.e, 0) / S.length) : null));
  const out = [];
  soft.forEach((S, f) => {
    if (width[f] === null) return;
    const near = S.map((x) => width[x.by]).filter((w) => w !== null);
    if (near.length && width[f] > 3 * Math.min(...near)) return;
    out.push({ width: width[f], angle: S.reduce((a, x) => a + x.angle, 0) / S.length });
  });
  return out;
}
const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export function techReadout(faces, { tier, rank = 'interactable', camera = DEFAULT_TECH_CAMERA, style = DEFAULT_TECH_STYLE, U = [1, 0, 0] } = {}) {
  const distance = meetDistance(camera, tier), band = TECH_STYLES[style].facetPx, ceiling = triangleCeiling(rank), k = pxPerMetre(distance);
  const solid = faces.filter((f) => !f.tile && f.corners?.length >= 3);
  const triangles = solid.reduce((s, f) => s + f.corners.length - 2, 0);
  // the widest facet that reads (the 90th percentile: one odd face is not the look) and the median
  const F = facets(solid).map((f) => f.width * k), facetPx = { widest: r3(pct(F, 0.9)), median: r3(pct(F, 0.5)), band, n: F.length, wasted: r3(F.filter((x) => x < band[0]).length / Math.max(1, triangles)) };
  // the object laws read part roles; until adornment names a 33, every face is the 66
  const m = objectMeasures(solid.map((f) => ({ corners: f.corners, part: 'body', value: valueOf(f) })), { U, distance }, rank);
  const groups = new Set(solid.map((f) => f.texture ?? f.material?.id ?? f.material ?? 'vertex')), atlases = new Set(solid.map((f) => f.texture).filter(Boolean));
  const out = { camera, style, tier, rank, distance, triangles, ceiling, facetPx, segments: m.segments, segmentBand: INTEREST[rank].segments, emboss: m.emboss, renderGroups: groups.size, atlases: atlases.size, atlas: atlasPage(solid, distance), advice: [] };
  const say = (law, line) => out.advice.push({ law, line });
  if (!F.length) say('rounds', `no curved surface at all: every face meets its neighbour square. A ${style} piece rounds its masses (a lathe, a loft, a bevel) so its outline is not a stack of boxes.`);
  else if (facetPx.widest > band[1]) say('facets', `its facets read ${facetPx.widest} px wide at ${distance} m on today's screen; ${style} keeps them under ${band[1]} px: more sides on its rounds.`);
  // narrow facets are wasted when they are a real share of what it spends (a whip's tip is not)
  if (F.length && facetPx.median < band[0] && facetPx.wasted > 0.25) say('facets', `half its facets read under ${facetPx.median} px at ${distance} m; under ${band[0]} px they are wasted: fewer sides.`);
  if (triangles > ceiling) say('hero-leads', `${triangles} triangles; the hero leads, and a ${rank} spends at most ${ceiling}.`);
  const [lo, hi] = INTEREST[rank].segments;
  if (m.segments < lo) say('inverse-interest', `${m.segments} silhouette segments at ${distance} m; a ${rank} shows at least ${lo}: let adornment stand past the outline.`);
  if (m.segments > hi) say('inverse-interest', `${m.segments} silhouette segments at ${distance} m; a ${rank} shows at most ${hi}: merge pieces into the main mass.`);
  if (m.emboss < EMBOSS_STEP) say('emboss-fill', `the main mass steps ${m.emboss} in value; shade it in (panel lines, plates, wear) by at least ${EMBOSS_STEP}.`);
  if (groups.size > 2) say('render-groups', `${groups.size} render groups; an asset draws in at most 2: bake its materials into one atlas.`);
  return out;
}
