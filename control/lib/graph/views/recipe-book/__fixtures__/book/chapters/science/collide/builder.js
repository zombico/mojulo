// Fixture builder whose manifestKind collides with a CORE world kind — the
// loader must skip it (core wins) and warn.
export const kind = { id: 'collide', manifestKind: 'saturn-view', family: 'science', title: 'collide' };
export function assemble() { return { faces: [], cameras: [], viewBox: { width: 1, height: 1 }, title: 'x', bg: '#000000' }; }
