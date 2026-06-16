process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createManjiTreeHandler } from './manji-trees.js';
import { renderManjiTreeToSvg } from '@/lib/graph/polygonizer/manji-svg';

beforeEach(() => {
  closeDb();
});

function snowflakeTree() {
  return {
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
      bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
    },
    slotPattern: { id: 'ring-N', params: { n: 6, radius: 1 } },
    slotLabels: ['arm-0', 'arm-1', 'arm-2', 'arm-3', 'arm-4', 'arm-5'],
    centerSlotId: 'center',
    scale: 4,
    children: [
      'center', 'arm-0', 'arm-1', 'arm-2', 'arm-3', 'arm-4', 'arm-5',
    ].map((slot) => ({
      slot,
      node: {
        inlineProgram: {
          bar1: { rotationDeg: 0, lengthScale: 0.4 },
          bar2: { rotationDeg: 90, lengthScale: 0.4 },
        },
      },
    })),
  };
}

function single3DTree() {
  return {
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' }, lengthScale: 8 },
      bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' }, lengthScale: 8 },
      bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' }, lengthScale: 4 },
    },
    anchor: { x: 0, y: -10, z: 1 },
    slots: [],
  };
}

describe('create_manji_tree (2D)', () => {
  it('mints a manji-tree manifest into SketchRepository with kind: manji-tree', async () => {
    const result = await createManjiTreeHandler({
      title: 'snowflake test',
      tree: snowflakeTree(),
      dimensions: '2d',
      ref: 'mt_snow_2d',
    });
    expect(result.ok).toBe(true);
    expect(result.ref).toBe('mt_snow_2d');
    expect(result.url).toBe('/sketches/mt_snow_2d');
    expect(result.svgUrl).toBe('/api/sketches/mt_snow_2d/svg?inline=1');

    const stored = SketchRepository.getByRef('mt_snow_2d');
    expect(stored).toBeTruthy();
    expect(stored.manifest.kind).toBe('manji-tree');
    expect(stored.manifest.dimensions).toBe('2d');
    expect(stored.manifest.tree).toBeTruthy();
  });

  it('renders the stored manifest into a self-contained SVG string', async () => {
    await createManjiTreeHandler({
      title: 'snowflake test',
      tree: snowflakeTree(),
      dimensions: '2d',
      ref: 'mt_snow_svg',
    });
    const stored = SketchRepository.getByRef('mt_snow_svg');
    const svg = renderManjiTreeToSvg(stored.manifest);
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');
    // Spine cross + 6 arm occupants → at least 8 manjis rendered as line groups.
    const lineCount = (svg.match(/<line /g) || []).length;
    expect(lineCount).toBeGreaterThan(20);
  });

  it('rejects a tree with a non-cardinal bar rotation', async () => {
    const badTree = {
      inlineProgram: {
        bar1: { rotationDeg: 37 }, // non-cardinal
        bar2: { rotationDeg: 90 },
      },
    };
    await expect(
      createManjiTreeHandler({
        title: 'bad', tree: badTree, dimensions: '2d', ref: 'mt_bad',
      }),
    ).rejects.toThrow(/Invalid manji-tree/);
  });
});

describe('create_manji_tree (3D)', () => {
  it('mints a 3D manji-tree and renders it through the perspective camera', async () => {
    const result = await createManjiTreeHandler({
      title: '3D tripod',
      tree: single3DTree(),
      dimensions: '3d',
      ref: 'mt_tripod',
    });
    expect(result.ok).toBe(true);
    const stored = SketchRepository.getByRef('mt_tripod');
    expect(stored.manifest.kind).toBe('manji-tree');
    expect(stored.manifest.dimensions).toBe('3d');

    const svg = renderManjiTreeToSvg(stored.manifest);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    // The tripod renders 3 bars × 4 segments = 12 lines minimum, plus dots.
    const lineCount = (svg.match(/<line /g) || []).length;
    expect(lineCount).toBeGreaterThanOrEqual(12);
  });
});

// ----- taijis (chirality primitive) ---------------------------------

function taijiRootTree() {
  return {
    id: 'world',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.1 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [],
  };
}

