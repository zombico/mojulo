/**
 * THE EGOCUBE AS A KIND: a character's design sheet rolled once and kept, so the same person can be made in many games,
 * as a geocube is a level's look rolled once and kept for many levels.
 *
 *   { kind: 'egocube', title?, roll: { tuning?, brief?, facets?, seed?, lineages?, years?, chapters? }, dress?: 'designed' | 'kit',
 *     sheet? | thread? }
 *
 * `roll.tuning` chooses the design method: 'person' (the Egocube: a life drawn on a body) or 'mascot' (mascot.js: a
 * promise on a head-heavy, round, any-topology body; docs/mascot.md). Absent, a brief that asks for a mascot ('cartoony',
 * 'sonic-like', 'mascot', …) with no person's facet, lineage or years is a mascot, and any other roll a person; a stored
 * roll keeps the sheet it was rolled to (rollStored). A mascot does not age: it takes no years, chapters or lineages.
 *
 * `roll` is rollEgocube's arguments (with `years` and `chapters`, rollThread's: a fate thread). The sheet (or the
 * thread) is ROLLED WHERE IT IS WRITTEN and stored by value (`rollStored`): a later change to the Egocube's tables never
 * moves a stored sheet, and the characters made from it stay theirs. A roll the edit did not touch keeps its sheet.
 *
 *   rollStored(manifest, prev)            the manifest with its sheet or thread rolled, unless the roll is as stored
 *   egocubeNodes(manifest)                the thread's nodes, or the one sheet: [{ years?, band, sheet }]
 *   egocubeCreate(manifest, { years? })   the create_character call for the node at `years` (the canonical one when
 *                                         none is named): { node, create, after, ledger, outfit? }
 *   egocubePrint(manifest)                the print a character records of the sheet it was made from
 *   assembleEgocubeScene(m, ctx, layered) the preview: the sheet's character at each of its thread's ages, side by side
 *
 * Pure but for the preview's mints, which are in memory and never stored.
 */
import { rollEgocube } from './egocube.js';
import { rollThread } from './thread.js';
import { planFromSheet } from './plan.js';
import { rollMascot, asksForMascot, MASCOT_KEYS } from './mascot.js';
import { mascotPlanFromSheet, modelSheet } from './mascot-form.js';
import { mascotOfPerson } from './mascot-from-person.js';
import { fingerprint } from '../gameworld/review.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ROLL_KEYS = ['tuning', 'brief', 'facets', 'seed', 'lineages', 'years', 'chapters'];
export const TUNINGS = Object.freeze(['person', 'mascot']);

/** Whether a roll is a mascot's: named so, or a brief that asks for one with nothing only a person has. */
export function isMascotRoll(roll = {}) {
  if (roll.tuning !== undefined) return roll.tuning === 'mascot';
  const personal = Object.keys(roll.facets || {}).some((k) => !MASCOT_KEYS.includes(k)) || roll.years !== undefined || roll.chapters !== undefined || roll.lineages !== undefined;
  return !personal && asksForMascot(roll.brief || '');
}
const KEYS = ['kind', 'title', 'roll', 'dress', 'output', 'sheet', 'thread'];
/** what the cube makes by default: the character as rolled, or its MASCOT (a person's read into a mascot's facets) */
export const OUTPUTS = Object.freeze(['character', 'mascot']);
const DRESS = ['designed', 'kit'];
/** metres between two characters in the lineup */
export const LINEUP_GAP = 1.1;

