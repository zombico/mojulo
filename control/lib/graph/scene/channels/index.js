/**
 * channels/index.js — the channel registry (channel-registry-formalization S2).
 * Assembles SETUP_CHANNELS + RUNTIME_CHANNELS from the per-channel modules and owns the
 * load-time contract assertion. Emitted bytes are byte-identical to the pre-split
 * channels.js — pinned by emit-channels.char.test.js. The contract itself is
 * documented in contract.md / emit-scope.md beside this file.
 */
import { audioChannelScript } from './audio.js';
import { buildupChannelScript } from './buildup.js';
import { castShadowScript } from './cast-shadows.js';
import { cometChannelScript } from './comet.js';
import { deformChannelScript } from './deform.js';
import { fieldChannelScript } from './field.js';
import { fxChannelScript } from './fx.js';
import { gameChannelScript } from './game.js';
import { glowSpriteScript } from './glow.js';
import { heatSphereChannelScript } from './heat-sphere.js';
import { inkDecalScript } from './ink-decal.js';
import { moverChannelScript } from './mover.js';
import { pickChannelScript } from './pick.js';
import { planetChannelScript } from './planet.js';
import { shadowDecalScript } from './shadow-decal.js';
import { signageChannelScript } from './signage.js';
import { skyDomeScript } from './sky-dome.js';
import { specularChannelScript } from './specular.js';
import { sphereRigPreamble } from './sphere-rig.js';
import { spriteSfxChannelScript } from './sprite-sfx.js';
import { starSurfaceChannelScript } from './star-surface.js';
import { surfaceChannelScript } from './surface.js';
import { tracerChannelScript } from './tracer.js';
import { transportChannelScript } from './transport.js';
import { waterMeshScript } from './water.js';

// ── the runtime-channel registry (renderer-emitter.plan.md E2b) ────────────────────
// One row per channel in the World page's RUNTIME SECTION, in splice order. A row is
// the single place a channel exists: its emitted comment header, its inert `let`
// binding(s), its __mojStep call (order here IS the step order — events after physics
// is semantic), and — for the uniform list channels — the payload filter + script.
// Channels marked bespoke (walk / physics / actions / events / controllable) are
// normalized in emitThreeWorld (they couple to mesh bounds, capture state, or each
// other) and hand their finished block in via the same `blocks` map. The generated
// text is byte-identical to the hand-wired section it replaced — pinned by
// emit-channels.char.test.js.

const listOrNull = (v, keep) => { const l = (Array.isArray(v) ? v : []).filter(keep); return l.length ? l : null; };