describe('create_manji_tree taijis', () => {
  it('mints a top-level taiji and renders the two-tone strands', async () => {
    const result = await createManjiTreeHandler({
      title: 'taiji coil',
      tree: taijiRootTree(),
      dimensions: '3d',
      ref: 'mt_taiji',
      taijis: [{ yin: { x: 0, y: 0, z: 2 }, yang: { x: 0, y: 0, z: -2 }, twist: 0.5, radius: 1 }],
    });
    expect(result.ok).toBe(true);
    const stored = SketchRepository.getByRef('mt_taiji');
    expect(stored.manifest.taijis).toHaveLength(1);

    const svg = renderManjiTreeToSvg(stored.manifest);
    expect(svg).toContain('#4cc9c0'); // yin strand
    expect(svg).toContain('#e9c46a'); // yang strand
  });

  it('rejects taijis in a 2D tree', async () => {
    await expect(createManjiTreeHandler({
      title: 'bad', tree: snowflakeTree(), dimensions: '2d', ref: 'mt_taiji_2d',
      taijis: [{ yin: { x: 0, y: 0, z: 1 }, yang: { x: 0, y: 0, z: -1 } }],
    })).rejects.toThrow(/3D only/);
  });

  it('surfaces an invalid taiji spec as a mint error', async () => {
    await expect(createManjiTreeHandler({
      title: 'bad', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_taiji_bad',
      taijis: [{ yin: { x: 0, y: 0, z: 1 } }], // missing yang
    })).rejects.toThrow(/taijis[\s\S]*yang/);
  });
});

// ----- plants (generative macro that compiles to taijis) ------------

describe('create_manji_tree plants', () => {
  it('compiles a plant to taijis, persists both, and renders', async () => {
    const result = await createManjiTreeHandler({
      title: 'a shoot',
      tree: taijiRootTree(),
      dimensions: '3d',
      ref: 'mt_plant',
      plants: [{ form: 'shoot', base: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 0, z: 6 }, count: 13 }],
    });
    expect(result.ok).toBe(true);
    const stored = SketchRepository.getByRef('mt_plant');
    // The macro expands to a stem + one taiji per leaf, persisted as taijis.
    expect(stored.manifest.taijis).toHaveLength(14);
    // The high-level spec is kept for provenance / round-trip.
    expect(stored.manifest.plants).toHaveLength(1);
    expect(stored.manifest.plants[0].form).toBe('shoot');
    const svg = renderManjiTreeToSvg(stored.manifest);
    expect(svg).toMatch(/<line /);
  });

  it('merges compiled plant taijis with hand-authored taijis', async () => {
    await createManjiTreeHandler({
      title: 'mixed', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_plant_mixed',
      taijis: [{ yin: { x: 0, y: 0, z: 2 }, yang: { x: 0, y: 0, z: -2 } }],
      plants: [{ form: 'flower', center: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 3, z: 0 }, count: 8 }],
    });
    const stored = SketchRepository.getByRef('mt_plant_mixed');
    expect(stored.manifest.taijis).toHaveLength(1 + 8); // hand taiji + 8 petals
  });

  it('compiles a recursive tree form into a bounded set of taijis', async () => {
    await createManjiTreeHandler({
      title: 'a tree', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_tree',
      plants: [{ form: 'tree', base: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 0, z: 5 }, depth: 3, branches: 2, foliage: false }],
    });
    const stored = SketchRepository.getByRef('mt_tree');
    expect(stored.manifest.taijis).toHaveLength(15); // 1+2+4+8 limbs, no foliage
    expect(stored.manifest.plants[0].form).toBe('tree');
  });

  it('rejects a tree that would compile past the taiji cap', async () => {
    await expect(createManjiTreeHandler({
      title: 'huge', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_tree_huge',
      plants: [{ form: 'tree', depth: 6, branches: 5 }],
    })).rejects.toThrow(/too large/);
  });

  it('mints a golden disc (sunflower head)', async () => {
    await createManjiTreeHandler({
      title: 'sunflower head', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_disc',
      plants: [{ form: 'disc', center: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 3, z: 0 }, count: 120, radius: 2, dome: 0.6 }],
    });
    expect(SketchRepository.getByRef('mt_disc').manifest.taijis).toHaveLength(120);
  });

  it('auto-lightens a heavy plant so the scene stays renderable', async () => {
    // 30 petals + 200 florets: without auto-detail this would be a huge SVG.
    await createManjiTreeHandler({
      title: 'big bloom', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_bigbloom',
      plants: [{ form: 'flower', center: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 3, z: 0 }, count: 30, discCount: 200 }],
    });
    // Mints fine (under the scene budget) thanks to the auto-detail drop.
    expect(SketchRepository.getByRef('mt_bigbloom').manifest.taijis).toHaveLength(230);
  });

  it('rejects a hand-authored taiji pile that exceeds the browser budget', async () => {
    const heavy = Array.from({ length: 40 }, (_, i) => ({
      yin: { x: i, y: 0, z: 0 }, yang: { x: i, y: 0, z: 4 },
      crossSections: 60, samples: 60, // ~3600 segments each × 40 ≈ 144k
    }));
    await expect(createManjiTreeHandler({
      title: 'too heavy', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_heavy',
      taijis: heavy,
    })).rejects.toThrow(/too heavy to render/);
  });

  it('compiles a grove (landscape repeater) of many varied trees', async () => {
    await createManjiTreeHandler({
      title: 'a grove', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_grove',
      plants: [{ form: 'grove', base: { x: 0, y: 0, z: 0 }, count: 9, region: { width: 16, depth: 12 }, groundAmplitude: 0.6, tree: { depth: 3, branches: 2, foliage: 'cluster' } }],
    });
    const stored = SketchRepository.getByRef('mt_grove');
    expect(stored.manifest.taijis.length).toBeGreaterThan(90); // nine trees worth
    expect(stored.manifest.plants[0].form).toBe('grove');
    const svg = renderManjiTreeToSvg(stored.manifest);
    expect(svg).toMatch(/<polygon /); // painted (silhouette default)
  });

  it('rejects plants in a 2D tree', async () => {
    await expect(createManjiTreeHandler({
      title: 'bad', tree: snowflakeTree(), dimensions: '2d', ref: 'mt_plant_2d',
      plants: [{ form: 'shoot' }],
    })).rejects.toThrow(/3D only/);
  });

  it('surfaces an invalid plant spec as a mint error', async () => {
    await expect(createManjiTreeHandler({
      title: 'bad', tree: taijiRootTree(), dimensions: '3d', ref: 'mt_plant_bad',
      plants: [{ form: 'shrubbery' }],
    })).rejects.toThrow(/plants[\s\S]*form/);
  });
});

