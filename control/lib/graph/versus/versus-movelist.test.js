import { describe, it, expect } from 'vitest';
import { moveList, motionText } from './versus-movelist.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';

// A FIGHTER'S MOVE LIST: its moves as its player reads them, in the player's own scheme, with their frame data; said in
// the game's language (its labels and its frame data's names are the runtime's words)
const base = solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe;
const F = compileFighter({ ...base, commands: { 'forward.M': { family: 'axe' } }, specials: { forward: { id: 'rekka' }, back: { id: 'boom' }, down: { id: 'flash' }, neutral: { id: 'roll' } } });
const find = (L, id) => L.flatMap((k) => k.moves).find((m) => m.id === id);

describe('versus move list', () => {
  it('motions read as arrows, a charge as its hold', () => {
    expect(motionText('236')).toBe('↓↘→');
    expect(motionText('623')).toBe('→↓↘');
    expect(motionText('[4]6')).toBe('[←] →');
    expect(motionText('[2]8')).toBe('[↓] ↑');
  });
  it('by kind, each section a word; every move its input in the player\'s scheme', () => {
    const C = moveList(F, 'classic'), M = moveList(F, 'modern');
    expect(C.map((k) => k.label.word)).toEqual(['normals', 'commandNormals', 'specials', 'supers', 'throws']);
    expect(find(C, 'special.back.M').input).toBe('[←] → + L·M·H');
    expect(find(M, 'special.back.M').input).toBe('S + ←');
    expect(find(C, 'forward.M').input).toBe('→ + M');
    expect(find(C, 'crouch.H').input).toBe('↓ + H');
    // (a rekka's later stages under it, the motion again)
    expect(['special.forward.M', 'special.forward.M~2', 'special.forward.M~3'].map((id) => find(C, id)?.name)).toEqual(['Rekka', 'Rekka II', 'Rekka III']);
    // (a fighter without command normals, without a super: no empty section)
    expect(moveList(compileFighter({ ...base, super: undefined }), 'modern').map((k) => k.label.word)).not.toContain('supers');
  });
  it('each move its frame data, its words the runtime\'s: an overhead says so, a knockdown, a roll that hits nothing', () => {
    const C = moveList(F, 'classic');
    const data = (id) => Object.fromEntries(find(C, id).data.map((d) => [d.what.word, d.value]));
    expect(data('forward.M')).toMatchObject({ startup: F.moves['forward.M'].startup, guard: { word: 'guardOverhead' } });
    expect(data('crouch.H').onHit).toEqual({ word: 'knockdown' });
    expect(data('special.neutral.M')).toMatchObject({ onHit: { word: 'noHit' }, damage: '—' });
    expect(data('special.down.M').landing).toBe(F.moves['special.down.M'].landing);
    expect(data('super').damage).toBe(F.moves.super.projectile ? F.moves.super.projectile.damage * F.moves.super.projectile.hits : F.moves.super.damage);
    for (const k of C) for (const m of k.moves) expect(m.about, m.id).toBeTypeOf('string');
  });
});