export const RUNTIME_CHANNELS = [
  { key: 'walk',
    comment: [`// walk mode (opt-in) overrides orbit per-frame. walkOn/stepWalk stay inert (orbit-only) when`,
      `// no walkBlock is emitted, so the default World loop is unchanged. dt off setAnimationLoop's`,
      `// time arg (clamped) — no Date.now, and stable across frame-rate.`],
    lets: `let walkPrevT = 0, walkOn = false, stepWalk = () => {};`,
    normalizeIn: 'emitThreeWorld',   // walk config derives speed/spawn/radius off the mesh bounds
    provides: ['walkMode'] },        // the pause sidecar + audio gait probe it (typeof-guarded)
  { key: 'tracers',
    comment: [`// tracer channel (opt-in): stepTracers stays inert unless a tracerBlock is emitted.`],
    lets: `let stepTracers = () => {};`, step: `stepTracers(t);`,
    normalize: (v) => listOrNull(v, (tr) => tr && Array.isArray(tr.path) && tr.path.length > 1),
    script: tracerChannelScript },
  // sphereRig + planets are placed BEFORE movers on purpose: the planet channel registers its meshes
  // into the shared `meshes` map at eval time, and the mover channel binds `meshes[mv.group]` at eval
  // time too — so an orbiting body's sphere must exist before movers runs. sphereRig (defines
  // __uvSphereRig) precedes planets, which reuses it (the heat-sphere/star-surface channels sit later).
  { key: 'sphereRig',
    comment: [`// shared UV-sphere rig for the planet + heat-sphere + star-surface channels (defines __uvSphereRig once).`],
    provides: ['__uvSphereRig'] },
  { key: 'planets',
    comment: [`// planet channel (opt-in): stepPlanets stays inert unless a planetBlock is emitted. Emitted before`,
      `// movers so an orbit mover can bind + translate each registered planet sphere.`],
    lets: `let stepPlanets = () => {};`, step: `stepPlanets(t);`,
    normalize: (v) => listOrNull(v, (pl) => pl && pl.radius > 0 && typeof pl.group === 'string'),
    script: planetChannelScript,
    requires: ['__uvSphereRig'] },
  { key: 'movers',
    comment: [`// mover channel (opt-in): stepMovers stays inert unless a moverBlock is emitted.`],
    lets: `let stepMovers = () => {};`, step: `stepMovers(t);`,
    normalize: (v) => listOrNull(v, (mv) => mv && (mv.spin || mv.turn || mv.link || mv.pose || mv.fill || mv.pulse || mv.flash || mv.cascade || (Array.isArray(mv.path) && mv.path.length > 1))),
    script: moverChannelScript },
  { key: 'comets',
    comment: [`// comet channel (opt-in): stepComets stays inert unless a cometBlock is emitted.`],
    lets: `let stepComets = () => {};`, step: `stepComets(t);`,
    normalize: (v) => listOrNull(v, (cm) => cm && Array.isArray(cm.path) && cm.path.length > 1),
    script: cometChannelScript },
  { key: 'fields',
    comment: [`// field channel (opt-in): stepFields stays inert unless a fieldBlock is emitted.`],
    lets: `let stepFields = () => {};`, step: `stepFields(t);`,
    normalize: (v) => listOrNull(v, (fd) => fd && (Array.isArray(fd.sets) || Array.isArray(fd.lines))),
    script: fieldChannelScript },
  { key: 'surfaces',
    comment: [`// surface channel (opt-in): stepSurfaces stays inert unless a surfaceBlock is emitted.`],
    lets: `let stepSurfaces = () => {};`, step: `stepSurfaces(t);`,
    normalize: (v) => listOrNull(v, (sf) => sf && sf.grid && (Array.isArray(sf.waves) || Array.isArray(sf.sources) || (sf.gw && typeof sf.gw === 'object') || (sf.river && typeof sf.river === 'object') || (sf.spout && typeof sf.spout === 'object'))),
    script: surfaceChannelScript },
  { key: 'heatSpheres',
    comment: [`// heat-sphere channel (opt-in): stepHeatSpheres stays inert unless a heatSphereBlock is emitted.`],
    lets: `let stepHeatSpheres = () => {};`, step: `stepHeatSpheres(t);`,
    normalize: (v) => listOrNull(v, (hs) => hs && hs.radius > 0 && Array.isArray(hs.coeffs) && hs.coeffs.length),
    script: heatSphereChannelScript,
    requires: ['__uvSphereRig'] },
  { key: 'starSurfaces',
    comment: [`// star-surface channel (opt-in): stepStarSurfaces stays inert unless a starSurfaceBlock is emitted.`],
    lets: `let stepStarSurfaces = () => {};`, step: `stepStarSurfaces(t);`,
    normalize: (v) => listOrNull(v, (st) => st && st.radius > 0 && Number.isFinite(st.Tbase)),
    script: starSurfaceChannelScript,
    requires: ['__uvSphereRig'] },
  { key: 'buildups',
    comment: [`// buildup channel (opt-in): stepBuildups stays inert unless a buildupBlock is emitted.`],
    lets: `let stepBuildups = () => {};`, step: `stepBuildups(t);`,
    normalize: (v) => listOrNull(v, (bu) => bu && Array.isArray(bu.positions) && bu.positions.length >= 3),
    script: buildupChannelScript },
  { key: 'transports',
    comment: [`// transport channel (opt-in): stepTransports stays inert unless a transportBlock is emitted.`],
    lets: `let stepTransports = () => {};`, step: `stepTransports(t);`,
    normalize: (v) => listOrNull(v, (tr) => tr && Array.isArray(tr.loop) && tr.loop.length > 1 && Array.isArray(tr.vectors)),
    script: transportChannelScript },
  { key: 'deforms',
    comment: [`// deform channel (opt-in): stepDeforms stays inert unless a deformBlock is emitted.`],
    lets: `let stepDeforms = () => {};`, step: `stepDeforms(t);`,
    normalize: (v) => listOrNull(v, (d) => d && typeof d.group === 'string' && (d.to || d.basis || (Array.isArray(d.terms) && d.terms.length))),
    script: deformChannelScript },
  { key: 'signs',
    comment: [`// signage channel (opt-in): stepSigns stays inert unless a signageBlock is emitted.`],
    lets: `let stepSigns = () => {};`, step: `stepSigns(t);`,
    normalize: (v) => listOrNull(v, (s) => s && s.variant && s.anchor),
    script: signageChannelScript },
  { key: 'physics',
    comment: [`// physics channel (opt-in, LIVE): stepPhysics stays inert unless a physicsBlock is emitted.`],
    lets: `let stepPhysics = () => {};`, step: `stepPhysics(t);`,
    normalizeIn: 'emitThreeWorld',   // the one LIVE-nondeterministic channel; gated on bodies.length
    provides: ['__mojSim'],
    requiresOptional: ['__mojGrab'] },   // pointer-grab seam, set by actions when wired
  { key: 'actions',
    comment: [`// actions channel (opt-in, LIVE): input→impulse listeners; sets up once, no per-frame step.`],
    normalizeIn: 'emitThreeWorld',   // gated on hasPhysics — an action without a sim is meaningless
    provides: ['__mojActions', '__mojGrab', '__mojSpawnN'],
    requires: ['__mojSim'] },
  { key: 'events',
    comment: [`// events channel (opt-in, LIVE): the in-world bus. stepEvents stays inert unless an eventsBlock is`,
      `// emitted; it runs AFTER stepPhysics in __mojStep so it reacts to the freshest per-step facts.`],
    lets: `let stepEvents = () => {};`, step: `stepEvents(t);`,
    normalizeIn: 'emitThreeWorld',   // reacts to physics facts + controllable entities; couples to both
    provides: ['__BUS', '__busState', '__mojBus'],
    requiresOptional: ['__mojSim', '__mojCtrl'] },
  { key: 'controllable',
    comment: [`// controllable channel (opt-in, LIVE): the unified control primitive. stepControllable stays inert`,
      `// and __ctrlActive false unless a controllableBlock is emitted; when active it owns the camera.`],
    lets: `let stepControllable = () => {};
let __ctrlActive = false;       // there are controllable entities to step each frame
let __ctrlOwnsCamera = false;   // a camera entity is present → drive the camera + disable OrbitControls`,
    normalizeIn: 'emitThreeWorld',   // entity packing (figure clips / rig bakes) + camera/shadow-key coupling
    // __world/__bodies/__MOUSELOOK/__fireDown/__lookDX/__lookDY are probed by the page's own
    // pause sidecar + capture code; __mojHangar/__mojShadows/__mojSmoke escape from the opt-in
    // sub-blocks (see channels/contract.md § interpolation points).
    provides: ['__mojCtrl', '__world', '__bodies', '__mojHangar', '__mojShadows', '__mojSmoke',
      '__MOUSELOOK', '__fireDown', '__lookDX', '__lookDY'],
    requiresOptional: ['__specPatch', '__mojGame', '__mojCast'] },
];

