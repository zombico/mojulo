/**
 * entries — the sixth-gen stage as view-vocab cards (family `world`), generated from the kit, style and reference
 * cards at catalog load. Never written by hand, so a card cannot drift from what the stage draws, and a kit or a
 * reference is findable the day it lands. Before these, the kit list lived only in planStage's refusal.
 *
 * Three kinds of card, so the agent reads only as deep as the ask:
 *  - the HUB (`stage`): what a stage recipe holds, every kit and every look on one line each;
 *  - a KIT (`stage/<kit>`): its shell, the look it pairs with, the options its style card carries, its principles
 *    and a STARTER manifest to copy and change;
 *  - a LOOK (`look/<reference>`): a reference title's palette, light and air, and the kit it names (or that none is
 *    built yet). A look is read by the stage kind only today, through `reference`.
 */
import { STAGE_KITS } from './stage.js';
import { SIXTH_GEN, SIXTH_GEN_REFERENCES } from './sixth-gen.js';
import { NATURE_TRAIL } from './style/nature-trail.js';
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { ISEKAI_BAMBOO } from './style/isekai-bamboo.js';
import { ISEKAI_SAKURA } from './style/isekai-sakura.js';

/** The bytes a kit, look or hub card's body may take: the infobox and a starter, never a manual. */
export const STAGE_CARD_BODY_CEILING = 3200;

// the open-ground kits name their style card by id (kit.style); the room kits carry theirs as `dress`
const GROUND_STYLES = Object.fromEntries([NATURE_TRAIL, JUNGLE_MGS3, ISEKAI_MEADOW, ISEKAI_BAMBOO, ISEKAI_SAKURA].map((s) => [s.id, s]));
const ROOM_SHELLS = new Set([undefined, 'nave', 'plaza', 'lab']);

/** A recipe each kit is known to build (the shapes its own tests mint); an open-ground kit needs only its id. */
const KIT_STARTERS = {
  'gothic-stone': { rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 20, h: 9 }, { id: 'gallery', x: 12, y: 6, w: 10, d: 8, h: 5 }], links: [{ from: 'nave', to: 'gallery' }] },
  'gothic-nave': { rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13 }] },
  'delfino-plaza': { rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12, open: ['-y', '+x'] }] },
  'research-lab': { rooms: [{ id: 'lab', x: 0, y: 0, w: 16, d: 24, h: 9 }] },
};

// a caption cut at a word boundary, for the hub's one line per kit
const clip = (t, n = 110) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(' ', n - 1))} …`);
const title = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const styleOf = (kit) => kit.dress || GROUND_STYLES[kit.style] || null;
const refFor = (kitId) => Object.entries(SIXTH_GEN_REFERENCES).find(([, r]) => r.kit === kitId)?.[0] || null;
const isRooms = (kit) => ROOM_SHELLS.has(kit.shell);

/** What a kit's own cards let a recipe switch on (each is refused by a kit that lacks it). */
function kitOptions(kit) {
  const S = styleOf(kit) || {}, out = [];
  if (S.night && kit.sun) out.push(`"time": "night" (its style card's moon and air)`);
  if (S.decay) out.push(`"decay": { … } (blackout, abandonment: picks are seeded)`);
  if (S.sway) out.push(`"wind": { … } (its hung cloth and leaves swing)`);
  if (S.fire) out.push(`"fire": true (braziers by the portal light the room)`);
  if (kit.shell === 'plaza' || kit.shell === 'lab') out.push(`"water": true`);
  if (isRooms(kit)) out.push(`"lights": "auto" | [{ "at": [x, y, z], … }]`, `"dirt": { "age", "damp", "soot", "traffic", "seed" }`, `"doors"`, `"items"`);
  return out;
}

/** The kit's one-line caption: its style card's first principle, or the kit's own shell where it carries none. */
function kitSummary(kitId, kit) {
  const S = styleOf(kit);
  if (S?.principles?.length) return S.principles[0];
  return `Grid rooms in dressed stone: plinth, cornice and pilasters on every wall, ribs across the ceiling, a torch on every other pilaster.`;
}

function starter(kitId) {
  const ref = refFor(kitId);
  return { kind: 'stage', ...(ref ? { reference: ref } : {}), kit: kitId, ...(KIT_STARTERS[kitId] || {}) };
}

/** One kit's card. */
export function kitCard(kitId) {
  const kit = STAGE_KITS[kitId], S = styleOf(kit), ref = refFor(kitId), opts = kitOptions(kit);
  const lines = [
    `# ${title(kitId)} (stage kit)`, '', kitSummary(kitId, kit), '',
    `SHELL      ${isRooms(kit) ? `rooms: axis-aligned boxes on a ${kit.grid} m grid, bays every ${kit.bay} m, a doorway where two rooms share a wall` : 'open ground: no rooms, the builder lays the site (trail, cliff, planting) from its style card'}`,
    `LOOK       ${ref ? `pairs with '${ref}' (card 'look/${ref}'); any look can be set with "reference"` : isRooms(kit) ? `no reference names it; "reference" sets the look (default dmc3)` : 'its own: the style card carries the light and air'}`,
    `OPTIONS    ${opts.length ? opts.join(' · ') : 'none beyond the kit'}`,
    `ERA        ${SIXTH_GEN.title}: seen at ${SIXTH_GEN.frame.width}×${SIXTH_GEN.frame.height}, world light baked into the vertices`,
  ];
  if (S?.principles?.length) lines.push('', `PRINCIPLES (the '${S.id}' style card: each machine-checked; the eyes gate is the operator's)`, ...S.principles.slice(0, 5).map((p) => `  - ${p}`), ...(S.principles.length > 5 ? [`  … ${S.principles.length - 5} more on the style card`] : []));
  lines.push('', 'STARTER (a manifest: copy it, change it, mint it)', `  ${JSON.stringify(starter(kitId))}`);
  let body = lines.join('\n');
  if (body.length > STAGE_CARD_BODY_CEILING) body = `${body.slice(0, body.lastIndexOf('\n  - ', STAGE_CARD_BODY_CEILING - 400))}\n  … (the rest is on the style card)\n\nSTARTER\n  ${JSON.stringify(starter(kitId))}`;
  return {
    id: `stage/${kitId}`, name: `${title(kitId)} (stage kit)`, family: 'world', entry: 'create_sketch', generated: true,
    summary: kitSummary(kitId, kit),
    when: [title(kitId).toLowerCase(), ...(ref ? [SIXTH_GEN_REFERENCES[ref].title.toLowerCase(), SIXTH_GEN_REFERENCES[ref].setting] : []), isRooms(kit) ? 'level rooms' : 'outdoor level', 'sixth-gen level', 'ps2 level'].map((w) => `"${w}"`).join(', '),
    body,
  };
}

