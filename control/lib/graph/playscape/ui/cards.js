/**
 * THE PLAY DRAWER's cards (get_play_vocab) — playscape served scaled to the ask: the ladder first (one line a rung),
 * a rung's set when the ask names one, one card in full by id. Generated from the registries beside them (PARTS,
 * DIALS, UI_MOTIONS, UI_LAWS, UI_ITEMS), never written by hand, so a card cannot drift from what the build reads.
 *
 *   PLAY_RUNGS            the ladder: rung → { name, makes, asks, built }
 *   playCards()           Map id → { id, name, summary, when, body }
 *   playIndex()           the ladder plus the card rows
 *   playRung(n)           a rung's read: what it admits (itself and every rung below), or that it is not served yet
 */
import { PARTS, PART_IDS, UI_STATES, lowerParts, AUDIENCES, MARKS, OWNER_WORDS } from './parts.js';
import { REGISTER_STOPS, STOP_IDS, DIAL_IDS, DIAL_ABOUT, DIALS } from './register.js';
import { UI_MOTIONS, MOTION_IDS } from './motion.js';
import { UI_LAWS } from './laws.js';
import { UI_ITEMS, MAX_PHASES } from './direction.js';
import { UI_REGIONS, HUD_REGIONS, UI_LAYERS, UI_SURFACES, PACES, REGION_BUDGETS } from './regions.js';
import { SYSTEMS, SYSTEM_IDS } from './systems.js';
import { BORDER_ELEMENTS, ELEMENT_IDS, BORDER_FLAVORS, FLAVOR_IDS, PIXEL_SIZES } from './borders.js';

// one ladder: the play tiers (click, walk, level, game) and the UI rungs merged; a rung admits itself and all below
export const PLAY_RUNGS = Object.freeze([
  { rung: 0, name: 'board', makes: 'a game that is only its UI: a clicker, a quiz, a card flip, a dialogue', asks: ['make a quiz game', 'a clicker', 'a memory card game', 'a choose-your-path story'], built: false },
  { rung: 1, name: 'click', makes: 'things you press that answer: switches, levers, doors, cause → effect', asks: ['make the door open', 'add a lever that lowers the bridge', 'make it interactive'], built: false },
  { rung: 2, name: 'level', makes: 'a level with fewer than eight states: readouts, moments, prompts', asks: ['turn this into a level', 'add a score and a timer', 'give it a HUD'], built: false },
  { rung: 3, name: 'systems', makes: 'a HUD composed from the game\'s systems: pools (mana, chakra, stamina), ammo, radar', asks: ['a shooter with ammo and a radar', 'a game with mana and cooldowns'], built: false },
  { rung: 4, name: 'game', makes: 'menus and stats over carried state: inventory, loadout, party, progression', asks: ['an inventory screen', 'a skill tree', 'compare two swords'], built: false },
]);

const lines = (...xs) => xs.flat().join('\n');

function guideCard() {
  const ex = { parts: [PARTS.readout.example, PARTS.banner.example], phases: ['playing', 'won'], ui: 'propose' };
  return lines(
    'PLAY — playscape makes what HAPPENS in a world scapeshift made (or any world). A world opts in with a `play` block,',
    'lowered once at build; absent, not a byte changes.',
    '',
    'THE LADDER (get_play_vocab({ rung }) reads one; a rung admits itself and every rung below):',
    PLAY_RUNGS.map((r) => `  ${r.rung} ${r.name.padEnd(8)} ${r.makes}${r.built ? '' : ' (not served yet)'}`),
    '',
    'THE BLOCK (update_sketch the world, patch /play):',
    `  play: ${JSON.stringify(ex)}`,
    `  parts   what shows (get_play_vocab({ id: 'ui-part-<part>' })); it lowers to events.hud rows exactly:`,
    `          ${JSON.stringify(lowerParts(ex.parts))}`,
    `  phases  at most ${MAX_PHASES} names; a part's \`when\` lists the phases it lives in (drawn as wireframes today)`,
    '  ui      the direction gate (card \'ui-board\'): \'propose\' → a board to approve item by item; \'auto\' is hands off;',
    '          { register, pin, border, pixel, pace } tune it (cards ui-register, ui-border, ui-pixel, ui-pace)',
    '',
    'INTERPRETING THE ASK is yours: map a genre word onto a part and keep the word as its label ("chakra" is a pool',
    'read as a bar labelled CHAKRA). Scapeshift may leave `play_hints: { fiction, register, motifs }` on a stage.',
  );
}

function boardCard() {
  return lines(
    'THE UI BOARD — approval before creation. `play.ui: \'propose\'` (or `{ register, pin }`) fills a direction at authoring',
    'time and the answer carries its board as an image. Items, in board order:',
    UI_ITEMS.map((k, i) => `  ${i + 1} ${k}`),
    '  guide and motion are drawn (send one back: patch /play/ui/<item> "reroll"); parts, layout and wireframes are',
    '  drawn from play.parts and play.phases (edit those).',
    'Approve: update_sketch({ ref, patch: [{ op: \'set\', path: \'/play/ui/status/<item>\', value: \'approved\' }] }).',
    'While any item is proposed the page draws the UI in greybox; once all are approved (or auto) it draws the guide.',
    'Every guide value names the layer that set it: operator (play.ui) > hints (play_hints) > world (the tone) > roll > default.',
  );
}

