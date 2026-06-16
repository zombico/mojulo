/**
 * Tests for the `pathBindings` overlay on programRef nodes.
 *
 * pathBindings lets a host whose slot names don't match a callable
 * shelf card's contract invoke the card by name anyway, by aliasing
 * the card's `self/slot/<contract>` paths to the host's actual paths
 * at inline time.
 */

import { describe, it, expect } from 'vitest';
import {
  walkManjiTree3D,
  validateManjiTree3D,
  validateLeafMarkEndpoints,
} from './manji-program.js';

// In-memory shelf — one container-preset card with self/slot/NW etc.
// corner paths. Mimics a Wave 1.5 surface card without involving the
// real loader.
const SHELF = {
  'calm-water-test': {
    children: [
      {
        kind: 'wave-field',
        corners: [
          'self/slot/NW',
          'self/slot/NE',
          'self/slot/SE',
          'self/slot/SW',
        ],
        waves: [{ amplitude: 0.3, cycles: { u: 2, v: 1 } }],
        samples: { u: 8, v: 6 },
        style: { stroke: '#5a8ab8', width: 0.6 },
      },
    ],
  },
};
const resolveRef = (id) => SHELF[id] || null;

// Host whose slots are named NW/NE/SE/SW (matches the contract — no
// pathBindings needed).
function matchingHost() {
  return {
    id: 'host',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'NW',   position: { x: -10, y: -10, z: 0 } },
      { id: 'NE',   position: { x:  10, y: -10, z: 0 } },
      { id: 'SE',   position: { x:  10, y:  10, z: 0 } },
      { id: 'SW',   position: { x: -10, y:  10, z: 0 } },
      { id: 'fill', position: { x: 0, y: 0, z: 0 } },
    ],
    children: [
      { slot: 'fill', node: { programRef: 'calm-water-test' } },
    ],
  };
}

// Host whose slots are named water-NW/water-NE/water-SE/water-SW —
// natural slot names for an island scene, but they DON'T match the
// card's contract.
function mismatchedHost(programNode) {
  return {
    id: 'host',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'water-NW', position: { x: -10, y: -10, z: 0 } },
      { id: 'water-NE', position: { x:  10, y: -10, z: 0 } },
      { id: 'water-SE', position: { x:  10, y:  10, z: 0 } },
      { id: 'water-SW', position: { x: -10, y:  10, z: 0 } },
      { id: 'fill',     position: { x: 0, y: 0, z: 0 } },
    ],
    children: [{ slot: 'fill', node: programNode }],
  };
}

