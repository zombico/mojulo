/**
 * UI LAWS — what a layout is judged by. Measured and advised, never refused (objects/laws.js is the model).
 *
 *   UI_LAWS              law → one line
 *   uiAdvice(play, ui, { anchors, entities }?)   [{ law, at?, advice }] for a play block (and its direction, when it has one; the
 *                        built map's anchors, when known, to find what cues name)
 */
import { UI_REGIONS, REGION_BUDGETS, regionClass } from './regions.js';
import { readPart, PARTS } from './parts.js';
import { SCENE_ONLY } from './register.js';
import { phasesOf } from './direction.js';
import { readCues, unplacedAnchors } from './cues.js';
import { readMenus, openers } from './menus.js';
import { readSpots, castRefs, withStands } from './cast.js';

export const UI_LAWS = Object.freeze({
  'values-only': 'Black and white: a part is built in values on ui:panel, ui:line, ui:ink and ui:status; colour is the guide\'s.',
  'accent-is-use': 'The status accent marks what you can use or what matters now, and nothing else.',
  'centre-is-focus': 'The centre region holds the moment (a banner, a toast, a prompt, the reticle), never a standing readout.',
  'region-budget': `A region holds what its pace can take in: at a glance a corner ${REGION_BUDGETS.glance.corner}, scanned ${REGION_BUDGETS.scan.corner}, studied ${REGION_BUDGETS.study.corner} (edges and the centre fewer).`,
  'owners-apart': 'Mine and theirs read apart in values: a part over each entity that enemies also see marks ally and enemy with different shapes.',
  'hit-reads': 'A hit changes the reticle\'s shape (a hitmarker), not only its colour, so it reads in values and in the corner of the eye.',
  'board-only': 'A part the page does not draw yet (its renderer, or a value owned by a team or by each entity) is designed on the board, and the page leaves it out until it lands.',
  'values-apart': 'Two standing parts that mean different things read apart in values (shape, size or place), never by colour alone.',
  'cue-ends': 'A cue that puts something up (a part shown, a prompt) says when it comes down: until a happening or a time.',
  'menu-reached': 'Every menu is opened by something: a cue, or another menu\'s choice.',
  'menu-closes': 'A menu lets the player out: a talk with choices has one that leads back to play, and a confirm\'s answers close it.',
  'cue-anchor': 'A cue named by an anchor finds it on the built map (anchors are the map\'s own ids: get the world to read them).',
  'scene-backend': 'A dial value only the engine draws (light: lit) is drawn by the dom backend at its nearest until the scene backend lands.',
  'cast-known': 'A cast effect or a zone\'s who names a character the world has.',
  'cast-places': 'A walk or a spawn goes to a place the world carries: a spot, an anchor or a stand point at a door.',
  'spawn-asleep': 'Who appears by a spawn is minted asleep (dormant: true), or sent away before.',
  'stuck-retry': 'A cue on stuck that sends the same walk again fires once (once: true) or goes somewhere else; it would retry every second.',
  'round-collide': 'A collide egg is round on the ground: a wide heavy thing (a gate, a counter) blocks with a box.',
});

// moments and held overlays pass through a region; the budget is what stands
export const MOMENTS = Object.freeze(['banner', 'toast', 'scoreboard', 'hitmarker', 'damage', 'feed']);
// the focus itself: the reticle stands in the centre by right, and counts against no budget
export const FOCUS = Object.freeze(['reticle']);
export const DEFAULT_REGION = Object.freeze({ reticle: 'center', hitmarker: 'center', ammo: 'bottom-right', weapon: 'bottom-right', lock: 'over', target: 'top', damage: 'center', feed: 'top-right', readout: 'top-left', banner: 'center', toast: 'center', legend: 'bottom', ledger: 'top-left', forecast: 'top', trend: 'top-left', alerts: 'right', allocator: 'bottom-left', queue: 'bottom', scoreboard: 'center', nameplate: 'over' });

