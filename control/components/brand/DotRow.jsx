/**
 * Dot readouts — the mark's atom used as data display.
 *
 * The lattice's dot is the brand's smallest unit, so quantities are drawn in
 * that grammar rather than in bars borrowed from a generic dashboard. One rule
 * governs all of them, and it is a constraint rather than a flourish:
 *
 *   A dot row is a PROPORTION display, not a precision one.
 *
 * So every row is paired with the mono number it summarises, and the number is
 * what the operator reads when they need to compare or audit. The dots say
 * "this much of that" at a glance; they never stand in for the figure.
 *
 * The corollary is what makes the component honest, and it was learned the
 * expensive way: **a row must never be able to sit permanently full.** The first
 * cut took a raw count and filled one dot per unit, saturating at seven. On a
 * real workshop — scenes 335, models 1144, characters 71 — every shelf drew
 * seven filled dots, so the readout was pure decoration wearing the brand's
 * clothes. A dot row therefore only ever renders a part against a whole it can
 * actually be a fraction of.
 *
 * Signal follows §7, not a palette of its own: `--live` present, `--live-idle`
 * partial, `--bay-rail-lit` absent.
 *
 * Design: components/3d-factory-ui.plan.md §7c.
 */

// Ten, not seven. Seven cells could not tell a shelf holding 4.6% of its zone
// from one holding 21.6% — both floored to a single lit dot once the
// "never show a real quantity as empty" rule applied. Ten is the smallest row
// that separates the real shelf spread on a working store while still reading
// as a glance rather than a count.
const CELLS = 10;

const TONE = {
  live: ['--live', '--live-idle'],
  forge: ['--forge', '--forge-idle'],
  think: ['--think', '--think-idle'],
};

/**
 * `part` of `whole`, as dots. A part that rounds to nothing but is genuinely
 * non-zero still lights one dot — "a few" and "none" must never look alike.
 *
 * @param {number} part   the quantity being shown
 * @param {number} whole  what it is a fraction OF (a zone total, a capacity)
 */
export function DotRow({ part = 0, whole = 0, cells = CELLS, tone = 'live', className = '' }) {
  const [inkVar, idleVar] = TONE[tone] || TONE.live;
  const ratio = whole > 0 ? Math.max(0, Math.min(1, part / whole)) : 0;
  const exact = ratio * cells;
  // A part that rounds to nothing but is genuinely non-zero still lights one
  // dot. This also covers an incoherent `whole` of 0 with a real part: showing
  // "something is here" beats showing an empty shelf that is not empty.
  const on = part > 0 ? Math.max(1, Math.floor(exact)) : 0;
  // One trailing half-lit dot when the remainder is real, so a shelf at 1.6/7
  // does not read the same as one at 1.0/7.
  const half = on < cells && exact - Math.floor(exact) > 0.25 ? 1 : 0;

  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <i
          key={i}
          className="block h-[5px] w-[5px] rounded-full"
          style={{
            backgroundColor:
              i < on ? `var(${inkVar})`
                : i < on + half ? `var(${idleVar})`
                  : 'var(--bay-rail-lit)',
          }}
        />
      ))}
    </span>
  );
}

/**
 * A dot row bound to its number, so the pairing the rule above requires cannot
 * drift apart at a call site.
 */
export function DotTally({ part, whole, label, tone = 'live', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <DotRow part={part} whole={whole} tone={tone} />
      <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
        {label ? `${label} ` : ''}
        <span className="text-[color:var(--ink-secondary)]">{part}</span>
      </span>
    </span>
  );
}

/** Progress, 0..1 — the same row with the whole already normalised. */
export function DotProgress({ value = 0, cells = 10, tone = 'forge', className = '' }) {
  return <DotRow part={Math.max(0, Math.min(1, value))} whole={1} cells={cells} tone={tone} className={className} />;
}

export default DotRow;