// ── the setup/post catalog (channel-registry-formalization.plan.md S1) ─────────────
// Every block scene-three splices OUTSIDE the runtime section, in page order. S1 is
// metadata only — scene-three still owns the splice text (S3 moves it onto this array).
// anchor: 'pre-runtime' rows land before the runtime section (splice order = array
// order); 'post-step' rows land after the __mojStep assembly; 'post-overlays' after the
// fog/effects quads; 'post-capture' after `const _capture`. normalizeIn names where the
// payload → block-args reduction happens today, with the coupling that keeps it there.
export const SETUP_CHANNELS = [
  { key: 'sky', anchor: 'pre-runtime', script: skyDomeScript,
    normalizeIn: 'emitThreeWorld' },   // centre/radius fall back to the mesh bounds
  { key: 'water', anchor: 'pre-runtime', script: waterMeshScript,
    normalizeIn: 'emitThreeWorld' },   // water faces pulled out of the opaque set up front
  { key: 'shadowDecal', anchor: 'pre-runtime', script: shadowDecalScript,
    normalizeIn: 'emitThreeWorld' },   // collectShadowDecals over the raw face list
  { key: 'inkDecal', anchor: 'pre-runtime', script: inkDecalScript,
    normalizeIn: 'emitThreeWorld' },   // decal:'ink' faces filtered off the raw face list
  { key: 'glow', anchor: 'pre-runtime', script: glowSpriteScript,
    normalizeIn: 'emitThreeWorld' },   // collectGlowSprites over the raw face list
  { key: 'specular', anchor: 'pre-runtime', script: specularChannelScript,
    normalizeIn: 'emitThreeWorld',     // gate scans groups AND rig-figure parts for spec
    sep: '',                           // rides the same template line as glow (byte pin)
    provides: ['__specPatch'] },       // controllable's rig builder probes it (typeof-guarded)
  { key: 'pick', anchor: 'pre-runtime', script: pickChannelScript,
    normalizeIn: 'emitThreeWorld' },   // also gates the #molPopup div in the page shell
  { key: 'castShadow', anchor: 'pre-runtime', script: castShadowScript,
    normalizeIn: 'emitThreeWorld',     // toLight resolved off the payload's baked light
    sep: '',                           // appended row: zero bytes when absent (char-net holds)
    provides: ['__mojCast'] },         // controllable steers the follow box; walkers flag casters
  { key: 'fx', anchor: 'post-step', script: fxChannelScript,
    normalizeIn: 'emitThreeWorld',     // presence decides controllable's exposeBodies
    requiresOptional: ['__BUS', '__mojCtrl'] },   // assigns the scene-three-emitted `let stepFx`
  { key: 'spriteSfx', anchor: 'post-step', script: spriteSfxChannelScript,
    normalizeIn: 'emitThreeWorld',     // assigns the scene-three-emitted `let stepSpriteSfx`
    sep: '' },                         // adjacent to fx on one template line (byte pin)
  { key: 'audio', anchor: 'post-overlays', script: audioChannelScript,
    normalizeIn: 'emitThreeWorld',     // capture-gated: never emitted on capture runs
    requiresOptional: ['__BUS', '__mojCtrl'] },   // + walkOn (a registry let) for the gait loop
  { key: 'game', anchor: 'post-capture', script: gameChannelScript,
    normalizeIn: 'emitThreeWorld',     // emitted in capture runs too — the envelope stays observable
    provides: ['__mojGame'],           // reads `_capture`, defined by the page one line earlier
    requiresOptional: ['__BUS'] },
];

