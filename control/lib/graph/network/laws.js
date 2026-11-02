/**
 * A NETWORK'S LAWS — what holds a network of passages (network/passage.js) to its section (network/sections.js), each
 * advice that says what it measured:
 *
 *   reached   every node reached from every other (the passages' graph one piece), or the pieces that are not
 *   cover     the cover kept over every passage: its section's under open ground, its slab under a plaza or a floor
 *   grade     the steepest ramp of any passage, against its section's
 *   run       the longest passage, against its section's
 *
 *   networkLaws(nodes, passages, { section, prefix, noun }) → [{ law: `<prefix>-<name>`, ok, value, want }]   a passage
 *     that carries its own `section` (a network of several kinds) is held to that one
 *     `noun` what a node is called in a value ('concourse', 'building')
 *
 * Pure.
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;

export function networkLaws(nodes, passages, { section, prefix = 'network', noun = 'node' } = {}) {
  const ids = nodes.map((n) => n.id), parent = new Map(ids.map((i) => [i, i]));
  const find = (i) => (parent.get(i) === i ? i : find(parent.get(i)));
  for (const t of passages) parent.set(find(t.a), find(t.b));
  const groups = new Map();
  for (const i of ids) { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); }
  const pieces = [...groups.values()].sort((p, q) => q.length - p.length);
  const cover = Math.min(Infinity, ...passages.map((t) => t.cover)), slab = Math.min(Infinity, ...passages.map((t) => t.slab)), grade = Math.max(0, ...passages.map((t) => t.grade)), run = Math.max(0, ...passages.map((t) => t.length));
  const many = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  // (each passage held to its own section where it names one, a network of several kinds: a campus's public passages
  // and its service tunnels; what each wants said per section)
  const secOf = (t) => t.section ?? section, secs = passages.length ? [...new Set(passages.map(secOf))] : [section];
  const want = (f) => (secs.length > 1 ? secs.map((x) => `${x.id}: ${f(x)}`).join('; ') : f(secs[0]));
  const covered = passages.every((t) => (t.cover === Infinity || t.cover >= secOf(t).cover - 1e-6) && (t.slab === Infinity || t.slab >= secOf(t).slab - 1e-6));
  return [
    { law: `${prefix}-reached`, ok: pieces.length <= 1, value: pieces.length <= 1 ? `${many(ids.length, noun)} joined by ${many(passages.length, 'passage')}` : `${pieces.length} pieces: ${pieces.slice(1).map((p) => p.join(', ')).join('; ')} not reached from ${pieces[0].join(', ')}`, want: `every ${noun} reached from every other` },
    { law: `${prefix}-cover`, ok: !passages.length || covered, value: passages.length ? `${cover === Infinity ? '-' : r5(cover)} m least under open ground, ${slab === Infinity ? '-' : r5(slab)} m under a slab` : 'no passage', want: want((x) => `${x.cover} m of cover under open ground, ${x.slab} m under a slab`) },
    { law: `${prefix}-grade`, ok: passages.every((t) => t.grade <= secOf(t).grade + 1e-6), value: `1:${grade > 0 ? r5(1 / grade) : '∞'} steepest ramp`, want: want((x) => `no ramp steeper than 1:${r5(1 / x.grade)}`) },
    { law: `${prefix}-run`, ok: passages.every((t) => t.length <= secOf(t).longest), value: `${r5(run)} m longest passage`, want: want((x) => `no passage longer than ${x.longest} m between two ${noun}s`) },
  ];
}
