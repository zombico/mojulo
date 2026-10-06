import { describe, it, expect } from 'vitest';
import { FUNCTIONS, STRATEGIES, CAPABILITIES, TAGS, INVENTORY, PROVENANCE, ROUTES, PROBES, resolve, repertoire, coverage, permits } from './index.js';
import { BEARINGS, ISO_SIZES, NEMA, BOARDS, hasMech } from './mech-tables.js';
import { hardwarePart } from '../construction/hardware.js';
import { FURNITURE_JOINTS } from '../construction/furniture-joints.js';

// The fabricator contract: one word per job a part does, resolved for every need from the shelf first, from scratch last,
// and never past what a part's provenance allows.

const all = Object.entries(STRATEGIES).flatMap(([fn, list]) => list.map((s) => ({ fn, s })));

describe('fabricator: the tables it reads', () => {
  it('reads the mechanical library\'s rows, not a copy of them', () => {
    expect(BEARINGS['608']).toMatchObject({ bore: 8, od: 22, width: 7, linear: false });
    expect(BEARINGS.LM8UU).toMatchObject({ bore: 8, od: 15, linear: true });
    expect(ISO_SIZES.M3).toMatchObject({ d: 3, heatset: 4 });
    expect(ISO_SIZES.M10.heatset).toBe(0);
    expect(NEMA[17]).toMatchObject({ boltSquare: 31, pilot: 22, screw: 'M3', shaft: 5 });
    expect(BOARDS).toContain('rpi4');
  });
});

describe('fabricator: the vocabulary', () => {
  it('every strategy is written in the declared words, and every function ends on a bare mint', () => {
    for (const fn of Object.keys(FUNCTIONS)) expect(STRATEGIES[fn], fn).toBeDefined();
    for (const [fn, list] of Object.entries(STRATEGIES)) {
      expect(FUNCTIONS[fn], fn).toBeDefined();
      const seen = new Set();
      for (const s of list) {
        expect(seen.has(s.id), `${fn}: duplicate ${s.id}`).toBe(false); seen.add(s.id);
        expect(s.line?.length > 0, `${fn}.${s.id} line`).toBe(true);
        for (const [k, v] of Object.entries(s.needs || {})) {
          expect(CAPABILITIES[k], `${fn}.${s.id} needs ${k}`).toBeDefined();
          for (const x of v) expect(CAPABILITIES[k].values, `${fn}.${s.id} ${k}=${x}`).toContain(x);
        }
        for (const t of [...(s.when || []), ...(s.unless || [])]) expect(TAGS[t], `${fn}.${s.id} tag ${t}`).toBeDefined();
        for (const u of s.uses || []) {
          expect(INVENTORY[u.part], `${fn}.${s.id} uses ${u.part}`).toBeDefined();
          expect(['buy', 'fit', 'print'], `${fn}.${s.id} route`).toContain(u.route);
        }
        for (const m of s.kit || []) expect(hasMech(m), `${fn}.${s.id} kit ${m}`).toBe(true);
        if (!s.uses) expect(s.principle, `${fn}.${s.id}: a part-less strategy states its principle`).toBeTruthy();
        if (s.joint) {
          expect(FURNITURE_JOINTS, `${fn}.${s.id}: joint ${s.joint.type} is a furniture joint`).toContain(s.joint.type);
          expect(s.needs?.host, `${fn}.${s.id}: a frame joint is a wood strategy`).toEqual(['wood']);
        }
      }
      const last = list[list.length - 1];
      expect(last.id, fn).toBe(`mint-${fn}`);
      expect(!last.needs && !last.when && !last.unless && !last.uses, `${fn}: last strategy is not a bare mint`).toBe(true);
    }
  });

  it('every tag and every capability value is read by some strategy', () => {
    const tags = new Set(all.flatMap(({ s }) => [...(s.when || []), ...(s.unless || [])]));
    for (const t of Object.keys(TAGS)) expect(tags.has(t), `tag '${t}' is read by no strategy`).toBe(true);
    for (const k of Object.keys(CAPABILITIES)) expect(all.some(({ s }) => s.needs?.[k]), `capability '${k}' is read by no strategy`).toBe(true);
  });
});