// load-time contract assertion (S1): a row's hard `requires` must be provided by an
// EARLIER row in page order; a `requiresOptional` (typeof/null-guarded probe) needs a
// provider to exist SOMEWHERE in the catalog — the guard tolerates absence at runtime,
// but the name must still mean something. A row's `lets` names count as its provides
// (the runtime scaffold emits them unconditionally). Throws at import time, so a
// mis-declared row can never emit a page.
const channelPageOrder = () => [
  ...SETUP_CHANNELS.filter((r) => r.anchor === 'pre-runtime'),
  ...RUNTIME_CHANNELS,
  ...SETUP_CHANNELS.filter((r) => r.anchor !== 'pre-runtime'),
];
export const rowProvides = (r) => {
  const out = [...(r.provides || [])];
  for (const m of (r.lets || '').matchAll(/\blet\s+([^;]*)/g)) {
    for (const piece of m[1].split(',')) {
      const id = piece.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (id) out.push(id[1]);
    }
  }
  return out;
};
(function assertChannelContracts() {
  const rows = channelPageOrder();
  const seen = new Set();
  const all = new Set(rows.flatMap(rowProvides));
  for (const r of rows) {
    for (const q of r.requires || []) {
      if (!seen.has(q)) throw new Error(`channel contract: '${r.key}' requires '${q}' but no earlier row provides it`);
    }
    for (const q of r.requiresOptional || []) {
      if (!all.has(q)) throw new Error(`channel contract: '${r.key}' optionally requires '${q}' but no row provides it`);
    }
    for (const p of rowProvides(r)) seen.add(p);
  }
})();

