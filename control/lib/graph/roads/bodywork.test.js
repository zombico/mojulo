// Bodywork laws: a body language draws a car at its class's true numbers. One case per procedure (the profile, the plan,
// the section, the arch, the face), on the language that leaves the fleet's three-box furthest (chosen in code), and a
// low car's fender: the profile never above the class's height; the ends rounded, the middle full; the roof crowned and
// the glass leaning in; the arch cut from the side and cleared by the fender; the fleet's own loft untouched.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { BODY_LANGUAGES, bodyShape } from './bodywork.js';
import { FLEET, buildVehicle } from './fleet.js';
import { VEHICLES } from './vehicles.js';

// the furthest language: the most rake and arc; a car-kind class from the fleet, and the lowest car-kind row
const FAR = Object.keys(BODY_LANGUAGES).sort((a, b) => (BODY_LANGUAGES[b].rake + BODY_LANGUAGES[b].arc) - (BODY_LANGUAGES[a].rake + BODY_LANGUAGES[a].arc))[0];
const CAR = Object.keys(FLEET).find((k) => FLEET[k].kind === 'car');
const spec = (cls = CAR, language = FAR) => ({ ...FLEET[cls], language });
const ys = (sec) => sec.pts.map((p) => p[0]);

describe('a body language', () => {
  it('the profile never rises above the class\'s height, and reaches it at the roof\'s peak', () => {
    const B = bodyShape(spec());
    let top = 0;
    for (let i = 0; i <= 400; i++) top = Math.max(top, B.topAt(i / 400));
    expect(top).toBeLessThanOrEqual(FLEET[CAR].H + 1e-9);
    expect(B.topAt(B.peak)).toBeCloseTo(FLEET[CAR].H, 6);
    // the glass raked: the screen's top behind the body family's, the rear glass's ahead of it
    expect(B.A).toBeGreaterThan(FLEET[CAR].profile.roofA);
    expect(B.B).toBeLessThan(FLEET[CAR].profile.roofB);
  });
  it('the plan is rounded at the ends and full in the middle', () => {
    const B = bodyShape(spec()), W = FLEET[CAR].W;
    const half = (f) => Math.max(...ys(B.section(f)));
    expect(half(0.5)).toBeCloseTo(W / 2, 6);
    expect(half(0)).toBeLessThan(W / 2 * 0.95);
    expect(half(1)).toBeLessThan(W / 2 * 0.97);
    expect(half(B.nl * 0.5)).toBeGreaterThan(half(0));
  });
  it('the section: the sill tucked under, the roof crowned, the glass leaning in', () => {
    const B = bodyShape(spec()), sec = B.section(B.peak), right = sec.pts.slice(1, 9);
    const [sill, , wide, , belt, , edge, crown] = right;
    expect(sill[0]).toBeLessThan(wide[0]);
    expect(belt[0]).toBeLessThan(wide[0]);
    expect(edge[0]).toBeLessThan(belt[0]);
    expect(edge[1]).toBeLessThan(sec.zt);
    expect(crown[1]).toBeGreaterThan(edge[1]);
  });
  it('the arch is cut from the side\'s lines (they never ride it), and a low body\'s fender clears its tyre', () => {
    // the lowest car-length row (3.5 … 5.5 m), on the fleet car's profile scaled to its height
    const low = VEHICLES[Object.keys(VEHICLES).filter((k) => VEHICLES[k].L > 3.5 && VEHICLES[k].L < 5.5).sort((a, b) => VEHICLES[a].H - VEHICLES[b].H)[0]];
    const P = FLEET[CAR].profile, k = low.H / FLEET[CAR].H;
    const s = { L: low.L, W: low.W, H: low.H, wb: low.wheelbase, track: low.track, r: low.wheelRadius, kind: 'car', language: FAR, profile: { ...P, zHood: P.zHood * k, zDeck: P.zDeck * k, zBelt: P.zBelt * k } };
    const B = bodyShape(s);
    const atAxle = B.section((s.L / 2 - s.wb / 2) / s.L), clear = B.section(0.5);
    expect(atAxle.z0).toBeGreaterThan(2 * s.r);                   // the tyre's top inside the arch
    expect(atAxle.belt).toBeGreaterThan(atAxle.z0);               // and the body over it
    // away from the arch the side's widest line is where the sill puts it, the same at the axle's neighbour stations
    const wideZ = (sec) => sec.pts[3][1];
    expect(wideZ(clear)).toBeCloseTo(wideZ(B.section(0.45)), 1);
  });
  it('the fleet\'s own loft is untouched: no language, the same faces as the class\'s row', () => {
    const h = (b) => createHash('sha256').update(JSON.stringify(b)).digest('hex');
    expect(h(buildVehicle(CAR, 0, { spec: FLEET[CAR] }))).toBe(h(buildVehicle(CAR, 0)));
    const built = buildVehicle(CAR, 0, { spec: spec() }), own = buildVehicle(CAR, 0);
    expect(built.paint.length).toBeGreaterThan(own.paint.length);
    expect(() => bodyShape({ ...FLEET[CAR], language: 'nope' })).toThrow(/unknown language/);
  });
});
