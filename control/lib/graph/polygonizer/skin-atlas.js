/**
 * skin-atlas — the deterministic ATLAS half of the wrap loop
 * (skin-over-mesh.plan.md phase 2). Division of labour: mojulo owns the CUTS
 * (island layout), the REGISTRATION (view reprojection), and the AUDIT (the
 * coverage machine gate); the image worker owns exactly one thing — pixels.
 *
 * The atlas is a pure function of the recipe: phase-1 faces arrive carrying
 * per-face axis-aligned uv rects + an `island` id (one island per ring stack /
 * lathe wall). `atlasLayout` packs the islands into a fixed grid with gutters;
 * `remapFacesToAtlas` rewrites face uvs into atlas space so the painted page
 * binds through the EXISTING texture channel (manifest.textures → emitThreeWorld
 * / facesToGlb) with zero new transport.
 *
 * Reprojection (shape B of the plan): the worker paints VIEWS — its
 * in-distribution job — and `paintAtlas` lowers those paintings into the atlas
 * deterministically: every atlas texel bilerps its world point from its face's
 * uv rect, tests facing + a per-view DEPTH BUFFER (self-occlusion), projects
 * through the view's known pinhole camera, and samples the painting. Best
 * facing view wins per texel (argmax, no cross-view ghosting).
 * `auditAtlasCoverage` is the machine gate: per-island coverage + hole list —
 * holes GENERATE the next inpaint views, they never fail the job.
 *
 * V1 contract (matches everything phase 1 emits): per-face uv is an
 * axis-aligned rect in [0,1] island space (repeat multipliers stay OFF in
 * atlas mode), corner order [(u0,v0),(u1,v0),(u1,v1),(u0,v1)] aligned with
 * `corners`. Pure math throughout — no dice, no clock, no DOM; PNG decode
 * happens at the tool/spike boundary (sharp), same layering as
 * skin-projection.js.
 */

const EPS = 1e-9;

// ── vec helpers (plain arrays) ────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Faces that participate in the atlas: texture + 4-corner uv + island id. */
export function atlasFaces(faces = []) {
  return faces.filter((f) => f && typeof f.texture === 'string' && Array.isArray(f.uv) && f.uv.length >= 4 && f.island != null);
}

/**
 * Deterministic island layout: unique island ids (insertion order — the
 * recipe's own build order, stable across re-mints), packed into a
 * ceil(sqrt(n)) grid on a square page with a fixed gutter.
 * @returns {{ page, gutter, cols, rows, cell, islands: { [id]: {x,y,w,h} } }}
 *          x/y/w/h in NORMALIZED page space [0,1].
 */
export function atlasLayout(faces, { page = 1024, gutter = 8 } = {}) {
  const listed = atlasFaces(faces);
  const ids = [];
  for (const f of listed) if (!ids.includes(f.island)) ids.push(f.island);
  if (!ids.length) throw new Error('skin-atlas: no faces carry texture+uv+island — mint the recipe with a phase-1 skin/wrap first');
  const cols = Math.ceil(Math.sqrt(ids.length));
  const rows = Math.ceil(ids.length / cols);
  const cell = Math.floor(page / cols);
  const g = gutter / page;
  const islands = {};
  ids.forEach((id, k) => {
    const col = k % cols, row = (k / cols) | 0;
    islands[id] = {
      x: col / cols + g, y: row / cols + g,
      w: 1 / cols - 2 * g, h: 1 / cols - 2 * g,
    };
  });
  return { page, gutter, cols, rows, cell, islands };
}

/**
 * Rewrite skinned faces' uvs into atlas space (island rect offset + scale) and
 * point them at the atlas texture key. Non-participating faces pass through
 * untouched. Atlas mode is a PAINTED page, not a tile: textureLit is dropped
 * (the painting carries its own light) unless `lit: true` keeps the multiply.
 */
