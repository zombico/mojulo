// The city's utility vehicles (the works, road-civic-works.js; the emergency, road-civic-emergency.js; the lifts,
// road-civic-lifts.js): each body at its class's true numbers when stowed; each that deploys to the height asked and no
// further than its range, by its words or a number; what deploying does to it (a tailgate turned on its hinge, a blade on
// the road, brooms swung out, a ladder raised and slewed, a bucket held level, outriggers down); its kind's plain livery
// and a named one, its own bands and lenses; its tyres a road's; kept clean unless a wear is asked; within its budget,
// the same twice; read through the registry by the words people say, its realistic build live, parked with a reach.
import { describe, it, expect } from 'vitest';
import { CIVIC_CLASSES, CIVIC_REACH, CIVIC_WORDS, CIVIC_LIVERY, civicWords, reachOf, civicAxles } from './road-civic.js';
import { ladderPose } from './road-civic-lifts.js';
import { MILITARY_CLASSES } from './road-military.js';
import { CC } from './civic-kit.js';
import { compileRealistic } from './realistic.js';
import { rollVehicleSheet } from './sheet.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { VEHICLES, resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildsOf, upscaleOf } from '../vehicle-registry/builds.js';
import { readParked } from '../vehicle-registry/parked.js';

const CLASSES = Object.keys(CIVIC_CLASSES);
const of = (kind) => CLASSES.find((c) => CIVIC_CLASSES[c] === kind);
const compiled = (cls, opts = {}, brief) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 3, ...(brief ? { brief } : {}) }), { form: true, ...opts });
const faces = (c) => Object.values(c.form).flat();
const zs = (c, re) => c.form.root.filter((f) => re.test(f.part)).flatMap((f) => f.corners.map((p) => p[2]));
// what each kind's deployment is measured on: a tailgate's lower edge, a blade's cutting edge, the brooms' bristle tips
// (their tubes' radius under them), the ladder's tip bar (its radius over it), the bucket's floor
// (and the refuse fleet's: a front loader's forks, a side loader's gripper, a roll-off container's nose, a skip's bottom)
const REACHED = { refuse: [/^tailgate$/, 0, 'min'], plough: [/^blade\.edge$/, 0, 'min'], sweeper: [/^broom\.bristle$/, -0.008, 'min'], ladder: [/^ladder\.tip$/, 0.03, 'max'], bucket: [/^bucket$/, 0, 'min'],
  frontLoader: [/^fork$/, 0, 'min'], sideLoader: [/^gripper$/, 0, 'min'], rollOff: [/^container\.nose$/, 0, 'min'], skipLoader: [/^skip$/, 0, 'min'] };
const reached = (c, kind) => { const [re, off, how] = REACHED[kind], z = zs(c, re); return (how === 'min' ? Math.min(...z) : Math.max(...z)) - off; };
const xsOf = (c, re) => c.form.root.filter((f) => re.test(f.part)).flatMap((f) => f.corners.map((p) => p[0]));

