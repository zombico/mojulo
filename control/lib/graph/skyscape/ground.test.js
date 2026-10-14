import { describe, it, expect } from 'vitest';
import { planMap, MAP_FORMS } from './map.js';
import { mapGround, readGroundAsk, PAD_KINDS } from './ground.js';
import { HEARTBEAT_IDS, HEARTBEAT_PRESETS } from '../era/heartbeat.js';
import { terrainKernel } from '../terrain/terrain-kernel.js';

// the smallest map that still has every ring: a small field, the slowest craft
const small = (form) => planMap({ form, field: 1200, craft: 'glider' });
const pick = (test) => Object.keys(MAP_FORMS).find((k) => test(MAP_FORMS[k]));
const seaForm = pick((f) => f.sea), wallForm = pick((f) => f.wall && !f.axis);
// a heartbeat with a raise mark, chosen from the presets by what it holds
const raiseBeat = HEARTBEAT_IDS.find((id) => HEARTBEAT_PRESETS[id].marks.some((m) => m.op === 'raise'));

const decode = (b, T) => { const u = Buffer.from(b, 'base64'); return new T(u.buffer, u.byteOffset, u.byteLength / T.BYTES_PER_ELEMENT); };

describe('the map\'s ground', () => {
  it('is the same ground on the page as on the server', () => {
    const f = mapGround(small(seaForm), { pads: [{ at: [0.5, 0.5] }] });
    const P = f.pageConfig();
    const K = { ...P, hq: decode(P.grids.hq, Uint16Array), hard: decode(P.grids.hard, Uint8Array), apron: decode(P.grids.apron, Uint8Array),
      grade: P.grade.map((L) => ({ ...L, dq: decode(L.dq, Uint16Array), w: decode(L.w, Uint8Array), paint: L.paint && { ...L.paint, pc: decode(L.paint.pc, Uint8Array) } })) };
    const page = terrainKernel(K);
    for (const [x, y] of [[0, 0], [310, -420], [-900, 700], [5000, 5000]]) expect(page.heightAt(x, y)).toBe(f.heightAt(x, y));
  });

  it('lays a runway flat to its datum, whatever the detail round it', () => {
    const f = mapGround(small(wallForm), { pads: [{ kind: 'runway', at: [0.5, 0.4] }] });
    const p = f.pads[0];
    for (const t of [0.1, 0.5, 0.9]) {
      const y = p.y0 + t * (p.y1 - p.y0);
      expect(f.heightAt(p.center[0], y)).toBe(p.datum);
      expect(f.heightAt(p.x0 + 1, y)).toBe(p.datum);
    }
  });

  it('lays a heartbeat at the pilot\'s scale: its marks change the ground by its metres times the scale', () => {
    const map = small(wallForm);
    const plain = mapGround(map, {}), beat = mapGround(map, { heartbeat: raiseBeat, scale: 20 });
    const m = HEARTBEAT_PRESETS[raiseBeat].marks.find((x) => x.op === 'raise');
    const F = map.rings.field, x = -F.hx + m.at[0] * 2 * F.hx, y = -F.hy + m.at[1] * 2 * F.hy;
    const dz = beat.kernel.macroZ(x / beat.K.s, y / beat.K.s) * beat.K.zs - plain.kernel.macroZ(x / plain.K.s, y / plain.K.s) * plain.K.zs;
    expect(dz).toBeGreaterThan(m.height * 20 * 0.5);
    expect(beat.report.marks).toBeGreaterThan(0);
  });

  it('sinks an island into its sea past the reach, and rings a basin with its wall', () => {
    const isl = small(seaForm), fi = mapGround(isl, {});
    expect(fi.heightAt(isl.rings.reach.hx * 1.5, 0)).toBeLessThan(fi.meta.sea);
    const bas = small(wallForm), fb = mapGround(bas, {});
    expect(fb.heightAt(bas.rings.reach.hx, 0)).toBeGreaterThan(fb.heightAt(0, 0) + bas.backdrop.wall * 0.5);
  });

  it('teaches on a bad ask', () => {
    expect(readGroundAsk({ land: 'swamp' })[0]).toMatch(/ground.land must be one of/);
    expect(readGroundAsk({ pads: [{ kind: 'heliport', at: [0.5, 0.5] }] })[0]).toMatch(new RegExp(Object.keys(PAD_KINDS).join(', ')));
    expect(readGroundAsk({ heartbeat: 'no-such-beat' })[0]).toMatch(/ground.heartbeat/);
  });

  it('lays every mark kind a heartbeat preset holds without a hole in the ground', () => {
    // one preset per mark kind, chosen from the presets: the path marks (cliff, gorge, ridge) take defaults the area ones do not
    const ops = [...new Set(HEARTBEAT_IDS.flatMap((id) => HEARTBEAT_PRESETS[id].marks.map((m) => m.op)))];
    for (const op of ops) {
      const id = HEARTBEAT_IDS.find((k) => HEARTBEAT_PRESETS[k].marks.some((m) => m.op === op));
      const f = mapGround(small(seaForm), { heartbeat: id });
      expect(f.report.relief.every(Number.isFinite), `${op} (${id})`).toBe(true);
    }
  });

  it('is deterministic', () => {
    const a = mapGround(small(seaForm), { heartbeat: raiseBeat, seed: 3 }).pageConfig();
    const b = mapGround(small(seaForm), { heartbeat: raiseBeat, seed: 3 }).pageConfig();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
