/**
 * THE TEMP AGENCY — an office job in an open city, its funnel: a staffing app on the phone posts a temp's place at the
 * district's office tower (geocity `office`: its lobby a door into the office's own building, levels.js officeDoor); the
 * job asks for an office ID badge, which the city's forger has lifted off someone's lanyard (shops.js PAPERS `badge`);
 * through the lobby, past reception, a desk in an office on the ground floor (its rooms pods of desks) is where the
 * shift is worked: Deskwork (deskwork/, playscape/ui/minigames.js `deskwork`), a browser of tabs of invoices,
 * recommendations and TPS reports, its tickets a shovels & buckets card's (deskwork/card.js). A shift that meets quota
 * pays into the bag and puts a commendation in it; two a promotion, and the next shift is more work (more tickets, less
 * patience, training). Half Kafka, half a joke; recognition is automated.
 *
 *   TEMP                         the agency, its app, its desk's words
 *   deskCast(G, stage, ends)     → the office's extra (levels.js buildingLevelOrder): its desk's round (play.minigames),
 *                                  reception's word, the bag carried | null where it has no office room
 *
 * Pure (the card's schedules are the solver's, cached: deskwork/card.js).
 */
import { deskSchedules } from '../deskwork/card.js';

export const TEMP = Object.freeze({
  app: 'placeholder', name: 'Placeholder Staffing',
  desk: { id: 'desk', title: 'Synergetics Intranet', prompt: 'sit down and log in', gold: 0.1, reach: 2.6 },
  // (the bag's: the papers it asks for, the coin a shift pays, the commendations that make a rank)
  vars: { badge: 'held:bag:office-id', coin: 'held:bag:coin', merit: 'held:bag:commendation' },
  locked: 'Security: no badge, no desk. The agency did say to bring ID.',
  reception: 'Reception: You must be the new temp. Desk {room}, down the hall on the right. Badge visible at all times. We will know.',
  won: 'Darla: Great shift! Come back tomorrow. Tomorrow is any time you like, legally speaking.',
  lost: 'Darla: We need to talk about your numbers. Not now. Never, ideally. Try again.',
});

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const roomNo = (id) => (/-(\d+)$/.exec(id) ?? [])[1] ?? id;

/** The office's extra: the desk in its ground floor's office nearest the way in, its round gated by the badge; reception
 *  in its lobby says where it is. */
export function deskCast(G, stage, ends) {
  const rooms = Array.isArray(ends?.rooms) ? ends.rooms : [], s = ends?.spawn ?? [0, 0, 0];
  const mid = (r) => [r.x + r.w / 2, r.y + r.d / 2, r.z ?? 0], d2 = (p) => Math.hypot(p[0] - s[0], p[1] - s[1]);
  const ground = Math.min(...rooms.map((q) => q.z ?? 0)), offices = rooms.filter((r) => /^office-/.test(r.id) && (r.z ?? 0) === ground);
  const R = offices.sort((a, b) => d2(mid(a)) - d2(mid(b)) || a.id.localeCompare(b.id))[0];
  if (!R) return null;
  const at = mid(R).map(r3), lobby = rooms.find((r) => r.id === 'lobby'), D = TEMP.desk;
  const minigames = [{ id: D.id, game: 'deskwork', title: D.title, at: { at: [at[0], at[1]], r: D.reach }, prompt: D.prompt, gold: D.gold, purse: TEMP.vars.coin, level: TEMP.vars.merit, each: TEMP.vars.merit,
    schedules: deskSchedules((G?.seed ?? 1) >>> 0), if: { var: TEMP.vars.badge, gte: 1 }, locked: TEMP.locked }];
  const cues = [
    ...(lobby ? [{ id: 'reception-hello', when: { near: { at: mid(lobby).slice(0, 2).map(r3), r: 4 } }, once: true, then: { say: TEMP.reception.replace('{room}', roomNo(R.id)), as: 'toast', ttl: 6 } }] : []),
    { id: 'desk-won', when: { on: `minigame-won:${D.id}` }, then: { say: TEMP.won, as: 'toast', ttl: 5 } },
    { id: 'desk-lost', when: { on: `minigame-lost:${D.id}` }, then: { say: TEMP.lost, as: 'toast', ttl: 5 } },
  ];
  return { play: { minigames, cues }, mechanics: [{ kind: 'bag', slice: 'bag' }], desk: { room: R.id, at } };
}