describe('the city\'s utility vehicles compiled at their classes\' numbers', () => {
  it('each the hull kit\'s, at its class\'s length, width, height, wheelbase and wheel when stowed', () => {
    for (const cls of CLASSES) {
      expect(MILITARY_CLASSES[cls], cls).toBe(CIVIC_CLASSES[cls]);
      const c = compiled(cls), ax = civicAxles(cls), three = ax.length > 2;
      for (const k of ['L', 'W', 'H', ...(three ? [] : ['wheelbase']), 'wheelRadius']) {
        expect(c.census.against[k], `${cls} ${k}`).toBeGreaterThan(0.99);
        expect(c.census.against[k], `${cls} ${k}`).toBeLessThan(1.01);
      }
      // (a truck on three axles quotes its wheelbase to its tandem's middle)
      expect(ax[0] - ax.slice(1).reduce((t, y) => t + y, 0) / (ax.length - 1)).toBeCloseTo(PHYSICS[cls].wheelbase, 6);
    }
  });
  it('each that deploys reaches the height asked: stowed on the road, deployed by its words, a number clamped to its range', () => {
    const deploying = CLASSES.filter((cls) => CIVIC_REACH[CIVIC_CLASSES[cls]]);
    expect(deploying.length).toBe(Object.keys(CIVIC_REACH).length);
    for (const cls of deploying) {
      const kind = CIVIC_CLASSES[cls], R = CIVIC_REACH[kind];
      expect(reached(compiled(cls), kind), `${cls} stowed`).toBeCloseTo(R.stowed, 1);
      expect(reached(compiled(cls, {}, CIVIC_WORDS[kind][0]), kind), `${cls} deployed`).toBeCloseTo(R.deployed, 1);
      const mid = (R.range[0] + R.range[1]) / 2;
      expect(reached(compiled(cls, { pose: { reach: mid } }), kind), `${cls} at ${mid}`).toBeCloseTo(mid, 1);
      expect(reachOf(kind, { pose: { reach: 99 } })).toBe(R.range[1]);
      expect(reachOf(kind, { pose: { reach: -1 } })).toBe(R.range[0]);
    }
    expect(civicWords('plough', ['ploughing'])).toEqual({ deployed: true });
    expect(civicWords('refuse', ['a', 'truck'])).toEqual({ deployed: false });
    expect(() => reachOf('ambulance')).toThrow(/not a civic body that deploys/);
  });
});

describe('what deploying does', () => {
  it('a refuse truck tips its tailgate on its hinge, its body left as it was', () => {
    const cls = of('refuse'), lo = compiled(cls), hi = compiled(cls, {}, 'tipping');
    const body = (c) => JSON.stringify(c.form.root.filter((f) => f.part === 'body'));
    expect(body(hi)).toBe(body(lo));
    expect(Math.max(...zs(hi, /^tailgate$/))).toBeGreaterThan(Math.max(...zs(lo, /^tailgate$/)) + 0.5);
  });
  it('a plough\'s blade is wider than its truck and on the road when ploughing; its lamps stand over the blade', () => {
    const cls = of('plough'), c = compiled(cls, {}, 'plowing'), blade = xsOf(c, /^blade$/), body = xsOf(c, /^cab$/);
    expect(Math.max(...blade) - Math.min(...blade)).toBeGreaterThan(Math.max(...body) - Math.min(...body) + 0.5);
    expect(Math.min(...zs(c, /^blade\.edge$/))).toBeCloseTo(0, 1);
    expect(Math.min(...zs(c, /^ploughlamp$/))).toBeGreaterThan(Math.max(...zs(c, /^blade$/)));
  });
  it('a sweeper\'s brooms stay inside its width stowed and swing out past it sweeping', () => {
    const cls = of('sweeper'), hw = PHYSICS[cls].W / 2, out = (c) => Math.max(...xsOf(c, /^broom\.bristle$/).map(Math.abs));
    expect(out(compiled(cls))).toBeLessThan(hw);
    expect(out(compiled(cls, {}, 'sweeping'))).toBeGreaterThan(hw);
  });
  it('a ladder raised stands on its outriggers, elevated as its pose solves it, and slews with the turntable', () => {
    const cls = of('ladder'), R = CIVIC_REACH.ladder, lo = compiled(cls), hi = compiled(cls, {}, 'raised');
    expect(Math.min(...zs(hi, /^outrigger\.pad$/))).toBeCloseTo(0, 2);
    expect(Math.min(...zs(lo, /^outrigger\.pad$/))).toBeGreaterThan(0.3);
    const P = ladderPose(R.deployed);
    expect(P.elevation).toBeGreaterThan(0.5);
    expect(P.elevation).toBeLessThanOrEqual((75 * Math.PI) / 180 + 1e-9);
    // (slewed a quarter turn to the right, its tip over the right side by its elevation's run: l cos θ)
    const right = compiled(cls, { pose: { reach: 12, slew: 90 } }), tipX = (c) => Math.max(...xsOf(c, /^ladder\.tip$/));
    const p12 = ladderPose(12), run = ((12 - 2.98) / Math.sin(p12.elevation)) * Math.cos(p12.elevation);
    expect(tipX(right)).toBeCloseTo(run, 0);
    expect(Math.max(...xsOf(lo, /^ladder\.tip$/))).toBeLessThan(1);
    expect(reached(right, 'ladder')).toBeCloseTo(12, 1);
  });
  it('a bucket raised is held level, its floor at the reach, the truck on its outriggers', () => {
    const cls = of('bucket'), c = compiled(cls, { pose: { reach: 9 } });
    const floor = c.form.root.filter((f) => f.part === 'bucket' && Math.abs(f.outNormal[2]) > 0.99);
    expect(floor.length).toBeGreaterThan(0);
    for (const f of floor) for (const p of f.corners) expect([9, 9 + 1.05].some((z) => Math.abs(p[2] - z) < 0.07)).toBe(true);
    expect(Math.min(...zs(c, /^outrigger\.pad$/))).toBeCloseTo(0, 2);
  });
});

