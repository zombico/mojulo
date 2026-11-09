import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, syncToCtrl } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { lowerPlay } from './direction.js';
import { sceneCues, readScenes } from './scenes.js';
import { buildSceneRunner } from './scene-runner.js';
import { lowerScript, withScripts, HERO_APART } from './scene-script.js';
import { actScene } from '../../actor/scene.js';
import { sceneCuts, coverScene } from '../../actor/coverage.js';

// SCREENPLAY SCENES IN A LEVEL: a scene's beats written as a screenplay, blocked by the actor on the level's own places
// and covered by the director's rules, lowered at build into the beats the scene runner plays. Played here as the page
// plays it, in node: the world steps, the bus settles, the cast's ops come down, the runner answers.
const CW = composeLive(), R = buildSceneRunner();
const DT = 1 / 30;
const ENTITIES = [
  { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0], heading: Math.PI / 2 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'mayor', rule: { type: 'static' }, transform: { pos: [6, 0, 0], heading: Math.PI }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
];
const SPOTS = [{ id: 'gate', at: [9, 4] }];
const PEOPLE = { hero: { at: [0, -6, 0], heading: Math.PI / 2 }, mayor: { at: [6, 0, 0], heading: Math.PI } };
const PLACES = { gate: [9, 4, 0] };
const SCRIPT = `MAYOR: The road is *shut*.
HERO (worried): Since when?
Mayor crosses to gate.
MAYOR: Since the bell [pause] stopped.
Hero turns to Mayor.
HERO: Then I wait.`;

function level(scenes) {
  const manifest = { entities: ENTITIES, play: { spots: SPOTS, scenes } };
  const ev = lowerPlay(manifest, { player: 'hero' });
  const world = CW.createWorld({ entities: ENTITIES.map((e) => JSON.parse(JSON.stringify(e))), camera: { rule: 'follow', target: 'hero' } });
  const bus = createBusState(ev, []), S = R.create(ev.scenes);
  const playerCam = world.camera.rule;
  let prev, seen = 0;
  const settle = (evs) => { if (evs.length) processEvents(bus, evs); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  const down = () => syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops));
  const tick = (ctl = {}) => {
    CW.stepWorld(world, {}, DT);
    const f = CW.castFacts(world, prev); prev = f.prev;
    settle(f.events);
    down();
    R.hear(S, bus.log.slice(seen).map((x) => x && x.type)); seen = bus.log.length;
    const o = R.step(S, DT, { ...ctl, vars: bus.vars });
    if (o.fire.length) { settle(o.fire.map((type) => ({ type }))); down(); }
    if (o.ops.length) CW.castOps(world, o.ops);
    return o;
  };
  const begin = () => { settle(ev.initial || []); return tick(); };
  const until = (pred, n = 900, ctl) => { for (let i = 0; i < n; i++) { if (pred()) return true; tick(ctl); } return pred(); };
  return { ev, world, bus, S, begin, tick, until, playerCam, view: () => R.view(S), fired: (t) => bus.log.filter((x) => x && x.type === t).length };
}
const kinds = (beats) => beats.map((b) => Object.keys(b).find((k) => k !== 'for'));

