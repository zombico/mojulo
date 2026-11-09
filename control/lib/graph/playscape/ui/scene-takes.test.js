import { describe, it, expect } from 'vitest';
import { sceneTakes, takesAdvice, TAKE_BUDGET, TAKES_PAGE } from './scene-takes.js';
import { lowerPlay } from './direction.js';
import { sceneScript, sceneTakesOn } from '../../scene/channels/scene-channel.js';
import { controllableChannelScript } from '../../scene/channels/controllable/index.js';
import { lowerScript } from './scene-script.js';
import { laws } from '../../actor/readings.js';
import { takeOf } from '../../persona/read.js';

// A SCENE'S TAKES: each actor of a page's scripts plays its face's take and its body's act on the script's clock, keyed
// by the clip its lines name; blocked on the very stage the page lowers the beats on, so the takes keep the lines' clock.
// The page plays them only where a figure carries one (none: not a byte of it). The whole path, a realistic hero's face
// on the page in Chrome, is scene-takes.live.test.js.
const fig = (id, at, heading) => ({ id, rule: { type: id === 'hero' ? 'walk' : 'static' }, transform: { pos: at, heading }, body: { type: 'figure-rig', figure: id } });
const ENTITIES = [fig('hero', [0, -6, 0], Math.PI / 2), fig('mayor', [6, 0, 0], Math.PI), { id: 'crate', transform: { pos: [2, 2, 0] }, body: { type: 'mesh', shape: 'box', size: [1, 1, 1] } }];
const SCRIPT = 'MAYOR: The road is *shut*.\nHERO (worried): Since when?\nMayor crosses to gate.\nMAYOR: Since the bell stopped.';
const manifest = (beats) => ({ entities: ENTITIES, play: { spots: [{ id: 'gate', at: [9, 4] }], scenes: [{ id: 'warning', when: { start: true }, beats }] } });

describe('the takes of a page\'s scripts', () => {
  it('each figure in a script plays its take under the clip its lines name, on the clock they were cut at', () => {
    const M = manifest([{ script: SCRIPT }, { choose: { options: [{ say: 'Go', beats: [{ script: 'HERO: Then I go.' }] }, { say: 'Stay' }] } }]);
    const T = sceneTakes(M, { player: 'hero' });
    expect(Object.keys(T).sort()).toEqual(['hero', 'mayor']);               // the crate plays in no script
    expect(Object.keys(T.hero)).toEqual(['scene:warning:0', 'scene:warning:1']);
    expect(Object.keys(T.mayor)).toEqual(['scene:warning:0']);              // not in the second script
    const lines = lowerPlay(M, { player: 'hero' }).scenes[0].beats.filter((b) => b.kind === 'line').map((b) => b.take);
    for (const L of lines) {
      const { perform, act } = T.hero[L.clip];
      expect(act.seconds).toBe(L.of);                                        // one clock: the takes' and the lines'
      expect(perform.seconds).toBe(L.of);
    }
    // the listener acts too: its face listening, its root and its body on the scene's clock
    const A = T.mayor['scene:warning:0'].act;
    expect(A.root.length).toBeGreaterThan(1);                               // the mayor's cross
    expect(T.mayor['scene:warning:0'].perform.beats.some((b) => b.state === 'listening')).toBe(true);
  });

  it('the actor\'s readings hold on a take blocked in the level: the listener regards the speaker, its face alive (law 5)', () => {
    const people = { hero: { at: [0, -6, 0], heading: Math.PI / 2 }, mayor: { at: [6, 0, 0], heading: Math.PI } };
    const L = lowerScript('MAYOR: The road is *shut*, and it has been since the spring.\nHERO: Since when?\nMAYOR: Since the bell stopped ringing at the gate.', { people, places: {}, player: 'hero' });
    for (const w of ['hero', 'mayor']) {
      const A = L.scene.actors[w], R = laws({ read: A.read, take: takeOf(A.read), listens: A.listens }).listening.reads;
      expect(R.regard).toBeGreaterThan(0.9);
      expect(R.listeningState).toBeGreaterThan(0);
    }
  });

  it('deterministic; none without a script', () => {
    const M = manifest([{ script: SCRIPT }]);
    expect(sceneTakes(M, { player: 'hero' })).toEqual(sceneTakes(M, { player: 'hero' }));
    expect(sceneTakes(manifest([{ line: { who: 'mayor', say: 'Hi.' } }]), { player: 'hero' })).toBeNull();
    expect(sceneTakes({ entities: ENTITIES }, { player: 'hero' })).toBeNull();
  });

  it('the page plays takes only where a figure carries one: absent, not a byte', () => {
    const ev = lowerPlay(manifest([{ script: SCRIPT }]), { player: 'hero' });
    expect(sceneTakesOn(ev.scenes)).toBe(true);
    expect(sceneTakesOn(lowerPlay(manifest([{ line: { who: 'mayor', say: 'Hi.' } }]), { player: 'hero' }).scenes)).toBe(false);
    expect(sceneScript({ takes: true })).toMatch(/world\.take = __tk/);
    expect(sceneScript()).toBe(sceneScript({ takes: false }));
    expect(sceneScript()).not.toMatch(/world\.take/);
    const rig = (clips) => ({ rig: true, bones: [{ id: 'root', head: [0, 0, 0] }], parts: [], clips });
    const plain = controllableChannelScript(ENTITIES.slice(0, 2), { rule: 'follow', target: 'hero' }, { hero: rig({ idle: { k: 1, b: [] } }), mayor: rig({ idle: { k: 1, b: [] } }) });
    const taking = controllableChannelScript(ENTITIES.slice(0, 2), { rule: 'follow', target: 'hero' }, { hero: rig({ idle: { k: 1, b: [] }, 'scene:warning:0': { k: 2, b: [], once: true } }), mayor: rig({ idle: { k: 1, b: [] } }) });
    expect(plain).not.toMatch(/__world\.take/);
    expect(taking).toMatch(/const tk = __world\.take && !e\.moving && fig\.clips\[__world\.take\.clip\]/);
  });

  it('a page whose takes run over their budget is advised, never refused', () => {
    expect(takesAdvice({ bytes: 300_000, seconds: 10, actors: 2 })).toBeNull();
    expect(takesAdvice({ bytes: TAKE_BUDGET * 10 * 2 + 1000, seconds: 10, actors: 2 })).toMatch(/kB a scene-second an actor/);
    expect(takesAdvice({ bytes: TAKES_PAGE + 1, seconds: 200, actors: 2 })).toMatch(/shorten the scripts/);
  });
});