describe('the garbage truck\'s models, each read by its silhouette', () => {
  const box = (c, re, i) => { const v = c.form.root.filter((f) => re.test(f.part)).flatMap((f) => f.corners.map((p) => p[i])); return [Math.min(...v), Math.max(...v)]; };
  it('a front loader\'s arms arch over its cab to forks ahead of its bumper, and swing up and back over it lifting', () => {
    const cls = of('frontLoader'), lo = compiled(cls), hi = compiled(cls, {}, 'lifting');
    expect(box(lo, /^arm$/, 2)[1]).toBeGreaterThan(box(lo, /^cab$/, 2)[1]);
    expect(box(lo, /^fork$/, 1)[1]).toBeGreaterThan(box(lo, /^bumper$/, 1)[1]);
    // (lifted: the forks up over the cab's roof and drawn back toward the body)
    expect(box(hi, /^fork$/, 2)[0]).toBeGreaterThan(box(lo, /^cab$/, 2)[1]);
    expect(box(hi, /^fork$/, 1)[1]).toBeLessThan(box(lo, /^fork$/, 1)[1] - 0.8);
  });
  it('a side loader\'s hopper stands low between its cab and its body, its gripper out at the kerb low and in over the hopper high, a bin in it', () => {
    const cls = of('sideLoader'), lo = compiled(cls), hw = PHYSICS[cls].W / 2;
    expect(box(lo, /^hopper$/, 2)[1]).toBeLessThan(box(lo, /^body$/, 2)[1] - 0.7);
    expect(lo.form.root.some((f) => f.part === 'bin')).toBe(false);
    const kerb = compiled(cls, { pose: { reach: 1.0 } }), top = compiled(cls, {}, 'lifting');
    expect(box(kerb, /^gripper$/, 0)[1]).toBeGreaterThan(hw + 0.5);
    expect(box(top, /^gripper$/, 0)[1]).toBeLessThan(hw + 0.2);
    expect(top.form.root.some((f) => f.part === 'bin')).toBe(true);
  });
  it('a roll-off truck tips its container and its hook arm together about the frame\'s tail', () => {
    const cls = of('rollOff'), lo = compiled(cls), hi = compiled(cls, {}, 'tipping');
    expect(box(hi, /^container$/, 2)[1]).toBeGreaterThan(box(lo, /^container$/, 2)[1] + 2);
    expect(box(hi, /^hookarm\.tower$/, 2)[1]).toBeGreaterThan(box(lo, /^hookarm\.tower$/, 2)[1] + 2);
    expect(box(hi, /^container$/, 2)[0]).toBeGreaterThan(0);
  });
  it('a skip loader carries its skip on its bed and sets it down behind its tail, its legs down', () => {
    const cls = of('skipLoader'), lo = compiled(cls), hi = compiled(cls, {}, 'unloading'), yT = -PHYSICS[cls].L / 2;
    expect(box(lo, /^skip$/, 1)[0]).toBeGreaterThan(yT);
    expect(box(hi, /^skip$/, 1)[1]).toBeLessThan(yT);
    expect(box(hi, /^skip$/, 2)[0]).toBeCloseTo(0, 2);
    expect(box(hi, /^stabiliser\.pad$/, 2)[0]).toBeCloseTo(0, 2);
  });
});

