/**
 * Wave manji end-to-end bridge test.
 *
 * Proves the full pipeline works: createManjiTreeHandler accepts a
 * waveManji array, the validator runs at mint time, the manifest
 * persists, and renderManjiTreeToSvg projects + draws the printed
 * polylines into the final SVG.
 */

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createManjiTreeHandler } from './manji-trees.js';
import { renderManjiTreeToSvg } from '@/lib/graph/polygonizer/manji-svg.js';

beforeEach(() => {
  closeDb();
});

function singleSlotScene() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [{ id: 'center', position: { x: 0, y: 0, z: 0 } }],
  };
}

const PHYSICS = {
  gravity: { x: 0, y: 0, z: -1 },
  gravityStrength: 1,
  defaultSagFactor: 0.12,
};

describe('wave manji bridge — mint → store → render', () => {
  it('renders an ouroboros wave manji pinned to a slot', async () => {
    const result = await createManjiTreeHandler({
      title: 'ouroboros-bridge',
      dimensions: '3d',
      tree: singleSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      waveManji: [
        { singularity: 'world/slot/center', script: 'ouroboros', params: { radius: 5 } },
      ],
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    expect(sketch).toBeTruthy();
    expect(sketch.manifest.waveManji).toHaveLength(1);
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<svg/);
    // The printer emits at least one polyline; the renderer draws each
    // polyline as a sequence of <line> elements.
    expect(svg).toMatch(/<line /);
  });

  it('renders multiple wave manji of different archetypes in one scene', async () => {
    const result = await createManjiTreeHandler({
      title: 'wave-manji-mixed-bridge',
      dimensions: '3d',
      tree: singleSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      waveManji: [
        { singularity: 'world/slot/center', script: 'mandala',  params: { N: 6, radius: 3 } },
        { singularity: { x: 8, y: 0, z: 0 }, script: 'celtic',  params: { p: 2, q: 3 } },
        { singularity: { x: -8, y: 0, z: 0 }, script: 'cloud',  seed: 'fixed-1', density: 6 },
      ],
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    expect(sketch.manifest.waveManji).toHaveLength(3);
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<line /);
  });

  it('rejects an unknown wave manji script at mint time', async () => {
    await expect(
      createManjiTreeHandler({
        title: 'bad-script',
        dimensions: '3d',
        tree: singleSlotScene(),
        physics: PHYSICS,
        waveManji: [{ singularity: 'world/slot/center', script: 'not-real' }],
      }),
    ).rejects.toThrow(/Invalid manji-tree wave manji/);
  });

  it('rejects a wave manji array in 2D mode', async () => {
    await expect(
      createManjiTreeHandler({
        title: '2d-with-waves',
        dimensions: '2d',
        tree: singleSlotScene(),
        waveManji: [{ singularity: { x: 0, y: 0, z: 0 }, script: 'ouroboros' }],
      }),
    ).rejects.toThrow(/3D only/);
  });

  // ── in-tree wave-manji leaf ─────────────────────────────────────────
  //
  // Authoring a wave-manji as a `kind: 'wave-manji'` child of a manji
  // tree node should produce the same rendered SVG as authoring the
  // same spec via the top-level `waveManji[]` array. Bridge test the
  // claim made in lite-template/integration/0605/wave-manji-as-leaf.plan.md.

  it('renders an in-tree wave-manji leaf', async () => {
    const result = await createManjiTreeHandler({
      title: 'in-tree-ouroboros',
      dimensions: '3d',
      tree: {
        ...singleSlotScene(),
        children: [
          {
            slot: 'center',
            node: {
              kind: 'wave-manji',
              singularity: 'self/slot/center',
              script: 'ouroboros',
              params: { radius: 5 },
            },
          },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    expect(sketch).toBeTruthy();
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<svg/);
    expect(svg).toMatch(/<line /);
  });

  it('in-tree wave-manji renders byte-identical to top-level waveManji array', async () => {
    const arraySpec = {
      singularity: 'world/slot/center',
      script: 'mandala',
      params: { N: 6, radius: 3, lobeDepth: 0.5 },
      style: { stroke: '#22a', width: 1.0 },
    };
    const fromArray = await createManjiTreeHandler({
      title: 'array-mandala',
      dimensions: '3d',
      tree: singleSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      waveManji: [arraySpec],
    });
    const fromTree = await createManjiTreeHandler({
      title: 'tree-mandala',
      dimensions: '3d',
      tree: {
        ...singleSlotScene(),
        children: [
          {
            slot: 'center',
            node: {
              kind: 'wave-manji',
              singularity: 'self/slot/center',
              script: 'mandala',
              params: { N: 6, radius: 3, lobeDepth: 0.5 },
              style: { stroke: '#22a', width: 1.0 },
            },
          },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
    });
    const arraySvg = renderManjiTreeToSvg(
      SketchRepository.getByRef(fromArray.ref).manifest,
    );
    const treeSvg = renderManjiTreeToSvg(
      SketchRepository.getByRef(fromTree.ref).manifest,
    );
    // Strip the title text (the only legitimate difference) so the
    // wave-manji geometry is what's being compared.
    const stripTitle = (s) => s.replace(/<text [\s\S]*?<\/text>/, '');
    expect(stripTitle(treeSvg)).toBe(stripTitle(arraySvg));
  });

  it('shelf card programRef inlines its wave-manji leaf at the host slot', async () => {
    const result = await createManjiTreeHandler({
      title: 'golden-spiral-shelf',
      dimensions: '3d',
      tree: {
        ...singleSlotScene(),
        children: [
          { slot: 'center', node: { programRef: 'golden-spiral' } },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<line /);
    // Golden-spiral card uses #a60 stroke; presence proves the leaf
    // actually painted rather than silently dropping.
    expect(svg).toContain('stroke="#a60"');
  });

  // ── field-borne bending ─────────────────────────────────────────────
  //
  // Cross-primitive modulation: `waveManji[].bending` can be authored as
  // a field reference instead of a literal. The substrate evaluates the
  // field at the wave manji's singularity position and substitutes the
  // resulting scalar into the bending knob. See
  // lite-template/integration/0605/cross-primitive-fields.plan.md.

  function twoSlotScene() {
    return {
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [
        { id: 'center', position: { x: 0, y: 0, z: 0 } },
        { id: 'far',    position: { x: 10, y: 0, z: 0 } },
      ],
    };
  }

  it('field-borne bending: two wave manji read different intensities from one radial field', async () => {
    // A radial field centered at world/slot/center: innerValue=3.0 within
    // r<=1, outerValue=0.5 past r>=8. The wave-manji at the center reads
    // 3.0 (tight); the wave-manji at world/slot/far (r=10) reads 0.5 (loose
    // — clamped to outerValue since beyond defaults to 'clamp').
    //
    // The rasengan archetype caps maxRadius by 1/bending, so the tight
    // wave-manji's outer reach should be much smaller than the loose one's.
    const result = await createManjiTreeHandler({
      title: 'field-borne-bending',
      dimensions: '3d',
      tree: twoSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      fields: {
        'vortex-zone': {
          kind: 'radial',
          center: 'world/slot/center',
          innerRadius: 1, innerValue: 3.0,
          outerRadius: 8, outerValue: 0.5,
        },
      },
      waveManji: [
        { singularity: 'world/slot/center', script: 'rasengan',
          bending: { field: 'vortex-zone' }, density: 8,
          params: { initialRadius: 0.1, maxRadius: 2.0 } },
        { singularity: 'world/slot/far', script: 'rasengan',
          bending: { field: 'vortex-zone' }, density: 8,
          params: { initialRadius: 0.1, maxRadius: 2.0 } },
      ],
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    expect(sketch.manifest.fields).toBeDefined();
    expect(sketch.manifest.fields['vortex-zone'].kind).toBe('radial');
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<line /);
  });

  it('field-borne bending matches a literal bending equal to the field value', async () => {
    // Renders A: bending: 3.0 (literal)
    // Renders B: bending: { field: 'pinned' } where pinned.value = 3.0
    // The two should produce byte-identical wave-manji geometry.
    const literal = await createManjiTreeHandler({
      title: 'literal',
      dimensions: '3d',
      tree: singleSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      waveManji: [
        { singularity: 'world/slot/center', script: 'rasengan',
          bending: 3.0, density: 8, params: { initialRadius: 0.1, maxRadius: 2.0 } },
      ],
    });
    const fieldBacked = await createManjiTreeHandler({
      title: 'field-backed',
      dimensions: '3d',
      tree: singleSlotScene(),
      physics: PHYSICS,
      showSlotMarkers: false,
      fields: { pinned: { kind: 'constant', value: 3.0 } },
      waveManji: [
        { singularity: 'world/slot/center', script: 'rasengan',
          bending: { field: 'pinned' }, density: 8, params: { initialRadius: 0.1, maxRadius: 2.0 } },
      ],
    });
    const a = renderManjiTreeToSvg(SketchRepository.getByRef(literal.ref).manifest);
    const b = renderManjiTreeToSvg(SketchRepository.getByRef(fieldBacked.ref).manifest);
    const stripTitle = (s) => s.replace(/<text [\s\S]*?<\/text>/, '');
    expect(stripTitle(b)).toBe(stripTitle(a));
  });

  it('rejects a bending field reference whose id is undeclared', async () => {
    await expect(
      createManjiTreeHandler({
        title: 'bad-field-ref',
        dimensions: '3d',
        tree: singleSlotScene(),
        physics: PHYSICS,
        fields: { other: { kind: 'constant', value: 1 } },
        waveManji: [
          { singularity: 'world/slot/center', script: 'rasengan',
            bending: { field: 'no-such' } },
        ],
      }),
    ).rejects.toThrow(/unknown field 'no-such'/);
  });

  // ── shelf-card-declared fields ──────────────────────────────────────
  //
  // A shelf card can declare its own `fields` block inside `manjiProgram`.
  // The walker emits those fields as side-channel records during
  // container-preset inlining; the renderer and mint validator merge
  // them with the host manifest's `fields`. Host wins on collisions;
  // inter-card collisions throw. See
  // lite-template/integration/0605/shelf-cards-declare-fields.plan.md.

  it('vortex-singularity card renders with NO host-declared fields', async () => {
    // The whole point: the card is self-contained. Invoking it via
    // programRef in a host that provides only a `center` slot produces
    // a field-coupled tusk without any manifest-level field setup.
    const result = await createManjiTreeHandler({
      title: 'vortex-shelf-card-only',
      dimensions: '3d',
      tree: {
        ...singleSlotScene(),
        children: [
          { slot: 'center', node: { programRef: 'vortex-singularity' } },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
    });
    expect(result.ok).toBe(true);
    const sketch = SketchRepository.getByRef(result.ref);
    // No host fields — the card supplied its own.
    expect(sketch.manifest.fields).toBeUndefined();
    const svg = renderManjiTreeToSvg(sketch.manifest);
    expect(svg).toMatch(/<line /);
    // Card stroke #a60 proves the tusk leaf painted.
    expect(svg).toContain('stroke="#a60"');
  });

  it('host-declared field with the same id overrides the card-declared one', async () => {
    // Render A: pure shelf invocation, card's vortex-zone takes effect
    //           (innerValue 2.0 → tight tusk).
    // Render B: host declares vortex-zone with innerValue 0.4 → loose.
    // Bending caps maxRadius by 1/bending, so the outer reach differs;
    // A's outer extent should be smaller than B's.
    const shelfOnly = await createManjiTreeHandler({
      title: 'shelf-only',
      dimensions: '3d',
      tree: {
        ...singleSlotScene(),
        children: [
          { slot: 'center', node: { programRef: 'vortex-singularity' } },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
    });
    const hostOverrides = await createManjiTreeHandler({
      title: 'host-override',
      dimensions: '3d',
      tree: {
        ...singleSlotScene(),
        children: [
          { slot: 'center', node: { programRef: 'vortex-singularity' } },
        ],
      },
      physics: PHYSICS,
      showSlotMarkers: false,
      fields: {
        'vortex-zone': {
          kind: 'radial',
          center: 'world/slot/center',
          innerRadius: 0.5, innerValue: 0.4,
          outerRadius: 8.0, outerValue: 0.3,
        },
      },
    });
    expect(shelfOnly.ok).toBe(true);
    expect(hostOverrides.ok).toBe(true);
    const a = renderManjiTreeToSvg(SketchRepository.getByRef(shelfOnly.ref).manifest);
    const b = renderManjiTreeToSvg(SketchRepository.getByRef(hostOverrides.ref).manifest);
    // The two renders should be DIFFERENT — host override changed
    // bending. Same physics, same slot, same card, different field.
    expect(a).not.toBe(b);
  });

  it('twice-invoking a field-declaring card throws with the v1-limitation message', async () => {
    // v1 has no per-invocation namespacing for card-declared fields,
    // so invoking vortex-singularity twice in one scene would emit
    // two `vortex-zone` declarations and silently override the first.
    // The walker throws instead, surfacing the limitation explicitly.
    await expect(
      createManjiTreeHandler({
        title: 'twice-vortex',
        dimensions: '3d',
        tree: {
          id: 'world',
          spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
          anchor: { x: 0, y: 0, z: 0 },
          slots: [
            { id: 'a', position: { x: -5, y: 0, z: 0 } },
            { id: 'b', position: { x:  5, y: 0, z: 0 } },
          ],
          children: [
            { slot: 'a', node: { programRef: 'vortex-singularity',
              pathBindings: { 'self/slot/center': 'world/slot/a' } } },
            { slot: 'b', node: { programRef: 'vortex-singularity',
              pathBindings: { 'self/slot/center': 'world/slot/b' } } },
          ],
        },
        physics: PHYSICS,
        showSlotMarkers: false,
      }),
    ).rejects.toThrow(/emitted twice|namespacing is a follow-up/);
  });

  it('rejects an invalid fields declaration at mint time', async () => {
    await expect(
      createManjiTreeHandler({
        title: 'bad-fields',
        dimensions: '3d',
        tree: singleSlotScene(),
        physics: PHYSICS,
        fields: {
          bad: { kind: 'radial', center: 'world/slot/missing',
            innerRadius: 1, innerValue: 2, outerRadius: 5, outerValue: 0.5 },
        },
      }),
    ).rejects.toThrow(/Invalid manji-tree fields|slot 'missing'/);
  });

  it('rejects an in-tree wave-manji leaf whose singularity path is unresolvable', async () => {
    await expect(
      createManjiTreeHandler({
        title: 'bad-leaf-path',
        dimensions: '3d',
        tree: {
          ...singleSlotScene(),
          children: [
            {
              slot: 'center',
              node: {
                kind: 'wave-manji',
                singularity: 'self/slot/no-such-slot',
                script: 'ouroboros',
              },
            },
          ],
        },
        physics: PHYSICS,
      }),
    ).rejects.toThrow(/wave-manji.*singularity|leaf marks/);
  });
});
