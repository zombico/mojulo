// THE BOX IN ITS BOOK: a metroidvania level's page in its world's bible, read off the box as its level builds it: the
// plan, a card a ring, the powers and the laws; and the book opens for a box level and a side map level at all.
import { describe, it, expect } from 'vitest';
import { boxPage, boxPlanSvg, boxOfLevel } from './book.js';
import { GATES } from './gates.js';
import { vampireSonataGame } from './vampire-sonata.js';
import { xenoJager, XENOJAGER_CUBE } from './xeno-jager.js';
import { readGameworld } from '../world.js';
import { gameStages } from '../levels.js';
import { gameworldBibleHtml, esc } from '../bible-html.js';
import { platformerGame } from '../platformer-game.js';

const castle = readGameworld(vampireSonataGame({ heroRef: 'h' }));
const planetWorld = () => { const G = vampireSonataGame({ heroRef: 'h', id: 'xj', name: 'XenoJager' }); G.levels = { planet: { name: 'The planet', metroidvania: xenoJager({ theme: null }) } }; G.style = { ...(G.style ?? {}), geocube: XENOJAGER_CUBE }; return G; };

describe('the box in its book', () => {
  it('builds the box the level\'s stage builds: its cube, its words, its hero', () => {
    const B = boxOfLevel(castle, 'castle'), [stage] = gameStages(castle);
    expect(B.layout.rooms.length).toBe(boxOfLevel(castle, 'castle').layout.rooms.length);
    expect(boxOfLevel(castle, 'castle')).toBe(B);
    expect(stage.manifest.metroidvania).toEqual(castle.levels.castle.metroidvania);
    expect(B.look).toMatchObject({ id: 'castle', from: 'words' });
  });

  it('draws the plan: a room for each room in its ring\'s colour, every gate in its colour, the marks it says', () => {
    const B = boxOfLevel(castle, 'castle'), svg = boxPlanSvg(B);
    expect((svg.match(/stroke-width="1.2"/g) ?? []).length).toBe(B.layout.rooms.length);
    for (const kind of new Set(B.greybox.gates.map((g) => g.kind))) expect(svg).toContain(GATES[kind].colour);
    for (const glyph of ['>S<', '>B<', '>K<', '>◆<']) expect(svg).toContain(glyph);
    expect(boxPlanSvg(B, { marks: false })).not.toContain('>S<');
    expect(boxPlanSvg(B)).toBe(svg);
  });

  it('writes the page: a card a ring, every power and the gate it opens, every law and its verdict', () => {
    const B = boxOfLevel(castle, 'castle'), html = boxPage(castle, esc);
    expect((html.match(/class="card box-ring"/g) ?? []).length).toBe(B.layout.rings.length);
    for (const p of Object.values(B.layout.powers)) expect(html).toContain(esc(p.name));
    expect((html.match(/<li class="(ok|off)">/g) ?? []).length).toBe(B.laws.length);
    expect(html).toMatch(/The machine gate/);
    expect(boxPage(readGameworld({ id: 'g', name: 'G', ...platformerGame({}).words }), esc)).toBe('');
  });

  it('says what dresses it: the planet\'s page reads its cube, its rock, its gem and its hazards', () => {
    const html = boxPage(readGameworld(planetWorld()), esc);
    expect(html).toContain('by its geocube <b>xenojager</b>');
    for (const w of ['basalt boulders', 'sapphire crystals', 'lava', 'rock, fractured']) expect(html).toContain(w);
  });

  it('opens the book for a box level and a side map level, its box among its parts', () => {
    const html = gameworldBibleHtml(vampireSonataGame({ heroRef: 'h' }));
    expect(html).toContain('id="boxes"');
    expect(html).toContain('href="#boxes"');
    expect(html).toContain('<h4>The box</h4>');
    expect(gameworldBibleHtml({ id: 'g', name: 'G', ...platformerGame({ pole: 'galaxy-boy' }).words })).toContain('<h4>The side map</h4>');
  });
});
