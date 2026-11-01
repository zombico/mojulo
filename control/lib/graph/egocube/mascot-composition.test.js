import { describe, it, expect } from 'vitest';
import { animalCard } from './mascot-animals.js';
import { auditAnimalComposition, compositionMoves, compositionLines } from './mascot-composition.js';
import { rollMascot } from './mascot.js';
import { mascotPlan, mascotPlanFromSheet } from './mascot-form.js';

describe('animal mascot composition audits', () => {
  it('preserves an identity-led fox with a broad tail counterweight', () => {
    const audit = auditAnimalComposition(animalCard('fox'));
    expect(audit.focus).toBe('ears');
    expect(audit.suggestions.join(' ')).toMatch(/tail mass/);
  });
  it('lets the panda coat own the focal contrast', () => {
    const audit = auditAnimalComposition(animalCard('giantPanda'));
    expect(audit.focus).toBe('coat');
    expect(audit.suggestions.join(' ')).toMatch(/light\/dark/);
  });
  it('reserves face space for owl eyes', () => {
    const audit = auditAnimalComposition(animalCard('greatHornedOwl'));
    expect(audit.focus).toBe('eyes');
    expect(audit.suggestions.join(' ')).toMatch(/negative space/);
  });
  it('keeps lion mane as one primary mass', () => {
    const audit = auditAnimalComposition(animalCard('lion'));
    expect(audit.suggestions.join(' ')).toMatch(/framing mass/);
  });
  it('rejects malformed cards and stays deterministic', () => {
    expect(() => auditAnimalComposition(null)).toThrow(TypeError);
    const card = animalCard('elephant');
    expect(auditAnimalComposition(card)).toEqual(auditAnimalComposition(card));
  });
});

describe('the composition pass: moves stamped on a rolled sheet, acted on by the body', () => {
  // one case per move, chosen from the moves themselves
  const roll = (brief) => rollMascot({ brief });
  it('moves only where the audit applies, never touching the identity', () => {
    const fox = auditAnimalComposition(animalCard('fox')).moves, panda = compositionMoves(animalCard('giantPanda'));
    expect(fox).toMatchObject({ focus: 'ears', tail: 'broad' });
    expect(fox.piece).toBeUndefined();
    expect(panda).toMatchObject({ focus: 'coat', piece: 'quiet' });
    expect(compositionMoves(animalCard('greatHornedOwl'))).toMatchObject({ piece: 'quiet', beak: 'small' });
    for (const id of ['fox', 'giantPanda']) expect(compositionLines(compositionMoves(animalCard(id))).length).toBeGreaterThan(0);
  });
  it('a sheet keeps its moves by value and says them in its notes', () => {
    const sheet = roll('a panda mascot with a scarf');
    expect(sheet.animal.composition).toEqual(compositionMoves(animalCard('giantPanda')));
    expect(sheet.notes.palette.map((n) => n.line).join(' ')).toMatch(/quiet/);
    expect(mascotPlanFromSheet(sheet).create.spec.plan).toBeTruthy();
  });
  it('a quiet piece is drawn in the coat\'s own family, never the accent across the wheel', () => {
    const sheet = roll('a panda mascot with a scarf'), loud = { ...sheet, animal: { ...sheet.animal, composition: undefined } };
    const q = mascotPlan(sheet).plan.palette, l = mascotPlan(loud).plan.palette;
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), far = (a, b) => Math.hypot(...rgb(a).map((x, i) => x - rgb(b)[i]));
    expect(far(q.Adorn, q.Body)).toBeLessThan(far(l.Adorn, l.Body));   // nearer the coat than the loud piece
    expect(q.Adorn).not.toBe(q.Body);   // still a piece, not lost on the coat
  });
  it('the broad brush and the small beak change only their own segments', () => {
    const seg = (sheet, name) => mascotPlan(sheet).plan.segments.find((s) => s.name === name);
    const bare = (sheet) => ({ ...sheet, animal: { ...sheet.animal, composition: undefined } });
    const fox = roll('a fox mascot'), owl = roll('an owl mascot');
    expect(Math.max(...seg(fox, 'tail0').stations.map((s) => s.r[0]))).toBeGreaterThan(Math.max(...seg(bare(fox), 'tail0').stations.map((s) => s.r[0])));
    expect(Math.max(...seg(owl, 'snout').stations.map((s) => s.r[0]))).toBeLessThan(Math.max(...seg(bare(owl), 'snout').stations.map((s) => s.r[0])));
    expect(seg(fox, 'head')).toEqual(seg(bare(fox), 'head'));
  });
  it('a sheet rolled before the pass (no stamp) draws as it always did, and the feature style takes none', () => {
    const sheet = roll('a lion mascot'), old = { ...sheet, animal: { ...sheet.animal } };
    delete old.animal.composition;
    expect(JSON.stringify(mascotPlan(old).plan)).toBe(JSON.stringify(mascotPlan({ ...old, animal: { ...old.animal, composition: undefined } }).plan));
    expect(rollMascot({ brief: 'a fox mascot', facets: { style: 'feature' } }).animal.composition).toBeUndefined();
  });
});
