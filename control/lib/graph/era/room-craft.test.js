// Room craft: the craft laws carried back to their reasons, each a question a room is asked (room-craft.js).
import { describe, it, expect } from 'vitest';
import { ROOM_CRAFT, readRoomCraft, roomCraftLedger, craftBrief } from './room-craft.js';
import { STAGE_KITS } from './stage.js';
import { LAWS } from './laws.js';

const SETTINGS = ['crypt', 'lab', 'hangar', 'chapel'];

describe('room craft: the reasons, as questions', () => {
  it('every question is the reason for a craft or form law, with a why, a question and what it is derived from', () => {
    expect(new Set(ROOM_CRAFT.map((q) => q.id)).size).toBe(ROOM_CRAFT.length);
    for (const Q of ROOM_CRAFT) {
      expect(LAWS[Q.law]?.craft || LAWS[Q.law]?.form, Q.id).toBe(true);
      expect(Q.ask.endsWith('?'), Q.id).toBe(true);
      for (const f of ['why', 'from', 'not']) expect(Q[f].length, `${Q.id}.${f}`).toBeGreaterThan(20);
    }
    // (every craft law has its reason here: a law without one can only be copied)
    const reasoned = new Set(ROOM_CRAFT.map((q) => q.law));
    for (const [id, L] of Object.entries(LAWS)) if (L.craft) expect(reasoned.has(id), id).toBe(true);
  });

  it('a reason is not one place\'s answer: each question is answered for every setting, and no two settings alike', () => {
    for (const Q of ROOM_CRAFT) {
      expect(Object.keys(Q.answers), Q.id).toEqual(SETTINGS);
      expect(new Set(Object.values(Q.answers)).size, Q.id).toBe(SETTINGS.length);
    }
  });

  it('a kit is read by what its card declares: the worked crypt answers all, the crypt it is cut from few', () => {
    const ash = readRoomCraft(STAGE_KITS['gothic-ashlar']), stone = readRoomCraft(STAGE_KITS['gothic-stone']);
    expect(ash.open).toEqual([]);
    expect(stone.open.length).toBeGreaterThan(ash.open.length);
    expect(stone.open).toContain('air');
  });

  it('the reasons carry to a place with no stone in it: a bay answers the structure, the storeys and the air in its own things', () => {
    const bay = Object.keys(STAGE_KITS).find((k) => STAGE_KITS[k].shell === 'bay'), R = readRoomCraft(STAGE_KITS[bay]);
    const by = Object.fromEntries(R.rows.map((r) => [r.id, r.by]));
    for (const id of ['support', 'bays', 'storeys', 'air', 'light-above']) expect(by[id], id).toBeTruthy();
    expect(by.air).not.toBe(Object.fromEntries(readRoomCraft(STAGE_KITS['gothic-ashlar']).rows.map((r) => [r.id, r.by])).air);
  });

  it('a second burial place answers every question in its own things: no answer is the worked crypt\'s', () => {
    const cat = readRoomCraft(STAGE_KITS.catacomb), ash = Object.fromEntries(readRoomCraft(STAGE_KITS['gothic-ashlar']).rows.map((r) => [r.id, r.by]));
    expect(cat.open).toEqual([]);
    for (const id of ['fixture', 'storeys', 'coat', 'air']) expect(cat.rows.find((r) => r.id === id).by, id).not.toBe(ash[id]);
  });

  it('the ledger names what is open, and the brief puts each open question to the agent with its law', () => {
    const L = roomCraftLedger({ a: STAGE_KITS['gothic-ashlar'], b: STAGE_KITS['gothic-stone'] });
    expect(L.a.open).toEqual([]);
    expect(L.b.answered.length + L.b.open.length).toBe(ROOM_CRAFT.length);
    const brief = craftBrief(STAGE_KITS['gothic-stone']).join('\n');
    for (const id of L.b.open) expect(brief).toContain(`${id}: OPEN. ${ROOM_CRAFT.find((q) => q.id === id).ask}`);
  });
});
