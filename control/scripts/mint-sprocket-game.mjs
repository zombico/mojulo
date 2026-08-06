#!/usr/bin/env node
/**
 * Mint SPROCKET — the reference 3D platformer (platformer.plan.md, P2).
 *
 * Level 1 "Cog Isles" is authored with the P1 substrate: platformField() for the island geometry +
 * matching colliders + a moving-platform carrier, the `platformer` kit for the store + game channel,
 * and a round `orb` glyph as the player stand-in (the hero polygomer sk_sprk_hero1 can't yet BE an
 * entity body — that needs a body.type:'polygomer', flagged in the plan). The player rides the
 * `platform` rule (gravity + jump), collects gears, avoids a hazard pad, rides the ferry across the
 * void, and reaches the goal. Falls respawn (the kit's respawn net).
 *
 *   cd control
 *   node scripts/mint-sprocket-game.mjs [--level-only] [--no-audit]
 *
 * Play: /api/sketches/sk_sprocket/game   ·   Level world: /api/sketches/sk_sprk_level1/world?walk=1
 */
import { register } from 'node:module';
register('./mcp-stdio-loader.mjs', import.meta.url);

const { SketchRepository } = await import('../lib/db/repositories/sketches.js');
const { platformField } = await import('../lib/graph/worlds/platform-field.js');
const { scaffoldGameFromKit } = await import('../lib/graph/game/kits.js');
const { assembleControllableScene } = await import('../lib/graph/worlds/controllable-world.js');
const { mintGame } = await import('../lib/mcp/tools/create-game.js');
const { closeDb } = await import('../lib/db/index.js');

const argv = new Set(process.argv.slice(2));
const LEVEL_ONLY = argv.has('--level-only');
const NO_AUDIT = argv.has('--no-audit');

const LEVEL_REF = 'sk_sprk_level1';
const GAME_REF = 'sk_sprocket';

// ── the level layout (one source of truth for geometry AND mechanic zones) ────────────────────
// A PURE-JUMP course: every gap ≤ ~2.3 units edge-to-edge and gently DESCENDING, so the orb's
// platform jump (jumpSpeed 9, airControl 0.82) clears each with margin — beatable by jumping alone.
// (The `ferry` mover was cut from the critical path: a moving carrier isn't yet walkable ground
// in-game — the renderer gap flagged in platformer.plan.md P2 — so it left an uncrossable void.
// It returns as a showcase once body.type:'platform' movers render as ground.)
const LAYOUT = {
  thickness: 1.6,
  tint: '#7f8caa',
  islands: [
    { at: [0, 0, 0], size: [7, 7], tint: '#8b96b2' },        // start
    { at: [8, 0, 0], size: [4.5, 4.5] },                     // hop 1  (gap 2.25)
    { at: [14.5, 0, -0.2], size: [4, 4] },                   // hop 2  (gap 2.25, −0.2)
    { at: [20.5, 1.2, -0.5], size: [4, 4] },                 // hop 3  (gap 2.0, −0.3)
    { at: [27, 1.2, -0.8], size: [7, 7], tint: '#8b96b2' },  // goal isle (gap 1.0, −0.3)
  ],
  movers: [],
  hazards: [
    { at: [8, -1.7, 0.1], radius: 1.2, damage: 20 },         // a spike pad off the direct line
  ],
  spawn: [0, 0, 0.5],
  exit: [27, 1.2, -0.5],
};

const field = platformField(LAYOUT);

const GEARS = [
  { item: 'gear', at: [8, 0, 1.2] },
  { item: 'gear', at: [14.5, 0, 1.0] },
  { item: 'gear', at: [20.5, 1.2, 0.7] },
];

// ── the player: the REAL dreamed Sprocket (a manji-tree polygomer) on the platform rule ────────
const HERO_REF = 'sk_sprk_hero1';
const player = {
  id: 'hero',
  rule: {
    type: 'platform', turnMode: 'look', eye: 0,
    speed: 6.5, strafe: 1, jumpSpeed: 9, gravity: 22, fallGravity: 34,
    coyote: 0.12, buffer: 0.12, jumpCut: 3, airControl: 0.82,
    collideRadius: 0.55, snap: 0.25, step: 0.4, lookSens: 0.0022,
  },
  body: { type: 'polygomer', figure: 'hero' },   // the dreamed round hero, squash/stretch-animated
  transform: { pos: [...LAYOUT.spawn], heading: 0 },
};

// ── the game shape from the platformer kit (store + gates + level game channel) ────────────────
const { store, gameLevels, levelChannels } = scaffoldGameFromKit('platformer', {
  title: 'Sprocket',
  levels: [{
    ref: LEVEL_REF, title: 'Cog Isles',
    exit: LAYOUT.exit, exitRadius: 2.2,
    pickups: GEARS,
    hazards: field.hazards,
    // lethal omitted → non-lethal (hazards chip in-level hp but never fail the run; friendly first level + safe auto-audit)
  }],
});

const gameChannel = { ...levelChannels[LEVEL_REF], consumes: [], presets: { default: {} } };

const levelManifest = {
  kind: 'controllable',
  title: 'Sprocket — Cog Isles',
  entities: [player, ...field.entities],
  figures: { hero: { polygomerRef: HERO_REF } },   // resolve + bake the dreamed hero as the player body
  camera: { rule: 'follow', target: 'hero', mouseLook: true, dist: 7, height: 3, lead: 1.4, lerp: 10 },
  faces: field.faces,
  colliders: field.colliders,
  worldFraming: { cameraPosition: [-7, -8, 6], lookAt: [12, 1, 1], horizontalFov: 62 },
  bg: '#0c1526',
  // immersiveness (platformer.plan.md P2): one warm key + regrade + sky (atmosphere), gentle aerial
  // fog for depth, baked AO in the crevices, and live contact shadows under the actors.
  atmosphere: 'goldenHour',
  fog: { height: 12, density: 0.014, color: [0.82, 0.72, 0.62], maxDist: 320, cell: 20, steps: 90, traceSteps: 70 },
  ao: true,
  shadows: true,
  game: gameChannel,
};

// validate it renders (same check mintControllableWorld runs), then upsert the level world.
assembleControllableScene(levelManifest, {});
const levelExisted = Boolean(SketchRepository.getByRef(LEVEL_REF));
if (levelExisted) SketchRepository.update({ ref: LEVEL_REF, title: levelManifest.title, manifest: levelManifest });
else SketchRepository.create({ title: levelManifest.title, manifest: levelManifest, ref: LEVEL_REF });
console.log(`${levelExisted ? 'updated' : 'created'} level  ${LEVEL_REF}`);
console.log(`  walk it: /api/sketches/${LEVEL_REF}/world?walk=1`);

if (LEVEL_ONLY) { console.log('[--level-only] skipping game mint'); closeDb(); process.exit(0); }

// ── mint the game over the level ──────────────────────────────────────────────────────────────
const res = await mintGame({
  title: 'Sprocket',
  ref: GAME_REF,
  store,
  levels: gameLevels,
  theme: { accent: '#18b6c6', accent2: '#f5a24a', style: 'hud' },
  autoAudit: !NO_AUDIT,
  allowUnaudited: NO_AUDIT,
});
console.log('minted game', res.ref, '→ play at', res.playUrl || `/api/sketches/${GAME_REF}/game`);
if (res.audits) console.log('audits:', res.audits.map((a) => `${a.ref}: ${a.completable ? 'completable' : (a.audited ? 'audited' : 'waived')}`).join('  '));
closeDb();
