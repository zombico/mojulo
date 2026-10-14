// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { updateSketchHandler } from './sketches.js';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK, MEADOWMARK_HERO, HALDEN_REACH, gameworldOf } from '@/lib/graph/gameworld/index';
import { createCharacterHandler, updateCharacterHandler } from './create-character.js';

// The rail's door: write the gameworld, take the verdicts, run what is ready through the real handlers, and say what
// to do next. A run with nothing changed makes nothing; a hand edit is left unless forced.

const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;
const action = (out, key) => out.ran.find((r) => r.key === key)?.action;
const step = (out, id) => out.next.find((n) => n.step === id);
const revs = (ref) => SketchRevisionRepository.head(ref)?.rev ?? 0;
const GATED = { ...MEADOWMARK_HERO, mode: 'gated' };
const AUTO = { ...MEADOWMARK_HERO, mode: 'autonomous' };

describe('design_game', () => {
  beforeEach(() => { closeDb(); });

  it('starts a gameworld from a recipe and reads it: every part proposed, the steps waiting, the next moves said', async () => {
    const out = await designGameHandler({ world: GATED, ref: 'gw' });
    expect(out).toMatchObject({ ok: true, ref: 'gw', bible: '/api/sketches/gw/bible', mode: 'gated', steps: { adornment: 'waiting', systems: 'waiting', equipment: 'waiting' } });
    expect(out.parts.find((p) => p.id === 'hero:base')).toMatchObject({ status: 'proposed', advises: ['no base is pinned'] });
    // the next moves are step ids; the gameworld-next card says what each means
    expect(step(out, 'review')).toMatchObject({ card: 'gameworld-next', parts: expect.arrayContaining(['hero:base']) });
    expect(step(out, 'run')).toEqual({ step: 'run', card: 'gameworld-next' });
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
    const written = revs('gw');
    const again = await designGameHandler({ ref: 'gw', run: true });
    expect(action(again, 'hero')).toBe('keep');
    // a run that makes nothing writes nothing: no new revision of the gameworld
    expect(revs('gw')).toBe(written);
    expect(step(again, 'rerun')).toBeTruthy();
    // readout: 'changed': nothing moved, so no parts and nothing run; the next moves still come
    const quiet = await designGameHandler({ ref: 'gw', run: true, readout: 'changed' });
    expect(quiet).toMatchObject({ ok: true, readout: 'changed', parts: [], ran: [] });
    expect(quiet.numbers).toBeUndefined();
    expect(quiet.next.length).toBeGreaterThan(0);
    // a verdict moves one stamp, and the changed readout names only that part
    const approved = await designGameHandler({ ref: 'gw', approve: 'hero:motion', readout: 'changed' });
    expect(approved.parts.map((p) => p.id)).toEqual(['hero:motion']);
    // the same verdict again writes nothing
    const held = revs('gw');
    await designGameHandler({ ref: 'gw', approve: 'hero:motion' });
    expect(revs('gw')).toBe(held);
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
    expect(Object.keys(gear.made)).toHaveLength(15);
    expect(stored('gw-hero-equipped').hero.gear.right).toMatchObject({ item: 'staff' });
    expect(stored('gw-hero').hero.gear).toBeUndefined();
  }, 240_000);

  it('the advice rides every readout: how much is the creator\'s, and a world that reads as the fixture is told so', async () => {
    const out = await designGameHandler({ world: { ...GATED, id: 'copy' }, ref: 'gw' });
    expect(out.advice.authorship).toMatch(/pages written/);
    expect(out.advice.sameness.join('\n')).toMatch(/reads as the test fixture 'meadowmark'/);
    expect(step(out, 'advice')).toBeTruthy();
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

  it('a page the hero door would refuse is refused when written; a failure after the write names the stored ref', async () => {
    const bad = { ...GATED, characters: { ...GATED.characters, hero: { ...GATED.characters.hero, looks: { ...GATED.characters.hero.looks, body: { cast: 'female', tune: { height: 1.1 } } } } } };
    await expect(designGameHandler({ world: bad, ref: 'gw' })).rejects.toThrow(/the hero the looks and motion pages compose is refused by the hero door/);
    expect(SketchRepository.getByRef('gw')).toBeFalsy();
    await designGameHandler({ world: GATED, ref: 'gw' });
    await expect(designGameHandler({ ref: 'gw', approve: 'hero:cape' })).rejects.toThrow(/stored at 'gw' as written; fix it with design_game\(\{ ref: 'gw', patch \}\)/);
  });

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

// The autonomous world is made once: the first test reads that run, the second changes the world it left.
describe('design_game, autonomous', () => {
  let out;
  beforeAll(async () => {
    closeDb();
    out = await designGameHandler({ world: AUTO, ref: 'gw', run: true });
  }, 240_000);

  it('autonomous: one run makes everything that settles on its own', () => {
    expect(out.ran.map((r) => r.action)).toEqual(Array(15).fill('make'));
    // the levels and the game: each stage a level the equipped hero pilots, the game over them, unaudited and said so
    expect(out.ran.filter((r) => r.key.startsWith('level-')).map((r) => r.key)).toEqual(['level-meadow-ascent-0', 'level-meadow-ascent-1', 'level-meadow-ascent-2', 'level-shell-shore-0', 'level-shell-shore-1']);
    expect(stored('gw-level-meadow-ascent-0')).toMatchObject({ kind: 'stage', game: { levelRef: 'gw-level-meadow-ascent-0' }, figures: { hero: { heroRef: 'gw-hero-equipped' } } });
    expect(stored('gw-game')).toMatchObject({ kind: 'game', store: { slices: expect.arrayContaining([expect.objectContaining({ kind: 'character' })]) } });
    expect(stored('gw-game').levels.map((l) => l.ref)).toHaveLength(5);
    expect(stored('gw-game').shell).toBe('play');
    expect(step(out, 'play')).toEqual({ step: 'play', url: '/api/sketches/gw-game/game', playtest: '/api/sketches/gw-game/playtest', gate: 'eyes', card: 'gameworld-next' });
    // the numbers, readable without the bible
    expect(out.numbers.stats).toMatchObject({ hp: 100, power: 10, guard: 5 });
    expect(out.numbers.powers.map((p) => p.key)).toEqual(['1', '2', '3']);
    expect(out.steps).toEqual({ adornment: 'ready', systems: 'ready', equipment: 'ready' });
  });

  it('a change remakes only what it moved, in place; a hand edit is left as it is unless forced', async () => {
    const heroRev = stored('gw-hero');
    // the colour page moves: the hero is remade in place, the systems world and the gear are kept
    const moved = await designGameHandler({ ref: 'gw', patch: [{ op: 'set', path: '/characters/hero/looks/colour', value: { palette: { Hair: '#2a2a2a' } } }], run: true });
    expect(action(moved, 'hero')).toBe('remake');
    expect(action(moved, 'hero-equipped')).toBe('remake');   // she wears the same colours
    expect(moved.ran.filter((r) => !r.key.startsWith('hero')).every((r) => r.action === 'keep')).toBe(true);
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
});

describe('design_game: the hero a run plays (character stitch)', () => {
  beforeEach(() => { closeDb(); });

  it('a world that populates its gear finishes its run, and the anime hero keeps its light', async () => {
    const world = { ...HALDEN_REACH, characters: MEADOWMARK_HERO.characters, mechanics: MEADOWMARK_HERO.mechanics, equipment: { ...MEADOWMARK_HERO.equipment, populate: true }, mode: 'autonomous' };
    const out = await designGameHandler({ world, ref: 'gp', run: true });
    const stock = out.ran.filter((r) => r.key.startsWith('stock-'));
    expect(stock.length).toBeGreaterThan(0);
    expect(stock.every((r) => r.action === 'make')).toBe(true);
    expect(Object.keys(gameworldOf(stored('gp')).made)).toEqual(expect.arrayContaining(['hero', stock[0].key]));
    expect(stored('gp-hero').toon).toEqual({ light: true });
    // the hero a game plays runs on its own calibrated jog, its feet at the jog's stride
    expect(stored('gp-hero').hero.motion.jog).toBeTruthy();
    const level = stored(Object.entries(gameworldOf(stored('gp')).made).find(([k]) => k.startsWith('level-'))[1].ref);
    const pilot = level.entities.find((e) => e.pilotable);
    expect(level.figures[pilot.body.figure].clips).toMatchObject({ forward: 'jog', turn: 'walk', idle: 'Idle_Loop' });
    expect(pilot.rule.stride).toBe(1.72);
  }, 600_000);

  it('a hand edit to the hero is said on its base and plays: the equipped hero is built over it', async () => {
    await designGameHandler({ world: AUTO, ref: 'ge', run: true });
    await updateCharacterHandler({ ref: 'ge-hero', spec: { palette: { Top: '#123456' } } });
    const again = await designGameHandler({ ref: 'ge', run: true });
    expect(action(again, 'hero')).toBe('edited');
    expect(again.parts.find((p) => p.id === 'hero:base').advises).toEqual([expect.stringMatching(/^the hero was edited by hand since the run/)]);
    expect(action(again, 'hero-equipped')).toBe('remake');
    expect(stored('ge-hero-equipped').hero.palette.Top).toBe('#123456');
  }, 600_000);

  it('a hero made on its own is adopted by ref: pinned, never made, and it plays', async () => {
    await createCharacterHandler({ as: 'hero', spec: { cast: 'female', head: 'anime', palette: { Top: '#0f5c4a' } }, title: 'solo', ref: 'solo' });
    const world = { ...AUTO, characters: { ...AUTO.characters, hero: { ...AUTO.characters.hero, ref: 'solo' } } };
    const out = await designGameHandler({ world, ref: 'ga', run: true });
    expect(action(out, 'hero')).toBe('adopt');
    expect(stored('ga-hero')).toBeUndefined();
    expect(gameworldOf(stored('ga')).characters.hero.looks.base).toMatchObject({ ref: 'solo' });
    expect(out.parts.find((p) => p.id === 'hero:motion').advises).toEqual(expect.arrayContaining([expect.stringMatching(/the hero is adopted \('solo'\)/)]));
    if (stored('ga-hero-equipped')) expect(stored('ga-hero-equipped').hero.palette.Top).toBe('#0f5c4a');
    const again = await designGameHandler({ ref: 'ga', run: true });
    expect(action(again, 'hero')).toBe('keep');
    // a quick game takes one the same way
    const quick = await designGameHandler({ quick: { goal: 'reach', hero: { ref: 'solo' }, world: { id: 'adopt' } }, ref: 'qa', run: true });
    expect(action(quick, 'hero')).toBe('adopt');
    expect(stored('qa-hero')).toBeUndefined();
    const level = Object.entries(quick.made).find(([k]) => k.startsWith('level-'))[1];
    expect(JSON.stringify(stored(level))).toContain('"heroRef":"solo"');
  }, 600_000);
});
