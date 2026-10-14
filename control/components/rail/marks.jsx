/**
 * The rail's marks: a concern is a dot whose fill is its state, a part a dot whose fill is its freshness. Shared by the
 * project page and the project cards so a state reads the same everywhere. No words: the title a mark carries is the
 * data's own.
 */

// A concern's state as a dot. Given by the creator's eyes is solid; given by the machine gate is a ring around a
// fainter fill, so the two never read alike.
export const CONCERN_STYLE = {
  'given:eyes': { background: 'var(--live)', borderColor: 'var(--live)' },
  'given:machine': { background: 'var(--live-idle)', borderColor: 'var(--live)' },
  given: { background: 'var(--live)', borderColor: 'var(--live)' },
  open: { background: 'transparent', borderColor: 'var(--ink-muted)' },
  advised: { background: 'var(--forge)', borderColor: 'var(--forge)' },
  waived: { background: 'transparent', borderColor: 'var(--ink-muted)', borderStyle: 'dashed' },
};
export const PART_STYLE = {
  fresh: { background: 'var(--live)', borderColor: 'var(--live)' },
  stale: { background: 'var(--forge)', borderColor: 'var(--forge)' },
  edited: { background: 'var(--think)', borderColor: 'var(--think)' },
  missing: { background: 'transparent', borderColor: 'var(--ink-muted)' },
  waiting: { background: 'transparent', borderColor: 'var(--ink-muted)', borderStyle: 'dotted' },
  taken: { background: 'var(--fault)', borderColor: 'var(--fault)' },
};

export function Dot({ style, size = 10, title }) {
  return (
    <span
      aria-hidden={!title}
      title={title}
      className="inline-block shrink-0 rounded-full border-[1.5px]"
      style={{ width: size, height: size, ...style }}
    />
  );
}

export const concernTitle = (c) => [c.name || c.id, c.state, c.gate, c.note].filter(Boolean).join(' · ');

/** An outcome in brief, as a part shows it: one mark, its worst state. */
export function briefStyle(o) {
  if (o.advised) return CONCERN_STYLE.advised;
  if (o.open) return CONCERN_STYLE.open;
  if (o.given || o.waived) return CONCERN_STYLE.given;
  return { ...CONCERN_STYLE.open, opacity: 0.4 };
}


/** A concern's dot style: its state, and for a settled one, whose gate settled it. */
export const concernStyle = (c) => CONCERN_STYLE[c.gate ? `${c.state}:${c.gate}` : c.state] || CONCERN_STYLE.open;

/** An outcome's concerns as a bar: one segment per state, as long as its share. */
export function OutcomeBar({ outcome, height = 4 }) {
  const n = outcome.concerns.length;
  if (!n) return <span className="block rounded-full bg-[color:var(--bay-rail)]" style={{ height }} aria-hidden />;
  const count = (st) => outcome.concerns.filter((c) => c.state === st).length;
  const segs = [['given', 'var(--live)'], ['waived', 'var(--ink-muted)'], ['advised', 'var(--forge)'], ['open', 'var(--bay-rail-lit)']];
  return (
    <span className="flex overflow-hidden rounded-full" style={{ height }} aria-hidden>
      {segs.map(([st, color]) => count(st) > 0 && <span key={st} style={{ flexGrow: count(st), background: color }} />)}
    </span>
  );
}
