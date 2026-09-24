/** Named surface attachment, independent of projection, materials and rigging.
 * points: {id: [x,y,z]}, faces: {id: [pointId,pointId,pointId]}.
 * A pin names one face, barycentric weights in its declared order, and a
 * directed edge on that face. No nearest-point fallback or silent rebinding.
 */
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = v => {
  const length = Math.hypot(...v);
  if (!Number.isFinite(length) || length < 1e-12) throw new Error('surface-pin: degenerate face or tangent');
  return v.map(x => x / length);
};
export function surfacePinFrame(surface, pin) {
  const ids = surface?.faces?.[pin?.face];
  if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3) throw new Error('surface-pin: unknown or non-triangular face');
  const points = ids.map(id => {
    const p = surface.points?.[id];
    if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) throw new Error(`surface-pin: invalid point ${id}`);
    return p;
  });
  const w = pin.weights;
  if (!Array.isArray(w) || w.length !== 3 || !w.every(x => Number.isFinite(x) && x >= 0 && x <= 1) || Math.abs(w.reduce((a,b)=>a+b,0)-1)>1e-9) throw new Error('surface-pin: invalid barycentric weights');
  const edge = pin.tangentEdge;
  if (!Array.isArray(edge) || edge.length !== 2 || edge[0] === edge[1] || !edge.every(id => ids.includes(id))) throw new Error('surface-pin: tangent must name a directed edge on the face');
  const hand = pin.handedness ?? 1;
  if (hand !== 1 && hand !== -1) throw new Error('surface-pin: handedness must be 1 or -1');
  const normal = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])));
  const tangent = unit(sub(surface.points[edge[1]], surface.points[edge[0]]));
  const bitangent = unit(cross(normal, tangent)).map(x => x * hand);
  const origin = [0,1,2].map(k => points.reduce((s,p,i)=>s+w[i]*p[k],0));
  return { origin, tangent, bitangent, normal, handedness: hand };
}
export function placeSurfaceOffset(frame, offset = [0, 0, 0]) {
  if (!Array.isArray(offset) || offset.length !== 3 || !offset.every(Number.isFinite)) throw new Error('surface-pin: invalid local offset');
  return frame.origin.map((x,k)=>x+offset[0]*frame.tangent[k]+offset[1]*frame.bitangent[k]+offset[2]*frame.normal[k]);
}
export function surfaceLocalOffset(frame, point) {
  if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw new Error('surface-pin: invalid world point');
  const v = sub(point, frame.origin);
  return [dot(v,frame.tangent),dot(v,frame.bitangent),dot(v,frame.normal)];
}
