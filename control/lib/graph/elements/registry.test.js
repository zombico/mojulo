// elements — what a world is styled from, each seen as itself. The laws: every geocube, kit and grammar mojulo holds is
// listed (read from the tables, not a list here); an element's colours are its own; its specimen is a recipe the World
// draws and is never stored; a view it does not have is refused; the recipes that name it are found by what they name.

import { describe, it, expect } from 'vitest';
import { GEOCUBE_PRESETS, readGeocube, geocubeRamps } from '../era/geocube.js';
import { STAGE_KITS } from '../era/stage.js';
import { GRAMMAR_IDS } from '../city/plan/grammars.js';
import { ELEMENT_FAMILIES, listElements, readElement, elementManifest, usedBy } from './registry.js';

describe('the families', () => {
  it('list every element the tables hold', () => {
    expect(ELEMENT_FAMILIES.map((f) => f.id)).toEqual(['geocubes', 'kits', 'grammars']);
    expect(listElements('geocubes').map((e) => e.id)).toEqual(Object.keys(GEOCUBE_PRESETS));
    expect(listElements('kits').map((e) => e.id)).toEqual(Object.keys(STAGE_KITS));
    expect(listElements('grammars').map((e) => e.id)).toEqual([...GRAMMAR_IDS]);
    expect(() => listElements('moods')).toThrow(/not a family/);
  });

  it('give each element its own colours and its views', () => {
    const id = Object.keys(GEOCUBE_PRESETS)[0];
    const cube = readElement('geocubes', id);
    expect(cube.colours).toEqual(Object.values(geocubeRamps(readGeocube(id))));
    expect(cube.views.map((v) => v.id)).toEqual(['room', 'land']);
    expect(cube.document.id).toBe(id);
    for (const f of ['kits', 'grammars']) for (const el of listElements(f)) for (const ramp of el.colours) for (const c of ramp) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(() => readElement('geocubes', 'nowhere')).toThrow(/not one of the geocubes/);
  });
});

describe('specimens', () => {
  it('are recipes the World draws: a cube\'s room and land, a kit\'s stage (a room kit in a room), a grammar\'s small city', () => {
    const id = Object.keys(GEOCUBE_PRESETS)[0];
    expect(elementManifest('geocubes', id)).toEqual({ kind: 'geocube', cube: id, show: 'room' });
    expect(elementManifest('geocubes', id, 'land')).toEqual({ kind: 'geocube', cube: id, show: 'land' });
    expect(elementManifest('kits', 'isekai-meadow')).toEqual({ kind: 'stage', kit: 'isekai-meadow', seed: 1 });
    expect(elementManifest('kits', 'gothic-stone').rooms).toHaveLength(1);
    const city = elementManifest('grammars', 'paris');
    expect(city).toMatchObject({ kind: 'city', grammar: 'paris', fidelity: 'massing' });
    expect(elementManifest('grammars', 'paris', 'look').fidelity).toBeUndefined();
    expect(() => elementManifest('geocubes', id, 'sky')).toThrow(/is seen as room, land/);
  });
});

describe('used by', () => {
  it('finds the recipes that name an element, by what they name', () => {
    const rows = [
      { ref: 's1', manifest: { kind: 'stage', geocube: 'gothic-night' } },
      { ref: 's2', manifest: { kind: 'stage', geocube: { from: 'gothic-night', colour: {} } } },
      { ref: 'w1', title: 'A world', manifest: { kind: 'gameworld', id: 'w', style: { kit: 'isekai-meadow', geocube: 'island-noon' } } },
      { ref: 'c1', manifest: { kind: 'city', grammar: { from: 'tokyo' } } },
      { ref: 'c2', manifest: { kind: 'city', grammar: 'paris' } },
    ];
    expect(usedBy('geocubes', 'gothic-night', rows).map((r) => r.ref)).toEqual(['s1', 's2']);
    expect(usedBy('geocubes', 'island-noon', rows)).toEqual([{ ref: 'w1', title: 'A world', kind: 'gameworld' }]);
    expect(usedBy('kits', 'isekai-meadow', rows).map((r) => r.ref)).toEqual(['w1']);
    expect(usedBy('grammars', 'tokyo', rows).map((r) => r.ref)).toEqual(['c1']);
  });
});
