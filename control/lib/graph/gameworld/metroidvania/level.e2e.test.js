// A metroidvania level played as its page resolves it (worlds/world-scene.js, game/level-sim.js: its world, its held
// gates and its camera on the page's own ground). Erina's castle, Vampire Sonata: the hero walks the castle's floor
// room to room under the side map's camera to the outer wall's key; a lock holds until she has it; the Gate Warden's
// stand-in falls to her saber string, its seal breaks (and is no ground: she drops through) and the second leap is hers
// (the double jump's move); the sill
// into the halls is cleared by the second jump and never by one; the cracked wall stands every cut until the ram strike
// is held. The hero's body is left out (no stored hero here): the play is the rule's, not the figure's.
import { describe, it, expect, beforeAll } from 'vitest';
import { readGameworld } from '../world.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { simLevel } from '../../game/level-sim.js';
import { faceGround, pageGroundFaces, SIM_DT } from '../../game/level-equivalence.js';
import { vampireSonataGame } from './vampire-sonata.js';
import { boxOf } from './scene.js';
import { FLOOR } from './rooms.js';

const ZERO = { forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0, boost: 0, fire: 0 };
let payload, B;
beforeAll(async () => {
  const W = readGameworld(vampireSonataGame({ heroRef: 'erina-ref' })), [stage] = gameStages(W);
  const m = stageLevelOrder(W, stage, { heroRef: 'erina-ref', heroStature: 1.69, ref: 'lvl' }).args.manifest;
  m.figures = {}; m.entities = m.entities.map((e) => ({ ...e, body: { ...e.body, type: 'none', figure: undefined } }));
  ({ payload } = await resolveWorldScene({ manifest: m }));
  B = boxOf(m);
}, 120000);

function play() { return playIn(payload, B); }
function playIn(payload, B) {
  const sim = simLevel({ entities: payload.entities, events: payload.events, colliders: payload.colliders, camera: payload.camera, world: payload }, { ground: faceGround(pageGroundFaces(payload.faces)) });
  const hero = sim.world.byId.hero, W = B.greybox.screen.width, H = B.greybox.screen.height;
  const step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) { Object.assign(sim.input, ZERO, inp); sim.frame(SIM_DT); } };
  const room = (id) => B.layout.rooms.find((r) => r.id === id);
  // stand the hero in a room at a share across it, on its floor, and let it settle
  const place = (id, share) => { const r = room(id); hero.transform.pos = [0, r.rect[0] * W + share * r.rect[2] * W, r.rect[1] * H + FLOOR + (hero.rule.eye || 0) + 0.05]; hero.vel = [0, 0, 0]; step({}, 30); };
  // the saber string pressed at what is `dir` of her: turned to it, then the press and the release, over and over
  const cut = (dir, n) => { step({ strafe: dir }, 3); for (let i = 0; i < n; i++) { step({ fire: 1 }, 2); step({}, 10); } };
  const gate = (door) => sim.world.breakables.find((b) => b.id === `gate-${door}`);
  const s = () => hero.transform.pos[1];
  return { sim, hero, W, H, step, place, cut, gate, s, held: sim.world.heldGates.held, room };
}
const doorOf = (pred) => B.layout.doors.find(pred);

