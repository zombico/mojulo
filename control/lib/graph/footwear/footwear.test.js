// footwear.test.js — the library on a stub foot adapter (a box foot, toes and shank, each a ring per station): the parts
// read nothing of a body but its adapter. The sole split at the toe base and under the foot, the straps at their shares
// with a buckle on the outer side, a sandal with no upper, a part not asked for adding nothing, the same twice.
import { describe, it, expect } from 'vitest';

import { wearFootwear, validateFootwear, footwearCard, readTones, SKINS } from './index.js';
import { compileLayered, auditLayered } from '../polygonizer/station-loft.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';

// a ring of 8 round `c` in ring order (ringSlots: `front` first, the R side on +x): level (the shank's, its front +y), or
// square to y (the foot's and the toes', `rz` its half height, its front on top)
const SL = ringSlots(8);
const ring = (c, rx, rz, level) => Object.fromEntries(SL.map((nm, j) => { const a = (2 * Math.PI * j) / 8;
  return [nm, level ? [c[0] + rx * Math.sin(a), c[1] + rz * Math.cos(a), c[2]] : [c[0] + rx * Math.sin(a), c[1], c[2] + rz * Math.cos(a)]]; }));
// a segment from `from` to `to`, 9 stations, u 0 … 2
const seg = (bone, from, to, rx, rz) => ({ layer: 0, closure: 'closed', slots: SL,
  stations: Array.from({ length: 9 }, (_, i) => ({ id: `st${i}`, u: i / 4, points: ring(from.map((x, q) => x + ((to[q] - x) * i) / 8), rx, rz, from[2] !== to[2]) })),
  caps: { back: from, tip: to }, bind: { bone } });
// (the foot and the toes: rings in the xz plane, square to y; the shank: rings level)
const skin = { footR: seg('footR', [0.1, 0, 0.03], [0.1, 0.12, 0.03], 0.04, 0.03), toesR: seg('toesR', [0.1, 0.12, 0.03], [0.1, 0.2, 0.03], 0.035, 0.03), shankR: seg('shankR', [0.1, 0, 0.45], [0.1, 0, 0.06], 0.045, 0.045) };
const stub = { sides: ['R'], seg: (kind, S) => `${kind}${S}`, joints: () => ({ ankle: [0.1, 0, 0.06], toeBase: [0.1, 0.12, 0.02], toeTip: [0.1, 0.2, 0.015] }),
  bare: (name) => skin[name], u: (_k, share) => 2 * share,
  upper: (sock, { id, group }) => Object.fromEntries(['footR', 'toesR', ...(sock.height === 'boot' ? ['shankR'] : [])].map((n) => [`${id}_${n}`, { ...skin[n], layer: 1, group }])) };