export function remapFacesToAtlas(faces, layout, { texture = 'skin-atlas', lit = false } = {}) {
  return faces.map((f) => {
    if (!(f && typeof f.texture === 'string' && Array.isArray(f.uv) && f.island != null)) return f;
    const r = layout.islands[f.island];
    if (!r) return f;
    const uv = f.uv.map(([u, v]) => [r.x + u * r.w, r.y + v * r.h]);
    const out = { ...f, uv, texture };
    delete out.island;
    if (!lit) delete out.textureLit;
    else out.textureLit = true;
    return out;
  });
}

/**
 * Pinhole projector from an emitThreeWorld-style camera ({ pos, target, vfov°,
 * width, height }, z-up world). → { project(p)=>[px,py,depth]|null, camPos }.
 */
export function projectorFromCamera({ pos, target, vfov = 42, width, height, up = [0, 0, 1], near = 0.05 }) {
  const fwd = norm(sub(target, pos));
  const right = norm(cross(fwd, up));
  const upv = cross(right, fwd);
  const f = (height / 2) / Math.tan(((vfov / 2) * Math.PI) / 180);
  return {
    camPos: pos,
    width,
    height,
    // Rejects only points BEHIND the camera — out-of-frame points still project,
    // so a large close occluder whose corners overflow the frame still rasters
    // into the depth buffer (its bbox is clipped there). Frame-bounds clamping
    // happens at the sampling site, not here.
    project(p) {
      const d = sub(p, pos);
      const z = dot(d, fwd);
      if (z <= near) return null;
      const px = width / 2 + (f * dot(d, right)) / z;
      const py = height / 2 - (f * dot(d, upv)) / z;
      return [px, py, z];
    },
  };
}

// Rasterize one screen-space triangle into the depth buffer (min depth wins).
function rasterTriDepth(zbuf, W, H, a, b, c) {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < EPS) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / area;
      const w1 = ((c[0] - b[0]) * (y - b[1]) - (c[1] - b[1]) * (x - b[0])) / area;
      const w2 = ((a[0] - c[0]) * (y - c[1]) - (a[1] - c[1]) * (x - c[0])) / area;
      // inside test tolerant to either winding (area sign folded into weights)
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w1 * a[2] + w2 * b[2] + w0 * c[2];
      const i = y * W + x;
      if (z < zbuf[i]) zbuf[i] = z;
    }
  }
}

/**
 * Per-view depth buffer over ALL world faces (occluders included — pass the
 * whole scene's faces, not just the skinned body, so a prop in front of the
 * body masks it correctly). Float32Array(W×H), +Infinity where empty.
 */
export function viewDepthBuffer(faces, projector) {
  const { width: W, height: H } = projector;
  const zbuf = new Float32Array(W * H).fill(Infinity);
  for (const f of faces) {
    const c = f && f.corners;
    if (!c || c.length < 4) continue;
    const p = c.map((q) => projector.project(q));
    if (p.some((q) => !q)) continue;   // partially behind camera — skip (bias toward visible)
    rasterTriDepth(zbuf, W, H, p[0], p[1], p[2]);
    rasterTriDepth(zbuf, W, H, p[0], p[2], p[3]);
  }
  return zbuf;
}

// Outward normal of a quad (Newell), oriented away from a reference center.
function outwardNormal(corners, center) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i], q = corners[(i + 1) % corners.length];
    nx += (p[1] - q[1]) * (p[2] + q[2]);
    ny += (p[2] - q[2]) * (p[0] + q[0]);
    nz += (p[0] - q[0]) * (p[1] + q[1]);
  }
  const n = norm([nx, ny, nz]);
  const cen = [(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2, (corners[0][2] + corners[2][2]) / 2];
  return dot(n, sub(cen, center)) < 0 ? [-n[0], -n[1], -n[2]] : n;
}