// ----- connections (line-between primitive) -------------------------

function twinTowersTree() {
  const towerSpine = (height) => ({
    spine: {
      bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'closed' }, lengthScale: height },
      bar1: { axis: 'N-S',          tails: { N: 'open', S: 'open' },             lengthScale: 0.4 },
      bar2: { axis: 'E-W',          tails: { W: 'open', E: 'open' },             lengthScale: 0.4 },
    },
    slots: [{ id: 'top', position: { x: 0, y: 0, z: 6 } }],
  });
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: -10, z: 0 },
    slots: [
      { id: 'L', position: { x: -8, y: 0, z: 0 } },
      { id: 'R', position: { x:  8, y: 0, z: 0 } },
    ],
    children: [
      { slot: 'L', node: { id: 'tower-L', ...towerSpine(2.5) } },
      { slot: 'R', node: { id: 'tower-R', ...towerSpine(2.5) } },
    ],
  };
}

describe('create_manji_tree connections', () => {
  it('mints a 3D tree with a catenary connection and renders the curve', async () => {
    const result = await createManjiTreeHandler({
      title: 'cable bridge',
      tree: twinTowersTree(),
      dimensions: '3d',
      ref: 'mt_cable',
      showSlotMarkers: false,
      physics: { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1, defaultSagFactor: 0.18 },
      connections: [
        {
          from: 'tower-L/bar/Zenith-Nadir/posTip',
          to: 'tower-R/bar/Zenith-Nadir/posTip',
          style: { stroke: '#a05', width: 1.4 },
        },
      ],
    });
    expect(result.ok).toBe(true);

    const stored = SketchRepository.getByRef('mt_cable');
    expect(stored.manifest.connections).toHaveLength(1);
    expect(stored.manifest.physics.defaultSagFactor).toBe(0.18);

    const svg = renderManjiTreeToSvg(stored.manifest);
    // The catenary samples to 48 segments by default.
    const cableSegs = (svg.match(/stroke="#a05"/g) || []).length;
    expect(cableSegs).toBeGreaterThanOrEqual(40);
  });

  it('throws at mint time on an unresolvable endpoint path', async () => {
    await expect(createManjiTreeHandler({
      title: 'bad cable',
      tree: twinTowersTree(),
      dimensions: '3d',
      ref: 'mt_cable_bad',
      connections: [
        { from: 'tower-L/slot/no-such-slot', to: 'tower-R/bar/Zenith-Nadir/posTip' },
      ],
    })).rejects.toThrow(/Invalid manji-tree connections.*slot 'no-such-slot' not on node 'tower-L'/s);
  });

  it('rejects connections on 2D trees', async () => {
    await expect(createManjiTreeHandler({
      title: '2d with conns',
      tree: { inlineProgram: { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } } },
      dimensions: '2d',
      ref: 'mt_cable_2d',
      connections: [{ from: 'a/slot/b', to: 'c/slot/d' }],
    })).rejects.toThrow(/connections.*3D only/);
  });
});

