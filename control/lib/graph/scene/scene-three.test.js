import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';

// a unit quad on a plane, optionally grouped/normalled like a shell wall
const wall = (group, normal) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888888', group, normal });

describe('emitThreeWorld render groups', () => {
  it('collapses ungrouped faces into a single static group (city/figure path unchanged)', () => {
    const html = emitThreeWorld({ faces: [wall(undefined, undefined), wall(undefined, undefined)] });
    expect(html).toContain('"name":"static"');
    expect(html).not.toContain('"hideable":true'); // nothing toggleable
  });

  it('splits a shell wall into its own hideable group', () => {
    const html = emitThreeWorld({ faces: [wall('shell:leftWall', [1, 0, 0]), wall(undefined, undefined)] });
    expect(html).toContain('"name":"shell:leftWall"');
    expect(html).toContain('"hideable":true');
    expect(html).toContain('updateCutaway'); // runtime auto-hide wired in
  });

  it('never marks the floor hideable (you always stand on it)', () => {
    const html = emitThreeWorld({ faces: [wall('shell:floor', [0, 0, 1])] });
    expect(html).toContain('"name":"shell:floor"');
    expect(html).not.toContain('"hideable":true');
  });

  it('treats a grouped wall WITHOUT a normal as non-hideable (can\'t compute camera side)', () => {
    const html = emitThreeWorld({ faces: [wall('shell:leftWall', undefined)] });
    expect(html).toContain('"name":"shell:leftWall"');
    expect(html).not.toContain('"hideable":true');
  });
});

describe('emitThreeWorld mover lifetimes + flash (cascade enabler)', () => {
  // a small sphere-ish group the mover can drive, keyed by group name.
  const blob = (group) => ({ corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#cccccc', group });

  // a throwaway 3-element timeline on the shared clock: a neutron (born → absorbed → vanishes), a
  // fragment (born → recoils → stays), and a fission flash (a brief scale-pop) in between.
  const TIMELINE = {
    faces: [blob('neutron'), blob('fragment'), blob('flash')],
    movers: [
      { group: 'neutron', path: [[0, 0, 0], [10, 0, 0]], basePos: [0, 0, 0], t0: 1.0, t1: 2.5, vanish: true },
      { group: 'fragment', path: [[0, 0, 0], [-3, 0, 0]], basePos: [0, 0, 0], t0: 2.5, t1: 3.2 },
      { group: 'flash', at: [0, 0, 0], basePos: [0, 0, 0], t0: 2.4, t1: 2.7, flash: { size: 4 } },
    ],
  };

  it('emits the shared-clock lifetime machinery (_LIFE_T + moverLifeU)', () => {
    const html = emitThreeWorld(TIMELINE);
    expect(html).toContain('const _LIFE_T');
    expect(html).toContain('function moverLifeU');
    expect(html).toContain('mv.vanish ? s <= mv.t1 : true');   // vanish vs freeze-at-end gating
  });

  it('keeps a flash mover (no multi-point path) in the channel instead of filtering it out', () => {
    const html = emitThreeWorld(TIMELINE);
    expect(html).toContain('"flash":{"size":4}');
    expect(html).toContain('if (mv.flash)');                    // the scale-pop branch is present
  });

  it('the shared loop length is the latest t1 plus a tail hold (cascade replays in step)', () => {
    const html = emitThreeWorld(TIMELINE);
    // _LIFE_T is computed in-page from MOVERS; the three lifetimes (max t1 = 3.2) all serialize through.
    expect(html).toContain('"t1":3.2');
    expect(html).toContain('"t0":1');
  });

  it('legacy period movers are untouched — no lifetime fields, classic loop walk', () => {
    const html = emitThreeWorld({
      faces: [blob('body')],
      movers: [{ group: 'body', path: [[0, 0, 0], [5, 0, 5]], basePos: [0, 0, 0], period: 3, loop: true }],
    });
    expect(html).toContain('function moverU');     // legacy phase fn still there
    expect(html).not.toContain('"t1":');           // this mover carries no lifetime
  });
});

describe('emitThreeWorld wireframe mode', () => {
  it('always ships the wireframe HUD toggle + lazy edge builder (every World)', () => {
    const html = emitThreeWorld({ faces: [wall(undefined, undefined)] });
    expect(html).toContain("wireBtn.textContent = 'wireframe'");
    expect(html).toContain('EdgesGeometry');
    expect(html).toContain('const WIREFRAME0 = false;'); // off by default
  });

  it('opens in wireframe when wireframe:true (deep-link / baked still)', () => {
    const html = emitThreeWorld({ faces: [wall(undefined, undefined)], wireframe: true });
    expect(html).toContain('const WIREFRAME0 = true;');
    expect(html).toContain('if (WIREFRAME0) setWireframe(true);');
  });
});

describe('decollideExceptBound — bound DCC meshes keep their authored planes', () => {
  // two coincident, overlapping quads on one plane: the second is a stacked face, so the
  // decollide pass lifts it a hair along the normal — unless it belongs to a bound-mesh group.
  const quad = (group) => ({ group, fill: '#888', corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]] });
  it('lifts a stacked face in an ordinary group', async () => {
    const { decollideExceptBound } = await import('./scene-three.js');
    const out = decollideExceptBound([quad('lid'), quad('lid')]);
    expect(out[0].corners[0][2]).toBe(0);
    expect(out[1].corners[0][2]).not.toBe(0);
  });
  it('leaves a stacked face in a mesh: group exactly where the DCC put it, and keeps list order', async () => {
    const { decollideExceptBound } = await import('./scene-three.js');
    const faces = [quad('mesh:walkman'), quad('lid'), quad('mesh:walkman'), quad('lid')];
    const out = decollideExceptBound(faces);
    expect(out[0]).toBe(faces[0]);
    expect(out[2]).toBe(faces[2]);
    expect(out[1].corners[0][2]).toBe(0);      // first ordinary face on the plane: unchanged
    expect(out[3].corners[0][2]).not.toBe(0);  // the ordinary face stacked on it: lifted
    expect(out.map((f) => f.group)).toEqual(faces.map((f) => f.group));
  });
});

