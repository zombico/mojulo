/**
 * entries — the playscape encyclopedia's cards, generated from its entries at load, never written by hand. An entry
 * card says what the thing does (its variants, as joints and leaves), what it answers for itself (what blocks, what
 * it sweeps, what a walker gets through, where it is used from), its rules, and the skins it can wear; each number on
 * it is measured off the mechanism for a standard opening, so a card cannot drift from what the entry builds.
 *
 * Not yet served by a tool: an entry is listed once a recipe can place it in a world.
 */
import { ENTRIES, resolveObject } from './objects/index.js';
import { landingRead } from './objects/platform.js';

/** The bytes an entry card's body may take. */
export const ENTRY_CARD_BODY_CEILING = 3200;

// the opening every card's numbers are measured in
const STANDARD = { width: 1.4, height: 2.6 };
const m2 = (x) => `${Math.round(x * 100) / 100} m`;

function needsText(variant, o) {
  const b = o.sweep, span = (k) => Math.max(...b.map((x) => x.max[k])) - Math.min(...b.map((x) => x.min[k]));
  const J = ENTRIES.door.leaves(variant, o.params)[0].joint.type;
  if (J === 'hinge') return `${m2(span(1))} clear in front for the swing`;
  if (J === 'slide') return `${m2(span(0) - STANDARD.width)} of wall beside the opening for the leaves`;
  return `${m2(span(2) - STANDARD.height)} of headroom above the opening`;
}

export function entryCard(id) {
  const E = ENTRIES[id];
  const rows = Object.entries(E.variants).map(([v, V]) => {
    const open = resolveObject({ entry: id, variant: v, fit: STANDARD, state: 'open' });
    const leaves = E.leaves(v, open.params);
    return { v, V, leaves, open };
  });
  const lines = [
    `# ${E.name} (playscape entry)`, '',
    `${E.role[0].toUpperCase()}${E.role.slice(1)}. What it does is the variant; what it looks like is the skin, worn on top. It fits any opening (a doorway anchor sizes it) and moves from closed (t 0) to open (t 1).`, '',
    `VARIANTS (in a ${STANDARD.width} × ${STANDARD.height} m opening)`,
    ...rows.map(({ v, V, leaves, open }) => `  - ${v}: ${V.about}. ${leaves.length} ${leaves.length > 1 ? 'leaves' : 'leaf'} on a ${leaves[0].joint.type}; open, ${m2(open.clearance.width)} clear; needs ${needsText(v, open)}${V.control === 'beside' ? '; raised from a control beside the opening' : ''}.`),
    '', 'IT ANSWERS FOR ITSELF',
    '  collider at any t (closed it blocks, open a walker passes); the sweep of its leaves (keep it clear of props);',
    '  clearance (the width and height a walker gets through); use points (both sides of the handle, or the control).',
    '', 'RULES (built from the game idioms)',
    `  a use sets <id>-open; locked, it waits for its unlock event (a key's pickup), then for a use.`,
    '', `STATES     ${Object.keys(E.states).join(', ')}`,
    `SKINS      ${Object.keys(E.skins).join(', ')} (values only; a tone colours them)`,
    `INTEREST   ${E.interest}: judged by the object laws on the skinned build`,
    '', 'STARTERS',
    ...rows.map(({ v }) => `  ${JSON.stringify({ entry: id, variant: v, skin: 'greybox', at: '<a doorway anchor id>' })}`),
  ];
  return { id: `entry/${id}`, name: `${E.name} (playscape entry)`, summary: `${E.role[0].toUpperCase()}${E.role.slice(1)}: ${Object.keys(E.variants).join(', ')}.`, when: E.when, body: lines.join('\n') };
}

/** The platform's card: its variants, the area budget and how a landing reads, what it answers, its skins. */
export function platformCard() {
  const E = ENTRIES.platform, rows = [1, 2.25, 4, 9].map((a) => `${a} m² ${landingRead(a)}`);
  const lines = [
    `# ${E.name} (playscape entry)`, '',
    'A deck to land on, called by its surface area: `area` is the walkable top in square metres (`aspect`, width over depth, shapes it). In a platformer the area is the difficulty.', '',
    'VARIANTS', ...Object.entries(E.variants).map(([v, V]) => `  - ${v}: ${V.about}${V.drive ? ` (a clock: ${V.drive.period} s, ${V.drive.mode})` : ''}.`),
    '', `LANDING    ${rows.join(' · ')}`,
    'IT ANSWERS FOR ITSELF',
    '  its deck and collider at t; the space it sweeps and the headroom a rider needs over it all along (keep both clear);',
    '  its landing read; the pieces the platformer world runs (a still deck: a floor face and a collider; a moving one: a carrier).',
    '', `DRIVES     clock (back and forth, or round a loop); a rail runs by distance, at one pace`,
    `SKINS      ${Object.keys(E.skins).join(', ')} (values only; a still island hangs one keel point, a moving one two tiers)`,
    '', 'STARTERS',
    `  ${JSON.stringify({ entry: 'platform', variant: 'static', area: 4, at: [0, 0, 2] })}`,
    `  ${JSON.stringify({ entry: 'platform', variant: 'shuttle', area: 2.25, travel: [6, 0, 0], at: [4, 0, 2] })}`,
    `  ${JSON.stringify({ entry: 'platform', variant: 'rail', area: 4, rail: [[6, 0, 0], [6, 6, 2], [0, 6, 2]], loop: true, at: [0, 0, 2] })}`,
  ];
  return { id: 'entry/platform', name: `${E.name} (playscape entry)`, summary: 'A deck to land on, still, shuttling or on a rail, called by its surface area.', when: E.when, body: lines.join('\n') };
}

/** The lift's card: stops, ride and call, what it answers. */
export function liftCard() {
  const E = ENTRIES.lift, o = resolveObject({ entry: 'lift', stops: [0, 6] });
  const lines = [
    `# ${E.name} (playscape entry)`, '',
    'Vertical traversal: a deck (a platform\'s, by the same area budget) carrying the player between STOPS, heights above where it stands. `speed` is metres a second.', '',
    'VARIANTS', ...Object.entries(E.variants).map(([v, V]) => `  - ${v}: ${V.about}.`),
    '', 'IT ANSWERS FOR ITSELF',
    `  its SHAFT: the column from under the lowest stop to ${o.headroom} m over the highest; a level leaves it open and cuts every floor it passes;`,
    '  its LANDINGS: where you board at each stop and step off to either side; the headroom that keeps a rider from being crushed;',
    `  how long a ride takes and its dwell (6 m at 1.5 m/s: ${o.ride.seconds} s, then ${o.ride.dwell} s waiting).`,
    '', 'IN THE WORLD  a mover carrier on a vertical rail; a ride lift runs today, a called lift rides between its ends until calls reach the runtime.',
    '', 'STARTERS',
    `  ${JSON.stringify({ entry: 'lift', area: 4, stops: [0, 6], at: [0, 0, 0] })}`,
    `  ${JSON.stringify({ entry: 'lift', area: 6, stops: [0, 4, 9], speed: 2, at: [0, 0, 0] })}`,
  ];
  return { id: 'entry/lift', name: `${E.name} (playscape entry)`, summary: 'Vertical traversal between stops: ridden or called.', when: E.when, body: lines.join('\n') };
}

export const playscapeEntryCards = () => [entryCard('door'), platformCard(), liftCard()];
