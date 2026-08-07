/**
 * emit-fixtures — the deterministic fixture matrix for emitThreeWorld
 * (renderer-emitter.plan.md E2a/E3). One entry per channel alone, plus the face-level
 * extras, capture variants, and two kitchen-sink combos. Shared by:
 *   • emit-channels.char.test.js — hash-pins every emission (the characterization net
 *     that proves the E2b registry refactor is byte-pure), and
 *   • the E3 parse gate — extracts each page's module script and parses it.
 *
 * Everything here must stay deterministic: fixed seeds, no Date/random, values chosen
 * once and never edited casually — editing a fixture invalidates its pinned hash, which
 * is only legitimate when a step SAYS emission changes.
 */

import { resolveWorldAudio } from '../beats/beats-world.js';

const quad = (fill = '#888888', extra = {}) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill, ...extra });
const floor = (fill = '#445566', extra = {}) => ({ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill, ...extra });

const PHYSICS = {
  gravity: [0, 0, -9.8],
  bodies: [
    { id: 'ball', collider: 'sphere', position: [0, 0, 5], radius: 0.5 },
    { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0 },
  ],
};

const EVENTS = {
  sources: [{ type: 'rest', when: { body: 'ball' } }],
  reactions: [{ on: 'rest', match: { body: 'ball' }, do: 'toggle', target: 'goal-light' }],
  entities: [{ id: 'goal-light', on: false }],
};

const GAME = {
  levelRef: 'orbit-1',
  consumes: [{ slice: 'bag', pick: { max: 2 } }],
  produces: { events: [{ type: 'grant', slice: 'bag', max: 3 }], results: ['success', 'fail', 'abort'] },
  presets: { default: { bag: { items: { potion: 1 } } } },
  on: { 'goal:*': { end: 'success' } },
};

const SOUNDTRACK = {
  kind: 'beats-ambient',
  title: 'hum',
  bpm: 84,
  seed: 7,
  progression: [{ chord: ['D3', 'F3', 'A3'], root: 'D2' }],
  channels: [{ name: 'pads', role: 'harmony', patch: 'pad' }],
};

const ENTITIES = [{ id: 'd', transform: { pos: [1, 1, 0], heading: 0 }, rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 0.6] } }];
const CAMERA = { rule: 'follow', target: 'd' };

const REPEATS = [{
  group: 'crates',
  template: [quad('#996633')],
  transforms: [
    { pos: [1, 1, 0] },
    { pos: [3, 2, 0], rotZ: 0.7, scale: 1.2, tint: [0.9, 0.8, 0.7] },
    { pos: [-2, 4, 0], scale: 0.8 },
  ],
}];

const FOG = {
  frag: 'precision highp float; uniform float uD; void main(){ if (uD < 0.5) { gl_FragColor = vec4(0.0); } else { gl_FragColor = vec4(0.1); } }',
  customUniforms: { uD: 0.4, uWind: [1, 2, 3] },
  dataTextures: { uBoxTex: { data: [0, 0, 0, 0], width: 1, height: 1 } },
};

// an effects[] overlay LAYER (game-ui-language.plan.md U3): same { frag, customUniforms,
// dataTextures } shape as fog, stacked over the world. This one is a glow (scalar uniform, no
// data texture) so the layer path is pinned distinctly from fog's textured occluder.
const EFFECT = {
  frag: 'precision highp float; uniform float uTime; void main(){ gl_FragColor = vec4(0.2, 0.9, 0.7, 0.25 + 0.1 * sin(uTime)); }',
  customUniforms: { uK: 0.6 },
  dataTextures: {},
};

const SIGNS = [
  { id: 's1', variant: 'tooltip', anchor: { kind: 'world', world: [1, 1, 2] }, text: 'a tip', body: [], chrome: { bg: '#111', color: '#fff', border: '1px solid #333', radius: '6px', shadow: 'none', glow: 'none', font: 'system-ui', fontSize: 12, fontWeight: 500, padding: '6px 8px' } },
  { id: 's2', variant: 'popup', anchor: { kind: 'slot', slot: 'top-left' }, text: 'p', body: ['line one', 'line two', 'line three', 'line four', 'line five'], pageLines: 2, chrome: { bg: '#182238', color: '#dfe9ff', border: 'none', radius: '8px', shadow: 'none', glow: 'none', font: 'system-ui', fontSize: 12, fontWeight: 400, padding: '8px 10px' } },
  { id: 's3', variant: 'toast', anchor: { kind: 'xy', xy: [40, 60] }, text: 'done!', body: [], after: 0.5, ttl: 1.5, chrome: { bg: '#0f2a18', color: '#baf5cd', border: 'none', radius: '6px', shadow: 'none', glow: 'none', font: 'system-ui', fontSize: 12, fontWeight: 500, padding: '6px 10px' } },
];

