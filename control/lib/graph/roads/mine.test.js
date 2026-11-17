import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { planMine, buildMine, mineLight, MINE_GLOW } from './mine.js';
import { readLanguage, languageLaws } from './track-language.js';
import { trackKit } from './track-kit.js';
import { readTrackIntent, composeTrack } from './trackscape-compose.js';

// (a kart track from words, as a person asks for one: its course, its kit and its language)
const W = composeTrack('a kart race through a gem mine', { seed: 3 }), card = readLanguage('candy-mine'), plan = planTrack(W);
const M = planMine(plan, card, { seed: 3 });

describe('a mine on a track: galleries under a hill', () => {
  it('bores where the way bends gently enough for its walls, never over the grid, never two close', () => {
    expect(M.galleries.length).toBeGreaterThan(0);
    const a = plan.alignment, L = a.length, C = card.parts.mine;
    for (const g of M.galleries) {
      expect(g.s0).toBeGreaterThanOrEqual(C.clearStart);
      expect(g.s1).toBeLessThanOrEqual(L - C.clearStart);
      for (let s = g.s0; s <= g.s1; s += 2) expect(Math.abs(a.at(s).k)).toBeLessThan(1 / (M.hw * 1.6));
    }
    for (let i = 1; i < M.galleries.length; i++) expect(M.galleries[i].s0 - M.galleries[i - 1].s1).toBeGreaterThanOrEqual(C.apart);
    // (the land keeps clear of the hill and the yard)
    expect(M.keepOut.length).toBeGreaterThan(M.galleries.length);
    expect(JSON.stringify(planMine(plan, card, { seed: 3 }))).toBe(JSON.stringify(M));
  });

  const B = buildMine(M, plan, card, trackKit(W.kit));
  it('is timbered and lit: lanterns down every gallery, glowing gems, a cart line, a headframe over its yard', () => {
    expect(B.light.lamps.length).toBeGreaterThan(M.galleries.length * 2);
    expect(B.faces.some((f) => f.group === MINE_GLOW)).toBe(true);
    expect(B.faces.some((f) => f.group === 'mine:hill')).toBe(true);
    expect(B.things.find((t) => t.kind === 'headframe')).toBeTruthy();
    expect(B.colliders.some((c) => c.of === 'mine:headframe')).toBe(true);
    expect(B.report.carts).toBeGreaterThan(1);
  });

  it('under the hill the day falls off with depth and the lanterns lay a warm light; out of it nothing changes', () => {
    const g = B.light.galleries[0], a = plan.alignment, mid = (g.s0 + g.s1) / 2;
    const at = (s, off) => { const q = a.at(s); return [q.x - Math.sin(q.heading) * off, q.y + Math.cos(q.heading) * off, q.z + 0.05]; };
    // a patch of the way at the mouth, one deep in, one outside: lit as the bake leaves them, a white day
    const patch = (s) => ({ corners: [at(s, -1), at(s + 0.5, -1), at(s + 0.5, 1), at(s, 1)], fill: '#ffffff', normal: [0, 0, 1], cornerLight: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], sunShare: [0.6, 0.6, 0.6, 0.6] });
    const dark = { ...B.light, lamps: [] };
    const [mouth, deep, out] = mineLight([patch(g.s0 + 0.5), patch(mid), patch(g.s0 - 30)], dark);
    expect(deep.cornerLight[0][0]).toBeLessThan(mouth.cornerLight[0][0]);
    expect(deep.cornerLight[0][0]).toBeGreaterThanOrEqual(card.parts.mine.dark - 1e-9);
    expect(out).toEqual(patch(g.s0 - 30));
    // (a lantern over the patch: a warm light, red over blue, and the sun's share of the corner less)
    const lit = mineLight([patch(mid)], { ...B.light, lamps: [{ at: at(mid, 0).map((v, i) => (i === 2 ? v + 2.5 : v)), colour: [1, 0.66, 0.34], strength: 1, near: 4, reach: 20 }] })[0];
    expect(lit.cornerLight[0][0] - deep.cornerLight[0][0]).toBeGreaterThan(lit.cornerLight[0][2] - deep.cornerLight[0][2]);
    expect(lit.sunShare[0]).toBeLessThan(deep.sunShare[0]);
    // (a glowing thing keeps its own light)
    const gem = { ...patch(mid), group: MINE_GLOW };
    expect(mineLight([gem], B.light)[0]).toBe(gem);
  });
});

describe('the candy mine\'s language and its words', () => {
  it('holds its laws: a small family, every part of it, the rail and its posts one timber', () => {
    expect(languageLaws(card, { cls: 'kart' })).toEqual([]);
  });
  it('a kart race through a mine is drawn in it', () => {
    expect(readTrackIntent('a kart race through a gem mine').track.mine).toBe(true);
    expect(W.language).toBe('candy-mine');
    expect(composeTrack('a kart race in green hills', { seed: 3 }).language).toBe('candy');
  });
});
