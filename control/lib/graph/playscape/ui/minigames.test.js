import { describe, it, expect } from 'vitest';
import { readMinigames, minigameCues, lowerMinigames, MINIGAMES, STALLS } from './minigames.js';
import { lowerPlay } from './direction.js';
import { createBusState, processEvents, watchEvents } from '../../worlds/event-bus.js';
import { eventsChannelScript } from '../../scene/channels/events.js';
import { minigameScript } from '../../scene/channels/minigame-channel.js';
import { ZONE } from '../../pixelizer/fishing-core.js';

const ENTITIES = [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
const SPOTS = [{ id: 'pond', at: [6, 2, 0] }, { id: 'cabinet', at: [-4, 3, 0] }];

function level(play) {
  const ev = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
  const bus = createBusState(ev, []);
  const fire = (type) => { processEvents(bus, [{ type }]); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  return { ev, bus, fire };
}

// the channel's own script, run headless: a DOM just big enough, keys and the frame's step
function page(play, vars = {}) {
  const { ev, bus } = level(play);
  Object.assign(bus.vars, vars);
  const el = () => ({ className: '', innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} });
  const keys = { keydown: [], keyup: [] };
  const document = { createElement: el, head: el(), body: el() };
  const window = { addEventListener: (k, f) => keys[k] && keys[k].push(f) };
  const queue = [];
  const api = new Function('document', 'window', '__busState', '__inputQueue', 'EVENTS', `${minigameScript(ev.minigames)}\nreturn __mini;`)(document, window, bus, queue, ev);
  let t = 0;
  const frames = (n = 1, dt = 50) => { for (let i = 0; i < n; i++) { t += dt; api.step(t); } };
  const key = (code, up = false) => { for (const f of keys[up ? 'keyup' : 'keydown']) f({ code, repeat: false, preventDefault() {}, stopImmediatePropagation() {} }); };
  return { api, bus, queue, frames, key, window, ev };
}

describe('play.minigames: read and lowered', () => {
  it('fills a game\'s defaults and teaches what it cannot read', () => {
    const [g] = readMinigames({ minigames: [{ id: 'pond', game: 'fishing', at: 'pond' }] });
    expect(g).toEqual({ id: 'pond', game: 'fishing', at: 'pond', prompt: MINIGAMES.fishing.prompt, title: 'Fishing', goal: MINIGAMES.fishing.goal, gold: MINIGAMES.fishing.gold });
    expect(readMinigames({ minigames: [{ id: 'a', game: 'blocks' }] })[0].time).toBe(90);
    expect(() => readMinigames({ minigames: [{ id: 'a', game: 'pinball' }] })).toThrow(/blocks, match, fishing/);
    expect(() => readMinigames({ minigames: [{ id: 'a', game: 'match', casts: 3 }] })).toThrow(/casts/);
    expect(() => readMinigames({ minigames: [{ id: 'a', game: 'fishing', prize: { n: 2 } }] })).toThrow(/prize/);
    expect(() => readMinigames({ minigames: [{ id: 'a', game: 'fishing' }, { id: 'a', game: 'match' }] })).toThrow(/twice/);
  });

  it('a place to play at: interact there starts it; the first win gives its prize and sets its flag, once', () => {
    const play = { spots: SPOTS, minigames: [{ id: 'pond', game: 'fishing', at: 'pond', prize: 'golden-lure', flag: 'angler' }, { id: 'derby', game: 'match' }] };
    const cues = minigameCues(play);
    expect(cues.find((c) => c.id === 'minigame-pond')).toEqual({ id: 'minigame-pond', when: { use: 'pond', prompt: 'fish' }, then: { emit: 'minigame:pond' } });
    // no place: started by whatever emits minigame:derby (a talk's answer)
    expect(cues.some((c) => c.id === 'minigame-derby')).toBe(false);
    const L = level(play);
    expect(L.ev.vars).toMatchObject({ gold: 0, 'minigame-best-pond': 0, 'minigame-last-derby': 0 });
    expect(L.ev.minigames.games.map((g) => g.id)).toEqual(['pond', 'derby']);
    expect(L.ev.minigames.games[0].seed).not.toBe(L.ev.minigames.games[1].seed);
    L.fire('minigame-won:pond');
    expect(L.bus.vars['held:bag:golden-lure']).toBe(1);
    expect(L.bus.log.some((e) => e.type === 'flag:angler')).toBe(true);
    L.fire('minigame-won:pond');
    expect(L.bus.vars['held:bag:golden-lure']).toBe(1);
  });

  it('a job\'s game: mowing takes a park\'s lawn and its time; its place starts it only while its if holds, else says why', () => {
    const LAWN = { rows: ['..T.', '====', '.*..'], start: [3.5, 1.5, Math.PI] };
    const play = { minigames: [{ id: 'grounds', game: 'mowing', at: { at: [6, 2], r: 3 }, lawn: LAWN, time: 60, gold: 0, if: { var: 'flag-took-grounds', gte: 1 }, locked: 'Take the job first' }] };
    const [g] = readMinigames(play);
    expect(g).toMatchObject({ game: 'mowing', title: 'Mowing', goal: MINIGAMES.mowing.goal, lawn: LAWN, time: 60 });
    expect(minigameCues(play)[0]).toEqual({ id: 'minigame-grounds', when: { use: { at: [6, 2], r: 3 }, prompt: 'mow the lawn' }, then: { emit: 'minigame:grounds' }, if: { var: 'flag-took-grounds', gte: 1 }, else: { say: 'Take the job first', as: 'toast' } });
    // (the page's cfg: the lawn, never the gate)
    expect(lowerMinigames(play).minigames.games[0]).toMatchObject({ lawn: LAWN, time: 60 });
    expect(lowerMinigames(play).minigames.games[0].if).toBeUndefined();
    expect(STALLS).not.toContain('mowing');
    expect(() => readMinigames({ minigames: [{ id: 'a', game: 'mowing', lawn: { rows: ['..', '...'] } }] })).toThrow(/lawn/);
    expect(() => readMinigames({ minigames: [{ id: 'a', game: 'fishing', lawn: LAWN }] })).toThrow(/lawn/);
  });

  it('gold goes where the party\'s goes (play.rpg rules.gold)', () => {
    const play = { rpg: { party: [{ id: 'ayla', class: 'fighter' }], rules: { gold: 'held:bag:gold' } }, minigames: [{ id: 'pond', game: 'fishing' }] };
    expect(lowerMinigames(play).minigames.games[0].purse).toBe('held:bag:gold');
    expect(lowerMinigames({ minigames: [{ id: 'pond', game: 'fishing' }] }).minigames.games[0].purse).toBe('gold');
    expect(lowerMinigames({ minigames: [{ id: 'pond', game: 'fishing', purse: 'held:bag:gold' }] }).vars).toMatchObject({ 'held:bag:gold': 0 });
  });

  it('a level without minigames carries not a byte of them', () => {
    const play = { spots: SPOTS, cues: [{ id: 'hi', when: { start: true }, then: { say: 'hi' } }] };
    const ev = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
    expect(ev.minigames).toBeUndefined();
    expect(eventsChannelScript(ev)).not.toMatch(/MINIGAMES|__stepMinigames/);
    // and one with them inlines only the games it plays
    const one = level({ minigames: [{ id: 'pond', game: 'fishing' }] }).ev;
    const src = eventsChannelScript(one);
    expect(src).toMatch(/__stepMinigames\(t\)/);
    expect(src).toMatch(/fishing: \(function/);
    expect(src).not.toMatch(/blocks: \(function|match: \(function/);
    expect(() => new Function(minigameScript({ games: Object.keys(MINIGAMES).map((game, i) => ({ id: game, game, seed: i, goal: 1, gold: 0, purse: 'gold' })) }))).not.toThrow();
  });
});

describe('the page: a round in a window over the field', () => {
  it('fishing: the bus starts it and holds the world; a round followed well wins, pays into the bag and says so', () => {
    const P = page({ rpg: { party: [{ id: 'ayla', class: 'fighter' }], rules: { gold: 'held:bag:gold' } }, minigames: [{ id: 'pond', game: 'fishing', goal: 30 }] }, { 'held:bag:gold': 7 });
    processEvents(P.bus, [{ type: 'minigame:pond' }]);
    P.frames();
    expect(P.api.state()).toMatchObject({ id: 'pond', game: 'fishing', phase: 'play' });
    expect(P.window.__mojFreeze).toBe(true);
    // hold the line while the fish is above the middle of the zone
    for (let i = 0; i < 4000 && P.api.state().phase === 'play'; i++) {
      const s = P.api.game();
      P.api.act(s.fish && s.fish.f > s.zone.z + ZONE / 2 ? 'reel' : 'let');
      P.frames(1, 33);
    }
    const r = P.api.state();
    expect(r.phase).toBe('result');
    expect(r.score).toBeGreaterThanOrEqual(30);
    expect(r.won).toBe(true);
    expect(r.pay).toBe(Math.floor(r.score * 0.5));
    expect(P.bus.vars['held:bag:gold']).toBe(7 + r.pay);
    expect(P.bus.vars['minigame-best-pond']).toBe(r.score);
    expect(P.queue.map((e) => e.type)).toEqual([`in:bag:gold:${r.pay}`, 'minigame-done:pond', 'minigame-won:pond']);
    // a key held over from the round does not skip the result; Space goes on, and the world moves again
    P.key('ArrowUp');
    expect(P.api.state()).not.toBeNull();
    P.key('Space');
    expect(P.api.state()).toBeNull();
    expect(P.window.__mojFreeze).toBe(false);
  });

  it('blocks: the clock ends the round; a poor one is lost and pays its little', () => {
    const P = page({ minigames: [{ id: 'cab', game: 'blocks', time: 10 }] });
    P.api.open('cab');
    P.key('Space');   // slam the first piece
    expect(P.api.game().score).toBeGreaterThan(0);
    P.frames(240, 50);
    const r = P.api.state();
    expect(r.phase).toBe('result');
    expect(r.won).toBe(false);
    expect(P.bus.vars['minigame-last-cab']).toBe(r.score);
    expect(P.queue.map((e) => e.type).slice(-2)).toEqual(['minigame-done:cab', 'minigame-lost:cab']);
  });

  it('mowing: held keys drive the mower over its lawn; the lawn all cut wins, and says so', () => {
    const P = page({ minigames: [{ id: 'grounds', game: 'mowing', gold: 0, lawn: { rows: ['......'], start: [0.5, 0.5, 0] } }] });
    P.api.open('grounds');
    expect(P.window.__mojFreeze).toBe(true);
    P.key('KeyW');
    P.frames(10, 50);
    expect(P.api.game().mower.x).toBeGreaterThan(1);
    P.key('KeyW', true);
    const x = P.api.game().mower.x;
    P.frames(20, 50);
    expect(P.api.game().mower.x - x).toBeLessThan(1);   // (let go, it rolls to a stop)
    P.key('KeyW');
    P.frames(60, 50);
    expect(P.api.state()).toMatchObject({ phase: 'result', won: true, pay: 0, score: 1000 });
    expect(P.queue.map((e) => e.type)).toEqual(['minigame-done:grounds', 'minigame-won:grounds']);
  });

  it('deskwork: a page of its own at the rank its commendations make; answered right, its quota met pays, commends and promotes', () => {
    const sched = [{ at: 1, kind: 'invoice', patience: 60 }, { at: 2, kind: 'decision', patience: 60 }];
    const desk = { id: 'desk', game: 'deskwork', gold: 0.1, purse: 'held:bag:coin', level: 'held:bag:commendation', each: 'held:bag:commendation', schedules: [sched, sched] };
    const P = page({ minigames: [desk] }, { 'held:bag:coin': 5, 'held:bag:commendation': 1 });
    P.api.open('desk');
    expect(P.api.game()).toMatchObject({ rank: 0, tab: 'inbox' });
    expect(P.window.__mojFreeze).toBe(true);
    // (a bracket turns the tabs; a number answers the open ticket's step)
    P.key('BracketRight');
    expect(P.api.game().tab).toBe('invoices');
    P.frames(60, 50);
    for (let guard = 0; guard < 20; guard++) {
      const s = P.api.game(), x = s.tickets.find((y) => y.state === 'open');
      if (!x) break;
      P.api.act({ type: 'open', id: x.id });
      P.key(`Digit${x.steps[x.on].answer + 1}`);
    }
    expect(P.api.game().served).toBe(2);
    P.key('Escape');
    const r = P.api.state();
    expect(r).toMatchObject({ phase: 'result', won: true, score: 200, pay: 20 });
    expect(P.bus.vars['held:bag:coin']).toBe(25);
    expect(P.bus.vars['held:bag:commendation']).toBe(2);
    expect(P.queue.map((e) => e.type)).toEqual(['in:bag:coin:20', 'in:bag:commendation:1', 'minigame-done:desk', 'minigame-won:desk']);
    // (two commendations a promotion: the next shift is an Associate's of a sort, on the next rank's schedule)
    P.key('Space');
    P.api.open('desk');
    expect(P.api.game().rank).toBe(1);
    expect(() => readMinigames({ minigames: [{ id: 'a', game: 'fishing', schedules: [sched] }] })).toThrow(/schedules/);
  });

  it('match: the arrows move the cursor, a pick selects; Escape ends the round as it stands', () => {
    const P = page({ minigames: [{ id: 'derby', game: 'match' }] });
    P.api.open('derby');
    P.key('ArrowRight'); P.key('ArrowDown'); P.key('Space');
    expect(P.api.game().sel).toEqual({ x: 1, y: 1 });
    P.frames(3);
    P.key('Escape');
    expect(P.api.state()).toMatchObject({ phase: 'result', score: 0, won: false, pay: 0 });
    expect(P.queue.some((e) => e.type.startsWith('in:'))).toBe(false);
    P.key('Escape');
    expect(P.api.state()).toBeNull();
  });

  it('each round deals a fresh board on the dice: the same level replays the same rounds', () => {
    const boards = () => { const P = page({ minigames: [{ id: 'derby', game: 'match' }] }); const out = []; for (let i = 0; i < 2; i++) { P.api.open('derby'); out.push(JSON.stringify(P.api.game().grid)); P.api.finish(); P.api.close(); } return out; };
    const a = boards(), b = boards();
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(a[1]);
  });
});
