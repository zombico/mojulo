/**
 * THE RAIL'S ADVICE — what design_game's readout says about how a world was designed, measured, never judged. All of it
 * advises; none of it refuses, and none of it says a design is good (that is the creator's eyes).
 *
 *   sameness(world)       a world that reads as a test fixture on most of the choices that make a world, or a page that is
 *                         a synthetic sample verbatim (the samples the drawer serves at seeds 1 to SAMPLE_SEEDS)
 *   grounding(world)      where the recipe carries a `brief`: the direction's elements and motif and the feel that no
 *                         word of it explains, as questions. Words
 *                         only (a choice is explained when the brief names it, or a word sharing its first letters); a
 *                         heuristic, and said to be one
 *   authorship(world)     how much of the world is the creator's: the pages written, and the pages left wholly derived
 *   compareWorlds(world, reference)   page by page, what the reference does that the world does not, and where they
 *                         differ; served only after the world has been made (design_game enforces it)
 *
 * Pure. Reads the recipe as written (gameworldOf), not the resolved book.
 */
import { gameworldSamples, SAMPLE_PAGES } from './samples.js';
import { MEADOWMARK_HERO } from './examples.js';

/** The reference worlds the creator may ask to see (made on request, compared after creation): the test fixtures. */
export const REFERENCES = Object.freeze({ meadowmark: MEADOWMARK_HERO });
export const SAMPLE_SEEDS = 8;

const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : v);
const motifWords = (m) => (Array.isArray(m) ? m : m?.words ?? []).map(lower);
const verbOf = (p) => lower(String(p.verb ?? '').split(/\s+/)[0]);

/** The choices that make a world, by name: each a string or a sorted list, absent when the world does not make it. */
export function signature(world) {
  const D = world.characters?.direction ?? {}, H = world.characters?.hero ?? {}, A = H.actions ?? {}, E = world.equipment ?? {};
  const powers = A.powers ?? [];
  const sorted = (xs) => (xs.length ? [...new Set(xs)].sort() : undefined);
  const out = {
    tradition: lower(D.tradition), primary: lower(D.primary), secondary: lower(D.secondary), motif: sorted(motifWords(D.motif)),
    idiom: lower(A.idiom), verbs: sorted(powers.map(verbOf)), shows: sorted(powers.map((p) => p.look ?? p.attack).filter(Boolean)),
    powerIds: sorted(powers.map((p) => p.id)), vibe: sorted((H.motion?.vibe ?? []).map(lower)),
    items: sorted((H.adornment?.items ?? []).map((it) => it.id)), gearStyle: typeof E.style === 'string' ? E.style : E.style?.id,
    kit: lower(world.style?.kit),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== null));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DISTINCT = ['primary', 'secondary', 'motif', 'verbs', 'shows', 'powerIds', 'vibe', 'items', 'gearStyle'];
const COMMON = ['tradition', 'idiom', 'kit'];

