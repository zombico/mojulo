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
import { GEOCUBE_PRESETS } from './geocube.js';
import { HEARTBEAT_PRESETS } from './heartbeat.js';
import { GROUND_EDITS } from './out-ground.js';
import { NATURE_TRAIL } from './style/nature-trail.js';
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { ISEKAI_BAMBOO } from './style/isekai-bamboo.js';
import { ISEKAI_SAKURA } from './style/isekai-sakura.js';
import { ALIEN_NIGHT } from './style/alien-night.js';
import { AIRLESS_PLAIN } from './style/airless-plain.js';
import { ISEKAI_GARDEN } from './style/isekai-garden.js';

/** The bytes a kit, look or hub card's body may take: the infobox and a starter, never a manual. */
// raised from 3200 when the laws card took dare-height, motif-small and doodads-apart (one line each)
// 3600 -> 3800 (2026-10-14): a kit line for airless-plain (the airless world the color theorist's vacuum palettes
// asked for); the hub lists every kit by design
// 3800 -> 4000 (2026-10-16): the geocube card took the cube's `contrast` key and the valley-morning preset (one line
// each); the card was within 50 bytes of the old ceiling after the palette line
// 4000 -> 4600 (2026-10-17): the geocube card took its `outside` line (relief, ground and the land words mix, facet,
// valley had no line on the card) and the upland-morning preset; it stood at 3999 before them
// 4600 -> 4800 (2026-10-17): the geocube card took its `materials` line and contrast's `metal` term (look materials)
// 4800 -> 5000 (2026-10-17): the geocube card took `materials.age` and `outside.crystals` (level age and crystals);
// it stood at 4873 with them
// 5000 -> 5200 (2026-10-19): the geocube card took the city-night preset's line (the city stalker); it stands at 5074
// 5000 -> 5400 (2026-10-20): the geocube card took its `avoid` line and the theatre-grey and painted-haze presets (painted-haze since replaced by limestone-crags)
// (geocube styles); it stood at 5388 with them
// 5400 -> 5450 (2026-10-21): limestone-crags, the first terrain past the sixth generation, replaced painted-haze with a
// longer reading and a third avoid line
// 5450 -> 5650 (2026-10-22): the geocube card's register line names the colour registers (cel, ink-wash, wii) and the
// register-ink law; it stands at 5602 with them
// 5650 -> 5800 (2026-10-25): the two lines merged, the city stalker's city-night beside geocube styles' theatre-grey and
// limestone-crags; it stands at 5729 with all three
export const STAGE_CARD_BODY_CEILING = 5800;

// the open-ground kits name their style card by id (kit.style); the room kits carry theirs as `dress`
const GROUND_STYLES = Object.fromEntries([NATURE_TRAIL, JUNGLE_MGS3, ISEKAI_MEADOW, ISEKAI_BAMBOO, ISEKAI_SAKURA, ALIEN_NIGHT, AIRLESS_PLAIN, ISEKAI_GARDEN].map((s) => [s.id, s]));
const ROOM_SHELLS = new Set([undefined, 'nave', 'plaza', 'lab', 'bay']);

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
  // a corridor opening into a tall bay: the passage pressing in, then the bay with its crane and catwalk
  ...Object.fromEntries(['military', 'utility', 'science'].map((r) => [`bay-${r}`, { rooms: [{ id: 'corridor', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'bay', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'corridor', to: 'bay' }] }])),
};

