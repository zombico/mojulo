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
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { simLevel } from '@/lib/graph/game/level-sim.js';
import { buildGameStoreKernel } from '@/lib/graph/game/store-kernel.js';
import { rpgInit, rpgStart, rpgRound, rpgTargets, rpgClose } from '@/lib/graph/playscape/rpg/kernel.js';

// The rail's door: write the gameworld, take the verdicts, run what is ready through the real handlers, and say what
// to do next. A run with nothing changed makes nothing; a hand edit is left unless forced.

const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;
// the book's areas a run's levels stand in (level-<area>-<n>, level-<area>-skirmish)
const L0levels = (out) => out.ran.filter((r) => /^level-/.test(r.key)).map((r) => r.key.replace(/^level-/, '').replace(/-(\d+|skirmish)$/, ''));
const action = (out, key) => out.ran.find((r) => r.key === key)?.action;
const step = (out, id) => out.next.find((n) => n.step === id);
const revs = (ref) => SketchRevisionRepository.head(ref)?.rev ?? 0;
const GATED = { ...MEADOWMARK_HERO, mode: 'gated' };
const AUTO = { ...MEADOWMARK_HERO, mode: 'autonomous' };

describe('design_game', () => {
  beforeEach(() => { closeDb(); });

  it('a new game is made for a phone unless another screen is named; a recipe re-sent whole keeps its screen', async () => {
    await designGameHandler({ world: GATED, ref: 'gw-phone' });
    expect(stored('gw-phone').screen).toBe('phone');
    await designGameHandler({ world: GATED, ref: 'gw-phone' });   // re-sent whole, no screen in it
    expect(stored('gw-phone').screen).toBe('phone');
    await designGameHandler({ world: { ...GATED, screen: 'tablet' }, ref: 'gw-tablet' });
    expect(stored('gw-tablet').screen).toBe('tablet');
    await designGameHandler({ world: { ...GATED, screen: null }, ref: 'gw-none' });
    expect(stored('gw-none').screen).toBe(null);
  });

  it('starts a gameworld from a recipe and reads it: every part proposed, the steps waiting, the next moves said', async () => {
    const out = await designGameHandler({ world: GATED, ref: 'gw' });
    expect(out).toMatchObject({ ok: true, ref: 'gw', bible: '/api/sketches/gw/bible', mode: 'gated', steps: { adornment: 'waiting', systems: 'waiting', equipment: 'waiting' } });
    expect(out.parts.find((p) => p.id === 'hero:base')).toMatchObject({ status: 'proposed', advises: ['no base is pinned'] });
    // the next moves are step ids; the gameworld-next card says what each means
    expect(step(out, 'review')).toMatchObject({ card: 'gameworld-next', parts: expect.arrayContaining(['hero:base']) });
    expect(step(out, 'run')).toEqual({ step: 'run', card: 'gameworld-next' });
    expect(stored('gw').kind).toBe('gameworld');
    // a world before its people, gated and unreviewed: its levels and game wait on its parts, and nothing is made
    const ground = await designGameHandler({ world: MEADOWMARK, ref: 'gw-ground', run: true });
    expect(ground.ran.length).toBeGreaterThan(1);
    expect(ground.ran.every((r) => r.action === 'waiting')).toBe(true);
    expect(ground.made).toBeUndefined();
  });

  it('a target is advice: the readout names what the engine does not carry as a next step, and writes the world as given', async () => {
    const out = await designGameHandler({ world: { ...MEADOWMARK, intent: { from: 'kart-racer', target: 'roblox' } }, ref: 'gw-aimed' });
    expect(out.intent.target).toMatchObject({ engine: 'roblox', carries: false });
    expect(step(out, 'target')).toEqual({ step: 'target', engine: 'roblox', lost: out.intent.target.lost, card: 'gameworld-intent' });
    expect(gameworldOf(stored('gw-aimed')).intent).toEqual({ from: 'kart-racer', target: 'roblox' });
    // the same world with no target: no advice, no step
    const plain = await designGameHandler({ world: { ...MEADOWMARK, intent: { from: 'kart-racer' } }, ref: 'gw-plain' });
    expect(plain.intent.target).toBeUndefined();
    expect(step(plain, 'target')).toBeUndefined();
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

describe('design_game: party battles on the book path (battles)', () => {
  beforeEach(() => { closeDb(); });

  it('a run lays packs on the trails, the store carries the party, and a pack walked up to is fought and falls', async () => {
    const out = await designGameHandler({ world: { ...AUTO, battles: { per: 1, rules: { defeat: 'retry' } } }, ref: 'gb', run: true });
    expect(action(out, 'foe')).toBe('make');
    expect(stored('gb-game').store.slices).toContainEqual(expect.objectContaining({ name: 'party', kind: 'party' }));
    const L = stored('gb-level-meadow-ascent-0');
    expect(L.play.rpg.party.map((p) => p.id)).toEqual(['hero']);
    expect(L.game.mechanics.map((m) => m.kind)).toContain('party');
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('gb-level-meadow-ascent-0'));
    expect(payload.game.party).toEqual({ slice: 'party' });
    expect(payload.game.consumes).toContainEqual({ slice: 'party' });
    const enc = L.play.rpg.encounters[0], cfg = payload.events.rpg;
    const sim = simLevel({ entities: payload.entities, events: payload.events }), W = sim.world, hero = W.byId[W.pilotId], v = sim.bus.vars;
    hero.transform.pos = [enc.at[0], enc.at[1], hero.transform.pos[2]];
    sim.run(0.5);
    expect(sim.bus.log.some((e) => e.type === `rpg-battle:${enc.id}`)).toBe(true);
    // the page's kernel on the payload's own cfg: the hero alone fights the first pack, and wins it
    const R = rpgInit(cfg);
    rpgStart(cfg, R, enc.id, v);
    for (let r = 0; r < 30 && R.b.phase === 'command'; r++) rpgRound(cfg, R, { hero: { act: 'attack', target: rpgTargets(cfg, R, { act: 'attack' })[0]?.id } }, v);
    expect(R.b.phase).toBe('won');
    sim.run(0.5, { 0: rpgClose(cfg, R, v) });
    expect(W.byId[enc.who].downed).toBe(true);
    expect(v[`rpg-done-${enc.id}`]).toBe(1);
  }, 600_000);

  it('minigames heard in the prompt: a keeper is made, a stall stands on a trail, the level\'s page plays its round', async () => {
    const out = await designGameHandler({ world: { ...AUTO, battles: { per: 1, rules: { defeat: 'retry' } }, brief: { prompt: 'a jrpg with a fishing pond' } }, ref: 'gm', run: true });
    expect(action(out, 'keeper')).toBe('make');
    expect(stored('gm-keeper')).toMatchObject({ kind: 'layered' });
    const ref = out.ran.filter((r) => r.key.startsWith('level-')).map((r) => r.ref).find((r) => stored(r).play?.minigames);
    const L = stored(ref), g = L.play.minigames[0];
    expect(g).toMatchObject({ id: 'fishing', game: 'fishing', purse: 'held:bag:gold' });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(ref));
    expect(payload.events.minigames.games.map((x) => x.id)).toEqual(['fishing']);
    expect(payload.events.rpg).toBeDefined();
    // the hero walks up to the keeper and presses interact: the round is asked for on the bus
    const sim = simLevel({ entities: payload.entities, events: payload.events }), W = sim.world, hero = W.byId[W.pilotId];
    hero.transform.pos = [g.at.at[0], g.at.at[1], hero.transform.pos[2]];
    sim.run(0.3);
    const use = payload.events.reactions.find((r) => r.do === 'emit' && r.type === 'minigame:fishing');
    sim.run(0.2, { 0: [{ type: use.on }] });
    expect(sim.bus.log.some((e) => e.type === 'minigame:fishing')).toBe(true);
  }, 600_000);

  it('a casting page: the cast rolled as one row, each member made from it by path, the first party and the familiar in the battle party', async () => {
    const casting = { scale: 'party', n: 1, cast: { party: { relation: 'party', n: 1, body: 'person' }, sprite: { relation: 'party', body: 'mascot' }, kin: { relation: 'party', body: 'beastkin', facets: { ancestry: 'lupine', humanity: 0.2 } }, pet: { relation: 'familiar', body: 'beast', species: 'wolf' } } };
    const world = { ...AUTO, characters: { ...AUTO.characters, casting }, battles: { per: 1 } };
    const out = await designGameHandler({ world, ref: 'gc', run: true });
    expect([action(out, 'casting'), action(out, 'cast-party-1'), action(out, 'cast-pet')]).toEqual(['make', 'make', 'make']);
    expect(stored('gc-casting')).toMatchObject({ kind: 'egocube', castSheet: { order: ['hero', 'hero/party-1', 'hero/sprite', 'hero/kin', 'hero/pet'] } });
    expect(stored('gc-cast-party-1')).toMatchObject({ kind: 'layered', egocube: { ref: 'gc-casting', member: 'hero/party-1' } });
    expect(stored('gc-cast-pet')).toMatchObject({ species: 'wolf' });   // the animal door's row
    // the hero's familiar fights beside it, picking for itself
    expect(stored('gc-level-meadow-ascent-0').play.rpg.party.map((p) => [p.id, p.auto?.keeper ?? null])).toEqual([['hero', null], ['party-1', null], ['sprite', null], ['kin', null], ['pet', 'hero']]);
    expect(out.parts.find((p) => p.id === 'characters:cast')).toBeTruthy();
    // on the level map the member walks beside the hero from the start and plays its own moves over the library's
    const level = SketchRepository.getByRef('gc-level-meadow-ascent-0');
    expect(level.manifest.play.party).toContainEqual({ who: 'party-1' });
    const { payload } = await resolveWorldScene(level);
    const fig = payload.figures['party-1'];
    expect(fig.clips.topple).toEqual(fig.clips.knockedOutDown);
    expect(fig.clips.getup).toEqual(fig.clips.knockedOutUp);
    expect(fig.clips.stagger).toBeTruthy();
    // the mascot, the beast-kin on the creature loop's rig and the wolf walk beside them on their own clips, no library
    expect(level.manifest.play.party).toEqual(expect.arrayContaining([{ who: 'sprite' }, { who: 'kin' }, { who: 'pet' }]));
    const own = (id) => payload.figures[id].clips;
    expect(own('sprite').forward).toEqual(own('sprite').run);
    expect(own('kin').forward).toEqual(own('kin').jog);
    expect(own('kin').topple).toEqual(own('kin').knockedOutDown);
    expect(own('pet').forward).toEqual(own('pet').trot);
    expect([own('pet').stagger, own('pet').topple, own('pet').getup]).toEqual([own('pet').flinch, own('pet').fall, own('pet').rise]);
    expect([own('sprite').stagger, own('sprite').topple, own('sprite').getup]).toEqual([own('sprite').flinch, own('sprite').fall, own('sprite').rise]);
    expect(own('sprite').fall.once).toBe(true);
    const again = await designGameHandler({ ref: 'gc', run: true });
    expect([action(again, 'casting'), action(again, 'cast-party-1')]).toEqual(['keep', 'keep']);
  }, 900_000);

  it('a journey cast is proposed: its part waits for the creator, and approving it readies the members', async () => {
    const world = { ...GATED, characters: { ...GATED.characters, casting: { scale: 'journey', n: 1 } } };
    const out = await designGameHandler({ world, ref: 'gj' });
    expect(out.parts.find((p) => p.id === 'characters:cast')).toMatchObject({ status: 'proposed' });
    expect(out.steps.cast).toBe('waiting');
    const approved = await designGameHandler({ ref: 'gj', approve: 'characters:cast' });
    expect(approved.parts.find((p) => p.id === 'characters:cast').status).toBe('approved');
    expect(approved.steps.cast).toBe('ready');
    // a book without the page reads as it did: no cast part, no cast step
    const plain = await designGameHandler({ world: GATED, ref: 'gp' });
    expect(plain.steps.cast).toBeUndefined();
    expect(plain.parts.some((p) => p.id === 'characters:cast')).toBe(false);
  }, 300_000);
});

describe('design_game: tactics battles on boards (battles.on: board)', () => {
  beforeEach(() => { closeDb(); });

  it('a run makes each stage that meets packs a battle on its own ground: the book\'s party deployed, the packs its foes, the level won on the board', async () => {
    // the story's slots: a battle's before and after, the first epoch's begin and end
    const line = (say) => [{ line: { who: 'hero', say } }];
    const story = [
      { id: 'muster', where: { level: 'meadow-ascent' }, when: { slot: 'before' }, beats: line('Form up.') },
      { id: 'rout', where: { level: 'meadow-ascent' }, when: { slot: 'after' }, beats: line('They run.') },
      { id: 'dawn', where: { epoch: 1 }, when: { slot: 'begin' }, beats: line('The first age.') },
      { id: 'dusk', where: { epoch: 'Meadow Ascent' }, when: { slot: 'end' }, beats: line('The meadow is ours.') },
    ];
    const out = await designGameHandler({ world: { ...AUTO, battles: { on: 'board', per: 1 }, story }, ref: 'gt', run: true });
    const levels = out.ran.filter((r) => r.key.startsWith('level-')).map((r) => r.ref);
    expect(levels.length).toBeGreaterThan(0);
    const game = stored('gt-game');
    expect(game.store.slices).toContainEqual(expect.objectContaining({ name: 'party', kind: 'party' }));
    const L = stored(levels[0]);
    expect(L.entities).toBeUndefined();
    expect(L.game.mechanics.map((m) => m.kind)).toEqual(['board', 'party', 'bag']);
    expect(L.board.battle).toMatchObject({ deploy: 'near', cap: 4, rules: { lose: { leader: 'hero' } } });
    expect(L.board.battle.party[0]).toMatchObject({ id: 'hero', class: 'fighter', figure: 'gt-hero-equipped' });
    expect(L.board.battle.foes.length).toBeGreaterThan(0);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(levels[0]));
    expect(payload.board.battle.units.map((u) => u.id)).toEqual(['hero', ...L.board.battle.foes.map((f) => f.id)]);
    expect(payload.board.battle.placed).toEqual(['hero']);
    expect(payload.board.figures.hero).toBe('board-hero');
    expect(payload.figures['hero-gt-hero-equipped']).toBeTruthy();
    expect(payload.game.on['board-won']).toEqual({ end: 'success', exit: 'map' });
    expect(payload.game.party).toEqual({ slice: 'party' });
    expect(payload.walk).toBe(false);

    // the epochs (each of the book's levels its own, by default): a map each, the first the game's first level, a dot
    // each stage in story order, a dot's road opening when the story dot before it is won
    const maps = out.ran.filter((r) => /^map-\d+$/.test(r.key)).map((r) => r.ref);
    expect(maps.length).toBe(new Set(L0levels(out)).size);
    const M = stored(maps[0]), Ms = maps.map(stored);
    expect(M.kind).toBe('board');
    expect(Ms.flatMap((m) => m.map.dots.map((d) => d.ref))).toEqual(levels);
    expect(M.map.dots.find((d) => d.ref === levels[0]).kind).toBe('battle');
    expect(M.game.mechanics).toEqual([{ kind: 'map', slice: 'campaign', dots: M.map.dots.map((d) => d.id) }]);
    expect(game.levels[0].ref).toBe(maps[0]);
    expect(game.links).toBeUndefined();
    // each dot's level back to its map, but an epoch's last stage's: on to the next epoch's map; the final epoch's last
    // stage the game's final, back to its own map (the map before the end, open for what is left)
    const exitOf = (r) => game.levels.find((l) => l.ref === r).exits;
    Ms.forEach((m, k) => {
      const stagesOf = m.map.dots.filter((d) => d.kind !== 'skirmish'), end = stagesOf[stagesOf.length - 1];
      for (const d of m.map.dots) expect(exitOf(d.ref)).toEqual([{ id: 'map', to: d === end ? maps[k + 1] ?? maps[k] : maps[k] }]);
      expect(m.map.dots[0].gate).toBeUndefined();
    });
    const lastMap = Ms[Ms.length - 1].map.dots.filter((d) => d.kind !== 'skirmish');
    expect(game.final).toBe(lastMap[lastMap.length - 1].ref);
    // each area's skirmish: after its first battle, open once that is won, a pack drawn from those its epoch has met
    const wilds = Ms.flatMap((m) => m.map.dots.filter((d) => d.kind === 'skirmish').map((w) => [m, w]));
    expect(wilds.length).toBeGreaterThan(0);
    for (const [m, w] of wilds) {
      const at = m.map.dots.findIndex((d) => d.id === w.id), before = m.map.dots[at - 1];
      expect(w.gate).toBe(before.id);
      expect(before.kind).toBe('battle');
      const W = stored(w.ref);
      expect(W.board.battle.foes).toBeUndefined();
      expect(W.board.battle.draw.length).toBeGreaterThan(1);
      expect(W.game.mechanics[0]).toEqual({ kind: 'board', exit: 'map' });
    }
    // a later epoch's skirmish draws from more packs (the ones met so far)
    if (wilds.length > 1) expect(stored(wilds[wilds.length - 1][1].ref).board.battle.draw.length).toBeGreaterThanOrEqual(stored(wilds[0][1].ref).board.battle.draw.length);
    // the story goes on past a skirmish: the dot after it waits on the battle, not the skirmish
    const [m0, w0] = wilds[0], after = m0.map.dots[m0.map.dots.findIndex((d) => d.id === w0.id) + 1];
    if (after) expect(after.gate).toBe(w0.gate);
    for (const d of Ms.flatMap((m) => m.map.dots).filter((x) => x.kind === 'story')) expect(stored(d.ref).game.mechanics.filter((m) => m.kind === 'reach-exit').every((m) => m.exit === 'map')).toBe(true);
    // the story in its slots: the battle's own before and after, the epoch's begin on its map (once a game), its end at
    // its last stage's exit (a walked stage), every moment bound
    expect(out.story).toMatchObject({ bound: 4, unplaced: 0 });
    const slotOf = (sc) => sc.when.on;
    expect(stored(levels[0]).play.scenes.map(slotOf)).toEqual(['slot:before', 'slot:after']);
    expect(stored(levels[0]).play.carry).toBe('story');
    expect(M.play.scenes).toEqual([expect.objectContaining({ when: { on: 'slot:begin' }, if: [{ not: 'seen-dawn' }], sets: ['seen-dawn'] })]);
    const lastWalk = M.map.dots.filter((d) => d.kind !== 'skirmish').slice(-1)[0];
    expect(stored(lastWalk.ref).play.scenes.find((sc) => sc.beats[0].line.say === 'The meadow is ours.').when.enter.r).toBe(4);
    expect(game.store.slices).toContainEqual(expect.objectContaining({ name: 'story', kind: 'flags' }));
    expect((await resolveWorldScene(SketchRepository.getByRef(levels[0]))).payload.board.slots).toEqual(['before', 'after']);
    const map = await resolveWorldScene(SketchRepository.getByRef(maps[0]));
    expect(map.payload.board.slots).toEqual(['begin']);
    // the begin's seen flag rides the story slice: it plays once a game, not each time the map opens
    expect(map.payload.game.on['flag:seen-dawn']).toBeTruthy();
    expect(map.payload.board.map.dots.map((d) => d.id)).toEqual(M.map.dots.map((d) => d.id));
    expect(map.payload.game.on[`map-go:${M.map.dots[0].id}`]).toEqual({ end: 'success', exit: M.map.dots[0].id });
    // travel: from the map to the first dot at once, the second only once the first is won; the next epoch's map found
    // only once this epoch's last stage is won
    const K = buildGameStoreKernel(), state = K.createStore(game.store);
    const [d1, d2] = M.map.dots;
    expect(K.travel(game.store, state, game.levels, maps[0], d1.id)).toBe(d1.ref);
    if (d2) {
      expect(K.travel(game.store, state, game.levels, maps[0], d2.id)).toBeNull();
      state.campaign.completed[d1.ref] = 'success';
      expect(K.travel(game.store, state, game.levels, maps[0], d2.id)).toBe(d2.ref);
    }
    expect(K.travel(game.store, state, game.levels, d1.ref, 'map')).toBe(maps[0]);
    if (maps[1]) {
      expect(K.reachable(game.store, state, game.levels)[maps[1]]).toBe(false);
      state.campaign.completed[maps[0]] = 'success';
      for (const d of M.map.dots) state.campaign.completed[d.ref] = 'success';
      expect(K.reachable(game.store, state, game.levels)[maps[1]]).toBe(true);
    }
  }, 600_000);
});
