/**
 * entries — the sixth-gen stage as view-vocab cards (family `world`), generated from the kit, style and reference
 * cards at catalog load. Never written by hand, so a card cannot drift from what the stage draws, and a kit or a
 * reference is findable the day it lands. Before these, the kit list lived only in planStage's refusal.
 *
 * Three kinds of card, so the agent reads only as deep as the ask:
 *  - the HUB (`stage`): what a stage recipe holds, every kit and every look on one line each;
 *  - a KIT (`stage/<kit>`): its shell, the look it pairs with, the options its style card carries, its principles
 *    and a STARTER manifest to copy and change;
 *  - a LOOK (`look/<look>`): a look's palette, light and air in plain words, and the kit it pairs with (or that none
 *    is built yet). A look is read by the stage kind only today, through `reference`.
 *
 * No card names a game, a studio or a console: the reference cards keep that research record, and a card describes
 * what each look and kit offers so the agent can match an ask to it on its own.
 */
import { ART_KITS } from './art-direction.js';
import { STAGE_KITS, STAGE_KIT_PROPORTIONS } from './stage.js';
import { SIXTH_GEN, SIXTH_GEN_REFERENCES, SIXTH_GEN_LOOKS, SIXTH_GEN_LOOK_IDS } from './sixth-gen.js';
import { LAYERS, LAWS, PRINCIPLE_LAWS, lawLedger, statedPrinciples } from './laws.js';
import { TILE_RAILS, PROPORTION_RAILS } from './tile-specs.js';
import { NATURE_TRAIL } from './style/nature-trail.js';
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { ISEKAI_BAMBOO } from './style/isekai-bamboo.js';
import { ISEKAI_SAKURA } from './style/isekai-sakura.js';

/** The bytes a kit, look or hub card's body may take: the infobox and a starter, never a manual. */
// raised from 3200 when the laws card took dare-height, motif-small and doodads-apart (one line each)
export const STAGE_CARD_BODY_CEILING = 3600;

// the open-ground kits name their style card by id (kit.style); the room kits carry theirs as `dress`
const GROUND_STYLES = Object.fromEntries([NATURE_TRAIL, JUNGLE_MGS3, ISEKAI_MEADOW, ISEKAI_BAMBOO, ISEKAI_SAKURA].map((s) => [s.id, s]));
const ROOM_SHELLS = new Set([undefined, 'nave', 'plaza', 'lab']);

/** A recipe each kit is known to build (the shapes its own tests mint); an open-ground kit needs only its id. */
const KIT_STARTERS = {
  // six rooms in a chain that turns back on itself: the walk ends at the tomb, beside where it began
  'gothic-stone': { rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 20, h: 9 }, { id: 'gallery', x: 12, y: 6, w: 10, d: 8, h: 5 }, { id: 'passage', x: 22, y: 8, w: 10, d: 4, h: 4 },
    { id: 'charnel', x: 32, y: 2, w: 10, d: 16, h: 6 }, { id: 'chapel', x: 26, y: 18, w: 16, d: 8, h: 5 }, { id: 'sepulchre', x: 14, y: 18, w: 12, d: 12, h: 7 }],
  links: [{ from: 'nave', to: 'gallery' }, { from: 'gallery', to: 'passage' }, { from: 'passage', to: 'charnel' }, { from: 'charnel', to: 'chapel' }, { from: 'chapel', to: 'sepulchre' }], fire: true },
  // long low galleries between small chambers, the last the ossuary chapel with the sarcophagus
  catacomb: { rooms: [{ id: 'stair', x: 0, y: 0, w: 8, d: 8, h: 6 }, { id: 'gallery-a', x: 8, y: 2, w: 16, d: 4, h: 4 }, { id: 'cubiculum', x: 24, y: 0, w: 8, d: 8, h: 4.5 },
    { id: 'gallery-b', x: 26, y: 8, w: 4, d: 14, h: 4 }, { id: 'crossing', x: 22, y: 22, w: 12, d: 10, h: 6 }, { id: 'ossuary', x: 10, y: 22, w: 12, d: 10, h: 6.5 }],
  links: [{ from: 'stair', to: 'gallery-a' }, { from: 'gallery-a', to: 'cubiculum' }, { from: 'cubiculum', to: 'gallery-b' }, { from: 'gallery-b', to: 'crossing' }, { from: 'crossing', to: 'ossuary' }], fire: true },
  'gothic-nave': { rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13 }] },
  'island-plaza': { rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12, open: ['-y', '+x'] }] },
  'research-lab': { rooms: [{ id: 'lab', x: 0, y: 0, w: 16, d: 24, h: 9 }] },
};

