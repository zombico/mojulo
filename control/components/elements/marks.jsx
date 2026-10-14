/**
 * An element's colours as strips: each ramp (a geocube's stone, a kit's grass, a grammar's glass) a row of its steps,
 * dark to light. No words: the colours are the statement; a strip's title is its colours.
 */

export function ColourStrips({ colours = [], rows = 4, height = 8 }) {
  const shown = colours.slice(0, rows);
  if (!shown.length) return <span className="block h-2 rounded-full bg-[color:var(--bay-rail)]" aria-hidden />;
  return (
    <span className="flex flex-col gap-0.5" aria-hidden>
      {shown.map((ramp, i) => (
        <span key={i} className="flex overflow-hidden rounded-[2px]" style={{ height }} title={ramp.join(' ')}>
          {ramp.map((c, j) => <span key={j} className="flex-1" style={{ background: c }} />)}
        </span>
      ))}
    </span>
  );
}
