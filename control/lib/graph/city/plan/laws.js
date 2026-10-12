/**
 * THE CITY'S LAWS: what a plan must hold for the city to be walked, read and played. Data rows ({ id, layer, want, why })
 * and a test each, run over a designed city. A law advises: a finding never refuses the plan. A recipe accepts a
 * finding with `waive: ['<law>']` (all of it) or `'<law>:<subject>'` (one street, one lot, one line), and the book
 * shows it as waived. The thresholds are the grammar's at the plan's play scale (grammar.js), so a game city holds a
 * tighter walk than a real one.
 */
const r2 = (v) => Math.round(v * 100) / 100;

export const CITY_LAWS = Object.freeze([
  { id: 'spine-first', layer: 'spine', want: 'the grid meets every straight run of the spine and never crosses it short', why: 'a city is its main streets before it is its blocks: everything else is cut from what they leave' },
  { id: 'reserved', layer: 'sites', want: 'no street runs through a site or a district nothing is built in; only the spine crosses water or a park', why: 'ground planned before anything grows stays planned' },
  { id: 'fronts', layer: 'lots', want: 'every built lot has its door on a walk', why: 'a building nobody can walk up to is a wall' },
  { id: 'connected', layer: 'walk', want: 'every walk joins every other: one network', why: 'a street you cannot reach from the rest is not part of the city' },
  { id: 'crossing-every', layer: 'walk', want: 'a crossing at least every so many metres of block face (the grammar\'s walk.crossing)', why: 'a block too long to cross is a fence; a walker takes the shorter way' },
  { id: 'beat-every', layer: 'walk', want: 'something to meet at least every so many metres of walk: a shopfront, a place, a stop, a corner (walk.beat)', why: 'a walk with nothing on it is a corridor: a player runs it and remembers nothing' },
  { id: 'transit-reach', layer: 'transit', want: 'every built lot within reach of a stop when the city runs a line (transit.reach)', why: 'a line that misses half the city is a ride, not a network' },
  { id: 'transit-on-street', layer: 'transit', want: 'every surface line runs on a street, and every stop stands on one', why: 'a tram across the blocks is through somebody\'s walls' },
  { id: 'slender', layer: 'lots', want: 'every tower at least as slender as the grammar\'s tower.slender', why: 'a tower reads by its proportion; a squat tower is a block' },
]);
export const CITY_LAW_IDS = Object.freeze(CITY_LAWS.map((l) => l.id));

/** Is this law (or this subject of it) waived by the plan? */
export const isWaived = (plan, law, subject) => plan.waive.includes(law) || (subject !== undefined && plan.waive.includes(`${law}:${subject}`));

