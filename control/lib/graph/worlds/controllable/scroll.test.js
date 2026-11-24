// The scroll stage's runtime (scroll.js), on a frame laid by gameworld/scroll-stage/frame.js. The concepts: the screen is
// carried down its track leg by leg at each leg's pace, held for its seconds or until a boss is down, and stands past
// its end; the ship rides the scroll, moved only by the d-pad's eight ways at its gear's speed (the diagonals as fast as
// the straights, a half-pressed stick a full press), the frame's edges stopping it with the whole ship in the frame; a
// gear steps on its press, never repeating while held; the top view is the side view turned a quarter (screen up is
// ahead); the camera looks square at the plane with the view's up; a page without the scroll stage keeps every byte.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { SCROLL_VIEWS, scrollCamera, playBox, cameraAt } from '../../gameworld/scroll-stage/frame.js';

const E = composeLive(), DT = 1 / 60, SHIP = { length: 12, breadth: 4 };
const world = ({ view = 'side', track = [], at, gears } = {}) => {
  const C = scrollCamera(SHIP.length, { view });
  const st = E.createWorld({
    entities: [{ id: 'ship', pilotable: true, rule: { type: 'scroll-ship', size: [SHIP.length, SHIP.breadth], ...(at ? { at } : {}), ...(gears ? { gears } : {}) }, transform: { pos: [0, 0, 0] } },
      { id: 'boss', rule: { type: 'static' }, transform: { pos: [0, 500, 0] } }],
    camera: { rule: 'scroll', target: 'ship', view, dist: C.dist, screen: [C.screen.along, C.screen.across], track },
    pilot: 'ship',
  });
  return { st, C };
};
const step = (st, input = {}, n = 1, each) => { for (let i = 0; i < n; i++) { E.stepWorld(st, input, DT); if (each) each(st); } return st; };
const ship = (st) => st.byId.ship;

describe('the scroll stage\'s screen', () => {
  it('carries its views\' bases as the frame defines them', () => {
    const src = E.RULES.scroll.toString() + emissionSource({ scroll: true });
    for (const id of Object.keys(SCROLL_VIEWS)) {
      const V = SCROLL_VIEWS[id];
      expect(src).toContain(`${id}: { along: [${V.along.join(', ')}], across: [${V.across.join(', ')}], toward: [${V.toward.join(', ')}], up: [${V.up.join(', ')}] }`);
    }
  });

  it('is carried down its track leg by leg at each leg\'s pace, and stands past its end', () => {
    const { st } = world({ track: [{ by: [60, 0], pace: 20 }, { by: [0, 30], pace: 10 }] });
    step(st, {}, 60);
    expect(st.camera._sc[0]).toBeCloseTo(20, 6);
    expect(st.camera.scrollVel[0]).toBeCloseTo(20, 6);
    step(st, {}, 60 * 2);                                            // the first leg done at 3 s
    expect(st.camera._sc[0]).toBeCloseTo(60, 6);
    expect(st.camera._sc[1]).toBeCloseTo(0, 6);
    step(st, {}, 60 * 3 + 1);                                         // the leg across: up 30 m at 10 m/s
    expect(st.camera._sc[0]).toBeCloseTo(60, 6);
    expect(st.camera._sc[1]).toBeCloseTo(30, 6);
    expect(st.camera.scrollEnd).toBe(true);
    step(st, {}, 30);
    expect(st.camera._sc[1]).toBeCloseTo(30, 6);
    expect(st.camera.scrollVel).toEqual([0, 0]);
  });

  it('is held for its seconds, and until a boss is down', () => {
    const { st } = world({ track: [{ hold: 1 }, { by: [10, 0], pace: 10 }, { hold: true, until: 'boss' }, { by: [10, 0], pace: 10 }] });
    step(st, {}, 59);
    expect(st.camera._sc[0]).toBe(0);
    step(st, {}, 61 + 60 * 2);                                        // past the hold and the leg, waiting on the boss
    expect(st.camera._sc[0]).toBeCloseTo(10, 6);
    st.byId.boss.downed = true;
    step(st, {}, 60 * 2);
    expect(st.camera._sc[0]).toBeCloseTo(20, 6);
  });

  it('frames its centre square from its distance, with the view\'s up', () => {
    for (const view of ['side', 'top']) {
      const { st, C } = world({ view, track: [{ by: [40, 0], pace: 40 }] });
      step(st, {}, 60);
      const want = cameraAt({ view, dist: C.dist }, st.camera._sc);
      st.camera.transform.pos.forEach((x, i) => expect(x).toBeCloseTo(want.pos[i], 6));
      st.camera.lookAt.forEach((x, i) => expect(x).toBeCloseTo(want.lookAt[i], 6));
      expect(st.camera.up).toEqual(want.up);
    }
  });
});