/**
 * Lower painted views into the atlas (shape B's deterministic half).
 *
 * @param {Array} skinnedFaces  atlas-participating faces (world corners + LOCAL island uv)
 * @param {object} layout       atlasLayout output
 * @param {Array}  views        [{ projector, raster: {data,width,height,channels}, zbuf? }]
 *                              zbuf omitted → computed from occluders (or skinnedFaces)
 * @param {object} opts         { size = layout.page, occluders = skinnedFaces,
 *                                background = [122,127,136], minFacing = 0.12, depthTol = 0.015 }
 * @returns {{ rgb: Buffer, weight: Float32Array, size }}  weight per texel: best facing (0 = hole)
 */
export function paintAtlas(skinnedFaces, layout, views, opts = {}) {
  const size = opts.size || layout.page;
  const occluders = opts.occluders || skinnedFaces;
  const background = opts.background || [122, 127, 136];
  const minFacing = opts.minFacing ?? 0.12;
  const depthTol = opts.depthTol ?? 0.015;

  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = background[0]; rgb[i * 3 + 1] = background[1]; rgb[i * 3 + 2] = background[2];
  }
  const weight = new Float32Array(size * size);

  const ready = views.map((v) => ({ ...v, zbuf: v.zbuf || viewDepthBuffer(occluders, v.projector) }));

  // object center for outward normals — over the skinned body only
  let cx = 0, cy = 0, cz = 0, cn = 0;
  for (const f of skinnedFaces) for (const p of f.corners) { cx += p[0]; cy += p[1]; cz += p[2]; cn++; }
  const center = cn ? [cx / cn, cy / cn, cz / cn] : [0, 0, 0];

  for (const f of atlasFaces(skinnedFaces)) {
    const r = layout.islands[f.island];
    if (!r) continue;
    const [u0, v0] = f.uv[0];
    const [u1] = f.uv[1];
    const v1 = f.uv[2][1];
    // texel footprint of this face inside the island rect
    const tx0 = Math.max(0, Math.floor((r.x + u0 * r.w) * size));
    const tx1 = Math.min(size - 1, Math.ceil((r.x + u1 * r.w) * size) - 1);
    const ty0 = Math.max(0, Math.floor((r.y + v0 * r.h) * size));
    const ty1 = Math.min(size - 1, Math.ceil((r.y + v1 * r.h) * size) - 1);
    if (tx1 < tx0 || ty1 < ty0) continue;
    const n = outwardNormal(f.corners, center);
    const [A, B, C, D] = f.corners;   // order: (u0,v0) (u1,v0) (u1,v1) (u0,v1)
    for (let ty = ty0; ty <= ty1; ty++) {
      const vAtl = (ty + 0.5) / size;
      const t = Math.min(1, Math.max(0, ((vAtl - r.y) / r.h - v0) / Math.max(v1 - v0, EPS)));
      for (let tx = tx0; tx <= tx1; tx++) {
        const uAtl = (tx + 0.5) / size;
        const s = Math.min(1, Math.max(0, ((uAtl - r.x) / r.w - u0) / Math.max(u1 - u0, EPS)));
        // bilerp world point over the quad
        const w = [
          (1 - s) * (1 - t) * 1, s * (1 - t), s * t, (1 - s) * t,
        ];
        const p = [
          A[0] * w[0] + B[0] * w[1] + C[0] * w[2] + D[0] * w[3],
          A[1] * w[0] + B[1] * w[1] + C[1] * w[2] + D[1] * w[3],
          A[2] * w[0] + B[2] * w[1] + C[2] * w[2] + D[2] * w[3],
        ];
        const ti = ty * size + tx;
        for (const view of ready) {
          const facing = dot(n, norm(sub(view.projector.camPos, p)));
          if (facing < minFacing || facing <= weight[ti]) continue;
          const pr = view.projector.project(p);
          if (!pr) continue;
          const [px, py, z] = pr;
          if (px < 0 || py < 0 || px >= view.projector.width || py >= view.projector.height) continue;
          const zi = (py | 0) * view.projector.width + (px | 0);
          const zNear = view.zbuf[zi];
          if (!(z <= zNear * (1 + depthTol) + depthTol)) continue;   // occluded from this view
          const rast = view.raster;
          const rx = Math.min(rast.width - 1, (px / view.projector.width * rast.width) | 0);
          const ry = Math.min(rast.height - 1, (py / view.projector.height * rast.height) | 0);
          const si = (ry * rast.width + rx) * rast.channels;
          rgb[ti * 3] = rast.data[si];
          rgb[ti * 3 + 1] = rast.data[si + 1];
          rgb[ti * 3 + 2] = rast.data[si + 2];
          weight[ti] = facing;
        }
      }
    }
  }
  return { rgb, weight, size };
}

