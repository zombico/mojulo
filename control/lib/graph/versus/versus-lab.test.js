import { describe, it, expect } from 'vitest';
import { labOf, labSpec, LAB_LOOKS } from './versus-lab.js';
import { manaUi } from '../../mana-ui/kernel.js';
import { versusChannelScript } from '../scene/channels/versus.js';
import { moveList } from './versus-movelist.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';
import { fightArenas, TRAINING_ARENA } from '../gameworld/quick.js';

// THE LAB: a fight game's arena, under its register, carries mana-ui over the fight: the inputs along the foot, the frame
// meter on F, the move list from the pause, in the register's look; an arena made before the register carries none.
const F = compileFighter({ ...solveFighter({ id: 'kai', archetype: 'all-rounder' }).recipe, specials: { forward: { id: 'rekka' }, back: { id: 'boom' } } });
const lab = (state) => manaUi.runtime(labSpec(), { read: (p) => manaUi.readPath(state, p) });

describe('versus lab', () => {
  it('only a fight game\'s arena carries it, in its register\'s look; an arena without a register, not a byte', () => {
    expect(labOf({})).toBeNull();
    expect(labOf({ register: 'anime' }).theme).toBe(LAB_LOOKS.anime);
    expect(labOf({ register: 'western' }).theme).toBe('fight-lit');
    const cfg = { plane: 0, half: 6000, roster: [], wire: { ready: 'r', init: 'i', outcome: 'o', version: 1 } };
    expect(versusChannelScript(cfg)).not.toContain('VERSUS_LAB =');
    expect(versusChannelScript({ ...cfg, register: 'anime' })).toContain('const VERSUS_LAB =');
  });
  it('in training, the inputs run along the foot; the frame meter shows only when it is on', () => {
    const state = { lab: { training: true, inputs: [{ text: '↓ 2' }, { text: '↘ 2' }, { text: '→ M 2' }], frames: [{ value: '1', variant: 'muted' }, { value: '', variant: 'strong' }], advantage: '+1', showFrames: false, moves: [] } };
    const rt = lab(state);
    expect(rt.view()).toContain('→ M 2');
    expect(rt.view()).toMatch(/data-at="bottom"/);
    expect(rt.view()).not.toContain('+1');
    state.lab.showFrames = true; rt.tick();
    expect(rt.view()).toContain('+1');
    // (out of training, no strip)
    state.lab.training = false; state.lab.showFrames = false; rt.tick();
    expect(rt.view()).not.toContain('→ M 2');
  });
  it('the pause opens the move list: the fighter\'s moves in the player\'s scheme, said in the game\'s words', () => {
    const state = { lab: { training: false, inputs: [], frames: [], advantage: '', showFrames: false, moves: moveList(F, 'classic') } };
    const rt = lab(state);
    rt.open('moves');
    const html = rt.view();
    for (const w of ['Move list', 'Normals', 'Specials', 'Startup', 'On block']) expect(html, w).toContain(w);
    expect(html).not.toMatch(/object Object/);
  });
  it('the game\'s training ground is its lab: training is fought there, and a game minted with arenas of its own gets one', () => {
    const arenas = fightArenas({ register: 'anime', arenas: [{ id: 'plaza', name: 'Plaza', kit: 'island-plaza' }, { ...TRAINING_ARENA }] }, { title: 't' });
    expect(arenas.map((a) => [a.id, !!a.lab])).toEqual([['plaza', false], ['training', true]]);
  });
});
