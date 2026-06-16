/**
 * Tests for the in-tree leaf-mark walker emission, the `self` ambient
 * endpoint reference, and the mint-time leaf-mark endpoint validator.
 *
 * Covers the edge cases from the wave-and-line-in-tree plan's
 * acceptance check #4.
 */

import { describe, it, expect } from 'vitest';
import {
  walkManjiTree3D,
  validateManjiTree3D,
  validateLeafMarkEndpoints,
  LEAF_MARK_KINDS,
  isLeafMark,
} from './manji-program.js';
import { buildEndpointResolver } from './line-between.js';

describe('LEAF_MARK_KINDS / isLeafMark', () => {
  it('includes connection and wave-field', () => {
    expect(LEAF_MARK_KINDS).toContain('connection');
    expect(LEAF_MARK_KINDS).toContain('wave-field');
  });
  it('isLeafMark distinguishes leaf-mark kinds from terminal kinds', () => {
    expect(isLeafMark({ kind: 'connection' })).toBe(true);
    expect(isLeafMark({ kind: 'wave-field' })).toBe(true);
    expect(isLeafMark({ kind: 'line' })).toBe(false);    // terminal
    expect(isLeafMark({ kind: 'brick-fill' })).toBe(false); // terminal
    expect(isLeafMark({ spine: {} })).toBe(false);       // manji node
    expect(isLeafMark(null)).toBe(false);
  });
});

// ─── Fixture: two-tower scene with leaves authored under tower-L ──────

function towerSpine(height) {
  return {
    spine: {
      bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'closed' }, lengthScale: height },
      bar1: { axis: 'N-S',          tails: { N: 'open', S: 'open' },             lengthScale: 0.4 },
      bar2: { axis: 'E-W',          tails: { W: 'open', E: 'open' },             lengthScale: 0.4 },
    },
    slots: [
      { id: 'top', position: { x: 0, y: 0, z: 5 } },
    ],
  };
}

function twoTowersWithLeafConnection() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'L', position: { x: -6, y: 0, z: 0 } },
      { id: 'R', position: { x:  6, y: 0, z: 0 } },
      { id: 'overlay', position: { x: 0, y: 0, z: 0 } },
    ],
    children: [
      { slot: 'L', node: { id: 'tower-L', ...towerSpine(2) } },
      { slot: 'R', node: { id: 'tower-R', ...towerSpine(2) } },
      { slot: 'overlay', node: {
        kind: 'connection',
        from: 'tower-L/bar/Zenith-Nadir/posTip',
        to:   'tower-R/bar/Zenith-Nadir/posTip',
      } },
    ],
  };
}

describe('walkManjiTree3D emits leaf-mark records', () => {
  const emitted = walkManjiTree3D(twoTowersWithLeafConnection());
  const leafRecord = emitted.find((n) => n.leafMark);

  it('produces a leafMark field on the emitted record', () => {
    expect(leafRecord).toBeTruthy();
    expect(leafRecord.leafMark.kind).toBe('connection');
    expect(leafRecord.leafMark.spec.from).toBe('tower-L/bar/Zenith-Nadir/posTip');
  });

  it('captures the nearest enclosing manji id as selfId', () => {
    // The connection is bound under the root `world`, so selfId === 'world'.
    expect(leafRecord.leafMark.selfId).toBe('world');
  });

  it('records slotPath through the binding chain', () => {
    expect(leafRecord.slotPath).toEqual(['overlay']);
  });
});

// ─── `self` ambient reference ─────────────────────────────────────────

function towerWithSelfReferringChild() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
      bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'closed' }, lengthScale: 4 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'NW', position: { x: -5, y: -5, z: 0 } },
      { id: 'NE', position: { x:  5, y: -5, z: 0 } },
      { id: 'SE', position: { x:  5, y:  5, z: 0 } },
      { id: 'SW', position: { x: -5, y:  5, z: 0 } },
      { id: 'overlay', position: { x: 0, y: 0, z: 0 } },
    ],
    children: [
      { slot: 'overlay', node: {
        kind: 'wave-field',
        corners: ['self/slot/NW', 'self/slot/NE', 'self/slot/SE', 'self/slot/SW'],
      } },
    ],
  };
}

