// A BUILDING TO FIGHT THROUGH (era/programs.js `citadel`): a pathed plan whose rooms are sized for the fights a hero that
// plays strings asks for (gameroom/laws.js fitsLaw), one after another to its goal; a building laid for living in holds
// few of them, and is told so. One kit, chosen from the templates in code.
import { describe, it, expect } from 'vitest';
import { planProgram, PROGRAMS } from '../era/programs.js';
import { stageLevel } from '../structure/level.js';
import { roomNeeds } from '../gameroom/needs.js';
import { fitsLaw } from '../gameroom/laws.js';
import { FIGHT_KIND_IDS } from '../gameroom/fight.js';
import { TEMPLATE_ARSENALS } from './combos.js';

const KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => TEMPLATE_ARSENALS[id].weapons.some((W) => Object.values(W.moves).some((m) => m.launch > 0)));
const N = roomNeeds({ feel: KIT });
// the use whose every room holds some fight, and one laid for living in, found in the table
const holds = (P) => P.rooms.map((r) => FIGHT_KIND_IDS.filter((k) => fitsLaw(r, N, k).holds));
const FOUGHT = Object.keys(PROGRAMS).find((use) => { try { return holds(planProgram({ use, seed: 1 })).every((k) => k.length); } catch { return false; } });

describe('a building to fight through', () => {
  it('is a path: its rooms in a chain from the way in to the goal, a route through every doorway', () => {
    expect(FOUGHT).toBeTruthy();
    const P = planProgram({ use: FOUGHT, seed: 1 });
    expect(P.findings).toEqual([]);
    expect(P.links.length).toBe(P.rooms.length - 1);
    const L = stageLevel({ kind: 'stage', kit: 'gothic-ashlar', program: { use: FOUGHT, seed: 1 } }, { goal: 'deepest' });
    expect(L.goal.room).toBe(P.goal);
    expect(L.route.length).toBeGreaterThanOrEqual(P.links.length);
  });
  it('holds a fight in every room, the largest fight in its goal room, on every seed tried', () => {
    for (const seed of [1, 2, 7]) {
      const P = planProgram({ use: FOUGHT, seed }), H = holds(P);
      expect(H.every((k) => k.length), `seed ${seed}`).toBe(true);
      expect(H[P.rooms.findIndex((r) => r.id === P.goal)]).toContain('boss');
    }
  });
  it('a room too small or too low is told, never refused', () => {
    const tight = fitsLaw({ w: 7, d: 6, h: 4 }, N, 'melee');
    expect(tight.holds).toBe(false);
    expect(tight.says).toMatch(/holds no melee/);
    expect(tight.says).toMatch(/a launch asks/);
    expect(fitsLaw({ w: 30, d: 30, h: 12 }, N, 'boss').holds).toBe(true);
  });
});