describe('the ship on the d-pad', () => {
  it('rides the scroll: unpressed, it holds its place on the screen as the screen moves on', () => {
    const { st } = world({ track: [{ by: [200, 0], pace: 25 }] });
    step(st, {}, 2);
    const off = ship(st).off.slice(), y0 = ship(st).transform.pos[1];
    step(st, {}, 60);
    expect(ship(st).off).toEqual(off);
    expect(ship(st).transform.pos[1] - y0).toBeCloseTo(25, 6);
  });

  it('moves the eight ways at its gear\'s speed, the diagonals as fast as the straights, a half-pressed stick a full press', () => {
    const { st, C } = world({ at: [0, 0] }), speed = 0.45 * C.screen.across;
    const moved = (input) => { ship(st).off = [0, 0]; step(st, input, 6); return ship(st).off.slice(); };
    const right = moved({ turn: 1 }), diag = moved({ turn: 1, forward: 1 }), half = moved({ turn: 0.5 }), nudge = moved({ turn: 0.2 });
    expect(right[0]).toBeCloseTo(speed * 0.1, 6);
    expect(right[1]).toBe(0);
    expect(Math.hypot(diag[0], diag[1])).toBeCloseTo(speed * 0.1, 6);
    expect(diag[0]).toBeCloseTo(diag[1], 9);
    expect(half).toEqual(right);
    expect(nudge).toEqual([0, 0]);
  });

  it('is stopped by the frame\'s edges, the whole ship kept in the frame', () => {
    const { st, C } = world({ track: [{ by: [500, 0], pace: 30 }] }), B = playBox(C, SHIP);
    step(st, { turn: 1, forward: 1 }, 60 * 6);
    expect(ship(st).off[0]).toBeCloseTo(B.u[1], 2);
    expect(ship(st).off[1]).toBeCloseTo(B.v[1], 2);
    step(st, { turn: -1, forward: -1 }, 60 * 6);
    expect(ship(st).off[0]).toBeCloseTo(B.u[0], 2);
    expect(ship(st).off[1]).toBeCloseTo(B.v[0], 2);
    const f = st.camera.frame, u = ship(st).screenAt[0], v = ship(st).screenAt[1];
    expect(u - SHIP.length / 2).toBeGreaterThan(f.u0);
    expect(v - SHIP.breadth / 2).toBeGreaterThan(f.v0);
  });

  it('steps up a gear on the press, never repeating while it is held, and round', () => {
    const { st } = world();
    step(st, { cycle: 1 }, 10);
    expect(ship(st).gear).toBe(1);
    step(st, {}, 1); step(st, { cycle: 1 }, 1); step(st, {}, 1); step(st, { cycle: 1 }, 1);
    expect(ship(st).gear).toBe(0);
  });

  it('in the top view, screen up is ahead and screen right is the side view\'s down, turned', () => {
    const { st } = world({ view: 'top', at: [0, 0] });
    step(st, { forward: 1 }, 6);
    expect(ship(st).off[0]).toBeGreaterThan(0);
    expect(ship(st).off[1]).toBe(0);
    ship(st).off = [0, 0];
    step(st, { turn: 1 }, 6);
    expect(ship(st).off[1]).toBeLessThan(0);                         // across is the screen's left
    expect(ship(st).transform.pos[0]).toBeGreaterThan(0);            // and to the screen's right is +x in the world
  });

  it('faces ahead and tilts into a move across: pitched in the side view, banked in the top', () => {
    const side = world().st, top = world({ view: 'top' }).st;
    step(side, { forward: 1 }, 30);
    step(top, { turn: 1 }, 30);
    expect(ship(side).transform.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(ship(side).tilt.pitch).toBeGreaterThan(0.2);
    expect(ship(side).tilt.roll).toBe(0);
    expect(ship(top).tilt.roll).toBeGreaterThan(0.2);
  });
});

describe('the page', () => {
  it('keeps every byte without a scroll stage', () => {
    expect(emissionSource()).not.toContain('scroll-ship');
    expect(emissionSource({ sidemap: true })).not.toContain('scroll-ship');
    expect(emissionSource({ scroll: true })).toContain('scroll-ship');
  });
});