describe('footwear on a foot adapter', () => {
  it('a shoe: its upper, a sole under the foot and the toes split at the toe base, a strap and its buckle outside', () => {
    const W = wearFootwear(stub, { sock: { height: 'shoe' }, sole: { thick: 0.008, welt: 0.003 }, adorn: [{ prim: 'strap', on: 'foot', at: 0.5, buckle: true }] }, { id: 'shoe' });
    expect(Object.keys(W.parts).sort()).toEqual(['shoeBuckle0_footR', 'shoeSole_footR', 'shoeSole_toesR', 'shoeStrap0_footR', 'shoe_footR', 'shoe_toesR']);
    const ys = (P) => P.stations.flatMap((s) => Object.values(s.points)).map((p) => p[1]);
    expect(Math.max(...ys(W.parts.shoeSole_footR))).toBeLessThan(Math.min(...ys(W.parts.shoeSole_toesR)) + 0.02);
    for (const k of ['shoeSole_footR', 'shoeSole_toesR']) expect(Object.values(W.parts[k].stations[0].points)[0][2]).toBeCloseTo(0, 6);
    // the buckle on the right foot's outer (+x) side of its strap
    const bx = Object.values(W.parts.shoeBuckle0_footR.stations[0].points)[0][0];
    expect(bx).toBeGreaterThan(0.1);
    expect(Object.keys(W.tones).sort()).toEqual(['Brass', 'Sole', 'Strap']);   // the groups it laid, no more
  });

  it('a sandal has no upper, its straps on the bare foot; what is not asked for adds nothing; the same twice', () => {
    const spec = { sock: false, sole: { thick: 0.01, welt: 0.004 }, adorn: [{ prim: 'strap', on: 'foot', at: 0.3 }] };
    const W = wearFootwear(stub, spec, { id: 'sandal' });
    expect(Object.keys(W.parts).sort()).toEqual(['sandalSole_footR', 'sandalSole_toesR', 'sandalStrap0_footR']);
    expect(W.parts.sandalStrap0_footR.bind.bone).toBe('footR');
    expect(JSON.stringify(wearFootwear(stub, spec, { id: 'sandal' }))).toBe(JSON.stringify(W));
  });

  it('a steel toe: a shell over the toe box outside the sock, closed at the tip, kept over the sole; rivets on its edge', () => {
    const W = wearFootwear(stub, { sock: { height: 'boot', shaft: 0.3 }, sole: { thick: 0.012, welt: 0.004 }, adorn: [{ prim: 'toeCap', rivets: 2 }, { prim: 'cuff' }, { prim: 'band', on: 'shank', at: 0.9 }] }, { id: 'work' });
    const cap = W.parts.workToeCap_toesR, under = skin.toesR;
    expect(cap.group).toBe('Steel');
    expect(cap.caps.tip[1]).toBeGreaterThan(0.2);   // the teacup's front past the toe tip
    const z = Object.values(cap.stations).flatMap((st) => Object.values(st.points)).map((p) => p[2]);
    expect(Math.min(...z)).toBeGreaterThanOrEqual(0.006 - 1e-9);   // never under the sole's middle
    // one piece over the toes, carried by them; outside them: wider than the toes anywhere along them
    expect(W.parts.workToeCap_footR).toBeUndefined();
    expect(cap.bind.bone).toBe('toesR');
    const halfW = (pts) => Math.max(...pts.map((p) => Math.abs(p[0] - 0.1)));
    expect(halfW(cap.stations.flatMap((st) => Object.values(st.points)))).toBeGreaterThan(halfW(under.stations.flatMap((st) => Object.values(st.points))));
    // the sock's toes under it tucked inside: none of its points past the cap's reach across
    const sock = W.parts.work_toesR.stations.flatMap((st) => Object.values(st.points));
    expect(halfW(sock)).toBeLessThan(halfW(cap.stations.flatMap((st) => Object.values(st.points))));
    expect(sock).not.toEqual(skin.toesR.stations.flatMap((st) => Object.values(st.points)));
    const A = auditLayered(compileLayered({ schema: 'layered-v1', frame: { up: 'z' }, dials: {}, parts: { cap: { ...cap, bind: undefined } } }, {}, { details: false, creases: false }));
    for (const k of ['cap']) { expect(A[k].pass, k).toBe(true); expect(A[k].windingErrors, k).toBe(0); }
    const rivets = Object.keys(W.parts).filter((k) => k.startsWith('workRivet'));
    expect(rivets.length).toBeGreaterThan(0);
    for (const k of rivets) expect(W.parts[k].bind.bone).toBe('toesR');
    expect(W.parts.workCuff_shankR.group).toBe('Cuff');
    expect(W.parts.workBand0_shankR.group).toBe('Gilt');
    expect(Object.keys(W.tones).sort()).toEqual(['Cuff', 'Gilt', 'Sole', 'Steel']);
  });

  it('a layered sole: its layers stacked from the floor, each in its group; a pod at the heel proud of its layer', () => {
    const card = { family: 'sneaker', sock: { height: 'shoe' }, sole: { layers: [{ thick: 0.004, welt: 0.004, group: 'Outsole' }, { thick: 0.02, welt: 0.005, group: 'Midsole', pod: { to: 0.4 } }] } };
    const W = wearFootwear(stub, card, { id: 'run' }), lo = (P, k) => Object.values(P.stations[k].points)[0][2];
    expect(W.parts.runSole_footR.group).toBe('Outsole');
    expect(W.parts.runSole1_footR.group).toBe('Midsole');
    expect(lo(W.parts.runSole1_footR, 0)).toBeCloseTo(lo(W.parts.runSole_footR, 1), 6);   // the midsole on the outsole
    const pod = W.parts.runPod1_footR, ys = (P) => P.stations.flatMap((st) => Object.values(st.points)).map((p) => p[1]);
    expect(pod.group).toBe('Air');
    expect(Math.max(...ys(pod))).toBeLessThan(Math.max(...ys(W.parts.runSole1_footR)));   // at the heel, not the whole print
    expect(W.parts.runPod1_toesR).toBeUndefined();
    expect(Object.keys(W.tones).sort()).toEqual(['Air', 'Midsole', 'Outsole']);
  });

  it('cut as a cobbler: the tongue down the centre and above the collar, a matching pair of quarters, laces across', () => {
    const W = wearFootwear(stub, { family: 'sneaker', sock: { height: 'shoe' }, sole: { thick: 0.01, welt: 0.003 },
      adorn: [{ prim: 'panel', region: 'tongue', rise: 0.01 }, { prim: 'panel', region: 'quarter' }, { prim: 'panel', region: 'eyestay', lift: 0.004 }, { prim: 'laces', rows: 4 }] }, { id: 'snk' });
    const pts = (P) => P.stations.flatMap((st) => Object.values(st.points)), xs = (P) => pts(P).map((p) => p[0] - 0.1);
    const T = W.parts.snkTongue_footR;
    expect(Math.max(...pts(T).map((p) => p[2]))).toBeGreaterThan(0.06);   // on top, over the instep
    expect(T.stations.length).toBe(stub.bare('footR').stations.filter((st) => st.u <= 2 * 0.84 + 1e-9).length + 1);   // and risen past its first ring
    // the quarters a matching pair, the lateral on the right foot's outer (+x) side, the medial mirrored
    const lat = W.parts.snkQuarterLat_footR, med = W.parts.snkQuarterMed_footR;
    expect(Math.min(...xs(lat))).toBeGreaterThan(0);
    expect(Math.max(...xs(med))).toBeLessThan(0);
    expect(Math.abs(Math.max(...xs(lat)) + Math.min(...xs(med)))).toBeLessThan(1e-6);
    expect(Math.max(...xs(T).map(Math.abs))).toBeLessThan(Math.max(...xs(lat)));   // the tongue down the centre, narrower than the sides
    expect([lat.group, T.group, W.parts.snkEyestayLat_footR.group]).toEqual(['Overlay', 'Tongue', 'Eyestay']);
    const laces = Object.keys(W.parts).filter((k) => k.startsWith('snkLace'));
    expect(laces.length).toBe(6);   // two bars between each of the four rows
    for (const k of laces) { expect(W.parts[k].group).toBe('Lace'); expect(Math.min(...pts(W.parts[k]).map((p) => p[2]))).toBeGreaterThan(0.045); }   // over the top half
    const A = auditLayered(compileLayered({ schema: 'layered-v1', frame: { up: 'z' }, dials: {}, parts: { t: { ...T, bind: undefined }, q: { ...lat, bind: undefined } } }, {}, { details: false, creases: false }));
    for (const k of ['t', 'q']) { expect(A[k].pass, k).toBe(true); expect(A[k].windingErrors, k).toBe(0); }
  });

  it('a variety is its kin and a few keys; a colourway recolours any card; a heel and a tread are sole patterns', () => {
    const kin = { family: 'sneaker', sock: { height: 'shoe', collar: 0.1 }, sole: { thick: 0.01, welt: 0.003 }, adorn: [{ prim: 'panel', region: 'quarter' }], tones: { Overlay: '#112233' } };
    const C = footwearCard({ from: kin, sock: { thick: 0.006 }, adornPlus: [{ prim: 'panel', region: 'counter' }], skin: 'volt' });
    expect(C.sock).toEqual({ height: 'shoe', collar: 0.1, thick: 0.006 });   // merged
    expect(C.adorn.map((a) => a.region)).toEqual(['quarter', 'counter']);   // appended
    expect(C.tones.Overlay).toBe(SKINS.volt.Overlay);   // the skin over the card's own
    const W = wearFootwear(stub, { from: kin, skin: 'volt' }, { id: 'v' });
    expect(W.named).toEqual(expect.arrayContaining(['Overlay', 'Shoes']));
    expect(W.tones.Overlay).toBe(SKINS.volt.Overlay);
    // the same parts as the card in its own colours: a skin is colour alone
    const plain = wearFootwear(stub, kin, { id: 'v' });
    expect(Object.keys(W.parts)).toEqual(Object.keys(plain.parts));
    expect(JSON.stringify(W.parts)).toBe(JSON.stringify(plain.parts));
    // a heel block under the print's rear, taller than its layer; lugs round the outsole
    const D = wearFootwear(stub, { sock: { height: 'shoe' }, sole: { layers: [{ thick: 0.006, welt: 0.004, heel: { to: 0.3, thick: 0.024 }, lugs: { every: 4 } }] } }, { id: 'd' });
    const hz = D.parts.dHeel0_footR.stations.map((st) => Object.values(st.points)[0][2]), ys = (P) => P.stations.flatMap((st) => Object.values(st.points)).map((p) => p[1]);
    expect(hz[1] - hz[0]).toBeCloseTo(0.024, 6);
    expect(Math.max(...ys(D.parts.dHeel0_footR))).toBeLessThan(Math.max(...ys(D.parts.dSole_footR)) - 0.02);
    expect(D.parts.dHeel0_toesR).toBeUndefined();
    expect(Object.keys(D.parts).filter((k) => k.startsWith('dLug')).length).toBeGreaterThan(2);
  });

  it('a tone of the leather follows the leather: recolour the shoes and the pieces cut from them follow, in their shades', () => {
    const P = readTones({ Shoes: '#804020', Cap: { of: 'Shoes', shade: -0.5 }, Lift: { of: 'Cap', shade: 0.5 }, Lace: '#111111' });
    expect(P).toEqual({ Shoes: '#804020', Cap: '#402010', Lift: '#a09088', Lace: '#111111' });
    expect(readTones({ Shoes: '#ffffff', Cap: { of: 'Shoes', shade: -0.5 } }).Cap).toBe('#808080');
    expect(readTones({ Cap: { of: 'Nothing', shade: 0 } }).Cap).toBe('#808080');   // a group it names missing: a mid grey
    expect(validateFootwear({ sock: { height: 'shoe' }, tones: { Cap: { of: 'Shoes', shade: -2 } } })[0]).toMatch(/tones.Cap: '#rrggbb', or \{ of/);
  });

  it('refuses a card by name', () => {
    expect(validateFootwear({ sock: { height: 'shoe' }, adorn: [{ prim: 'panel', region: 'pullLoop' }] })[0]).toMatch(/region: one of tongue, eyestay/);
    expect(validateFootwear({ from: 'runners', skin: 'neon' })[0]).toMatch(/skin: a colourway \(tripleBlack/);
    expect(validateFootwear({ from: 'runners', colour: 'red' })[0]).toMatch(/not 'colour'/);
    expect(validateFootwear({ family: 'clog', sole: { thick: 0.01, layers: [{ thick: 0 }] } })).toEqual(['footwear.family: one of shoe, boot, sandal, sneaker, dress',
      'footwear.sole.layers[0].thick: metres, over 0 and at most 0.1', 'footwear.sole: layers, or thick and welt (one layer), not both']);
    expect(validateFootwear('clogs')[0]).toMatch(/'clogs' is not a footwear word/);
    expect(validateFootwear({ sock: false, adorn: [{ prim: 'toeCap' }] })[0]).toMatch(/worn on the sock; this card has none/);
    expect(validateFootwear({ sock: { height: 'boot' }, adorn: [{ prim: 'strap', on: 'hand', at: 2, colour: 1 }] })).toEqual([
      "footwear.adorn[0]: strap takes on, at, width, lift, buckle, group, not 'colour'", 'footwear.adorn[0].on: foot or shank', 'footwear.adorn[0].at: a share, 0 to 1']);
    expect(() => wearFootwear(stub, 'clogs')).toThrow(/clogs/);
  });
});
