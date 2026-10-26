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
import { HALDEN_REACH } from '@/lib/graph/gameworld/examples.js';
import { groundOf } from '@/lib/graph/playscape/terrain.js';

// The quick path: a simple LOOP (one level, one goal), never a simple picture: any hero the door draws, or none (first
// person); the goal placed on the stage's own anchors; the game made in one call, walkable and not proved beatable.
beforeEach(() => { closeDb(); });
const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;
const mechanicsOf = (ref) => stored(ref).game.mechanics.map((m) => m.kind);

// (a test of a genre's camera plays it on a screen on its side, where every camera is as authored: an upright screen
// reframes them by rule, gameworld/screen.test.js)
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
    // complete: the call that made the game asks how to share it; later readouts carry only what the host allows
    expect(out.share.ask).toMatch(/ask the operator/);
    expect(out.share.options.map((o) => o.id)).toEqual(['play', 'desktop', 'web', 'godot']);
    const again = await designGameHandler({ ref: 'q' }, { host: 'grok-chat' });
    expect(again.share).toBeUndefined();
    expect(again.next.find((n) => n.step === 'share')).toMatchObject({ can: { play: 'no', desktop: 'no', web: 'no', godot: 'no' }, card: 'gameworld-next' });
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

  it('a runner: a hero made and run down lanes, its page carrying the run, the game made', async () => {
    const out = await designGameHandler({ quick: { goal: 'runner', world: { id: 'dash' } }, ref: 'rn' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['hero', 'make'], ['level-run-0', 'make'], ['game', 'make']]);
    const L = stored('rn-level-run-0');
    expect(L.runner).toMatchObject({ seed: expect.any(Number) });
    expect(L.screen).toMatchObject({ pole: 'phone' });   // a new game is made for a phone
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('rn-level-run-0'));
    expect(payload.runner).toEqual(L.runner);
    const html = emitThreeWorld({ ...payload, inline: true });
    expect(html).toContain('function buildRunner(E)');
    expect(html).toContain('function __updateRunner(dt)');
    expect(html).toContain('swipe ← →');
    expect(stored('rn-game').levels.map((l) => l.ref)).toEqual(['rn-level-run-0']);
  }, 240_000);

  it('reach with a mascot on foot: minted through the creature door in the game\'s setting, piloted by its own body', async () => {
    const out = await designGameHandler({ quick: { goal: 'reach', hero: { mascot: { brief: 'a sonic-like mascot' } }, screen: 'screen', world: { id: 'zoom', style: { kit: 'isekai-meadow' } } }, ref: 'm' });
    expect(out.ran.map((r) => r.key)).toEqual(['hero', 'level-run-0', 'game']);
    const H = stored('m-hero');
    expect(H.plan.mascot).toMatchObject({ form: expect.any(String), height: expect.any(Number) });
    expect(H.plan.mascot.height).toBeLessThan(1.2);
    const L = stored('m-level-run-0');
    // its own clips play the runtime's states (no library), its capsule and its camera are its body's
    expect(L.figures.hero).toMatchObject({ heroRef: 'm-hero', clips: { forward: 'run', turn: 'walk', idle: 'idle', leap: 'leap', squat: 'squat' } });
    expect(L.figures.hero.library).toBeUndefined();
    expect(L.entities[0].rule.collideHeight).toBeCloseTo(H.plan.mascot.height, 2);
    // a mascot smaller than a person keeps a person's follow distance and stands small in the frame; the page's stand-off
    // shrinks with its capsule (egocube/mascot-pilot.js, controllable/follow-pull-in.js): the scaled-down camera put the eye in its head
    expect(L.camera.dist).toBe(5.5);
    expect(L.camera.lookH).toBeLessThan(1.1);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('m-level-run-0'));
    expect(Object.keys(payload.figures.hero.clips)).toEqual(expect.arrayContaining(['forward', 'turn', 'leap']));
    // a run again remakes nothing; a mascot made with create_character is adopted as the pilot by its ref
    expect((await designGameHandler({ ref: 'm' })).ran ?? []).toEqual([]);
    await designGameHandler({ quick: { goal: 'reach', hero: { ref: 'm-hero' }, world: { id: 'zoom2', style: { kit: 'isekai-meadow' } } }, ref: 'm2' });
    expect(stored('m2-level-run-0').figures.hero.clips.forward).toBe('run');
    expect(() => readQuick({ goal: 'reach', hero: { mascot: { colour: 'blue' } } })).toThrow(/hero\.mascot is true .* \{ brief\?, facets\?, seed\? \}/);
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

  it('fly in a palette: the world names a preset, its seed is rolled and stored, the land, sky and haze are the palette\'s', async () => {
    await designGameHandler({ quick: { goal: 'fly', craft: 'trainer', airspace: { map: { form: 'island', field: 2400 } }, world: { id: 'coast', style: { palette: { preset: 'coastal-noon' } } } }, ref: 'fp' });
    const L = stored('fp-level-run-0');
    expect(L.palette).toMatchObject({ preset: 'coastal-noon', seed: expect.any(Number) });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('fp-level-run-0'), { live: true });
    expect(payload.meta.ground.palette).toMatch(/^pal-/);
    expect(payload.haze.color).toBe(payload.bg);
  }, 240_000);

  it('contest and meet: a sport is one level, the arena in its stadium carrying the play and a hosted level\'s contract, the game in one call; the page runs the sport\'s channel', async () => {
    const out = await designGameHandler({ quick: { goal: 'contest', sport: 'tennis', players: 2, register: 'action', world: { id: 'centre-court', name: 'Centre Court' } }, ref: 'cc' });
    // each side an athlete, a character rolled in the game's setting and made through the hero door, in its own body
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['athlete', 'make'], ['athlete-2', 'make'], ['level-arena-court', 'make'], ['game', 'make']]);
    expect(stored('cc-athlete')).toMatchObject({ kind: 'layered', hero: { kit: { sport: 'tennis' } } });
    const L = stored('cc-level-arena-court');
    expect(L).toMatchObject({ kind: 'stadium', preset: 'centre-court', court: { sport: 'tennis', players: 2, register: 'action' }, game: { levelRef: 'court', produces: { results: ['success', 'fail'], events: [] } } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('cc-level-arena-court'), { live: true });
    expect(payload.court).toMatchObject({ sport: { id: 'tennis' }, players: 2, athletes: ['cc-athlete', 'cc-athlete-2'] }); expect(payload.court.C.shape).toBe('match');
    expect(Object.keys(payload.court.bodies).sort()).toEqual(['cc-athlete', 'cc-athlete-2']);
    expect(payload.court.bodies['cc-athlete'].parts.some((p) => p && p.pos)).toBe(true);
    const page = emitThreeWorld({ ...payload, inline: true });
    expect(page).toContain('const COURT_ARENA = '); expect(page).toContain('function placeAthlete(');
    const G = stored('cc-game');
    expect(G).toMatchObject({ title: 'Centre Court', shell: 'play' }); expect(G.levels.map((l) => l.ref)).toEqual(['cc-level-arena-court']);
    const meet = await designGameHandler({ quick: { goal: 'meet', event: 'hurdles', lanes: 3, players: 1, athletes: false, world: { id: 'hurdles' } }, ref: 'hd' });
    expect(meet.ran.map((r) => r.key)).toEqual(['level-arena-track', 'game']);
    expect(stored('hd-level-arena-track')).toMatchObject({ kind: 'stadium', meet: { event: 'hurdles', lanes: 3 }, game: { levelRef: 'track' } });
  }, 240_000);

  it('tabletop: a board game lifted into a hologram arena is one level and the game in one call; the page plays it on the holo channel', async () => {
    const out = await designGameHandler({ quick: { goal: 'tabletop', game: 'chess', players: 1, level: 'easy', world: { id: 'kaiba-dome', name: 'Kaiba Dome' } }, ref: 'kd' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['level-arena-arena', 'make'], ['game', 'make']]);
    expect(stored('kd-level-arena-arena')).toMatchObject({ kind: 'stage', holo: { game: 'chess', players: 1, level: 'easy' }, game: { levelRef: 'holo' } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('kd-level-arena-arena'), { live: true });
    expect(payload.holo).toMatchObject({ game: 'chess', players: 1, human: 'white' }); expect(payload.holo.L.cells.length).toBe(64);
    const page = emitThreeWorld({ ...payload, inline: true });
    expect(page).toContain('const HOLO_ARENA = '); expect(page).toContain('stepHolo = stepHoloArena');
    expect(stored('kd-game')).toMatchObject({ title: 'Kaiba Dome', shell: 'play' });
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
    // the craft's fight: missiles and flares, a boost, a roll; each foe carrying its own missiles
    expect(L.entities[0].rule).toMatchObject({ missiles: { count: 6 }, boost: { thrust: 2 }, roll: { side: 30 } });
    expect(L.entities.filter((e) => /^foe-/.test(e.id)).every((e) => e.rule.missiles && e.rule.missiles.count > 0)).toBe(true);
    // in waves: the wings asleep, the waves mechanic their terminal
    await designGameHandler({ quick: { goal: 'shoot', craft: 'fighter', foes: 2, waves: 3, world: { id: 'wv' } }, ref: 'wv' });
    const V = stored('wv-level-run-0');
    expect(mechanicsOf('wv-level-run-0')).toEqual(['fail-on-death', 'respawn', 'waves']);
    expect(V.game.mechanics.find((m) => m.kind === 'waves')).toMatchObject({ clear: true, waves: [{ foes: ['foe-1', 'foe-2'] }, { foes: ['foe-3', 'foe-4'] }, { foes: ['foe-5', 'foe-6'] }] });
    expect(V.entities.filter((e) => /^foe-/.test(e.id)).every((e) => e.dormant)).toBe(true);
  }, 240_000);

  it('shoot with a craft in a trench: the station its ground, the port its goal, turrets on the rims', async () => {
    await designGameHandler({ quick: { goal: 'shoot', craft: 'fighter', airspace: { space: { trench: true } }, world: { id: 'tr' } }, ref: 'tr' });
    const L = stored('tr-level-run-0');
    expect(L.entities.map((e) => e.id).filter((id) => /^foe-/.test(id))).toEqual(['foe-port']);
    expect(L.entities.some((e) => /^turret-/.test(e.id))).toBe(true);
    expect(L.game.mechanics.find((m) => m.kind === 'defeat-all')).toMatchObject({ who: 'foe-*', count: 1 });
    expect(L.entities[0].rule.roofs).toHaveLength(1);
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
    // (two guards, each a roll of its own in the game's setting: gameworld/cast-setting.js)
    expect(out.ran.map((r) => r.key)).toEqual(['guard', 'guard-2', 'level-run-0', 'game']);
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

  it('moves: the hero is made with its own hit, stagger, fall and rise, and the page plays them over the library\'s', async () => {
    const out = await designGameHandler({ quick: { goal: 'reach', hero: { cast: 'female' }, moves: true, world: { id: 'oof', style: { kit: 'trail-valley' } } }, ref: 'mv' });
    expect(out.ran.map((r) => r.key)).toEqual(['hero', 'level-run-0', 'game']);
    const L = stored('mv-level-run-0');
    expect(L.figures.hero.moves).toEqual({ stagger: 'stagger', topple: 'knockedOutDown', getup: 'knockedOutUp' });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('mv-level-run-0'));
    const clips = payload.figures.hero.clips;
    // each combat state is the hero's own clip, the very one it was made with (not the library's)
    for (const [state, own] of Object.entries(L.figures.hero.moves)) expect(clips[state], state).toBe(clips[own]);
    expect(clips.knockedOutDown).toBeTruthy();
  }, 600_000);

  it('a beast foe: the battle\'s wolf made through the animal door, standing on its own gaits, taking a blow as a wolf', async () => {
    const out = await designGameHandler({ quick: { goal: 'battle', foes: 1, foe: { species: 'wolf' }, world: { id: 'den', style: { kit: 'trail-valley' } } }, ref: 'bf' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['foe', 'make'], ['level-run-0', 'make'], ['game', 'make']]);
    expect(stored('bf-foe')).toMatchObject({ kind: 'layered', species: 'wolf' });
    const L = stored('bf-level-run-0');
    expect(L.figures['foe-1']).toMatchObject({ heroRef: 'bf-foe', walker: true, moves: { stagger: 'flinch', topple: 'fall', getup: 'rise' } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('bf-level-run-0'));
    const clips = payload.figures['foe-1'].clips;
    for (const [state, own] of Object.entries(L.figures['foe-1'].moves)) expect(clips[state], state).toBe(clips[own]);
    expect(clips.forward).toBeTruthy();
    // a remake keeps the ref: the beast is made beside and moved in
    const again = await designGameHandler({ ref: 'bf', run: true, force: true });
    expect(again.ran.find((r) => r.key === 'foe').action).toMatch(/keep|remake/);
  }, 600_000);

  it('a cast beside you: a wolf familiar made from the cast row, woken at the start and keeping up with you', async () => {
    const out = await designGameHandler({ quick: { goal: 'reach', cast: { scale: 'hero', cast: { pet: { relation: 'familiar', body: 'beast', species: 'wolf' } } }, world: { id: 'tag', style: { kit: 'trail-valley' } } }, ref: 'w' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['casting', 'make'], ['cast-pet', 'make'], ['level-run-0', 'make'], ['game', 'make']]);
    expect(stored('w-cast-pet')).toMatchObject({ kind: 'layered', species: 'wolf' });
    const L = stored('w-level-run-0');
    expect(L.play.party).toEqual([{ who: 'pet' }]);
    expect(L.figures.pet).toMatchObject({ heroRef: 'w-cast-pet', walker: true });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('w-level-run-0'));
    const sim = simLevel({ entities: payload.entities, events: payload.events }), W = sim.world, pilot = W.byId[W.pilotId];
    sim.run(0.5);
    const pet = W.byId.pet;
    expect(pet.dormant).toBeFalsy();
    // the pilot walks on; the familiar keeps up (within its follow distance and a stride or two)
    pilot.transform.pos = [pilot.transform.pos[0] + 8, pilot.transform.pos[1], pilot.transform.pos[2]];
    sim.run(6);
    expect(Math.hypot(pet.transform.pos[0] - pilot.transform.pos[0], pet.transform.pos[1] - pilot.transform.pos[1])).toBeLessThan(5);
  }, 600_000);

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
    const out = await designGameHandler({ quick: { goal: 'race', racers, laps: 1, roadway: 'kart-oval', screen: 'screen', world: { id: 'cartoon', style: { kit: 'trail-valley' } } }, ref: 'cr' });
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
    const page = emitThreeWorld({ ...payload });
    expect(page).toMatch(/__updateRacerJuice/);
    expect(page).not.toMatch(/__rjLightsTick/);   // (a kart throws no light of its own)
  }, 240_000);
  it('a field of supercars at night in the rain: liveried, each on its own frame, the track lit by its lamps and wet', async () => {
    const out = await designGameHandler({ quick: { goal: 'race', supercars: 2, laps: 1, roadway: 'kart-oval', mood: 'night-rain', world: { id: 'gt', style: { kit: 'trail-valley' } } }, ref: 'sc' });
    expect(out.ran.map((r) => r.key)).toEqual(['level-run-0', 'game']);
    const L = stored('sc-level-run-0');
    expect(L).toMatchObject({ kind: 'roadway', mood: 'night-rain' });
    expect(L.figures.ride.supercar).toMatchObject({ mood: 'night-rain', surface: { paint: expect.stringMatching(/^#[0-9a-f]{6}$/) } });
    expect(L.figures.ride.supercar.surface.paint).not.toBe(L.figures['rival-1'].supercar.surface.paint);
    expect(L.entities[1].rule).toMatchObject({ type: 'racer', vehicle: 'sports', closed: true });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sc-level-run-0'));
    for (const k of ['ride', 'rival-1']) expect(payload.figures[k]).toMatchObject({ rig: true, live: expect.any(Object), juice: expect.any(Object) });
    expect(payload.sky.day).toBe(0);
    expect(payload.faces.some((f) => f.glow)).toBe(true);
    expect(payload.weather).toBeTruthy();
    const page = emitThreeWorld({ ...payload });
    expect(page).toMatch(/wet road: the sky and the lamps/);
    // the cars' own light: the headlamps' pool, the tail lamps' ribbons
    expect(payload.figures.ride.juice).toMatchObject({ beams: expect.any(Object), trails: expect.any(Object) });
    expect(page).toMatch(/__rjLightsTick/);
  }, 240_000);
  it('defend:foes in waves walk the trail to the base; a pad builds a sentry tower for gold, and it fells them', async () => {
    const out = await designGameHandler({ quick: { goal: 'defend', waves: 1, pads: 2, world: { id: 'hold', style: { kit: 'trail-valley' } } }, ref: 'd' });
    // (the foes a pool of three rolls, the two pads' archers two)
    expect(out.ran.map((r) => r.key)).toEqual(['foe', 'foe-2', 'foe-3', 'tower', 'tower-2', 'level-run-0', 'game']);
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

  it('defend on a board: a tower defence over the stage\'s spots, nobody minted, the level the board\'s to end', async () => {
    const out = await designGameHandler({ quick: { goal: 'defend', board: { gold: 60 }, waves: 2, lives: 7, world: { id: 'keep', style: { kit: 'trail-valley' } } }, ref: 'tdq' });
    expect(out.ran.map((r) => r.key)).toEqual(['level-run-0', 'game']);
    const L = stored('tdq-level-run-0');
    expect(L.board).toEqual({ td: { waves: 2, lives: 7, gold: 60 } });
    expect(mechanicsOf('tdq-level-run-0')).toEqual(['board']);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('tdq-level-run-0'));
    expect(payload.board.td).toMatchObject({ gold: 60, lives: 7 });
    expect(payload.board.td.waves).toHaveLength(2);
    expect(payload.board.camera).toMatchObject({ edge: true });
    expect(payload.walk).toBe(false);
    expect(payload.game.on['board-won']).toEqual({ end: 'success' });
    // what only a trail's defence takes, refused beside a board
    await expect(designGameHandler({ quick: { goal: 'defend', board: true, pads: 2, world: { id: 'keep2' } }, ref: 'tdx' })).rejects.toThrow(/pads is the trail's defence/);
    await expect(designGameHandler({ quick: { goal: 'reach', board: true, world: { id: 'keep3' } }, ref: 'tdy' })).rejects.toThrow(/board belongs to the defend goal/);
  }, 240_000);

  it('conquer: a real-time skirmish over the stage\'s spots, two bases and a purse, the level the board\'s to end', async () => {
    const out = await designGameHandler({ quick: { goal: 'conquer', board: { gold: 200 }, world: { id: 'field', style: { kit: 'trail-valley' } } }, ref: 'rtq' });
    expect(out.ran.map((r) => r.key)).toEqual(['level-run-0', 'game']);
    expect(stored('rtq-level-run-0').board).toEqual({ rts: { gold: 200 } });
    expect(mechanicsOf('rtq-level-run-0')).toEqual(['board']);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('rtq-level-run-0'));
    expect(payload.board.rts).toMatchObject({ gold: 200 });
    expect(payload.board.rts.bases.player).not.toBe(payload.board.rts.bases.enemy);
    expect(payload.board.camera).toMatchObject({ edge: true, rotate: false });
    expect(payload.game.on['board-won']).toEqual({ end: 'success' });
    await expect(designGameHandler({ quick: { goal: 'conquer', hero: false, world: { id: 'field2' } }, ref: 'rtx' })).rejects.toThrow(/conquer is a skirmish/);
    // a whole match: the board's skirmish read as one (its lobby on the page), the fog and the melee rule by default
    await designGameHandler({ quick: { goal: 'conquer', match: true, world: { id: 'field3', style: { kit: 'trail-valley' } } }, ref: 'rtm' });
    expect(stored('rtm-level-run-0').board).toEqual({ rts: { match: true } });
    const M = (await resolveWorldScene(SketchRepository.getByRef('rtm-level-run-0'))).payload.board.rts;
    expect([M.match.expansions >= 0, M.fog, M.victory]).toEqual([true, true, 'melee']);
    await expect(designGameHandler({ quick: { goal: 'reach', match: true, world: { id: 'field4' } }, ref: 'rty' })).rejects.toThrow(/match belongs to the conquer goal/);
  }, 240_000);

  it('conquer between two civilizations: the world\'s own by its id, another in words, each fielding what its technology crafts', async () => {
    const corps = HALDEN_REACH.civilizations['survey-corps'];
    await designGameHandler({ quick: { goal: 'conquer', doctrine: 'science', sides: ['survey-corps', 'armed attack helicopters, a bronze cannon, swords and crossbows, tracked ore haulers'], world: { id: 'reach', style: { kit: 'isekai-meadow' }, civilizations: { 'survey-corps': corps } } }, ref: 'civq' });
    expect(stored('civq-level-run-0').board.rts.doctrine).toEqual({ player: 'science' });
    await expect(designGameHandler({ quick: { goal: 'conquer', doctrine: 'chaos', world: { id: 'reach4' } }, ref: 'civz' })).rejects.toThrow(/doctrine 'chaos' is not a doctrine/);
    // the level keeps each side in its own words, not its roster
    const sides = stored('civq-level-run-0').board.rts.sides;
    expect(sides.player).toMatchObject({ civ: corps, kit: 'isekai-meadow', team: expect.stringMatching(/^#/) });
    expect(sides.enemy.civ.technology.vehicles).toEqual({ helicopter: 'armed attack helicopters' });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('civq-level-run-0'));
    const R = payload.board.rts.sides;
    expect([R.player.worker, R.player.research.tier2.at, R.enemy.units.helicopter.fly, R.enemy.units.cannon.siege]).toEqual(['hauler', 'mast', true, 3]);
    expect(Object.keys(R.player.looks)).toContain('walker');
    // what it cannot field, said
    await expect(designGameHandler({ quick: { goal: 'conquer', sides: ['grumpy neighbours'], world: { id: 'reach2' } }, ref: 'civx' })).rejects.toThrow(/neither a civilization of the world \(it keeps none\) nor words naming what one crafts/);
    await expect(designGameHandler({ quick: { goal: 'reach', sides: ['survey-corps'], world: { id: 'reach3' } }, ref: 'civy' })).rejects.toThrow(/sides belongs to the conquer goal/);
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

  it('deathmatch: an arena laid on the trail\'s land whose laws hold, bots that fight each other, frags to a limit', async () => {
    const out = await designGameHandler({ quick: { goal: 'deathmatch', bots: 3, frags: 3, world: { id: 'arena', style: { kit: 'trail-valley' } } }, ref: 'dm' });
    // every arena law holds: no advice from it
    expect(JSON.stringify(out)).not.toMatch(/arena: /);
    const L = stored('dm-level-run-0');
    expect(mechanicsOf('dm-level-run-0')).toEqual(['frags', 'supplies']);
    expect(L.camera).toMatchObject({ rule: 'eye', mouseLook: true });
    expect(L.entities.map((e) => e.id)).toEqual(['player', 'bot-1', 'bot-2', 'bot-3']);
    expect(L.entities[1].rule.mind.motivation).toBe('frag');
    const frags = L.game.mechanics[0];
    expect(frags).toMatchObject({ rivals: ['bot-1', 'bot-2', 'bot-3'], frags: 3 });
    expect(frags.spawns).toHaveLength(4);   // one for each in the match
    // the arena's walls are one collider each; the cover on the trail's beats stands aside for it
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('dm-level-run-0'));
    expect(payload.colliders.filter((c) => c.of.startsWith('block:')).length).toBe(L.blocks.length);
    expect(L.blocks.every((b) => b.whole)).toBe(true);
    // played headless with the player standing aside: the bots find each other and the match reaches its limit
    const land = stageEnds(L).ground;
    const ents = payload.entities.map((e) => (e.id === 'player' ? { ...e, body: { ...e.body, hittable: false } } : e));
    const sim = simLevel({ entities: ents, events: payload.events, colliders: payload.colliders }, { ground: (q) => land(q[0], q[1]) });
    let t = 0;
    for (; t < 150 && !sim.bus.vars.__frags_over_0; t += 1 / 30) sim.frame(1 / 30);
    expect(sim.bus.log.filter((r) => r.type === 'kill').length).toBeGreaterThanOrEqual(3);
    expect(sim.bus.log.map((r) => r.type)).toContain('frags:lost');
  }, 240_000);

  it('deathmatch on the shooter pole: realistic walks and peeks with a killing gun; stylized jumps, dashes, mends and has a kit', async () => {
    const out = {};
    for (const pole of ['realistic', 'stylized']) {
      await designGameHandler({ quick: { goal: 'deathmatch', bots: 3, frags: 3, pole, world: { id: `pole-${pole}`, style: { kit: 'trail-valley' } } }, ref: `pl-${pole}` });
      const L = stored(`pl-${pole}-level-run-0`), [player, bot] = L.entities;
      out[pole] = { L, player, bot, mechs: mechanicsOf(`pl-${pole}-level-run-0`) };
    }
    const R = out.realistic, S = out.stylized;
    expect(R.mechs).toEqual(['frags', 'supplies']);
    expect(S.mechs).toEqual(['frags', 'supplies', 'regen', 'abilities']);
    expect([R.player.rule.type, S.player.rule.type]).toEqual(['walk', 'platform']);
    expect(S.player.rule).toMatchObject({ airJumps: 1, dodge: true });
    expect(R.player.weapon.damage * 4).toBeGreaterThanOrEqual(R.bot.body.hp - 1);   // four rounds drop a body
    expect(S.bot.body.hp).toBe(200);
    expect([R.bot.rule.peek, S.bot.rule.peek]).toEqual([true, false]);
    expect(R.L.game.mechanics[0]).toMatchObject({ damage: true, hp: 100 });
    // played headless with the player aside: each reaches its limit, the realistic one on fewer rounds a kill
    const rounds = {};
    for (const pole of ['realistic', 'stylized']) {
      const { payload } = await resolveWorldScene(SketchRepository.getByRef(`pl-${pole}-level-run-0`));
      const land = stageEnds(out[pole].L).ground;
      const ents = payload.entities.map((e) => (e.id === 'player' ? { ...e, body: { ...e.body, hittable: false } } : e));
      const sim = simLevel({ entities: ents, events: payload.events, colliders: payload.colliders }, { ground: (q) => land(q[0], q[1]) });
      for (let t = 0; t < 180 && !sim.bus.vars.__frags_over_0; t += 1 / 30) sim.frame(1 / 30);
      const kills = sim.bus.log.filter((r) => r.type === 'kill').length, hits = ['bot-1', 'bot-2', 'bot-3'].reduce((n, id) => n + sim.bus.log.filter((r) => r.type === `hit:${id}`).length, 0);
      expect(kills, pole).toBeGreaterThanOrEqual(3);
      rounds[pole] = hits / kills;
    }
    expect(rounds.realistic).toBeLessThan(rounds.stylized);
  }, 300_000);

  it('deathmatch with weapons: the pole\'s guns laid where the arena serves them, picked up, fired', async () => {
    await designGameHandler({ quick: { goal: 'deathmatch', bots: 3, frags: 3, pole: 0.5, weapons: true, world: { id: 'guns', style: { kit: 'trail-valley' } } }, ref: 'gn' });
    expect(stored('gn').levels.run.arena.weapons).toEqual(['close', 'long', 'area']);
    const L = stored('gn-level-run-0'), [player, bot] = L.entities;
    const sup = L.game.mechanics.find((m) => m.kind === 'supplies'), guns = sup.drops.filter((d) => d.gives === 'weapon');
    expect(guns.length).toBeGreaterThan(0);
    expect(guns.every((d) => d.respawn === 30 && ['close', 'long', 'area'].includes(d.slot))).toBe(true);
    // the rifle in hand, a slot for each gun laid, to be picked up; the player on the rule that carries a loadout
    const slots = ['mid', ...new Set(guns.map((d) => d.slot))];
    for (const who of [player, bot]) {
      expect(who.rule.loadout.map((c) => c.name)).toEqual(slots);
      expect(who.rule.loadout.map((c) => c.held)).toEqual(slots.map((_, k) => (k ? false : undefined)));
    }
    expect(player.rule.type).toBe('platform');
    expect(bot.rule.items.filter((it) => it.gives === 'weapon').map((it) => it.slot).sort()).toEqual(guns.map((d) => d.slot).sort());
    // played headless with the player aside: the bots pick guns up and fire them
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('gn-level-run-0'));
    const land = stageEnds(L).ground;
    const ents = payload.entities.map((e) => (e.id === 'player' ? { ...e, body: { ...e.body, hittable: false } } : e));
    const sim = simLevel({ entities: ents, events: payload.events, colliders: payload.colliders }, { ground: (q) => land(q[0], q[1]) });
    let picked = 0;
    for (let t = 0; t < 120 && !sim.bus.vars.__frags_over_0; t += 1 / 30) {
      sim.frame(1 / 30);
      for (const id of ['bot-1', 'bot-2', 'bot-3']) { const b = sim.world.byId[id]; if ((b.loadoutIdx || 0) > 0 && b.lastShot && b.lastShot.t >= sim.world.time - 1 / 30 - 1e-6) picked++; }
    }
    expect(sim.bus.log.filter((r) => r.type === 'supply:weapon').length).toBeGreaterThan(0);
    expect(picked).toBeGreaterThan(0);   // rounds fired from a gun picked up
  }, 300_000);

  it('deathmatch with two sides: team bases, a side\'s frags; control: a point both sides go for', async () => {
    await designGameHandler({ quick: { goal: 'deathmatch', bots: 4, pole: 0.5, mode: 'control', world: { id: 'sides', style: { kit: 'trail-valley' } } }, ref: 'sd' });
    expect(stored('sd').levels.run.arena.teams).toBe(2);
    const L = stored('sd-level-run-0'), byId = Object.fromEntries(L.entities.map((e) => [e.id, e]));
    expect(['player', 'bot-1', 'bot-2', 'bot-3', 'bot-4'].map((id) => byId[id].team)).toEqual(['red', 'blue', 'red', 'blue', 'red']);
    const frags = L.game.mechanics.find((m) => m.kind === 'frags'), cp = L.game.mechanics.find((m) => m.kind === 'control');
    expect(frags.teams).toEqual({ red: ['player', 'bot-2', 'bot-4'], blue: ['bot-1', 'bot-3'] });
    expect(Object.keys(frags.spawns)).toEqual(['red', 'blue']);
    expect(cp).toMatchObject({ teams: frags.teams, hold: 60, radius: 4 });
    expect(byId['bot-1'].rule).toMatchObject({ clearLine: true, objective: { at: cp.at } });
    // each side starts at its own base
    const near = (id, side) => frags.spawns[side].some((q) => Math.hypot(q[0] - byId[id].transform.pos[0], q[1] - byId[id].transform.pos[1]) < 0.01);
    expect(['bot-1', 'bot-3'].every((id) => near(id, 'blue')) && ['bot-2', 'bot-4'].every((id) => near(id, 'red'))).toBe(true);
    // played headless with the player aside: both sides stand on the point, and one scores on it
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sd-level-run-0'));
    const land = stageEnds(L).ground;
    const ents = payload.entities.map((e) => (e.id === 'player' ? { ...e, body: { ...e.body, hittable: false } } : e));
    const sim = simLevel({ entities: ents, events: payload.events, colliders: payload.colliders }, { ground: (q) => land(q[0], q[1]) });
    const k = L.game.mechanics.indexOf(cp), on = { red: 0, blue: 0 };
    for (let t = 0; t < 60; t += 1 / 30) { sim.frame(1 / 30); for (const sd of ['red', 'blue']) if (sim.bus.vars[`__cpn_${k}_${sd}`] > 0) on[sd]++; }
    expect(on.red > 0 && on.blue > 0).toBe(true);
    expect(sim.bus.vars[`__cps_${k}_red`] + sim.bus.vars[`__cps_${k}_blue`]).toBeGreaterThan(0);
  }, 300_000);

  it('deathmatch with towers: high ground the bots climb, the armor on the tops', async () => {
    await designGameHandler({ quick: { goal: 'deathmatch', bots: 3, frags: 3, pole: 0.3, weapons: true, arena: 'a three-lane arena with towers', world: { id: 'towers', style: { kit: 'trail-valley' } } }, ref: 'tw' });
    const L = stored('tw-level-run-0'), bot = L.entities.find((e) => e.id === 'bot-1'), sup = L.game.mechanics.find((m) => m.kind === 'supplies');
    expect(bot.rule.floors).toHaveLength(2);
    const z0 = L.entities.find((e) => e.id === 'bot-2').transform.pos[2];
    expect(sup.drops.filter((d) => d.gives === 'armor').every((d) => Math.abs(d.at[2] - z0 - 2.5) < 0.01)).toBe(true);
    expect(bot.rule.floors.every((f) => bot.rule.perches.some((p) => Math.abs(p[2] - f.z) < 1e-6))).toBe(true);
    // played headless (the page's ground: the land and the tops of what stands on it): bots stand on the high ground
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('tw-level-run-0'));
    const land = stageEnds(L).ground, ground = (q) => groundOf(payload.colliders, land(q[0], q[1]))(q);
    const ents = payload.entities.map((e) => (e.id === 'player' ? { ...e, body: { ...e.body, hittable: false } } : e));
    const sim = simLevel({ entities: ents, events: payload.events, colliders: payload.colliders }, { ground });
    let up = 0;
    for (let t = 0; t < 90; t += 1 / 30) { sim.frame(1 / 30); for (const id of ['bot-1', 'bot-2', 'bot-3']) if (sim.world.byId[id].transform.pos[2] > z0 + 2) up++; }
    expect(up).toBeGreaterThan(0);
  }, 300_000);

  it('deathmatch over the shoulder: a hero played third-person, the camera off its right shoulder, its rounds converged', async () => {
    await designGameHandler({ quick: { goal: 'deathmatch', bots: 2, frags: 3, pole: 'stylized', hero: { cast: 'male' }, camera: 'third-person', screen: 'screen', world: { id: 'over', style: { kit: 'trail-valley' } } }, ref: 'ov' });
    const L = stored('ov-level-run-0');
    expect(L.camera).toMatchObject({ rule: 'follow', target: 'hero', dist: 2.8, shoulder: 0.75, lead: 10 });
    expect(L.entities[0].weapon.converge).toBe(true);
    // first person (the default) keeps the eye and the plain round
    await designGameHandler({ quick: { goal: 'deathmatch', bots: 2, frags: 3, pole: 'stylized', world: { id: 'eye', style: { kit: 'trail-valley' } } }, ref: 'ey' });
    expect(stored('ey-level-run-0').entities[0].weapon.converge).toBeUndefined();
  }, 300_000);

  it('deathmatch: the arena from its words (tunnel-arena.js), a word it cannot lay said as advice', async () => {
    const out = await designGameHandler({ quick: { goal: 'deathmatch', bots: 2, arena: 'a small ring arena with catwalks', world: { id: 'ring', style: { kit: 'trail-valley' } } }, ref: 'rg' });
    const L = stored('rg-level-run-0');
    expect(stored('rg').levels.run.arena).toEqual({ words: 'a small ring arena with catwalks', spawns: 3 });
    expect(L.game.mechanics[0].spawns).toHaveLength(3);
    // a ring: the court's walls round the middle; 26 m across
    const walls = L.blocks.filter((b) => b.form === 'wall');
    expect(Math.max(...walls.map((b) => b.length))).toBeCloseTo(26.6, 1);
    // catwalks are not laid yet: said, with what would close it; every other law holds
    const advice = JSON.stringify(out).match(/arena: [^"]*/g) ?? [];
    expect(advice).toHaveLength(1);
    expect(advice[0]).toMatch(/'catwalks' is not laid yet/);
  }, 240_000);

  it('fight: each fighter designed by the character loop (a sheet made into a character) or adopted, fought in its own body on an arena', async () => {
    const { heroRecord } = await import('./layered.js');
    SketchRepository.create({ ref: 'mira', title: 'Mira', manifest: { kind: 'layered', hero: heroRecord({ cast: 'female', palette: { Top: '#2a8f6a' } }) } });
    const quick = { goal: 'fight', roster: [{ id: 'kai', role: 'frontline', archetype: 'hero', facets: { motivation: 0.1 } }, { id: 'mira', hero: { ref: 'mira' }, style: 'rushdown' }], arenas: [{ id: 'plaza', kit: 'island-plaza' }], world: { id: 'duel' } };
    const out = await designGameHandler({ quick, ref: 'du' });
    expect(out.ran.map((r) => [r.key, r.action])).toEqual([['fighter-kai-sheet', 'make'], ['fighter-kai', 'make'], ['level-arena-plaza', 'make'], ['game', 'make']]);
    // the sheet is an egocube; the character it made records it
    expect(stored('du-fighter-kai-sheet')).toMatchObject({ kind: 'egocube', sheet: { facets: { role: 'frontline', archetype: 'hero' } } });
    expect(stored('du-fighter-kai')).toMatchObject({ kind: 'layered', hero: expect.any(Object), egocube: { ref: 'du-fighter-kai-sheet' } });
    expect(stored('du-game').roster).toEqual([{ id: 'kai', hero: { ref: 'du-fighter-kai' } }, { id: 'mira', hero: { ref: 'mira' }, style: 'rushdown' }]);
    // the readout: what the sheet chose for the fight and why, and each fighter's law stamp
    const [kai, mira] = out.fight.fighters;
    expect(kai).toMatchObject({ id: 'kai', character: 'du-fighter-kai', sheet: 'du-fighter-kai-sheet', laws: { held: expect.any(Number) } });
    expect(kai.reads.map((r) => r.word).filter(Boolean)).toEqual(expect.arrayContaining(['grappler', 'reversal']));
    expect(mira).not.toHaveProperty('sheet');
    // the arena fights them in their own bodies
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('du-level-arena-plaza'));
    const [K, M] = payload.versus.roster;
    expect(K).toMatchObject({ character: 'du-fighter-kai', archetype: 'grappler', name: 'The Hero' });
    expect(M).toMatchObject({ character: 'mira', archetype: 'rushdown', color: '#2a8f6a' });
    expect(Object.keys(payload.versus.bodies).sort()).toEqual(['du-fighter-kai', 'mira']);
    expect(payload.versus.bodies.mira.parts.some((p) => p && p.pos && p.col)).toBe(true);
    // a rerun keeps what did not move; the character edited by hand is left as it is
    const again = await designGameHandler({ ref: 'du', run: true });
    expect(again.ran.filter((r) => r.key.startsWith('fighter-')).map((r) => r.action)).toEqual(['keep', 'keep']);
    await expect(designGameHandler({ quick: { goal: 'fight', roster: [{ id: 'x', hero: { ref: 'ghost' } }], world: { id: 'nobody' } }, ref: 'nb' }))
      .rejects.toThrow(/roster\[0\]\.hero\.ref 'ghost' is not a stored character/);
  }, 480_000);

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
    expect(() => readQuick({ goal: 'reach', bots: 2 })).toThrow(/bots belongs to the deathmatch goal/);
    expect(() => readQuick({ goal: 'deathmatch', bots: 9 })).toThrow(/1 to 7/);
    expect(() => readQuick({ goal: 'deathmatch', frags: 0 })).toThrow(/frag limit/);
    expect(() => readQuick({ goal: 'deathmatch', seconds: 5 })).toThrow(/10 to 600|5 to 600/);
    expect(() => readQuick({ goal: 'deathmatch', building: { use: 'tavern' } })).toThrow(/arena on a trail/);
    expect(() => readQuick({ goal: 'shoot', arena: 'a ring' })).toThrow(/arena belongs to the deathmatch goal/);
    expect(() => readQuick({ goal: 'deathmatch', pole: 'arcade' })).toThrow(/pole is 'realistic', 'stylized'/);
    expect(() => readQuick({ goal: 'shoot', pole: 1 })).toThrow(/pole belongs to the deathmatch goal/);
    expect(() => readQuick({ goal: 'deathmatch', weapons: true })).toThrow(/weapons rides the shooter pole/);
    expect(() => readQuick({ goal: 'deathmatch', mode: 'ctf' })).toThrow(/mode is free-for-all, team, control/);
    expect(() => readQuick({ goal: 'shoot', mode: 'team' })).toThrow(/mode belongs to the deathmatch goal/);
    expect(() => readQuick({ goal: 'deathmatch', pole: 0, weapons: 'all' })).toThrow(/weapons: true/);
  });
});
