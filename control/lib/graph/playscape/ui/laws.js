/**
 * UI LAWS — what a layout is judged by. Measured and advised, never refused (objects/laws.js is the model).
 *
 *   UI_LAWS              law → one line
 *   uiAdvice(play, ui)   [{ law, at?, advice }] for a play block (and its direction, when it has one)
 */
import { UI_REGIONS, REGION_BUDGETS, regionClass } from './regions.js';
import { readPart, PARTS } from './parts.js';
import { SCENE_ONLY } from './register.js';
import { phasesOf } from './direction.js';

export const UI_LAWS = Object.freeze({
  'values-only': 'Black and white: a part is built in values on ui:panel, ui:line, ui:ink and ui:status; colour is the guide\'s.',
  'accent-is-use': 'The status accent marks what you can use or what matters now, and nothing else.',
  'centre-is-focus': 'The centre region holds the moment (a banner, a toast, a prompt, the reticle), never a standing readout.',
  'region-budget': `A region holds what its pace can take in: at a glance a corner ${REGION_BUDGETS.glance.corner}, scanned ${REGION_BUDGETS.scan.corner}, studied ${REGION_BUDGETS.study.corner} (edges and the centre fewer).`,
  'owners-apart': 'Mine and theirs read apart in values: a part over each entity that enemies also see marks ally and enemy with different shapes.',
  'hit-reads': 'A hit changes the reticle\'s shape (a hitmarker), not only its colour, so it reads in values and in the corner of the eye.',
  'board-only': 'A part the page does not draw yet (its renderer, or a value owned by a team or by each entity) is designed on the board, and the page leaves it out until it lands.',
  'values-apart': 'Two standing parts that mean different things read apart in values (shape, size or place), never by colour alone.',
  'scene-backend': 'A dial value only the engine draws (light: lit) is drawn by the dom backend at its nearest until the scene backend lands.',
});

// moments and held overlays pass through a region; the budget is what stands
export const MOMENTS = Object.freeze(['banner', 'toast', 'scoreboard', 'hitmarker', 'damage', 'feed']);
// the focus itself: the reticle stands in the centre by right, and counts against no budget
export const FOCUS = Object.freeze(['reticle']);
export const DEFAULT_REGION = Object.freeze({ reticle: 'center', hitmarker: 'center', ammo: 'bottom-right', weapon: 'bottom-right', lock: 'over', target: 'top', damage: 'center', feed: 'top-right', readout: 'top-left', banner: 'center', toast: 'center', legend: 'bottom', ledger: 'top-left', forecast: 'top', trend: 'top-left', alerts: 'right', allocator: 'bottom-left', queue: 'bottom', scoreboard: 'center', nameplate: 'over' });

/** Advice for a play block: per phase, the parts each region holds against its budget and the centre's reservation. */
export function uiAdvice(play, ui = play && play.ui) {
  const out = [];
  if (!play || typeof play !== 'object') return out;
  const parts = (play.parts || []).map((p, i) => ({ ...readPart(p, i), when: p.when, bound: (p.bind && (p.bind.var || p.bind.on)) || p.part }));
  const pace = (ui && ui.guide && ui.guide.pace) || 'scan', budgets = REGION_BUDGETS[pace] || REGION_BUDGETS.scan;
  for (const phase of phasesOf(play)) {
    const live = parts.filter((p) => !p.when || p.when.includes(phase));
    for (const r of UI_REGIONS) {
      const here = live.filter((p) => (p.region || DEFAULT_REGION[p.part]) === r), standing = here.filter((p) => !MOMENTS.includes(p.part) && !FOCUS.includes(p.part));
      if (r === 'center' && standing.length && pace !== 'study') out.push({ law: 'centre-is-focus', at: `${phase} · center`, advice: `${standing.map((p) => p.part).join(', ')} stands in the centre; move it to an edge or a corner and keep the centre for moments` });
      const budget = budgets[regionClass(r)];
      if (standing.length > budget) out.push({ law: 'region-budget', at: `${phase} · ${r}`, advice: `${standing.length} standing parts where ${budget} read at ${pace} pace; spread them or fold two into one` });
    }
  }
  // the black-and-white test, measured: two standing parts of one kind in one region differ only by colour and label
  const standing = parts.filter((p) => !MOMENTS.includes(p.part) && !FOCUS.includes(p.part));
  for (let i = 0; i < standing.length; i++) for (let j = i + 1; j < standing.length; j++) {
    const a = standing[i], b = standing[j], ra = a.region || DEFAULT_REGION[a.part], rb = b.region || DEFAULT_REGION[b.part];
    if (a.part === b.part && a.variant === b.variant && ra === rb && (a.row.var || a.row.on) !== (b.row.var || b.row.on)) {
      out.push({ law: 'values-apart', at: ra, advice: `${a.row.var || a.part} and ${b.row.var || b.part} are both ${a.part} ${a.variant}s in ${ra}: in values they differ only by their label; change one's variant, size or region` });
    }
  }
  for (const p of parts) {
    if (p.of.startsWith('each:') && p.audience === 'all' && (!p.mark || p.mark.ally === p.mark.enemy)) out.push({ law: 'owners-apart', at: `${p.part} · ${p.bound}`, advice: p.part === 'scoreboard' ? 'allies and enemies both read this table; split its rows by team, or mark: { ally, enemy } in two shapes, not two colours' : `allies and enemies both see this ${p.part}; give it mark: { ally, enemy } in two shapes, not two colours` });
  }
  if (parts.some((p) => p.part === 'reticle') && !parts.some((p) => p.part === 'hitmarker')) out.push({ law: 'hit-reads', at: 'reticle', advice: 'the reticle has no hitmarker: a hit would read only as a colour flash; add a hitmarker part' });
  // the parts the page leaves out, grouped by why
  const why = (p) => (p.from ? 'the piloted runtime draws its own today' : p.of !== 'self' && p.of !== 'all' ? `owned by ${p.of}` : PARTS[p.part].page ? `at ${p.region}` : 'no page renderer yet');
  const groups = new Map();
  for (const p of parts.filter((x) => !x.page)) { const k = why(p); if (!groups.has(k)) groups.set(k, new Set()); groups.get(k).add(p.part); }
  if (groups.size) out.push({ law: 'board-only', at: 'page', advice: `drawn on the board, not yet on the page: ${[...groups].map(([k, v]) => `${[...v].join(', ')} (${k})`).join('; ')}` });
  const dials = ui && ui.guide && ui.guide.dials;
  if (dials) for (const [d, words] of Object.entries(SCENE_ONLY)) if (words.includes(dials[d])) out.push({ law: 'scene-backend', at: `dial ${d}`, advice: `${d}: ${dials[d]} is the engine's to draw; the page draws it unlit for now` });
  return out;
}