/** name → emitThreeWorld options. Order is stable; the char test iterates it. */
export const EMIT_FIXTURES = [
  ['bare', { faces: [quad()] }],

  // render-group machinery: hideable shell walls, x-ray cage, translucent group
  ['groups-cutaway', {
    faces: [
      quad('#8899aa', { group: 'shell:leftWall', normal: [1, 0, 0] }),
      quad('#8899aa', { group: 'shell:ceiling', normal: [0, 0, -1] }),
      floor('#556677', { group: 'shell:floor', normal: [0, 0, 1] }),
      quad('#aabbcc', { group: 'envelope', wireframe: true }),
      quad('#77cc88', { group: 'jelly', alpha: 0.4 }),
      quad('#999999'),
    ],
  }],

  // face-level extras: water pass, glow sprite, shadow decal, ink decal, textured face
  ['face-extras', {
    faces: [
      floor(),
      { ...floor('#336699'), water: true },
      quad('#ffdd88', { glow: '0 0 28px 9px rgba(255,221,136,0.8)' }),
      { ...floor('#000000'), decal: 'shadow' },
      { corners: [[0, 0, 0], [1, 0, 0], [1, 0.4, 0], [0, 0.4, 0]], fill: '#000000', decal: 'ink', inkAlpha: 0.7 },
      { ...quad('#cccccc'), texture: 'label', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    ],
    textures: { label: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
  }],

  ['sky-atmosphere', { faces: [floor()], sky: { zenith: [40, 80, 140], horizon: [200, 160, 120], day: 0.4, stars: 0.6, seed: 11, moon: { u: 0.3, h: 0.7, phase: 0.5 }, sun: { u: 0.6, h: 0.4 } } }],
  ['sky-space', { faces: [quad('#664433')], sky: { space: true, sun: { dir: [0.3, -0.5, 0.8] } } }],

  ['walk', { faces: [floor()], walk: true }],
  ['walk-tuned', { faces: [floor()], walk: { speed: 8, spawn: [1, 1, 1.6], radius: 0.4 } }],

  ['picks', { faces: [quad()], picks: [{ name: 'static', label: 'Thing', fields: [{ k: 'mass', v: '3 kg' }] }] }],
  ['signs', { faces: [quad()], signs: SIGNS }],

  ['tracers', { faces: [quad()], tracers: [{ path: [[0, 0, 0], [1, 0, 1], [2, 0, 0]], color: '#88ddff', size: 0.3, period: 2 }] }],
  ['movers', { faces: [floor()], movers: [{ label: 'cart', path: [[0, 0, 0.5], [1, 0, 0.5], [2, 0, 0.5], [3, 0, 0.5]], dt: 0.1, size: 0.4 }] }],
  ['planets', { faces: [floor()], planets: [
    { group: 'central', center: [0, 0, 0], radius: 2, tint: [1, 0.8, 0.42], star: true, spin: 0.05, bands: 0 },
    { group: 'body:earth', center: [0, 0, 0], radius: 0.6, tint: [0.36, 0.56, 0.84], spin: 0.6, seed: 1.7, freq: 6, bands: 0.55, mottle: 0.2 },
  ], movers: [{ group: 'body:earth', path: [[7, 0, 0], [0, 7, 0], [-7, 0, 0], [0, -7, 0], [7, 0, 0]], basePos: [0, 0, 0], period: 5, loop: true, track: true }] }],
  ['comets', { faces: [quad('#111122')], comets: [{ path: [[4, 0, 0], [3, 2, 0], [0, 4, 0], [-3, 2, 0]], sun: [0, 0, 0] }] }],
  ['fields', { faces: [floor()], fields: [{ sets: [], readout: ['field', 'E = 0'] }] }],
  ['surfaces', { faces: [floor()], surfaces: [{ grid: { nx: 3, ny: 3, x0: 0, y0: 0, dx: 1, dy: 1, z: 0.2 }, waves: [{ amp: 0.2, len: 2, speed: 1, dir: [1, 0] }] }] }],
  ['heat-sphere', { faces: [floor()], heatSpheres: [{ radius: 1.2, center: [2, 2, 2], coeffs: [{ l: 1, m: 0, a: 0.5, k: 0.1 }] }] }],
  ['star-surface', { faces: [floor()], starSurfaces: [{ radius: 2, center: [2, 2, 3], Tbase: 5772, seed: 3 }] }],
  ['buildups', { faces: [quad()], buildups: [{ positions: [0, 0, 0, 1, 0, 0, 1, 1, 0], rate: 40 }] }],
  ['transports', { faces: [floor()], transports: [{ loop: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], vectors: [[1, 0, 0], [0.9, 0.1, 0]] }] }],
  ['deforms', { faces: [quad('#aa8866', { group: 'sheet' })], deforms: [{ group: 'sheet', to: [[1, 0.3, 0], [0, 1, 0], [0, 0, 1]], period: 3 }] }],

  ['physics', { faces: [floor()], physics: PHYSICS }],
  ['physics-actions', { faces: [floor()], physics: PHYSICS, actions: [{ do: 'impulse', on: 'key:Space', body: 'ball', impulse: [0, 0, 4] }] }],
  ['events', { faces: [floor()], physics: PHYSICS, events: EVENTS }],

  ['controllable', { faces: [floor()], entities: ENTITIES, camera: CAMERA }],
  // suit contact shadows: the opt-in blob-decal block interpolated into the controllable channel.
  // Every other controllable fixture omits `shadows` ⇒ their bytes are untouched (the opt-in pin).
  ['controllable-shadows', { faces: [floor()], entities: ENTITIES, camera: CAMERA, shadows: true }],
  // cast shadows: the opt-in scene-level shadow-map channel (real silhouettes off every opaque
  // mass + body; channels/cast-shadows.js). `shadows.cast` swaps the controllable blob for the
  // caster/follow integration; the blob fixture above stays byte-identical (the opt-in pin).
  ['cast-shadows', { faces: [floor()], entities: ENTITIES, camera: CAMERA, shadows: { cast: true } }],
  // projectile smoke: the opt-in trail/burst puff block. Same opt-in discipline as shadows.
  ['controllable-smoke', { faces: [floor()], entities: ENTITIES, camera: CAMERA, smoke: true }],
  ['controllable-figure', {
    faces: [floor()],
    entities: [{ id: 'guy', transform: { pos: [1, 1, 0], heading: 0 }, rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'guy' } }],
    figures: { guy: [{ faces: [quad('#cc9977')] }, { faces: [quad('#cc9977')] }] },
  }],
  // hangar menu: pins the hangar-PRESENT emission (hangarStepperBlock + the input hangarHook),
  // which no other fixture reaches — before this row it rode gitignored spike gens only
  // (channel-registry-formalization.plan.md amendment, pre-S2). Nested suits[i].liveries[j]
  // model: each livery id names an entity; ms-a carries two liveries + a loadout.
  ['controllable-hangar', {
    faces: [floor()],
    entities: [
      { id: 'ms-a', transform: { pos: [1, 1, 0], heading: 0 }, rule: { type: 'glide', loadout: [{ name: 'RIFLE' }, { name: 'BLADE' }] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 0.6] } },
      { id: 'ms-a-red', transform: { pos: [1, 1, 0], heading: 0 }, rule: { type: 'glide', loadout: [{ name: 'RIFLE' }, { name: 'BLADE' }] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 0.6] } },
      { id: 'ms-b', transform: { pos: [2, 1, 0], heading: 0 }, rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 0.9] } },
    ],
    camera: { rule: 'follow', target: 'ms-a' },
    hangar: { suits: [
      { id: 'ms-a', name: 'MK I', liveries: [{ id: 'ms-a', name: 'FACTORY', color: '#8899aa' }, { id: 'ms-a-red', name: 'CRIMSON', color: '#aa3333' }] },
      { id: 'ms-b', name: 'MK II' },
    ] },
  }],

  // specular channel (material-response P2): faces carrying `spec: [strength, power]` gate the
  // live Blinn-Phong block (and __specPatch). Before this row NO fixture emitted it — found by
  // the channels.contract.test.js provides check (channel-registry-formalization amendment).
  ['specular', { faces: [floor(), { ...quad('#8899aa'), spec: [0.8, 24] }], light: { toLight: [0.4, -0.5, 0.75] } }],

  ['fog', { faces: [floor()], fog: FOG }],
  // effects[] (U3): stacked raymarch overlays. `effects` alone (live); `fog-effects` co-resident +
  // capture (pins the fog quad + effect quad + the frame() __mojClock overlay-clock pin together).
  ['effects', { faces: [floor()], effects: [EFFECT] }],
  ['fog-effects', { faces: [floor()], fog: FOG, effects: [EFFECT, EFFECT], capture: true }],
  ['audio', { faces: [floor()], audio: resolveWorldAudio({ soundtrack: SOUNDTRACK, wind: true, footsteps: true }) }],
  ['game', { faces: [floor()], game: GAME }],
  // fx (game-ui-language.plan.md U2): standing states + one-shot gestures on entities by id.
  // No events here → the bus-wrap path stays inert (pins the no-__BUS branch); the with-bus
  // branch is pinned by kitchen-sink, which co-resides fx with events + controllable.
  ['fx', { faces: [floor()], entities: ENTITIES, fx: { states: { d: 'float' }, on: { 'goal:*': 'burst' } } }],
  // sprite sfx (game-ui-language.plan.md §V): the geometry sfx backend — additive-sprite verb
  // shelf, one pool per layer, driven by __mojStep. Resolved layers (cc, not at). Pins the channel
  // emission; absent spriteSfx ⇒ byte-identical (every other fixture omits it, unchanged).
  ['sprite-sfx', { faces: [floor()], spriteSfx: [
    { verb: 'sparkle', cc: [0, 0, 0], color: [1, 0.95, 0.7], rate: 1, size: 0.6 },
    { verb: 'ward', cc: [3, 0, 0], color: [1, 0.5, 0.2], rate: 1, size: 0.6 },
    { verb: 'beacon', cc: [-3, 0, 0], color: [0.27, 0.77, 0.41], rate: 1, size: 0.6 },
  ] }],

  ['repeats', { faces: [floor()], repeats: REPEATS }],
  ['ao', { faces: [quad('#8899aa', { group: 'shell:leftWall', normal: [1, 0, 0] }), floor()], ao: true }],
  ['ao-repeats', { faces: [floor()], repeats: REPEATS, ao: { strength: 0.8, radius: 1.2 } }],

  ['wireframe', { faces: [quad()], wireframe: true }],
  ['cdn', { faces: [quad()], cdn: true }],
  ['capture-bare', { faces: [floor()], capture: true }],
  ['capture-controllable', { faces: [floor()], entities: ENTITIES, camera: CAMERA, capture: true }],

  // the two combos: every major channel co-resident, live + capture
  ['kitchen-sink', {
    faces: [
      quad('#8899aa', { group: 'shell:leftWall', normal: [1, 0, 0] }),
      floor('#556677', { group: 'shell:floor', normal: [0, 0, 1] }),
      { ...floor('#336699'), water: true },
      quad('#ffdd88', { glow: '0 0 28px 9px rgba(255,221,136,0.8)' }),
      quad('#999999'),
    ],
    sky: { zenith: [40, 80, 140], horizon: [200, 160, 120], day: 0.4, stars: 0.6, seed: 11 },
    walk: true,
    picks: [{ name: 'shell:leftWall', label: 'Wall', fields: [] }],
    signs: SIGNS,
    tracers: [{ path: [[0, 0, 0], [1, 0, 1], [2, 0, 0]] }],
    movers: [{ label: 'cart', path: [[0, 0, 0.5], [1, 0, 0.5], [2, 0, 0.5]], dt: 0.1 }],
    surfaces: [{ grid: { nx: 3, ny: 3, x0: 0, y0: 0, dx: 1, dy: 1, z: 0.2 }, waves: [{ amp: 0.2, len: 2, speed: 1, dir: [1, 0] }] }],
    heatSpheres: [{ radius: 1.2, center: [2, 2, 2], coeffs: [{ l: 1, m: 0, a: 0.5, k: 0.1 }] }],
    starSurfaces: [{ radius: 2, center: [-2, -2, 3], Tbase: 5772, seed: 3 }],
    deforms: [{ group: 'static', to: [[1, 0.3, 0], [0, 1, 0], [0, 0, 1]], period: 3 }],
    physics: PHYSICS,
    actions: [{ do: 'impulse', on: 'key:Space', body: 'ball', impulse: [0, 0, 4] }],
    events: EVENTS,
    entities: ENTITIES,
    camera: CAMERA,
    fog: FOG,
    effects: [EFFECT],
    audio: resolveWorldAudio({ soundtrack: SOUNDTRACK, wind: true }),
    fx: { states: { d: 'shimmer' }, on: { 'goal:*': 'ghost' } },
    game: GAME,
    repeats: REPEATS,
    ao: true,
  }],
  ['kitchen-sink-capture', null], // filled below: same options + capture:true
];

// the capture twin shares the exact live options object (capture flag aside), so the
// audio-suppressed / game-inert capture semantics are pinned against the SAME payload.
EMIT_FIXTURES[EMIT_FIXTURES.length - 1][1] = { ...EMIT_FIXTURES[EMIT_FIXTURES.length - 2][1], capture: true };
