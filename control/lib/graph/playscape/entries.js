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
import { BRIDGE_MOTIFS, CROSSING, WALK_GRADE } from './objects/bridge.js';

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

/** The catapult's card: the three ways it reads the approach, steering, what it answers. */
export function catapultCard() {
  const E = ENTRIES.catapult, o = resolveObject({ entry: 'catapult', variant: 'fixed', target: [10, 0, 2] });
  const lines = [
    `# ${E.name} (playscape entry)`, '',
    'A launcher that stays put and throws the player, its throw tuned by how the player comes in. The throw is the platform rule\'s own momentum, so the rider lands as the entry says.', '',
    'VARIANTS (how it reads the approach)', ...Object.entries(E.variants).map(([v, V]) => `  - ${v}: ${V.about}.`),
    '', 'TUNING     power m/s, angle deg, gain (how much of the run-up carries), cap m/s, restitution (bounce), cone deg (the approaches it takes; absent, any), reload s',
    'STEERING   the rider steers in the air by default; `locked: true` holds the arc until it lands (a scenic route that must arrive where aimed)',
    '', 'IT ANSWERS FOR ITSELF',
    `  its ARC for an approach, stepped as the world steps it: apex, landing, seconds aloft (a target 10 m out and 2 m up: ${o.params.power} m/s at ${o.params.angle}°, ${o.arc.seconds} s);`,
    '  the TUBE the rider\'s body flies through (keep it clear); how far steering can move the landing (`reach`); its plate on a lift joint (t is the throw).',
    '', 'IN THE WORLD  a pad with its collider and a `launcher` entity; it reloads before it throws again.',
    `SKINS      ${Object.keys(E.skins).join(', ')} (values only; chevrons along the heading, more for a stronger throw; a ring for a bounce)`,
    '', 'STARTERS',
    `  ${JSON.stringify({ entry: 'catapult', variant: 'fixed', target: [10, 0, 2], at: [0, 0, 0] })}`,
    `  ${JSON.stringify({ entry: 'catapult', variant: 'redirect', dir: [1, 0], power: 6, angle: 40, cone: 90 })}`,
    `  ${JSON.stringify({ entry: 'catapult', variant: 'bounce', power: 8, restitution: 0.9 })}`,
    `  ${JSON.stringify({ entry: 'catapult', variant: 'fixed', target: [24, 6, 8], angle: 50, locked: true })}`,
  ];
  return { id: 'entry/catapult', name: `${E.name} (playscape entry)`, summary: 'A launcher that stays put and throws the player: fixed, redirect or bounce.', when: E.when, body: lines.join('\n') };
}

/** The bridge's card: called by its ends, built of the elements a style guide names, answering as a platform. */
export function bridgeCard() {
  const E = ENTRIES.bridge, o = resolveObject({ entry: 'bridge', variant: 'rope', from: [0, 0, 0], to: [8, 0, 0] });
  const lines = [
    `# ${E.name} (playscape entry)`, '',
    'A walkable way over a gap: a static platform stretched from bank to bank. Call it by its ENDS (`from`, `to`: where the walk meets the gap, the deck top there) and its walkable `width`, or `over` a trail\'s pit hazard anchor, which gives both.', '',
    'VARIANTS AND THEIR ELEMENTS (the words a style guide uses; turn any off or tune it: `elements: { rails: false, posts: { every: 2 } }`)',
    ...Object.entries(E.variants).map(([v, V]) => `  - ${v}: ${V.about}. Elements: ${V.elements.join(', ')}.`),
    `MOTIFS     on an arch's parapets: ${BRIDGE_MOTIFS.join(', ')}`,
    '', `CROSSING   ${CROSSING.map((c) => `${c.read} from ${c.from} m`).join(' · ')}; steeper than ${WALK_GRADE} is a scramble (an 8 m rope bridge: ${o.crossing.read}, grade ${o.crossing.grade}, ${o.crossing.walk})`,
    'IT ANSWERS FOR ITSELF',
    '  its deck line (the top at every half metre), how it reads to cross, its bearings (keep each bank solid there), the clearance under it;',
    '  the pieces the world runs: floor faces and colliders end to end, the rails as lines a walker is kept inside. Built of blocks: it dices and dismantles.',
    '', 'STARTERS',
    `  ${JSON.stringify({ entry: 'bridge', variant: 'plank', from: [0, 0, 0], to: [3, 0, 0] })}`,
    `  ${JSON.stringify({ entry: 'bridge', variant: 'rope', from: [0, 0, 4], to: [9, 0, 4], width: 1 })}`,
    `  ${JSON.stringify({ entry: 'bridge', variant: 'arch', from: [0, 0, 2], to: [8, 0, 2], motif: 'dentil' })}`,
    `  ${JSON.stringify({ entry: 'bridge', variant: 'deck', over: '<a trail pit hazard anchor>' })}`,
  ];
  return { id: 'entry/bridge', name: `${E.name} (playscape entry)`, summary: 'A walkable way over a gap, called by its ends: plank, deck, rope or arch.', when: E.when, body: lines.join('\n') };
}

export const playscapeEntryCards = () => [entryCard('door'), platformCard(), liftCard(), catapultCard(), bridgeCard()];
