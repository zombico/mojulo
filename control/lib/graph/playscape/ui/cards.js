/**
 * THE PLAY DRAWER's cards (get_play_vocab) — playscape served scaled to the ask: the ladder first (one line a rung),
 * a rung's set when the ask names one, one card in full by id. Generated from the registries beside them (PARTS,
 * DIALS, UI_MOTIONS, UI_LAWS, UI_ITEMS, CUE_WHEN, CUE_THEN), never written by hand, so a card cannot drift from what the build reads.
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
import { CUE_WHEN, CUE_THEN, SAY_AS, lowerCues, ANCHOR_REACH } from './cues.js';
import { SPOT_POSES } from './cast.js';
import { MENU_KINDS, MENU_IDS } from './menus.js';
import { LOOK_NAMES, LOOK_LAYERS } from '../elements/elements.js';
import { PUFFS } from '../elements/moments.js';
import { BEAM_NAMES, BEAM_LAYERS } from '../elements/beams.js';
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
    '  cues    the UI answering the game: when a happening, then an effect, until another (card \'ui-cues\')',
    '  menus   what comes up from a thing in the map: a sign, a talk, a shop, a chest (card \'ui-menus\')',
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

function cuesCard() {
  const ex = { parts: [{ part: 'readout', id: 'hp-bar', variant: 'bar', bind: { var: 'hp' }, max: 100 }], cues: [
    { id: 'door', when: { near: { at: [8, 3], r: 1.2 } }, then: { say: 'Press E to open', as: 'prompt' } },
    { id: 'low', when: { var: 'hp', lte: 25 }, then: { state: 'hp-bar', to: 'alert' }, until: { var: 'hp', gt: 25 } }] };
  return lines(
    'CUES — the UI answering the game, one primitive for every such moment (the pickup toast, the "press E" prompt, the',
    'area name, the low-health alert, the tutorial hint). play.cues: [{ id, when, then, until?, once? }].',
    'WHEN (one happening):',
    Object.entries(CUE_WHEN).map(([k, v]) => `  ${k.padEnd(6)} ${v}`),
    'THEN (one effect or a list):',
    Object.entries(CUE_THEN).map(([k, v]) => `  ${k.padEnd(6)} ${v}`),
    `  say as: ${SAY_AS.join(' | ')}; at: a region; ttl: seconds. show / hide / state name a part by its id (play.parts[i].id).`,
    'UNTIL: a happening or { ttl }; what came up goes down (a near ends on walking away). once: true fires it the first time.',
    `example: ${JSON.stringify(ex.cues)}`,
    'Each cue fires the bus event cue:<id>, so any part can bind { on: \'cue:<id>\' }. The words draw on the page today;',
    'show, hide, state and phase are set on the bus (ui-<part>, ui-<part>-state, phase) and drawn on the board until the',
    `page reads them. Lowered, the example adds ${Object.keys(lowerCues(ex)).join(', ')} to the world's events.`,
    'THE CAST (characters): down / gone / spawned / arrive / stuck are happenings; spawn, vanish, kill, hurt, heal, walk,',
    'stop are effects. A walk is a dumb path through places (straight lines, no pathfinding); a place is a spot\'s or an',
    `anchor's id or [x, y]. SPOTS are action points: play.spots: [{ id, at, face?, pose?: ${SPOT_POSES.join(' | ')} }]; a`,
    'walk ending on one takes its facing and pose. Spawn wakes one minted asleep (dormant: true). body.collide keeps',
    'bodies apart (walkers give way on the ground plane; body.heavy holds).',
  );
}

function menusCard() {
  return lines(
    'MENUS — what comes up when the figure does something in a map: a sign, a keeper, a shop counter, a chest, a bed,',
    'a save point, the map table. play.menus: [{ id, kind, title?, … }], one of a closed set of kinds:',
    MENU_IDS.map((k) => `  ${k.padEnd(8)} ${MENU_KINDS[k].about} · ${MENU_KINDS[k].fields}`),
    'OPENED BY A CUE from anything the map carries: when: { use: \'<spot or anchor>\', prompt: \'talk\' } (the figure stands',
    '  there and presses interact, E; the page shows the key and the word) or { near: { anchor: \'<id>\', r? } } (on approach),',
    '  then: { open: \'<menu>\' }. Either closes what it opened when the figure walks off.',
    `  Anchors are the map's own ids (a stage's rooms, doorways and things, a floormap's items, a trail's beats); r is`,
    `  metres round it (${ANCHOR_REACH}). A near closes what it opened when the figure walks away.`,
    'A talk\'s choices and a confirm\'s yes / no do cue effects (say, show, hide, state, phase, open, close, set, emit);',
    'picking one closes its menu unless it opens another. A choice with no then just closes it.',
    'NO LOOK OF ITS OWN: the world\'s UI guide (play.ui) dresses every menu as it dresses the parts; style keys are refused.',
    'The page draws them over the play and they answer the keys (arrows or W / S, Enter, Esc) and the pad; the figure waits.',
    `example: ${JSON.stringify([MENU_KINDS.talk.example, MENU_KINDS.shop.example])}`,
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

function elementsCard() {
  return lines(
    'STATUSES AND THEIR LOOKS — a status is a name you give ({ status: { who, is: \'poisoned\' } }); nothing is built into',
    'the name. Its LOOK is what the page draws on the body while it lasts, as it moves:',
    `  then: { status: { who, is, look?, for?, color? } } (look: a preset, a name in play.looks, or its layers; none: the look`,
    '  called is) · { lift: who | { who, is? } } · when: { faded: who | { who, is } } (it ran out or was lifted)',
    `  play.looks: { name: { ${LOOK_LAYERS.join(', ')} } } designs your own; color is '#rrggbb', [r, g, b] or a flame colorant`,
    'LAYERS: coat { k, hz, p, shape: breathe | grow | flash | flicker | hold, dark? } a fresnel rim, "this is happening now";',
    '  motes: one wave or a list; drift: one spray or a list; bolts { width, bright? } lightning (black: kokusen\'s flash;',
    '  bright: white-hot); fire { size: 1 licks, 3.5 engulfs, color } the',
    '  world\'s own fire; ice { mode: encase | spikes }; water {} drops that fall and ring out; steam {} vapour rising.',
    'A WAVE (every orbiting light): { count, trail, lag, cycle (s), turn (a cycle; 0 straight, < 0 the other way), r, z',
    '  (a number, or [from, to] over a cycle: in, out, up, down), arc, tilt (90: a ring), wobble [amp, per turn],',
    '  spread: even | random, env: steady | ends | in | out, tail, pulse, size, scatter [sx, sy, sz] (twinkling), color }',
    'A SPRAY (every thrown, blown or dropped particle: rain, snow, leaves, embers, sparks, dust): { glyph: dot | soft |',
    '  streak | drop | flake | leaf | spark | chip, count, from: point | ground | shell | cloud, r, z, v (m/s), el [lo, hi]',
    '  degrees, go [vx, vy, vz] (a wind), gravity (< 0 rises), swirl (turns/s round the body), life, grow, spin, size, env,',
    '  rings? (drops ring out where they land), color }',
    `PRESETS to start from (what they do, not what they mean): ${LOOK_NAMES.join(', ')}.`,
    `MOMENTS (once, then gone): { puff: who | { at: place, is: ${PUFFS.join(' | ')}, color?, shake?: 0..1 } } · { shake: k | { k, for? } } the camera.`,
    'VALUES FIRST: two looks a play uses should read apart with the colour taken out (laws: looks-apart); ?values greys the page.',
    `example: ${JSON.stringify({ looks: { cursed: { color: '#7a3cff', coat: { k: 0.7, hz: 0.4 }, motes: { count: 3, trail: 8, cycle: 4, turn: -2, r: [0.3, 1.2], z: [1.6, 0.2], env: 'ends' } } }, cues: [{ id: 'hex', when: { down: 'witch' }, then: { status: { who: 'hero', is: 'cursed', for: 20 } } }] })}`,
  );
}

function beamsCard() {
  return lines(
    'BEAMS AND ATTACKS — { beam: { who, to: who | place, is?, color? } } fires an attack from who\'s hand; when it lands on a',
    '  character, when: { struck: who } fires (hurt it, mark it, puff there). is: a preset, a name in play.beams, or its layers:',
    `  { ${BEAM_LAYERS.join(', ')} }`,
    'A STRAND is one function of time: { form: ray (grows to the target, holds, its tail runs after) | bolt (a body behind a',
    '  head, flying), speed, width, length, hold, head (× width), taper, pulse (hz), count, stagger, vary (barrage), bow (m:',
    '  each copy curves its own way and lands), arc (m up), wave [amp, per m] (a slither the body follows), twist (turns a',
    '  metre round the line at wave\'s amp: braids), phase, delay, edge: glow | ink | both, color }',
    'LAYERS: charge { time, size, at: hand | above } an orb gathering first; rings { every, size } shock rings on a ray;',
    `  sparks: a spray at every head; impact: a puff kind where it lands (${PUFFS.join(', ')}); shake: 0..1.`,
    `PRESETS (what they do): ${BEAM_NAMES.join(', ')}.`,
    'VALUES FIRST: a white core, a black ink edge (edge: ink | both), a coloured glow; ?values greys the page.',
    `example: ${JSON.stringify({ beams: { twin: { color: '#66ccff', charge: { time: 0.8, size: 0.3 }, strands: [{ form: 'ray', speed: 18, width: 0.15, twist: 0.5, wave: [0.4, 0] }, { form: 'ray', speed: 18, width: 0.15, twist: 0.5, wave: [0.4, 0], phase: 0.5, color: '#ff66cc' }], impact: 'flash' } }, cues: [{ id: 'fire', when: { use: 'altar' }, then: { beam: { who: 'hero', to: 'golem', is: 'twin' } } }, { id: 'hit', when: { struck: 'golem' }, then: { hurt: { who: 'golem', by: 30 } } }] })}`,
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
    ['ui-cues', 'Cues', 'the UI answering the game: when a happening, then an effect, until another', 'a prompt near a door, a pickup toast, an area name, a low-health alert, a hint', cuesCard()],
    ['ui-menus', 'Menus', 'what comes up from a thing in the map: read, talk, confirm, shop, chest, save, map, list', 'a sign to read, a shopkeeper, a chest, a bed, a save point', menusCard()],
    ['play-elements', 'Statuses and looks', 'a status is a name; its look (coat, orbiting lights, drifting particles, bolts, fire, ice, water, steam) is drawn on the body; moments (puffs, splashes, impacts, lightning, fireworks, shake) play once', 'a shield, a heal, poison, on fire, frozen, soaked, rained on, electrified, a black flash, an impact, a lightning strike, any status you design', elementsCard()],
    ['play-beams', 'Beams and attacks', 'an attack is strands (rays and bolts, one function of time each) fired from a hand, landing with struck', 'a ki wave, a fireball, a fire dragon, a death ball, a laser barrage, braided beams, any attack you design', beamsCard()],
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
    cards: ['play-guide', 'ui-board', 'ui-register', 'ui-motion', 'ui-layout', 'ui-border', 'ui-pixel', 'ui-systems', 'ui-shared', 'ui-cues', 'ui-menus', 'play-elements', 'play-beams', 'ui-pace'],
    ...(r.built ? {} : { note: `rung ${n} (${r.name}) is not served yet; the parts listed draw today through play.parts and the board.` }),
  };
}