/** Advice for a play block: per phase, the parts each region holds against its budget and the centre's reservation. */
export function uiAdvice(play, ui = play && play.ui, { anchors = null, entities = null } = {}) {
  const out = [];
  if (!play || typeof play !== 'object') return out;
  anchors = withStands(anchors);
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
  // the cues: what they put up comes down; what the page does not draw yet is the board's
  const cues = readCues(play, phasesOf(play));
  for (const c of cues) {
    const up = c.then.filter((t) => t.kind === 'show' || (t.kind === 'say' && t.as === 'prompt' && !t.ttl));
    if (up.length && !c.until) out.push({ law: 'cue-ends', at: `cue ${c.id}`, advice: `it ${up.map((t) => (t.kind === 'show' ? `shows ${t.part}` : 'holds a prompt')).join(' and ')} and never takes it down; add until (a happening, or { ttl })` });
  }
  const opened = openers(play);
  for (const m of readMenus(play)) {
    if (!opened.get(m.id).length) out.push({ law: 'menu-reached', at: `menu ${m.id}`, advice: `nothing opens it; add a cue (when: { near: { anchor } }, then: { open: '${m.id}' }) or a choice that does` });
    // a talk whose every choice opens another menu never returns to play on its own
    if (m.kind === 'talk' && m.picks.length && m.picks.every((p) => p.then.some((t) => t.kind === 'open'))) out.push({ law: 'menu-closes', at: `menu ${m.id}`, advice: 'every choice opens another menu; give one choice that leads back to play (a choice with no then closes it)' });
  }
  if (anchors) { const lost = unplacedAnchors(play, anchors); if (lost.length) out.push({ law: 'cue-anchor', at: lost.join(', '), advice: `the map carries no anchor called ${lost.join(', ')}; its anchors are ${anchors.slice(0, 12).map((a) => a.id).join(', ')}${anchors.length > 12 ? ', …' : ''}` }); }
  const held = cues.flatMap((c) => c.then.filter((t) => !t.page).map((t) => `${c.id} (${t.kind}${t.part ? ` ${t.part}` : t.phase ? ` ${t.phase}` : t.menu ? ` ${t.menu}` : ''})`));
  if (held.length) out.push({ law: 'board-only', at: 'cues', advice: `set on the bus, drawn on the board, not yet on the page: ${held.join(', ')}` });
  // the cast: whom its effects name, the places they go, and spawns of someone already up
  const refs = castRefs([...cues.flatMap((c) => c.then), ...readMenus(play).flatMap((m) => m.picks.flatMap((p) => p.then))], cues.flatMap((c) => [c.when, c.until]));
  if (Array.isArray(entities)) {
    const ids = new Set(entities.map((e) => e && e.id)), lost = refs.who.filter((w) => !ids.has(w));
    if (lost.length) out.push({ law: 'cast-known', at: lost.join(', '), advice: `the world has no character called ${lost.join(', ')}; its entities are ${[...ids].filter(Boolean).slice(0, 12).join(', ')}` });
    for (const s of refs.spawns) {
      const e = entities.find((x) => x && x.id === s);
      if (e && e.dormant !== true && !refs.vanished.includes(s)) out.push({ law: 'spawn-asleep', at: s, advice: `${s} is up from the start and nothing sends it away, so its spawn only moves it; mint it asleep (dormant: true) to have it appear` });
    }
  }
  // a stuck walk sent again from its own stuck, every time: it loops once a second
  for (const c of cues) {
    if (c.once || c.when.kind !== 'stuck' || c.when.who.includes('*')) continue;
    if (c.then.some((t) => t.kind === 'cast' && t.op === 'walk' && t.who === c.when.who)) out.push({ law: 'stuck-retry', at: `cue ${c.id}`, advice: `${c.when.who} is sent walking again each time it is stuck, so a blocked way retries every second; make the cue once: true or send it elsewhere` });
  }
  if (Array.isArray(entities)) for (const e of entities) {
    const cv = e && e.body && e.body.heavy ? e.body.collide : null, a = Number.isFinite(cv) ? cv : cv && !cv.box ? cv.a : 0;
    if (a > 1.5) out.push({ law: 'round-collide', at: e.id, advice: `${e.id} collides as a disc ${a * 2} m across, not its shape; give it collide: { box: [hx, hy, hz] }` });
  }
  const spotIds = new Set(readSpots(play).map((s) => s.id)), anchorIds = anchors ? new Set(anchors.map((a) => a.id)) : null;
  const nowhere = refs.places.filter((p) => !spotIds.has(p) && (anchorIds ? !anchorIds.has(p) : false));
  if (nowhere.length) out.push({ law: 'cast-places', at: nowhere.join(', '), advice: `no spot or anchor is called ${nowhere.join(', ')}; the walk or spawn that names it does nothing; add it to play.spots` });
  const dials = ui && ui.guide && ui.guide.dials;
  if (dials) for (const [d, words] of Object.entries(SCENE_ONLY)) if (words.includes(dials[d])) out.push({ law: 'scene-backend', at: `dial ${d}`, advice: `${d}: ${dials[d]} is the engine's to draw; the page draws it unlit for now` });
  return out;
}
