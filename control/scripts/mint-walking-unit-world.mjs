/**
 * Mint WALKING-UNIT proof worlds for an assembled biped unit (mobile-suit
 * R3: gait → walking units in worlds). Two controllable worlds per unit:
 *
 *   <ref>_walker_clock  an ambient walker — the clock rule plays the baked
 *                       forward gait with no input (cheapest proof of the clip)
 *   <ref>_walker_wasd   the playable walker — FPS-standard controls (W/S
 *                       forward/back, A/D strafe, mouse look via pointer
 *                       lock, Space jump: the platform rule in mouselook) +
 *                       follow camera, all scaled to the unit's real height
 *
 * The world manifests stay tiny recipes: they carry `figures:{unit:{unitRef}}`
 * and the rig bakes at world-resolve time (world-scene.js → unit-rig.js).
 * The bake itself is validated here first so a bad unit fails at mint, not
 * in the browser.
 *
 *   cd control
 *   node scripts/mint-walking-unit-world.mjs                    # v78 g-series reference
 *   node scripts/mint-walking-unit-world.mjs <ref>              # any stored biped unit
 *   node scripts/mint-walking-unit-world.mjs <ref> --frame      # + generated manji inner
 *                                                               #   frame (refs suffixed _frame)
 *   node scripts/mint-walking-unit-world.mjs <ref> --frame-only # ONLY the inner stick figure,
 *                                                               #   no armor/livery (refs _stick)
 *   node scripts/mint-walking-unit-world.mjs <ref> --dry-run    # bake + validate only
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { bakeUnitRig } from '../lib/graph/worlds/unit-rig.js';
import { DODGE_POSES } from '../lib/graph/worlds/dodge-poses.js';

const REFERENCE_UNIT = 'sk_80str_modular_frame_fit_v78_raised_chest_vents';
const BASE_URL = 'http://127.0.0.1:3001';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const sourceRef = argv.find((a) => !a.startsWith('--')) || REFERENCE_UNIT;

const source = SketchRepository.getByRef(sourceRef);
if (!source?.manifest) {
  console.error(`Source sketch '${sourceRef}' not found (or has no manifest).`);
  process.exit(1);
}
if (source.manifest.kind !== 'assembler') {
  console.error(`Source '${sourceRef}' is kind '${source.manifest.kind}' — walking units are assembled units (kind 'assembler').`);
  process.exit(1);
}

const withFrame = flags.has('--frame');
// --frame-only: strip ALL the suit skin/livery and bake JUST the derived rig's
// inner stick figure, so the walk can be examined without any mobile-suit armor.
// Same bones/clips/grounding as the full suit — only the skin is gone.
const frameOnly = flags.has('--frame-only');

// An ARMED unit (scripts/arm-unit.mjs) carries its solved hold as
// `armory.aim` — the walker worlds pick it up so the weapon stays pointed
// through every clip (unit-rig.js aim lock). Nothing to opt into: arming the
// unit IS the opt-in.
const aim = source.manifest.armory?.aim && typeof source.manifest.armory.aim === 'object'
  ? source.manifest.armory.aim : null;
// Melee units also carry strike verbs (armory.swings → unlocked swing_<name>
// clips beside the aim-locked gait).
const swings = Array.isArray(source.manifest.armory?.swings) ? source.manifest.armory.swings : null;

// Bake once now: proves the rig derives + packs before any world is minted,
// and gives the real height the world scales stride/speed/camera from.
const fig = bakeUnitRig(source.manifest, { frame: withFrame, frameOnly, aim, swings });
const h = fig.figH;
const partFaces = fig.parts.reduce((n, p) => n + (p ? p.faces : 0), 0);
console.log(`${sourceRef}: baked rig — height ${h}, ${fig.parts.filter(Boolean).length}/${fig.bones.length} bones with parts, `
  + `${partFaces} faces, clips [${Object.keys(fig.clips).join(', ')}] @ ${fig.clips.forward.k} keys`);

const round = (v) => Math.round(v * 10) / 10;
const stage = { size: round(h * 24), cell: round(h / 2) };   // sized for boost speed (~2.7·h/s) — ~9s corner to corner
const framing = {
  cameraPosition: [round(h * 1.4), round(-h * 1.8), round(h * 0.9)],
  lookAt: [0, 0, round(h * 0.45)],
  horizontalFov: 60,
};
const figures = { unit: { unitRef: sourceRef, ...(frameOnly ? { frameOnly: true } : withFrame ? { frame: true } : {}), ...(aim ? { aim } : {}), ...(swings ? { swings } : {}) } };
const suffix = frameOnly ? '_stick' : withFrame ? '_frame' : '';
if (aim) console.log(`  armed unit: aim lock ${JSON.stringify(aim)}`);

const worlds = [
  {
    ref: `${sourceRef}_walker_clock${suffix}`,
    manifest: {
      kind: 'controllable',
      title: `${source.title} - walker (clock)`,
      note: `walking-unit proof (ambient) · unit-rig v1 · from ${sourceRef}`,
      ground: stage,
      worldFraming: framing,
      figures,
      entities: [{
        id: 'unit',
        transform: { pos: [0, 0, 0] },
        rule: { type: 'clock', rate: 0.5 },
        body: { type: 'figure-rig', figure: 'unit' },
      }],
    },
  },
  {
    ref: `${sourceRef}_walker_wasd${suffix}`,
    manifest: {
      kind: 'controllable',
      title: `${source.title} - walker (wasd)`,
      note: `walking-unit proof (playable) · unit-rig v1 · from ${sourceRef}`,
      ground: stage,
      worldFraming: framing,
      figures,
      entities: [{
        id: 'unit',
        transform: { pos: [0, 0, 0] },
        // FPS-standard: platform rule (gravity + Space jump) in mouselook —
        // the mouse steers heading, which frees A/D into strafe. Jump/gravity
        // scale with height (apex ≈ 0.24·h); snap/step are ledge tolerances.
        rule: {
          type: 'platform', turnMode: 'look',
          speed: round(h * 1.05), stride: round(h * 0.84), boostSpeed: round(h * 3.7),
          jumpSpeed: round(h * 0.9), gravity: round(h * 1.7), fallGravity: round(h * 2.6),
          maxFall: round(h * 1.5), snap: round(h * 0.08), step: round(h * 0.18),
          chargeMax: 4, chargeDash: round(h * 1.7),   // stop-and-charge jump: hold Space up to 4s; full charge leaps toward held WASD
          kneel: true,                                // hold X: one-knee ground pose
          ...(swings ? { strike: 'melee' } : {}),     // left mouse: one-shot melee swing (units that carry swing clips)
        },
        body: { type: 'figure-rig', figure: 'unit' },
      }],
      // turnMode:'look' on the CAMERA spec is what arms pointer-lock capture
      // (click the canvas once; Esc releases) — the rule's turnMode consumes it.
      camera: { rule: 'follow', target: 'unit', turnMode: 'look', dist: round(h * 1.6), height: round(h * 0.8), lead: round(h * 0.3), lookH: round(h * 0.5) },
    },
  },
];

// --dodge: an extra PLAYABLE world with the acrobatic-dodge maneuver wired —
// the dodge clips baked beside the gait, and the platform rule's dodge enabled
// (double-tap F + held WASD → invincible tumble). Kept as its own ref so the
// plain walkers stay byte-identical.
if (flags.has('--dodge')) {
  const dodgeNames = Object.keys(DODGE_POSES);
  worlds.push({
    ref: `${sourceRef}_dodge_wasd${suffix}`,
    manifest: {
      kind: 'controllable',
      title: `${source.title} - dodge walker (wasd)`,
      note: `acrobatic-dodge walker · double-tap F + WASD · from ${sourceRef}`,
      ground: stage,
      worldFraming: framing,
      figures: { unit: { ...figures.unit, dodges: dodgeNames } },
      entities: [{
        id: 'unit',
        transform: { pos: [0, 0, 0] },
        rule: {
          type: 'platform', turnMode: 'look',
          speed: round(h * 1.05), stride: round(h * 0.84), boostSpeed: round(h * 3.7),
          jumpSpeed: round(h * 0.9), gravity: round(h * 1.7), fallGravity: round(h * 2.6),
          maxFall: round(h * 1.5), snap: round(h * 0.08), step: round(h * 0.18),
          chargeMax: 4, chargeDash: round(h * 1.7), kneel: true,
          ...(swings ? { strike: 'melee' } : {}),
          // the dodge: double-tap F within doubleTapWindow, pushed to a WASD dir
          dodge: true, dodgeDur: 0.6, dodgeSpeed: round(h * 3.0), dodgeTurns: 1, doubleTapWindow: 0.28,
        },
        body: { type: 'figure-rig', figure: 'unit' },
      }],
      camera: { rule: 'follow', target: 'unit', turnMode: 'look', dist: round(h * 1.6), height: round(h * 0.8), lead: round(h * 0.3), lookH: round(h * 0.5) },
    },
  });
}

// --twirl: the BULKY read — every dodge is a grounded vertical twirl (both feet
// planted), the dash carried by the held stick. Same clips baked; the rule's
// `dodge:'twirl'` mode picks the single dodge_twirl for all directions.
if (flags.has('--twirl')) {
  const dodgeNames = Object.keys(DODGE_POSES);
  worlds.push({
    ref: `${sourceRef}_twirl_wasd${suffix}`,
    manifest: {
      kind: 'controllable',
      title: `${source.title} - twirl walker (wasd)`,
      note: `bulky-suit twirl walker · double-tap F + any WASD · from ${sourceRef}`,
      ground: stage,
      worldFraming: framing,
      figures: { unit: { ...figures.unit, dodges: dodgeNames } },
      entities: [{
        id: 'unit',
        transform: { pos: [0, 0, 0] },
        rule: {
          type: 'platform', turnMode: 'look',
          speed: round(h * 1.05), stride: round(h * 0.84), boostSpeed: round(h * 3.7),
          jumpSpeed: round(h * 0.9), gravity: round(h * 1.7), fallGravity: round(h * 2.6),
          maxFall: round(h * 1.5), snap: round(h * 0.08), step: round(h * 0.18),
          chargeMax: 4, chargeDash: round(h * 1.7), kneel: true,
          ...(swings ? { strike: 'melee' } : {}),
          // hover units (toretto-type) twirl ACROBATICALLY and aerially
          // (unit-rig.js swaps in dodge_airtwirl); grounded/bulky suits keep the
          // braced pivot. A single spin either way.
          dodge: 'twirl', dodgeDur: 0.6, dodgeSpeed: round(h * 3.0), dodgeTurns: 1, doubleTapWindow: 0.28,
        },
        body: { type: 'figure-rig', figure: 'unit' },
      }],
      camera: { rule: 'follow', target: 'unit', turnMode: 'look', dist: round(h * 1.6), height: round(h * 0.8), lead: round(h * 0.3), lookH: round(h * 0.5) },
    },
  });
}

// AUDIO — for HOVER units, wire the boost/thruster whine + the dodge cue + the
// jump charge/release so the thruster FLAMES (unit-rig thruster anchors) come
// with their SOUND. `thruster` is a continuous noise bed gain-modulated by
// e.thrust (plays on boost); `dodge` fires on the e.dodgeCount edge (the twirl).
// A hover unit has NO footsteps, so no step SFX is declared. This is the same
// audio contract the loadout proving ground uses — so it carries over verbatim
// when the unit is dropped in there.
if (source.manifest.locomotion === 'hover') {
  const HOVER_AUDIO = {
    thruster: { level: 0.16 },
    dodge: [
      { type: 'burst', at: 0, decay: 0.1, vol: 0.26, highpass: 900, lowpass: 5000 },
      { type: 'thump', at: 0, from: 'A2', to: 'E1', decay: 0.14, vol: 0.36 },
      { type: 'sweep', wave: 'sawtooth', at: 0, from: 'A3', to: 'A2', dur: 0.3, vol: 0.18 },
    ],
    jump: {
      charge: { level: 0.22 }, release: { level: 0.46 },
      // the LANDING clang — fires on the e.landed edge, loudness scaled by
      // e.landVel / landRef (a hard drop clangs louder). Same mech-landing cue
      // the other suits use; landRef tracks this unit's height.
      land: [
        { type: 'burst', decay: 0.13, vol: 0.32, highpass: 850, lowpass: 5200 },
        { type: 'burst', decay: 0.05, vol: 0.2, highpass: 2400 },
        { type: 'thump', from: 'A2', to: 'E1', decay: 0.18, vol: 0.46 },
        { type: 'thump', from: 'D2', to: 'A0', decay: 0.24, vol: 0.4 },
        { type: 'burst', at: 0.09, decay: 0.11, vol: 0.14, highpass: 1300, lowpass: 3800 },
      ],
      landRef: round(h),
    },
  };
  // MELEE units (armory.swings) get the BEAM-SABER strike sound — the swing
  // whoosh (crackling-ozone, on the e.swingCount edge) + the hit clash (on the
  // e.meleeHitCount edge). Same cues the loadout proving ground plays for the
  // g-series beam saber, so the heat saber sounds identical.
  if (source.manifest.armory?.swings?.length) {
    HOVER_AUDIO.strike = {
      swing: [
        { type: 'thump', from: 'E2', to: 'G1', decay: 0.34, vol: 0.6 },
        { type: 'sweep', wave: 'sawtooth', from: 'A2', to: 'E1', dur: 0.24, vol: 0.32 },
        { type: 'burst', decay: 0.2, vol: 0.26, lowpass: 240 },
        { type: 'flutter', wave: 'sawtooth', rateHz: 58, hold: 0.5, jitter: 0.9, tiers: [{ at: 0, table: ['A3', 'E3', 'A3', 'D4', 'G3', 'B3'] }], vol: 0.17, seed: 1442 },
        { type: 'grain', grains: 52, over: 0.5, decay: [0.005, 0.028], band: { lo: 450, hi: 8200 }, vol: 0.32, spread: 0.45, seed: 23219 },
        { type: 'sweep', wave: 'sawtooth', from: 'A4', to: 'B2', dur: 0.46, vol: 0.13 },
      ],
      hit: [
        { type: 'grain', grains: 46, over: 0.3, decay: [0.003, 0.016], band: { lo: 1200, hi: 11000 }, vol: 0.3, spread: 0.3, seed: 11295 },
        { type: 'flutter', wave: 'square', rateHz: 95, hold: 0.26, jitter: 1, tiers: [{ at: 0, table: ['E5', 'A5', 'E5', 'C5', 'G4', 'D4'] }], vol: 0.18, seed: 11504 },
        { type: 'grain', grains: 34, over: 0.11, decay: [0.004, 0.02], band: { lo: 700, hi: 9200 }, vol: 0.36, spread: 0.35, seed: 4551 },
        { type: 'flutter', wave: 'sawtooth', rateHz: 76, hold: 0.15, jitter: 0.95, tiers: [{ at: 0, table: ['A5', 'D5', 'A5', 'F5', 'C6'] }], vol: 0.22, seed: 1918 },
        { type: 'burst', decay: 0.13, vol: 0.34, highpass: 220, lowpass: 2600 },
        { type: 'flutter', wave: 'sawtooth', rateHz: 44, hold: 0.16, jitter: 0.95, tiers: [{ at: 0, table: ['C3', 'G2', 'D3', 'A2', 'E3'] }], vol: 0.26, seed: 15124 },
        { type: 'thump', from: 'E3', to: 'C2', decay: 0.18, vol: 0.4 },
        { type: 'burst', decay: 0.09, vol: 0.34, highpass: 1700 },
        { type: 'thump', from: 'A3', to: 'A1', decay: 0.14, vol: 0.42 },
      ],
    };
  }
  for (const w of worlds) if (!w.manifest.audio) w.manifest.audio = HOVER_AUDIO;
}

if (flags.has('--dry-run')) {
  console.log('  dry-run: bake valid — not minted');
  process.exit(0);
}

for (const w of worlds) {
  try {
    SketchRepository.create({ title: w.manifest.title, manifest: w.manifest, ref: w.ref });
    console.log(`  minted ${w.ref}`);
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err?.message || '')) {
      // re-minting for the same unit refreshes the recipe (the unit's armory
      // aim or the template may have moved since the first mint)
      SketchRepository.update({ ref: w.ref, title: w.manifest.title, manifest: w.manifest });
      console.log(`  updated ${w.ref} in place`);
    } else throw err;
  }
  console.log(`  world  ${BASE_URL}/api/sketches/${encodeURIComponent(w.ref)}/world`);
}
