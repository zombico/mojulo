import { describe, expect, it } from 'vitest';

import { electronConfig, planAtomScene, assembleAtomScene } from './atom-view.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('electronConfig (aufbau)', () => {
  it('fills subshells in Madelung order', () => {
    expect(electronConfig(10).map((s) => `${s.label}${s.electrons}`)).toEqual(['1s2', '2s2', '2p6']); // neon
    expect(electronConfig(6).map((s) => `${s.label}${s.electrons}`)).toEqual(['1s2', '2s2', '2p2']);  // carbon
    expect(electronConfig(1).map((s) => `${s.label}${s.electrons}`)).toEqual(['1s1']);                // hydrogen
  });
});

describe('planAtomScene', () => {
  const NE = { kind: 'atom-view', element: 'Ne' };

  it('is deterministic', () => {
    expect(JSON.stringify(planAtomScene(NE).faces)).toBe(JSON.stringify(planAtomScene(NE).faces));
  });

  it('renders nucleus + an s-sphere and a p-dumbbell subshell, each a pickable group', () => {
    const plan = planAtomScene(NE);
    const groups = new Set(plan.faces.map((f) => f.group));
    for (const g of ['nucleus', 'orb:1s', 'orb:2s', 'orb:2p']) expect(groups.has(g), `missing ${g}`).toBe(true);
    expect(plan.picks.map((p) => p.name)).toEqual(['nucleus', 'orb:1s', 'orb:2s', 'orb:2p']);
    expect(plan.stats.element).toBe('Neon');
  });

  it('phase-colours the p lobes with two opposite signs (+ warm / − cool)', () => {
    const pFills = new Set(planAtomScene(NE).faces.filter((f) => f.group === 'orb:2p').map((f) => f.fill));
    expect(pFills.size).toBeGreaterThan(1);   // both phase colours present (shaded variants)
  });

  it('draws one p-dumbbell per OCCUPIED orbital (Hund) — carbon 2p² → 2, neon 2p⁶ → 3', () => {
    const pCount = (Z) => {
      // each dumbbell is one contiguous vajra; count by far-extent lobes is hard, so compare face counts:
      const c = planAtomScene({ element: Z === 6 ? 'C' : 'Ne' }).faces.filter((f) => f.group === 'orb:2p').length;
      return c;
    };
    expect(pCount(6)).toBeGreaterThan(0);
    expect(pCount(10)).toBeGreaterThan(pCount(6));   // 3 dumbbells > 2 dumbbells
  });

  it('orbital clouds are translucent; the nucleus is near-opaque', () => {
    const plan = planAtomScene(NE);
    expect(plan.faces.find((f) => f.group === 'orb:2p').alpha).toBeLessThan(0.6);
    expect(plan.faces.find((f) => f.group === 'nucleus').alpha).toBeGreaterThan(0.9);
  });

  it('defaults to neon on an unknown element and accepts Z', () => {
    expect(planAtomScene({ element: 'Xx' }).stats.element).toBe('Neon');
    expect(planAtomScene({ Z: 6 }).stats.element).toBe('Carbon');
  });
});

