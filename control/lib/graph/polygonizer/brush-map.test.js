import { describe, expect, it } from 'vitest';

import { compileLayered, auditLayered, addressPin } from './station-loft.js';
import { frameAt, address } from './station-loft-detail.js';
import { resolveStroke, cameraRecord, strokeCamera } from './stroke-resolve.js';
import { brushDial, dialsFrom } from './brush-map.js';
import { projectVertices } from '../scene/wire-svg.js';

// a three-station body refined enough to have points under a brush
const body = {
  layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], group: 'Body',
  stations: [0, 0.5, 1, 1.5, 2].map((y, i) => ({ id: `st${i}`, points: { top: [0, y, 1], sideR: [1, y, 0.5], bottom: [0, y, 0], sideL: [-1, y, 0.5] } })),
  caps: { back: [0, -0.5, 0.5], tip: [0, 2.5, 0.5] },
};
const spike = { layer: 2, closure: 'closed', group: 'Spike', follow: true, pin: { parent: 'body', face: 'body/st1-st2.k0.a', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['body/st1.top', 'body/st1.sideR'], handedness: 1 }, offsets: { b0: [0.05, 0, 0], b1: [0, 0.05, 0], b2: [-0.05, 0, 0], apex: [0, 0, 0.2] }, faces: { base: ['b0', 'b2', 'b1'], s0: ['b0', 'b1', 'apex'], s1: ['b1', 'b2', 'apex'], s2: ['b2', 'b0', 'apex'] } };
const recipe = { frame: { up: '+z', front: '+y' }, dials: { width: { min: 0.5, max: 2, rest: 1, op: 'scale', axis: 'x', pivot: 0, parts: ['body'], blend: { st0: 1, st1: 1, st2: 1, st3: 1, st4: 1 } } }, parts: { body, spike } };
const at = (m) => Object.fromEntries(m.pointIds.map((id, i) => [id, m.vertices[i]]));

function brush(view, ats, side = 'R', extra = {}) {
  const mesh = compileLayered(recipe, {}, { details: false }); const camera = cameraRecord(mesh, view); const cam = strokeCamera({ view, camera }, mesh);
  const pts = projectVertices(ats.map((a) => frameAt(mesh.parts, 'body', a, side).origin), cam).map(([x, y]) => [x / cam.size, y / cam.size, 0.8]);
  const stroke = { id: 'b1', view, intent: 'brush', points: pts, camera, ...extra }; return { mesh, stroke, resolved: resolveStroke(mesh, stroke) };
}

describe('brush-map — a brush stroke becomes a brush dial (a skin map that replays)', () => {
  it('addressPin is the grammar\'s own: station-loft-detail\'s address delegates to it byte for byte', () => {
    const m = compileLayered(recipe, {}, { details: false });
    expect(address(m.parts, 'body', 1.3, 0.6, 'L')).toEqual(addressPin(m.parts.body, 'body', 1.3, 0.6, 'L'));
  });

  it('the brush dial pushes the carrier\'s points near the addresses along the normal, with a falloff, and nothing far away', () => {
    const { mesh, stroke, resolved } = brush('lateral', [[1.0, 1.0], [2.0, 1.0], [3.0, 1.0]]);
    const made = brushDial(mesh, stroke, resolved, { amp: 0.1, radius: 0.9 });
    expect(made.name).toBe('stroke.b1'); expect(made.dial.op).toBe('brush'); expect(made.entries).toBe(3); expect(made.dial.from).toBe('b1');
    const R = { ...recipe, dials: { ...recipe.dials, [made.name]: made.dial } };
    const P0 = at(compileLayered(R, { [made.name]: 0 })), P1 = at(compileLayered(R, { [made.name]: 1 }));
    expect(P1['body/st2.sideR'][0]).toBeGreaterThan(P0['body/st2.sideR'][0] + 0.02);   // the flank under the brush moved outward
    expect(P1['body/st0.sideL']).toEqual(P0['body/st0.sideL']);                        // the far side did not
    expect(P1['body/st2.sideR'][0] - P0['body/st2.sideR'][0]).toBeGreaterThan(P1['body/st0.sideR'][0] - P0['body/st0.sideR'][0]);   // falloff
    expect(Object.values(auditLayered(compileLayered(R, { [made.name]: 1 }))).every((r) => r.pass)).toBe(true);
    expect(dialsFrom(R, 'b1')).toEqual(['stroke.b1']);
    const Pm = at(compileLayered(R, { [made.name]: -1 })); expect(Pm['body/st2.sideR'][0]).toBeLessThan(P0['body/st2.sideR'][0]);   // dialled inward
  });

  it('replays under another dial: widen the body and the brush still pushes the (now wider) flank; a follower rides it; mirror pushes both sides', () => {
    const { mesh, stroke, resolved } = brush('lateral', [[1.0, 1.0], [2.0, 1.0], [3.0, 1.0]]);
    const made = brushDial(mesh, stroke, resolved, { amp: 0.1, radius: 0.9 }); const R = { ...recipe, dials: { ...recipe.dials, [made.name]: made.dial } };
    const wide0 = at(compileLayered(R, { width: 1.6, [made.name]: 0 })), wide1 = at(compileLayered(R, { width: 1.6, [made.name]: 1 }));
    expect(wide1['body/st2.sideR'][0]).toBeGreaterThan(wide0['body/st2.sideR'][0] + 0.02); expect(wide0['body/st2.sideR'][0]).toBeCloseTo(1.6, 9);
    expect(wide1['spike/apex'][0]).toBeGreaterThan(wide0['spike/apex'][0]);   // the follower rode the push
    const twin = brushDial(mesh, { ...stroke, mirror: true }, resolved, { amp: 0.1, radius: 0.9 }); expect(twin.entries).toBe(6);
    const Rt = { ...recipe, dials: { ...recipe.dials, [twin.name]: twin.dial } }; const T0 = at(compileLayered(Rt, { [twin.name]: 0 })), T1 = at(compileLayered(Rt, { [twin.name]: 1 }));
    expect(T1['body/st2.sideL'][0]).toBeLessThan(T0['body/st2.sideL'][0] - 0.02); expect(T1['body/st2.sideL'][0]).toBeCloseTo(-T1['body/st2.sideR'][0], 9);
    const a = brushDial(mesh, stroke, resolved), b = brushDial(mesh, stroke, resolved); expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
