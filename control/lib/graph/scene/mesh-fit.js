/**
 * mesh-fit — re-frame a generator's return onto the greybox (interchange-next.plan.md N4).
 *
 * First contact with a real generator (TripoSR, 2026-09-07) settled what the mesh
 * handoff's size gate had only predicted: image-to-mesh generators normalise to a unit
 * box in their own frame, so a raw return fails `size_agrees` by design (0.016× on the
 * lighthouse) and the worker has to stand it up, scale it, and put its base on the
 * ground before submitting. This is that step, in the face-list currency, so a worker
 * script written cold has one call instead of a frame derivation:
 *
 *   fitFacesToBox(faces, { box: { min, max }, up: 'z' | 'y' | 'triposr' })
 *
 * `box` is the greybox's world box (what the packet declares). Uniform scale on the
 * HEIGHT (the one axis a single-view generator gets right), base at the box's floor, XY
 * centred on the box's centre — proportions in XY are the generator's own and the size
 * gate's 0.5×–2× band judges them. `up` names the return's frame AFTER mojulo's reader
 * (which maps glTF y-up → z-up as (x, −z, y)): 'z' = already right (a Blender / Meshy
 * return), 'y' = same thing (an honest y-up file lands z-up through the reader), and
 * 'triposr' = the file was written z-up so the reader stood its height on −y: rotate
 * +90° about x, (x, y, z) → (x, z, −y).
 */

const UPS = {
  z: (p) => p,
  y: (p) => p,
  triposr: (p) => [p[0], p[2], -p[1]],
};

export function facesBox(faces) {
  const mn = [Infinity, Infinity, Infinity]; const mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  return { min: mn, max: mx, size: mx.map((v, k) => v - mn[k]) };
}

export function fitFacesToBox(faces, { box, up = 'z' } = {}) {
  if (!box || !Array.isArray(box.min) || !Array.isArray(box.max)) throw new Error('fitFacesToBox: `box` wants { min:[x,y,z], max:[x,y,z] } (the greybox box)');
  const orient = UPS[up];
  if (!orient) throw new Error(`fitFacesToBox: unknown up '${up}' (z | y | triposr)`);
  const stood = faces.map((f) => ({ ...f, corners: f.corners.map((c) => orient(c)) }));
  const b0 = facesBox(stood);
  const targetH = box.max[2] - box.min[2];
  if (!(b0.size[2] > 1e-9)) throw new Error('fitFacesToBox: the return has no height after orientation');
  const s = targetH / b0.size[2];
  const cx0 = (b0.min[0] + b0.max[0]) / 2; const cy0 = (b0.min[1] + b0.max[1]) / 2;
  const cx = (box.min[0] + box.max[0]) / 2; const cy = (box.min[1] + box.max[1]) / 2;
  const fitted = stood.map((f) => ({ ...f, corners: f.corners.map((c) => [(c[0] - cx0) * s + cx, (c[1] - cy0) * s + cy, (c[2] - b0.min[2]) * s + box.min[2]]) }));
  return { faces: fitted, scale: s, raw: b0, fitted: facesBox(fitted) };
}
