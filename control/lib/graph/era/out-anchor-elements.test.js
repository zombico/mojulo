import { describe, it, expect } from 'vitest';
import { STRUCTURE_RING_IDS, structureStyle } from './out-structures.js';
import { ELEMENT_KINDS, ELEMENT_SETS, BOUNDARY_FORMS, BOUNDARY_HEIGHTS, BOUNDARY_ROLES, BOUNDARY_ROLE_IDS, WALK_FORM_IDS, seedElements, composeAnchor, readElement, elementSwatch, sliceStreet, boundaryRoles, roleHeight, build } from './out-anchor-elements.js';
import { decompileAnchor, speak, secondaryOf } from './out-anchor-structure.js';
import { SURFACE_GROUP_IDS } from './out-structures-paint.js';

// the elements come first: rules with rails, what the street holds and what a house may vary; the anchor is composed
// from them as a citizen in its slice of street (era/out-anchor-elements.js)
const meadow = structureStyle('isekai-meadow', 8);
const inRail = (v, rail) => (typeof rail[0] === 'string' ? rail.includes(v) : v >= rail[0] - 1e-9 && v <= rail[1] + 1e-9);

describe('out-anchor-elements', () => {
  it('every authored and seeded element set holds its kinds\' rails and composes into a citizen with its street', () => {
    const sets = [...Object.values(ELEMENT_SETS), ...Array.from({ length: 60 }, (_, i) => seedElements(i + 1))];
    for (const A of sets) {
      for (const [id, el] of Object.entries(A.elements)) for (const [p, spec] of Object.entries(ELEMENT_KINDS[el.kind].params)) if (el[p] !== undefined) expect(inRail(el[p], spec.rail), `${A.read} ${id}.${p} ${el[p]}`).toBe(true);
      const C = composeAnchor(A);
      expect(C.use).toBe('dwelling');
      expect(Object.keys(C.street).sort()).toEqual(['bounds', 'footway', 'kerb', 'lamp', 'post', 'road']);
      expect(() => decompileAnchor(A)).not.toThrow();
    }
    expect(JSON.stringify(seedElements(9))).toBe(JSON.stringify(seedElements(9)));
  });

  it('refuses an element off its rail, an unknown kind, and a detail the mass cannot carry, saying why', () => {
    expect(() => readElement('roof', { kind: 'cap', form: 'gable', pitch: 80 })).toThrow(/pitch is 20–60/);
    expect(() => readElement('x', { kind: 'gargoyle' })).toThrow(/not an element kind/);
    expect(() => readElement('lamp', { kind: 'lamp', head: 'neon' })).toThrow(/lantern \| globe \| hood \| orb/);
    const shell = ELEMENT_SETS.shell;
    expect(() => composeAnchor({ ...shell, elements: { ...shell.elements, sills: { kind: 'sill', h: 0.2, over: 0.1, group: 'str:stone', value: 0.8 } } })).toThrow(/sill need a flat wall/);
    expect(() => composeAnchor({ ...shell, elements: { ...shell.elements, cornice: { kind: 'cornice', h: 0.2, proud: 0.1, group: 'str:stone', value: 0.5 } } })).toThrow(/cornice runs under an eave/);
  });

  it('the street holds its lines; a household varies only what is its own', () => {
    const L = decompileAnchor('timber-hall'), ds = Array.from({ length: 12 }, (_, k) => speak(L, 'dwelling', { w: 11, d: 18 }, meadow, 3 + 17 * k, { band: [2, 2] }));
    expect(new Set(ds.map((d) => d.dims.storeyH)).size).toBe(1);
    expect(new Set(ds.map((d) => d.dims.pitch)).size).toBe(1);
    // the eave is held as a proportion of the plan's least side
    for (const d of ds) expect(d.dims.eave / Math.min(d.dims.W0, d.dims.D0)).toBeCloseTo(ds[0].dims.eave / Math.min(ds[0].dims.W0, ds[0].dims.D0), 2);
    expect(new Set(ds.map((d) => d.sig)).size).toBeGreaterThan(4);
    // shutters are a household's choice: some hang them, some do not
    const hung = ds.filter((d) => d.faces.some((f) => f.part === 'shutter') || d.tile.some((f) => f.part === 'shutter')).length;
    expect(hung).toBeGreaterThan(0);
    expect(hung).toBeLessThan(ds.length);
  });

  it('the details are spoken by depth and gated by the eye spot: a far citizen has none, a near one all', () => {
    const L = decompileAnchor('timber-hall'), at = (ring) => speak(L, 'dwelling', { w: 11, d: 18 }, meadow, 8, { ring, band: [2, 2], over: { full: true } }), parts = (d) => new Set([...d.faces, ...d.tile].map((f) => f.part));
    for (const p of ['socle', 'sill', 'lintel', 'quoin', 'bond']) expect(parts(at('near')).has(p), p).toBe(true);
    for (const p of ['socle', 'sill', 'lintel', 'quoin', 'bond']) expect(parts(at('far')).has(p), p).toBe(false);
    // the bond is marks in the tile only, never counted
    expect(at('near').faces.some((f) => f.part === 'bond')).toBe(false);
    for (const r of STRUCTURE_RING_IDS) { const d = at(r); expect(d.measures.tris).toBeLessThanOrEqual(d.measures.budget); }
  });

  it('every element draws on its own, and the slice stands on the street, in values on surface groups', () => {
    for (const [name, A] of Object.entries(ELEMENT_SETS)) {
      for (const id of Object.keys(A.elements)) {
        const faces = elementSwatch(A, id);
        expect(faces.length, `${name} ${id}`).toBeGreaterThan(0);
        for (const f of faces) { expect(SURFACE_GROUP_IDS, `${name} ${id} ${f.part}`).toContain(f.group); expect(f.value).toBeGreaterThanOrEqual(0); }
      }
      const S = sliceStreet(A);
      expect(S.foot).toBe(A.elements.footway.w);
      expect(S.faces.some((f) => f.part === 'kerb')).toBe(true);
    }
  });

  it('every anchor has a secondary, derived by contrast: upright, steeper, turned in tone, crowned, and holding its laws', () => {
    for (const a of [...Object.keys(ELEMENT_SETS), ...Array.from({ length: 30 }, (_, i) => seedElements(i + 1))]) {
      const L = decompileAnchor(a), L2 = secondaryOf(L), id = L.id;
      expect(L2.compact, id).toBe(true);
      expect(L2.vocab.annex).toBeNull();
      expect(L2.vocab.tiers).toBe(false);
      expect(L2.vocab.ornaments).toContain('point');
      expect(L2.proportions.storeyH).toBe(L.proportions.storeyH);
      // the tone turns: the body's value moves to the other side of 0.8
      const pale = Math.max(...L.values.storeys.map((x) => x.value)) >= 0.8;
      expect(L2.values.storeys[L2.values.storeys.length - 1].value < 0.8, id).toBe(pale);
      // the cap steepens and is never the walls' material
      if (L2.proportions.pitch !== null && L.proportions.pitch !== null) expect(L2.proportions.pitch).toBeGreaterThan(L.proportions.pitch);
      expect(L2.values.storeys.map((x) => x.group)).not.toContain(L2.values.cap.group);
      for (const ring of STRUCTURE_RING_IDS) for (const band of [[2, 3], [4, 5]]) {
        const d = speak(L2, 'dwelling', { w: 9, d: 16 }, meadow, 8, { ring, band });
        expect(d.laws.filter((l) => !l.ok && l.law !== 'programme'), `${id} ${ring} ${band}`).toEqual([]);
        expect(d.dims.W0).toBe(d.dims.D0);
      }
    }
    expect(secondaryOf({ ...decompileAnchor('timber-hall'), anchor: { pieces: decompileAnchor('timber-hall').anchor.pieces } })).toBeNull();
  });

  it('a walk is a function: every form separates the walker, and a verge leaves a clear path', () => {
    const A = ELEMENT_SETS['timber-hall'];
    for (const form of WALK_FORM_IDS) {
      const fw = { kind: 'footway', w: 2.2, paving: 'flags', form, verge: form === 'verge' ? 0.8 : undefined }, C = composeAnchor({ ...A, elements: { ...A.elements, footway: fw } }), out = [];
      const S = build.section(out, 4, 2.4, C.street);
      expect(S.edge, form).toBe({ kerbed: 'kerb', flush: 'channel', boards: 'fascia', verge: 'verge' }[form]);
      if (form === 'verge') expect(S.verge).toBeGreaterThan(0);
    }
    expect(() => composeAnchor({ ...A, elements: { ...A.elements, footway: { kind: 'footway', w: 1.4, paving: 'flags', form: 'verge', verge: 0.8 } } })).toThrow(/clear path of 0.9 m/);
    expect(() => readElement('footway', { kind: 'footway', form: 'moat' })).toThrow(/kerbed \| flush \| boards \| verge/);
  });

  it('boundaries take roles by height class: a form that cannot reach passes the role on; a town\'s needs always met', () => {
    for (const A of [...Object.values(ELEMENT_SETS), ...Array.from({ length: 40 }, (_, i) => seedElements(i + 1))]) {
      const C = composeAnchor(A);
      for (const rise of [2.8, 4.2]) {
        const R = boundaryRoles(C.street.bounds, rise);
        for (const role of BOUNDARY_ROLE_IDS) {
          if (BOUNDARY_ROLES[role].need) expect(R[role], `${A.read} ${role}`).not.toBeNull();
          if (!R[role]) continue;
          const F = BOUNDARY_FORMS[R[role].form];
          if (role === 'retain') { expect(F.retain).toBeGreaterThanOrEqual(rise); continue; }
          // the height stands inside the class and inside what the form can stand to
          const h = roleHeight(R[role]), cls = BOUNDARY_HEIGHTS[BOUNDARY_ROLES[role].cls].h;
          expect(h, `${role} ${R[role].form}`).toBeGreaterThanOrEqual(Math.max(cls[0], F.h[0]) - 1e-9);
          expect(h).toBeLessThanOrEqual(Math.min(cls[1], F.h[1]) + 1e-9);
        }
      }
    }
    // a rail fence named for the yard's back cannot stand over the eye: the role falls to the strongest named that can
    const R = boundaryRoles({ rails: { kind: 'boundary', form: 'rail', roles: ['back'] }, wall: { kind: 'boundary', form: 'coursed', roles: ['precinct'] } });
    expect(R.back).toMatchObject({ id: 'wall', form: 'coursed', fell: true });
    expect(R.front).toBeNull();
    expect(R.retain.form).toBe('coursed');
    expect(() => composeAnchor({ ...ELEMENT_SETS.shell, elements: { ...ELEMENT_SETS.shell.elements, moat: { kind: 'boundary', form: 'hedge', roles: ['moat'] } } })).toThrow(/'moat' is not a role/);
  });

  it('a boundary by depth: each degree adds to the one before; a gate opens it; a retaining wall has no back', () => {
    for (const form of Object.keys(BOUNDARY_FORMS)) {
      const el = { kind: 'boundary', form, pier: 2.4, cope: 0.06 }, h = Math.min(1.1, BOUNDARY_FORMS[form].h[1]), n = [0, 1, 2, 3].map((depth) => { const o = []; build.boundary(o, 4, el, h, { depth, gates: [{ u: 2, w: 1.2 }] }); return o.length; });
      for (let d = 1; d < 4; d++) expect(n[d], `${form} ${d}`).toBeGreaterThanOrEqual(n[d - 1]);
      // nothing stands in the gate below its leaf
      const o = []; build.boundary(o, 4, el, h, { depth: 2, gates: [{ u: 2, w: 1.2 }] });
      expect(o.filter((f) => f.corners.every((c) => c[0] > 1.5 && c[0] < 2.5)), form).toEqual([]);
    }
    const r = []; build.boundary(r, 4, { kind: 'boundary', form: 'coursed' }, 3, { depth: 1, retain: 3 });
    expect(r.some((f) => f.normal[1] > 0.5)).toBe(false);
    expect(Math.max(...r.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(3, 6);
  });
});