/**
 * Deterministic VIEW PLAN for the wrap loop (shape B): a fixed deck of
 * cameras derived from the skinned body's own bounding box — front / back /
 * left / right plus an elevated ¾ — chosen so every island of a roughly
 * convex body is covered by ≥1 view at usable facing. Pure function of the
 * face list; the plan's open question resolved as designed (fixed decks,
 * solver only if the inpaint loop churns).
 */
export function skinAtlasViewPlan(faces, { width = 768, height = 768, vfov = 40, distance = 3.2 } = {}) {
  const listed = atlasFaces(faces);
  if (!listed.length) throw new Error('skin-atlas: no faces carry texture+uv+island — nothing to plan views for');
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of listed) for (const p of f.corners) {
    for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const R = (Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 || 1) * distance;
  const cam = (dx, dy, dz, label) => ({
    label,
    pos: [center[0] + dx * R, center[1] + dy * R, center[2] + dz * R],
    target: center,
    vfov, width, height,
  });
  return {
    center,
    radius: R,
    views: [
      cam(0, -1, 0.08, 'front'),
      cam(0, 1, 0.08, 'back'),
      cam(-1, 0, 0.08, 'left'),
      cam(1, 0, 0.08, 'right'),
      cam(0.62, -0.62, 0.5, 'three-quarter-high'),
    ],
  };
}

/**
 * Seam-continuity metric (the plan's open question, resolved as the cheap
 * candidate): each island is a cylinder unwrap whose one seam is the u=0/u=1
 * column pair — the SAME world-space ring column painted twice. Compare the
 * two columns' covered texels row by row: mean |ΔRGB| ≈ 0 means the views
 * agree across the seam; a high delta means the seam will show. Per-island +
 * overall, ADVISORY (the eyes gate owns the ship call) — the plan's noted
 * limitation stands: intentional material transitions along the seam column
 * would flag, so the threshold is a report line, never a refusal. The
 * gradient-domain upgrade waits for real worker output.
 */
export function auditSeamContinuity(skinnedFaces, layout, painted, { threshold = 32 } = {}) {
  const { rgb, weight, size } = painted;
  const islands = {};
  let sumAll = 0, nAll = 0;
  for (const id of Object.keys(layout.islands)) {
    const r = layout.islands[id];
    const x0 = Math.max(0, Math.floor(r.x * size));
    const x1 = Math.min(size - 1, Math.ceil((r.x + r.w) * size) - 1);
    const ty0 = Math.max(0, Math.floor(r.y * size));
    const ty1 = Math.min(size - 1, Math.ceil((r.y + r.h) * size) - 1);
    let sum = 0, n = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      const a = ty * size + x0, b = ty * size + x1;
      if (!(weight[a] > 0 && weight[b] > 0)) continue;   // only rows painted on BOTH sides
      sum += (Math.abs(rgb[a * 3] - rgb[b * 3]) + Math.abs(rgb[a * 3 + 1] - rgb[b * 3 + 1]) + Math.abs(rgb[a * 3 + 2] - rgb[b * 3 + 2])) / 3;
      n += 1;
    }
    const delta = n ? sum / n : 0;
    islands[id] = { seamDelta: Math.round(delta * 100) / 100, rows: n, flagged: n > 0 && delta > threshold };
    sumAll += sum; nAll += n;
  }
  const overall = nAll ? sumAll / nAll : 0;
  return {
    overall: Math.round(overall * 100) / 100,
    threshold,
    islands,
    flagged: Object.entries(islands).filter(([, v]) => v.flagged).map(([id]) => id),
  };
}