describe('a metroidvania level, played as its page resolves it', () => {
  it('lays the castle on the side map\'s runtime: a camera zone a room, the gates held, what is picked up', () => {
    expect(payload.camera.rule).toBe('side-map');
    expect(payload.camera.zones.length).toBe(B.layout.rooms.length);
    expect(payload.heldGates.gates.map((g) => g.kind).sort()).toEqual(expect.arrayContaining(['boss', 'form', 'key', 'wall-break']));
    // (the breakables: the held gates, the bosses, and the secret walls, which no gate holds: blows find them)
    expect(payload.breakables.length).toBe(payload.heldGates.gates.length + payload.heldGates.bosses.length + B.secrets.length);
    expect(payload.entities[0].rule.strike).toBe('melee');
    expect(payload.entities[0].rule.cling).toBeUndefined();
  });

  it('plays an action RPG\'s vitals, never lives: health and MP, a save room fills her, her death a waking there', () => {
    expect(payload.game.mechanics.some((m) => m.kind === 'lives')).toBe(false);
    const P = play(), H = P.hero, hall = B.layout.rooms.find((r) => r.save && r.ring === 1);
    expect(H.body.hp).toBeGreaterThan(0); expect(H.hpMax).toBe(H.body.hp);
    expect(H.rule.moveset.mp.max).toBeGreaterThan(0);
    // (stood in the halls' save room: she is full, and wakes there from now on)
    H.body.hp = 5;
    P.place(hall.id, 0.5);
    expect(P.sim.world.heldGates.save).toBe(hall.id);
    expect(H.body.hp).toBe(H.hpMax);
    // (elsewhere, holding a key, her health spent: she wakes in the halls' save room, full, the key still hers)
    P.held['key:0'] = P.sim.world.time;
    P.place(B.layout.rooms.find((r) => r.ring === 0 && r.kind === 'corridor').id, 0.5);
    H.body.hp = 0;
    P.step({}, 30);
    expect(P.room(hall.id).rect[0] * P.W <= P.s() && P.s() <= (P.room(hall.id).rect[0] + 1) * P.W).toBe(true);
    expect(H.body.hp).toBe(H.hpMax);
    expect(P.sim.world.heldGates.deaths).toBe(1);
    expect(P.held['key:0']).toBeDefined();
  });

  it('walks the castle\'s floor room to room under the side map\'s camera to the outer wall\'s key', () => {
    const P = play();
    const zones = new Set();
    for (let i = 0; i < 60 * 40 && P.held['key:0'] == null; i++) { P.step({ strafe: 1 }); zones.add(P.sim.world.camera._zoneAt); }
    expect(P.held['key:0']).toBeDefined();
    expect([...zones].length).toBeGreaterThanOrEqual(5);
    expect(P.sim.world.sideFalls ?? 0).toBe(0);
  });

  it('holds the lock until the key is held, then opens it as she comes to it', () => {
    const d = doorOf((x) => x.gate === 'key'), P = play(), g = P.gate(d.id);
    P.place(d.a, 0.6);
    P.step({ strafe: -1 }, 240);
    expect(g.broken).toBeFalsy();
    expect(P.s()).toBeGreaterThan(g.max[1]);
    P.held['key:0'] = P.sim.world.time;
    P.step({ strafe: -1 }, 240);
    expect(g.broken).toBeTruthy();
    expect(P.s()).toBeLessThan(g.min[1]);
  });

  it('cuts the Gate Warden down with the saber string: its seal breaks and the second leap is hers', () => {
    const r = B.layout.rooms.find((x) => x.boss === 'the Gate Warden'), P = play(), seal = P.gate(doorOf((x) => x.gate === 'boss' && x.a === r.id).id);
    const boss = P.sim.world.breakables.find((b) => b.id === `boss-${r.id}`);
    expect(P.hero.rule.airJumps ?? 0).toBe(0);
    P.place(r.id, 0.5);
    const at = (boss.min[1] + boss.max[1]) / 2, dir = Math.sign(at - P.s());
    for (let f = 0; f < 600 && Math.abs(at - P.s()) > 2.2; f++) P.step({ strafe: dir });
    P.cut(dir, 12);
    expect(boss.broken).toBeTruthy();
    expect(P.held[`boss:${r.id}`]).toBeDefined();
    expect(P.held['gate:double-jump']).toBeDefined();
    expect(P.hero.rule.airJumps).toBe(1);
    P.step({}, 10);
    expect(seal.broken).toBeTruthy();
    // (gone, the seal is no ground: she drops through the hole it held, onto the top of the shaft's stair under it)
    const hole = (seal.min[1] + seal.max[1]) / 2, floor = r.rect[1] * P.H + FLOOR;
    for (let f = 0; f < 360 && P.hero.transform.pos[2] > floor - 1; f++) P.step({ strafe: Math.sign(hole - P.s()) * (Math.abs(hole - P.s()) > 0.3 ? 1 : 0) });
    expect(P.hero.transform.pos[2]).toBeLessThan(floor - 1);
  });

  it('clears the sill into the great halls on the second jump, and never on one', () => {
    const d = doorOf((x) => x.kind === 'step' && x.gate === 'double-jump'), wall = Math.max(d.cells[0][0], d.cells[1][0]);
    const tryIt = (second) => {
      const P = play(), edge = wall * P.W;
      if (second) P.hero.rule.airJumps = 1;
      P.place(d.a, 0.93);
      for (let f = 0; f < 240; f++) {
        const up = P.hero.vel[2], press = f === 30 || (second && f > 30 && !P.hero.grounded && up < 0.5 && (P.hero.airJumpsUsed ?? 0) < 1);
        P.step({ strafe: 1, jump: press ? 1 : 0, jumpHeld: 1 });
      }
      return P.s() > edge;
    };
    expect(tryIt(false)).toBe(false);
    expect(tryIt(true)).toBe(true);
  });

  it('keeps the cracked wall standing every cut until the ram strike is held, then cuts it down', () => {
    const d = doorOf((x) => x.kind === 'step' && x.gate === 'wall-break'), P = play(), g = P.gate(d.id);
    P.place(d.a, 0.95);
    P.step({ strafe: 1 }, 30);
    P.cut(1, 8);
    expect(g.broken).toBeFalsy();
    P.held['gate:wall-break'] = P.sim.world.time;
    P.step({}, 2);
    P.cut(1, 8);
    expect(g.broken).toBeTruthy();
  });

  // THE SECRET WALLS: a wall like the others, struck down; counted blows, or, the game physical, its stone by its matter
  const secretWall = (P, Bx) => {
    const sec = Bx.secrets[0], b = P.sim.world.breakables.find((x) => x.id === sec.id), r = P.room(sec.room), W = P.W;
    P.place(sec.room, (b.min[1] - 1.1 - r.rect[0] * W) / (r.rect[2] * W));
    return b;
  };
  it('hides a secret wall that stands a cut and falls to the string, its prize then on the map', () => {
    const P = play(), b = secretWall(P, B);
    expect(B.secrets.length).toBeGreaterThan(0);
    expect(payload.heldGates.gates.some((g) => g.id === b.id)).toBe(false);
    P.cut(1, 1);
    expect(b.broken).toBeFalsy();
    P.cut(1, 8);
    expect(b.broken).toBeTruthy();
  });

  it('breaks a secret wall by its matter where the game is physical: its stone, its joules spent by blows, its debris', async () => {
    const G = vampireSonataGame({ heroRef: 'erina-ref' }); G.mechanics = { ...(G.mechanics ?? {}), destruction: 'physical' };
    const W = readGameworld(G), [stage] = gameStages(W), m = stageLevelOrder(W, stage, { heroRef: 'erina-ref', heroStature: 1.69, ref: 'lvl' }).args.manifest;
    m.figures = {}; m.entities = m.entities.map((e) => ({ ...e, body: { ...e.body, type: 'none', figure: undefined } }));
    expect(m.destruction).toBe('physical');
    const { payload: Pp } = await resolveWorldScene({ manifest: m }), Bp = boxOf(m);
    expect(Pp.rupa).toBeTruthy();
    const P = playIn(Pp, Bp), b = secretWall(P, Bp);
    expect(Pp.breakables.find((x) => x.id === b.id)).toMatchObject({ matter: 'stone' });
    // (the page hands its world the payload's rupa, controllable/index.js; the sim harness carries no rupa, level-sim.js
    // WORLD_OPTIONS: its blows set to the payload's power, as the page's are)
    P.sim.world.rupa.power = Pp.rupa.power;
    P.cut(1, 1);
    expect(b.broken).toBeFalsy();
    P.cut(1, 10);
    expect(b.broken).toBeTruthy();
    const hits = P.sim.world.rupa.hits.filter((h) => h.id === b.id);
    expect(hits.every((h) => h.how === 'swing')).toBe(true);
    // (its joules its blows': 3 swings at the box's power, then it broke as stone, its debris on the break)
    expect(hits.length).toBe(3);
    const br = P.sim.world.breaks.find((x) => x.id === b.id);
    expect(br.debris?.pieces?.length ?? br.debris?.length ?? 0).toBeGreaterThan(0);
  }, 120000);

  // THE CLIMBS (climbs.js): a bot climbs every room it can open, stand by stand, on a single jump (a stair walked), and
  // out through its door above: going up is going across
  it('climbs every room of the castle by its structure: stairs walked, great steps leapt, ladders held, the towers woven', () => {
    expect([...new Set(B.greybox.chains.map((c) => c.figure))]).toEqual(expect.arrayContaining(['stair-tower', 'great-stair']));
    climbedBy.length = 0;
    climbAll(play, B);
    expect(new Set(climbedBy)).toEqual(new Set(['walk', 'jump', 'ladder']));
    // (a tower's climb weaves: it stands on both its screens, either side of its pier)
    const W = B.greybox.screen.width, towers = B.greybox.chains.filter((c) => { const r = B.layout.rooms.find((x) => x.id === c.room); return r.kind === 'shaft' && r.rect[2] === 2 && c.ways; });
    expect(towers.length).toBeGreaterThan(0);
    for (const c of towers) { const r = B.layout.rooms.find((x) => x.id === c.room), mid = (r.rect[0] + 1) * W; expect(c.spans.some(([a, b]) => b < mid) && c.spans.some(([a]) => a > mid), c.room).toBe(true); }
  });
});