// each law's findings: [{ at, detail }]
const TESTS = {
  'spine-first': (d) => d.plan.spine.flatMap((s, i) => {
    const id = s.name || `spine-${i + 1}`;
    return d.streets.some((x) => x.id === id || x.id.startsWith(`${id}.`) || x.id.startsWith(`${id}~`)) ? [] : [{ at: id, detail: `${id} was not laid` }];
  }),
  reserved: (d) => d.sites.flatMap((s) => {
    const hit = d.streets.filter((x) => x.source === 'spine' && x.pts.slice(1).some((b, k) => {
      const a = x.pts[k], { x0, y0, x1, y1 } = s.rect;
      for (let t = 0; t <= 1; t += 0.02) { const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t; if (px > x0 + 1 && px < x1 - 1 && py > y0 + 1 && py < y1 - 1) return true; }
      return false;
    }));
    return hit.map((x) => ({ at: s.id, detail: `${x.id} runs through ${s.name || s.id} (${s.use}): move the site off the spine, or let the spine bend round it` }));
  }),
  fronts: (d) => d.lots.filter((l) => l.use !== 'parking' && l.street === undefined).map((l) => ({ at: l.id, detail: `lot ${l.id} (${l.use}, ${l.floors} storeys) has no walk at its door (it faces ${l.face})` })),
  connected: (d) => {
    const p = d.walk.nodes.map((n) => n.id), find = (i) => { while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; } return i; };
    for (const e of d.walk.edges) p[find(e.a)] = find(e.b);
    const groups = new Map();
    for (const n of d.walk.nodes) { const r = find(n.id); groups.set(r, (groups.get(r) || 0) + 1); }
    if (groups.size <= 1) return [];
    const sizes = [...groups.values()].sort((a, b) => b - a);
    return [{ at: 'walk', detail: `the walk is ${groups.size} networks (${sizes.join(', ')} crossings): join them with a street` }];
  },
  'crossing-every': (d) => {
    const max = d.grammar.walk.crossing, worst = new Map();
    for (const e of d.walk.edges) if (e.len > max && (!worst.has(e.street) || worst.get(e.street) < e.len)) worst.set(e.street, e.len);
    return [...worst].map(([s, len]) => ({ at: s, detail: `${s}: ${Math.round(len)} m between crossings (want ${Math.round(max)})` }));
  },
  'beat-every': (d) => {
    const max = d.grammar.walk.beat, worst = new Map();
    for (const e of d.walk.edges) {
      // an edge runs crossing to crossing, and a crossing is a beat; between them, whatever its walk meets
      const marks = [0, ...e.beats.map((b) => b.t).sort((a, b) => a - b), 1];
      let gap = 0;
      for (let k = 1; k < marks.length; k++) gap = Math.max(gap, (marks[k] - marks[k - 1]) * e.len);
      if (gap > max && (!worst.has(e.street) || worst.get(e.street) < gap)) worst.set(e.street, gap);
    }
    return [...worst].map(([s, gap]) => ({ at: s, detail: `${s}: ${Math.round(gap)} m of walk with nothing on it (want a beat every ${Math.round(max)})` }));
  },
  'transit-reach': (d) => {
    if (!d.transit.length) return [];
    const stops = d.transit.flatMap((t) => t.stops.map((s) => s.at)), max = d.grammar.transit.reach;
    const far = d.lots.filter((l) => l.use !== 'parking' && !stops.some(([x, y]) => Math.hypot(x - (l.x0 + l.x1) / 2, y - (l.y0 + l.y1) / 2) <= max));
    if (!far.length) return [];
    const share = far.length / d.lots.filter((l) => l.use !== 'parking').length;
    return [{ at: 'transit', detail: `${far.length} lots (${Math.round(share * 100)}%) are over ${Math.round(max)} m from a stop: another line, or a line through them` }];
  },
  'transit-on-street': (d) => d.transit.flatMap((t) => {
    const out = [];
    if (t.onStreet < 0.95) out.push({ at: t.id, detail: `${t.id} runs ${Math.round((1 - t.onStreet) * 100)}% of its length off the streets: lay it along a street's cells` });
    const off = t.stops.filter((s) => !s.onStreet).length;
    if (off) out.push({ at: t.id, detail: `${off} of ${t.id}'s ${t.stops.length} stops stand off a street` });
    return out;
  }),
  slender: (d) => d.lots.filter((l) => l.tower && l.h / Math.min(l.x1 - l.x0, l.y1 - l.y0) < d.grammar.tower.slender[0] * 0.98)
    .map((l) => ({ at: l.id, detail: `tower ${l.id} is ${r2(l.h / Math.min(l.x1 - l.x0, l.y1 - l.y0))} : 1 (want ${d.grammar.tower.slender[0]} : 1)` })),
};

/** Every law over a designed city → [{ id, layer, want, why, ok, findings, waived }]. */
export function evaluateLaws(d) {
  return CITY_LAWS.map((L) => {
    const all = TESTS[L.id](d), open = all.filter((f) => !isWaived(d.plan, L.id, f.at));
    return { ...L, ok: open.length === 0, findings: open, waived: all.length - open.length };
  });
}
