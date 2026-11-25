// THE SIDE MAP IN ITS BOOK: a side map level's page in its world's bible, read off the map as its level builds it: the
// elevation, a row a zone, the laws; and the book's own section, tab and plate for it.
import { describe, it, expect } from 'vitest';
import { sideMapPage, sideMapPlanSvg, sideMapOfLevel } from './book.js';
import { sideMapOf, SIDE_MAP_STATURE } from './scene.js';
import { readGameworld } from '../world.js';
import { gameStages } from '../levels.js';
import { gameworldBibleHtml, esc } from '../bible-html.js';
import { platformerGame } from '../platformer-game.js';

const words = { id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy' }).words };
const G = readGameworld(words), id = G.ids.find((k) => G.levels[k].sidemap);

describe('the side map in its book', () => {
  it('builds the map its level\'s stage builds: its cube, its words, its hero, its feel', () => {
    const M = sideMapOfLevel(G, id), stage = gameStages(G).find((s) => s.level === id);
    const fromStage = sideMapOf({ ...stage.manifest, stature: SIDE_MAP_STATURE, ...(G.feel ? { feel: G.feel } : {}) });
    expect(M.layout.zones).toEqual(fromStage.layout.zones);
    expect(M.laws).toEqual(fromStage.laws);
    expect(sideMapOfLevel(G, id)).toBe(M);
  });

  it('draws a small plan: a rect a zone in its place\'s key, each numbered', () => {
    const M = sideMapOfLevel(G, id), svg = sideMapPlanSvg(M);
    expect((svg.match(/stroke-width="1"/g) ?? []).length).toBe(M.layout.zones.length);
    for (const d of M.dress.zones) expect(svg).toContain(d.key);
    expect(sideMapPlanSvg(M)).toBe(svg);
  });

  it('writes the page: the elevation, a row a zone with its place and what it is for, every law and its verdict', () => {
    const M = sideMapOfLevel(G, id), html = sideMapPage(G, esc);
    expect(html).toContain('id="sidemaps"');
    expect((html.match(/<tr><td class="mono">/g) ?? []).length).toBe(M.layout.zones.length);
    for (const d of M.dress.zones) expect(html).toContain(esc(d.place));
    for (const z of M.layout.zones.filter((x) => x.teach && x.teach !== 'boss')) expect(html).toContain(`teaches: ${z.teach}`);
    expect((html.match(/<li class="(ok|off)">/g) ?? []).length).toBe(M.laws.length);
    expect(html).toMatch(/The machine gate/);
    expect(sideMapPage(readGameworld({ id: 'g', name: 'G', ...platformerGame({}).words }), esc)).toBe('');
  });

  it('is a part of the book: its section, its tab and the level\'s plate', () => {
    const html = gameworldBibleHtml(words);
    expect(html).toContain('id="sidemaps"');
    expect(html).toContain('href="#sidemaps"');
    expect(html).toContain(`<!--plate:sidemap-${id}-->`);
  });
});