/** How people ask for each kit, in plain words: the search line leads with these. */
const KIT_WORDS = {
  'gothic-stone': ['castle interior', 'torch-lit stone halls', 'stone dungeon rooms'],
  catacomb: ['catacombs', 'ossuary', 'underground burial galleries'],
  'gothic-nave': ['cathedral', 'church nave', 'stained glass hall'],
  'island-plaza': ['sunny town square', 'mediterranean plaza', 'fountain square'],
  'research-lab': ['sci-fi lab', 'research base', 'industrial facility interior'],
  'trail-valley': ['mountain trail', 'valley path', 'cliffside walk'],
  'jungle-trail': ['dense jungle', 'rainforest path', 'misty jungle'],
  'isekai-meadow': ['anime meadow', 'fantasy grassland', 'open field'],
  'isekai-bamboo': ['bamboo grove', 'bamboo forest'],
  'isekai-sakura': ['cherry blossom grove', 'sakura trees'],
};

// a caption cut at a word boundary, for the hub's one line per kit
const clip = (t, n = 110) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(' ', n - 1))} …`);
const title = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const styleOf = (kit) => kit.dress || GROUND_STYLES[kit.style] || null;
// the look that pairs with a kit (its reference card names the kit), by look id
const refFor = (kitId) => SIXTH_GEN_LOOK_IDS.find((l) => SIXTH_GEN_REFERENCES[SIXTH_GEN_LOOKS[l]].kit === kitId) || null;
const lookRef = (lookId) => SIXTH_GEN_REFERENCES[SIXTH_GEN_LOOKS[lookId]];
const ERA = `the sixth console generation (around 2000 to 2006): seen at ${SIXTH_GEN.frame.width}×${SIXTH_GEN.frame.height}, world light baked into the vertices`;
const isRooms = (kit) => ROOM_SHELLS.has(kit.shell);
const kitIdOf = (kit) => Object.keys(STAGE_KITS).find((k) => STAGE_KITS[k] === kit);
// the laws a kit's style card states (its own principles, its night's and its decay's), look layer first
const kitLaws = (kit) => {
  const S = styleOf(kit);
  if (!S) return [];
  const rows = Object.entries(PRINCIPLE_LAWS).filter(([k]) => k === S.id || k.startsWith(`${S.id}/`)).flatMap(([, r]) => r.flat());
  return [...new Set(rows)].filter((l) => l !== 'kit-dressing').sort((a, b) => LAYERS.indexOf(LAWS[a].layer) - LAYERS.indexOf(LAWS[b].layer));
};

/** What a kit's own cards let a recipe switch on (each is refused by a kit that lacks it). */
function kitOptions(kit) {
  const S = styleOf(kit) || {}, out = [];
  if (S.night && kit.sun) out.push(`"time": "night" (its style card's moon and air)`);
  if (S.decay) out.push(`"decay": { … } (blackout, abandonment: picks are seeded)`);
  if (S.sway) out.push(`"wind": { … } (its hung cloth and leaves swing)`);
  if (S.fire) out.push(`"fire": true (braziers by the portal light the room)`);
  if (kit.shell === 'plaza' || kit.shell === 'lab') out.push(`"water": true`);
  if (isRooms(kit)) out.push(`"lights": "auto" | [{ "at": [x, y, z], … }]`, `"dirt": { "age", "damp", "soot", "traffic", "seed" }`, `"doors"`, `"items"`,
    `"tiles": { ${Object.keys(kit.tiles).join(' | ')}: { "gen", … } }`, `"proportions": { ${(STAGE_KIT_PROPORTIONS[kitIdOf(kit)] || []).join(' | ')} } (ranges: card 'stage-rails')`);
  return out;
}