/**
 * Targeted close-up INPAINT views for the gate's holes (loop-until-dry):
 * each hole island gets one camera looking straight down its mean outward
 * normal at close range. Deterministic; feed the result back through the
 * same paint pass until the audit runs dry.
 */
export function holeInpaintViews(faces, holes, { width = 768, height = 768, vfov = 40 } = {}) {
  const listed = atlasFaces(faces);
  let cx = 0, cy = 0, cz = 0, cn = 0;
  for (const f of listed) for (const p of f.corners) { cx += p[0]; cy += p[1]; cz += p[2]; cn++; }
  const center = cn ? [cx / cn, cy / cn, cz / cn] : [0, 0, 0];
  const views = [];
  for (const id of holes) {
    const own = listed.filter((f) => f.island === id);
    if (!own.length) continue;
    let ix = 0, iy = 0, iz = 0, inn = 0, ext = 0;
    let nx = 0, ny = 0, nz = 0;
    for (const f of own) {
      const n = outwardNormal(f.corners, center);
      nx += n[0]; ny += n[1]; nz += n[2];
      for (const p of f.corners) { ix += p[0]; iy += p[1]; iz += p[2]; inn++; }
    }
    const c = [ix / inn, iy / inn, iz / inn];
    for (const f of own) for (const p of f.corners) {
      const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      if (d > ext) ext = d;
    }
    const n = norm([nx, ny, nz]);
    const R = Math.max(ext * 3, 0.5);
    views.push({
      label: `inpaint:${id}`,
      pos: [c[0] + n[0] * R, c[1] + n[1] * R, c[2] + n[2] * R],
      target: c,
      vfov, width, height,
    });
  }
  return views;
}

/**
 * The machine gate: per-island coverage over the texels the recipe's faces
 * actually claim. Holes never fail the job — they are the NEXT view requests.
 * @returns {{ coverage, islands: {[id]: {claimed, painted, coverage}}, holes: [id…] }}
 */
export function auditAtlasCoverage(skinnedFaces, layout, painted, { minCoverage = 0.98 } = {}) {
  const { weight, size } = painted;
  const perIsland = {};
  for (const f of atlasFaces(skinnedFaces)) {
    const r = layout.islands[f.island];
    if (!r) continue;
    const acc = perIsland[f.island] || (perIsland[f.island] = { claimed: 0, painted: 0 });
    const [u0, v0] = f.uv[0];
    const [u1] = f.uv[1];
    const v1 = f.uv[2][1];
    const tx0 = Math.max(0, Math.floor((r.x + u0 * r.w) * size));
    const tx1 = Math.min(size - 1, Math.ceil((r.x + u1 * r.w) * size) - 1);
    const ty0 = Math.max(0, Math.floor((r.y + v0 * r.h) * size));
    const ty1 = Math.min(size - 1, Math.ceil((r.y + v1 * r.h) * size) - 1);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        acc.claimed += 1;
        if (weight[ty * size + tx] > 0) acc.painted += 1;
      }
    }
  }
  let claimed = 0, paintedN = 0;
  const islands = {};
  for (const [id, a] of Object.entries(perIsland)) {
    islands[id] = { ...a, coverage: a.claimed ? a.painted / a.claimed : 0 };
    claimed += a.claimed; paintedN += a.painted;
  }
  const holes = Object.entries(islands).filter(([, a]) => a.coverage < minCoverage).map(([id]) => id);
  return { coverage: claimed ? paintedN / claimed : 0, islands, holes };
}
