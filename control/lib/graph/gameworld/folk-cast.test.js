import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageEnds } from './levels.js';
import { stageFolk } from './folk-cast.js';
import { whoOf } from '../folk/sidequests.js';
import { fingerprint as fingerprintOf } from './review.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { menuVar } from '../playscape/ui/cues.js';
import { createBusState, processEvents, watchEvents } from '../worlds/event-bus.js';

// Meadowmark with a town on its first level, its street of six houses, two walked into
const first = Object.keys(MEADOWMARK_HERO.levels)[0];
const withTown = (folk) => ({
  ...MEADOWMARK_HERO,
  characters: { ...MEADOWMARK_HERO.characters, ...(folk !== undefined ? { folk } : {}) },
  levels: { ...MEADOWMARK_HERO.levels, [first]: { ...MEADOWMARK_HERO.levels[first], places: { town: true, street: { houses: 6, enter: 2 } } } },
});
const W = withTown(true), S = runSteps(W, { ref: 'gw' });
const townLevel = (steps) => steps.filter((s) => s.key.startsWith('level-')).find((s) => s.order.manifest.entities?.some((e) => e.id.startsWith('folk-')));

describe('folk on a stage: a town\'s people stood by their houses', () => {
  it('reads characters.folk as the folk\'s words, and a world that asks for none has none', () => {
    expect(readGameworld(W).characters.folk).toEqual({ cap: 60, pool: 3 });
    const none = runSteps(withTown(), { ref: 'gw' });
    expect(none.some((s) => s.key.startsWith('folk-'))).toBe(false);
    for (const s of none.filter((x) => x.key.startsWith('level-'))) {
      expect((s.order.manifest.entities ?? []).some((e) => e.id.startsWith('folk-'))).toBe(false);
      expect((s.order.manifest.play?.menus ?? []).some((m) => m.id.startsWith('talk-'))).toBe(false);
    }
  });

  it('keeps the town\'s doors off the ends\' data, so every level order reads as it did', () => {
    const st = gameStages(readGameworld(W)).find((s) => s.manifest?.town), ends = stageEnds(st.manifest);
    expect(ends.townDoors.length).toBeGreaterThan(0);
    expect(Object.keys(ends)).not.toContain('townDoors');
  });

  it('mints each body once, as a hero is, and stands every person on a body the run made', () => {
    const mints = S.filter((s) => s.key.startsWith('folk-'));
    expect(mints.length).toBeGreaterThan(0);
    for (const m of mints) expect(m).toMatchObject({ ready: true, order: { mint: { kind: 'layered', via: 'hero' } } });
    const refs = new Set(mints.map((m) => m.ref)), M = townLevel(S).order.manifest;
    const folk = M.entities.filter((e) => e.id.startsWith('folk-'));
    expect(folk.length).toBeGreaterThan(mints.length - 1);
    for (const e of folk) expect(refs.has(M.figures[e.id].heroRef)).toBe(true);
  });

  it('stands each one by their own house, or inside at their room, as the town\'s people', () => {
    const G = readGameworld(W), st = gameStages(G).find((s) => s.manifest?.town), plan = stageFolk(G, st), ends = stageEnds(st.manifest);
    const M = townLevel(S).order.manifest, doors = new Map(ends.townDoors.map((d) => [d.id, d]));
    const stood = M.entities.filter((e) => e.id.startsWith('folk-'));
    expect(stood.length).toBe(plan.folk.people.filter((p) => doors.has(plan.houseOf[p.lot])).length);
    for (const p of plan.folk.people) {
      const door = doors.get(plan.houseOf[p.lot]);
      if (!door) continue;
      const e = stood.find((x) => x.id === `folk-${fingerprintOf(p.path)}`), [x, y] = e.transform.pos;
      const inRoom = (door.rooms ?? []).some((r) => x >= r.box.min[0] && x <= r.box.max[0] && y >= r.box.min[1] && y <= r.box.max[1]);
      expect(inRoom || Math.hypot(x - door.at[0], y - door.at[1]) < 8).toBe(true);
    }
  });

  it('gives each a talk menu that opens on the interact key, its lines from the book', () => {
    const M = townLevel(S).order.manifest;
    const talks = M.play.menus.filter((m) => m.id.startsWith('talk-'));
    expect(talks.length).toBe(M.entities.filter((e) => e.id.startsWith('folk-')).length);
    for (const t of talks) { expect(t.kind).toBe('talk'); expect(t.lines.length).toBeGreaterThanOrEqual(3); }
    const ev = lowerPlay(M, { player: 'player' });
    const zone = ev.sources.find((s) => s.use && s.prompt === 'Talk');
    expect(zone).toBeDefined();
    const bus = createBusState(ev, []);
    processEvents(bus, [{ type: `use-${zone.use}` }]);
    for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); }
    expect(talks.some((t) => bus.vars[menuVar(t.id)])).toBe(true);
  });

  it('says the operator\'s words where the folk are given them', () => {
    const said = townLevel(runSteps(withTown({ say: { keeper: 'Welcome in.' } }), { ref: 'gw' })).order.manifest;
    expect(said.play.menus.filter((m) => m.who === 'Keeper').every((m) => m.lines.join() === 'Welcome in.')).toBe(true);
  });

  it('walks a sidequest and its chain through the talk: offer, take, the step, the thanks, then the next one', () => {
    const quests = [
      { id: 'parcel', giver: 'keeper', steps: [{ talk: 'elder' }] },
      { id: 'reply', giver: 'elder', after: 'parcel', ask: 'Take my answer back, would you?', steps: [{ talk: 'keeper', say: 'Good news, then.' }] },
    ];
    const W2 = withTown({ sidequests: quests }), G = readGameworld(W2), st = gameStages(G).find((s) => s.manifest?.town), plan = stageFolk(G, st);
    const M = townLevel(runSteps(W2, { ref: 'gw' })).order.manifest;
    expect(M.play.quests.map((q) => q.id)).toEqual(['sq-parcel', 'sq-reply']);
    const ev = lowerPlay(M, { player: 'player' }), bus = createBusState(ev, []);
    const pump = (events) => { processEvents(bus, events); for (let k = 0; k < 40; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    pump(ev.initial ?? []);
    const menus = M.play.menus.map((m) => m.id), open = () => menus.filter((m) => bus.vars[menuVar(m)]);
    const idOf = (word) => `folk-${fingerprintOf(whoOf(plan.folk, word).path)}`;
    const posOf = (word) => M.entities.find((e) => e.id === idOf(word)).transform.pos;
    const talk = (word) => {
      for (const m of open()) pump([{ type: `menu-close:${m}` }]);
      const [x, y] = posOf(word), zone = ev.sources.find((s) => s.use && s.prompt === 'Talk' && Math.hypot(s.at[0] - x, s.at[1] - y) < 0.01);
      pump([{ type: `use-${zone.use}` }]);
      expect(open().length).toBe(1);
      return open()[0];
    };
    const flag = (f) => bus.vars[`flag-${f}`];
    // the elder has nothing for us yet: their chitchat; the keeper offers the parcel
    expect(talk('elder')).toBe(`talk-${idOf('elder')}`);
    expect(talk('keeper')).toBe('sq-parcel-offer');
    pump([{ type: 'menu-pick:sq-parcel-offer:0' }]);
    expect(flag('sq-parcel')).toBe(1);
    // under way, the keeper chats (the journal says what is next)
    expect(talk('keeper')).toBe(`talk-${idOf('keeper')}`);
    // the step: the elder takes it, then the keeper thanks us
    expect(talk('elder')).toBe('sq-parcel-1');
    expect(flag('sq-parcel-1')).toBe(1);
    expect(talk('keeper')).toBe('sq-parcel-thanks');
    expect(flag('sq-parcel-back')).toBe(1);
    // the chain: the elder now offers the reply, in the operator's words
    expect(talk('elder')).toBe('sq-reply-offer');
    expect(M.play.menus.find((m) => m.id === 'sq-reply-offer').lines).toEqual(['Take my answer back, would you?']);
    pump([{ type: 'menu-pick:sq-reply-offer:0' }]);
    expect(talk('keeper')).toBe('sq-reply-1');
    expect(talk('elder')).toBe('sq-reply-thanks');
    // all done: back to their chitchat
    expect(talk('keeper')).toBe(`talk-${idOf('keeper')}`);
    expect(talk('elder')).toBe(`talk-${idOf('elder')}`);
  });

  it('stands one met in every town in each town that has their role, on a body minted for their look', () => {
    const both = { ...MEADOWMARK_HERO, characters: { ...MEADOWMARK_HERO.characters, folk: { recurring: { joy: { role: 'keeper', name: 'Nurse Joy' } }, sidequests: [{ id: 'herbs', giver: 'joy', steps: [{ talk: 'elder' }] }] } },
      levels: Object.fromEntries(Object.entries(MEADOWMARK_HERO.levels).map(([id, L]) => [id, { ...L, places: { town: true, street: { houses: 6, enter: 2 } } }])) };
    const steps = runSteps(both, { ref: 'gw' }), joySteps = steps.filter((x) => x.key.startsWith('folk-joy-'));
    expect(joySteps.length).toBeGreaterThan(0);
    const towns = steps.filter((x) => x.key.startsWith('level-') && x.order.manifest.entities?.some((e) => e.id.startsWith('folk-')));
    expect(towns.length).toBe(2);
    const joyRefs = new Set(joySteps.map((x) => x.ref));
    for (const t of towns) {
      const M = t.order.manifest, joy = M.play.menus.find((m) => m.who === 'Nurse Joy');
      expect(joy).toBeDefined();
      expect(M.entities.some((e) => e.id.startsWith('folk-') && joyRefs.has(M.figures[e.id].heroRef))).toBe(true);
    }
    // her sidequest lives in the first town that holds it, and only there
    expect(towns.map((t) => (t.order.manifest.play.quests ?? []).map((q) => q.id))).toEqual([['sq-herbs'], []]);
  });

  it('keeps a day on the level\'s clock when asked: walkers walk it, and are talked to where they stand', () => {
    const M = townLevel(runSteps(withTown({ day: { start: 8 } }), { ref: 'gw' })).order.manifest;
    expect(M.game.mechanics.filter((m) => m.kind === 'clock')).toEqual([{ kind: 'clock', start: 8, rate: 2 }]);
    expect(M.play.routines.length).toBeGreaterThan(0);
    const walker = M.play.routines[0].who, home = `${walker}-home`, away = M.play.routines[0].plan[0].to;
    expect(M.entities.find((e) => e.id === walker).rule.speed).toBeGreaterThan(0);
    // the people the player comes looking for keep their place
    const keepers = M.play.menus.filter((m) => m.who === 'Keeper' || m.who === 'Elder').map((m) => m.id.replace(/^talk-/, ''));
    for (const k of keepers) expect(M.play.routines.some((r) => r.who === k)).toBe(false);
    // the bus: their talk is on where they arrive, off as the hour takes them on
    const ev = lowerPlay(M, { player: 'player' }), bus = createBusState(ev, []);
    const pump = (events) => { processEvents(bus, events); for (let k = 0; k < 40; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    pump(ev.initial ?? []);
    const spot = (id) => M.play.spots.find((x) => x.id === id).at;
    const zoneAt = (at) => ev.sources.find((z) => z.use && z.prompt === 'Talk' && Math.hypot(z.at[0] - at[0], z.at[1] - at[1]) < 0.01);
    const chat = menuVar(`talk-${walker}`);
    const press = (at) => { bus.vars[chat] = 0; pump([{ type: `use-${zoneAt(at).use}` }]); return bus.vars[chat] === 1; };
    pump([{ type: 'arrive', entity: walker, at: away, last: 1 }]);
    expect(press(spot(away))).toBe(true);
    expect(press(spot(home))).toBe(false);
    pump([{ type: 'arrive', entity: walker, at: home, last: 1 }]);
    expect(press(spot(home))).toBe(true);
    expect(press(spot(away))).toBe(false);
  });

  it('keeps no day, and no clock, unless asked', () => {
    const M = townLevel(S).order.manifest;
    expect(M.play.routines).toBeUndefined();
    expect(M.game.mechanics.some((m) => m.kind === 'clock')).toBe(false);
  });
});