describe('a script, lowered', () => {
  it('the coverage\'s cuts are its shots, one for one and on their side; its lines in order, in words; its cross ends on its mark', () => {
    const L = lowerScript(SCRIPT, { people: PEOPLE, places: PLACES, player: 'hero' });
    expect(L.cast).toEqual(['mayor', 'hero']);
    const shots = L.beats.filter((b) => b.shot).map((b) => b.shot);
    expect(shots.map((s) => [s.frame, s.on, s.side])).toEqual(L.cuts.map((c) => [c.frame, c.on, c.side]));
    expect(shots[0].frame).toBe('wide');                                    // establish first
    for (const s of shots.filter((x) => x.frame === 'close')) expect(s.lookH).toBe(1.52);
    expect(L.beats.filter((b) => b.line).map(({ line: { take: _, ...l } }) => l)).toEqual([
      { who: 'mayor', say: 'The road is shut.' },
      { who: 'hero', say: 'Since when?', expression: 'worried' },
      { who: 'mayor', say: 'Since the bell stopped.' },
      { who: 'hero', say: 'Then I wait.' },
    ]);
    // the cross: walked at the actor's pace to the level's own place, the scene waiting on it (or on the walk stuck)
    const k = L.beats.findIndex((b) => b.do?.walk?.to === 'gate');
    expect(L.beats[k].do.walk).toEqual({ who: 'mayor', to: 'gate', then: 'stay', speed: 1.05 });
    expect(L.beats[k + 1]).toEqual({ until: [{ arrive: 'mayor' }, { stuck: 'mayor' }] });
    // a cut at a line's end comes after that line: the opening wide holds through the first, as the coverage holds it
    expect(kinds(L.beats).slice(0, 6)).toEqual(['shot', 'do', 'until', 'do', 'line', 'shot']);
    // every body handed back at the end
    expect(L.beats.at(-1)).toEqual({ do: [{ stop: 'mayor' }, { stop: 'hero' }] });
  });

  it('the player\'s mark is a conversation from whom it meets, toward where it comes from; everyone turned as the blocking opens', () => {
    const L = lowerScript(SCRIPT, { people: PEOPLE, places: PLACES, player: 'hero' });
    const walk = L.beats[1].do.walk, d = Math.hypot(walk.to[0] - 6, walk.to[1] - 0);
    expect(walk.who).toBe('hero');
    expect(d).toBeCloseTo(HERO_APART, 2);
    expect(walk.to[1]).toBeLessThan(0);                                    // the side the hero came from
    // the blocking the coverage was framed from is the one the page is set to: each faces as the scene's first key
    const S = L.scene;
    expect(walk.face).toBeCloseTo(90 - S.actors.hero.root[0].yaw, 2);
    expect(L.beats[3].do[0].walk).toMatchObject({ who: 'mayor', to: [6, 0], face: expect.closeTo(90 - S.actors.mayor.root[0].yaw, 2) });
  });

  it('is the cinematics department\'s own coverage: the cuts are coverScene\'s shots', () => {
    const L = lowerScript(SCRIPT, { people: PEOPLE, places: PLACES, player: 'hero' });
    const C = coverScene(L.scene);
    expect(L.cuts.map((c) => [c.t, c.end])).toEqual(C.shots.map((s) => s.span));
    expect(sceneCuts(actScene({ cast: { a: {}, b: {} }, script: 'A: Hi.\nB: Hello.' })).map((c) => c.frame)[0]).toBe('wide');
  });

  it('deterministic; the seed moves the takes, never the blocking or the coverage', () => {
    const a = lowerScript(SCRIPT, { people: PEOPLE, places: PLACES, player: 'hero' });
    expect(lowerScript(SCRIPT, { people: PEOPLE, places: PLACES, player: 'hero' }).beats).toEqual(a.beats);
    expect(lowerScript(SCRIPT, { people: PEOPLE, places: PLACES, player: 'hero', seed: 9 }).beats).toEqual(a.beats);
  });

  it('teaches: a name the page lacks, a mark it lacks, a line too long for the box', () => {
    const go = (script) => () => lowerScript(script, { people: PEOPLE, places: PLACES, player: 'hero' });
    expect(go('GUARD: Halt.')).toThrow(/'GUARD' is not in the cast \(hero, mayor\)/);
    expect(go('Mayor crosses to well.')).toThrow(/'well' is neither in the cast .* nor a mark \(gate\)/);
    expect(go(`MAYOR: ${'word '.repeat(90)}`)).toThrow(/MAYOR's line is \d+ characters; the box holds 400/);
    expect(() => readScenes({ scenes: [{ id: 'x', when: { start: true }, beats: [{ script: '' }] }] })).toThrow(/script is a screenplay/);
  });

  it('a play with no script is the same object; a script inside a choice is lowered there', () => {
    const plain = { scenes: [{ id: 'x', when: { start: true }, beats: [{ line: { who: 'mayor', say: 'Hi.' } }] }] };
    expect(withScripts(plain, { people: PEOPLE, places: PLACES, player: 'hero' })).toBe(plain);
    const chose = withScripts({ scenes: [{ id: 'x', when: { start: true }, beats: [{ choose: { options: [{ say: 'Yes', beats: [{ script: 'MAYOR: Good.' }] }, { say: 'No' }] } }] }] }, { people: PEOPLE, places: PLACES, player: 'hero' });
    expect(chose.scenes[0].beats[0].choose.options[0].beats.find((b) => b.line).line).toMatchObject({ who: 'mayor', say: 'Good.' });
    // an unlowered script never reaches the runner unsaid
    expect(() => sceneCues({ scenes: [{ id: 'x', when: { start: true }, beats: [{ script: 'MAYOR: Hi.' }] }] })).toThrow(/is a script, which is lowered on the page's characters and places first/);
  });

  it('a walk the level stops still lets the scene go on: either its arrive or its stuck', () => {
    const play = withScripts({ scenes: [{ id: 'x', when: { start: true }, beats: [{ script: SCRIPT }] }] }, { people: PEOPLE, places: PLACES, player: 'hero' });
    const cues = sceneCues(play).filter((c) => c.then.emit?.startsWith('scene-heard:x:'));
    const heard = Object.groupBy(cues, (c) => c.then.emit);
    for (const list of Object.values(heard)) expect(list.map((c) => Object.keys(c.when)[0]).sort()).toEqual(['arrive', 'stuck']);
  });
});

describe('the line clock and the press', () => {
  it('each line carries its take: its span on the scene\'s clock, from its words\' start, never into the next line\'s', () => {
    const L = lowerScript(SCRIPT, { people: PEOPLE, places: PLACES, player: 'hero' });
    const takes = L.beats.filter((b) => b.line).map((b) => b.line.take);
    expect(takes.map((t) => t.at)).toEqual(L.scene.turns.map((T) => T.at));
    takes.forEach((t, k) => {
      expect(t.end).toBeGreaterThan(t.at);
      expect(t.end).toBeGreaterThanOrEqual(L.scene.turns[k].end);            // the words are in it
      if (takes[k + 1]) expect(t.end).toBeLessThanOrEqual(takes[k + 1].at);  // never into the next
    });
    // read as a scene's line, and carried to the runner's program
    const P = lowerPlay({ entities: ENTITIES, play: { spots: SPOTS, scenes: [{ id: 's', when: { start: true }, beats: [{ script: SCRIPT }] }] } }, { player: 'hero' }).scenes[0];
    expect(P.beats.filter((b) => b.kind === 'line').map((b) => b.take)).toEqual(takes);
    expect(() => readScenes({ scenes: [{ id: 'x', when: { start: true }, beats: [{ line: { who: 'a', take: { at: 2, end: 1 } } }] }] })).toThrow(/take is \{ at, end \}/);
  });

  // the scene played to its first line; then each line's take read off the runner's view
  const SCENE = { id: 'clock', when: { start: true }, beats: [{ script: 'MAYOR: The road is *shut*, and it has been shut since spring.\nHERO: Since when?\nMAYOR: Since the bell stopped.' }] };
  const toLine = (L) => { L.begin(); expect(L.until(() => !!L.view().line)).toBe(true); return L; };
  const take = (L) => L.view().line.take;

  it('a press shows the words and the take plays on; the next press goes on, and the next take starts at its own start', () => {
    const L = toLine(level([SCENE])), T = L.ev.scenes[0].beats.filter((b) => b.kind === 'line').map((b) => b.take);
    expect(take(L).t).toBeCloseTo(T[0].at, 1);
    L.tick({ next: true });                                                   // the words whole at once
    expect(L.view().line.full).toBe(true);
    expect(take(L).held).toBe(false);                                         // the take still playing
    L.tick(); L.tick();
    expect(take(L).t).toBeGreaterThan(T[0].at);
    L.tick({ next: true });                                                   // on, early
    expect(L.view().line.text).toBe('');
    expect(take(L).t).toBeCloseTo(T[1].at, 1);                                // its own start, not where the first was cut
  });

  it('left alone, a line\'s take plays out and holds at its end until the press; however long, the next starts at its own start', () => {
    const L = toLine(level([SCENE])), T = L.ev.scenes[0].beats.filter((b) => b.kind === 'line').map((b) => b.take);
    for (let i = 0; i < Math.ceil((T[0].end - T[0].at + 3) * 30); i++) L.tick();
    expect(take(L)).toEqual({ t: T[0].end, held: true });                     // held, not drifting on
    expect(L.view().line.full).toBe(true);
    L.tick({ next: true });
    expect(take(L).t).toBeCloseTo(T[1].at, 1);
    // a held line and a hurried one land the same next line on the same clock
    const H = toLine(level([SCENE]));
    H.tick({ next: true }); H.tick({ next: true });
    expect(take(H).t).toBeCloseTo(take(L).t, 2);
  });

  it('a skip lands it all the same; a choice\'s question carries no take', () => {
    const L = toLine(level([SCENE]));
    L.tick({ skip: true });
    expect(L.view()).toMatchObject({ on: false, line: null });
    const C = level([{ id: 'ask', when: { start: true }, beats: [{ script: 'MAYOR: Will you go?' }, { choose: { options: [{ say: 'Yes' }, { say: 'No' }] } }] }]);
    toLine(C);
    C.tick({ next: true }); C.tick({ next: true });
    expect(C.until(() => !!C.view().choice)).toBe(true);
    expect(C.view().line.text).toBe('Will you go?');                         // the question stays in the box
    expect(C.view().line.take).toBeUndefined();
  });
});

describe('a script played in the level', () => {
  const SCENE = { id: 'warning', when: { start: true }, names: { mayor: 'Mayor Ilse' }, beats: [{ script: SCRIPT }] };

  it('the hero walks to its mark, the coverage directs the camera, the lines go by on presses, the mayor crosses, and every body and the camera come back', () => {
    const L = level([SCENE]);
    expect(L.begin().started).toEqual(['warning']);
    expect(L.world.camera.rule).toMatchObject({ type: 'shot', frame: 'wide', on: ['mayor', 'hero'], side: -1 });
    // the hero to its mark, a conversation from the mayor; then the first line, on the wide
    expect(L.until(() => !!L.view().line)).toBe(true);
    const h = L.world.byId.hero.transform.pos;
    expect(Math.hypot(h[0] - 6, h[1])).toBeCloseTo(HERO_APART, 0);
    expect(L.view().line).toMatchObject({ name: 'Mayor Ilse' });
    // each line: a press shows it whole, the next goes on (past the cross and the turns between)
    const said = [], framed = [];
    for (let n = 0; n < 4; n++) {
      expect(L.until(() => !!L.view().line)).toBe(true);
      framed.push(`${L.world.camera.rule.frame} ${L.world.camera.rule.on.join('/')}`);
      L.tick({ next: true });
      expect(L.view().line.full).toBe(true);
      said.push(L.view().line.text);
      L.tick({ next: true });
      L.until(() => !L.view().on || !!L.view().line);
    }
    expect(said).toEqual(['The road is shut.', 'Since when?', 'Since the bell stopped.', 'Then I wait.']);
    // the coverage on each line: the wide holds the first, close on the line with a face, over the shoulder after
    expect(framed).toEqual(['wide mayor/hero', 'close hero', 'over mayor/hero', 'over hero/mayor']);
    // the mayor crossed to the gate; the scene over, the hero is the player's again and the camera is its own
    const m = L.world.byId.mayor.transform.pos;
    expect(Math.hypot(m[0] - 9, m[1] - 4)).toBeLessThan(0.6);
    expect(L.view().on).toBe(false);
    expect(L.world.camera.rule).toBe(L.playerCam);
    expect(L.world.byId.hero.held).toBe(false);
    expect(L.world.byId.hero.route).toBeNull();
    expect(L.fired('scene-end:warning')).toBe(1);
  });

  it('a skip lands it: the cross finished, the hero handed back, the camera its own', () => {
    const L = level([SCENE]);
    L.begin();
    L.tick({ skip: true });
    expect(L.view().on).toBe(false);
    L.tick();
    const m = L.world.byId.mayor.transform.pos;
    expect([m[0], m[1]]).toEqual([9, 4]);
    expect(L.world.byId.hero.held).toBe(false);
    expect(L.world.camera.rule).toBe(L.playerCam);
  });
});
