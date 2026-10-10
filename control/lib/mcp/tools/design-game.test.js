// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { updateSketchHandler } from './sketches.js';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK, MEADOWMARK_HERO, gameworldOf } from '@/lib/graph/gameworld/index';

// The rail's door: write the gameworld, take the verdicts, run what is ready through the real handlers, and say what
// to do next. A run with nothing changed makes nothing; a hand edit is left unless forced.
beforeEach(() => { closeDb(); });

const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;
const action = (out, key) => out.ran.find((r) => r.key === key)?.action;
const GATED = { ...MEADOWMARK_HERO, mode: 'gated' };
const AUTO = { ...MEADOWMARK_HERO, mode: 'autonomous' };

describe('design_game', () => {
  it('starts a gameworld from a recipe and reads it: every part proposed, the steps waiting, the next moves said', async () => {
    const out = await designGameHandler({ world: GATED, ref: 'gw' });
    expect(out).toMatchObject({ ok: true, ref: 'gw', bible: '/api/sketches/gw/bible', mode: 'gated', steps: { adornment: 'waiting', systems: 'waiting', equipment: 'waiting' } });
    expect(out.parts.find((p) => p.id === 'hero:base')).toMatchObject({ status: 'proposed', advises: ['no base is pinned'] });
    expect(out.next.join('\n')).toMatch(/approve or send back/);
    expect(out.next.join('\n')).toMatch(/run: true makes the hero/);
    expect(stored('gw').kind).toBe('gameworld');
    // a world without a hero runs nothing
    const ground = await designGameHandler({ world: MEADOWMARK, ref: 'gw-ground', run: true });
    expect(ground.ran).toEqual([]);
  });

  it('gated: a run makes the hero and pins its base; the rest waits for the creator; a second run makes nothing', async () => {
    const out = await designGameHandler({ world: GATED, ref: 'gw', run: true });
    expect(action(out, 'hero')).toBe('make');
    expect(action(out, 'systems')).toBe('waiting');
    expect(out.ran.find((r) => r.key === 'systems').waiting).toEqual(expect.arrayContaining(['hero:base (proposed)']));
    expect(out.made).toEqual({ hero: 'gw-hero' });
    expect(stored('gw-hero').kind).toBe('layered');
    const W = gameworldOf(stored('gw'));
    expect(W.characters.hero.looks.base).toMatchObject({ ref: 'gw-hero', rev: 1 });
    // the pinned base verifies: the base no longer advises
    expect(out.parts.find((p) => p.id === 'hero:base').advises).toBeUndefined();
    const again = await designGameHandler({ ref: 'gw', run: true });
    expect(action(again, 'hero')).toBe('keep');
  }, 120_000);

  it('the verdicts open the steps: the systems world is made over the hero, then every class of gear', async () => {
    await designGameHandler({ world: GATED, ref: 'gw', run: true });
    const sys = await designGameHandler({ ref: 'gw', approve: ['hero:base', 'hero:motion', 'hero:actions'], run: true });
    expect(sys.steps.systems).toBe('ready');
    expect(action(sys, 'systems')).toBe('make');
    expect(stored('gw-systems').play.stats).toBeTruthy();
    expect(JSON.stringify(stored('gw-systems'))).toContain('gw-hero');
    expect(action(sys, 'gear-staff')).toBe('waiting');
    const gear = await designGameHandler({ ref: 'gw', approve: 'mechanics:stats', run: true });
    expect(gear.ran.filter((r) => r.key.startsWith('gear-')).map((r) => r.action)).toEqual(Array(6).fill('make'));
    expect(stored('gw-gear-staff').build).toMatchObject({ type: 'equipment', item: 'staff', laws: 1 });
    expect(Object.keys(gear.made)).toHaveLength(8);
  }, 240_000);

  it('autonomous: one run makes everything that settles on its own', async () => {
    const out = await designGameHandler({ world: AUTO, ref: 'gw', run: true });
    expect(out.ran.map((r) => r.action)).toEqual(Array(8).fill('make'));
    expect(out.steps).toEqual({ adornment: 'ready', systems: 'ready', equipment: 'ready' });
  }, 240_000);

  it('a change remakes only what it moved, in place; a hand edit is left as it is unless forced', async () => {
    await designGameHandler({ world: AUTO, ref: 'gw', run: true });
    const heroRev = stored('gw-hero');
    // the colour page moves: the hero is remade in place, the systems world and the gear are kept
    const moved = await designGameHandler({ ref: 'gw', patch: [{ op: 'set', path: '/characters/hero/looks/colour', value: { palette: { Hair: '#2a2a2a' } } }], run: true });
    expect(action(moved, 'hero')).toBe('remake');
    expect(moved.ran.filter((r) => r.key !== 'hero').every((r) => r.action === 'keep')).toBe(true);
    expect(stored('gw-hero').hero.palette.Hair).toBe('#2a2a2a');
    expect(stored('gw-hero')).not.toEqual(heroRev);
    // the creator edits the sword by hand, then the world's gear language moves: the sword is left, the rest remade
    await updateSketchHandler({ ref: 'gw-gear-sword', patch: [{ op: 'set', path: '/build/dials', value: { mass: 1.6 } }] });
    const card = stored('gw').equipment.style;
    const restyled = await designGameHandler({ ref: 'gw', patch: [{ op: 'set', path: '/equipment/style', value: { ...card, roles: { ...card.roles, blade: ['satin', '#7a2f8e'] } } }], run: true });
    expect(action(restyled, 'gear-sword')).toBe('edited');
    expect(action(restyled, 'gear-dagger')).toBe('remake');
    expect(stored('gw-gear-sword').build.dials).toEqual({ mass: 1.6 });
    const forced = await designGameHandler({ ref: 'gw', run: true, force: true });
    expect(action(forced, 'gear-sword')).toBe('remake');
    expect(stored('gw-gear-sword').build.dials).toBeUndefined();
  }, 300_000);

  it('the advice rides every readout: how much is the creator\'s, and a world that reads as the fixture is told so', async () => {
    const out = await designGameHandler({ world: { ...GATED, id: 'copy' }, ref: 'gw' });
    expect(out.advice.authorship).toMatch(/pages written/);
    expect(out.advice.sameness.join('\n')).toMatch(/reads as the test fixture 'meadowmark'/);
    expect(out.next.join('\n')).toMatch(/read the advice/);
  });

  it('a reference is made only when asked for, at its own ref; the comparison only after the world has made its own', async () => {
    const ex = await designGameHandler({ example: 'meadowmark' });
    expect(ex.ref).toBe('example-meadowmark');
    expect(ex.example).toMatch(/made because it was asked for/);
    expect(SketchRepository.getByRef('example-meadowmark').title).toMatch(/^Reference example/);
    await expect(designGameHandler({ example: 'zelda' })).rejects.toThrow(/example is one of meadowmark/);
    await expect(designGameHandler({ example: 'meadowmark', ref: 'gw' })).rejects.toThrow(/made on its own/);
    // a world of its own: comparing before it has made anything is refused, after is answered
    const own = { ...MEADOWMARK, id: 'own', mode: 'autonomous', characters: { direction: { tradition: 'western', primary: 'sun', secondary: 'earth' }, hero: {} } };
    await designGameHandler({ world: own, ref: 'own' });
    await expect(designGameHandler({ ref: 'own', compare: 'meadowmark' })).rejects.toThrow(/compare after you have made your own world/);
    const after = await designGameHandler({ ref: 'own', run: true, compare: 'meadowmark' });
    expect(after.comparison.reference).toBe('meadowmark');
    expect(after.comparison.differs.find((r) => r.choice === 'primary')).toMatchObject({ world: 'sun' });
  }, 120_000);

  it('says what is wrong: an unknown part, a send-back without a note, a sketch that is not a gameworld', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    await expect(designGameHandler({ ref: 'gw', approve: 'hero:cape' })).rejects.toThrow(/'hero:cape' is not a part/);
    await expect(designGameHandler({ ref: 'gw', revise: { part: 'hero:hair' } })).rejects.toThrow(/revise is \{ part, note \}/);
    const back = await designGameHandler({ ref: 'gw', revise: { part: 'hero:hair', note: 'longer, and darker' } });
    expect(back.parts.find((p) => p.id === 'hero:hair')).toMatchObject({ status: 'revise', note: 'longer, and darker' });
    await expect(designGameHandler({ ref: 'nope' })).rejects.toThrow(/no sketch at 'nope'/);
    await expect(designGameHandler({ ref: 'gw', world: GATED, patch: [] })).rejects.toThrow(/one or the other/);
  });
});