/** Read an egocube manifest and say what is wrong. → the manifest */
export function readEgocubeKind(m) {
  const fail = (s) => new Error(`egocube: ${s}`);
  if (!isObj(m) || m.kind !== 'egocube') throw fail("a manifest of kind 'egocube'");
  for (const k of Object.keys(m)) if (!KEYS.includes(k)) throw fail(`'${k}' is not part of an egocube (${KEYS.filter((x) => x !== 'kind').join(', ')})`);
  if (!isObj(m.roll)) throw fail(`roll is { ${ROLL_KEYS.join(', ')} } (rollEgocube's words; years and chapters make a fate thread)`);
  for (const k of Object.keys(m.roll)) if (!ROLL_KEYS.includes(k)) throw fail(`roll.${k} is not a roll word (${ROLL_KEYS.join(', ')})`);
  if (m.roll.chapters !== undefined && m.roll.years === undefined) throw fail('roll.chapters follow a character from an age: give roll.years');
  if (m.roll.tuning !== undefined && !TUNINGS.includes(m.roll.tuning)) throw fail(`roll.tuning is ${TUNINGS.map((t) => `'${t}'`).join(' or ')} (person: a life drawn on a body; mascot: a promise on a head-heavy body, docs/mascot.md)`);
  if (isMascotRoll(m.roll)) for (const k of ['years', 'chapters', 'lineages']) if (m.roll[k] !== undefined) throw fail(`a mascot does not age and has no people: roll.${k} is a person's (tuning: 'person')`);
  if (m.output !== undefined && !OUTPUTS.includes(m.output)) throw fail(`output is ${OUTPUTS.map((o) => `'${o}'`).join(' or ')} (mascot: the character made as its mascot, docs/mascot.md)`);
  if (m.dress !== undefined && !DRESS.includes(m.dress)) throw fail(`dress is ${DRESS.map((d) => `'${d}'`).join(' or ')} (designed: the outfit designed from the sheet; kit: the stock kit by role)`);
  return m;
}

/** Roll the sheet (or the thread) where the manifest is written, unless its roll is the one stored. */
export function rollStored(m, prev = null) {
  if (m?.kind !== 'egocube') return m;
  readEgocubeKind(m);
  const same = prev?.kind === 'egocube' && JSON.stringify(prev.roll) === JSON.stringify(m.roll) && (prev.sheet || prev.thread);
  if (same && (m.sheet || m.thread)) return m;
  if (same) return { ...m, ...(prev.thread ? { thread: prev.thread } : { sheet: prev.sheet }) };
  const { sheet: _s, thread: _t, ...rest } = m;
  const { tuning: _tuning, ...roll } = m.roll;
  if (isMascotRoll(m.roll)) return { ...rest, sheet: rollMascot(roll) };
  return Array.isArray(roll.chapters) && roll.chapters.length ? { ...rest, thread: rollThread(roll) } : { ...rest, sheet: rollEgocube(roll) };
}

/** The nodes a stored egocube holds: its thread's, or its one sheet. */
export function egocubeNodes(m) {
  if (m.thread?.nodes) return m.thread.nodes.map((n) => ({ years: n.years, band: n.band, sheet: n.sheet }));
  if (m.sheet?.tuning === 'mascot') return [{ band: 'mascot', sheet: m.sheet }];   // a mascot has no age
  if (m.sheet) return [{ years: m.sheet.facets?.years ?? m.roll?.years, band: m.sheet.facets?.age, sheet: m.sheet }];
  throw new Error('egocube: the sheet is not rolled (write it with create_sketch, which rolls and stores it)');
}

/** The create_character call for the node at `years` (exactly, else the canonical node), dressed as the cube says. */
export function egocubeCreate(m, { years, dress, title, output } = {}) {
  const nodes = egocubeNodes(m);
  const node = years === undefined ? nodes[0] : nodes.find((n) => n.years === years);
  if (!node) throw new Error(`egocube: no node at ${years} years (the thread has ${nodes.map((n) => n.years).join(', ')})`);
  const out = output ?? m.output ?? 'character';
  if (!OUTPUTS.includes(out)) throw new Error(`egocube: output is ${OUTPUTS.map((o) => `'${o}'`).join(' or ')}`);
  // THE MASCOT OUTPUT: a mascot sheet as it is, a person's read into a mascot's facets on its own seed (mascot-from-person.js);
  // its body is its own (mascot-form.js), not dressed: its promise and its one piece are its look
  const mascot = node.sheet.tuning === 'mascot' ? node.sheet : out === 'mascot' ? mascotOfPerson(node.sheet) : null;
  if (mascot) {
    const P = mascotPlanFromSheet(mascot, { ...(title ? { title } : {}) });
    return { node: { years: node.years, band: node.band }, output: 'mascot', create: P.create, after: P.after, ledger: P.ledger, modelSheet: modelSheet(mascot, P),
      ...(mascot.mapping ? { mascot: { facets: mascot.facets, mapping: mascot.mapping } } : {}) };
  }
  const P = planFromSheet(node.sheet, { dress: (dress ?? m.dress ?? 'designed') === 'designed' ? 'designed' : undefined, ...(title ? { title } : {}) });
  return { node: { years: node.years, band: node.band }, create: P.create, after: P.after, ledger: P.ledger, ...(P.outfit ? { outfit: P.outfit } : {}) };
}

