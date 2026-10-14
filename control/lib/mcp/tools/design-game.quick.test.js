// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { suggestScore, levelScoreContext } from '@/lib/graph/beats/score-suggest';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { readQuick } from '@/lib/graph/gameworld/quick.js';
import { simLevel } from '@/lib/graph/game/level-sim.js';
import { composeLive } from '@/lib/graph/worlds/controllable/compose.js';
import { stageEnds } from '@/lib/graph/gameworld/levels.js';

// The quick path: a simple LOOP (one level, one goal), never a simple picture: any hero the door draws, or none (first
// person); the goal placed on the stage's own anchors; the game made in one call, walkable and not proved beatable.
beforeEach(() => { closeDb(); });
const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;
const mechanicsOf = (ref) => stored(ref).game.mechanics.map((m) => m.kind);

describe('design_game quick', () => {
  it('collect, first person: the coins lie on the trail\'s beats, the exit at its end, the game in one call', async () => {
    const out = await designGameHandler({ quick: { goal: 'collect', pickup: 'coin', world: { id: 'coins', name: 'Coin Run', style: { kit: 'trail-valley' } } }, ref: 'q' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['level-run-0', 'make'], ['game', 'make']]);
    const L = stored('q-level-run-0');
    expect(mechanicsOf('q-level-run-0')).toEqual(['collect', 'bag', 'reach-exit']);   // the bag carried level to level
    expect(L.game.mechanics[0].pickups.length).toBeGreaterThan(2);
    expect(L.game.mechanics[0].pickups.every((p) => p.item === 'coin')).toBe(true);
    expect(L.entities[0]).toMatchObject({ id: 'player', rule: { type: 'walk' }, body: { type: 'none' } });
    expect(L.figures).toBeUndefined();
    expect(stored('q-game').store.slices.map((s) => s.kind)).toEqual(['inventory', 'progression']);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('q-level-run-0'));
    // the coins and the exit, dressed by the game's decoration (glyphs, baked to figure frames on the page)
    expect(payload.entities.filter((e) => e.id.startsWith('dec_pk_')).length).toBe(L.game.mechanics[0].pickups.length);
    expect(payload.entities.some((e) => e.id.startsWith('dec_exit'))).toBe(true);
    // the light play shell, and a playtest of the same game
    expect(stored('q-game').shell).toBe('play');
    expect(out.next.find((n) => n.step === 'play')).toMatchObject({ gate: 'eyes', card: 'gameworld-next', playtest: '/api/sketches/q-game/playtest' });
  }, 240_000);

  it('reach with a climb and a hero the door draws: the hero pilots both stages, the climb\'s exit is its top, in volume', async () => {
    const hero = { cast: 'female', head: 'anime', look: ['heroine', 'determined'], hair: ['frieda-pony'], palette: { Top: '#7a2f8e' }, gear: { right: { item: 'sword' } } };
    const out = await designGameHandler({ quick: { goal: 'reach', climb: true, hero, theme: { accent: '#7a2f8e', style: 'hud' }, world: { id: 'summit', style: { kit: 'isekai-meadow' } } }, ref: 's' });
    expect(out.ran.map((r) => r.key)).toEqual(['hero', 'level-run-0', 'level-run-1', 'game']);
    expect(stored('s-hero').hero.gear.right).toMatchObject({ item: 'sword' });
    expect(stored('s-level-run-1').figures.hero.heroRef).toBe('s-hero');
    expect(stored('s-level-run-1').game.mechanics[0]).toMatchObject({ kind: 'reach-exit', planar: false });
    expect(stored('s-game').theme).toMatchObject({ accent: '#7a2f8e' });
  }, 240_000);

  it('fly: an airspace flown by its craft, the course\'s gates as laps in three dimensions, the runway the finish', async () => {
    const out = await designGameHandler({ quick: { goal: 'fly', craft: 'trainer', airspace: { map: { form: 'island', field: 2400 } }, world: { id: 'skies' } }, ref: 'f' });
    expect(out.ran.map((r) => r.key)).toEqual(['level-run-0', 'game']);
    const L = stored('f-level-run-0');
    expect(L.kind).toBe('airspace');
    expect(L.entities[0]).toMatchObject({ id: 'player', pilotable: true, rule: { type: 'fly', lever: true } });
    expect(L.entities[0].rule.bound.hx).toBeGreaterThan(1200);   // the map's reach
    expect(L.camera).toMatchObject({ rule: 'follow', target: 'player', rollFollow: 1 });
    const laps = L.game.mechanics.find((m) => m.kind === 'laps');
    expect(laps.checkpoints.length).toBeGreaterThan(3);
    expect(laps.checkpoints.every((c) => c.planar === false)).toBe(true);
    // the gates stand in the air, the finish on the runway
    expect(laps.checkpoints[0].at[2]).toBeGreaterThan(laps.checkpoints.at(-1).at[2]);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('f-level-run-0'), { live: true });
    expect(payload.terrain.hazeHeight).toBeGreaterThan(0);
    expect(payload.entities[0].id).toBe('player');
    // the gates' and the pads' zones watch the pilot itself (else no gate counts on the page), and the finish is a landing
    const zones = payload.events.sources.filter((q) => q.type === 'zone');
    expect(zones.length).toBeGreaterThan(laps.checkpoints.length);
    expect(zones.every((q) => q.watch === payload.entities[0].id)).toBe(true);
    expect(laps.checkpoints.at(-1).land).toBe(true);
    expect(laps.respawn).toHaveLength(laps.checkpoints.length);
    const page = emitThreeWorld({ ...payload, inline: true });
    expect(page).toContain('LEAVING THE AREA');   // the flight HUD
    expect(page).toContain('MISSED GATE');        // and the course's guidance, read off the craft's rule
    expect(L.entities[0].rule.course.gates).toHaveLength(laps.checkpoints.length - 1);
    expect(L.entities[0].rule.course.land.aim).toHaveLength(3);
  }, 240_000);

  it('fly in space: a space craft\'s map is space (rocks, stars, no ground), its gates a race with nothing to land on', async () => {
    const out = await designGameHandler({ quick: { goal: 'fly', craft: 'fighter', airspace: { space: { asteroids: 'sparse' } }, world: { id: 'belt' } }, ref: 'sp' });
    expect(out.ran.map((r) => r.key)).toEqual(['level-run-0', 'game']);
    const L = stored('sp-level-run-0');
    expect(L.ground).toBeUndefined();
    expect(L.entities[0].rule).toMatchObject({ type: 'fly', gravity: false, lift: false, space: true });
    const laps = L.game.mechanics.find((m) => m.kind === 'laps');
    expect(laps.land).toBeUndefined();
    expect(laps.checkpoints.at(-1).land).toBeUndefined();
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sp-level-run-0'), { live: true });
    expect(payload.sky.space).toBe(true);
    expect(payload.meta.laws.filter((l) => !l.ok)).toEqual([]);
  }, 240_000);

  it('shoot with a craft: a dogfight in space, the wing of fighters its foes, a crash coming back at the start', async () => {
    const out = await designGameHandler({ quick: { goal: 'shoot', craft: 'fighter', foes: 3, world: { id: 'df' } }, ref: 'df' });
    expect(out.ran.map((r) => r.key)).toEqual(['level-run-0', 'game']);
    const L = stored('df-level-run-0');
    expect(L.kind).toBe('airspace');
    expect(mechanicsOf('df-level-run-0')).toEqual(['fail-on-death', 'respawn', 'defeat-all']);
    expect(L.entities.filter((e) => /^foe-/.test(e.id))).toHaveLength(3);
    expect(L.entities[0]).toMatchObject({ id: 'player', weapon: { fireClass: 'sight' }, rule: { type: 'fly', space: true } });
    expect(L.camera.mouseLook).toBe(true);
    expect(L.game.mechanics.find((m) => m.kind === 'laps')).toBeUndefined();
  }, 240_000);

  it('survive and avoid: a countdown; hazards on the water the trail crosses, and hp to lose', async () => {
    await designGameHandler({ quick: { goal: 'survive', seconds: 30, world: { id: 'hold' } }, ref: 'h' });
    expect(mechanicsOf('h-level-run-0')).toEqual(['survive']);
    await designGameHandler({ quick: { goal: 'avoid', world: { id: 'wade', style: { kit: 'isekai-meadow' } } }, ref: 'a' });
    const kinds = mechanicsOf('a-level-run-0');
    expect(kinds[kinds.length - 1]).toBe('reach-exit');
    if (kinds.includes('hazard-damage')) expect(stored('a-game').store.slices.map((s) => s.kind)).toContain('character');
  }, 240_000);

  it('collect in a building, first person: the tavern laid from its use, pickups in its rooms, the end its cellar', async () => {
    const out = await designGameHandler({ quick: { goal: 'collect', pickup: 'key', building: { use: 'tavern', seed: 2 }, world: { id: 'inn', name: 'Last orders' } }, ref: 'b' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['level-run-0', 'make'], ['game', 'make']]);
    const L = stored('b-level-run-0');
    expect(L.program.use).toBe('tavern');
    expect(L.level.mechanics[0]).toMatchObject({ kind: 'collect' });
    expect(L.level.mechanics[0].pickups.every((p) => p.item === 'key')).toBe(true);
    // lowered as it is played: the pickups, then the cellar's goal routed through the doorways
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('b-level-run-0'));
    expect(payload.program).toMatchObject({ use: 'tavern', goal: 'cellar' });
    expect(payload.entities.some((e) => e.id.startsWith('dec_exit'))).toBe(true);
    expect(payload.entities.filter((e) => e.id.startsWith('dec_pk_')).length).toBe(L.level.mechanics[0].pickups.length);
  }, 240_000);

  it('race: the trail\'s beats are checkpoints in order, its end the finish, the time kept', async () => {
    await designGameHandler({ quick: { goal: 'race', world: { id: 'dash', style: { kit: 'trail-valley' } } }, ref: 'r' });
    const L = stored('r-level-run-0');
    expect(mechanicsOf('r-level-run-0')).toEqual(['laps']);
    const cps = L.game.mechanics[0].checkpoints;
    expect(cps.length).toBeGreaterThan(2);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('r-level-run-0'));
    expect(payload.game.keep).toEqual([{ var: '__race_0', label: 'Time', best: 'low', scale: 0.1, unit: 's' }]);
    expect(payload.game.on['laps:done']).toEqual({ end: 'success' });
    expect(payload.events.reactions.some((r) => r.if && r.if.var === '__cp_0')).toBe(true);
  }, 240_000);

  it('sneak: guards with sight keep the trail, sweeping; a sighting ends it', async () => {
    const out = await designGameHandler({ quick: { goal: 'sneak', guards: 2, world: { id: 'creep', style: { kit: 'trail-valley' } } }, ref: 'k' });
    expect(out.ran.map((r) => r.key)).toEqual(['guard', 'level-run-0', 'game']);
    const L = stored('k-level-run-0');
    expect(mechanicsOf('k-level-run-0')).toEqual(['unseen', 'reach-exit']);
    const guards = L.entities.filter((e) => e.team === 'guards');
    expect(guards.map((g) => g.id)).toEqual(['guard-1', 'guard-2']);
    expect(guards[0].rule).toMatchObject({ type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, scan: 1.3 });
    expect(L.figures['guard-1'].heroRef).toBe('k-guard');
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('k-level-run-0'));
    expect(payload.game.on.spotted).toEqual({ end: 'fail' });
    expect(payload.events.reactions.some((r) => r.on === 'seen')).toBe(true);
  }, 240_000);

  it('rhythm: the music\'s beat on the bus, a press judged on it, the beats scored and kept', async () => {
    await designGameHandler({ quick: { goal: 'rhythm', music: 'tavern', misses: 4, world: { id: 'pulse', style: { kit: 'trail-valley' } } }, ref: 'm' });
    const L = stored('m-level-run-0');
    expect(mechanicsOf('m-level-run-0')).toEqual(['on-beat', 'score', 'reach-exit']);
    expect(L.audio).toEqual({ soundtrack: 'field:tavern', beat: true });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('m-level-run-0'));
    expect(payload.audio.beat.lead).toBe(0.15);
    expect(payload.audio.beat.every).toBeGreaterThan(0.3);
    expect(payload.game.keep).toEqual([{ var: 'score', label: 'Beats', best: 'high' }]);
    expect(payload.game.on.offbeat).toEqual({ end: 'fail' });
    expect(payload.events.inputs.some((i) => i.once && i.key === ' ')).toBe(true);
  }, 240_000);

  it('music: auto scores each level from its place and play, under the game\'s one identity; quiet without it', async () => {
    await designGameHandler({ quick: { goal: 'sneak', music: 'auto', sfx: 'auto', world: { id: 'hush', style: { kit: 'trail-valley' } } }, ref: 'h' });
    const L = stored('h-level-run-0');
    // what is written is the suggestion for this level, its place and its goal (the suggestion's own laws live beside it)
    expect(L.audio.soundtrack.score.mood).toBe(suggestScore(levelScoreContext(L, { goal: 'sneak' })).mood);
    expect(Number.isInteger(L.audio.soundtrack.score.game)).toBe(true);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('h-level-run-0'));
    expect(payload.audio.soundtrack).toMatchObject({ kind: 'beats-composition', loop: true });
    // sfx 'auto': the score's palette, wired to what this sneak level emits (spotted, the goal), and nothing it does not
    expect(L.audio.sfx).toBe('auto');
    expect(payload.audio.on).toMatchObject({ spotted: 'alarm', 'goal:reached*': 'goal' });
    expect(payload.audio.on['door:*']).toBeUndefined();
    expect(payload.audio.footsteps.step).toEqual(payload.audio.cues.step);
    await designGameHandler({ quick: { goal: 'reach', music: 'forest', world: { id: 'glade', style: { kit: 'trail-valley' } } }, ref: 'g' });
    expect(stored('g-level-run-0').audio.soundtrack.score.mood).toBe('forest');
    await designGameHandler({ quick: { goal: 'reach', world: { id: 'mute', style: { kit: 'trail-valley' } } }, ref: 'q' });
    expect(stored('q-level-run-0').audio).toBeUndefined();
  }, 240_000);

  it('ride: the hero is a car, its build minted, every stage driven on the rule it derives', async () => {
    const out = await designGameHandler({ quick: { goal: 'race', ride: 'coupe', world: { id: 'rally', style: { kit: 'trail-valley' } } }, ref: 'v' });
    expect(out.ran.map((r) => r.key)).toEqual(['ride', 'level-run-0', 'game']);
    expect(stored('v-ride').kind).toBe('assembler');
    const L = stored('v-level-run-0');
    expect(L.entities[0]).toMatchObject({ id: 'car', pilotable: true, rule: { type: 'drive', horsepower: 160 }, body: { type: 'figure-rig', figure: 'ride' } });
    expect(L.figures.ride).toEqual({ vehicleRef: 'v-ride', targetH: 1.5 });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('v-level-run-0'));
    // the checkpoints watch the car
    expect(payload.events.sources.find((z) => z.zone === 'cp_0_0').watch).toBe('car');
  }, 240_000);

  it('kart race: rivals in the same car round a loop on the trail\'s land, the place on the HUD, a podium to win', async () => {
    const out = await designGameHandler({ quick: { goal: 'race', ride: 'coupe', rivals: 3, world: { id: 'karts', style: { kit: 'trail-valley' } } }, ref: 'k' });
    expect(out.ran.map((r) => r.key)).toEqual(['ride', 'level-run-0', 'game']);
    expect(out.ran.find((r) => r.key === 'level-run-0').advises ?? []).toEqual([]);
    const L = stored('k-level-run-0');
    expect(L.entities.map((e) => e.id)).toEqual(['car', 'rival-1', 'rival-2', 'rival-3']);
    expect(L.entities[1]).toMatchObject({ team: 'rivals', rule: { type: 'racer', closed: true, horsepower: 160 }, body: { type: 'figure-rig', figure: 'rival-1' } });
    expect(L.figures['rival-1']).toEqual({ vehicleRef: 'k-ride', targetH: 1.5 });
    expect(L.game.mechanics[0]).toMatchObject({ kind: 'laps', laps: 3, rivals: ['rival-1', 'rival-2', 'rival-3'], win: 2 });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('k-level-run-0'));
    expect(payload.events.hud.find((h) => h.label === 'Place')).toMatchObject({ as: 'counter', max: 4 });
    expect(payload.game.keep.map((k) => k.label)).toEqual(['Time', 'Place']);
  }, 240_000);
  it('a race on a roadway: the level is the track itself, rivals on its grid and racing line, its barriers solid', async () => {
    const out = await designGameHandler({ quick: { goal: 'race', ride: 'coupe', vehicle: 'kart', tuning: 'arcade', rivals: 3, roadway: 'kart-sprint', world: { id: 'sprint', style: { kit: 'trail-valley' } } }, ref: 'rw' });
    expect(out.ran.map((r) => r.key)).toEqual(['ride', 'level-run-0', 'game']);
    expect(out.ran.find((r) => r.key === 'level-run-0').advises ?? []).toEqual([]);
    const L = stored('rw-level-run-0');
    expect(L).toMatchObject({ kind: 'roadway', form: 'circuit', course: 'kart-sprint', dress: true });
    expect(L.entities.map((e) => e.id)).toEqual(['car', 'rival-1', 'rival-2', 'rival-3']);
    expect(L.entities[0].rule).toMatchObject({ type: 'drive', vehicle: 'kart', tuning: 'arcade', air: true, surfaceGrip: true });
    expect(L.entities[1]).toMatchObject({ team: 'rivals', rule: { type: 'racer', closed: true, collideRadius: 0.9, vehicle: 'kart', lateralGrip: true } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('rw-level-run-0'));
    // the page carries what the tyres are on, and its engine reads it
    expect(payload.driveSurface.pts.length).toBeGreaterThan(100);
    expect(emitThreeWorld({ ...payload })).toMatch(/surface: __surface/);
    expect(payload.roadway).toMatchObject({ form: 'circuit', class: 'kart', closed: true });
    expect(payload.colliders.length).toBeGreaterThan(300);
    expect(payload.events.hud.find((h) => h.label === 'Place')).toMatchObject({ as: 'counter', max: 4 });
    expect(payload.game.keep.map((k) => k.label)).toEqual(['Time', 'Place']);
  }, 240_000);
  it('a field of racers: each in the machine its driver reads as, on its own physics, balanced; nothing to mint', async () => {
    const racers = ['hero', 'a grumpy old wizard', { archetype: 'innocent', build: 'brute' }];
    const out = await designGameHandler({ quick: { goal: 'race', racers, laps: 1, roadway: 'kart-oval', world: { id: 'cartoon', style: { kit: 'trail-valley' } } }, ref: 'cr' });
    expect(out.ran.map((r) => r.key)).toEqual(['level-run-0', 'game']);
    expect(out.ran.find((r) => r.key === 'level-run-0').advises ?? []).toEqual([]);
    const L = stored('cr-level-run-0');
    expect(L.entities.map((e) => e.id)).toEqual(['car', 'rival-1', 'rival-2']);
    // the recipe, not the machine: each figure a racer's spec, the brief and the facets as given
    expect(L.figures.ride.racer.facets).toEqual({ archetype: 'hero' });
    expect(L.figures['rival-1'].racer.brief).toBe('a grumpy old wizard');
    expect(L.figures['rival-2'].racer.facets).toEqual({ archetype: 'innocent', build: 'brute' });
    // each on its own derived rule, arcade; the pilot followed close
    expect(new Set(L.entities.map((e) => e.rule.mass)).size).toBe(3);
    expect(L.entities[0].rule).toMatchObject({ type: 'drive', vehicle: 'racer', tuning: 'arcade' });
    expect(L.entities[1].rule).toMatchObject({ type: 'racer', vehicle: 'racer', closed: true });
    expect(L.camera.dist).toBeLessThan(6);
    // the page resolves each recipe to its machine: a live vehicle rig with its juice
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('cr-level-run-0'));
    for (const k of ['ride', 'rival-1', 'rival-2']) expect(payload.figures[k]).toMatchObject({ rig: true, live: expect.any(Object), juice: expect.any(Object) });
    expect(emitThreeWorld({ ...payload })).toMatch(/__updateRacerJuice/);
  }, 240_000);
  it('defend: foes in waves walk the trail to the base; a pad builds a sentry tower for gold, and it fells them', async () => {
    const out = await designGameHandler({ quick: { goal: 'defend', waves: 1, pads: 2, world: { id: 'hold', style: { kit: 'trail-valley' } } }, ref: 'd' });
    expect(out.ran.map((r) => r.key)).toEqual(['foe', 'tower', 'level-run-0', 'game']);
    const L = stored('d-level-run-0');
    expect(mechanicsOf('d-level-run-0')).toEqual(['waves']);
    expect(L.entities.filter((e) => e.team === 'wave')).toHaveLength(3);
    expect(L.entities.filter((e) => e.team === 'defense').map((e) => e.id)).toEqual(['tower-1', 'tower-2']);
    expect(L.play.cues.map((c) => c.id)).toEqual(['build-1', 'build-2']);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('d-level-run-0'));
    expect(payload.events.cast).toBe(true);
    // played through in Node: build the first tower at once, then let the wave come
    const sim = simLevel({ entities: payload.entities, events: payload.events });
    const pad = L.play.cues[0].when.use.at, hero = sim.world.byId[sim.world.pilotId];
    hero.transform.pos = [pad[0], pad[1], hero.transform.pos[2]];
    sim.run(1, { 0.2: [{ type: 'use-cue-build-1' }] });
    expect(sim.world.byId['tower-1'].gone).toBe(false);
    expect(sim.bus.vars.gold).toBe(5);
    sim.run(90);
    const log = sim.bus.log.map((r) => r.type);
    expect(log.filter((t) => t === 'down').length + log.filter((t) => t === 'leak').length).toBe(3);
    expect(log).toContain('down');
  }, 240_000);

  it('puzzle: boulders on a grid by the start, each two pushes from its plate; walked through, it is solved', async () => {
    await designGameHandler({ quick: { goal: 'puzzle', boulders: 2, world: { id: 'rocks', style: { kit: 'trail-valley', pixel: true } } }, ref: 'z' });
    const L = stored('z-level-run-0'), P = L.game.mechanics[0];
    expect(L.pixel).toBe(4);   // the world's pixel look, on every level
    expect(P).toMatchObject({ kind: 'push', cols: 5, rows: 5 });
    expect(P.blocks).toHaveLength(2);
    expect(P.heights).toHaveLength(5);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('z-level-run-0'));
    expect(payload.pixel).toEqual({ scale: 4 });
    const sim = simLevel({ entities: payload.entities, events: payload.events }), W = sim.world, hero = W.byId[W.pilotId];
    const centre = (q) => [P.origin[0] + (q[0] + 0.5) * P.cell, P.origin[1] + (q[1] + 0.5) * P.cell];
    // each lane: stand behind the boulder, walk through it twice (it rolls onto the plate)
    for (let k = 0; k < P.blocks.length; k++) {
      const b = P.blocks[k], d = [Math.sign(P.plates[k][0] - b[0]), Math.sign(P.plates[k][1] - b[1])];
      for (const q of [[b[0] - d[0], b[1] - d[1]], b, [b[0] + d[0], b[1] + d[1]]]) { const c = centre(q); hero.transform.pos = [c[0], c[1], hero.transform.pos[2]]; sim.run(0.2); }
      hero.transform.pos = [P.origin[0] - 5, P.origin[1] - 5, hero.transform.pos[2]]; sim.run(0.2);
    }
    expect(sim.bus.log.map((r) => r.type).filter((t) => t === 'pushed')).toHaveLength(4);
    expect(sim.bus.log.map((r) => r.type)).toContain('plates:held');
  }, 240_000);

  it('farm: a clock, plots planted for gold that ripen over two dawns, farmhands keeping their day', async () => {
    const out = await designGameHandler({ quick: { goal: 'farm', plots: 3, folk: 1, target: 20, world: { id: 'farm', style: { kit: 'trail-valley' } } }, ref: 'f' });
    expect(out.ran.map((r) => r.key)).toEqual(['farmhand', 'level-run-0', 'game']);
    const L = stored('f-level-run-0');
    expect(mechanicsOf('f-level-run-0')).toEqual(['clock', 'crops', 'win-when']);
    expect(L.play.routines).toEqual([{ who: 'farmhand-1', plan: [{ hour: 7, to: 'field-1' }, { hour: 18, to: 'home' }] }]);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('f-level-run-0'));
    expect(payload.weather.clock).toBe(true);   // the sky turns with the clock (no weather named: clear air)
    const sim = simLevel({ entities: payload.entities, events: payload.events }), W = sim.world, hero = W.byId[W.pilotId], v = sim.bus.vars;
    expect(v.hour).toBe(6);
    const plots = L.game.mechanics[1].plots.map((p) => p.at);
    const use = (k) => { hero.transform.pos = [plots[k][0], plots[k][1], hero.transform.pos[2]]; sim.run(0.3, { 0: [{ type: `use-plot-1-${k + 1}` }] }); };
    plots.forEach((_, k) => use(k));
    expect(v.gold).toBe(6 - 3 * 2);
    // the farmhand walks out at seven (an hour of game time: 15 s at four minutes a second)
    const fh = W.byId['farmhand-1'], at0 = fh.transform.pos.slice();
    sim.run(20);
    expect(v.hour).toBe(7);
    sim.run(10);
    expect(Math.hypot(fh.transform.pos[0] - at0[0], fh.transform.pos[1] - at0[1])).toBeGreaterThan(1);
    // two dawns later the crops are ripe: harvested, they pay
    sim.run(2 * 360);
    expect(v.day).toBe(3);
    plots.forEach((_, k) => use(k));
    expect(v.gold).toBe(3 * 6);
    expect(sim.bus.log.map((r) => r.type).filter((t) => t === 'harvested')).toHaveLength(3);
  }, 240_000);

  it('run: a pool of trails, each its own seed; the game draws a run of them, none gated', async () => {
    const out = await designGameHandler({ quick: { goal: 'reach', run: 2, world: { id: 'delve', style: { kit: 'trail-valley' } } }, ref: 'g' });
    expect(out.ran.filter((r) => r.key.startsWith('level-')).map((r) => r.key)).toEqual(['level-stretch-1-0', 'level-stretch-2-0', 'level-stretch-3-0', 'level-stretch-4-0']);
    const G = stored('g-game');
    expect(G.run).toEqual({ length: 2 });
    expect(G.levels.every((l) => !l.gate)).toBe(true);
    // each its own land
    expect(stored('g-level-stretch-1-0').seed).not.toBe(stored('g-level-stretch-2-0').seed);
  }, 240_000);

  it('battle: walk up to a foe and the fight is turn by turn; the foe answers each turn, and falls at no hp', async () => {
    await designGameHandler({ quick: { goal: 'battle', foes: 2, world: { id: 'duel', style: { kit: 'trail-valley' } } }, ref: 'b2' });
    const L = stored('b2-level-run-0');
    expect(mechanicsOf('b2-level-run-0')).toEqual(['fail-on-death', 'win-when']);
    expect(L.play.battle.foes.map((f) => [f.who, f.hp, f.atk])).toEqual([['foe-1', 4, 1], ['foe-2', 6, 2]]);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('b2-level-run-0'));
    expect(payload.events.menus.map((m) => m.id)).toEqual(['battle-foe-1', 'battle-foe-2']);
    const sim = simLevel({ entities: payload.entities, events: payload.events }), W = sim.world, hero = W.byId[W.pilotId], v = sim.bus.vars;
    const f1 = L.play.battle.foes[0];
    hero.transform.pos = [f1.at[0], f1.at[1], hero.transform.pos[2]];
    sim.run(0.5);
    expect(v.battle).toBe(1);
    expect(v['ui-menu-battle-foe-1']).toBe(1);
    const pick = (n) => sim.run(1.5, { 0: [{ type: `menu-pick:battle-foe-1:${n}` }] });
    pick(0);   // attack: 4 → 2, the foe answers (20 → 19), the menu up again
    expect([v['foe-hp-foe-1'], v.hp, v['ui-menu-battle-foe-1']]).toEqual([2, 19, 1]);
    pick(1);   // guard: half its blow, rounded up
    expect(v.hp).toBe(18);
    pick(0);   // attack: it falls, and does not answer
    expect([v['foe-hp-foe-1'], v.hp, v.battle, v.won]).toEqual([0, 18, 0, 1]);
    expect(W.byId['foe-1'].downed).toBe(true);
  }, 240_000);

  it('shoot: armed foes hunt you from behind low walls and duck into cover; you shoot them down, rounds and health on the way', async () => {
    await designGameHandler({ quick: { goal: 'shoot', foes: 2, world: { id: 'gunfight', style: { kit: 'trail-valley' } } }, ref: 's2' });
    const L = stored('s2-level-run-0');
    expect(mechanicsOf('s2-level-run-0')).toEqual(['fail-on-death', 'supplies', 'defeat-all']);
    expect(L.camera).toMatchObject({ rule: 'eye', mouseLook: true });
    expect(L.entities[0]).toMatchObject({ id: 'player', body: { hittable: true }, weapon: { magazine: 12, reserve: 36 } });
    expect(L.blocks.filter((b) => b.form === 'wall').length).toBe(2 * 2 + 2);   // cover by each foe, a blind wall on each approach
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('s2-level-run-0'));
    expect(payload.colliders.filter((c) => c.of.startsWith('block:')).length).toBeGreaterThan(8);
    expect(payload.entities.filter((e) => e.id.startsWith('dec_sp_')).length).toBe(2);
    // on the stage's own ground (sight over a low wall is a matter of heights)
    const land = stageEnds(L).ground, ground = (q) => land(q[0], q[1]) ?? 0;
    const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders }, { ground }), W = sim.world, P = W.byId[W.pilotId], v = sim.bus.vars;
    // you come within 15 m of the first foe, somewhere in front of it with a clear line
    const f1 = W.byId['foe-1'], q0 = f1.transform.pos, E = composeLive();
    const spot = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9].map((da) => { const a = f1.transform.heading + da, x = q0[0] + Math.cos(a) * 15, y = q0[1] + Math.sin(a) * 15; return [x, y, ground([x, y]) + 1.7]; })
      .find((p) => !E.sightBlocked([p[0], p[1], p[2] - 0.4], [q0[0], q0[1], q0[2] + 1.3], payload.colliders));
    P.transform.pos = spot;
    // standing in its sight, holding fire: it fires, and you are hit
    sim.run(4);
    expect(v.hp).toBeLessThan(100);
    // you aim and work the trigger: it is hit, breaks for cover, comes back out after you, and goes down
    let covered = false;
    for (let n = 0; n < 30 * 12 && !f1.downed; n++) {
      const q = f1.transform.pos, d = Math.hypot(q[0] - P.transform.pos[0], q[1] - P.transform.pos[1]);
      P.transform.heading = Math.atan2(q[1] - P.transform.pos[1], q[0] - P.transform.pos[0]);
      P.transform.pitch = Math.atan2(q[2] + 1.5 - P.transform.pos[2], d);
      sim.input.fire = n % 2;
      sim.frame(1 / 30);
      covered ||= !!f1.coverAt;
    }
    sim.frame(1 / 30);   // its fall is the cast's fact, said the frame after
    expect(covered).toBe(true);
    expect(f1.downed).toBe(true);
    expect(v.__downs_2).toBe(1);
    expect(P.weapon.ammo + P.weapon.reserve).toBeLessThan(48);
    // the rounds on the way: walking over them, the reserve grows
    const before = P.weapon.reserve, drop = stored('s2-level-run-0').game.mechanics[1].drops[0];
    expect(drop.gives).toBe('ammo');
    sim.input.fire = 0;
    P.transform.pos = [drop.at[0], drop.at[1], P.transform.pos[2]];
    sim.run(0.3);
    expect(P.weapon.reserve).toBe(before + 24);
  }, 240_000);

  it('says what is wrong', () => {
    expect(() => readQuick({ goal: 'win' })).toThrow(/goal is one of reach/);
    expect(() => readQuick({ goal: 'reach', pickup: 'coin' })).toThrow(/pickup belongs to the collect goal/);
    expect(() => readQuick({ goal: 'reach', hero: 'tall' })).toThrow(/hero is a hero-door spec/);
    expect(() => readQuick({ goal: 'avoid', building: { use: 'tavern' } })).toThrow(/no hazards/);
    expect(() => readQuick({ goal: 'reach', climb: true, building: { use: 'tavern' } })).toThrow(/not a climb/);
    expect(() => readQuick({ goal: 'reach', guards: 2 })).toThrow(/guards belongs to the sneak goal/);
    expect(() => readQuick({ goal: 'sneak', guards: 12 })).toThrow(/1 to 8/);
    expect(() => readQuick({ goal: 'race', building: { use: 'tavern' } })).toThrow(/runs a trail/);
    expect(() => readQuick({ goal: 'reach', music: 'polka' })).toThrow(/music is 'auto'/);
    expect(() => readQuick({ goal: 'reach', misses: 3 })).toThrow(/misses belongs to the rhythm goal/);
    expect(() => readQuick({ goal: 'reach', sfx: 'kazoo' })).toThrow(/sfx is 'auto'.*arcade, foley, orchestral, synth/);
    expect(() => readQuick({ goal: 'rhythm', music: 'chapel' })).toThrow(/steady beat/);
    expect(() => readQuick({ goal: 'race', ride: 'tank' })).toThrow(/ride is one of car/);
    expect(() => readQuick({ goal: 'race', ride: 'car', hero: { cast: 'male' } })).toThrow(/the ride is the hero/);
    expect(() => readQuick({ goal: 'reach', rivals: 2 })).toThrow(/rivals belongs to the race goal/);
    expect(() => readQuick({ goal: 'race', rivals: 3 })).toThrow(/name a ride/);
    expect(() => readQuick({ goal: 'race', ride: 'car', rivals: 9 })).toThrow(/1 to 7/);
    expect(() => readQuick({ goal: 'race', track: 'oval' })).toThrow(/trail \(end to end\) or loop/);
    expect(() => readQuick({ goal: 'race', track: 'trail', laps: 3 })).toThrow(/run once/);
    expect(() => readQuick({ goal: 'race', ride: 'car', rivals: 2, climb: true })).toThrow(/no climb/);
    expect(() => readQuick({ goal: 'shoot', camera: 'top-down' })).toThrow(/first-person or third-person/);
    expect(() => readQuick({ goal: 'shoot', foes: 9 })).toThrow(/foes is 1 to 8/);
    expect(() => readQuick({ goal: 'reach', foes: 2 })).toThrow(/battle and shoot goals/);
  });
});
