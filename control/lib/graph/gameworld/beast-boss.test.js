// A BEAST BOSS'S FIGURE (gameworld/beast-boss.js): the hydra drawn from its serpent and its row, held to the row: each
// head hangs inside its part's box through its turn's opening (where a blow is judged), and every bone a part hides
// once it is severed is the figure's.
import { describe, it, expect } from 'vitest';
import { beastBossFigure, dragonPrimaryFigure, dragonFormFigure } from './beast-boss.js';
import { VEHICLES, VEHICLE_IDS, turnTimes } from '../boss/vehicles.js';
import { DRAGONS, DRAGON_IDS } from '../boss/dragons.js';

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

describe('a dragon\'s primary form', () => {
  it('on four feet, under the head, wings and ridge of its two-legged form, in its colours', async () => {
    const id = DRAGON_IDS[0], D = DRAGONS[id], F = await dragonPrimaryFigure(id), byId = new Map(F.bones.map((b) => [b.id, b]));
    // (four feet the lowest of it, on the ground)
    const feet = ['forePawR', 'forePawL', 'hindPawR', 'hindPawL'].map((k) => byId.get(k));
    for (const f of feet) expect(f, 'a paw').toBeTruthy();
    const low = Math.min(...F.bones.map((b) => Math.min(b.head[2], b.tail[2])));
    for (const f of feet) expect(Math.min(f.head[2], f.tail[2]) - low).toBeLessThan(0.3);
    // (the risen form's head, jaw and wings, the head forward of the shoulders, the wings above them)
    for (const k of ['neck', 'head', 'jaw', 'wingBoneR', 'wingBoneL']) expect(byId.has(k), k).toBe(true);
    expect(byId.get('head').head[1]).toBeGreaterThan(byId.get('upperArmR').head[1]);
    expect(byId.get('wingBoneR').head[2]).toBeGreaterThan(byId.get('upperArmR').head[2]);
    // (its ridge in its horns' colour; it walks)
    const horn = [1, 3, 5].map((i) => { const c = parseInt(D.horns.slice(i, i + 2), 16) / 255; return Math.round(255 * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); });
    const ridge = F.parts.some((P) => { if (!P?.col) return false; const c = Buffer.from(P.col, 'base64'); for (let j = 0; j < c.length; j += 3) if (c[j] === horn[0] && c[j + 1] === horn[1] && c[j + 2] === horn[2]) return true; return false; });
    expect(ridge).toBe(true);
    expect(F.clips.walk.b.length).toBe(F.clips.walk.k * F.bones.length * 7);
    expect(F.figH).toBeGreaterThan(2);
  });
  it('its risen form wears the same head and wings at the same size, standing taller than the beast', async () => {
    const id = DRAGON_IDS[0], P = await dragonFormFigure(id, 'primary'), R = await dragonFormFigure(id, 'risen');
    const len = (F, k) => { const b = F.bones.find((x) => x.id === k); return Math.hypot(...b.tail.map((v, i) => v - b.head[i])); };
    for (const k of ['head', 'jaw', 'wingBoneR']) expect(len(R, k), k).toBeCloseTo(len(P, k), 3);
    expect(R.figH).toBeGreaterThan(P.figH * 1.5);
    await expect(dragonFormFigure(id, 'crawling')).rejects.toThrow(/primary/);
  });
});