// (a bot up each climb: stood under the first stand, then each in turn: run to it, jump at the edge of the one she is on
// or under it (a stair's step walked, never jumped), steer to its middle in the air; and out over the floor above)
const climbedBy = [];
function climbAll(open, Bx, pick = () => true) {
  for (const c of Bx.greybox.chains.filter((x) => pick(x) && !Bx.layout.doors.find((d) => d.id === x.door).gate)) {
    const f = c.figure, P = open(), H = P.hero, eye = H.rule.eye || 0, feet = () => H.transform.pos[2] - eye, spans = c.spans.map(([s0, s1], k) => ({ s0, s1, z: c.stands[k + 1] }));
    // (on the floor beside the first stand, on its far side from the second: a flight built up from the floor is solid)
    const s1st = spans[1] && (spans[1].s0 + spans[1].s1) / 2 > (spans[0].s0 + spans[0].s1) / 2 ? spans[0].s0 - 0.6 : spans[0].s1 + 0.6, rr = P.room(c.room);
    P.place(c.room, (Math.min((rr.rect[0] + rr.rect[2]) * P.W - 1, Math.max(rr.rect[0] * P.W + 1, s1st)) - rr.rect[0] * P.W) / (rr.rect[2] * P.W));
    let on = { s0: -1e9, s1: 1e9, z: c.from }, reached = 0, crossed = 0, last = P.s(), jumps = 0;
    const hole = Bx.greybox.holes.find((h) => h.door === c.door), mid = (spans.at(-1).s0 + spans.at(-1).s1) / 2;
    // (out over the floor above on the hole's side toward the room's middle: its other side is the wall)
    const rm = P.room(c.room), centre = (rm.rect[0] + rm.rect[2] / 2) * P.W;
    const out = hole ? ((hole.s0 + hole.s1) / 2 > centre ? { s0: hole.s0 - 2, s1: hole.s0 - 0.6, z: c.to } : { s0: hole.s1 + 0.6, s1: hole.s1 + 2, z: c.to }) : null;
    for (const [k, p] of [...spans, ...(out ? [out] : [])].entries()) {
      // (a ladder: walked to its foot, then held up to its head)
      const lad = c.ways?.[k] === 'ladder' ? Bx.greybox.ladders.find((l) => l.room === c.room && Math.abs(l.z1 - p.z) < 0.05) : null;
      const aim = lad ? lad.s : (p.s0 + p.s1) / 2, walk = !lad && p.z - on.z < 0.34;
      let ok = false;
      for (let f2 = 0; f2 < 600; f2++) {
        // (out in the room above, she may stand on its own climb's first step: the runtime lifts a body onto a ledge
        // within its height as it lands)
        ok = H.grounded && (p === out ? feet() > p.z - 0.2 : Math.abs(feet() - p.z) < 0.2 && P.s() > p.s0 - 0.6 && P.s() < p.s1 + 0.6);
        if (ok) break;
        const s = P.s(), dir = Math.sign(aim - s), under = s > p.s0 - 0.2 && s < p.s1 + 0.2, atEdge = dir > 0 ? on.s1 - s < 0.45 : s - on.s0 < 0.45;
        if (lad) { P.step(H.climbing || Math.abs(aim - s) < 0.3 ? { forward: 1 } : { strafe: dir }); continue; }
        const press = !walk && H.grounded && (under || atEdge);
        if (press) jumps++;
        P.step({ strafe: Math.abs(aim - s) > 0.1 ? dir : 0, jump: press ? 1 : 0, jumpHeld: 1 });
      }
      if (!ok) break;
      reached++; crossed += Math.abs(P.s() - last); last = P.s(); on = p;
    }
    expect(reached, `${f} in ${c.room}`).toBe(spans.length + (out ? 1 : 0));
    if (f !== 'zigzag') expect(crossed, `${f} in ${c.room} crosses`).toBeGreaterThan(c.to - c.from);
    if (f === 'stair') expect(jumps, `the stair in ${c.room} walked`).toBeLessThanOrEqual(2);
    if (c.ways) climbedBy.push(...c.ways);
  }
}
