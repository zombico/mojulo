import { describe, expect, it } from 'vitest';

import { resolveWorldScene } from './world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { buildCradles } from './games/newton-cradles.js';

// resolveWorldScene takes a stored-sketch-like { manifest, title }. orbit-view is a pure assembler
// (no DB / no textures), so it exercises the generic motion layer without touching SketchRepository.
const sketch = (manifest) => ({ manifest, title: 'test' });

describe('world-scene — generic opt-in motion layer', () => {
  it('leaves a payload untouched when the manifest carries no `motion`', async () => {
    const a = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    const b = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(JSON.stringify(a.payload.movers)).toBe(JSON.stringify(b.payload.movers));
  });

  it('appends placed movers from a `motion` spec to ANY world', async () => {
    const base = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    const withMotion = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      motion: [{ rule: 'free-fall', params: { height: 10 }, at: [30, 0, 0], group: 'drop' }],
    }));
    expect(withMotion.payload.movers.length).toBe(base.payload.movers.length + 1);
    const drop = withMotion.payload.movers.find((m) => m.group === 'drop');
    expect(drop).toBeTruthy();
    expect(drop.path[0]).toEqual([30, 0, 10]);   // free-fall starts at [0,0,H], placed at [30,0,0]
  });

  it('works on a world kind that has no movers of its own (motion is the only mover source)', async () => {
    const withMotion = await resolveWorldScene(sketch({
      kind: 'molecule-view',
      atoms: [{ symbol: 'C', pos: [0, 0, 0] }, { symbol: 'O', pos: [1.2, 0, 0] }],
      motion: [{ rule: 'pendulum', params: { length: 8 }, at: [0, 0, 0], loop: true }],
    }));
    expect(Array.isArray(withMotion.payload.movers)).toBe(true);
    expect(withMotion.payload.movers.length).toBe(1);
    expect(withMotion.payload.movers[0].loop).toBe(true);
  });

  it('skips an unknown rule name without breaking the render', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      motion: [{ rule: 'teleport', at: [0, 0, 0] }],
    }));
    const base = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(out.payload.movers.length).toBe(base.payload.movers.length);   // nothing appended
  });
});

describe('world-scene — controllable channel passthrough', () => {
  it('passes manifest entities + camera onto the payload and flags nonBakeable', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      entities: [{ id: 'd', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } }],
      camera: { rule: 'follow', target: 'd' },
    }));
    expect(out.payload.entities.length).toBe(1);
    expect(out.payload.camera.rule).toBe('follow');
    expect(out.payload.nonBakeable).toBe(true);
  });

  it('leaves a payload untouched when no entities are declared', async () => {
    const out = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(out.payload.entities).toBeUndefined();
    expect(out.payload.camera).toBeUndefined();
  });

  it('renders a STANDALONE controllable world (kind:controllable) with no other kind', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'controllable',
      entities: [{ id: 'drone', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } }],
      camera: { rule: 'follow', target: 'drone' },
    }));
    expect(out.kind).toBe('controllable');
    expect(out.payload).toBeTruthy();              // standalone stage produced a payload (not 422)
    expect(out.payload.faces.length).toBeGreaterThan(0);   // default floor
    expect(out.payload.entities.length).toBe(1);
    expect(out.payload.nonBakeable).toBe(true);
  });

  it('bakes a figure-frames figure spec at resolve time (recipe → frames)', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'male' } }],
      figures: { male: { motion: 'walk', proto: 'male', frames: 2 } },
    }));
    expect(out.payload.figures.male.length).toBe(2);             // baked to 2 frames
    expect(Array.isArray(out.payload.figures.male[0].faces)).toBe(true);
  });
});

