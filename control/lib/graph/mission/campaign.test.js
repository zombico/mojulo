// A CAMPAIGN'S OPENING MISSION. The concepts: it is a run of legs in order, each a level of its own (a leg is a
// checkpoint) built from what the world already has; between them the legs play every beat of the loop; a leg whose
// place the world cannot build is left out and said; the legs are one world's levels, each staged as its own kind and
// its tasks proved, and the game they make unlocks them in the order they are played.
import { describe, expect, it } from 'vitest';
import { BEAT_IDS, OPENING, openingMission } from './campaign.js';
import { readGameworld } from '../gameworld/world.js';
import { gameStages, stageLevelOrder, gameLevels } from '../gameworld/levels.js';
import { proveMission } from '../gameworld/mission-proof.js';
import { missionBuildingFor } from '../gameworld/mission-building.js';
import { TEMPLATE_LOADOUTS } from '../gameworld/loadout.js';
import { POLES } from '../gameworld/feel/cards.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const base = { id: 'cam', name: 'Campaign', seed: 1, feel: SHOOTER };

describe('a campaign\'s opening mission', () => {
  it('is legs in order that between them play every beat of the loop; a leg with no place is left out and said', () => {
    const C = openingMission(null, { building: 'armoury' });
    expect(C.legs.map((L) => L.id)).toEqual(OPENING.map((L) => L.id));
    expect(new Set(C.legs.flatMap((L) => L.beats))).toEqual(new Set(BEAT_IDS));
    expect(C.patch.map((p) => p.path)).toEqual(C.legs.map((L) => `/levels/${L.level}`));
    C.legs.forEach((L, k) => expect(L.name).toContain(`${k + 1}/${C.legs.length}`));
    const bare = openingMission(null);
    expect(bare.legs.map((L) => L.id)).not.toContain('inside');
    expect(bare.left).toEqual([{ id: 'inside', why: expect.stringMatching(/no building/) }]);
    bare.legs.forEach((L, k) => expect(L.name).toContain(`${k + 1}/${bare.legs.length}`));
  });
  it('is one world\'s levels: each leg staged as its own kind, its tasks proved, unlocked in the order played', () => {
    const G0 = readGameworld({ ...base, start: 'x', levels: { x: { name: 'x', mission: true } } }), C = openingMission(G0, { building: missionBuildingFor(G0)?.use ?? null });
    const W = { ...base, start: C.legs[0].level, levels: C.levels }, G = readGameworld(W), stages = gameStages(W);
    expect(stages.map((s) => s.level)).toEqual(C.legs.map((L) => L.level));
    expect(new Set(stages.map((s) => s.section)).size).toBeGreaterThan(2);
    for (const st of stages) {
      const m = stageLevelOrder(G, st, { ref: `${st.level}-0`, heroRef: null }).args.manifest;
      expect(m.mission.tasks.at(-1).kind, st.level).toBe('reach');
      expect(proveMission(m).proved, st.level).toBe(true);
    }
    const refs = stages.map((s) => `${s.level}-0`), L = gameLevels(stages, refs);
    expect(L[0].gate).toBeUndefined();
    for (let k = 1; k < L.length; k++) expect(L[k].gate).toEqual({ completed: refs[k - 1] });
  }, 240000);
});
