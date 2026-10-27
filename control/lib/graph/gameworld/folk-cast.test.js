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
});