/** One reference title's look card. */
export function lookCard(refId) {
  const R = SIXTH_GEN_REFERENCES[refId], built = !!STAGE_KITS[R.kit];
  const placed = R.light.placed.length ? R.light.placed.join(', ') : 'none';
  const lines = [
    `# ${R.title}: the look`, '',
    `A sixth-gen reference: ${R.setting}. Palette, light and air read off the title by eye, as starting points tuned at the eyes gate, not measured facts about the game.`, '',
    `PALETTE    base ${R.palette.base}, accent ${R.palette.accent}, warm ${R.palette.warm}`,
    `LIGHT      ambient ${R.light.ambient}; ${R.light.key ? `key ${R.light.key.color} at ${R.light.key.elevation}° elevation` : 'no sun: placed lights only'}; placed: ${placed}; contrast ${R.light.contrast}`,
    `AIR        fog ${R.air.fog.color} at density ${R.air.fog.density}; sky ${R.air.sky}`,
    `SURFACES   ${R.surfaces.join(', ')}`,
    `KIT        ${built ? `'${R.kit}' (card 'stage/${R.kit}')` : `'${R.kit}' is named but not built yet: set this look on another kit`}`,
    '',
    `USE        a stage recipe's "reference": "${refId}". Today only the stage kind reads a look.`,
    '', 'STARTER', `  ${JSON.stringify({ kind: 'stage', reference: refId, kit: built ? R.kit : 'gothic-stone', ...(KIT_STARTERS[built ? R.kit : 'gothic-stone'] || {}) })}`,
  ];
  return {
    id: `look/${refId}`, name: `${R.title}: the look`, family: 'world', entry: 'create_sketch', generated: true,
    summary: `The ${R.title} look (${R.setting}): ${R.light.contrast} contrast, ${R.air.sky} sky.`,
    when: [R.title.toLowerCase(), `like ${R.title.toLowerCase()}`, R.setting, `${refId} look`, 'sixth-gen look', 'ps2 look', 'art direction'].map((w) => `"${w}"`).join(', '),
    body: lines.join('\n'),
  };
}

/** The hub: what a stage recipe holds, and every kit and look on one line. */
export function stageHubCard() {
  const kits = Object.keys(STAGE_KITS), refs = Object.keys(SIXTH_GEN_REFERENCES);
  const missing = refs.filter((r) => !STAGE_KITS[SIXTH_GEN_REFERENCES[r].kit]);
  const lines = [
    '# Stage: a level built the sixth-gen way', '',
    `Kit pieces on a grid, small painted tiles multiplied by baked vertex light, lights placed by hand. ${kits.length} kits dress it; ${refs.length} looks light it. Open the kit or look card the ask names.`, '',
    'RECIPE     { "kind": "stage", "kit", "reference"?, "rooms": [{ "id", "x", "y", "w", "d", "h", "open"? }], "links"?: [{ "from", "to" }], … } — rooms only for a room kit; an open-ground kit takes none',
    '', 'KITS (card stage/<id>)', ...kits.map((k) => `  - ${k}: ${isRooms(STAGE_KITS[k]) ? 'rooms' : 'open ground'}. ${clip(kitSummary(k, STAGE_KITS[k]))}`),
    '', 'LOOKS (card look/<id>, set as "reference")', ...refs.map((r) => `  - ${r}: ${SIXTH_GEN_REFERENCES[r].title}, ${SIXTH_GEN_REFERENCES[r].setting}`),
    ...(missing.length ? ['', `Named, not built: the kits for ${missing.map((r) => `${r} ('${SIXTH_GEN_REFERENCES[r].kit}')`).join(', ')}. Their looks still apply to a built kit.`] : []),
  ];
  return {
    id: 'stage', name: 'Stage (sixth-gen level)', family: 'world', entry: 'create_sketch', generated: true,
    summary: 'A level built the sixth-gen way: grid rooms or open ground dressed by a kit, lit by a reference look.',
    when: '"sixth-gen level", "ps2 level", "gamecube level", "level rooms", "dungeon rooms", "stage kit", "art direction", "retro 3d level"',
    body: lines.join('\n'),
  };
}

/** Every generated card: the hub, each kit, each look. */
export function stageEntryCards() {
  return [stageHubCard(), ...Object.keys(STAGE_KITS).map(kitCard), ...Object.keys(SIXTH_GEN_REFERENCES).map(lookCard)];
}