// ----- waveFields (wave-field primitive) ------------------------------

function floorPlanTree() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: -10, z: 0 },
    slots: [
      { id: 'nw', position: { x: -12, y: -8, z: 0 } },
      { id: 'ne', position: { x:  12, y: -8, z: 0 } },
      { id: 'se', position: { x:  12, y:  8, z: 0 } },
      { id: 'sw', position: { x: -12, y:  8, z: 0 } },
    ],
  };
}

describe('create_manji_tree wave fields', () => {
  it('mints a flat (zero-waves) field as a crest-line grid', async () => {
    const result = await createManjiTreeHandler({
      title: 'flat floor',
      tree: floorPlanTree(),
      dimensions: '3d',
      ref: 'mt_flatfloor',
      showSlotMarkers: false,
      waveFields: [
        {
          corners: ['world/slot/nw', 'world/slot/ne', 'world/slot/se', 'world/slot/sw'],
          samples: { u: 4, v: 4 },
          style: { stroke: '#abc', width: 0.4 },
        },
      ],
    });
    expect(result.ok).toBe(true);
    const stored = SketchRepository.getByRef('mt_flatfloor');
    expect(stored.manifest.waveFields).toHaveLength(1);

    const svg = renderManjiTreeToSvg(stored.manifest);
    // 5 iso-u + 5 iso-v polylines × 4 segments each = 40 line segments at #abc.
    const fieldSegs = (svg.match(/stroke="#abc"/g) || []).length;
    expect(fieldSegs).toBeGreaterThanOrEqual(35);
  });

  it('mints a waved field with multiple components', async () => {
    const result = await createManjiTreeHandler({
      title: 'wavy floor',
      tree: floorPlanTree(),
      dimensions: '3d',
      ref: 'mt_wavyfloor',
      showSlotMarkers: false,
      physics: { gravity: { x: 0, y: 0, z: -1 } },
      waveFields: [
        {
          corners: ['world/slot/nw', 'world/slot/ne', 'world/slot/se', 'world/slot/sw'],
          samples: { u: 12, v: 12 },
          waves: [
            { amplitude: 0.8, cycles: { u: 2, v: 0 } },
            { amplitude: 0.3, cycles: { u: 0, v: 3 }, phase: Math.PI / 4 },
          ],
          style: { stroke: '#357', width: 0.6 },
        },
      ],
    });
    expect(result.ok).toBe(true);
    const stored = SketchRepository.getByRef('mt_wavyfloor');
    expect(stored.manifest.waveFields[0].waves).toHaveLength(2);

    const svg = renderManjiTreeToSvg(stored.manifest);
    // 13 iso-u + 13 iso-v polylines × 12 segments each = 312 line segments.
    const fieldSegs = (svg.match(/stroke="#357"/g) || []).length;
    expect(fieldSegs).toBeGreaterThanOrEqual(280);
  });

  it('throws at mint time on an unresolvable corner path', async () => {
    await expect(createManjiTreeHandler({
      title: 'broken field',
      tree: floorPlanTree(),
      dimensions: '3d',
      ref: 'mt_wf_bad',
      waveFields: [
        {
          corners: ['world/slot/nw', 'world/slot/missing', 'world/slot/se', 'world/slot/sw'],
        },
      ],
    })).rejects.toThrow(/Invalid manji-tree wave fields.*missing/s);
  });

  it('rejects a field with fewer than 4 corners', async () => {
    await expect(createManjiTreeHandler({
      title: 'three corners',
      tree: floorPlanTree(),
      dimensions: '3d',
      ref: 'mt_wf_3corners',
      waveFields: [
        { corners: ['world/slot/nw', 'world/slot/ne', 'world/slot/se'] },
      ],
    })).rejects.toThrow(/4-element array/);
  });

  it('rejects waveFields on 2D trees', async () => {
    await expect(createManjiTreeHandler({
      title: '2d with field',
      tree: { inlineProgram: { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } } },
      dimensions: '2d',
      ref: 'mt_wf_2d',
      waveFields: [{ corners: ['a/slot/b', 'c/slot/d', 'e/slot/f', 'g/slot/h'] }],
    })).rejects.toThrow(/waveFields.*3D only/);
  });
});
