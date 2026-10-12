import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildChassis, chassisManifest, lowerChassis, section, fitter, hasChassis, CHASSIS_FORMS, FIT_MAX } from './tech-chassis.js';
import { BODY_PLANS, PART_KINDS, deriveSockets, SERVES_BY_FACE } from './tech-bodyplan.js';
import { craftTech } from './tech-crafter.js';
import { facets } from './tech-readout.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { gameworldBibleHtml, HALDEN_REACH } from './index.js';

const thing = (kind, intent) => ({ ...craftTech(kind, intent).plan, intent });
const WALKER = thing('vehicle', 'an armoured walker'), TOWER = thing('structure', 'a tall lattice relay tower beacon');

describe('the body-plan solver: a form is a row', () => {
  it('nothing in the solver names a form: every form is a row of BODY_PLANS', () => {
    const src = readFileSync(new URL('./tech-bodyplan.js', import.meta.url), 'utf8'), solver = src.slice(src.indexOf('export function solveBodyPlan'));
    for (const form of ['walker', 'tower', 'tracked', 'hover', 'ship', 'gate', 'turret', 'cannon']) expect(solver, form).not.toMatch(new RegExp(`'${form}'`));
    expect(solver).not.toMatch(/t\.form/);
    for (const [id, row] of Object.entries(BODY_PLANS)) for (const p of row.parts) expect(PART_KINDS[p.kind], `${id}: ${p.kind}`).toBeTruthy();
    expect(CHASSIS_FORMS).toBe(BODY_PLANS);
  });

  it('every row solves to a chassis that holds its laws, in every camera', () => {
    for (const id of Object.keys(BODY_PLANS)) {
      const [kind, form] = id.split('/'), intent = { 'vehicle/walker': 'an armoured walker', 'vehicle/tracked': 'a battle tank', 'vehicle/hover': 'a hovercraft', 'vehicle/ship': 'a war galley', 'structure/tower': 'a lighthouse', 'structure/gate': 'a city gate', 'weapon/turret': 'a turret', 'weapon/cannon': 'a field cannon' }[id];
      const t = thing(kind, intent);
      expect(t.form, id).toBe(form);
      for (const camera of ['third-person', 'top-down']) {
        const c = buildChassis(t, { kind, direction: { motif: 'smooth', camera }, rank: 'focus' });
        expect(c.held, `${id} ${camera}: ${JSON.stringify(c.laws.filter((l) => !l.ok))}`).toBe(true);
      }
    }
  }, 120000);

  it('density follows the camera: the walker met nearer spends more, each round sized for where it is met', () => {
    const tri = (camera) => buildChassis(WALKER, { kind: 'vehicle', direction: { camera }, rank: 'focus' }).readout.triangles;
    expect(tri('first-person')).toBeGreaterThan(tri('third-person'));
    expect(tri('third-person')).toBeGreaterThan(tri('top-down'));
    const near = fitter(300, 40), far = fitter(40, 40);
    expect(near.fit(1)).toBeGreaterThan(far.fit(1));
    expect(far.fit(0.01)).toBe(6);
    expect(near.fit(100)).toBe(FIT_MAX);
    expect(near.fitLen(2)).toBeGreaterThan(far.fitLen(2));
  }, 30000);

  it('a rig of joints in a tree; sockets derived from the masses, each its face, extent and what it serves', () => {
    const c = chassisManifest(WALKER, { kind: 'vehicle' }), faces = lowerChassis(c.manifest, c.pieces);
    const ids = new Set(c.joints.map((j) => j.id)), monomers = new Set(Object.keys(c.pieces));
    expect(c.joints.filter((j) => j.parent === null)).toHaveLength(1);
    for (const j of c.joints) { if (j.parent) expect(ids.has(j.parent), j.id).toBe(true); for (const p of j.pieces) expect(monomers.has(p), `${j.id}: ${p}`).toBe(true); }
    expect([...monomers].every((m) => c.joints.some((j) => j.pieces.includes(m)))).toBe(true);
    expect(c.joints.map((j) => j.id)).toEqual(expect.arrayContaining(['core', 'hip-fl', 'knee-fl', 'hip-br', 'knee-br']));
    for (const s of c.sockets) {
      expect(monomers.has(s.on), s.id).toBe(true);
      expect(SERVES_BY_FACE[s.face], s.id).toEqual(s.serves);
      expect(s.extent).toHaveLength(2);
    }
    expect(c.sockets.filter((s) => s.mass === 'core').map((s) => s.face).sort()).toEqual(['front', 'rear', 'side', 'side', 'top']);
    expect(c.sockets.filter((s) => s.face === 'outer')).toHaveLength(8);
    expect(faces.every((f) => f.piece && f.role && f.monomer)).toBe(true);
    expect(c.functions).toEqual(['move']);
    expect(c.promised).toEqual(['guard']);
    // a face under 0.15 m² offers nothing
    expect(deriveSockets([{ id: 'pin', piece: 'pin', role: 'body', box: { lo: [0, 0, 0], hi: [0.2, 0.2, 0.2] } }])).toEqual([]);
  });

  it('parts follow the words: a sail when it sails, a stack when it burns, oars otherwise; the rudder at the rear', () => {
    const ids = (intent) => Object.keys(chassisManifest(thing('vehicle', intent), { kind: 'vehicle' }).pieces);
    expect(ids('a sailing frigate')).toEqual(expect.arrayContaining(['mast', 'sail']));
    expect(ids('a steamship')).toContain('stack');
    expect(ids('a war galley').filter((x) => x.startsWith('oar-'))).toHaveLength(10);
    expect(ids('a sailing frigate').some((x) => x.startsWith('oar-'))).toBe(false);
    const g = chassisManifest(thing('vehicle', 'a war galley'), { kind: 'vehicle' });
    expect(Math.max(...g.manifest.extrudes.find((e) => e.id === 'rudder').profile.points.map((p) => -p[0]))).toBeLessThan(0);
  });

  it('the tower: a lattice when its words say so, a crown that turns; a lighthouse keeps its crown for its lantern', () => {
    const c = chassisManifest(TOWER, { kind: 'structure' });
    expect(c.manifest.sweeps.length).toBeGreaterThan(8);
    expect(c.joints.find((j) => j.id === 'crown')).toMatchObject({ parent: 'core', range: [0, 360] });
    const solid = chassisManifest(thing('structure', 'a lighthouse'), { kind: 'structure' });
    expect(solid.manifest.sweeps).toHaveLength(0);
    expect(solid.promised).toEqual(['light']);
    expect(solid.joints.map((j) => j.id)).toEqual(['core']);
    expect(JSON.stringify(buildChassis(TOWER, { kind: 'structure' }))).toBe(JSON.stringify(buildChassis(TOWER, { kind: 'structure' })));
  }, 30000);

  it('the motif shapes the section; a chamfer is a hard edge by design, a round\'s facets are read', () => {
    expect(section('smooth', 2, 1, 16)).toHaveLength(16);
    expect(section('riveted', 2, 1, 16)).toHaveLength(8);
    const loft = (motif) => lowerObjectFaces({ kind: 'workbench', lofts: [{ id: 'l', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 }, stations: [{ t: 0, profile: { points: section(motif, 2, 2, 16) } }, { t: 1, profile: { points: section(motif, 1.6, 1.6, 16) } }] }] });
    expect(facets(loft('faceted'))).toHaveLength(0);
    expect(facets(loft('smooth')).length).toBeGreaterThan(0);
  });

  it('a form without a row keeps its block', () => {
    expect(hasChassis('vehicle', 'rotor')).toBe(false);
    expect(() => chassisManifest(thing('vehicle', 'an attack helicopter'), { kind: 'vehicle' })).toThrow(/no body plan for a vehicle rotor/);
  });

  it('the bible draws a thing with a body plan as its chassis and adornment, with its readout', () => {
    const a = gameworldBibleHtml(HALDEN_REACH);
    const i = a.indexOf('<!--plate:civ-vehicles-survey-corps-walker-->'), cap = a.slice(i, a.indexOf('</figure>', i));
    expect(cap).toContain('adorned with plate');
    expect(cap).toContain('promised and kept: guard');
    expect(a).toContain('<!--plate:civ-vehicles-survey-corps-crawler-->');
  }, 120000);
});
