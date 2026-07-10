/**
 * beats-diff — the structured MUSICAL diff between two beats manifests (B9.3).
 *
 * Not a picture: diff_sketches compares SVG geometry, which is meaningless for
 * a recipe. This compares what a composer changed — tempo/swing/key deltas,
 * tracks added/removed, per-track patch/macro changes, pattern grids cell-wise
 * ("kick: bar 2 steps 12, 14 removed"), progression and cue changes — and
 * returns plain data plus human-readable summary lines. Pure: two manifests
 * in, a report out; revision resolution lives in the tool layer.
 */

const HEADER_FIELDS = ['title', 'bpm', 'swing', 'key', 'seed', 'steps', 'loop'];

function rowsOf(m) {
  return m.channels || m.parts || m.tracks || [];
}

function rowNoun(m) {
  return m.channels ? 'channel' : m.parts ? 'part' : 'track';
}

function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// per-step velocity mask → "bar B steps s1, s2" groups (16 sixteenths per bar).
function maskDelta(before = [], after = []) {
  const n = Math.max(before.length, after.length);
  const added = [], removed = [], changed = [];
  for (let i = 0; i < n; i++) {
    const a = before[i] || 0;
    const b = after[i] || 0;
    if (a === b) continue;
    if (!a) added.push(i);
    else if (!b) removed.push(i);
    else changed.push(i);
  }
  return { added, removed, changed };
}

function stepsByBar(steps) {
  const bars = new Map();
  for (const s of steps) {
    const bar = Math.floor(s / 16) + 1;
    if (!bars.has(bar)) bars.set(bar, []);
    bars.get(bar).push(s % 16);
  }
  return [...bars.entries()]
    .map(([bar, ss]) => `bar ${bar} step${ss.length === 1 ? '' : 's'} ${ss.join(', ')}`)
    .join('; ');
}

// per-step progression arrays → compressed "steps 0–7: Am → F" ranges.
function progressionDelta(before = [], after = []) {
  const n = Math.max(before.length, after.length);
  const out = [];
  let run = null;
  for (let i = 0; i <= n; i++) {
    const a = before[i], b = after[i];
    const differs = i < n && !eq(a, b);
    if (differs && run && run.from === a && run.to === b) {
      run.end = i;
    } else {
      if (run) out.push(run);
      run = differs ? { start: i, end: i, from: a, to: b } : null;
    }
  }
  return out.map((r) => `steps ${r.start}${r.end > r.start ? `–${r.end}` : ''}: ${r.from ?? '(none)'} → ${r.to ?? '(none)'}`);
}

const ROW_FIELDS = ['patch', 'level', 'transpose', 'tone', 'role', 'chordVoice', 'note', 'chain', 'feel', 'sequence', 'gesture', 'cue', 'steps', 'dropout'];

function diffRow(a, b, noun, summary) {
  const changes = {};
  for (const f of ROW_FIELDS) {
    if (!eq(a[f], b[f])) {
      changes[f] = { from: a[f], to: b[f] };
      if (['patch', 'level', 'transpose', 'tone', 'role', 'chordVoice', 'note'].includes(f)) {
        summary.push(`${a.name}: ${f} ${JSON.stringify(a[f] ?? null)} → ${JSON.stringify(b[f] ?? null)}`);
      } else {
        summary.push(`${a.name}: ${f} changed`);
      }
    }
  }
  if (a.mask || b.mask) {
    const d = maskDelta(a.mask, b.mask);
    if (d.added.length || d.removed.length || d.changed.length) {
      changes.mask = d;
      if (d.added.length) summary.push(`${a.name}: ${stepsByBar(d.added)} added`);
      if (d.removed.length) summary.push(`${a.name}: ${stepsByBar(d.removed)} removed`);
      if (d.changed.length) summary.push(`${a.name}: ${stepsByBar(d.changed)} velocity changed`);
    }
  }
  if ((a.notes || b.notes) && !eq(a.notes, b.notes)) {
    changes.notes = { from: a.notes, to: b.notes };
    summary.push(`${a.name}: note contour changed`);
  }
  if ((a.events || b.events) && !eq(a.events, b.events)) {
    const na = (a.events || []).length;
    const nb = (b.events || []).length;
    changes.events = { from: na, to: nb };
    summary.push(`${a.name}: events changed (${na} → ${nb})`);
  }
  return Object.keys(changes).length ? changes : null;
}

