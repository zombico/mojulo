import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { planMine, buildMine, mineLight, MINE_GLOW } from './mine.js';
import { readLanguage, languageLaws } from './track-language.js';
import { trackKit } from './track-kit.js';
import { CHUNKY_SUN } from './chunky-look.js';
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
    // (the gallery's own light: the cavern round it set aside, as a mine in the open air has none)
    const dark = { ...B.light, lamps: [], cavern: undefined };
    const [mouth, deep, out] = mineLight([patch(g.s0 + 0.5), patch(mid), patch(g.s0 - 30)], dark);
    expect(deep.cornerLight[0][0]).toBeLessThan(mouth.cornerLight[0][0]);
    expect(deep.cornerLight[0][0]).toBeGreaterThanOrEqual(card.parts.mine.dark - 1e-9);
    expect(out).toEqual(patch(g.s0 - 30));
    // (a lantern over the patch: a warm light, red over blue, and the sun's share of the corner less)
    const lit = mineLight([patch(mid)], { ...B.light, cavern: undefined, lamps: [{ at: at(mid, 0).map((v, i) => (i === 2 ? v + 2.5 : v)), colour: [1, 0.66, 0.34], strength: 1, near: 4, reach: 20 }] })[0];
    expect(lit.cornerLight[0][0] - deep.cornerLight[0][0]).toBeGreaterThan(lit.cornerLight[0][2] - deep.cornerLight[0][2]);
    expect(lit.sunShare[0]).toBeLessThan(deep.sunShare[0]);
    // (a glowing thing keeps its own light)
    const gem = { ...patch(mid), group: MINE_GLOW };
    expect(mineLight([gem], B.light)[0]).toBe(gem);
  });
});

describe('the cavern round the whole arena', () => {
  const B = buildMine(M, plan, card, trackKit(W.kit)), cv = B.light.cavern, V = card.parts.mine.cavern;
  const patch = (x, y, z) => ({ corners: [[x, y, z], [x + 0.5, y, z], [x + 0.5, y + 0.5, z], [x, y + 0.5, z]], fill: '#ffffff', normal: [0, 0, 1], cornerLight: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], sunShare: [0.6, 0.6, 0.6, 0.6] });
  const none = { ...B.light, lamps: [] };
  it('stands round the lap: every station inside its outline, a skylight over the yard, walls and a ceiling built', () => {
    expect(cv).toBeTruthy();
    for (const q of plan.stations.filter((_, i) => i % 7 === 0)) {
      const t = Math.atan2(q.y - cv.at[1], q.x - cv.at[0]), S = cv.outline.length, j = ((Math.round((t / (2 * Math.PI)) * S) % S) + S) % S;
      expect(Math.hypot(q.x - cv.at[0], q.y - cv.at[1])).toBeLessThan(cv.outline[j]);
    }
    // (the day's sun through the skylight falls inside the cave, toward the yard: all the way unless the ceiling's reach
    // held the skylight back, as a low sun does)
    const dir = CHUNKY_SUN.dir, t = (cv.skylight.top - cv.base) / dir[2], foot = [cv.skylight.at[0] - dir[0] * t, cv.skylight.at[1] - dir[1] * t];
    const S = cv.outline.length, ft = Math.atan2(foot[1] - cv.at[1], foot[0] - cv.at[0]), fj = ((Math.round((ft / (2 * Math.PI)) * S) % S) + S) % S;
    expect(Math.hypot(foot[0] - cv.at[0], foot[1] - cv.at[1])).toBeLessThan(cv.outline[fj]);
    expect(Math.hypot(foot[0] - M.yard[0], foot[1] - M.yard[1])).toBeLessThan(Math.hypot(cv.skylight.at[0] - M.yard[0], cv.skylight.at[1] - M.yard[1]) + 1e-6);
    expect(B.faces.length).toBeGreaterThan(0);
  });
  it('is dark but for its shaft: the sky the cave\'s dark everywhere, the sun only down the skylight; out of it, as it was', () => {
    // a patch on the floor far from the shaft: the sky's share at the cave's dark, the sun's gone
    const far = plan.stations.reduce((b, q) => (Math.hypot(q.x - cv.skylight.at[0], q.y - cv.skylight.at[1]) > Math.hypot(b.x - cv.skylight.at[0], b.y - cv.skylight.at[1]) ? q : b));
    const [dim] = mineLight([patch(far.x, far.y, far.z + 0.05)], none);
    expect(dim.cornerLight[0][0]).toBeCloseTo(0.4 * V.dark, 3);
    expect(dim.sunShare[0]).toBe(0);
    // a patch the sun reaches through the skylight keeps its sun
    const dir = CHUNKY_SUN.dir, z = cv.base, t = (cv.skylight.top - z) / dir[2], x = cv.skylight.at[0] - dir[0] * t, y = cv.skylight.at[1] - dir[1] * t;
    const [shaft] = mineLight([patch(x, y, z)], none);
    expect(shaft.sunShare[0]).toBeGreaterThan(0.5);
    // out past its walls nothing changes
    const out = patch(cv.at[0] + Math.max(...cv.outline) * 3, cv.at[1], cv.base);
    expect(mineLight([out], none)[0]).toEqual(out);
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
