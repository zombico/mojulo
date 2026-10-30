// A house's gate (sketch-mint.js houseGate): the mint's stamps and refusals, and the same on update_sketch. The roof a
// metal sheet is judged by is the one the render draws (its family by the house's look, tradition and form: a townhouse
// or a block rolls its own families), and an edit is held to what the mint holds: a bad form refused, a level added
// making the house a game's, a replaced recipe keeping the stamps its row carried.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-house-gate-'));

import { describe, expect, it } from 'vitest';
import { createSketchHandler, updateSketchHandler } from './sketch-mint.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { houseStyleOpts, houseStyleKey, homeLook } from '@/lib/graph/polygonizer/floorplan-styles.js';
import { roofMetalError } from '@/lib/graph/architecture/roof.js';

const roofMetal = { metal: 'copper' };
// does the render draw a flat deck on this house (its style's roof as the render rolls it, look 2 as minted)
const deckedAtRender = (m) => !!roofMetalError(houseStyleOpts('auto', houseStyleKey(m), 'exterior', homeLook({ ...m, houseLook: 2 })).roof);
// does the look-1 roll (the mint's reading before) draw one
const deckedAtLook1 = (m) => !!roofMetalError(houseStyleOpts('auto', houseStyleKey(m), 'exterior').roof);

describe('the roof a metal sheet is judged by at mint is the one the render draws', () => {
  it('a block whose render pitches its roof takes the sheet; one whose render decks it is refused', async () => {
    // (seeds chosen in code: one where the two readings disagree each way)
    const seeds = [...Array(24).keys()].map((i) => i + 1);
    const pitched = seeds.find((seed) => !deckedAtRender({ form: 'block', seed }) && deckedAtLook1({ form: 'block', seed }));
    const decked = seeds.find((seed) => deckedAtRender({ form: 'block', seed }) && !deckedAtLook1({ form: 'block', seed }));
    expect([pitched, decked].every(Number.isInteger)).toBe(true);
    const ok = await createSketchHandler({ title: 'block', manifest: { kind: 'floorplan', title: 'block', form: 'block', seed: pitched, roofMetal } });
    expect(ok.ok).toBe(true);
    await expect(createSketchHandler({ title: 'block', manifest: { kind: 'floorplan', title: 'block', form: 'block', seed: decked, roofMetal } }))
      .rejects.toThrow(/roofMetal: a metal roof needs a pitched style/);
  });
});

describe('update_sketch holds a house to the mint\'s gate', () => {
  it('a bad form is refused on update, as at mint', async () => {
    await createSketchHandler({ title: 'house', ref: 'sk_gate_form', manifest: { kind: 'floorplan', title: 'house', seed: 4, storeys: 2 } });
    await expect(updateSketchHandler({ ref: 'sk_gate_form', patch: [{ op: 'set', path: '/form', value: 'castle' }] })).rejects.toThrow(/form: one of/);
  });

  it('a level added makes the house a game\'s; a purpose the edit names stands', async () => {
    const made = await createSketchHandler({ title: 'house', ref: 'sk_gate_purpose', manifest: { kind: 'floorplan', title: 'house', seed: 4, storeys: 2 } });
    expect(made.ok).toBe(true);
    expect(SketchRepository.getByRef('sk_gate_purpose').manifest.purpose).toBe('show');
    await updateSketchHandler({ ref: 'sk_gate_purpose', patch: [{ op: 'set', path: '/level', value: {} }] });
    expect(SketchRepository.getByRef('sk_gate_purpose').manifest.purpose).toBe('game');
    await updateSketchHandler({ ref: 'sk_gate_purpose', patch: [{ op: 'set', path: '/purpose', value: 'show' }] });
    expect(SketchRepository.getByRef('sk_gate_purpose').manifest.purpose).toBe('show');
  });

  it('a replaced recipe keeps the stamps its row carried', async () => {
    await createSketchHandler({ title: 'house', ref: 'sk_gate_replace', manifest: { kind: 'floorplan', title: 'house', seed: 4, storeys: 2 } });
    const stored = SketchRepository.getByRef('sk_gate_replace').manifest;
    expect(stored.houseLook).toBe(2);
    await updateSketchHandler({ ref: 'sk_gate_replace', manifest: { kind: 'floorplan', title: 'house', seed: 5, storeys: 2 } });
    const next = SketchRepository.getByRef('sk_gate_replace').manifest;
    expect([next.houseLook, next.purpose, next.style]).toEqual([2, 'show', 'auto']);
  });
});