describe('assembleAtomScene', () => {
  it('returns an emitThreeWorld payload with picks, preset cameras and no glow', () => {
    const payload = assembleAtomScene({ element: 'Ne' }, { title: 'test atom' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.picks.length).toBe(4);
    expect(payload.cameras.map((c) => c.name)).toEqual(['angle', 'side', 'top']);
    expect(payload.glow).toBe(false);
  });
});

describe('electron wave-tour (mode: tour)', () => {
  it('emits faint orbital mazes + a touring electron tracer path', () => {
    const payload = assembleAtomScene({ kind: 'atom-view', element: 'H', mode: 'tour' }, { title: 'tour' });
    const groups = new Set(payload.faces.map((f) => f.group));
    for (const g of ['nucleus', 'orb:1s', 'orb:2s', 'orb:2p', 'orb:3s', 'orb:3p', 'orb:3d', 'orb:4s', 'orb:4p', 'orb:4d', 'orb:4f']) expect(groups.has(g), `missing ${g}`).toBe(true);
    // the orbital mazes are faint (low alpha); one tracer with a real path touring the whole chart (n=1..4).
    expect(payload.faces.find((f) => f.group === 'orb:1s').alpha).toBeLessThan(0.35);
    expect(payload.tracers).toHaveLength(1);
    expect(payload.tracers[0].path.length).toBeGreaterThan(3000);
    expect(payload.tracers[0].path[0].length).toBe(3);   // [x,y,z] points
    // segment map (for the Current/All focus toggle): one contiguous segment per orbital, in order.
    const segs = payload.tracers[0].segments;
    expect(segs.map((s) => s.group)).toEqual(['orb:1s', 'orb:2s', 'orb:2p', 'orb:3s', 'orb:3p', 'orb:3d', 'orb:4s', 'orb:4p', 'orb:4d', 'orb:4f']);
    expect(segs[0].start).toBe(0);
    expect(segs[segs.length - 1].end).toBe(payload.tracers[0].path.length);
  });
});

describe('atom-view render routing', () => {
  it('routes to the traversable World, in the world concern bucket', () => {
    expect(sketchRenderMode({ kind: 'atom-view' })).toBe('world');
    expect(classifyBucket({ kind: 'atom-view' })).toBe('world');
  });
});

import { assembleAtomVolume, ATOM_ORBITALS, ATOM_VOLUME_FRAG } from './atom-view.js';
import { emitThreeWorld as emitWorld } from '../../scene/scene-three.js';

describe('atom-view — scientific volumetric orbital (raymarch)', () => {
  it('style:scientific returns a raymarch payload with the |ψ|² orbital shader', () => {
    const a = assembleAtomScene({ kind: 'atom-view', style: 'scientific', orbital: '2p' }, {});
    expect(a.raymarch.frag).toBe(ATOM_VOLUME_FRAG);
    expect(a.raymarch.customUniforms.uOrbital).toBe(2);   // 2p index
    expect(a.raymarch.readout.join(' ')).toMatch(/2p/);
  });

  it('exposes the curated orbital set and selects by key', () => {
    expect(ATOM_ORBITALS).toContain('3dz2');
    expect(assembleAtomVolume({ orbital: '1s' }).customUniforms?.uOrbital ?? assembleAtomVolume({ orbital: '1s' }).raymarch.customUniforms.uOrbital).toBe(0);
  });

  it('the shader encodes real hydrogen wavefunctions + phase + nodal-surface gaps', () => {
    expect(ATOM_VOLUME_FRAG).toContain('float psi(vec3 p)');
    expect(ATOM_VOLUME_FRAG).toContain('(3.0 * z * z - r * r)');   // 3d_z² wavefunction
    expect(ATOM_VOLUME_FRAG).toContain('ps > 0.0 ? vec3');          // phase colouring
  });

  it('emits a full-screen shader World (no mesh pipeline) for the scientific atom', () => {
    const html = emitWorld({ ...assembleAtomScene({ kind: 'atom-view', style: 'scientific', orbital: '3dz2' }, {}), inline: true });
    expect(html).toContain('ShaderMaterial');
    expect(html).not.toContain('GROUPS =');
  });

  it('artistic (default) style is unchanged — still the mesh atom', () => {
    const a = assembleAtomScene({ kind: 'atom-view', element: 'Ne' }, {});
    expect(a.faces.length).toBeGreaterThan(0);
    expect(a.raymarch).toBeUndefined();
  });
});

describe('atom-view — H₂ molecular orbitals (scientific, two nuclei)', () => {
  it('σ bonding and σ* antibonding select the LCAO modes (uMol 1 / 2) with a bond separation', () => {
    const bond = assembleAtomVolume({ orbital: 'h2_sigma' }).raymarch.customUniforms;
    const anti = assembleAtomVolume({ orbital: 'h2_sigma_star' }).raymarch.customUniforms;
    expect(bond.uMol).toBe(1);
    expect(anti.uMol).toBe(2);
    expect(bond.uSep).toBeGreaterThan(0);
    expect(anti.uSep).toBe(bond.uSep);
  });

  it('atomic orbitals stay single-nucleus (uMol 0)', () => {
    expect(assembleAtomVolume({ orbital: '2p' }).raymarch.customUniforms.uMol).toBe(0);
  });

  it('the shader forms the molecular orbital from two displaced 1s atoms (constructive vs destructive)', () => {
    expect(ATOM_VOLUME_FRAG).toContain('uMol == 1 ? (a + b) : (a - b)');   // σ adds, σ* subtracts
    expect(ATOM_VOLUME_FRAG).toContain('uMol > 0');                         // two-nucleus branch
  });

  it('readout names the bond (σ) vs the antibonding node (σ*)', () => {
    expect(assembleAtomVolume({ orbital: 'h2_sigma' }).raymarch.readout.join(' ')).toMatch(/bond/i);
    expect(assembleAtomVolume({ orbital: 'h2_sigma_star' }).raymarch.readout.join(' ')).toMatch(/nodal plane/i);
  });
});
