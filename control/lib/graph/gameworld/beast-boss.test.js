// A BEAST BOSS'S FIGURE (gameworld/beast-boss.js): the hydra drawn from its serpent and its row, held to the row: each
// head hangs inside its part's box through its turn's opening (where a blow is judged), and every bone a part hides
// once it is severed is the figure's.
import { describe, it, expect } from 'vitest';
import { beastBossFigure } from './beast-boss.js';
import { VEHICLES, VEHICLE_IDS, turnTimes } from '../boss/vehicles.js';

const id = VEHICLE_IDS.find((k) => VEHICLES[k].figure);

describe('a beast boss drawn as itself', () => {
  it('its heads hang inside their boxes through their openings; its parts\' bones are its figure\'s', async () => {
    const V = VEHICLES[id], F = await beastBossFigure(id), nb = F.bones.length, ids = new Set(F.bones.map((b) => b.id));
    for (const p of Object.values(V.parts)) for (const b of p.bones || []) expect(ids.has(b), b).toBe(true);
    for (const [st, s] of Object.entries(V.states).filter(([, x]) => x.head)) {
      const C = F.clips[s.clip], T = turnTimes(V, st), box = V.parts[s.head].box, bi = F.bones.findIndex((b) => b.id === V.parts[s.head].bones.at(-1));
      expect(C, s.clip).toBeTruthy();
      for (const sec of [T.open[0] + 0.15, (T.open[0] + T.open[1]) / 2, T.open[1] - 0.15]) {
        const f = Math.min(C.k - 1, Math.round((sec / C.s) * C.k)), at = C.b.slice((f * nb + bi) * 7 + 4, (f * nb + bi) * 7 + 7), v = [at[1], -at[0], at[2]];
        for (let i = 0; i < 3; i++) { expect(v[i], `${st} @${sec}`).toBeGreaterThan(box[0][i] - 0.3); expect(v[i], `${st} @${sec}`).toBeLessThan(box[1][i] + 0.3); }
      }
    }
  });
});
