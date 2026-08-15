/**
 * prelit-transfer — the quantised position->colour transfer that swaps a rig's rest-face
 * vexar colours for externally BAKED GI colours (prelit-figure.plan.md). This is the exact
 * mechanism the map-GI bicycle uses to recolour a map's faces (scripts/bake-world-gi.mjs),
 * factored out so it can run on RIG rest faces in two places:
 *
 *   • the offline BIND bake (the mobile-suit pack's scripts/spike-prelit-suit.mjs): build a posMap from a freshly
 *     baked GLB and recolour the captured normFaces to render/verify;
 *   • the RESOLVE-time recolour (worlds/world-scene.js unitRef block): build a posMap from a
 *     BOUND mesh (mesh-store) and hand bakeUnitRig a `prelit` step that recolours normFaces
 *     before packing — so a GI-baked suit WALKS at zero runtime cost.
 *
 * The join is a corner-position key quantised to 0.1 world units: baked geometry and the
 * rig's rest faces are the SAME geometry through a GLB round trip, and 0.1 absorbs the
 * exporter's de-collide nudge (why the map bicycle matches ~94% on a map, ~100% on a suit
 * with no roof cut). Colours are carried as sRGB hex, exactly as `cornerFills` expects.
 */

export function hexToRgb(h) {
  if (typeof h !== 'string') return null;
  const n = parseInt(h.replace('#', ''), 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export const rgbToHex = (c) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0')).join('');

// Corner-position key. Quantised to 0.01 world units: the map bicycle used 0.1 (maps span
// thousands of units), but a baked SUIT is only ~12 units tall, so 0.1 buckets are coarse enough
// to quantise a smooth GI gradient into visible stair-steps on curved armor (helmet dome, calves).
// 0.01 gives ~150 buckets across a dome (smooth) and still absorbs the exporter's de-collide nudge
// (STAGGER_EPS 5e-4, and only on overlapping coplanar faces) — coincident/welded corners still land
// in one bucket and average. Bind + resolve share this key, so both sides stay consistent.
export const pkey = (p) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)},${Math.round(p[2] * 100)}`;

/**
 * Build a quantised position->colour map from baked faces (each `{ corners, fill, cornerFills? }`,
 * as glbToFaces / readBoundMeshFaces return). Coincident corners (welded seams) average, so a
 * shared vertex resolves to one blended colour. Returns a Map<pkey, [r,g,b,count]> (linear 0..1).
 */
export function buildPosMap(bakedFaces) {
  const posMap = new Map();
  for (const f of bakedFaces) {
    const cf = f.cornerFills && f.cornerFills.length === f.corners.length ? f.cornerFills : null;
    f.corners.forEach((p, i) => {
      const rgb = hexToRgb(cf ? cf[i] : f.fill);
      if (!rgb) return;
      const k = pkey(p);
      const e = posMap.get(k) || [0, 0, 0, 0];
      e[0] += rgb[0]; e[1] += rgb[1]; e[2] += rgb[2]; e[3] += 1;
      posMap.set(k, e);
    });
  }
  return posMap;
}

/**
 * Recolour a rig's per-bone normFaces (bakeUnitRig's `[bone][face]` rest faces, each a quad
 * `{ corners, fill }`) IN PLACE from a posMap: each corner takes its baked colour, written as
 * `cornerFills` (+ a representative `fill`). Unmatched corners fall back to the face's first
 * matched corner; a face with no matches keeps its original fill (never blanked). Returns
 * `{ matched, missed }` for a coverage gate. This is the callback bakeUnitRig's `prelit` opt runs.
 *
 * `scale` undoes bakeUnitRig's `targetH` height-normalization before keying: a suit is baked
 * at its NATIVE height (posMap keys live there), but a WORLD figure may set `targetH` to
 * normalize combatant scale (e.g. the arena's 24u), which multiplies every rest corner by `s`.
 * Dividing the query position by that same `s` maps it back to the posMap's native space so the
 * transfer lands. Default 1 (native bake, picker cards, the offline bind bake) → no-op.
 */
export function recolourNormFaces(normFaces, posMap, scale = 1) {
  let matched = 0, missed = 0;
  const inv = scale && scale !== 1 ? 1 / scale : 1;
  for (const fs of normFaces) {
    for (const f of fs) {
      const fills = f.corners.map((p) => {
        const e = posMap.get(inv === 1 ? pkey(p) : pkey([p[0] * inv, p[1] * inv, p[2] * inv]));
        if (!e || !e[3]) { missed++; return null; }
        matched++;
        return rgbToHex([e[0] / e[3], e[1] / e[3], e[2] / e[3]]);
      });
      const solved = fills.filter(Boolean);
      if (!solved.length) continue;
      f.cornerFills = fills.map((h) => h || solved[0]);
      const a = [0, 0, 0];
      for (const h of solved) { const c = hexToRgb(h); a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; }
      f.fill = rgbToHex([a[0] / solved.length, a[1] / solved.length, a[2] / solved.length]);
    }
  }
  return { matched, missed };
}
