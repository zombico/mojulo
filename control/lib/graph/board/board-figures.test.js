import { describe, it, expect } from 'vitest';
import { boardFigures, CLASS_LOOKS, FOE_LOOKS } from './board-figures.js';
import { assembleBoardScene } from './board-scene.js';
import { boardParse, boardCentre } from './board-kernel.js';

// a stand-in for the hero door (resolving a real hero takes a moment; what is asked of it is the law here)
const stub = () => { const asked = []; return { asked, heroFigure: async (name, spec) => { asked.push([name, spec]); return { rig: name, clips: name === 'foe-goblin' ? { idle: 'I', forward: 'W' } : { idle: 'I', forward: 'W', wave: 'V' } }; } }; };
const battle = { party: [{ id: 'ayla', class: 'fighter', at: 'A1' }, { id: 'bram', class: 'mage', at: 'B1' }, { id: 'cid', class: 'fighter', at: 'C1' }],
  foes: [{ id: 'g', foe: 'goblin', at: 'D5' }, { id: 'w', foe: 'wolf', at: 'E5' }] };

describe('figures on the board', () => {
  it('stands each class and each humanoid foe as its own look, one figure a look, beasts left tokens', async () => {
    const { asked, heroFigure } = stub();
    const P = await boardFigures(assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle }), { heroFigure });
    expect(asked).toEqual([['class-fighter', { hero: CLASS_LOOKS.fighter, clips: { idle: 'idle', forward: 'walk' } }], ['class-mage', { hero: CLASS_LOOKS.mage, clips: { idle: 'idle', forward: 'walk' } }], ['foe-goblin', { hero: FOE_LOOKS.goblin, clips: { idle: 'idle', forward: 'walk' } }]]);
    expect(Object.keys(P.figures)).toEqual(['class-fighter', 'class-mage', 'foe-goblin']);
    // speaking, a figure gestures: its wave as its talk, or it stands
    expect([P.figures['class-fighter'].clips.talk, P.figures['foe-goblin'].clips.talk]).toEqual(['V', 'I']);
    expect(P.board.figures).toEqual({ ayla: 'board-ayla', bram: 'board-bram', cid: 'board-cid', g: 'board-g' });
    expect(P.entities.map((e) => [e.id, e.body.figure])).toEqual([['board-ayla', 'class-fighter'], ['board-bram', 'class-mage'], ['board-cid', 'class-fighter'], ['board-g', 'foe-goblin']]);
    // each stands on its spot
    const B = P.board.B, O = P.board.origin, at = boardParse(B, 'D5'), c = boardCentre(B, at);
    expect(P.entities.find((e) => e.id === 'board-g').transform.pos).toEqual([O[0] + c[0], O[1] + c[1], O[2] + c[2]]);
  });

  it('adds nothing to a board with no battle, and nothing when a battle keeps its tokens', async () => {
    const { asked, heroFigure } = stub();
    const free = assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, units: [{ id: 'a', side: 'p', at: 'A1' }] });
    expect(await boardFigures(free, { heroFigure })).toBe(free);
    const kept = assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle });
    expect(await boardFigures(kept, { heroFigure, figures: false })).toBe(kept);
    expect(asked).toEqual([]);
  });
});