/** The kit's one-line caption: its style card's first principle, or the kit's own shell where it carries none. */
function kitSummary(kitId, kit) {
  const S = styleOf(kit);
  if (S?.principles?.length) return S.principles[0];
  return `Grid rooms in dressed stone: plinth, cornice and pilasters on every wall, ribs across the ceiling, a torch on every other pilaster.`;
}

export function starter(kitId) {
  const ref = refFor(kitId);
  return { kind: 'stage', ...(ref ? { reference: ref } : {}), kit: kitId, ...(KIT_STARTERS[kitId] || {}) };
}

/** One kit's card. */
export function kitCard(kitId) {
  const kit = STAGE_KITS[kitId], S = styleOf(kit), ref = refFor(kitId), opts = kitOptions(kit);
  const lines = [
    `# ${title(kitId)} (stage kit)`, '', kitSummary(kitId, kit), '',
    `SHELL      ${isRooms(kit) ? `rooms: axis-aligned boxes on a ${kit.grid} m grid, bays every ${kit.bay} m, a doorway where two rooms share a wall` : 'open ground: no rooms, the builder lays the site (trail, cliff, planting) from its style card'}`,
    `LOOK       ${ref ? `pairs with '${ref}' (card 'look/${ref}'); any look can be set with "reference"` : isRooms(kit) ? `none pairs with it; "reference" sets the look (default gothic-night)` : 'its own: the style card carries the light and air'}`,
    `OPTIONS    ${opts.length ? opts.join(' · ') : 'none beyond the kit'}`,
    ...(ART_KITS.includes(kitId) ? ['ART        "art": "propose" (a board to approve, item by item) or "auto" (hands off); card \'stage\''] : []),
    ...(['nature', 'isekai'].includes(kit.shell) ? ['TRAIL      "trail": { "run"?: 12–25 s, "heartbeat"?: 0–1, "bumpiness"?: 0–1, "beats"?: [pinch|reveal|landmark|crossing|pocket|rest|pit] } builds the trail from the grammar: its beats, hazards and stairs sites annotated, its laws measured; card \'stage\''] : []),
    `ERA        ${ERA}`,
    ...(kitLaws(kit).length ? [`LAWS       ${kitLaws(kit).join(', ')} (card 'sixth-gen-laws')`] : []),
  ];
  if (S?.principles?.length) lines.push('', `PRINCIPLES (its style card: each machine-checked; the eyes gate is the operator's)`, ...S.principles.slice(0, 5).map((p) => `  - ${p}`), ...(S.principles.length > 5 ? [`  … ${S.principles.length - 5} more on the style card`] : []));
  lines.push('', 'STARTER (a manifest: copy it, change it, mint it)', `  ${JSON.stringify(starter(kitId))}`);
  let body = lines.join('\n');
  if (body.length > STAGE_CARD_BODY_CEILING) body = `${body.slice(0, body.lastIndexOf('\n  - ', STAGE_CARD_BODY_CEILING - 400))}\n  … (the rest is on the style card)\n\nSTARTER\n  ${JSON.stringify(starter(kitId))}`;
  return {
    id: `stage/${kitId}`, name: `${title(kitId)} (stage kit)`, family: 'world', entry: 'create_sketch', generated: true,
    summary: kitSummary(kitId, kit),
    when: [title(kitId).toLowerCase(), ...(KIT_WORDS[kitId] || []), ...(ref ? [lookRef(ref).setting] : []), isRooms(kit) ? 'level rooms' : 'outdoor level', 'sixth-gen level', 'early 2000s 3d level'].map((w) => `"${w}"`).join(', '),
    body,
  };
}

