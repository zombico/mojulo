/**
 * The door, the first playscape archetype: one archetype transforms to its world (an iron-bound plank door in a lich's
 * crypt, a sliding slab in a lab), fits the doorway it stands in, holds every object law in every state, and freezes
 * when ejected. The measures are shown to bite: a plain slab, a speck of a detail, a coloured face and a detail in the
 * body's band each draw advice.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject, ejectObject, ARCHETYPES } from './index.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { OBJECT_LAWS, INTEREST } from './laws.js';
import { DOOR, DOOR_FORMS } from './door.js';
import { stageSetting } from '../../era/kit-settings.js';
import { starter } from '../../era/entries.js';
import { assembleStageScene } from '../../era/stage.js';
import { createBusState, processEvents } from '../../worlds/event-bus.js';

const LICH_CRYPT = stageSetting({ ...starter('gothic-stone'), setting: { fiction: 'fantasy' } });
const LAB = stageSetting(starter('research-lab'));
const FIT = { width: 1.4, height: 2.6 };
const FRONT = { at: [0, 0, 0], U: [1, 0, 0] };
const judge = (o) => objectAdvice(objectMeasures(o.faces, FRONT, o.interest), o.interest);

describe('the door transforms to its world', () => {
  it('stands as iron-bound planks in a lich\'s crypt and as a sliding slab in a lab', () => {
    expect(resolveObject({ archetype: 'door', setting: LICH_CRYPT, fit: FIT }).form).toBe('plank');
    expect(resolveObject({ archetype: 'door', setting: LAB, fit: FIT }).form).toBe('slab');
  });

  it('a world no form fits gets the nearest, stamped with what it misses, never refused', () => {
    const o = resolveObject({ archetype: 'door', setting: stageSetting(starter('island-plaza')), fit: FIT });
    expect(o.fit.fits).toBe(false);
    expect(o.fit.misses.map((m) => m.axis)).toEqual(['era']);
  });

  it('sizes itself to a real doorway of the crypt', () => {
    const scene = assembleStageScene(starter('gothic-stone'));
    const anchor = scene.anchors.find((a) => a.kind === 'doorway');
    const o = resolveObject({ archetype: 'door', setting: LICH_CRYPT, anchor });
    expect(o.params.w).toBeCloseTo(anchor.width, 4);
    expect(o.params.h).toBeCloseTo(anchor.height, 4);
    const zs = o.faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(anchor.at[2] - 1e-6);
  });

  it('builds the same bytes twice', () => {
    const a = resolveObject({ archetype: 'door', setting: LICH_CRYPT, fit: FIT, state: 'open' });
    const b = resolveObject({ archetype: 'door', setting: LICH_CRYPT, fit: FIT, state: 'open' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('the object laws', () => {
  for (const form of Object.keys(DOOR_FORMS)) for (const state of DOOR.states) {
    it(`a ${form} door, ${state}: every law in band`, () => {
      expect(judge(resolveObject({ archetype: 'door', form, fit: FIT, state }))).toEqual([]);
    });
  }

  it('every law the advice names is a written law, and every archetype has a rank', () => {
    for (const A of Object.values(ARCHETYPES)) expect(INTEREST[A.interest], A.id).toBeTruthy();
    const o = resolveObject({ archetype: 'door', form: 'plank', fit: FIT });
    const m = { ...objectMeasures(o.faces, FRONT, o.interest), segments: 0, third: 0.05, detailPx: 3, emboss: 0, valuesOnly: false, status: 0, bands: { 3: [1, 1] } };
    for (const a of objectAdvice(m, 'interactable')) expect(OBJECT_LAWS[a.law], a.law).toBeTruthy();
  });

  it('a plain slab with no parts draws inverse-interest, 33/66, emboss and accent advice', () => {
    const plain = resolveObject({ archetype: 'door', form: 'plank', fit: FIT });
    const faces = plain.faces.filter((f) => f.part === 'body');
    const laws = objectAdvice(objectMeasures(faces, FRONT, 'interactable'), 'interactable').map((a) => a.law);
    expect(laws).toEqual(expect.arrayContaining(['inverse-interest', 'thirty-three', 'emboss-fill', 'accent-is-use']));
  });

  it('a detail too small to read at play distance misses the eye spot', () => {
    const p = structuredClone(resolveObject({ archetype: 'door', form: 'plank', fit: FIT }).params);
    p.plate = { ...p.plate, wide: 0.04, tall: 0.05 };
    const o = resolveObject({ archetype: 'door', form: 'plank', params: p, fit: FIT });
    expect(judge(o).map((a) => a.line).join('\n')).toMatch(/spans 0\.0\d+ of the object|eye spot/);
  });

  it('a coloured face breaks values-only; a detail in the body\'s band is lost to a three-value tone', () => {
    const o = resolveObject({ archetype: 'door', form: 'plank', fit: FIT });
    const tinted = o.faces.map((f, i) => (i === 0 ? { ...f, tint: [0.5, 0.3, 0.2] } : f));
    expect(objectAdvice(objectMeasures(tinted, FRONT, 'interactable'), 'interactable').map((a) => a.law)).toContain('values-only');
    const p = structuredClone(o.params);
    p.values.plate = p.values.body;
    expect(judge(resolveObject({ archetype: 'door', form: 'plank', params: p, fit: FIT })).map((a) => a.law)).toContain('detail-holds-band');
  });
});

describe('eject', () => {
  it('freezes the form and its numbers: an ejected crypt door stays planks in a lab', () => {
    const frozen = ejectObject(resolveObject({ archetype: 'door', setting: LICH_CRYPT, fit: FIT }));
    expect(frozen).toMatchObject({ kind: 'game-object', archetype: 'door', form: 'plank', ejected: true });
    const again = resolveObject({ archetype: 'door', setting: LAB, form: frozen.form, params: frozen.params });
    expect(again.form).toBe('plank');
    expect(JSON.stringify(again.faces)).toBe(JSON.stringify(resolveObject({ archetype: 'door', setting: LICH_CRYPT, fit: FIT }).faces));
  });

  it('an edited number rebuilds the door by that number', () => {
    const frozen = ejectObject(resolveObject({ archetype: 'door', setting: LICH_CRYPT, fit: FIT }));
    frozen.params.boards = 9;
    const o = resolveObject({ archetype: 'door', form: frozen.form, params: frozen.params });
    expect(o.faces.filter((f) => f.part === 'fill').length).toBeGreaterThan(resolveObject({ archetype: 'door', form: 'plank', fit: FIT }).faces.filter((f) => f.part === 'fill').length);
  });
});

describe('the door\'s rules', () => {
  it('an unlocked door opens when used', () => {
    const ev = DOOR.rules('door-1');
    const bus = createBusState(ev, []);
    processEvents(bus, [{ type: 'use-door-1' }]);
    expect(bus.vars['door-1-open']).toBe(1);
  });

  it('a locked door ignores a use until its key is taken, then opens on the next use', () => {
    const ev = DOOR.rules('door-1', { unlock: 'pickup:rune-key' });
    const bus = createBusState(ev, []);
    processEvents(bus, [{ type: 'use-door-1' }]);
    expect(bus.vars['door-1-open']).toBe(0);
    processEvents(bus, [{ type: 'pickup:rune-key' }]);
    expect(bus.vars['door-1-open']).toBe(0);
    processEvents(bus, [{ type: 'use-door-1' }]);
    expect(bus.vars['door-1-open']).toBe(1);
  });
});