describe('fabricator: the inventory and its provenance', () => {
  it('every row has a tier, and names its family where it already lives', () => {
    for (const row of Object.values(INVENTORY)) {
      expect(PROVENANCE[row.provenance], `${row.id} provenance`).toBeDefined();
      if (row.hardware) expect(hardwarePart(row.hardware), `${row.id} hardware ${row.hardware}`).not.toBeNull();
      for (const m of [row.fit, row.print].filter(Boolean)) expect(hasMech(m), `${row.id} ${m}`).toBe(true);
      if (row.provenance === 'standard') expect(row.standard, `${row.id}: a standard row cites its standard`).toBeTruthy();
      if (row.provenance === 'open') expect(row.licence, `${row.id}: an open row carries its licence`).toBeTruthy();
    }
    for (const { fn, s } of all) for (const u of s.uses || []) {
      if (u.route === 'buy') expect(INVENTORY[u.part].buy, `${fn}.${s.id}: ${u.part} is bought, so names its generic part`).toBeTruthy();
    }
  });

  it('a reference row names its owner and its nominative notice, and is never printed', () => {
    const refs = Object.values(INVENTORY).filter((r) => r.provenance === 'reference');
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(r.owner, r.id).toBeTruthy();
      expect(r.notice, r.id).toMatch(/trademark/);
      expect(r.print, `${r.id}: a reference row has no print module`).toBeUndefined();
      expect(permits(r, 'print').ok, r.id).toBe(false);
      expect(permits(r, 'buy').ok, r.id).toBe(true);
      expect(permits(r, 'fit').ok, r.id).toBe(r.interface === 'published');
    }
  });

  it('buy names a generic part: no reference owner\'s mark appears in a non-reference row', () => {
    const marks = ['GoPro', 'LEGO', 'IKEA', 'SKÅDIS', 'Arca', 'Raspberry', 'Arduino', 'V-Slot', 'Blum', 'Misumi', 'McMaster'];
    for (const row of Object.values(INVENTORY).filter((r) => r.provenance !== 'reference')) {
      for (const m of marks) expect(`${row.label} ${row.buy || ''}`.includes(m), `${row.id} names '${m}'`).toBe(false);
    }
  });
});

describe('fabricator: every need resolves', () => {
  it('every probe resolves, and every resolution keeps to its provenance', () => {
    for (const need of PROBES) {
      const r = resolve(need);
      expect(r.strategy, JSON.stringify(need)).toBeTruthy();
      expect(r.why, JSON.stringify(need)).toBeTruthy();
      for (const p of r.parts) {
        expect(permits(INVENTORY[p.part], p.route).ok, `${r.strategy} ${p.part} ${p.route}`).toBe(true);
        if (p.code) expect(INVENTORY[p.part].codes === 'bearing' ? BEARINGS[p.code] : hardwarePart(p.code), `${r.strategy}: ${p.code}`).toBeTruthy();
        if (p.call) expect(hasMech(p.call.match(/^(mj_[a-z0-9_]+)/)?.[1] || '-'), `${r.strategy}: ${p.call}`).toBe(true);
        if (INVENTORY[p.part].provenance === 'reference') expect(r.notices.join(' '), r.strategy).toMatch(/trademark/);
      }
    }
  });

  it('the shelf first: a printed joint opened often takes heat-set inserts, a 608 carries an 8 mm shaft', () => {
    const j = resolve({ function: 'fasten', host: 'printed', tags: ['serviceable'] });
    expect(j.strategy).toBe('heatset-bolt');
    expect(j.parts.map((p) => p.code || p.call)).toEqual(['mj_heatset_hole("M3", 6)', 'M3x16-socket', 'mj_counterbore("M3", 10)']);
    const b = resolve({ function: 'spin', shaftD: 8 });
    expect(b.strategy).toBe('ball-bearing');
    expect(b.parts[0].code).toBe('688');
    expect(resolve({ function: 'spin', shaftD: 8, tags: ['print-only'] }).strategy).toBe('printed-bushing');
    expect(resolve({ function: 'spin', shaftD: 9, loadN: 300 }).route).toBe('mint');
  });

  it('a reference system is bought or fitted, never printed, and the refusal is said', () => {
    const cam = resolve({ function: 'mount', to: 'action-cam' });
    expect(cam.strategy).toBe('action-cam-adapter');
    expect(cam.refused.map((x) => x.strategy)).toContain('action-cam-print');
    expect(cam.notices.join(' ')).toMatch(/GoPro is a trademark/);
    const pi = resolve({ function: 'mount', to: 'board', board: 'rpi4' });
    expect(pi.strategy).toBe('rpi');
    expect(pi.parts[0]).toMatchObject({ route: 'fit', call: 'mj_board_standoffs("rpi4", 5, insert = true)' });
    expect(resolve({ function: 'mount', to: 'board', board: 'esp32-devkit' }).route).toBe('mint');
  });

  it('an open system carries its licence into what is made', () => {
    expect(resolve({ function: 'store' }).notices.join(' ')).toMatch(/MIT licence/);
  });

  it('the repertoire lists every way, the resolver\'s choice first and the mint last', () => {
    const rep = repertoire({ function: 'fasten', host: 'printed', cycles: 200 });
    expect(rep[0].strategy).toBe(resolve({ function: 'fasten', host: 'printed', cycles: 200 }).strategy);
    expect(rep[rep.length - 1].route).toBe('mint');
    expect(new Set(rep.map((r) => r.strategy)).size).toBe(rep.length);
  });

  it('coverage counts the shelf, the principles and the bare mints, and names every gap', () => {
    const c = coverage();
    expect(c.shelf + c.principle + c.minted).toBe(c.total);
    expect(c.gaps.length).toBe(c.minted);
    expect(c.shelf / c.total).toBeGreaterThan(0.6);
    for (const r of Object.keys(ROUTES)) expect(typeof ROUTES[r]).toBe('string');
  });
});