function registerCard() {
  return lines(
    'REGISTER — one slider from modern (0: 2015 onward, sans serif, UX conventions) to immersive (1: the late-90s menu',
    'rendered in the engine). Say it as a number or a stop:',
    `  ${STOP_IDS.map((s) => `${s} ${REGISTER_STOPS[s]}`).join(' · ')}`,
    'The slider moves the dials together; pin one on its own with play.ui.pin: { <dial>: <word> }.',
    DIAL_IDS.map((d) => `  ${d.padEnd(8)} ${DIALS[d].join(' → ')}  (${DIAL_ABOUT[d]})`),
    'Authored as words, emitted as CSS on the page (the dom backend); the engine backend reads the same words.',
  );
}

function motionCard() {
  return lines(
    'MOTION — the UI\'s moves, in frames on the game clock (60 a second): a pause freezes them, nothing eases on hover.',
    MOTION_IDS.map((m) => `  ${m.padEnd(10)} ${UI_MOTIONS[m].frames} f (${UI_MOTIONS[m].rail.join('–')})${UI_MOTIONS[m].loop ? ' loop' : ''} · ${UI_MOTIONS[m].use}`),
    'The register\'s motion dial sets the curve: eased → snapped → stepped → mechanical.',
  );
}

function layoutCard() {
  return lines(
    `REGIONS — ${UI_REGIONS.join(', ')} (the page draws ${HUD_REGIONS.length} of them today: ${HUD_REGIONS.join(', ')}).`,
    `LAYERS — ${UI_LAYERS.join(' < ')}. SURFACES — ${UI_SURFACES.join(', ')} (screen today).`,
    'LAWS (advised, never refused):',
    Object.entries(UI_LAWS).map(([k, v]) => `  ${k}: ${v}`),
  );
}

function systemsCard() {
  const readers = (sys) => PART_IDS.filter((p) => (PARTS[p].from || []).includes(sys));
  return lines(
    'SYSTEMS — what a game\'s systems publish for the UI (compose the systems and you have composed the HUD).',
    'A system part binds { from } (its own system by default); a readout may read a field: bind: { from, field }.',
    SYSTEM_IDS.map((id) => `  ${id.padEnd(7)} ${SYSTEMS[id].about} · fields ${SYSTEMS[id].fields.join(', ')} · events ${SYSTEMS[id].events.join(', ')}${readers(id).length ? ` · read by ${readers(id).join(', ')}` : ''}`),
    'THE SHOOTER\'S IDIOMS, as parts: reticle (ring | cross | dot | chevron; layers core, assist, status, charge) at the',
    'aim, hitmarker, ammo (count | pips | bar | gauge), weapon (icon-name | loadout), lock and target over what you',
    'aim at (bind.of: \'target\'), damage arcs, the kill feed. The reticle stands in the centre by right; a hit must',
    'change its shape (hitmarker), not only its colour. The piloted runtime draws its own HUD today: these parts are',
    'designed on the board and reach the page when that HUD is drawn from parts.',
  );
}

function sharedCard() {
  return lines(
    'SHARED STATUS — whose value a part shows, and who may see it.',
    `  bind.of    ${OWNER_WORDS.join(' | ')} (default self). each:<tag> makes one part many: a nameplate over every`,
    '             player, a scoreboard row per player.',
    `  audience   ${AUDIENCES.join(' | ')} (default: as wide as the owner). Visibility is a game rule; the board draws`,
    '             a wireframe per view (player, spectator) with allies and enemies, so a leak shows before it is built.',
    `  mark       { ally, enemy }, each ${MARKS.join(' | ')}: an each part enemies also see tells mine from theirs in shape.`,
    'The bus is local and play data never enters mojulo: team and each parts are designed on the board; authority over',
    'shared state and the netcode are the exported engine\'s.',
  );
}

function paceCard() {
  return lines(
    `PACE — how the UI is read: ${PACES.join(' | ')} (play.ui.pace; default scan).`,
    PACES.map((p) => `  ${p.padEnd(7)} corner ${REGION_BUDGETS[p].corner} · edge ${REGION_BUDGETS[p].edge} · centre ${REGION_BUDGETS[p].center} standing`),
    'glance: a twitch game, read in peripheral vision. study: management screens and menus, read slowly, often paused;',
    'their density is the point and the centre may hold a panel. A game\'s menus are study screens reached from a glance game.',
  );
}