/**
 * diffBeatsManifests(a, b) → { same, summary: [lines], header, rows, harmony, cues }
 * Expects NORMALIZED manifests (what the store holds).
 */
export function diffBeatsManifests(a, b) {
  const summary = [];
  const report = { same: false, summary, header: {}, rows: { added: [], removed: [], changed: {} } };

  if (a.kind !== b.kind) {
    report.header.kind = { from: a.kind, to: b.kind };
    summary.push(`kind ${a.kind} → ${b.kind} (different manifest shapes — row detail below is name-matched only)`);
  }

  for (const f of HEADER_FIELDS) {
    if (!eq(a[f], b[f])) {
      report.header[f] = { from: a[f], to: b[f] };
      summary.push(`${f}: ${JSON.stringify(a[f] ?? null)} → ${JSON.stringify(b[f] ?? null)}`);
    }
  }

  // rows: channels / parts / tracks, matched by name.
  const rowsA = rowsOf(a);
  const rowsB = rowsOf(b);
  const noun = rowNoun(b.tracks || b.parts || b.channels ? b : a);
  const byNameA = new Map(rowsA.map((r) => [r.name, r]));
  const byNameB = new Map(rowsB.map((r) => [r.name, r]));
  for (const r of rowsB) {
    if (!byNameA.has(r.name)) {
      report.rows.added.push(r.name);
      summary.push(`${noun} '${r.name}' added (${r.patch || (r.cue && 'cue') || (r.gesture && r.gesture.type) || 'voice'})`);
    }
  }
  for (const r of rowsA) {
    if (!byNameB.has(r.name)) {
      report.rows.removed.push(r.name);
      summary.push(`${noun} '${r.name}' removed`);
    }
  }
  for (const r of rowsA) {
    const other = byNameB.get(r.name);
    if (!other) continue;
    const changes = diffRow(r, other, noun, summary);
    if (changes) report.rows.changed[r.name] = changes;
  }

  // harmony bus: chord dictionary + per-step progression (pattern), or the
  // ambient progression of { chord, root } bars.
  const harmony = {};
  if (!eq(a.chords, b.chords)) {
    const namesA = Object.keys(a.chords || {});
    const namesB = Object.keys(b.chords || {});
    harmony.chords = { added: namesB.filter((n) => !namesA.includes(n)), removed: namesA.filter((n) => !namesB.includes(n)), revoiced: namesA.filter((n) => namesB.includes(n) && !eq(a.chords[n], b.chords[n])) };
    for (const n of harmony.chords.added) summary.push(`chord '${n}' added`);
    for (const n of harmony.chords.removed) summary.push(`chord '${n}' removed`);
    for (const n of harmony.chords.revoiced) summary.push(`chord '${n}' revoiced: [${(a.chords[n] || []).join(' ')}] → [${(b.chords[n] || []).join(' ')}]`);
  }
  if (!eq(a.progression, b.progression)) {
    if (a.kind === 'beats-pattern' || b.kind === 'beats-pattern') {
      const lines = progressionDelta(a.progression, b.progression);
      harmony.progression = lines;
      for (const l of lines) summary.push(`progression ${l}`);
    } else {
      harmony.progression = { from: a.progression, to: b.progression };
      summary.push('progression changed');
    }
  }
  if (Object.keys(harmony).length) report.harmony = harmony;

  // sfx cues.
  if (!eq(a.cues, b.cues)) {
    const idsA = Object.keys(a.cues || {});
    const idsB = Object.keys(b.cues || {});
    report.cues = {
      added: idsB.filter((i) => !idsA.includes(i)),
      removed: idsA.filter((i) => !idsB.includes(i)),
      changed: idsA.filter((i) => idsB.includes(i) && !eq(a.cues[i], b.cues[i])),
    };
    for (const i of report.cues.added) summary.push(`cue '${i}' added`);
    for (const i of report.cues.removed) summary.push(`cue '${i}' removed`);
    for (const i of report.cues.changed) summary.push(`cue '${i}' gestures changed`);
  }

  report.same = summary.length === 0;
  if (report.same) summary.push('no musical differences');
  return report;
}