// the page's SETUP sections (channel-registry-formalization S3): the blocks scene-three
// used to hand-splice, joined per anchor in registry order. `sep` is the separator emitted
// BEFORE a row when it is not the run's first (default '\n' — each block on its own
// template line; '' pins same-line adjacency). An absent block still contributes its
// separator, exactly as the old hand-wired template lines did — byte-identical by
// construction, held by the char net.
export function channelSetupSection(anchor, blocks) {
  return SETUP_CHANNELS
    .filter((r) => r.anchor === anchor)
    .map((r, i) => (i ? (r.sep ?? '\n') : '') + (blocks[r.key] || ''))
    .join('');
}

// normalize the uniform list channels in one sweep; bespoke channels add their blocks after.
export function normalizeRuntimeChannels(opts) {
  const lists = {}, blocks = {};
  for (const r of RUNTIME_CHANNELS) {
    if (!r.normalize) continue;
    const v = r.normalize(opts[r.key]);
    lists[r.key] = v;
    blocks[r.key] = v ? r.script(v) : '';
  }
  blocks.sphereRig = (lists.planets || lists.heatSpheres || lists.starSurfaces) ? sphereRigPreamble() : '';
  return { lists, blocks };
}

// the page's runtime section: comment header + inert let(s) + block, per row, in order.
export function channelRuntimeSection(blocks) {
  return RUNTIME_CHANNELS
    .map((r) => [...r.comment, ...(r.lets ? [r.lets] : []), blocks[r.key] || ''].join('\n'))
    .join('\n');
}

// the __mojStep body: every stepped row, registry order.
export function mojStepCalls() {
  return RUNTIME_CHANNELS.filter((r) => r.step).map((r) => r.step).join(' ');
}

// re-export the per-channel generators: the public surface of the pre-split channels.js.
export { glowSpriteScript } from './glow.js';
export { spriteSfxChannelScript } from './sprite-sfx.js';
export { specularChannelScript } from './specular.js';
export { pickChannelScript } from './pick.js';
export { signageChannelScript } from './signage.js';
export { tracerChannelScript } from './tracer.js';
export { cometChannelScript } from './comet.js';
export { moverChannelScript } from './mover.js';
export { fieldChannelScript } from './field.js';
export { physicsChannelScript } from './physics.js';
export { actionsChannelScript } from './actions.js';
export { controllableChannelScript } from './controllable/index.js';
export { surfaceChannelScript } from './surface.js';
export { sphereRigPreamble } from './sphere-rig.js';
export { heatSphereChannelScript } from './heat-sphere.js';
export { starSurfaceChannelScript } from './star-surface.js';
export { planetChannelScript } from './planet.js';
export { buildupChannelScript } from './buildup.js';
export { transportChannelScript } from './transport.js';
export { shadowDecalScript } from './shadow-decal.js';
export { inkDecalScript } from './ink-decal.js';
export { skyDomeScript } from './sky-dome.js';
export { waterMeshScript } from './water.js';
export { walkModeScript } from './walk.js';
export { deformChannelScript } from './deform.js';
export { eventsChannelScript } from './events.js';
export { audioChannelScript } from './audio.js';
export { fxChannelScript } from './fx.js';
export { gameChannelScript } from './game.js';
export { walkersChannelScript } from './walkers.js';
export { carsChannelScript } from './cars.js';
export { castShadowScript } from './cast-shadows.js';
