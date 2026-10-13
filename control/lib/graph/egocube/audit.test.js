import { describe, it, expect } from 'vitest';
import { rollEgocube } from './egocube.js';
import { planFromSheet, contrastPair } from './plan.js';
import { auditPlan } from './audit.js';
import { headPlan } from '../creature-heads/index.js';

const warden = () => rollEgocube({ seed: 3, facets: { ancestry: 'lupine' } });
const first = (sheet) => JSON.parse(JSON.stringify(planFromSheet(sheet).create));
const lesson = (r, id) => r.lessons.find((l) => l.id === id);

describe('auditPlan', () => {
  it('reads a first reading as carried, and as the served body (sameness)', () => {
    const sheet = warden(), r = auditPlan(sheet, first(sheet), { dials: { lean: 18 } });
    expect(r.expands).toBe(true);
    expect(r.ledger).toHaveLength(Object.values(sheet.notes).flat().length);
    expect(r.ledger.find((x) => /brush tail/.test(x.line)).verdict).toBe('carried');
    expect(r.ledger.find((x) => /digitigrade/.test(x.line)).verdict).toBe('carried');
    expect(r.ledger.find((x) => /ruff/.test(x.line)).verdict).toBe('carried');
    expect(r.ledger.find((x) => /familiar/.test(x.line)).verdict).toBe('missing');
    expect(r.lessons.filter((l) => !l.ok)).toEqual([]);
    expect(r.sameness.flagged).toBe(true);
  });
  it('does not flag a body designed off the template', () => {
    const sheet = warden(), call = first(sheet), J = call.spec.plan.joints;
    J.knee = [J.knee[0], J.knee[1] + 0.12, J.knee[2] + 0.08]; J.shoulder = [J.shoulder[0], J.shoulder[1], J.shoulder[2] - 0.1];
    expect(auditPlan(sheet, call).sameness.flagged).toBe(false);
  });
  it('reads joint names the way people write them, and says when it could not check', () => {
    const sheet = warden(), call = first(sheet), J = call.spec.plan.joints;
    for (const n of ['shoulder', 'elbow', 'wrist', 'knuckles']) { J[`${n}R`] = J[n]; delete J[n]; }
    expect(auditPlan(sheet, call).sameness.flagged).toBe(true);
    const naga = { schema: 'layered-plan-v1', joints: { neckTop: [0, 0, 1.8], pelvisTop: [0, 0, 1] }, segments: [], heads: [] };
    expect(auditPlan(sheet, naga).sameness).toMatchObject({ flagged: false, checked: false });
  });
  it('carries a familiar the plan names', () => {
    const sheet = warden(), call = first(sheet);
    call.spec.plan.segments.push({ ...call.spec.plan.segments.find((x) => x.name === 'tail'), name: 'familiar' });
    expect(auditPlan(sheet, call).ledger.find((x) => /familiar/.test(x.line)).verdict).toBe('carried');
  });
  it('fires each lesson it can check', () => {
    const sheet = warden();
    const low = auditPlan(sheet, first(sheet), { dials: { lean: 10 } });
    expect(lesson(low, 'lean').ok).toBe(false);
    const two = first(sheet); two.spec.plan.adorn.push({ ...two.spec.plan.adorn.find((a) => a.id === 'cord'), id: 'cord2', part: 'pelvis', s: [1.0, 1.2] });
    expect(lesson(auditPlan(sheet, two), 'one-focal').ok).toBe(false);
    const thin = first(sheet); thin.spec.plan.segments.find((x) => x.name === 'neck').rA = [0.12, 0.11];
    expect(lesson(auditPlan(sheet, thin), 'mass-before-cover').ok).toBe(false);
    const puff = first(sheet); puff.spec.plan.adorn.push({ id: 'collar', mode: 'shell', part: 'neck', s: [0.4, 0.9], t: 'wrap', mugen: 0.05, thick: 0.012, group: 'Leather', signature: { kind: 'buckle', k: 0, j: 1, w: 0.03, h: 0.03, bar: 0.006, standoff: 0.006, group: 'Leather' } });
    expect(lesson(auditPlan(sheet, puff), 'stack').ok).toBe(false);
    const nose = first(sheet); nose.spec.plan.heads[0].plan.ornaments = nose.spec.plan.heads[0].plan.ornaments.map((o) => (o.name === 'nose' ? headPlan('bear').ornaments.find((b) => b.name === 'nose') : o));
    expect(lesson(auditPlan(sheet, nose), 'ornament-scale').ok).toBe(false);
    const drag = rollEgocube({ seed: 2, facets: { ancestry: 'draconic' } }), horns = first(drag);
    horns.spec.plan.heads[0].plan.ornaments = horns.spec.plan.heads[0].plan.ornaments.map((o) => (o.name === 'horn' ? { ...o, space: 'world' } : o));
    expect(lesson(auditPlan(drag, horns), 'world-sweeps').ok).toBe(false);
    const bare = first(sheet); bare.spec.plan.heads = [];
    const r = auditPlan(sheet, bare);
    expect(lesson(r, 'head').ok).toBe(false);
    expect(r.expands).toBe(false);
  });
  it('names a refused window as the windows lesson', () => {
    const sheet = warden(), call = first(sheet);
    call.spec.plan.body.tiles.find((t) => t.id === 'forearm').t = [1.0, 3.4];
    const r = auditPlan(sheet, call);
    expect(r.expands).toBe(false);
    expect(lesson(r, 'windows').ok).toBe(false);
  });
  it('reads a hero spec against a hero sheet', () => {
    const sheet = rollEgocube({ brief: 'a weary paladin' }), r = auditPlan(sheet, planFromSheet(sheet).create);
    expect(r.door).toBe('hero');
    expect(r.ledger.find((x) => x.channel === 'rest').verdict).toBe('carried');
  });
});

describe('contrastPair', () => {
  it('names the choices one facet moved, and says it is not a body to copy', () => {
    const pair = contrastPair({ seed: 3, facets: { ancestry: 'lupine' } }, { archetype: 'ruler' }, rollEgocube);
    const moved = Object.fromEntries(pair.moved.map((m) => [m.choice, m]));
    expect(moved.lean.a).toBe(18);
    expect(moved.lean.b).toBeLessThan(18);
    expect(moved.kit.b).toMatch(/pauldron/);
    expect(pair.note).toMatch(/not what to choose/);
  });
});