describe('self/ ambient reference', () => {
  it('resolves to the nearest enclosing manji id (root case)', () => {
    const emitted = walkManjiTree3D(towerWithSelfReferringChild());
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs).toEqual([]);

    // Verify what the resolver returns when given the leaf's selfId.
    const resolve = buildEndpointResolver(emitted);
    const nw = resolve('self/slot/NW', 'world');
    expect(nw).toEqual({ x: -5, y: -5, z: 0 });
  });

  it('throws when selfId is undefined and path uses self/', () => {
    const emitted = walkManjiTree3D(towerWithSelfReferringChild());
    const resolve = buildEndpointResolver(emitted);
    expect(() => resolve('self/slot/NW')).toThrow(/'self' has no enclosing manji node in scope/);
  });

  it('throws when the targeted slot does not exist on the resolved enclosing node', () => {
    const tree = {
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [{ id: 'overlay', position: { x: 0, y: 0, z: 0 } }],
      children: [
        { slot: 'overlay', node: {
          kind: 'wave-field',
          corners: ['self/slot/NW', 'self/slot/NE', 'self/slot/SE', 'self/slot/SW'],
        } },
      ],
    };
    const emitted = walkManjiTree3D(tree);
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs.length).toBeGreaterThanOrEqual(1);
    expect(errs.some((e) => /slot 'NW' not on node 'world'/.test(e))).toBe(true);
  });

  it('absolute paths still work alongside self/', () => {
    const tree = {
      id: 'world',
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
      },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [
        { id: 'L', position: { x: -5, y: 0, z: 0 } },
        { id: 'R', position: { x:  5, y: 0, z: 0 } },
        { id: 'overlay', position: { x: 0, y: 0, z: 0 } },
      ],
      children: [
        { slot: 'L', node: { id: 'tower-L', ...towerSpine(2) } },
        { slot: 'R', node: { id: 'tower-R', ...towerSpine(2) } },
        { slot: 'overlay', node: {
          kind: 'connection',
          from: 'tower-L/bar/Zenith-Nadir/posTip',     // absolute
          to:   'self/slot/L',                          // self
        } },
      ],
    };
    const emitted = walkManjiTree3D(tree);
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs).toEqual([]);
  });
});

// ─── No-manji-ancestor edge case ──────────────────────────────────────

describe('self/ at root depth with no manji ancestor', () => {
  it('throws when leaf is the root and no manji has been emitted yet', () => {
    // Tree's ROOT is a leaf mark (not a manji). No selfId is in scope.
    const tree = {
      kind: 'connection',
      from: 'self/slot/X',
      to: 'self/slot/Y',
    };
    const emitted = walkManjiTree3D(tree);
    // The walker emits the leaf with selfId=null. The endpoint validator
    // then throws because self has no target.
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs.length).toBeGreaterThanOrEqual(2);
    expect(errs.some((e) => /'self' has no enclosing manji node/.test(e))).toBe(true);
  });
});

// ─── replicate × self composition ─────────────────────────────────────

describe('self/ composes with replicate', () => {
  it('each replica resolves self to its own instance id', () => {
    // A replicated tower, each replica with a self-referring child leaf.
    const tree = {
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [
        { id: 'mount', position: { x: 0, y: 0, z: 0 } },
      ],
      children: [
        { slot: 'mount', node: {
          replicate: { offsets: [{ x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }] },
          node: {
            id: 'tower',
            spine: {
              bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'closed' }, lengthScale: 2 },
              bar1: { axis: 'N-S',          tails: { N: 'open', S: 'open' },             lengthScale: 0.4 },
              bar2: { axis: 'E-W',          tails: { W: 'open', E: 'open' },             lengthScale: 0.4 },
            },
            slots: [
              { id: 'top', position: { x: 0, y: 0, z: 5 } },
              { id: 'overlay', position: { x: 0, y: 0, z: 0 } },
            ],
            children: [
              { slot: 'overlay', node: {
                kind: 'connection',
                from: 'self/slot/top',
                to:   'self/bar/Zenith-Nadir/negEnd',
              } },
            ],
          },
        } },
      ],
    };
    const emitted = walkManjiTree3D(tree);

    // Each replica has its own id: 'tower#0' and 'tower#1'.
    const replicaIds = emitted
      .filter((n) => n.id?.startsWith('tower#'))
      .map((n) => n.id);
    expect(replicaIds).toEqual(['tower#0', 'tower#1']);

    // Each leaf mark captures the SELF of its own replica.
    const leaves = emitted.filter((n) => n?.leafMark?.kind === 'connection');
    expect(leaves).toHaveLength(2);
    expect(leaves[0].leafMark.selfId).toBe('tower#0');
    expect(leaves[1].leafMark.selfId).toBe('tower#1');

    // Validate — both self/ references resolve to their own replica.
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs).toEqual([]);
  });
});

// ─── Validator catches malformed leaf-mark shape ──────────────────────

describe('validateManjiTree3D catches leaf-mark shape errors inline', () => {
  it('rejects a connection leaf missing from/to', () => {
    const tree = {
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      slots: [{ id: 'overlay', position: { x: 0, y: 0, z: 0 } }],
      children: [{ slot: 'overlay', node: { kind: 'connection' } }],
    };
    const errs = validateManjiTree3D(tree);
    expect(errs.length).toBeGreaterThanOrEqual(2);
    expect(errs.some((e) => /connection\.from must be a string/.test(e))).toBe(true);
    expect(errs.some((e) => /connection\.to must be a string/.test(e))).toBe(true);
  });

  it('rejects a wave-field leaf with the wrong number of corners', () => {
    const tree = {
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      slots: [{ id: 'overlay', position: { x: 0, y: 0, z: 0 } }],
      children: [{ slot: 'overlay', node: { kind: 'wave-field', corners: ['a/slot/b'] } }],
    };
    const errs = validateManjiTree3D(tree);
    expect(errs.some((e) => /wave-field\.corners must be a 4-element array/.test(e))).toBe(true);
  });
});
