/**
 * operator-guide.js — the shared T-numbered operator-guide emitter
 * (export-blender.plan.md rev 3, D10: the lift the Unity and Unreal legs waited for).
 *
 * The protocol, proven at two human seams (Unity IMPORT-GUIDE, Unreal guide) and now
 * three (the Blender ARTPASS-GUIDE): one step one line; `T###[.##]` lines are actions
 * the operator takes in the tool, `####` lines are facts to read (verify-before-
 * instruct); exact UI paths; quote the current value; chunked by purpose; the
 * honest-loss ledger numbered from #101. Pure text — deterministic, no clock, no dice.
 *
 * Byte-identity promise: the Unity + Unreal guides migrated onto these helpers under
 * their snapshot tests; changing a helper here changes every leg's emitted pack.
 */
import { GREYBOX_HANDOFF_SENTENCE } from './engine-score.js';

/** Shortest decimal text at 1e-6, never "-0" (eye heights, dims). */
export const fmt = (n) => {
  const v = Math.round(n * 1e6) / 1e6;
  return Object.is(v, -0) ? '0' : String(v);
};

/** README form of the honest-loss ledger: one bullet per row that carries a `note`
 * (nested per-level maps are skipped — the legs print those themselves). */
export const ledgerLines = (ledger) => Object.entries(ledger)
  .filter(([, v]) => v && typeof v === 'object' && 'note' in v)
  .map(([k, v]) => `- \`${k}\`${v.count != null ? ` ×${v.count}` : ''}${v.kinds ? ` (${v.kinds.join(', ')})` : ''} — ${v.note}`)
  .join('\n');

/** Guide form of the ledger: `#101 key ×n — note`, numbered from `startAt`. */
export const guideLedger = (ledger, startAt = 101) => Object.entries(ledger)
  .filter(([, v]) => v && typeof v === 'object' && 'note' in v)
  .map(([k, v], i) => `#${String(startAt + i).padStart(3, '0')} ${k}${v.count != null ? ` ×${v.count}` : ''} — ${v.note}`)
  .join('\n');

/** `#003 …` fact lines (the eyes-gate checklist shape), numbered from `startAt`. */
export const numberedFacts = (lines, startAt = 3) =>
  lines.map((line, i) => `#${String(startAt + i).padStart(3, '0')} ${line}`);

// The greybox seam (skin-over-mesh.plan.md): stamped packs carry the handoff
// sentence as its own section; unstamped packs emit byte-identical text.
export const greyboxSection = (stamped) => (stamped ? `## Greybox handoff

${GREYBOX_HANDOFF_SENTENCE}

` : '');

/**
 * The guide's first three lines — title + the two standing facts (#001 derived
 * artifact / re-mint; #002 the T protocol). Each leg appends its own chunks.
 */
export const guidePreamble = ({
  title, heading, recipeNote, target,
  doer = 'the importer script', doerShort = 'the importer',
}) => `# ${title} — ${heading}

#001 This pack is a derived artifact of a mojulo recipe (${recipeNote}); re-mint it from the recipe rather than hand-editing. Target editor: ${target}.
#002 Steps marked T are editor actions, one per line, in order. Everything not listed here is done by ${doer} — do not set values by hand that ${doerShort} already sets.
`;