describe('pathBindings — exact-string endpoint rewrite at inline time', () => {
  it('without pathBindings, mismatched host fails endpoint resolution', () => {
    const emitted = walkManjiTree3D(
      mismatchedHost({ programRef: 'calm-water-test' }),
      resolveRef,
    );
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs.length).toBeGreaterThanOrEqual(4);
    expect(errs.some((e) => /slot 'NW' not on node 'host'/.test(e))).toBe(true);
  });

  it('with pathBindings, mismatched host resolves through aliased paths', () => {
    const emitted = walkManjiTree3D(
      mismatchedHost({
        programRef: 'calm-water-test',
        pathBindings: {
          'self/slot/NW': 'host/slot/water-NW',
          'self/slot/NE': 'host/slot/water-NE',
          'self/slot/SE': 'host/slot/water-SE',
          'self/slot/SW': 'host/slot/water-SW',
        },
      }),
      resolveRef,
    );
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs).toEqual([]);

    // The emitted leaf carries the REWRITTEN corner paths (absolute
    // host paths, not the original self/...).
    const leaf = emitted.find((n) => n?.leafMark?.kind === 'wave-field');
    expect(leaf.leafMark.spec.corners).toEqual([
      'host/slot/water-NW',
      'host/slot/water-NE',
      'host/slot/water-SE',
      'host/slot/water-SW',
    ]);
  });

  it('matching host still works with no pathBindings', () => {
    const emitted = walkManjiTree3D(matchingHost(), resolveRef);
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs).toEqual([]);
    // Leaf retains the original self/... paths (which resolve to host).
    const leaf = emitted.find((n) => n?.leafMark?.kind === 'wave-field');
    expect(leaf.leafMark.spec.corners[0]).toBe('self/slot/NW');
  });

  it('partial bindings: unbound paths fall through to self/ resolution', () => {
    // Bind only NW/NE; the host has NW/NE matching the contract too,
    // so self/slot/NW for unbound SE/SW would normally fail except the
    // host happens to have NW/NE as actual slots. Let's use a different
    // setup: matching host, but rebind only NW to a NON-EXISTENT path
    // — should yield exactly one error.
    const tree = matchingHost();
    tree.children = [{
      slot: 'fill',
      node: {
        programRef: 'calm-water-test',
        pathBindings: { 'self/slot/NW': 'host/slot/missing' },
      },
    }];
    const emitted = walkManjiTree3D(tree, resolveRef);
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/slot 'missing' not on node 'host'/);
  });

  it('exact-string matching only (no prefix substring magic)', () => {
    // Bind 'self/slot/N' (which is NOT a complete card path). The card
    // uses 'self/slot/NW' / 'self/slot/NE' etc. — none of those exact
    // strings match 'self/slot/N', so nothing gets rewritten.
    const tree = matchingHost();
    tree.children = [{
      slot: 'fill',
      node: {
        programRef: 'calm-water-test',
        pathBindings: { 'self/slot/N': 'host/slot/bogus' },
      },
    }];
    const emitted = walkManjiTree3D(tree, resolveRef);
    const leaf = emitted.find((n) => n?.leafMark?.kind === 'wave-field');
    // Corners still reference the original card paths — no prefix match.
    expect(leaf.leafMark.spec.corners).toEqual([
      'self/slot/NW', 'self/slot/NE', 'self/slot/SE', 'self/slot/SW',
    ]);
  });

  it('works for connection leaves too (from + to rewriting)', () => {
    const SHELF_CONN = {
      'twin-tether': {
        children: [{
          kind: 'connection',
          from: 'self/slot/A',
          to:   'self/slot/B',
          style: { stroke: '#222', width: 1.0 },
        }],
      },
    };
    const tree = {
      id: 'host',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      slots: [
        { id: 'left',  position: { x: -5, y: 0, z: 0 } },
        { id: 'right', position: { x:  5, y: 0, z: 0 } },
        { id: 'fill',  position: { x: 0, y: 0, z: 0 } },
      ],
      children: [{
        slot: 'fill',
        node: {
          programRef: 'twin-tether',
          pathBindings: {
            'self/slot/A': 'host/slot/left',
            'self/slot/B': 'host/slot/right',
          },
        },
      }],
    };
    const emitted = walkManjiTree3D(tree, (id) => SHELF_CONN[id] || null);
    const leaf = emitted.find((n) => n?.leafMark?.kind === 'connection');
    expect(leaf.leafMark.spec.from).toBe('host/slot/left');
    expect(leaf.leafMark.spec.to).toBe('host/slot/right');
    const errs = validateLeafMarkEndpoints(emitted);
    expect(errs).toEqual([]);
  });
});

describe('validateManjiTree3D — pathBindings shape checks', () => {
  it('rejects pathBindings that is not an object', () => {
    const tree = matchingHost();
    tree.children = [{
      slot: 'fill',
      node: { programRef: 'calm-water-test', pathBindings: 'oops' },
    }];
    const errs = validateManjiTree3D(tree, resolveRef);
    expect(errs.some((e) => /pathBindings must be an object/.test(e))).toBe(true);
  });

  it('rejects pathBindings entries whose values are not strings', () => {
    const tree = matchingHost();
    tree.children = [{
      slot: 'fill',
      node: {
        programRef: 'calm-water-test',
        pathBindings: { 'self/slot/NW': 42 },
      },
    }];
    const errs = validateManjiTree3D(tree, resolveRef);
    expect(errs.some((e) => /string→string pairs/.test(e))).toBe(true);
  });

  it('accepts a well-formed pathBindings map', () => {
    const tree = matchingHost();
    tree.children = [{
      slot: 'fill',
      node: {
        programRef: 'calm-water-test',
        pathBindings: { 'self/slot/NW': 'host/slot/X' },
      },
    }];
    const errs = validateManjiTree3D(tree, resolveRef);
    expect(errs).toEqual([]);
  });
});
