// Minimal well-formed Door-2 fixture builder.
export const kind = { id: 'test-orb', manifestKind: 'test-orb-view', family: 'science', title: 'test orb' };
export function plan() {
  return {
    faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#123456', group: 'orb' }],
    bounds: { center: [0, 0, 0], radius: 2 },
    stats: { ok: true },
  };
}
export function assemble(recipe = {}, { title } = {}) {
  const p = plan(recipe);
  return { faces: p.faces, cameras: [], viewBox: { width: 100, height: 100 }, title: title || kind.title, bg: '#000000' };
}
