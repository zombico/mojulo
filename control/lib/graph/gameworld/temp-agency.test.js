// The temp agency (temp-agency.js): an office building's desk where a temp's shift is worked. The laws: the desk is in
// the ground floor's office nearest the way in; its round is Deskwork, gated by the office badge in the bag, paid into
// the bag's coin, a commendation every shift won and the rank they make read back; a schedule a rank; reception says
// which room; none where the building has no office room.
import { describe, it, expect } from 'vitest';
import { deskCast, TEMP } from './temp-agency.js';
import { readMinigames } from '../playscape/ui/minigames.js';
import { RANKS } from '../deskwork/core.js';

const room = (id, x, y, z = 0) => ({ id, x, y, w: 6, d: 6, z });
const ends = { spawn: [11, 3, 0], rooms: [room('lobby', 6, 0), room('office-104', 22, 2), room('office-110', 0, 26), room('office-204', 22, 2, 4), room('wc-101', 16, 11)] };

describe('the temp agency: its desk', () => {
  const X = deskCast({ seed: 3 }, {}, ends);
  it('in the ground floor\'s office nearest the way in, its round Deskwork, gated by the badge; reception says the room', () => {
    expect(X.desk).toEqual({ room: 'office-104', at: [25, 5, 0] });
    const [g] = readMinigames(X.play);
    expect(g).toMatchObject({ game: 'deskwork', at: { at: [25, 5], r: TEMP.desk.reach }, purse: TEMP.vars.coin, level: TEMP.vars.merit, each: TEMP.vars.merit, if: { var: TEMP.vars.badge, gte: 1 }, locked: TEMP.locked });
    expect(g.schedules).toHaveLength(RANKS.length);
    expect(X.play.cues.find((c) => c.id === 'desk-reception-hello').then.say).toMatch(/Desk 104/);
    expect(X.mechanics).toEqual([{ kind: 'bag', slice: 'bag' }]);
  });
  it('none where the building has no office room; the same desk every read', () => {
    expect(deskCast({}, {}, { spawn: [0, 0, 0], rooms: [room('lobby', 0, 0)] })).toBe(null);
    expect(deskCast({ seed: 3 }, {}, ends)).toEqual(X);
  });
});
