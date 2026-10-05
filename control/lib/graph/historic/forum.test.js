import { describe, it, expect } from 'vitest';
import { planHistoricCity, assembleHistoricCityScene, assembleHistoricWorld } from './historic-city.js';
import { FORUM } from './cultures/forum.js';
import { FORUM_RECORD, FORUM_READ_AT } from './record/forum.js';
import { inUseAt } from './record.js';
import { PATTERNS } from './patterns.js';
import { turnMasses } from './assets/forum.js';
import { column } from './assets/orders.js';

const plan = planHistoricCity({ culture: 'forum' });
const mon = (id) => plan.stats.monuments.find((m) => m.id === id);
const inRect = ([x, y], r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.d + pad;
const colsIn = (r) => plan.repeats.filter((q) => q.key.startsWith('col:')).flatMap((q) => q.transforms).filter((t) => inRect(t.pos, r));
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

describe('historic city: the Forum Romanum at 79 CE (placeholders, measured)', () => {
  it('is deterministic, and every pattern it names is a shared one', () => {
    expect(JSON.stringify(planHistoricCity({ culture: 'forum' }))).toBe(JSON.stringify(plan));
    for (const id of FORUM.patterns) expect(PATTERNS[id], id).toBeTruthy();
  });

  it('places what stands at 79 and nothing later: no Temple of Vespasian on its open plot, no Equus Domitiani', () => {
    const standing = new Set(inUseAt(FORUM_RECORD, FORUM_READ_AT, 'type').map((e) => e.id));
    for (const [id, state] of Object.entries(plan.stats.states)) { expect(standing.has(id), id).toBe(true); expect(state).toBe(FORUM_RECORD.find((e) => e.id === id).state); }
    for (const id of ['temple-saturn', 'temple-concord', 'temple-castor', 'temple-divus-julius', 'temple-vesta', 'curia-julia', 'rostra-augusti', 'lacus-curtius']) expect(plan.stats.states, id).toHaveProperty(id);
    for (const late of ['temple-vespasian', 'equus-domitiani', 'umbilicus', 'consentes-portico']) expect(plan.stats.states).not.toHaveProperty(late);
    // the plot between Concord and Saturn stays open
    const plot = { x: 12, y: 72, w: 24, d: 12 };
    for (const m of plan.stats.monuments) expect(overlap(m.rect, plot), m.id).toBe(false);
  });

  it('the monuments do not overlap one another (bar Concord\'s pronaos against its cella, and what stands on another)', () => {
    const ms = plan.stats.monuments.filter((m) => m.id !== 'capitoline-jupiter' && !m.rect.on);
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      if (ms[i].id.startsWith('concord') && ms[j].id.startsWith('concord')) continue;
      expect(overlap(ms[i].rect, ms[j].rect), `${ms[i].id} × ${ms[j].id}`).toBe(false);
    }
  });

  it('Castor is octastyle peripteral, 8 × 11: 34 columns round it, each the record\'s 14.8 m on 1.45 m', () => {
    const r = mon('castor').rect, cols = plan.repeats.filter((q) => q.key.startsWith('col:corinthian:1.45:14.8'));
    expect(cols.flatMap((q) => q.transforms).filter((t) => inRect(t.pos, r)).length).toBe(2 * 8 + 2 * (11 - 2));
    const c = column('corinthian', { D: 1.45, H: 14.8, tint: '#ffffff' });
    expect(c.top).toBe(14.8);
    // the columns stand on the podium, 7 m up
    for (const t of colsIn(r)) expect(t.pos[2]).toBeCloseTo(7, 5);
  });

  it('Saturn, Concord and Divus Julius are hexastyle; Vesta has twenty columns in a ring', () => {
    const front = (id, n) => {
      const r = mon(id).rect, cs = colsIn(r), xs = cs.map((t) => t.pos[0]), minX = Math.min(...xs), maxX = Math.max(...xs);
      // the facing decides which edge is the front: count the row nearest it
      const edge = mon(id).facing === 'e' ? maxX : minX;
      expect(cs.filter((t) => Math.abs(t.pos[0] - edge) < 0.5).length, id).toBe(n);
    };
    front('saturn', 6); front('concord-pronaos', 6); front('divus-julius', 6);
    const v = mon('vesta').rect, ring = colsIn(v);
    expect(ring.length).toBe(20);
    const cx = ring.reduce((s, t) => s + t.pos[0], 0) / 20, cy = ring.reduce((s, t) => s + t.pos[1], 0) / 20, rs = ring.map((t) => Math.hypot(t.pos[0] - cx, t.pos[1] - cy));
    expect(Math.max(...rs) - Math.min(...rs)).toBeLessThan(0.01);
  });

  it('the square is open: its middle holds only low monuments, the honorary columns stand at its edges; 2.3 times longer than wide', () => {
    const sq = plan.stats.square, edge = 8;
    expect(sq.w / sq.d).toBeGreaterThan(2.2);
    const tall = plan.boxes.filter((b) => b.z1 > 6 && inRect([b.x + b.w / 2, b.y + b.d / 2], { x: sq.x + edge, y: sq.y + edge, w: sq.w - 2 * edge, d: sq.d - 2 * edge }));
    expect(tall.map((b) => b.building)).toEqual([]);
  });

  it('the square\'s furniture at 79: Pliny\'s statues and columns by the Rostra, Ianus shut, Surdinus\'s letters as written; no festival unless asked', () => {
    for (const id of ['octavian-equestrian', 'sibyls-hercules', 'columna-duilius', 'columna-octavian', 'ianus-geminus', 'venus-cloacina', 'lapis-niger', 'surdinus-inscription', 'curtius-relief', 'tribunal-praetoris', 'juturna-dioscuri', 'vortumnus', 'caesar-loricata', 'concord-statues']) expect(plan.stats.states, id).toHaveProperty(id);
    const ianus = plan.boxes.filter((b) => b.building === 'ianus-geminus' && b.kind === 'door');
    expect(ianus.length).toBe(4);                                       // two leaves at each end, shut
    const letters = plan.boxes.filter((b) => b.building === 'surdinus-inscription');
    expect(letters.length).toBeGreaterThan(40);
    for (const l of letters) expect(l.z1).toBeLessThan(0.1);            // flush in the paving
    const span = Math.max(...letters.map((l) => l.x + l.w)) - Math.min(...letters.map((l) => l.x));
    expect(span).toBeGreaterThan(6); expect(span).toBeLessThan(14);
    expect(plan.boxes.some((b) => b.kind === 'shield' || b.kind === 'garland')).toBe(false);
    const fest = planHistoricCity({ culture: 'forum', festival: true });
    expect(fest.boxes.filter((b) => b.kind === 'shield').length).toBeGreaterThan(30);
    expect(fest.boxes.some((b) => b.kind === 'garland')).toBe(true);
  });

  it('the Basilica Julia is open: a nave of the record\'s 82 × 16 m floored in coloured marble, gaming boards in its aisle, its podium reached by steps', () => {
    const r = mon('basilica-julia').rect, nave = plan.grounds.filter((g) => g.surface === 'opus-sectile');
    expect(nave.length).toBe(1);
    expect([nave[0].w, nave[0].d]).toEqual([82, 16]);
    expect(nave[0].z).toBeGreaterThan(0.9);                                                      // on the podium
    expect(plan.grounds.some((g) => g.surface === 'lusoria' && inRect([g.x + g.w / 2, g.y + g.d / 2], r))).toBe(true);
    // nothing solid stands in the nave below the clerestory: it is a hall to walk in
    const n = nave[0], inNave = plan.boxes.filter((b) => b.building === 'basilica-julia' && b.z1 > n.z + 0.05 && b.z0 < 10 && b.kind !== 'truss' && overlap(b, { x: n.x + 0.5, y: n.y + 0.5, w: n.w - 1, d: n.d - 1 }));
    expect(inNave.map((b) => b.kind)).toEqual([]);
    const steps = plan.boxes.filter((b) => b.building === 'basilica-julia' && b.kind === 'stair');
    expect(steps.length).toBe(5);
    expect(Math.max(...steps.map((b) => b.z1 - b.z0))).toBeLessThan(1);
  });

  it('roofs are tiled: imbrices in rows, antefixes at the eaves, a soffit under each slope', () => {
    const roof = plan.boxes.filter((b) => b.building === 'castor');
    expect(roof.filter((b) => b.kind === 'antefix').length).toBeGreaterThan(100);
    expect(roof.filter((b) => b.kind === 'soffit').length).toBe(2);
    expect(plan.boxes.filter((b) => b.building === 'capitoline-jupiter').length).toBe(0);   // a World-only backdrop
  });

  it('repeats: every part is one template of solids, stood many times; a turned part is its own template', () => {
    expect(plan.stats.templates).toBe(plan.repeats.length);
    expect(plan.stats.instances).toBeGreaterThan(300);
    for (const r of plan.repeats) { expect(r.transforms.length).toBeGreaterThan(0); for (const m of r.template) expect(m.solid, `${r.key} ${m.kind}`).toBeTruthy(); }
    // entablature runs and arcade bays are keyed by their turn; columns never turn
    expect(plan.repeats.filter((r) => r.key.startsWith('col:')).every((r) => !/:[1-3]$/.test(r.key))).toBe(true);
    expect(new Set(plan.repeats.filter((r) => r.key.startsWith('ent:')).map((r) => r.key.slice(-1))).size).toBe(4);
    // a quarter turn is a turn: four of them come back to the start
    const m = [{ kind: 't', solid: 'frustum', x: 1, y: 2, w: 3, d: 4, z0: 0, z1: 1, top: { x: 1, y: 2, w: 3, d: 4 } }];
    expect(turnMasses(turnMasses(m, 2), 2)[0]).toMatchObject({ x: 1, y: 2, w: 3, d: 4 });
    expect(turnMasses(m, 1)[0]).toMatchObject({ x: -6, y: 1, w: 4, d: 3 });
  });

  it('assembles: the World page draws the parts as instances; the CSS page their stand-ins', () => {
    const w = assembleHistoricWorld({ culture: 'forum', view: 'forum' });
    expect(w.repeats.length).toBe(plan.repeats.length);
    expect(w.repeats.every((r) => r.template.length > 0 && r.transforms.length > 0)).toBe(true);
    expect(w.cameras[0].name).toBe('forum');
    const css = assembleHistoricCityScene({ culture: 'forum' });
    expect(css.repeats).toBeUndefined();
    // the stand-ins: a column's drum on the CSS page, the full column only in the World's template
    const lows = plan.repeats.filter((r) => !r.world).reduce((n, r) => n + r.transforms.length * r.low.length, 0);
    expect(lows).toBeGreaterThan(300);
    expect(css.faces.length).toBeGreaterThan(lows);
  }, 60000);
});