describe('emitThreeWorld toon ink (toon-shading Phase 2)', () => {
  const body = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#3f7fd6', group: 'body', outNormal: [0, -1, 0] };
  const studio = { corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#445566', studio: true };
  const wall = { corners: [[0, 0, 0], [0, 4, 0], [0, 4, 3], [0, 0, 3]], fill: '#8899aa', group: 'shell:leftWall', normal: [1, 0, 0] };
  const groupsOf = (html) => JSON.parse(html.match(/const GROUPS = (\[[^\n]*\]);/)[1]);

  it('no toon → no ink buffers and no block', () => {
    const html = emitThreeWorld({ faces: [body, studio] });
    expect(html).not.toContain('--- toon ink');
    expect(groupsOf(html).every((g) => g.ink === undefined)).toBe(true);
  });

  it('a bands-only toon changes nothing here (bands are baked upstream)', () => {
    expect(emitThreeWorld({ faces: [body, studio], toon: { bands: 3 } })).toBe(emitThreeWorld({ faces: [body, studio] }));
  });

  it('toon.ink packs ink buffers (positions + authored normals) on the eligible group only, and splices the block', () => {
    const html = emitThreeWorld({ faces: [body, studio, wall], toon: { bands: 3, ink: true } });
    expect(html).toContain('--- toon ink');
    expect(html).toContain('window.__mojInk');
    const groups = groupsOf(html);
    const g = groups.find((x) => x.name === 'body');
    expect(typeof g.ink.pos).toBe('string');
    expect(typeof g.ink.nrm).toBe('string');
    expect(groups.find((x) => x.name === 'static').ink).toBeUndefined();          // studio floor: skipped
    expect(groups.find((x) => x.name === 'shell:leftWall').ink).toBeUndefined();  // room shell: skipped
  });

  it('ink tuning lands in the block config; defaults otherwise', () => {
    expect(emitThreeWorld({ faces: [body], toon: { ink: true } })).toContain('"color":"#101015"');
    expect(emitThreeWorld({ faces: [body], toon: { ink: { color: '#220000', width: 0.02, crease: 50 } } })).toContain('"color":"#220000","width":0.02,"crease":50');
  });

  it('ink with nothing eligible (only a studio floor) emits no block', () => {
    expect(emitThreeWorld({ faces: [studio], toon: { ink: true } })).not.toContain('--- toon ink');
  });

  it('lines: false attaches the hull alone; a noInk face (a drawn feature) stays out of the ink soup', () => {
    const plain = emitThreeWorld({ faces: [body], toon: { ink: true } });
    expect(plain).toContain('scene.add(e.hull); scene.add(e.lines); __inkReg[grp.name] = e;');
    const hull = emitThreeWorld({ faces: [body], toon: { ink: { lines: false } } });
    expect(hull).toContain('scene.add(e.hull); __inkReg[grp.name] = e;'); expect(hull).toContain('"lines":false');
    expect(hull).not.toContain('scene.add(e.hull); scene.add(e.lines);');
    const mark = { ...body, corners: body.corners.map((c) => [c[0] + 3, c[1], c[2]]), noInk: true };
    const withMark = groupsOf(emitThreeWorld({ faces: [body, mark], toon: { ink: true } })).find((g) => g.name === 'body');
    expect(withMark.ink.pos).toBe(groupsOf(plain).find((g) => g.name === 'body').ink.pos);   // same soup as the body alone
    expect(withMark.pos).not.toBe(groupsOf(plain).find((g) => g.name === 'body').pos);        // the mark still renders
  });
});

describe('emitThreeWorld live ink (toon-shading Phase 4)', () => {
  const body = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#3f7fd6', group: 'body', outNormal: [0, -1, 0] };
  const floorF = { corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#445566' };
  const ents = [{ id: 'd', transform: { pos: [1, 1, 0], heading: 0 }, rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 0.6] } }];

  it('4a: the block exposes the live handle and the shared builders', () => {
    const html = emitThreeWorld({ faces: [body], toon: { ink: true } });
    for (const s of ['window.__mojInk', 'tint(name, color)', 'width(name, k)', 'reset(name)', 'const __inkBuild', 'userData.ink = true', 'uniform float uInk']) expect(html).toContain(s);
  });

  it('4b: a controllable world with toon.ink emits the block (no static ink group needed) and the rig-part hook', () => {
    const html = emitThreeWorld({ faces: [floorF], entities: ents, toon: { ink: true } });
    expect(html).toContain('--- toon ink');
    expect(html).toContain('function __inkRigPart');
    expect(html).toContain('__inkRigPart(mesh, geo, fig)');
    const plain = emitThreeWorld({ faces: [floorF], entities: ents });
    expect(plain).not.toContain('__inkRigPart');
    expect(plain).not.toContain('--- toon ink');
    expect(html).toContain('mesh.add(e.hull); mesh.add(e.lines);');
    const hullOnly = emitThreeWorld({ faces: [floorF], entities: ents, toon: { ink: { lines: false } } });   // silhouette only, as the setup block
    expect(hullOnly).toContain('function __inkRigPart'); expect(hullOnly).not.toContain('mesh.add(e.lines);');
  });

  it('4c: fx ink verbs splice only when the fx spec uses them', () => {
    const base = { faces: [floorF], entities: ents, toon: { ink: true } };
    const plainFx = emitThreeWorld({ ...base, fx: { states: { d: 'float' } } });
    expect(plainFx).not.toContain('__fxInk');
    const inkState = emitThreeWorld({ ...base, fx: { states: { d: { ink: '#ff4040', pulse: true } } } });
    expect(inkState).toContain('function __fxInk');
    expect(inkState).toContain("s.ink, s.pulse");
    const inkGesture = emitThreeWorld({ ...base, fx: { on: { 'hit:*': { gesture: 'inkFlash', color: '#fff' } } } });
    expect(inkGesture).toContain("gesture === 'inkFlash'");
    expect(inkGesture).toContain('g.color');
  });
});

