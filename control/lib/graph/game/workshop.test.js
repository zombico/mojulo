import { describe, it, expect } from 'vitest';
import { gameWeight, workshopAdvice, WEIGHT } from './workshop.js';
import { hostHandoff } from '../../mcp/hosts/registry.js';
import { workshopForContext } from '../../mcp/hosts/handoff.js';
import { workshopCardById } from '../gameworld/gameworld-cards.js';

// THE WORKSHOP: a game whose level outgrows a cloud box's page limit is said BEFORE it is built, with the paths the
// creator chooses between; a game that fits, or a creator on their own machine, hears nothing.

const chapter = { tile: 48, rows: ['. . T . . .', '. . # # # .', '. . . . # .', '. # # # # .', '. # . . . .', '. # # # # .', '. h . s # .', '. . . . # .'], key: { T: { use: 'temple', goal: true }, h: { use: 'dwelling' }, s: { use: 'shop' } } };
const small = { tile: 48, rows: ['# # #', '. . .'] };
const box = hostHandoff('claude-code').box;

describe('the workshop', () => {
  it('estimates a glyph map\'s weight from its recipe, tile by tile, and says it cannot estimate the rest', () => {
    const W = gameWeight({ levels: { vale: { glyphs: chapter }, town: { walk: { nodes: {} } } } });
    const vale = W.levels.find((l) => l.level === 'vale');
    // (18 tiles a path or a place, 30 open land: the chapter map measured at 727k faces and 51 MB of geometry)
    expect(vale).toMatchObject({ estimated: true, tiles: 48 });
    expect(vale.faces).toBe(18 * WEIGHT.path.faces + 30 * WEIGHT.land.faces);
    expect(Math.abs(vale.faces - 727000) / 727000).toBeLessThan(0.05);
    expect(Math.abs(vale.bytes - 51e6) / 51e6).toBeLessThan(0.1);
    expect(W.levels.find((l) => l.level === 'town')).toEqual({ level: 'town', estimated: false });
    expect(W.heaviest).toBe('vale');
  });

  it('says it on a cloud box, before the run, with the paths; never on the creator\'s own machine or for a game that fits', () => {
    expect(box.gpu).toBe(false);
    const big = gameWeight({ levels: { vale: { glyphs: chapter } } });
    const A = workshopAdvice({ box, surface: 'box', weight: big });
    expect(A).toMatchObject({ fits: false, over: ['vale'], card: 'gameworld-workshop' });
    expect(A.paths.map((p) => p.path)).toEqual(['local', 'desktop', 'small']);
    expect(A.paths[0].recommended).toBe(true);
    expect(A.says).toMatch(/16 MB/);
    expect(A.says).toMatch(/software/);
    expect(A.says).toMatch(/forgets/);
    expect(workshopAdvice({ box, surface: 'local', weight: big })).toBe(null);
    expect(workshopAdvice({ box, surface: 'box', weight: gameWeight({ levels: { vale: { glyphs: small } } }) })).toBe(null);
    // (the surface not declared: the box named as a possibility, as the handoff note names both rows)
    expect(workshopAdvice({ box, surface: null, weight: big }).says).toMatch(/if that is where this runs/);
    // (a host with no box row: nothing known, nothing said)
    expect(workshopAdvice({ box: null, surface: 'box', weight: big })).toBe(null);
  });

  it('resolves the host and the declared surface as the share offer does, and its card is served by id', () => {
    const world = { levels: { vale: { glyphs: chapter } } };
    expect(workshopForContext({ host: 'claude-code', surface: 'box' }, world, {})?.over).toEqual(['vale']);
    expect(workshopForContext({ host: 'claude-code', surface: 'local' }, world, {})).toBe(null);
    const card = workshopCardById('gameworld-workshop');
    expect(card.body).toMatch(/BEFORE the chapter is built/);
    expect(card.body).toMatch(/pack-data/);
    expect(Buffer.byteLength(card.body)).toBeLessThan(2304);
    expect(workshopCardById('gameworld-nope')).toBe(null);
  });
});