describe('a city vehicle\'s look', () => {
  it('its kind\'s plain livery and its fleet number unless one is named; its bands, chevrons and lenses its own', () => {
    for (const kind of ['fireEngine', 'plough']) {
      const cls = of(kind), plain = compiled(cls), named = compiled(cls, { livery: { pattern: 'mono', colours: ['#2255aa'] } });
      const paint = (c) => new Set(c.form.root.filter((f) => f.material === 'milPaint' && /^(body|cab|bonnet|spreader)$/.test(f.part)).map((f) => f.albedo));
      expect([...paint(plain)], kind).toContain(CIVIC_LIVERY[kind].colours[0]);
      expect([...paint(named)], kind).toContain('#2255aa');
      expect(plain.form.root.filter((f) => f.part === 'mark').length).toBeGreaterThan(0);
      expect(named.census).toEqual(plain.census);
    }
    // (an emergency vehicle's light bar lit by its lenses' own colours, its chevrons two colours, a paramedic's chequer)
    const fire = compiled(of('fireEngine')), medic = compiled(of('paramedic'));
    expect(fire.form.root.some((f) => f.part === 'lightbar' && f.material === 'tail' && f.albedo === CC.red)).toBe(true);
    expect(new Set(fire.form.root.filter((f) => f.part === 'chevron').map((f) => f.albedo)).size).toBe(2);
    expect(new Set(medic.form.root.filter((f) => f.part === 'chequer').map((f) => f.albedo)).size).toBe(2);
    // (the box ambulance's module taller and wider than its van cab)
    const amb = compiled(of('ambulance')), span = (re) => { const x = xsOf(amb, re); return Math.max(...x) - Math.min(...x); };
    expect(span(/^module$/)).toBeGreaterThan(span(/^cab$/));
    expect(Math.max(...zs(amb, /^module$/))).toBeGreaterThan(Math.max(...zs(amb, /^cab$/)));
  });
  it('its tyres a road\'s; kept clean unless a wear is asked; within its budget; the same twice', () => {
    const cls = CLASSES[0], c = compiled(cls), all = faces(c);
    expect(all.some((f) => f.part === 'tyre.lug')).toBe(false);
    expect(all.filter((f) => f.material === 'mud').length).toBe(0);
    expect(faces(compiled(cls, { wear: 'used' })).filter((f) => f.material === 'mud').length).toBeGreaterThan(0);
    for (const k of CLASSES) expect(faces(compiled(k)).reduce((s, f) => s + f.corners.length - 2, 0), k).toBeLessThan(20000);
    expect(JSON.stringify(compiled(cls).form)).toBe(JSON.stringify(c.form));
  });
});

describe('through the registry', () => {
  it('the words people say name each row, whose realistic build is live and is the hull kit\'s', () => {
    for (const cls of CLASSES) {
      const id = rowOfHandle('physics', cls);
      expect(id, cls).toBeTruthy();
      for (const w of [VEHICLES[id].label, ...VEHICLES[id].aliases]) expect(resolveVehicle(w)?.id, w).toBe(id);
      expect(buildsOf(id).find((b) => b.tier === 'realistic'), cls).toMatchObject({ via: 'loft', key: cls, status: 'live' });
      expect(upscaleOf(id).realistic).toBe('live');
    }
  });
  it('parked with a reach its range allows: a ladder high, a vehicle that deploys nothing refused', () => {
    const ladder = rowOfHandle('physics', of('ladder')), amb = rowOfHandle('physics', of('ambulance'));
    expect(readParked([{ vehicle: ladder, at: [0, 0, 0], reach: 18 }])[0].reach).toBe(18);
    expect(() => readParked([{ vehicle: ladder, at: [0, 0, 0], reach: 40 }])).toThrow(/0 to 28/);
    expect(() => readParked([{ vehicle: amb, at: [0, 0, 0], reach: 2 }])).toThrow(/lifts nothing/);
  });
});