/** One look's card. */
export function lookCard(lookId) {
  const R = lookRef(lookId), built = !!STAGE_KITS[R.kit], words = title(lookId);
  const placed = R.light.placed.length ? R.light.placed.join(', ') : 'none';
  const lines = [
    `# ${words}: a look`, '',
    `A sixth-gen look for a ${R.setting}. Palette, light and air are starting points, tuned at the eyes gate.`, '',
    `PALETTE    base ${R.palette.base}, accent ${R.palette.accent}, warm ${R.palette.warm}`,
    `LIGHT      ambient ${R.light.ambient}; ${R.light.key ? `key ${R.light.key.color} at ${R.light.key.elevation}° elevation` : 'no sun: placed lights only'}; placed: ${placed}; contrast ${R.light.contrast}`,
    `AIR        fog ${R.air.fog.color} at density ${R.air.fog.density}; sky ${R.air.sky}`,
    `SURFACES   ${R.surfaces.join(', ')}`,
    `KIT        ${built ? `'${R.kit}' (card 'stage/${R.kit}')` : `'${R.kit}' is named but not built yet: set this look on another kit`}`,
    '',
    `USE        a stage recipe's "reference": "${lookId}". Today only the stage kind reads a look.`,
    '', 'STARTER', `  ${JSON.stringify({ kind: 'stage', reference: lookId, kit: built ? R.kit : 'gothic-stone', ...(KIT_STARTERS[built ? R.kit : 'gothic-stone'] || {}) })}`,
  ];
  return {
    id: `look/${lookId}`, name: `${words}: a look`, family: 'world', entry: 'create_sketch', generated: true,
    summary: `${words} (${R.setting}): ${R.light.contrast} contrast, ${R.air.sky} sky, ${R.surfaces.slice(0, 3).join(', ')}.`,
    when: [words.toLowerCase(), R.setting, R.air.sky.replace('-', ' '), ...R.surfaces.slice(0, 3).map((x) => x.replace('-', ' ')), 'sixth-gen look', 'art direction', 'mood lighting'].map((w) => `"${w}"`).join(', '),
    body: lines.join('\n'),
  };
}

/** The hub: what a stage recipe holds, and every kit and look on one line. */
export function stageHubCard() {
  const kits = Object.keys(STAGE_KITS), looks = SIXTH_GEN_LOOK_IDS;
  const missing = looks.filter((l) => !STAGE_KITS[lookRef(l).kit]);
  const lines = [
    '# Stage: a level built the sixth-gen way', '',
    `Kit pieces on a grid, small painted tiles multiplied by baked vertex light, lights placed by hand. ${kits.length} kits dress it; ${looks.length} looks light it. Open the kit or look card the ask names; the laws every kit was built on are on card 'sixth-gen-laws'.`, '',
    'RECIPE     { "kind": "stage", "kit", "reference"?, "rooms": [{ "id", "x", "y", "w", "d", "h", "open"? }], "links"?: [{ "from", "to" }], … } — rooms only for a room kit; an open-ground kit takes none',
    '', `ART FIRST (room kits ${ART_KITS.join(', ')})  "art": "propose" mints with a direction (palette, materials, architecture, motifs, plan) and answers with its board as an image: show it, then per item update_sketch patch /art/status/<item> "approved", or /art/<item> "reroll". "art": "auto" is hands off.`,
    '', `OUT-TRAIL (open ground: ${kits.filter((k) => ['nature', 'isekai'].includes(STAGE_KITS[k].shell)).join(', ')})  "trail": true or { run, heartbeat, bumpiness, beats } builds the trail from principles: a spine run in "run" seconds (12, the meadow\'s 72 m, by default), beats along it, its height by "heartbeat", its ground by "bumpiness". The answer carries outTrail (its laws, measured) and anchors (every beat and hazard); the landform board shows the land in black and white before anything grows on it.`,
    '', 'KITS (card stage/<id>)', ...kits.map((k) => `  - ${k}: ${isRooms(STAGE_KITS[k]) ? 'rooms' : 'open ground'}. ${clip(kitSummary(k, STAGE_KITS[k]))}`),
    '', 'LOOKS (card look/<id>, set as "reference")', ...looks.map((l) => `  - ${l}: ${lookRef(l).setting}; ${lookRef(l).light.contrast} contrast, ${lookRef(l).air.sky} sky`),
    ...(missing.length ? ['', `Named, not built: the kits for ${missing.map((l) => `${l} ('${lookRef(l).kit}')`).join(', ')}. Their looks still apply to a built kit.`] : []),
  ];
  return {
    id: 'stage', name: 'Stage (sixth-gen level)', family: 'world', entry: 'create_sketch', generated: true,
    summary: 'A level built the sixth-gen way: grid rooms or open ground dressed by a kit, lit by a look.',
    when: '"sixth-gen level", "early 2000s 3d level", "level rooms", "dungeon rooms", "stage kit", "art direction", "retro 3d level"',
    body: lines.join('\n'),
  };
}

