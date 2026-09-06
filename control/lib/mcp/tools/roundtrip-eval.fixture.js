/**
 * Round-trip legibility fixtures (expressiveness.plan.md E5, astra-3d-analysis proposal 6).
 * Twelve workbench recipes across the monomers, `fields`, `expr`, the domain ops, and one
 * `code` program. The eval renders each, hands a model ONLY the PNG views plus the vocab
 * card, asks for a re-mint, and measures how close the re-mint lands. With E1 the vocab is
 * a grammar, so this measures whether the CARD teaches it, per idiom.
 *
 * Each row: { id, idiom, kind, spec } — `kind` is the mint_solid kind, `spec` its spec.
 */

const disc = (r, t) => ({ id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, t], profile: [{ t: 0, radius: r }, { t: 1, radius: r }] } });

export const ROUNDTRIP_FIXTURE = [
  { id: 'candlestick', idiom: 'lathe', kind: 'workbench', spec: { units: 'cm', lathes: [
    { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 22 }, profile: [{ t: 0, radius: 5 }, { t: 0.12, radius: 5 }, { t: 0.2, radius: 1.4 }, { t: 0.8, radius: 1.2 }, { t: 0.9, radius: 2.6 }, { t: 1, radius: 2.4 }] },
  ] } },
  { id: 'tray', idiom: 'extrude shell', kind: 'workbench', spec: { units: 'cm', extrudes: [
    { profile: { rect: { w: 24, h: 16, r: 1.5 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 }, wallThickness: 0.6, openFace: 'to' },
  ] } },
  { id: 'mug', idiom: 'lathe + sweep', kind: 'workbench', spec: { units: 'cm', lathes: [
    { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 9.5 }, profile: [{ t: 0, radius: 3.8 }, { t: 1, radius: 4 }] },
  ], sweeps: [{ path: [[3.8, 0, 2.5], [6.5, 0, 3.5], [6.8, 0, 6], [4, 0, 7.5]], radius: 0.6 }] } },
  { id: 'bottle-loft', idiom: 'loft', kind: 'workbench', spec: { units: 'cm', lofts: [
    { path: [[0, 0, 0], [0, 0, 20]], stations: [{ t: 0, profile: { radius: 3, sides: 24 } }, { t: 0.6, profile: { radius: 3.4, sides: 24 } }, { t: 1, profile: { radius: 1.2, sides: 24 } }] },
  ] } },
  { id: 'bored-flange', idiom: 'fields subtract', kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 64, terms: [
    disc(6, 1.2), { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0, 0, -1], [0, 0, 3]], radius: 1.2 } },
  ] }] } },
  { id: 'pebble', idiom: 'fields stroke + displace', kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 48, terms: [
    { id: 'body', op: 'add', shape: { kind: 'ellipsoid', center: [0, 0, 1.1], radii: [2.2, 1.5, 1.1] } },
    { op: 'stroke', at: [1.6, 0.5, 1.6], radius: 0.7, strength: 1 },
    { op: 'displace', noise: { amplitude: 0.08, scale: 0.6, octaves: 3, seed: 'river' } },
  ] }] } },
  { id: 'gyroid-block', idiom: 'expr intersect', kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 64, terms: [
    { id: 'block', op: 'add', shape: { kind: 'box', center: [0, 0, 2], size: [4, 4, 4] } },
    { id: 'gyroid', op: 'intersect', shape: { kind: 'expr', d: 'let g = sin(x*k)*cos(y*k) + sin(y*k)*cos(z*k) + sin(z*k)*cos(x*k); abs(g) / k - t', vars: { k: 3.1416, t: 0.25 }, reach: 4 } },
  ] }] } },
  { id: 'wavy-plate', idiom: 'expr add', kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 64, terms: [
    { id: 'plate', op: 'add', shape: { kind: 'expr', d: 'abs(z - 1 - a * sin(x * w) * cos(y * w)) - t', vars: { a: 0.4, w: 1.2, t: 0.25 }, bounds: { min: [-5, -5, 0], max: [5, 5, 2] } } },
  ] }] } },
  { id: 'bolt-circle', idiom: 'repeat polar', kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 64, terms: [
    disc(6, 1.2),
    { op: 'repeat', polar: { count: 6, radius: 4.5 }, combine: 'subtract', terms: [{ id: 'bolt', op: 'add', shape: { kind: 'capsule', a: [0, 0, -1], b: [0, 0, 3], radius: 0.45 } }] },
  ] }] } },
  { id: 'grille', idiom: 'repeat grid', kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 64, terms: [
    { id: 'plate', op: 'add', shape: { kind: 'box', center: [0, 0, 0.5], size: [12, 8, 1] } },
    { op: 'repeat', spacing: [2, 2, 0], count: [5, 3, 1], combine: 'subtract', terms: [{ id: 'hole', op: 'add', shape: { kind: 'capsule', a: [0, 0, -1], b: [0, 0, 2], radius: 0.5 } }] },
  ] }] } },
  { id: 'twisted-bar', idiom: 'twist', kind: 'workbench', spec: { units: 'cm', fields: [{ cells: 64, terms: [
    { id: 'bar', op: 'add', shape: { kind: 'box', center: [0, 0, 6], size: [2, 2, 12] } }, { op: 'twist', axis: 'z', turns: 0.5 },
  ] }] } },
  { id: 'staircase', idiom: 'code program', kind: 'code', spec: { units: 'cm', params: { steps: 6, rise: 17, run: 28, width: 90, thickness: 4 }, source: `
    const { steps, rise, run, width, thickness } = params;
    const treads = Array.from({ length: steps }, (_, i) => ({
      profile: { rect: { w: run, h: width } },
      axisFrom: { x: i * run + run / 2, y: 0, z: (i + 1) * rise - thickness }, axisTo: { x: i * run + run / 2, y: 0, z: (i + 1) * rise },
    }));
    return { extrudes: treads };
  ` } },
];
