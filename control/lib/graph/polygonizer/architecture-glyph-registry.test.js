import { describe, expect, it } from 'vitest';

import { getSketchVocabCard, listSketchVocab } from '../sketch-vocab/loader.js';
import {
  ARCHITECTURE_GLYPH_CONCEPTS,
  ARCHITECTURE_GLYPH_SOURCE_SHEETS,
  findArchitectureGlyphConceptsForPrompt,
  getArchitectureGlyphConcept,
  instantiateArchitectureGlyphPlan,
  listArchitectureGlyphConcepts,
} from './architecture-glyph-registry.js';

describe('architecture glyph registry', () => {
  it('exposes a broad concept vocabulary with unique ids and complete structure', () => {
    expect(ARCHITECTURE_GLYPH_CONCEPTS.length).toBeGreaterThanOrEqual(25);
    expect(ARCHITECTURE_GLYPH_SOURCE_SHEETS).toContain('26-urban-furniture-infrastructure.svg');

    const ids = new Set();
    const families = new Set();
    for (const entry of ARCHITECTURE_GLYPH_CONCEPTS) {
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      families.add(entry.family);
      expect(entry.aliases.length).toBeGreaterThan(0);
      expect(entry.parts.length).toBeGreaterThan(1);
      expect(Object.keys(entry.variationAxes).length).toBeGreaterThan(0);
      expect(entry.placement.length).toBeGreaterThan(0);
      expect(entry.renderHints.length).toBeGreaterThan(0);
      expect(entry.exampleRefs.length).toBeGreaterThan(0);
    }

    expect([...families].sort()).toEqual([
      'building',
      'civic',
      'facade',
      'farm',
      'industrial',
      'infrastructure',
      'residential',
      'roof',
      'sport',
      'transport',
      'urban',
    ]);
  });

  it('supports direct listing and lookup', () => {
    expect(getArchitectureGlyphConcept('urban.bus-stop-shelter')?.parts).toContain('bench');
    expect(listArchitectureGlyphConcepts({ family: 'urban' }).map((entry) => entry.id)).toContain('urban.gas-station');
    expect(listArchitectureGlyphConcepts({ tag: 'tower' }).map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        'building.facade-wrap-tower',
        'building.radial-wrap-tower',
        'infrastructure.cell-tower',
        'infrastructure.power-tower',
      ]),
    );
    expect(getArchitectureGlyphConcept('building.radial-wrap-tower')?.wrapNet.kind).toBe('radialWrap');
    expect(listArchitectureGlyphConcepts({ family: 'transport' }).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['transport.airport-terminal', 'transport.train-station']),
    );
  });

  it('finds concepts from natural prompt language', () => {
    const urban = findArchitectureGlyphConceptsForPrompt(
      'city block with storefronts, bus stop, phone booth, fire hydrant, and cell tower',
      { limit: 8 },
    ).map((entry) => entry.id);

    expect(urban).toEqual(expect.arrayContaining([
      'facade.storefront-podium',
      'urban.bus-stop-shelter',
      'urban.phone-booth',
      'urban.hydrant-utility',
      'infrastructure.cell-tower',
    ]));

    const rural = findArchitectureGlyphConceptsForPrompt('farm with barn, windmill, silo, corrals, and plowed field').map((entry) => entry.id);
    expect(rural).toEqual(expect.arrayContaining(['farm.farmyard-core', 'farm.tracted-field']));

    const hub = findArchitectureGlyphConceptsForPrompt('airport terminal next to a train station with bleacher seating').map((entry) => entry.id);
    expect(hub).toEqual(expect.arrayContaining([
      'transport.airport-terminal',
      'transport.train-station',
      'sport.bleacher-terraces',
    ]));

    const skyline = findArchitectureGlyphConceptsForPrompt('downtown city skyline with angular towers and a heroic radial tower').map((entry) => entry.id);
    expect(skyline).toEqual(expect.arrayContaining([
      'building.facade-wrap-tower',
      'building.radial-wrap-tower',
    ]));
  });

  it('instantiates varied but repeatable concept plans', () => {
    const ids = ['urban.bus-stop-shelter', 'infrastructure.cell-tower', 'facade.allocated-balcony'];
    const a = instantiateArchitectureGlyphPlan(ids, { seed: 'block-a' });
    const b = instantiateArchitectureGlyphPlan(ids, { seed: 'block-a' });
    const c = instantiateArchitectureGlyphPlan(ids, { seed: 'block-b' });

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.atoms).toHaveLength(3);
    expect(a.atoms[0].parameters).toHaveProperty('shelter');
    expect(a.atoms[1].parameters).toHaveProperty('levels');
  });

  it('registers a model-facing sketch vocab card for prompt injection', () => {
    const card = getSketchVocabCard('architectural-glyph-language');
    expect(card?.tier).toBe('recipe');
    expect(card?.body).toContain('architecture-glyph-registry.js');

    const recipeIds = listSketchVocab({ tier: 'recipe' }).map((entry) => entry.id);
    expect(recipeIds).toContain('architectural-glyph-language');
  });
});
