/**
 * Two gate-2b reports (tools/body-routing-eval.integration.test.js), row by row: what moved between them.
 *
 * A row's score can change because the model answered differently (the surface moved it) or because the fixture's
 * answer changed under the same reply (the key moved). Both are legitimate, but only the first is the routing getting
 * better, so a comparison says which. Rows are matched by phrasing. Pure.
 *
 * A report keeps every row (`routing.rows`) since the 1015 review; one before it kept its misses only, so its hits
 * are unknown and it compares by misses alone (`legacy: true`).
 */

const rowsOf = (report) => (Array.isArray(report?.routing?.rows) ? new Map(report.routing.rows.map((r) => [r.phrasing, r])) : null);

/** Why a row present in both reports scored as it did: 'same', 'model', 'key' or 'both'. */
function moved(a, b) {
  const key = a.expected !== b.expected, model = a.got !== b.got;
  return key && model ? 'both' : key ? 'key' : model ? 'model' : 'same';
}

export function diffReports(a, b) {
  const ra = rowsOf(a), rb = rowsOf(b);
  if (!ra || !rb) return diffMisses(a, b);
  const flips = [], tally = { model: 0, key: 0, both: 0, added: 0, removed: 0 };
  for (const [p, x] of ra) {
    const y = rb.get(p);
    if (!y) { tally.removed -= x.ok ? 1 : 0; flips.push({ phrasing: p, why: 'removed', a: x }); continue; }
    if (x.ok === y.ok && x.got === y.got && x.expected === y.expected) continue;
    const why = moved(x, y);
    if (why === 'same') continue;
    tally[why] += (y.ok ? 1 : 0) - (x.ok ? 1 : 0);
    flips.push({ phrasing: p, why, a: x, b: y });
  }
  for (const [p, y] of rb) {
    if (ra.has(p)) continue;
    tally.added += y.ok ? 1 : 0;
    flips.push({ phrasing: p, why: 'added', b: y });
  }
  return { legacy: false, a: summary(a), b: summary(b), hits: tally, flips };
}

// Reports with misses only: which misses were fixed, which are new, which stayed. A fixed miss may be a row that
// left the fixture; the totals say whether any did.
function diffMisses(a, b) {
  const ma = new Map((a?.routing?.misses || []).map((m) => [m.phrasing, m]));
  const mb = new Map((b?.routing?.misses || []).map((m) => [m.phrasing, m]));
  return {
    legacy: true,
    a: summary(a),
    b: summary(b),
    fixed: [...ma.values()].filter((m) => !mb.has(m.phrasing)),
    new: [...mb.values()].filter((m) => !ma.has(m.phrasing)),
    still: [...mb.values()].filter((m) => ma.has(m.phrasing)),
  };
}

const summary = (r) => ({ when: r?.when, surface: r?.surface || 'body', correct: r?.routing?.correct, total: r?.routing?.total });

const line = (r) => `${r.expected} ← ${r.got ?? 'none'}${r.ok ? ' ✓' : ''}`;

/** The diff as text, for a terminal or a plan's log. */
export function formatDiff(d) {
  const head = [`a: ${d.a.correct}/${d.a.total} (${d.a.surface}, ${d.a.when})`, `b: ${d.b.correct}/${d.b.total} (${d.b.surface}, ${d.b.when})`];
  if (d.legacy) {
    const ls = (title, ms) => [`${title} (${ms.length}):`, ...ms.map((m) => `  ${m.expected} ← ${m.got ?? 'none'}   "${m.phrasing}"`)];
    return [
      ...head,
      'a report keeps its misses only, so a fixed miss may be the model moving, the key moving or the row leaving:',
      ...ls('fixed', d.fixed), ...ls('new misses', d.new), ...ls('still missed', d.still),
    ].join('\n');
  }
  const h = d.hits;
  return [
    ...head,
    `hits from the model's answers moving: ${h.model}; the answer key moving: ${h.key}; both: ${h.both}; rows added: +${h.added}; rows removed: ${h.removed}`,
    ...d.flips.map((f) => `  [${f.why}] ${f.a ? line(f.a) : '—'}  →  ${f.b ? line(f.b) : '—'}   "${f.phrasing}"`),
  ].join('\n');
}