/** the TURNAROUND a mascot's model sheet shows: front, three-quarter, side, back (degrees about the vertical) */
export const TURNAROUND = Object.freeze([0, -40, -90, 180]);

/** What a character records of the sheet it was made from: the sheet's (or the thread's) print. */
export const egocubePrint = (m) => fingerprint(m.thread ?? m.sheet ?? null);

/**
 * The preview: the character at each node of the thread (or the one sheet), minted in memory through the same door a
 * create_character from this cube mints through, standing side by side in order of age on one floor. `layered` is the
 * layered kind's resolve (world-kinds.js), handed in so this module does not import the registry.
 */
export async function assembleEgocubeScene(m, ctx, layered) {
  const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
  const nodes = egocubeNodes(rollStored(m));
  // a mascot's preview is its model sheet's turnaround: the one character four times, turned (mascots do not age)
  const turnaround = nodes[0].sheet.tuning === 'mascot' || (m.output ?? 'character') === 'mascot';
  const scenes = [];
  for (const n of turnaround ? nodes.slice(0, 1) : nodes) {
    const C = egocubeCreate(rollStored(m), { years: n.years });
    const manifest = C.create.as === 'hero'
      ? expandLayeredManifest({ kind: 'layered', hero: heroRecord(C.create.spec) })
      : expandLayeredManifest({ kind: 'layered', plan: C.create.spec.plan, ...(C.create.spec.toon ? { toon: C.create.spec.toon } : {}), ...(C.create.spec.hullShade ? { hullShade: C.create.spec.hullShade } : {}) });
    scenes.push(await layered(manifest, { ...ctx, title: `${ctx.title ?? 'egocube'} · ${n.years ?? n.band}` }));
  }
  if (turnaround) while (scenes.length < TURNAROUND.length) scenes.push(scenes[0]);
  const offset = (i) => (i - (scenes.length - 1) / 2) * LINEUP_GAP;
  const turn = (i) => { const a = ((turnaround ? TURNAROUND[i] : 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return ([x, y, z]) => [x * c - y * s, x * s + y * c, z]; };
  const body = scenes.flatMap((s, i) => { const T = turn(i); return s.faces.filter((f) => !f.studio).map((f) => ({ ...f, corners: f.corners.map((p) => { const [x, y, z] = T(p); return [x + offset(i), y, z]; }), ...(Array.isArray(f.normal) && f.normal.length === 3 ? { normal: T(f.normal) } : {}) })); });
  const { figures: _f, ...first } = scenes[0];
  // each camera backs off along its own line until the lineup's width fits its view (a one-figure framing sees ~2 m)
  // (a loop, not a spread: a lineup of dressed figures has more corners than a call takes arguments)
  let lo = Infinity, hi = -Infinity; for (const f of body) for (const c of f.corners) { if (c[0] < lo) lo = c[0]; if (c[0] > hi) hi = c[0]; }
  const span = hi >= lo ? hi - lo : 0;
  const cameras = (first.cameras || []).map((c) => {
    const F = c.worldFraming; if (!F?.cameraPosition || !F.lookAt || !F.horizontalFov) return c;
    const d = F.cameraPosition.map((v, k) => v - F.lookAt[k]), dist = Math.hypot(...d), seen = 2 * dist * Math.tan((F.horizontalFov * Math.PI) / 360);
    const k = Math.max(1, (span + 0.6) / seen);
    return k === 1 ? c : { ...c, worldFraming: { ...F, cameraPosition: F.lookAt.map((v, i) => v + d[i] * k) } };
  });
  return { ...first, title: ctx.title ?? first.title, faces: [...first.faces.filter((f) => f.studio), ...body], cameras };
}
