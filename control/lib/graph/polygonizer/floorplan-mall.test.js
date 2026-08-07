import { describe, expect, it } from 'vitest';

import { buildMallPlan, buildMall, buildMallLevels } from './floorplan-mall.js';
import { evaluateBuilding } from './floorplan-principles.js';
import { buildElementModel } from './floorplan-bim.js';

const show = (label, r) => {
  /* eslint-disable no-console */
  console.log(`\n=== ${label} — score ${r.score}, ok=${r.ok} ===`);
  console.log('   by register:', Object.fromEntries(['code', 'livability', 'flow', 'fengshui'].map((k) => [k, `${r.byRegister[k].invariant}!/${r.byRegister[k].preferential}~`])));
  for (const f of r.findings) console.log(`   [${f.register}/${f.severity[0]}${f.universality === 'program' ? '·prog' : ''}] ${f.id} — ${f.detail}`);
  console.log('');
  /* eslint-enable no-console */
};

describe('floorplan-mall: Phase 1 — concourse + tenants graded by the mall program', () => {
  it('lays out a gapless plan: concourse spine, two anchors, tenants, restroom, food court', () => {
    const plan = buildMallPlan({ width: 64, height: 120 });
    const roles = plan.rooms.map((r) => r.role);
    expect(roles.filter((r) => r === 'concourse').length).toBe(1);
    expect(roles.filter((r) => r === 'anchor').length).toBe(2);
    expect(roles.filter((r) => r === 'restroom').length).toBeGreaterThan(0);
    expect(roles.filter((r) => r === 'foodCourt').length).toBeGreaterThan(0);
    expect(roles.filter((r) => r === 'tenant').length).toBeGreaterThan(4);
    // every tenant-ish unit carries a storefront door; plus two anchor storefronts + two entries
    expect(plan.doors.length).toBeGreaterThan(plan.rooms.length);
    // cells tile the footprint with no overlap of the concourse and a side tenant
    const conc = plan.rooms.find((r) => r.role === 'concourse');
    expect(conc.x).toBeGreaterThan(0);
    expect(conc.x + conc.w).toBeLessThan(64);
  });

  it('builds a basic walled render without throwing', () => {
    const { faces, footprint } = buildMall({ width: 64, height: 120 });
    expect(faces.length).toBeGreaterThan(50);
    expect(footprint.x1 - footprint.x0).toBeCloseTo(64, 0);
  });

  it('a sound mall passes the mall program rules', () => {
    const plan = buildMallPlan({ width: 64, height: 120 });
    const r = evaluateBuilding(plan, { program: 'mall' });
    const prog = r.findings.filter((f) => f.universality === 'program');
    // no storefront/restroom/continuity program violations on a well-formed mall
    expect(prog.some((f) => f.id === 'storefront-on-concourse')).toBe(false);
    expect(prog.some((f) => f.id === 'restroom-off-concourse')).toBe(false);
    expect(prog.some((f) => f.id === 'concourse-continuity')).toBe(false);
    show('MALL — sound', r);
  });

  it('the mall program catches a restroom reachable only through a shop', () => {
    const plan = buildMallPlan({ width: 64, height: 120 });
    // find the restroom and its storefront door; sever it and instead door it to the tenant above
    const restroom = plan.rooms.find((r) => r.role === 'restroom');
    const sfX = restroom.x + restroom.w;                                  // its concourse-facing edge (x = cx0)
    const sfY = restroom.y + restroom.h / 2;
    const doors = plan.doors.filter((d) => !(Math.abs(d.x - sfX) < 0.5 && Math.abs(d.y - sfY) < 0.5));
    doors.push({ x: restroom.x + restroom.w / 2, y: restroom.y, edge: 'N', width: 3 });   // restroom ↔ tenant above
    const r = evaluateBuilding({ ...plan, doors }, { program: 'mall' });

    const foh = r.findings.find((f) => f.id === 'restroom-off-concourse');
    expect(foh).toBeTruthy();
    expect(foh.universality).toBe('program');
    expect(foh.severity).toBe('invariant');
    // and the orphaned-storefront rule fires too (restroom no longer opens on the concourse)
    expect(r.findings.some((f) => f.id === 'storefront-on-concourse')).toBe(true);
    expect(r.ok).toBe(false);
    show('MALL — broken (restroom only via a shop)', r);
  });
});

describe('floorplan-mall: Phase 2 — second level reachable by escalator (no styling)', () => {
  it('stacks two levels with the upper concourse spliced to the ground via an escalator', () => {
    const mall = buildMallLevels({ width: 64, height: 120 });
    expect(mall.levels.length).toBe(2);
    expect(mall.transports.length).toBe(1);

    const model = buildElementModel(mall);
    // both storeys present; verticals recorded
    expect(model.storeys.length).toBe(2);
    expect(model.verticals.length).toBe(1);
    // the escalator linked the two concourses (cross-storey connects exist)
    const g = model.spaces.find((s) => s.storey === 'storey:0' && s.role === 'concourse');
    const u = model.spaces.find((s) => s.storey === 'storey:1' && s.role === 'concourse');
    expect(g.connects).toContain(u.id);
    expect(u.connects).toContain(g.id);
  });

  it('a 2-level mall with the escalator passes vertical-reachability', () => {
    const mall = buildMallLevels({ width: 64, height: 120 });
    const r = evaluateBuilding(mall, { program: 'mall' });
    expect(r.findings.some((f) => f.id === 'vertical-reachability')).toBe(false);
    show('MALL 2-LEVEL — sound (escalator links the concourses)', r);
  });

  it('removing the escalator strands the entire upper level', () => {
    const mall = buildMallLevels({ width: 64, height: 120 });
    const noLift = { ...mall, transports: [] };   // pull the escalator
    const r = evaluateBuilding(noLift, { program: 'mall' });
    const vr = r.findings.find((f) => f.id === 'vertical-reachability');
    expect(vr).toBeTruthy();
    expect(vr.universality).toBe('program');
    expect(vr.severity).toBe('invariant');
    expect(r.ok).toBe(false);
    show('MALL 2-LEVEL — broken (no escalator → upper level stranded)', r);
  });
});