/** How people ask for each kit, in plain words: the search line leads with these. */
const KIT_WORDS = {
  'gothic-stone': ['castle interior', 'torch-lit stone halls', 'stone dungeon rooms'],
  catacomb: ['catacombs', 'ossuary', 'underground burial galleries'],
  'gothic-nave': ['cathedral', 'church nave', 'stained glass hall'],
  'island-plaza': ['sunny town square', 'mediterranean plaza', 'fountain square'],
  'research-lab': ['sci-fi lab', 'research base', 'industrial facility interior'],
  'bay-military': ['military hangar', 'armoury or bunker', 'steel-plated base interior'],
  'bay-utility': ['warehouse', 'industrial depot', 'plant room'],
  'bay-science': ['clean lab', 'white research facility', 'control room'],
  'trail-valley': ['mountain trail', 'valley path', 'cliffside walk'],
  'jungle-trail': ['dense jungle', 'rainforest path', 'misty jungle'],
  'isekai-meadow': ['anime meadow', 'fantasy grassland', 'open field'],
  'isekai-bamboo': ['bamboo grove', 'bamboo forest'],
  'isekai-sakura': ['cherry blossom grove', 'sakura trees'],
  'alien-night': ['alien planet at night', 'bioluminescent landscape', 'night alien world'],
  'airless-plain': ['moon surface', 'cratered asteroid', 'airless world under the stars'],
  'isekai-garden': ['flower garden', 'ikebana garden', 'garden path in bloom'],
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
    `SHELL      ${isRooms(kit) ? `rooms: axis-aligned boxes on a ${kit.grid} m grid, bays every ${kit.bay} m, a doorway where two rooms share a wall${kit.shell === 'plaza' ? '' : '; "storey" stacks a room over the storey below, a link across two a stair (card game-building)'}` : 'open ground: no rooms, the builder lays the site (trail, cliff, planting) from its style card'}`,
    `LOOK       ${ref ? `pairs with '${ref}' (card 'look/${ref}'); any look can be set with "reference"` : isRooms(kit) ? `none pairs with it; "reference" sets the look (default gothic-night)` : 'its own: the style card carries the light and air'}`,
    `OPTIONS    ${opts.length ? opts.join(' · ') : 'none beyond the kit'}`,
    ...(ART_KITS.includes(kitId) ? ['ART        "art": "propose" (a board to approve, item by item) or "auto" (hands off); card \'stage\''] : []),
    ...(['nature', 'isekai'].includes(kit.shell) ? ['TRAIL      "trail": { "run"?: 12–25 s, "heartbeat"?: 0–1, "bumpiness"?: 0–1, "beats"?: [pinch|reveal|landmark|crossing|pocket|rest|pit] } builds the trail from the grammar: its beats, hazards and stairs sites annotated, its laws measured; "after" the trail it follows; "bounds" its outer wall per side (wall, natural, paint, mirror with offset and stutter, penalty, open); card \'stage\''] : []),
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
    'GEOCUBE FIRST  forge the look as a cube (card geocube), then build here on it ("geocube").', '',
    'RECIPE     { "kind": "stage", "kit", "reference"?, "rooms": [{ "id", "x", "y", "w", "d", "h", "open"? }], "links"?: [{ "from", "to" }], "program"?: { "use" }, "level"?: {} (card game-building), … }; rooms: room kits',
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

/** The geocube: one style for a level's inside and outside, forged and checked before the level is built. */
export function geocubeCard() {
  const P = GEOCUBE_PRESETS;
  const lines = [
    '# Geocube: a level\'s look, forged first', '',
    'A cube is the core look of a level as data: its light, its key colours, its register, its surfaces\' patterns, the bones of its inside, the base of its outside and its principles. Both sides are lowered from the one cube, so the hall and the land cannot clash. Forge the cube, look at its two specimens, change the cube until both read right, then build the level on it.', '',
    'FORGE      create_sketch { "kind": "geocube", "cube": <preset id | document | { "from": <preset>, …changes }>, "show": "room" | "land" }',
    '           room: the bare bones in the cube\'s light, its accent wall. land: an island (a cliff side and a beach side) lit by polygons, no texture on the rock.',
    'UPDATE     update_sketch the cube; both specimens re-lower from it. Show the other with "show".',
    'BUILD ON   a stage recipe with "geocube": the same cube. Without "meru": the inside (the cube\'s bones, reference, tone and tiles; your rooms, the kit\'s dress). With "meru": the outside (its look card, land ramps, light, air and polygon land; your tiers over the cube\'s). Your keys win: vary the cube, never restyle it. A level copies its cube: a changed or new cube rebuilds nothing; re-create the level from it by hand.', '',
    'BUILDINGS  a cube recommends its buildings: "buildings": { anchor, uses: [{ use, enter: "door" | "walk" }] }. A stage on the cube with "program": { "use" } lays one in its bones, its anchor setting the heights (card game-building).', '',
    'THE CUBE',
    '  light     { reference (a look id), moon? { color, elevation, azimuth, gain } (a look with no sun needs it), outsideFog? (× the reference\'s fog), shadows? (the stage\'s, below), sky? { zenith, horizon, fog? } (the outside\'s; the reference\'s dome where none) }',
    '  colour    { stone, floor, trim, accent, grass, foliage, water, sand?: "#rrggbb"; shade?: hue degrees the dark ends lean to (222, blue) }',
    '  register  { steps (0 … 8 bands), key (0..1) } or a name: cel (bands, outline, crisp creases), ink-wash, wii, continuous; { from, …changes } (outline?, creases?, contrast?). Inked by the theorist; a world\'s own creases win (card creases)',
    '  contrast? "wii" | { from?, hemi, foot, crevice, ridge, contact, warmCool, variation, metal } | false: Wii-era shading in the vertex (metal: metal takes the occlusion too)',
    '  materials? true | { age?, <group>: <material> }: what its people wear is made of (plate as worked steel, kanamono as gold, leather); age new | worn | old | ancient tarnishes bronze to verdigris, blackens steel; cloth and leather painted (a group may name silk, velvet, wool, denim …); a hero takes it through its geocube',
    '  palette   a pick_palette spec: the color theorist decides the colours, seeded where the cube is stored (a preset\'s character with it); the solve writes colour, shade, register.key, the moon and light.sky. A colour you write is a lock; trim, water and sand stay as written. false: as written. A gameworld\'s style.palette is its levels\' cubes\', and a world on a cube alone takes the cube\'s for its HUD.',
    '  avoid?    [{ line, law }]: the mistakes the style names, each measured by a law as the cube is read (a pick_palette law, quiet-surfaces, or register-ink) and written back as ok, value. Advice, never a refusal.',
    '  surfaces  { wall, floor, accent: tile specs (card stage-rails) }',
    '  inside    { bones (a room kit), size? [w, d, h], accentWall? "+x" | "-x" | "+y" | "-y" }',
    '  outside   { base (an isekai card), tiers, island, land (LAND RULES), relief? rolling | craggy | eroded | terraced | dune | { from, … }, ground? { from: <painted-landscape: heartbeat, splatch, seed>, span (m; 40–60 reads at a level\'s scale), height (m) }, crystals? <gem> | { gem, where: crags | hollows, count, size (m), glow }, terrain?, terrains? }',
     'SHADOWS    the inside\'s: { torch: "off" | "hard" | "soft", sun: soft edge degrees, cells: metres }; a cube gives hard torch shadows, a 1.5° sun and half-metre cells. Any stage can take them.',
    'LAND RULES polygon only, from the land\'s shape: crevice darkens what is concave toward the cube\'s shade colour (never black); ridge lifts a convex lip; blend carries a neighbouring surface\'s colour over a seam. Rock takes no pixels. Opt-in: mix (m) surfaces mixed per corner, facet (m) rock in planes, valley (0..1) hollows darken.', '',
    'PRESETS', ...Object.values(P).map((c) => `  - ${c.id}: ${c.reads}; ${c.light.reference} light, ${c.inside.bones} bones, ${c.outside.base} land`), '',
    'PAINT A LEVEL a level\'s geocube (a gameworld level\'s style.geocube) paints every section once, trails and climbs, on one terrain: the level\'s terrain if it names one, else its heartbeat\'s if the cube has it, else the cube\'s own. Each stage answers `painted` (the terrain, from whom, what was offered). A section\'s own kit wins: a start, not a lock.',
    'THE LAND\'S FLOW is not the cube\'s: how the ground climbs, dips and breaks is a heartbeat (card heartbeat), a greybox the cube paints.',
  ];
  return {
    id: 'geocube', name: 'Geocube (a level\'s look, forged first)', family: 'world', entry: 'create_sketch', generated: true,
    summary: 'One style for a level\'s inside and outside: forge the cube, check its room and island specimens, then build the level on it.',
    when: '"geocube", "the look of my level", "style guide for a level", "make the inside and outside match", "a level with its own style", "test the lighting first", "island specimen", "room specimen", "a Wii-era look", "vertex colour contrast", "a cel-shaded look", "toon outline on my level", "inked like a drawing"',
    body: lines.join('\n'),
  };
}

/** The heartbeat: the ripples and flow of a level's land, apart from its look; a greybox shared between levels. */
export function heartbeatCard() {
  const lines = [
    '# Heartbeat: the flow of a level\'s land, as a greybox', '',
    'A heartbeat is how a level\'s ground moves, apart from what it looks like: how hard the walk climbs and drops, the long swell from trailhead to end, and the few marks that make the place (a cliff, a gorge, a knoll). It holds no colour and no kit; it is seen in values, and a level paints it with its kit, style or geocube. Its places are relative to the level and its heights are metres, so one heartbeat on a longer level, another kit or seed is the same ground to walk, never the same bytes.', '',
    'FORGE      create_sketch { "kind": "heartbeat", "heartbeat": <preset id | document | { "from": <preset>, …changes }>, "on"?: { kit?, runs?: [16, 16], seed? } }',
    '           the greybox on a reference level, walkable: the walk a shade lighter, a face too steep to walk a shade darker; the answer carries its map.',
    'LAY        a gameworld level\'s ground.heartbeat (tune_ground { ref, heartbeat: <preset | document | a heartbeat sketch\'s ref> }): its pulse under the level\'s tune, its rise and marks before the level\'s edits.',
    'SHARE      tune_ground { ref, export: { id, title?, reads?, save?: <ref> } }: the level\'s ground (its heartbeat, tune, rise and edits) as one heartbeat, saved as a sketch to clone from.', '',
    'THE HEARTBEAT',
    '  pulse     the dials every trail takes: amplitude, depth (metres), grade, drift, bump { height, scale, walk }, shapes { reveal | landmark | pinch | crossing: { share, reach } }, cliff { height, face }',
    '  rise      [[v, metres], …]: the swell along the walk, v 0 (the trailhead) … 1 (the end); the walk rises with it',
    '  marks     edits at [u, v] (u 0 the far side … 1 the open side) or along [[u, v], …]; a cliff\'s high side by high: [u, v]. Heights and widths in metres.',
    ...Object.entries(GROUND_EDITS).filter(([k]) => k !== 'rise').map(([k, v]) => `            ${k.padEnd(8)} ${v}`),
    '  why       [principles, one line each]',
    '  terrain   the geocube terrain it was made for: a painted level gets it when its cube has it and the level names none; an export remembers the terrain it was made on', '',
    'PRESETS', ...Object.values(HEARTBEAT_PRESETS).map((h) => `  - ${h.id}: ${h.reads}`),
  ];
  return {
    id: 'heartbeat', name: 'Heartbeat (the flow of a level\'s land, a greybox)', family: 'world', entry: 'create_sketch', generated: true,
    summary: 'How a level\'s ground climbs, dips and breaks, apart from its look: forge it as a greybox, lay it on levels, share and clone it.',
    when: '"heartbeat", "the shape of my level\'s land", "greybox the terrain", "the same terrain feel on another level", "clone this level\'s ground", "a level that climbs the whole way", "share my terrain"',
    body: lines.join('\n'),
  };
}

/** Every generated card: the hub, the geocube, the laws, the rails, each kit, each look. */
export function stageEntryCards() {
  return [stageHubCard(), geocubeCard(), heartbeatCard(), lawsCard(), railsCard(), ...Object.keys(STAGE_KITS).map(kitCard), ...SIXTH_GEN_LOOK_IDS.map(lookCard)];
}
