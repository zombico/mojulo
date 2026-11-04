// versus hero: a character's own strikes in the fight. The concepts on the default male hero: its punches fill the
// boxer's slots at their strength's frame data, starting and ending on its own guard (the fighter's stand); the track
// is continuous (no angle wraps through the floor); in the sim its jab hits a standing opponent and is blocked by one
// holding back, the advantage measured there the one the move records; and the word is refused where it cannot be read.
import { describe, it, expect } from 'vitest';
import { heroRecord } from '@/lib/mcp/tools/layered.js';
import { resolveCharacters, characterBody, fightClips, FIGHT_REACTS } from './versus-character.js';
import { rosterEntry } from './versus-page.js';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus } from './versus-core.js';
import { STRENGTHS } from './versus-library.js';
import { readHeroMoves, HERO_MOVE_SLOTS } from './versus-hero.js';
import { BTN } from './versus-input.js';
import { rigJoints } from './versus-rig.js';

const ROWS = { him: { kind: 'layered', hero: heroRecord({ cast: 'male' }) } };
const lookup = (ref) => ROWS[ref] ?? null;
const Z = { x: 0, y: 0, b: 0 };
/** two angles' difference as directions (degrees, 0 … 180) */
const dirOff = (a, b) => { const d = (((a - b) % 360) + 360) % 360; return Math.min(d, 360 - d); };

describe('versus: a character\'s own strikes', async () => {
  const [entry] = await resolveCharacters([{ id: 'boxer', tradition: 'boxing', hero: { ref: 'him' }, moves: 'hero' }], lookup);
  const F = compileFighter(rosterEntry(entry, 0).recipe);

  it('fills the boxer\'s slots with its own punches at their strength\'s frame data, from its own guard and home to it', () => {
    for (const [slot, word] of Object.entries(HERO_MOVE_SLOTS)) {
      const m = F.moves[slot], st = STRENGTHS[slot.split('.')[1]];
      expect(m).toMatchObject({ id: word, hero: true, startup: st.startup, active: st.active, recovery: st.recovery });
      expect(m.frames[m.startup].hit).toBeTruthy();
      expect(m.frames[m.startup - 1].hit).toBeUndefined();
      // (the first frame within a few degrees of the guard, the last back on it)
      // (as directions: a forearm passing end-on to the plane may come home a whole turn round, the same direction)
      for (const fr of [m.frames[1], m.frames[m.total]]) for (const k of ['armF', 'armB']) fr.pose[k].forEach((a, i) => expect(dirOff(a, F.poses.guard[k][i])).toBeLessThan(8));
    }
    expect(F.poses.guard).toEqual(entry.guard);
    // (a fist out at the jab's contact further from the body than in the guard)
    expect(F.moves['stand.L'].reach).toBeGreaterThan(F.idle.stand.push[2]);
  });

  it('pushes with its guard\'s legs: its lead knee and ankle, its rear ones, inside its push box', () => {
    const J = rigJoints(F.body, F.poses.guard), [lo, , hi] = F.idle.stand.push;
    for (const k of ['kneeF', 'ankleF']) expect(hi).toBeGreaterThanOrEqual(J[k][0] + F.body.limbR);
    for (const k of ['kneeB', 'ankleB']) expect(lo).toBeLessThanOrEqual(J[k][0] - F.body.limbR);
  });

  it('lays a continuous track: no channel turns more than a quarter turn between two of its samples', () => {
    for (const { hero } of Object.values(entry.heroNormals)) for (let i = 1; i < hero.poses.length; i++) {
      const a = hero.poses[i - 1], b = hero.poses[i];
      for (const k of ['armF', 'armB', 'legF', 'legB']) b[k].forEach((v, j) => expect(Math.abs(v - a[k][j])).toBeLessThan(90));
    }
  });

  it('in the sim its jab hits a standing opponent and is blocked by one holding back, at the advantage it records', () => {
    const measure = (block) => {
      const ctx = { fighters: [F, F] };
      let s = newVersus(ctx, { rules: { intro: 1 } }); s = stepVersus(s, [Z, Z], ctx);
      s.p[0].x = -380; s.p[1].x = 380;
      let hitAt = null, ev = null; const free = [null, null];
      for (let k = 0; k < 60; k++) {
        s = stepVersus(s, [{ x: 0, y: 0, b: k === 0 ? BTN.L : 0 }, block ? { x: 1, y: 0, b: 0 } : Z], ctx);
        const e = s.events.find((x) => x.t === 'hit' || x.t === 'block'); if (e) { hitAt = k; ev = e.t; }
        if (hitAt !== null) { if (free[0] === null && s.p[0].st === 'stand' && !s.p[0].mv) free[0] = k; if (free[1] === null && s.p[1].st === 'stand' && !s.p[1].mv) free[1] = k; }
      }
      return { ev, adv: free[1] - free[0] };
    };
    expect(measure(false)).toEqual({ ev: 'hit', adv: F.moves['stand.L'].adv.hit });
    expect(measure(true)).toEqual({ ev: 'block', adv: F.moves['stand.L'].adv.block });
  });

  it('is played in its own body in an arena: one skinned pack carrying its fight\'s clips, every compiled frame naming its clip\'s moment', async () => {
    const fight = fightClips(entry.heroNormals);
    expect(fight).toEqual(expect.arrayContaining([...Object.values(HERO_MOVE_SLOTS), ...FIGHT_REACTS]));
    const B = await characterBody(ROWS.him, { fight });
    expect(B.played).toBe(true);
    expect(Object.keys(B.clips).sort()).toEqual([...fight].sort());
    expect(B.parts.filter(Boolean).every((p) => p.jnt && p.wgt && p.faces > 0)).toBe(true);
    for (const c of Object.values(B.clips)) expect(c.b.length).toBe(c.k * B.bones.length * 7);
    // (the row itself is untouched: its own motion words are its own)
    expect(ROWS.him.hero.motion).toBeUndefined();
    const m = F.moves['stand.H'];
    expect(m.frames.slice(1).map((f) => f.u)).toEqual([...m.frames.slice(1).map((f) => f.u)].sort((a, b) => a - b));
    expect(m.frames[m.startup].u).toBeCloseTo(entry.heroNormals['stand.H'].hero.contact, 3);
    // a character fighting with the tradition's moves keeps the figure posed from the plane
    expect((await characterBody(ROWS.him)).played).toBeUndefined();
  }, 300000);

  it('refuses the word where it cannot be read', async () => {
    expect(() => readHeroMoves({ 'air.L': 'jab' })).toThrow(/ground normal/);
    expect(() => readHeroMoves({ 'stand.L': 'roundhouse' })).toThrow(/not a strike/);
    await expect(resolveCharacters([{ id: 'x', moves: 'hero', archetype: 'all-rounder' }], lookup)).resolves.toBeTruthy();
    await expect(resolveCharacters([{ id: 'x', hero: { ref: 'him' }, moves: { 'stand.L': 'kick' } }], lookup)).rejects.toThrow(/roster\[0\]\.moves\.stand\.L/);
  });
});