function borderCard() {
  return lines(
    'STYLIZED BORDER — art laid over a part\'s frame, composed from elements. play.ui.border: a flavor, or',
    '{ flavor?, elements?, tint? } (elements replace the flavor\'s; tint: false keeps the world\'s colours).',
    'FLAVORS (a set of elements plus the face, the dials and a tint that go with them):',
    FLAVOR_IDS.map((f) => `  ${f.padEnd(13)} ${BORDER_FLAVORS[f].about} · elements ${BORDER_FLAVORS[f].elements.join(', ')}`),
    'ELEMENTS (one per slot, except the stacking bg and shadow):',
    ELEMENT_IDS.map((e) => `  ${e.padEnd(10)} [${BORDER_ELEMENTS[e].slot}] ${BORDER_ELEMENTS[e].about}`),
    'Map the ask\'s words onto a flavor ("a spy-thriller codec look" → covert, "a giant-robot warning screen" →',
    'mech-cockpit), then tune elements. The art draws in the guide\'s tokens only; a flavor\'s tint is a token proposal.',
  );
}

function pixelCard() {
  return lines(
    `PIXELATED — a tuning beside the register, not on it. play.ui.pixel: ${PIXEL_SIZES.join(' | ')} (0 off; else the pixel size) or true (3).`,
    'No smoothing, hard edges, stepped corners, integer strokes, stepped bar fills, the mono face. Every border element',
    'draws at the pixel size. Stepped corners give way to elements that stand off the edge (brackets, tendrils, glow).',
  );
}

function partCard(id) {
  const P = PARTS[id];
  return lines(
    `${id.toUpperCase()} — ${P.about}.`,
    `variants: ${P.variants.join(', ')} · binds: ${P.bind === 'none' ? 'nothing' : P.bind.split('|').map((b) => `{ ${b} }`).join(' or ')} · rung ${P.rung}`,
    `states (drawn on the board): ${UI_STATES.join(', ')}`,
    `example: ${JSON.stringify(P.example)}`,
    P.page ? `lowers to: ${JSON.stringify(lowerParts([P.example])[0])}` : 'board only: designed and approved on the UI board; the page draws it once its renderer lands',
  );
}

let CARDS = null;
/** Every card, by id. */
export function playCards() {
  if (CARDS) return CARDS;
  const rows = [
    ['play-guide', 'Play guide', 'the ladder, the play block, how an ask becomes parts', 'first read for "make it interactive / playable / add UI"', guideCard()],
    ['ui-board', 'UI board', 'the approval gate: guide, motion, parts, layout, wireframes', 'before any UI is created', boardCard()],
    ['ui-register', 'Register', 'modern ↔ immersive, and the dials it moves', 'tuning how the UI looks', registerCard()],
    ['ui-motion', 'Motion', 'the UI\'s moves in frames', 'tuning how the UI moves', motionCard()],
    ['ui-layout', 'Layout', 'regions, layers, surfaces and the laws', 'placing parts', layoutCard()],
    ['ui-border', 'Stylized border', 'art over the frame: covert, futurepunk, mech-cockpit, cozy, or your own elements', 'a UI with a strong art style', borderCard()],
    ['ui-pixel', 'Pixelated', 'the pixel tuning', 'a pixel-art UI', pixelCard()],
    ['ui-systems', 'Systems', 'what the weapon, lock, body and match publish, and the shooter parts that read them', 'an FPS / action HUD: reticle, ammo, hitmarker, lock', systemsCard()],
    ['ui-shared', 'Shared status', 'whose value a part shows (of) and who may see it (audience)', 'multiplayer: nameplates, scoreboards, team status', sharedCard()],
    ['ui-pace', 'Pace', 'glance, scan or study: how densely the UI may be read', 'a twitch HUD vs a management screen', paceCard()],
    ...PART_IDS.map((p) => [`ui-part-${p}`, `Part: ${p}`, PARTS[p].about, `a ${p} on screen`, partCard(p)]),
  ];
  CARDS = new Map(rows.map(([id, name, summary, when, body]) => [id, { id, name, summary, when, body }]));
  return CARDS;
}

/** The ladder and the card rows: the drawer's no-argument read. */
export function playIndex() {
  return {
    ladder: PLAY_RUNGS.map(({ rung, name, makes, asks, built }) => ({ rung, name, makes, asks, built })),
    cards: [...playCards().values()].map(({ id, name, summary, when }) => ({ id, name, summary, when })),
    next: "Read 'play-guide' first; then get_play_vocab({ rung }) for what a rung admits, or ({ id }) for one card.",
  };
}

/** A rung's read. */
export function playRung(n) {
  const r = PLAY_RUNGS.find((x) => x.rung === n);
  if (!r) return null;
  const admitted = PLAY_RUNGS.filter((x) => x.rung <= n);
  const parts = PART_IDS.filter((p) => PARTS[p].rung <= n);
  return {
    rung: r.rung, name: r.name, makes: r.makes, built: r.built,
    admits: admitted.map((x) => x.name),
    parts: parts.map((p) => `ui-part-${p}`),
    cards: ['play-guide', 'ui-board', 'ui-register', 'ui-motion', 'ui-layout', 'ui-border', 'ui-pixel', 'ui-systems', 'ui-shared', 'ui-pace'],
    ...(r.built ? {} : { note: `rung ${n} (${r.name}) is not served yet; the parts listed draw today through play.parts and the board.` }),
  };
}
