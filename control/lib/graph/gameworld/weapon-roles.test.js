import { describe, expect, it } from 'vitest';
import { WEAPON_ROLES, SERVED, weaponRole, poleArmory, servedRoles, roleLoadout, bandShare } from './weapon-roles.js';
import { shooterPole } from './shooter-pole.js';
import { tunnelArena } from './tunnel-arena.js';
import { arenaSightlines, arenaAsks, askBoxes } from './lay-concerns.js';

// A WEAPON AS A ROLE: a job on a sightline band, its numbers from the band and the pole's time to kill; an arena's clear
// lines say which roles it serves, and each gun it serves is laid where its band's lines meet.

describe('weapon roles', () => {
  it('each role drops a body in its rounds at the poles; the long gun takes a head in one', () => {
    for (const p of [0, 1]) {
      const hp = shooterPole(p).hp;
      for (const role of ['close', 'long', 'area']) {
        const w = weaponRole(role, p).weapon, n = Math.ceil(hp / w.damage);
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(3);
      }
      const L = weaponRole('long', p).weapon;
      expect(L.damage * L.headshot).toBeGreaterThanOrEqual(hp);
    }
  });

  it('the mid gun is the pole\'s own rifle; bands are ordered close, mid, long', () => {
    expect(weaponRole('mid', 0.3).weapon).toEqual(shooterPole(0.3).weapon);
    const [c, m, l] = ['close', 'mid', 'long'].map((r) => WEAPON_ROLES[r].band);
    expect(c[1]).toBeLessThan(l[0]);
    expect(m[0]).toBeLessThan(c[1]);
    expect(m[1]).toBeGreaterThan(l[0]);
  });

  it('the realistic end carries the long gun, the stylized end the launcher, the middle both', () => {
    expect(poleArmory('realistic')).toEqual(['mid', 'close', 'long']);
    expect(poleArmory('stylized')).toEqual(['mid', 'close', 'area']);
    expect(poleArmory(0.5)).toEqual(['mid', 'close', 'long', 'area']);
  });

  it('a loadout: the rifle in hand, the pickups held: false, each slot its band and the range it holds', () => {
    const L = roleLoadout(0, ['close', 'long']);
    expect(L.map((c) => [c.name, c.held])).toEqual([['mid', undefined], ['close', false], ['long', false]]);
    expect(L.every((c) => Array.isArray(c.band))).toBe(true);
    expect(L[1].approach.standoff).toBeLessThan(L[2].approach.standoff);
  });

  it('an arena serves the bands its clear lines fall in', () => {
    expect(bandShare([2, 4, 30], [0, 10])).toBeCloseTo(2 / 3);
    const S = servedRoles([3, 5, 7, 9, 12, 14], ['close', 'long']);
    expect(S.map((s) => s.served)).toEqual([true, false]);
  });
});

describe('the arena\'s armory', () => {
  const frame = (H) => ({ centre: [0, 0], half: H, z: 0 });
  it('a close-quarters arena does not serve the long gun and lays none; a long-lined one does, where its long lines meet', () => {
    const tight = tunnelArena('a close quarters three-lane arena', { spawns: 4, weapons: ['close', 'long'] }).plan;
    const open = tunnelArena('a large sparse ring arena with long sightlines', { spawns: 4, weapons: ['close', 'long'] }).plan;
    const of = (P, role) => P.armory.find((a) => a.role === role);
    expect(of(tight, 'long').served).toBe(false);
    expect(of(tight, 'long').share).toBeLessThan(SERVED);
    expect(tight.drops.some((d) => d.slot === 'long')).toBe(false);
    expect(of(open, 'long').served).toBe(true);
    const guns = open.drops.filter((d) => d.gives === 'weapon');
    expect(new Set(guns.map((d) => d.slot))).toEqual(new Set(['close', 'long']));
    // each gun stands where more of the clear lines from it fall in its band than at the other gun's place
    const boxes = askBoxes(arenaAsks(open.pieces, (u, v) => [u, v, 0]));
    const lines = arenaSightlines(frame(open.half), boxes);
    expect(lines.length).toBeGreaterThan(0);
    const from = (d) => {
      const out = [];
      for (let u = -open.half + 2; u <= open.half - 2; u += 4) for (let v = -open.half + 2; v <= open.half - 2; v += 4) {
        const e = [u, v, 1.6];
        if (boxes.some((B) => u > B.min[0] - 1 && u < B.max[0] + 1 && v > B.min[1] - 1 && v < B.max[1] + 1)) continue;
        const dd = Math.hypot(u - d.u, v - d.v), blocked = boxes.some((B) => { for (let s = 0; s <= 1; s += 0.02) { const p = [d.u + (u - d.u) * s, d.v + (v - d.v) * s, 1.2 + 0.4 * s]; if (p[0] > B.min[0] && p[0] < B.max[0] && p[1] > B.min[1] && p[1] < B.max[1] && p[2] > B.min[2] && p[2] < B.max[2]) return true; } return false; });
        if (!blocked) out.push(dd);
      }
      return out;
    };
    const C = guns.find((d) => d.slot === 'close'), Lg = guns.find((d) => d.slot === 'long');
    expect(bandShare(from(Lg), WEAPON_ROLES.long.band)).toBeGreaterThan(bandShare(from(C), WEAPON_ROLES.long.band));
  });

  it('asked no guns, the plan is as it was', () => {
    const a = tunnelArena('a three-lane arena', { spawns: 4 }).plan, b = tunnelArena('a three-lane arena', { spawns: 4, weapons: [] }).plan;
    expect(a.armory).toBeUndefined();
    expect(JSON.stringify(a)).toBe(JSON.stringify({ ...b, armory: undefined }));
  });
});