/** A world against the fixtures and the served samples. → [advice lines] */
export function sameness(world) {
  const S = signature(world), out = [];
  for (const [name, ref] of Object.entries(REFERENCES)) {
    // only the distinctive choices count: a tradition (one of two), an idiom (one of four) or a kit is shared by many
    // worlds that owe the fixture nothing; they are named when the rest already match
    const R = signature(ref), keys = Object.keys(S).filter((k) => k in R && DISTINCT.includes(k));
    const hits = keys.filter((k) => same(S[k], R[k])), common = COMMON.filter((k) => k in S && same(S[k], R[k]));
    if (hits.length >= 4 && hits.length * 2 >= keys.length) out.push(`reads as the test fixture '${name}' on ${hits.length} of ${keys.length} distinctive choices (${hits.join(', ')}${common.length ? `; and its ${common.join(', ')}` : ''}): was that the brief?`);
  }
  // a page that is a served sample verbatim
  const D = world.characters?.direction, H = world.characters?.hero ?? {};
  const pageOf = { direction: D ? { tradition: lower(D.tradition), primary: lower(D.primary), secondary: lower(D.secondary), motif: motifWords(D.motif) } : null, actions: H.actions?.powers ? sortedJson(H.actions.powers.map((p) => [verbOf(p), p.look ?? p.attack ?? null])) : null, motion: H.motion?.vibe ? sortedJson(H.motion.vibe.map(lower)) : null };
  for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
    for (const page of ['direction', 'actions', 'motion']) {
      if (!pageOf[page]) continue;
      const hit = served(page, seed).findIndex((s) => same(pageOf[page], page === 'direction' ? { ...s.fragment, motif: s.fragment.motif } : page === 'actions' ? sortedJson(s.fragment.powers.map((p) => [p.verb, p.look ?? p.attack ?? null])) : sortedJson(s.fragment.vibe)));
      if (hit >= 0) out.push(`the ${page} page is synthetic sample ${hit + 1} of seed ${seed}, verbatim: a sample shows the space, it is not a choice`);
    }
  }
  return out;
}
const sortedJson = (xs) => xs.map((x) => JSON.stringify(x)).sort();
// the samples the drawer serves at a seed, drawn once per process (they are pure)
const SERVED = new Map();
const served = (page, seed) => { const k = `${page}:${seed}`; if (!SERVED.has(k)) SERVED.set(k, gameworldSamples(page, { n: 12, seed }).samples); return SERVED.get(k); };

/** The choices a brief does not explain, as questions. → [question lines] (none without a brief) */
export function grounding(world) {
  const brief = typeof world.brief === 'string' ? world.brief : world.brief?.prompt ?? world.brief?.text;
  if (typeof brief !== 'string' || !brief.trim()) return [];
  const words = new Set(brief.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2));
  const explained = (w) => String(w).toLowerCase().split(/[^a-z]+/).filter(Boolean).some((part) => [...words].some((b) => b === part || (part.length >= 4 && b.length >= 4 && b.slice(0, 4) === part.slice(0, 4))));
  const S = signature(world), out = [];
  const ask = (what, w) => { if (w && !explained(w)) out.push(`${what} '${w}': nothing in the brief says so; where does it come from?`); };
  ask('the leading element', S.primary); ask('the supporting element', S.secondary);
  for (const m of S.motif ?? []) ask('the motif', m);
  for (const v of S.vibe ?? []) ask('the feel', v);
  // power verbs are not asked about: a power is invented in the brief's spirit, rarely in its words
  return out;
}

/** How much of the world is the creator's. → { written: [pages], derived: [pages], line } */
export function authorship(world) {
  const H = world.characters?.hero, L = H?.looks ?? {}, written = [], derived = [];
  const page = (name, mine) => (mine ? written : derived).push(name);
  if (world.characters) {
    const D = world.characters.direction ?? {};
    page('direction', Object.keys(D).some((k) => k !== 'tradition'));
    for (const k of ['body', 'head', 'hair', 'colour', 'underlayer']) page(`looks.${k}`, L[k] !== undefined);
    page('motion', !!H?.motion);
    page('actions', !!H?.actions?.powers?.length);
    page('adornment', !!H?.adornment);
  }
  if (world.equipment || world.characters) page('equipment', !!(world.equipment?.style || Object.keys(world.equipment?.classes ?? {}).length));
  if (world.mechanics) page('systems', Object.keys(world.mechanics).length > 0);
  const line = `${written.length} of ${written.length + derived.length} pages written${derived.length ? `; left to the book's first reading: ${derived.join(', ')}` : ''}`;
  return { written, derived, line };
}

/** Page by page against a reference. → [{ page, reference, world }] where they differ */
export function compareWorlds(world, reference) {
  const A = signature(world), B = signature(reference), rows = [];
  for (const k of new Set([...Object.keys(B), ...Object.keys(A)])) if (!same(A[k], B[k])) rows.push({ choice: k, reference: B[k] ?? null, world: A[k] ?? null });
  const a = authorship(world), b = authorship(reference);
  const onlyRef = b.written.filter((p) => !a.written.includes(p));
  return { differs: rows, writtenInReferenceOnly: onlyRef, authorship: { world: a.line, reference: b.line } };
}

export { SAMPLE_PAGES };
