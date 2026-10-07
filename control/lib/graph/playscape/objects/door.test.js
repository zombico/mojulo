/**
 * The door entry: five variants of one mechanism, each answering for itself. Closed it blocks; open a walker gets
 * through; its collider follows t; its sweep holds every pose on the way; it says where it is used from. The skin is
 * separate: the laws judge a render, and the plank skin holds them on the single door it was drawn for.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject, ejectObject } from './index.js';
import { DOOR, DOOR_VARIANT_IDS, DOOR_SKIN_IDS } from './door.js';
import { collider, poseLeaf } from './mechanism.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { starter } from '../../era/entries.js';
import { assembleStageScene } from '../../era/stage.js';
import { createBusState, processEvents } from '../../worlds/event-bus.js';

const FIT = { width: 1.4, height: 2.6 };
const door = (variant, more = {}) => resolveObject({ entry: 'door', variant, fit: FIT, ...more });
const inside = (b, B, e = 1e-4) => [0, 1, 2].every((k) => b.min[k] >= B.min[k] - e && b.max[k] <= B.max[k] + e);

describe('every variant answers for itself', () => {
  for (const variant of DOOR_VARIANT_IDS) {
    it(`${variant}: blocks closed, lets a walker through open`, () => {
      expect(door(variant, { state: 'closed' }).clearance.passable).toBe(false);
      const open = door(variant, { state: 'open' });
      expect(open.clearance.passable).toBe(true);
      expect(open.clearance.width).toBeGreaterThanOrEqual(FIT.width - 2 * open.params.thick - 1e-6);
      expect(open.clearance.height).toBeCloseTo(FIT.height, 4);
    });

    it(`${variant}: its sweep holds every pose on the way, and its collider moves with t`, () => {
      const leaves = DOOR.leaves(variant, DOOR.params(FIT, variant));
      const sw = door(variant).sweep;
      for (let i = 0; i <= 10; i++) {
        const o = door(variant, { t: i / 10 });
        o.collider.forEach((b, j) => expect(inside(b, sw[j]), `${variant} t ${i / 10} leaf ${b.of}`).toBe(true));
      }
      expect(JSON.stringify(collider(leaves, 0))).not.toBe(JSON.stringify(collider(leaves, 1)));
    });

    it(`${variant}: every face of a leaf stands inside that leaf's collider, at any t`, () => {
      for (const t of [0, 0.37, 1]) {
        const o = door(variant, { t, skin: 'greybox' });
        for (const f of o.faces.filter((x) => x.part === 'body')) {
          const box = o.collider.find((b) => b.of === f.leaf);
          for (const c of f.corners) expect(inside({ min: c, max: c }, box, 1e-3), `${variant} t ${t}`).toBe(true);
        }
      }
    });
  }

  it('says what each needs kept clear: a quarter in front, a wall pocket, the headroom', () => {
    const [q] = door('single').sweep, [pocket] = door('sliding-single').sweep, [head] = door('portcullis').sweep;
    expect(q.max[1] - q.min[1]).toBeGreaterThanOrEqual(FIT.width - 1e-3);   // the leaf's width out in front
    expect(pocket.max[0] - pocket.min[0]).toBeCloseTo(2 * FIT.width, 3);     // the opening and as much wall again
    expect(pocket.max[1] - pocket.min[1]).toBeLessThan(0.1);                 // and never off the wall's face
    expect(head.max[2]).toBeCloseTo(2 * FIT.height, 3);                       // as much again above the opening
  });

  it('a half-raised portcullis still blocks a walker; a half-open sliding door lets one through', () => {
    expect(door('portcullis', { t: 0.5 }).clearance.passable).toBe(false);
    expect(door('sliding-single', { t: 0.5 }).clearance.passable).toBe(true);
  });

  it('a double door swings both leaves to the same side, each about its own jamb', () => {
    const leaves = DOOR.leaves('double', DOOR.params(FIT, 'double'));
    const [l, r] = leaves.map((L) => poseLeaf(L, 1));
    expect(l.c[1]).toBeGreaterThan(0);
    expect(r.c[1]).toBeGreaterThan(0);
    expect(l.c[0]).toBeCloseTo(-FIT.width / 2, 3);
    expect(r.c[0]).toBeCloseTo(FIT.width / 2, 3);
  });

  it('is used from both sides of its handle, or from the control beside a portcullis', () => {
    expect(door('single').usePoints.map((u) => u.use)).toEqual(['handle', 'handle']);
    expect(door('single').usePoints.map((u) => u.side)).toEqual([1, -1]);
    expect(door('portcullis').usePoints).toEqual([expect.objectContaining({ use: 'control', side: 1 })]);
  });
});

describe('it stands in a real doorway', () => {
  it('fits the crypt\'s first doorway and blocks it, closed', () => {
    const anchor = assembleStageScene(starter('gothic-stone')).anchors.find((a) => a.kind === 'doorway');
    const o = resolveObject({ entry: 'door', variant: 'double', anchor, state: 'closed' });
    expect(o.params.width).toBeCloseTo(anchor.width, 4);
    const span = (bs, k) => Math.max(...bs.map((b) => b.max[k])) - Math.min(...bs.map((b) => b.min[k]));
    expect(Math.max(span(o.collider, 0), span(o.collider, 1))).toBeCloseTo(anchor.width, 2);
    expect(o.faces.every((f) => f.corners.every((c) => c[2] >= anchor.at[2] - 1e-6))).toBe(true);
  });
});

describe('the skin is the render, on top', () => {
  it('every skin builds every variant in values only', () => {
    for (const skin of DOOR_SKIN_IDS) for (const variant of DOOR_VARIANT_IDS) {
      const m = objectMeasures(door(variant, { skin }).faces, door(variant).frame, 'interactable');
      expect(m.valuesOnly, `${skin} ${variant}`).toBe(true);
    }
  });

  it('the plank skin holds every object law on the single door it was drawn for, closed and open', () => {
    for (const state of ['closed', 'open']) {
      const o = door('single', { skin: 'plank', state });
      expect(objectAdvice(objectMeasures(o.faces, o.frame, o.interest), o.interest), state).toEqual([]);
    }
  });

  it('builds the same bytes twice', () => {
    expect(JSON.stringify(door('double', { skin: 'plank', t: 0.4 }))).toBe(JSON.stringify(door('double', { skin: 'plank', t: 0.4 })));
  });
});

describe('eject', () => {
  it('freezes the variant, skin and numbers; an edited number rebuilds by that number', () => {
    const frozen = ejectObject(door('sliding-double', { skin: 'plank' }));
    expect(frozen).toMatchObject({ kind: 'game-object', entry: 'door', variant: 'sliding-double', skin: 'plank', ejected: true });
    frozen.params.width = 2;
    const o = resolveObject({ entry: 'door', variant: frozen.variant, skin: frozen.skin, params: frozen.params, state: 'open' });
    expect(o.clearance.width).toBeCloseTo(2, 3);
  });
});

describe('the rules', () => {
  it('an unlocked door opens when used', () => {
    const bus = createBusState(DOOR.rules('door-1'), []);
    processEvents(bus, [{ type: 'use-door-1' }]);
    expect(bus.vars['door-1-open']).toBe(1);
  });

  it('a locked door ignores a use until its key is taken, then opens on the next use', () => {
    const bus = createBusState(DOOR.rules('door-1', { unlock: 'pickup:rune-key' }), []);
    processEvents(bus, [{ type: 'use-door-1' }]);
    expect(bus.vars['door-1-open']).toBe(0);
    processEvents(bus, [{ type: 'pickup:rune-key' }]);
    expect(bus.vars['door-1-open']).toBe(0);
    processEvents(bus, [{ type: 'use-door-1' }]);
    expect(bus.vars['door-1-open']).toBe(1);
  });
});

describe('refusals name the list', () => {
  it('an unknown entry, variant, skin or state', () => {
    expect(() => resolveObject({ entry: 'window', variant: 'single', fit: FIT })).toThrow(/known: door/);
    expect(() => door('revolving')).toThrow(/single, double, sliding-single, sliding-double, portcullis/);
    expect(() => door('single', { skin: 'chrome' })).toThrow(/greybox, plank/);
    expect(() => door('single', { state: 'ajar' })).toThrow(/closed, open, locked/);
  });
});
