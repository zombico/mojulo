import { describe, it, expect } from 'vitest';
import { planHistoricCity, assembleHistoricCityScene, assembleHistoricWorld, assetCall } from './historic-city.js';
import { placeAsset } from './assets/kit.js';
import { POMPEII_ASSETS } from './assets/pompeii.js';
import { POMPEII } from './cultures/pompeii.js';
import { POMPEII_STYLE } from './style/pompeii.js';
import { POMPEII_RECORD } from './record/pompeii.js';
import { PATTERNS } from './patterns.js';

const plan = planHistoricCity({ seed: 7, culture: 'pompeii' });
const slotsOf = (asset) => plan.slots.filter((q) => q.asset === asset);

describe('historic city: Pompeii, the western half (placeholders)', () => {
  it('every asset is built from shared patterns, has a placeholder, and stays on its slot', () => {
    for (const A of Object.values(POMPEII_ASSETS)) {
      expect(A.designed, A.id).toBe(false);
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 10, y: 20, w, d }, facing: 'n' }, { palette: POMPEII.palette, culture: POMPEII, rng: () => 0.5 });
      expect(boxes.length, A.id).toBeGreaterThan(0);
      for (const b of boxes) for (const v of [b.x, b.y, b.w, b.d, b.z0, b.z1]) expect(Number.isFinite(v), `${A.id} ${b.kind}`).toBe(true);
    }
    for (const id of POMPEII.patterns) expect(PATTERNS[id], id).toBeTruthy();
  });

  it('is deterministic', () => {
    expect(JSON.stringify(planHistoricCity({ seed: 7, culture: 'pompeii' }).slots)).toBe(JSON.stringify(plan.slots));
  });

  it('the forum is the record\'s 143 × 38 m, north–south, the Capitolium on its podium at the north end facing down it', () => {
    const F = plan.stats.forum, cap = plan.stats.capitolium, s = slotsOf('pp-temple').find((q) => q.record === 'capitolium');
    expect([F.w, F.d]).toEqual([38, 143]);
    expect(cap.x + cap.w / 2).toBeCloseTo(F.x + F.w / 2, 6);
    expect(cap.y).toBeLessThan(F.y + 10);
    expect(s.facing).toBe('s');
    expect(s.podium).toBeGreaterThanOrEqual(POMPEII_STYLE.kit.podium.h[0]);
    expect(s.podium).toBeLessThanOrEqual(POMPEII_STYLE.kit.podium.h[1]);
    // the square's porticoes face into it, on three sides
    expect(slotsOf('pp-portico').map((q) => q.facing).sort()).toEqual(['e', 'n', 'w']);
  });

  it('each monument carries the record\'s state at 79 CE: the Capitolium roofless, Venus and the colonnade unfinished, scaffolding on the works', () => {
    const states = Object.fromEntries(POMPEII_RECORD.filter((e) => e.kind === 'type').map((e) => [e.id, e.state]));
    for (const q of plan.slots.filter((x) => x.record)) expect(q.state, q.record).toBe(states[q.record]);
    for (const id of ['capitolium', 'temple-apollo', 'temple-venus', 'basilica', 'macellum', 'eumachia', 'stabian-baths', 'large-theatre', 'triangular-forum', 'doric-temple', 'temple-isis', 'porta-marina']) expect(plan.stats.states[id], id).toBeTruthy();
    const build = (q) => placeAsset(POMPEII_ASSETS[q.asset], q, { palette: POMPEII.palette, culture: POMPEII, rng: () => 0.5 }).boxes;
    const cap = build(plan.slots.find((q) => q.record === 'capitolium')), venus = build(plan.slots.find((q) => q.record === 'temple-venus'));
    expect(cap.some((b) => b.kind === 'roof')).toBe(false);
    expect(venus.some((b) => b.kind === 'scaffold')).toBe(true);
    expect(build(plan.slots.find((q) => q.record === 'basilica')).some((b) => b.kind === 'roof')).toBe(true);
  });

  it('Via dell\'Abbondanza keeps the record\'s widths: 7.4 m, then 14.6 m for the 60 m before Via Stabiana, 6.7 m past it', () => {
    const st = Object.fromEntries(plan.stats.streets.map((s) => [s.name, s]));
    expect(st['via-dell-abbondanza'].d).toBe(7.4);
    expect(st['via-dell-abbondanza-wide']).toMatchObject({ d: 14.6, w: 60 });
    expect(st['via-dell-abbondanza-wide'].x + 60).toBe(st['via-stabiana'].x);
    expect(st['via-dell-abbondanza-east'].d).toBe(6.7);
  });

  it('streets run between kerbed pavements: the paving sunk below the kerb, on one plane, never overlapping', () => {
    const kerbs = plan.boxes.filter((b) => b.kind === 'kerb'), lanes = plan.grounds.filter((g) => g.kind === 'lane');
    expect(kerbs.length).toBeGreaterThan(100);
    for (const k of kerbs) expect(k.z1).toBe(POMPEII.street.kerb);
    expect(new Set(lanes.map((g) => g.z)).size).toBe(1);
    expect(lanes[0].z).toBeLessThan(POMPEII.street.kerb);
    const key = (g) => `${g.x},${g.y}`, seen = new Set();
    for (const g of lanes) { expect(seen.has(key(g))).toBe(false); seen.add(key(g)); expect(Number.isInteger(g.y / 3)).toBe(true); }
  });

  it('houses front a street; those on the main streets have shops; a fountain at the main crossings', () => {
    expect(plan.stats.houses).toBeGreaterThan(300);
    expect(plan.stats.shops).toBeGreaterThan(10);
    expect(plan.stats.fountains).toBeGreaterThan(2);
  });

  it('the spur stands over the plain: a bluff on the west and south, the town on top, the ramp up to Porta Marina', () => {
    const { hAt } = plan, H = POMPEII.site.spur;
    expect(hAt(plan.stats.forum.x, plan.stats.forum.y)).toBe(0);
    expect(hAt(20, 300)).toBe(-H);
    expect(hAt(400, 620)).toBe(-H);
    expect(plan.stats.terrain.cliffs).toBeGreaterThan(20);
    const ramp = plan.boxes.find((b) => b.kind === 'ramp');
    expect([ramp.z0, ramp.z1, ramp.rise]).toEqual([-H, 0, 'x+']);
    expect(ramp.x + ramp.w).toBeCloseTo(plan.stats.gates.marina.x, 6);
  });

  it('the asset call lists every placeholder still to design', () => {
    const call = assetCall(plan, POMPEII_ASSETS);
    expect(call.every((e) => !e.designed)).toBe(true);
    expect(call.map((e) => e.asset)).toEqual(expect.arrayContaining(['pp-temple', 'pp-portico', 'pp-hall', 'pp-court', 'pp-house', 'pp-shop-house', 'pp-theatre', 'pp-gate']));
  });

  it('assembles for the page and the World on every view, with the card\'s sky and Vesuvius on the World\'s horizon', () => {
    for (const view of ['forum', 'street', 'theatre', 'gate']) expect(assembleHistoricCityScene({ seed: 7, culture: 'pompeii', view, shade: false }).cameras[0].name).toBe(view);
    const w = assembleHistoricWorld({ seed: 7, culture: 'pompeii', view: 'forum' });
    expect(w.sky).toBeTruthy();
    expect(plan.world.boxes.some((b) => b.kind === 'horizon' && b.y < -4000 && b.z1 > 500)).toBe(true);
  });
});
