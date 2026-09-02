/**
 * Characterization harness for the free-angle-modulation work
 * (lite-template/integration/0902/free-angle-modulation.plan.md, phase 0).
 *
 * Freezes TODAY'S outputs of the cardinal grammar — tail resolution,
 * bar/manji evaluation (2D + 3D), the tree walkers, and one end-to-end
 * SVG per dimensionality — as vitest snapshots BEFORE any angle
 * generalization lands. Every later phase must keep these snapshots
 * byte-identical: absent the new `angle` / `cant` / `angleStep`
 * parameters, output is a compatibility promise.
 *
 * Numbers are rounded to 9 decimals (and -0 normalized to 0) so the
 * snapshots freeze geometry, not floating-point noise.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCardinalTail,
  cardinalBar,
  cardinalManji,
  evaluateManji,
  resolveCardinalTail3D,
  evaluateBar3D,
  evaluateManji3D,
  cardinalManji3D,
} from './manji.js';
import { walkManjiTree, walkManjiTree3D } from './manji-program.js';
import { renderManjiTreeToSvg } from './manji-svg.js';

function normalize(value) {
  if (typeof value === 'number') {
    const r = Math.round(value * 1e9) / 1e9;
    return Object.is(r, -0) ? 0 : r;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = normalize(value[key]);
    return out;
  }
  return value;
}

describe('characterization: 2D tail resolution', () => {
  it('freezes the full (axis, end, target) → degrees matrix', () => {
    const matrix = {};
    const cases = {
      'N-S': { ends: ['N', 'S'], targets: ['open', 'closed', 'N', 'S', 'E', 'W'] },
      'E-W': { ends: ['E', 'W'], targets: ['open', 'closed', 'E', 'W', 'N', 'S'] },
    };
    for (const [axis, { ends, targets }] of Object.entries(cases)) {
      for (const end of ends) {
        for (const target of targets) {
          matrix[`${axis}/${end}→${target}`] = resolveCardinalTail(axis, end, target);
        }
      }
    }
    expect(matrix).toMatchSnapshot();
  });

  it('freezes rejection of non-cardinal targets', () => {
    expect(() => resolveCardinalTail('N-S', 'N', 'Zenith')).toThrow();
    expect(() => resolveCardinalTail('N-S', 'E', 'open')).toThrow();
    expect(() => cardinalBar({ axis: 'Zenith-Nadir', tails: {} })).toThrow();
  });
});

describe('characterization: 3D tail resolution', () => {
  it('freezes the full (axis, end, target) → direction-vector matrix', () => {
    const matrix = {};
    const cases = {
      'N-S': { ends: ['N', 'S'], targets: ['open', 'closed', 'N', 'S', 'E', 'W', 'Zenith', 'Nadir'] },
      'E-W': { ends: ['E', 'W'], targets: ['open', 'closed', 'E', 'W', 'N', 'S', 'Zenith', 'Nadir'] },
      'Zenith-Nadir': { ends: ['Zenith', 'Nadir'], targets: ['open', 'closed', 'Zenith', 'Nadir', 'N', 'S', 'E', 'W'] },
    };
    for (const [axis, { ends, targets }] of Object.entries(cases)) {
      for (const end of ends) {
        for (const target of targets) {
          matrix[`${axis}/${end}→${target}`] = normalize(resolveCardinalTail3D(axis, end, target));
        }
      }
    }
    expect(matrix).toMatchSnapshot();
  });
});

describe('characterization: cardinal constructors (2D)', () => {
  it('freezes cardinalBar programs across fold shapes', () => {
    const bars = {
      'N-S both open': cardinalBar({ axis: 'N-S', tails: { N: 'open', S: 'open' } }),
      'N-S fold E / closed': cardinalBar({ axis: 'N-S', tails: { N: 'E', S: 'closed' } }),
      'E-W fold N / S, scaled': cardinalBar({ axis: 'E-W', tails: { E: 'N', W: 'S' }, lengthScale: 1.5 }),
    };
    expect(normalize(bars)).toMatchSnapshot();
  });

  it('freezes a full 2D manji evaluation through cardinalManji', () => {
    const program = cardinalManji({
      bar1: { axis: 'N-S', tails: { N: 'E', S: 'closed' }, lengthScale: 1.2 },
      bar2: { axis: 'E-W', tails: { W: 'open', E: 'N' } },
    });
    const evaluated = evaluateManji(program, { x: 3, y: -2 }, 2);
    expect(normalize(evaluated)).toMatchSnapshot();
  });
});

describe('characterization: 3D bar and manji evaluation', () => {
  it('freezes evaluateBar3D per axis with mixed folds', () => {
    const bars = {
      'N-S': evaluateBar3D({ axis: 'N-S', tails: { N: 'E', S: 'closed' }, lengthScale: 1.2 }),
      'E-W': evaluateBar3D({ axis: 'E-W', tails: { E: 'Zenith', W: 'open' } }),
      'Zenith-Nadir': evaluateBar3D({ axis: 'Zenith-Nadir', tails: { Zenith: 'N', Nadir: 'W' }, lengthScale: 0.75 }),
    };
    expect(normalize(bars)).toMatchSnapshot();
  });

  it('freezes a 3-bar evaluateManji3D with anchor + scale transform', () => {
    const program = cardinalManji3D({
      bar1: { axis: 'N-S', tails: { N: 'E', S: 'closed' }, lengthScale: 1.2 },
      bar2: { axis: 'E-W', tails: { E: 'Zenith', W: 'open' } },
      bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'N', Nadir: 'open' }, lengthScale: 0.75 },
    });
    const evaluated = evaluateManji3D(program, { x: 1, y: 2, z: 3 }, 1.5);
    expect(normalize(evaluated)).toMatchSnapshot();
  });
});

// Representative 3D tree exercising the walk paths the angle work will
// touch: spine folds, slots + child bindings, replicate + scaleStep,
// reflect, node rotation, and field-borne anchor.z / lengthScale /
// slotScale (host-declared fields, walk-time resolution).
const FIELDS_3D = {
  swell: { kind: 'constant', value: 1.4 },
  terrain: {
    kind: 'gradient',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 0, y: 4, z: 0 },
    fromValue: 0,
    toValue: 1.2,
    beyond: 'clamp',
  },
};

const TREE_3D = {
  id: 'root',
  anchor: { x: 0, y: 0, z: 0 },
  scale: 1,
  spine: {
    bar1: { axis: 'N-S', tails: { N: 'E', S: 'closed' }, lengthScale: 1.2 },
    bar2: { axis: 'E-W', tails: { E: 'Zenith', W: 'open' } },
    bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'N', Nadir: 'open' }, lengthScale: { field: 'swell' } },
  },
  slots: [
    { id: 'crown', position: { x: 0, y: 0, z: 1 } },
    { id: 'east', position: { x: 1, y: 0, z: 0 } },
  ],
  rotation: [{ axis: 'Zenith-Nadir', angle: 30 }],
  children: [
    {
      slot: 'crown',
      slotScale: 0.5,
      node: {
        id: 'cap',
        reflect: 'E-W',
        spine: { bar1: { axis: 'E-W', tails: { E: 'open', W: 'open' } } },
        slots: [],
      },
    },
    {
      slot: 'east',
      node: {
        replicate: { offsets: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1.5, z: 0 }, { x: 0, y: 3, z: 0 }] },
        scaleStep: 0.8,
        node: {
          id: 'post',
          anchor: { x: 0, y: 0, z: { field: 'terrain' } },
          spine: { bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' } } },
          slots: [],
        },
      },
    },
  ],
};

const TREE_2D = {
  id: 'root2d',
  anchor: { x: 0, y: 0 },
  scale: 1,
  spine: {
    bar1: { axis: 'N-S', tails: { N: 'E', S: 'closed' } },
    bar2: { axis: 'E-W', tails: { W: 'open', E: 'N' } },
  },
  slotPattern: { id: '4-center-diamond' },
  slotLabels: ['tip-n', 'tip-e', 'tip-s', 'tip-w'],
  children: [
    {
      slot: 'tip-e',
      slotScale: 0.6,
      node: {
        id: 'leaf',
        reflect: 'N-S',
        spine: {
          bar1: { axis: 'E-W', tails: { E: 'S', W: 'open' } },
          bar2: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
        },
      },
    },
  ],
};

describe('characterization: tree walkers', () => {
  it('freezes walkManjiTree3D emit list (spine + slots + replicate + reflect + rotation + fields)', () => {
    const emitted = walkManjiTree3D(TREE_3D, () => null, { fields: FIELDS_3D });
    const frozen = emitted.map((node) => normalize({
      id: node.id,
      depth: node.depth,
      slotPath: node.slotPath,
      anchor: node.anchor,
      scale: node.scale,
      role: node.role,
      slots: node.slots,
      armTips: node.spineManji ? node.spineManji.armTips : null,
      barSegments: node.spineManji
        ? node.spineManji.bars.map((b) => ({ axis: b.axis, segments: b.segments }))
        : null,
    }));
    expect(frozen).toMatchSnapshot();
  });

  it('freezes walkManjiTree (2D) emit list', () => {
    const emitted = walkManjiTree(TREE_2D, () => null);
    const frozen = emitted.map((node) => normalize({
      id: node.id,
      depth: node.depth,
      slotPath: node.slotPath,
      anchor: node.anchor,
      scale: node.scale,
      slots: node.slots,
      manji: node.spineManji ? { segments: collect2DSegments(node.spineManji) } : null,
    }));
    expect(frozen).toMatchSnapshot();
  });
});

function collect2DSegments(spineManji) {
  // 2D evaluations carry bars with points/segments mirroring the 3D
  // shape; serialize whatever segment lists are present without
  // assuming more structure than the walker guarantees.
  if (Array.isArray(spineManji.bars)) {
    return spineManji.bars.map((b) => b.segments ?? b.points ?? b);
  }
  return spineManji;
}

describe('characterization: end-to-end SVG', () => {
  it('freezes a 2D manji-tree render', () => {
    const svg = renderManjiTreeToSvg({
      kind: 'manji-tree',
      dimensions: '2d',
      tree: TREE_2D,
      viewBox: { width: 400, height: 400 },
    });
    expect(svg).toMatchSnapshot();
  });

  it('freezes a 3D manji-tree render', () => {
    const svg = renderManjiTreeToSvg({
      kind: 'manji-tree',
      dimensions: '3d',
      tree: TREE_3D,
      fields: FIELDS_3D,
      viewBox: { width: 400, height: 400 },
    });
    expect(svg).toMatchSnapshot();
  });
});
