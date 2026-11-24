/**
 * THE ASSAULT FRAME AS A LEVEL STANDS IT — the body (body.js) as a rig figure the page draws in the FORM render (era/
 * eras.js gen-7: a surface carries its material and its form, never light; the page lights it by its world), its clips
 * the frame's own (clips.js), its thrusters the page's: the booster's bells and its verniers burning as the frame boosts.
 *
 *   frameFigure(spec, { setting? })  spec { build, palette?, wear? } (body.js: a STOCK name or a build; a palette of
 *                                    FRAME_PALETTES; a wear of FRAME_WEARS) → the rig figure (vehicle-rig.js
 *                                    packVehicleFigure): one bone per body bone, each in the form render; `clips` the
 *                                    frame's (idle, forward, boost, boost_left, boost_right, boost_back, hover, fall,
 *                                    land); `thrusters` [{ bone, local, dir, size, half, len, kind: 'flame', color, role }] (layered fire, scene/channels/controllable/frame-flame.js)
 *                                    (craft-form.js's drives: a bell's mouth, its plume aft in the exhaust's colour);
 *                                    `form` its light (form-light.js: the world's sky, or noon, or a star's in space);
 *                                    `frame` { build, height, hips, mounts, palette, wear, faces }
 *   frameMaterials(palette?)         → the slots' response for a palette (its glow lit in the palette's colour)
 *   FRAME_MATERIALS                  the federation's
 *
 * Pure: the same spec, the same figure.
 */
import { frameBody, FRAME_PALETTES, readFrameLook, frameFaceCount } from './body.js';
import { frameClips } from './clips.js';
import { readBuild } from './assemble.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { formLight, skyMood } from '../car-designer/form-light.js';

const f = Object.freeze;
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// (a booster's plume this many of its mouth's half-widths long at full burn, a vernier's less: long enough that its
// layers read, the core, the sheath and the tail, frame-flame.js)
const PLUME = Object.freeze({ main: 30, vernier: 14 });

/** The slots, as the page's physical material takes them: the paint satin with a thin clear coat (a hull's paint made
 *  for vacuum), the chrome a mirror, the structure's dark metal brushed, the seal rubber, the lens deep glass, the glow
 *  lit by its own, the stencil a flat paint. */
export function frameMaterials(palette = 'federation') {
  const C = FRAME_PALETTES[palette] ?? FRAME_PALETTES.federation;
  return f({
    paint: f({ metalness: 0.22, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
    chrome: f({ metalness: 1, roughness: 0.08 }),
    gunmetal: f({ metalness: 0.7, roughness: 0.36 }),
    seal: f({ metalness: 0, roughness: 0.86 }),
    lens: f({ metalness: 0.25, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }),
    glow: f({ metalness: 0, roughness: 0.45, emissive: C.glow, emissiveIntensity: 1.6 }),
    stencil: f({ metalness: 0.05, roughness: 0.6 }),
  });
}
export const FRAME_MATERIALS = frameMaterials('federation');

const SPEC_KEYS = f(['build', 'palette', 'wear']);
export function readFrameSpec(spec, at = 'frame') {
  if (typeof spec === 'string') spec = { build: spec };
  if (!isObj(spec)) throw new Error(`${at} is { build, palette?, wear? }`);
  for (const k of Object.keys(spec)) if (!SPEC_KEYS.includes(k)) throw new Error(`${at}.${k} is not a frame's word (${SPEC_KEYS.join(', ')})`);
  readBuild(spec.build ?? 'vanguard', `${at}.build`);
  readFrameLook(spec, at);
  return spec;
}

export function frameFigure(spec, { setting = null } = {}) {
  const S = readFrameSpec(spec);
  const body = frameBody(S.build ?? 'vanguard', { palette: S.palette, wear: S.wear });
  const C = FRAME_PALETTES[body.palette];
  // (each bone's faces in the form render, their corner normals the body's where it drew them smooth, else flat)
  const form = new Map(body.bones.map(({ id }) => [id, body.faces.get(id).map((fc) => ({
    corners: fc.corners, material: fc.material, albedo: fc.albedo, outNormal: fc.outNormal,
    cornerNormals: fc.cornerNormals ?? fc.corners.map(() => fc.outNormal),
  }))]));
  const baked = new Map(body.bones.map(({ id }) => [id, body.faces.get(id).map((fc) => ({ corners: fc.corners, fill: fc.fill }))]));
  const fig = packVehicleFigure(body.bones, baked, { keys: 2, rolls: [], form });
  // (a bell's exhaust: its mouth, its plume aft along its axis, the main bells long and the verniers short)
  const thrusters = body.thrusters.map((t) => {
    const size = r4(Math.max(...t.half));
    return { bone: t.bone, local: t.at, dir: t.dir, size, half: [size, size], len: r4(size * (PLUME[t.kind] ?? PLUME.vernier)), kind: 'flame', color: C.exhaust, role: t.kind };
  });
  return {
    ...fig,
    clips: frameClips(body),
    thrusters,
    form: { ...formLight(skyMood(setting?.sky), frameMaterials(body.palette), {}), normalBias: 0.1 },
    figH: body.height,
    frame: { build: body.build, height: body.height, hips: body.hips, mounts: body.mounts, footprint: body.footprint, palette: body.palette, wear: body.wear, faces: frameFaceCount(body) },
  };
}