describe('world-scene — events channel passthrough', () => {
  it('passes a manifest events block (reactions) onto the payload and flags nonBakeable', async () => {
    const events = {
      sources: [{ type: 'rest', when: { body: 'ball' } }],
      reactions: [{ on: 'rest', match: { body: 'ball' }, do: 'toggle', target: 'goal' }],
      entities: [{ id: 'goal', on: false }],
    };
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      physics: { gravity: [0, 0, -9.8], bodies: [{ id: 'ball', collider: 'sphere', position: [0, 0, 4] }] },
      events,
    }));
    expect(out.payload.events).toEqual(events);
    expect(out.payload.nonBakeable).toBe(true);
  });

  it('passes an events block carrying only sequences (no reactions)', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      events: { sequences: [{ id: 's', trigger: { on: 'go' }, steps: [{ do: 'toggle', target: 'x' }] }] },
    }));
    expect(out.payload.events).toBeTruthy();
    expect(out.payload.nonBakeable).toBe(true);
  });

  it('leaves a payload untouched when no events are declared, or events are inert', async () => {
    const none = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(none.payload.events).toBeUndefined();
    // a sources-only block with nothing listening is inert → not attached.
    const inert = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular', events: { sources: [{ type: 'rest' }] } }));
    expect(inert.payload.events).toBeUndefined();
  });

  it('end-to-end: a STORED cradle manifest resolves and emits a live /world page with all channels', async () => {
    // The whole abstraction: an operator persists this manifest; the world route resolves it through
    // kind dispatch and emits the page — no bespoke per-world code. `controllable` hosts the stage.
    const { physics, events, actions, faces } = buildCradles();
    const out = await resolveWorldScene(sketch({ kind: 'controllable', faces, physics, events, actions }));
    expect(out.payload.physics).toBeTruthy();
    expect(out.payload.events).toBeTruthy();
    expect(out.payload.nonBakeable).toBe(true);
    const html = emitThreeWorld({ ...out.payload });
    expect(html).toContain('window.__mojBus');   // bus channel
    expect(html).toContain('window.__mojSim');   // physics channel
    expect(html).toContain('linkPhysics');       // 5b rig bridge
  });
});

describe('world-scene — generic opt-in volumetric fog (P3.5)', () => {
  const city = (extra) => sketch({ kind: 'fractal-city', region: { x: 0, y: 0, w: 40, d: 28 }, depth: 2, seed: 1, ...extra });

  it('leaves the payload fog-free when the manifest carries no `fog`', async () => {
    const { payload } = await resolveWorldScene(city());
    expect(payload.fog).toBeUndefined();
  });

  it('attaches a fog effect (overlay frag + box-field data textures) when `fog:true`', async () => {
    const { payload } = await resolveWorldScene(city({ fog: true }));
    expect(payload.fog).toBeTruthy();
    expect(payload.fog.frag).toContain('sdfScene');           // grid-culled scene-SDF occluder
    expect(payload.fog.frag).toContain('gl_FragColor');
    expect(payload.fog.dataTextures.uBoxTex.width).toBe(2);    // baked box field
    expect(payload.fog.dataTextures.uCellTex).toBeTruthy();    // grid index
    expect(payload.fog.customUniforms.uBoxCount).toBeGreaterThan(0);
  });

  it('passes a fog tuning object through to composeVolumeFog', async () => {
    const { payload } = await resolveWorldScene(city({ fog: { maxDist: 90 } }));
    expect(payload.fog.customUniforms.uMaxDist).toBe(90);
  });

  it('ignores `fog` on a kind with no registered occluder boxes', async () => {
    const { payload } = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular', fog: true }));
    expect(payload.fog).toBeUndefined();
  });
});

describe('world-scene — painted-landscape raymarch backend (?render=raymarch)', () => {
  const land = (extra) => sketch({ kind: 'painted-landscape', heartbeat: 'chop', splatch: 'verdure-trio', ...extra });

  it('renders the polygon mesh by default (no raymarch payload)', async () => {
    const { payload } = await resolveWorldScene(land());
    expect(payload.raymarch).toBeUndefined();
    expect(Array.isArray(payload.faces)).toBe(true);
  });

  it('swaps to a raymarch payload when render:"raymarch" is requested', async () => {
    const { payload } = await resolveWorldScene(land(), { render: 'raymarch' });
    expect(payload.raymarch).toBeTruthy();
    expect(payload.raymarch.frag).toContain('sdfScene');       // terrain/water SDF
    expect(payload.raymarch.frag).toContain('gl_FragColor');
    expect(payload.raymarch.frag).toContain('float H(vec2 w)'); // painted-landscape height field
    expect(payload.faces).toBeUndefined();                     // mesh channels dropped for the shader world
  });

  it('ports the fbm heartbeat engine too', async () => {
    const { payload } = await resolveWorldScene(land({ heartbeat: 'rocky-irregular' }), { render: 'raymarch' });
    expect(payload.raymarch.frag).toContain('float H(vec2 w)');
  });
});

describe('world-scene — painted-landscape raymarch forest', () => {
  it('carries an SDF-tree instance layer (data texture + count) when the manifest has a forest', async () => {
    const { payload } = await resolveWorldScene(
      sketch({ kind: 'painted-landscape', heartbeat: 'chop', splatch: 'meadow-trio', waterLevel: -0.55, forest: { density: 0.5 } }),
      { render: 'raymarch' },
    );
    expect(payload.raymarch.frag).toContain('float sdfTree');
    expect(payload.raymarch.frag).toContain('instanceField');
    expect(payload.raymarch.dataTextures.uTreeTex.width).toBeGreaterThan(0);   // baked tree positions
    expect(payload.raymarch.customUniforms.uTreeCount).toBeGreaterThan(0);
  });
});
