/**
 * A CITY AS A MAP GAME: one level per segment (each `{ kind: 'city', city: <ref>, level: { segment } }`, reading the
 * city by ref, at `<city ref>-<segment id>`), and the order create_game takes for them: the levels with their exits
 * (one per neighbour, named for it, leading to its level), a progression slice for the map, the first level the one
 * holding the city's core; and each door-scene building's inside (a building on the rail, its `out` door linked to its
 * lot's). Pure: the mint stores the sketches and hands the order back.
 */
export function cityGameOrder(d, cityRef, title = 'city') {
  if (!d.segments) throw new Error('city: cut it into segments first (segments: true)');
  const refOf = (id) => `${cityRef}-${id}`;
  const inside = (s, x, y) => x >= s.rect.x0 && x < s.rect.x1 && y >= s.rect.y0 && y < s.rect.y1;
  const start = d.segments.find((s) => inside(s, d.field.cx, d.field.cy)) ?? d.segments[0];
  const ordered = [start, ...d.segments.filter((s) => s !== start)];
  const sketches = ordered.map((s) => ({ ref: refOf(s.id), title: `${title} · ${s.id}`, manifest: { kind: 'city', city: cityRef, level: { segment: s.id } } }));
  // each door-scene building's inside: a building on the rail, entered by its 'out' door, its goal its own deepest room
  const doors = (d.entries || []).filter((e) => e.enter === 'door' && !e.error && e.segment);
  const interiors = doors.map((e) => ({ ref: `${cityRef}-in-${e.lot.replace(/\./g, '-')}`, title: `${title} · ${e.lot} (${e.inside.kind}${e.inside.card ? ` · ${e.inside.card}` : ''})`, manifest: { ...e.inside, title: `${title} · ${e.lot}`, level: { door: 'out' } }, door: e.door.id, segment: e.segment }));
  return {
    sketches,
    interiors,
    createGame: {
      title,
      store: { slices: [{ name: 'campaign', kind: 'progression' }] },
      levels: [
        ...ordered.map((s) => ({ ref: refOf(s.id), title: `${title} · ${s.id}`, exits: s.neighbours.map((n) => ({ id: n.id, to: refOf(n.id) })) })),
        ...interiors.map((x) => ({ ref: x.ref, title: x.title })),
      ],
      ...(interiors.length ? { links: interiors.map((x) => ({ from: { ref: refOf(x.segment), door: x.door }, to: { ref: x.ref, door: 'out' } })) } : {}),
    },
  };
}