const LAYER_TEXT = {
  look: 'LOOK (light, value, palette, air, sky: a look carries these to any scene)',
  surface: 'SURFACE (what a scene\'s surfaces must be built to take)',
  composition: 'COMPOSITION (where things go: plan the scene by these)',
  dressing: 'DRESSING (a kit\'s own set pieces)',
};

/** The laws card: what every sixth-gen template was built on, by layer, each with how many principles state it. */
export function lawsCard() {
  const ledger = lawLedger(), total = Object.values(statedPrinciples()).flat().length;
  const lines = ['# Sixth-gen laws', '',
    `The ${total} principles the stage kits were built on, counted into shared laws. Apply them when building in this look anywhere, not only on a stage. Each count is how many principles state the law; "era" marks one the era carries on its own.`];
  for (const layer of LAYERS) {
    lines.push('', LAYER_TEXT[layer]);
    for (const [id, L] of Object.entries(ledger)) if (L.layer === layer) lines.push(`  - ${id} (${L.stated.length}${L.era ? ', era' : ''}): ${L.law}`);
  }
  return {
    id: 'sixth-gen-laws', name: 'Sixth-gen laws', family: 'world', entry: 'create_sketch', generated: true,
    summary: `The principles behind every sixth-gen template, counted into laws by layer: look, surface, composition, dressing.`,
    when: '"art principles", "art direction rules", "sixth-gen look", "why it looks retro", "baked vertex light", "value order", "early 2000s 3d style"',
    body: lines.join('\n'),
  };
}

const railText = (r) => (r.rgb ? '[r, g, b]' : r.of ? r.of.join(' | ') : `${r.lo}–${r.hi}${r.int ? ' (integer)' : ''}`);

/** The rails card: every setting a recipe may give a room kit's tiles and proportions, with its range. */
export function railsCard() {
  const lines = ['# Stage rails: tiles and proportions', '',
    'A room kit\'s recipe may paint its own tiles and set its own proportions, inside these ranges; anything outside is refused with the range. The tiles are named from their numbers and rebuilt from the recipe on every read, so any number can be edited later.', '',
    'TILES  "tiles": { <surface>: { "gen", …settings, "scale"? (metres per repeat, 0.25–8) } }'];
  for (const [gen, R] of Object.entries(TILE_RAILS)) lines.push(`  ${gen} (needs ${R.required.join(', ')}): ${Object.entries(R.keys).map(([k, r]) => `${k} ${railText(r)}`).join('; ')}`);
  lines.push('', 'PROPORTIONS  "proportions": { <part>: { <number> } }, only the parts the kit has');
  for (const [part, r] of Object.entries(PROPORTION_RAILS)) lines.push(`  ${part}: ${r.lo !== undefined ? railText(r) : Object.entries(r).map(([k, rr]) => `${k} ${railText(rr)}`).join('; ')}`);
  return {
    id: 'stage-rails', name: 'Stage rails: tiles and proportions', family: 'world', entry: 'create_sketch', generated: true,
    summary: 'The settings a stage recipe may give its own tiles (brick, flagstone, rock) and proportions (columns, plinths, bays, doors), each with its range.',
    when: '"custom bricks", "stone colour", "brick pattern", "floor tiles", "column size", "thicker columns", "procedural texture", "vary the stonework"',
    body: lines.join('\n'),
  };
}

/** Every generated card: the hub, the laws, the rails, each kit, each look. */
export function stageEntryCards() {
  return [stageHubCard(), lawsCard(), railsCard(), ...Object.keys(STAGE_KITS).map(kitCard), ...SIXTH_GEN_LOOK_IDS.map(lookCard)];
}
