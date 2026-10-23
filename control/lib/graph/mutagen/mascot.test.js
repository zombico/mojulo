import { describe, it, expect } from 'vitest';
import { OOZES, resolveMutagen, oozeFauna, oozeParams } from './index.js';
import { mascotFor, MASCOT_PIECES } from './mascot.js';
import { PIECE_KINDS, colorWords, pushErrors, pushPlan } from './push.js';
import { animalCard } from '../egocube/mascot-animals.js';
import { SPECIES, speciesParams } from '../fauna/species.js';
import { buildFauna } from '../fauna/build.js';
import { PER_RIG } from '../fauna/test-cases.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';

// The mascot reading, on species chosen in code by the card they read (a promise, a family's mass, a neck or none):
// one case per procedure, never the roster.
const cardOf = (pred) => Object.keys(SPECIES).find((id) => { try { return pred(animalCard(id), speciesParams(id)); } catch { return false; } });
const ROW = OOZES.mascot;

describe('mutagen: the mascot reading', () => {
  it('reads the animal\'s card: its promise says the piece, its mass weighs the limbs, its form grows the head', () => {
    const light = cardOf((c) => c.limbs === 1 && c.form === 'sprout'), heavy = cardOf((c) => c.limbs > 1.5 && c.form === 'toon');
    for (const id of [light, heavy]) {
      const card = animalCard(id), M = resolveMutagen(['mascot'], { key: id });
      expect(M.push.piece.kind).toBe(MASCOT_PIECES[card.promise]);
      expect(M.reads[0]).toMatch(new RegExp(`promises ${card.promise}, said by a ${M.push.piece.kind}`));
      expect(pushErrors(mascotFor(id, ROW).push, id)).toEqual([]);
    }
    const [a, b] = [light, heavy].map((id) => resolveMutagen(['mascot'], { key: id }).form);
    expect(b.legBulk).toBeGreaterThan(a.legBulk);
    expect(a.headScale).toBeGreaterThan(b.headScale);   // a sprout is more head than a toon
    // no species under it: the row's own reading
    expect(resolveMutagen(['mascot'], { key: '' }).push.piece.kind).toBe(ROW.push.piece.kind);
    expect(resolveMutagen(['mascot'], { key: '' }).reads).toBeUndefined();
  });

  it('an identifier is drawn big, one past the budget let go; a muzzle that is the name keeps its length', () => {
    const big = cardOf((c) => c.identity.includes('ears')), tail = cardOf((c) => c.identity.includes('tail')), gone = cardOf((c) => c.dropped.includes('tail'));
    expect(mascotFor(big, ROW).push.ears.height).toBeGreaterThan(1);
    expect(mascotFor(tail, ROW).form.tailBush).toBeGreaterThan(1);
    expect(mascotFor(gone, ROW).form.tailBush).toBeUndefined();
    const trunk = cardOf((c) => c.kit.muzzle === 'trunk'), button = cardOf((c) => c.kit.muzzle === 'button');
    expect(mascotFor(trunk, ROW).push.head.muzzle.length).toBeGreaterThan(mascotFor(button, ROW).push.head.muzzle.length);
  });

  it('the joint law holds: the mascot moves no species joint, its piece stands on joints of its own', () => {
    const id = PER_RIG[0], P = speciesParams(id), A = buildFauna(P).joints, B = oozeFauna(P, resolveMutagen(['mascot'], { key: id })).joints;
    for (const [j, v] of Object.entries(A)) if (!j.startsWith('throat')) expect(B[j], j).toEqual(v);
    expect(Object.keys(B).filter((j) => !(j in A)).every((j) => j.startsWith('ooze'))).toBe(true);
  });

  it('every piece is drawn on a body with a neck, in the colour across the wheel and a gold shine; no neck wears the bow', () => {
    const id = cardOf((c, P) => P.neckRA !== undefined && P.craniumRows && !P.headMesh), P = speciesParams(id), W = colorWords(P.colors.coat);
    for (const kind of PIECE_KINDS) {
      const r = {}, plan = oozeFauna(P, { form: {}, push: { piece: { kind, size: 1, color: 'opposite' } } }, r);
      const names = [...plan.segments.map((g) => g.name), ...(plan.heads[0].plan.ornaments || []).map((o) => o.name)].filter((n) => /^ooze/.test(n));
      expect(names.length, kind).toBeGreaterThan(0);
      expect(names.some((n) => new RegExp(kind === 'studs' ? 'Stud' : kind[0].toUpperCase() + kind.slice(1)).test(n)), kind).toBe(true);
      expect(plan.palette.Piece, kind).toBe(W.opposite);
      expect(expandPlan(plan).surfaces, kind).toMatchObject({ Piece: 'satin', Shine: 'gold' });
    }
    // every species has a neck: a plan made without one wears the bow
    const base = buildFauna(P), neckless = { ...base, segments: base.segments.filter((g) => g.name !== 'neck') };
    const plan = pushPlan(neckless, { piece: { kind: 'bell', size: 1 } }, P);
    expect(plan.heads[0].plan.ornaments.map((o) => o.name)).toContain('oozeBow');
    expect(plan.segments.some((g) => g.name === 'oozeCollar')).toBe(false);
  });

  it('the surface: owned colours (a grey coat keeps its values), toon eyes, no fur cards', () => {
    const tiled = cardOf((c, P) => (P.bodyTiles || []).length > 0), P = speciesParams(tiled);
    const Q = oozeParams(P, { form: {}, push: { saturate: 0.45, smooth: true, eyes: { toon: true } } });
    expect(Q.bodyTiles).toBeUndefined();
    expect(Q.colors.sclera).toBe('#fbf8f2');
    expect(Q.irisAngle).toBeGreaterThanOrEqual(54);
    const grey = { ...P, colors: { ...P.colors, coat: '#808080' } }, warm = { ...P, colors: { ...P.colors, coat: '#a0704a' } };
    expect(oozeParams(grey, { form: {}, push: { saturate: 0.45 } }).colors.coat).toBe('#808080');
    expect(oozeParams(warm, { form: {}, push: { saturate: 0.45 } }).colors.coat).not.toBe('#a0704a');
  });

  it('an eye too big to seat steps back alone; the rest of the face keeps its share', () => {
    const id = PER_RIG[0], r = {};
    oozeFauna(speciesParams(id), { form: {}, push: { head: { eye: 6, muzzle: { length: 0.6 } } } }, r);
    expect(r.face).toBe(1);
    expect([0.75, 0.5, 0]).toContain(r.eye);
  });
});
