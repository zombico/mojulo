import { describe, it, expect } from 'vitest';
import { buildBoardFx, BOARD_FX, BOARD_ELEMENT_FX, boardFxOf } from './board-fx.js';
import { readRpg } from '../playscape/rpg/rpg.js';

const KINDS = ['shake', 'orbit', 'shot', 'dim', 'flash', 'ring', 'rune', 'pillar', 'orb', 'sparks', 'rise', 'shards', 'spikes', 'bolt', 'beam', 'fall', 'being'];
const BEINGS = ['inferno', 'glacier', 'tempest', 'colossus', 'wyrm'];

describe('effects in the world', () => {
  it('every preset is a timeline of known tracks, its hit landing inside it, none longer than a few seconds', () => {
    for (const [id, P] of Object.entries(BOARD_FX)) {
      const end = Math.max(...P.tracks.map((t) => (t.t ?? 0) + t.dur));
      expect(P.tracks.every((t) => KINDS.includes(t.kind) && t.dur > 0), id).toBe(true);
      expect(P.land, id).toBeGreaterThanOrEqual(0);
      expect(P.land, id).toBeLessThan(end);
      expect(end, id).toBeLessThanOrEqual(6);
    }
    for (const fx of Object.values(BOARD_ELEMENT_FX)) expect(BOARD_FX[fx]).toBeTruthy();
    // a summon: its being, the world dimmed, the camera orbiting, all of it over before the effect ends
    for (const b of BEINGS) {
      const P = BOARD_FX[b], kinds = P.tracks.map((t) => t.kind);
      expect(P.summon, b).toBe(true);
      expect(P.tracks.find((t) => t.kind === 'being').being, b).toBe(b);
      for (const k of ['dim', 'orbit', 'shake', 'flash']) expect(kinds, `${b} ${k}`).toContain(k);
    }
  });

  it('plays what a skill is: its element\'s, a blow\'s, a mending\'s, a blessing\'s, or its own', () => {
    // one skill of each kind, read from the party battles' own book
    const { skills, items } = readRpg({ rpg: { party: [{ id: 'a', class: 'mage' }], skills: { fire: true, blizzard: true, thunder: true, mend: true, 'power-strike': true, protect: true, venom: true } } });
    expect(boardFxOf(skills.fire)).toBe('flare');
    expect(boardFxOf(skills.blizzard)).toBe('frost');
    expect(boardFxOf(skills.thunder)).toBe('bolt');
    expect(boardFxOf(skills.mend)).toBe('mend');
    expect(['hit', 'strike']).toContain(boardFxOf(skills['power-strike']));
    expect(boardFxOf(skills.protect)).toBe('aura');
    expect(boardFxOf(skills.venom)).toBe('venom');
    expect(boardFxOf(items.potion)).toBe('mend');
    expect(boardFxOf({ ...skills.fire, fx: 'meteor' })).toBe('meteor');
    expect(boardFxOf({ ...skills.fire, fx: 'nothing-such' })).toBe('flare');
  });

  it('runs from its own source, as the page runs it', () => {
    const page = new Function(`return (${buildBoardFx.toString()})();`)();
    expect(Object.keys(page.PRESETS)).toEqual(Object.keys(BOARD_FX));
    const a = page.dice(page.hash('x:1')), b = page.dice(page.hash('x:1'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
