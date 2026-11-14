// The highway's haulers (road-haul.js over haul-kit.js): each body at its class's true numbers; the eighteen-wheeler on
// its eighteen tyres (a steer axle's singles, the rest duals) and a European rig's trailer on wide singles; a trailer by
// its word, the tractor left as it was; bobtailing, the trailer's axles gone with it; a box truck's door rolled up and its
// fridge unit; a load taken off; its kind's plain livery, its tyres a road's, kept clean; read through the registry by the
// words people say, its realistic build live.
import { describe, it, expect } from 'vitest';
import { HAUL_CLASSES, HAUL_LIVERY, haulAxles, haulWords, TRAILER_WORDS } from './road-haul.js';
import { MILITARY_CLASSES, militaryBody } from './road-military.js';
import { compileRealistic } from './realistic.js';
import { rollVehicleSheet } from './sheet.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildOf, upscaleOf } from '../vehicle-registry/builds.js';

const CLASSES = Object.keys(HAUL_CLASSES);
const of = (kind) => CLASSES.find((c) => HAUL_CLASSES[c] === kind);
const compiled = (cls, brief) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 3, ...(brief ? { brief } : {}) }), { form: true });
const parts = (c) => new Set(c.form.root.map((f) => f.part));
const span = (fs, i) => { const v = fs.flatMap((f) => f.corners.map((p) => p[i])); return Math.max(...v) - Math.min(...v); };
const tyreSpan = (c, bone) => span(c.form[bone].filter((f) => f.part === 'tyre' || f.part === 'sidewall'), 0);
const wheelBones = (c) => c.figure.bones.map((b) => b.id).filter((id) => /^wheel/.test(id));

describe('the highway\'s haulers compiled at their classes\' numbers', () => {
  it('each the hull kit\'s, at its class\'s length, width, height and wheel; its front axle to its drive\'s middle its wheelbase', () => {
    for (const cls of CLASSES) {
      expect(MILITARY_CLASSES[cls], cls).toBe(HAUL_CLASSES[cls]);
      const c = compiled(cls);
      for (const k of ['L', 'W', 'H', 'wheelRadius']) {
        expect(c.census.against[k], `${cls} ${k}`).toBeGreaterThan(0.95);
        expect(c.census.against[k], `${cls} ${k}`).toBeLessThan(1.01);
      }
      const ax = haulAxles(cls), drive = ax.length > 3 ? ax.slice(1, -2 - (HAUL_CLASSES[cls] === 'cabover' ? 1 : 0)) : [ax[1]];
      expect(ax[0] - drive.reduce((t, y) => t + y, 0) / drive.length, cls).toBeCloseTo(PHYSICS[cls].wheelbase, 6);
    }
  });
  it('the eighteen-wheeler on eighteen tyres: a single either side of its steer axle, duals on the rest', () => {
    const c = compiled(of('sleeper')), bones = wheelBones(c);
    expect(bones).toHaveLength(10);
    const singles = bones.filter((b) => tyreSpan(c, b) < 0.4), duals = bones.filter((b) => tyreSpan(c, b) > 0.5);
    expect(singles).toEqual(['wheelFL', 'wheelFR']);
    expect(singles.length + 2 * duals.length).toBe(18);
  });
  it('a European rig: its drive on duals, its trailer\'s tri-axle on wide singles', () => {
    const c = compiled(of('cabover')), bones = wheelBones(c);
    expect(bones).toHaveLength(10);
    expect(tyreSpan(c, 'wheelRL')).toBeGreaterThan(0.5);
    for (const b of ['wheel3L', 'wheel4L', 'wheel5L']) { expect(tyreSpan(c, b)).toBeGreaterThan(0.38); expect(tyreSpan(c, b)).toBeLessThan(0.5); }
  });
});

