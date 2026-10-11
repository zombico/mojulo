import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// GROUPS (group.js): N minds share a focus, spacing, a plan of traversal patterns and attack tokens.

const E = composeLive();
const hooks = { ground: () => 0 };
const body = (hp = 100) => ({ type: 'mesh', hittable: true, hp, radius: 0.8 });
const gun = { fireClass: 'sight', magazine: 99, cooldown: 0.2, damage: 0, range: 120 };
const player = (pos) => ({ id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: body(5000), transform: { pos, heading: 0 } });
const member = (id, pos, group, extra = {}) => ({ id, team: 'pack', rule: { type: 'ai', speed: 9, turn: 5, standoff: 10, collideRadius: 0.8, eye: 0, mind: { motivation: 'hunt', aggressiveness: 'bold', group }, ...extra }, weapon: { ...gun }, body: body(), transform: { pos, heading: 0 } });
const steps = (w, n, each) => { for (let i = 0; i < n; i++) { E.stepWorld(w, {}, 1 / 60, hooks); if (each) each(i); } };
const angleSpread = (w, ids, c) => ids.map((id) => Math.atan2(w.byId[id].transform.pos[1] - c[1], w.byId[id].transform.pos[0] - c[0])).sort((a, b) => a - b);

describe('groups: slots, spacing and patterns', () => {
  it('encircle: N members spread evenly round the target and hold their spacing', () => {
    const cfg = { id: 'g', plan: [{ pattern: 'encircle', radius: 10 }], spacing: 3 };
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const w = E.createWorld({ entities: [player([0, 0, 0]), ...ids.map((id, i) => member(id, [-30 + i * 2, -20, 0], i ? 'g' : cfg))] });
    steps(w, 60 * 8);
    const angs = angleSpread(w, ids, [0, 0]);
    const gaps = angs.map((a, i) => ((i ? a - angs[i - 1] : a + 2 * Math.PI - angs[angs.length - 1])));
    for (const gp of gaps) expect(Math.abs(gp - (2 * Math.PI) / 6)).toBeLessThan(0.35);   // evenly spaced
    for (const id of ids) expect(Math.abs(Math.hypot(...w.byId[id].transform.pos.slice(0, 2)) - 10)).toBeLessThan(2);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = w.byId[ids[i]].transform.pos, b = w.byId[ids[j]].transform.pos;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(3);
    }
  });

  it('a plan advances on its triggers: fan-out at range, encircle once close, then close in', () => {
    const cfg = { id: 'g', plan: 'pack-hunt', spacing: 3 };
    const ids = ['a', 'b', 'c', 'd'];
    const w = E.createWorld({ entities: [player([0, 0, 0]), ...ids.map((id, i) => member(id, [-60, -6 + i * 4, 0], i ? 'g' : cfg))] });
    const seen = [];
    steps(w, 60 * 14, () => { const p = w.byId.a.groupPattern; if (seen[seen.length - 1] !== p) seen.push(p); });
    expect(seen).toEqual(['fan-out', 'encircle', 'close']);
  });

  it('without a target a group travels in its formation behind the leader', () => {
    const cfg = { id: 'g', travel: 'column', spacing: 4, leader: 'a' };
    const w = E.createWorld({ entities: [player([900, 900, 0]),
      member('a', [0, 0, 0], cfg, { mind: { motivation: 'wander', aggressiveness: 'passive', group: cfg }, wanderRadius: 30 }),
      member('b', [5, 5, 0], 'g', { mind: { motivation: 'hunt', aggressiveness: 'passive', group: 'g' } }),
      member('c', [-5, 5, 0], 'g', { mind: { motivation: 'hunt', aggressiveness: 'passive', group: 'g' } })] });
    steps(w, 60 * 10);
    const a = w.byId.a.transform.pos;
    for (const id of ['b', 'c']) expect(Math.hypot(w.byId[id].transform.pos[0] - a[0], w.byId[id].transform.pos[1] - a[1])).toBeLessThan(12);
  });

  it('pincer splits the group to both flanks', () => {
    const cfg = { id: 'g', plan: [{ pattern: 'pincer', radius: 12, angle: 1.3 }], spacing: 3 };
    const ids = ['a', 'b', 'c', 'd'];
    const w = E.createWorld({ entities: [player([0, 0, 0]), ...ids.map((id, i) => member(id, [-40, -3 + i * 2, 0], i ? 'g' : cfg))] });
    steps(w, 60 * 8);
    const ys = ids.map((id) => w.byId[id].transform.pos[1]);
    expect(ys.filter((y) => y > 5).length).toBe(2);
    expect(ys.filter((y) => y < -5).length).toBe(2);
  });
});

describe('groups: coordination', () => {
  it('only K members hold an attack token, and only they press in to strike', () => {
    const bite = [{ name: 'bite', strike: 'melee', strikeReach: 2, strikeDamage: 5, strikeCooldown: 1, strikeDur: 0.5, strikeLunge: 12 }];
    const cfg = { id: 'g', plan: [{ pattern: 'encircle', radius: 8 }], attackers: 1, spacing: 3 };
    const ids = ['a', 'b', 'c', 'd'];
    const w = E.createWorld({ entities: [player([0, 0, 0]), ...ids.map((id, i) => ({ ...member(id, [-20 + i * 3, -15, 0], i ? 'g' : cfg, { loadout: bite, meleeSeek: true, meleeCombo: false, standoff: undefined }), weapon: undefined }))] });
    let maxSwinging = 0, tokenMax = 0;
    steps(w, 60 * 10, () => {
      maxSwinging = Math.max(maxSwinging, ids.filter((id) => w.byId[id].swingT != null).length);
      tokenMax = Math.max(tokenMax, ids.filter((id) => w.byId[id].groupToken).length);
    });
    expect(tokenMax).toBe(1);
    expect(maxSwinging).toBe(1);
    expect(w.byId.p.body.hp).toBeLessThan(5000);   // the token holder did strike
  });

  it('shared sight: one member seeing the target is the whole group knowing it', () => {
    const cfg = { id: 'g', plan: [{ pattern: 'encircle', radius: 10 }], spacing: 3 };
    // b faces away and cannot see the player; a looks right at it
    const w = E.createWorld({ entities: [player([20, 0, 0]),
      member('a', [0, 0, 0], cfg, { mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'sight', group: cfg } }),
      { ...member('b', [0, 6, 0], 'g', { mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'sight', group: 'g' } }), transform: { pos: [0, 6, 0], heading: Math.PI } }] });
    steps(w, 60 * 3);
    expect(w.byId.b.transform.pos[0]).toBeGreaterThan(5);   // b moved in on a target it never saw itself
  });

  it('is deterministic, and a world with no groups is untouched', () => {
    const make = () => E.createWorld({ entities: [player([0, 0, 0]), ...['a', 'b', 'c'].map((id, i) => member(id, [-30, i * 3, 0], i ? 'g' : { id: 'g', plan: 'pack-hunt' }))] });
    const x = make(), y = make();
    steps(x, 300); steps(y, 300);
    for (const id of ['a', 'b', 'c']) expect(y.byId[id].transform.pos).toEqual(x.byId[id].transform.pos);
    const plain = E.createWorld({ entities: [player([0, 0, 0]), { ...member('a', [-30, 0, 0], undefined), rule: { ...member('a', [-30, 0, 0]).rule, mind: { motivation: 'hunt', aggressiveness: 'bold' } } }] });
    steps(plain, 60);
    expect(plain.groups).toBeUndefined();
    expect(plain.byId.a.groupSlot).toBeUndefined();
  });
});