describe('emitThreeWorld draw layers (the stencil rules: brows through the fringe, the hair outline never over hair)', () => {
  const q = (fill, extra = {}) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill, group: 'body', outNormal: [0, -1, 0], ...extra });
  const studio = { corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#445566', studio: true };
  const skin = q('#d9a77e'), hair = q('#3b4859', { layer: 'hair' }), veil = q('#3b4859', { layer: 'veil' }), brow = q('#16181c', { layer: 'through', noInk: true });
  const groupsOf = (html) => JSON.parse(html.match(/const GROUPS = (\[[^\n]*\]);/)[1]);
  const layersOf = (html) => JSON.parse(html.match(/const __LAYERS = ([^;]*);/)[1]);

  it('no layer: no stencil buffer, no layers block, no hull rule; an unknown layer value is no layer at all', () => {
    for (const toon of [undefined, { ink: { lines: false } }]) {
      const plain = emitThreeWorld({ faces: [skin, { ...skin, fill: '#3b4859' }, studio], toon });
      expect(plain).toContain("logarithmicDepthBuffer: true });"); expect(plain).not.toContain('stencil'); expect(plain).not.toContain('--- draw layers'); expect(plain).not.toContain('__layer');
      for (const odd of ['x', 2, null, '']) expect(emitThreeWorld({ faces: [skin, { ...skin, fill: '#3b4859', layer: odd }, studio], toon })).toBe(plain);
    }
  });
  it('a face `layer` splits its render group by it; the page asks for a stencil buffer and draws the fill rules', () => {
    const html = emitThreeWorld({ faces: [skin, hair, veil, brow, studio] });
    const groups = groupsOf(html);
    expect(groups.map((g) => [g.name, g.layer])).toEqual([['body', undefined], ['body:hair', 'hair'], ['body:veil', 'veil'], ['body:through', 'through'], ['static', undefined]]);
    expect(html).toContain('logarithmicDepthBuffer: true, stencil: true });');
    expect(html).toContain('--- draw layers'); expect(html).toContain('window.__mojLayers = __LAYERS;');
    expect(layersOf(html)).toEqual({ hair: true, groups: ['body:hair', 'body:veil', 'body:through'] });
    for (const needle of ["if (layer === 'through') { mat.stencilRef = 1; mat.stencilWriteMask = 3; }", 'mat.stencilFunc = THREE.NotEqualStencilFunc; mat.stencilRef = 3; mat.stencilFuncMask = 1; mat.stencilWriteMask = 2;', 'const __LAYER_ORDER = { through: 1, veil: 2 };']) expect(html).toContain(needle);
    // the block follows the group meshes and precedes the ink (the hulls take its rule)
    expect(html.indexOf('meshes[grp.name] = m;')).toBeLessThan(html.indexOf('--- draw layers'));
    // no hair face: the hair rule is off (a plain fill never touches the stencil)
    expect(layersOf(emitThreeWorld({ faces: [skin, veil, brow] }))).toEqual({ hair: false, groups: ['body:veil', 'body:through'] });
  });
  it('with the ink: the hair and the veil groups outline on their own, drawn after every fill under their layer\'s test; a through face never outlines', () => {
    const html = emitThreeWorld({ faces: [skin, hair, veil, brow, studio], toon: { ink: { lines: false, widthAbs: 0.002 } } });
    const groups = Object.fromEntries(groupsOf(html).map((g) => [g.name, g]));
    for (const k of ['body', 'body:hair', 'body:veil']) expect(typeof groups[k].ink.pos, k).toBe('string');
    expect(groups['body:through'].ink).toBeUndefined();
    expect(emitThreeWorld({ faces: [skin, hair, veil, q('#16181c', { layer: 'through' }), studio], toon: { ink: true } })).not.toMatch(/"name":"body:through"[^}]*"ink"/);
    expect(html).toContain('if (grp.layer && __layerHull(e.hullMat, grp.layer)) e.hull.renderOrder = 3;');
    expect(html.indexOf('--- draw layers')).toBeLessThan(html.indexOf('--- toon ink'));
    expect(html).toContain("mat.stencilFuncMask = layer === 'veil' ? 3 : 2;");
    // the ink soups are the render groups': the skin's soup is the skin alone
    const skinOnly = groupsOf(emitThreeWorld({ faces: [skin, studio], toon: { ink: { lines: false, widthAbs: 0.002 } } }));
    expect(groups.body.ink.pos).toBe(skinOnly.find((g) => g.name === 'body').ink.pos);
  });
});