describe('a trailer by its word', () => {
  const tractor = (c) => JSON.stringify(c.form.root.filter((f) => /^(hood|cab|grille|bumper|stack|tank)(\.|$)/.test(f.part)));
  it('each word its own trailer behind the same tractor', () => {
    const cls = of('sleeper'), van = compiled(cls);
    expect(haulWords(['a', 'semi'])).toEqual({ trailer: 'van', empty: false });
    const shows = { reefer: 'reefer', tanker: 'tanker.walkway', container: 'container', curtain: 'curtain', flatbed: 'pallet' };
    for (const [kind, part] of Object.entries(shows)) {
      const c = compiled(cls, TRAILER_WORDS[kind][0]);
      expect(parts(c).has(part), kind).toBe(true);
      expect(parts(van).has(part), kind).toBe(false);
      expect(tractor(c), kind).toBe(tractor(van));
    }
    expect(parts(compiled(cls, 'flatbed empty')).has('pallet')).toBe(false);
  });
  it('bobtailing: the tractor alone, its three axles, no trailer', () => {
    const cls = of('sleeper'), c = compiled(cls, 'bobtail');
    expect(wheelBones(c)).toHaveLength(6);
    expect(parts(c).has('van') || parts(c).has('kingpin')).toBe(false);
    expect(c.census.L).toBeLessThan(10);
    expect(tractor(c)).toBe(tractor(compiled(cls)));
  });
});

describe('the straight trucks and the log truck', () => {
  it('a box truck rolls its door up unloading, the box dark under it; a fridge unit when refrigerated', () => {
    const cls = of('box'), shut = compiled(cls), open = compiled(cls, 'unloading');
    const foot = (c) => Math.min(...c.form.root.filter((f) => f.part === 'door.rear').flatMap((f) => f.corners.map((p) => p[2])));
    expect(parts(shut).has('doorway')).toBe(false);
    expect(parts(open).has('doorway')).toBe(true);
    expect(foot(open)).toBeGreaterThan(foot(shut) + 2);
    expect(parts(compiled(cls, 'refrigerated')).has('reefer')).toBe(true);
  });
  it('a flatbed\'s and a log truck\'s load taken off by `empty`', () => {
    for (const [kind, part] of [['flatbed', 'tarp'], ['log', 'log']]) {
      const cls = of(kind);
      expect(parts(compiled(cls)).has(part), kind).toBe(true);
      expect(parts(compiled(cls, 'empty')).has(part), kind).toBe(false);
    }
  });
});

describe('a hauler\'s look', () => {
  it('its kind\'s plain livery on its cab, a trailer\'s skin its own; road tyres, kept clean', () => {
    const cls = of('sleeper'), c = compiled(cls), all = Object.values(c.form).flat();
    expect(c.form.root.filter((f) => f.part === 'cab').every((f) => f.albedo === HAUL_LIVERY.sleeper.colours[0])).toBe(true);
    expect(c.form.root.filter((f) => f.part === 'van').every((f) => f.albedo !== HAUL_LIVERY.sleeper.colours[0])).toBe(true);
    expect(all.some((f) => f.part === 'tyre.lug')).toBe(false);
    expect(all.some((f) => /^(mud|dust)$/.test(f.part ?? ''))).toBe(false);
  });
  it('the same twice; a body that says nothing of its wheels or its axles adds no word for them', () => {
    const cls = of('log');
    expect(JSON.stringify(compiled(cls).form)).toBe(JSON.stringify(compiled(cls).form));
    const field = Object.keys(MILITARY_CLASSES).find((k) => MILITARY_CLASSES[k] === 'cargo'), body = militaryBody(field, { seed: 2 });
    expect('wheelSet' in body || 'axles' in body).toBe(false);
  });
});

describe('through the registry', () => {
  it('by the words people say, each its row; its realistic build live, the hull kit\'s', () => {
    expect(resolveVehicle('eighteen wheeler').id).toBe('semi-truck');
    expect(resolveVehicle('curtainsider').id).toBe('cabover-lorry');
    expect(resolveVehicle('logging truck').id).toBe('log-truck');
    for (const cls of CLASSES) {
      const id = rowOfHandle('physics', cls), b = buildOf(id, 'realistic', { use: 'driven' });
      expect(b.build, cls).toMatchObject({ via: 'loft', key: cls, status: 'live' });
      expect(upscaleOf(id).realistic, cls).toBe('live');
    }
  });
});
