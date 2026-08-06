/**
 * Render a baked unit's WALK clip at several phases to 3/4 + side SVG stills, so
 * a gait change can be eyeballed headlessly. Reuses the real bakeUnitRig output
 * (rest part buffers + per-key q/head' curves) and the runtime transform
 *   v' = head' + q·(v − restHead)
 * Run from control/:
 *   node scripts/render-unit-walk.mjs <unitRef> <clip> <outPrefix>
 */
import { writeFileSync } from 'node:fs';
import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { bakeUnitRig } from '../lib/graph/worlds/unit-rig.js';
import { renderFacesScaffoldSvg } from '../lib/graph/polygonizer/faces-scaffold-svg.js';
import { WORKBENCH_LIGHT } from '../lib/graph/worlds/workbench.js';

const [, , ref, clipName = 'forward', outPrefix = '/tmp/unit-walk'] = process.argv;
const rec = SketchRepository.getByRef(ref);
if (!rec?.manifest) { console.error(`no sketch '${ref}'`); process.exit(1); }

// Read the actual figure opts (aim/aimArms) from the combat_walker world so renders match reality.
const world = SketchRepository.getByRef(process.env.WORLD || 'sk_gframe_mk2_combat_walker_wasd');
const figSpec = world?.manifest?.figures?.unit || {};
let aim = figSpec.aim || { shL: { pitch: 20, yaw: 38 }, elbowL: 70, wristL: { roll: -72 }, shR: { pitch: 12, yaw: -22 }, elbowR: 90, wristR: { roll: 162 } };
const aimArms = figSpec.aimArms || 'lock';
// AIM_SHL='pitch,yaw' env → override the left-shoulder aim for quick forward-angle experiments.
if (process.env.AIM_JSON) { aim = { ...aim, ...JSON.parse(process.env.AIM_JSON) }; }
if (process.env.AIM_SHL) { const [pitch, yaw] = process.env.AIM_SHL.split(',').map(Number); aim = { ...aim, shL: { pitch, yaw } }; }
if (process.env.AIM_ELBOWL) aim = { ...aim, elbowL: Number(process.env.AIM_ELBOWL) };
let manifest = process.env.GIMBAL === 'off' ? { ...rec.manifest, gimbal: false } : rec.manifest;
// WPN_ROT='rx,ry,rz' and/or WPN_AT='x,y,z' env → override the rifle item's rotate/at for placement tuning.
if (process.env.WPN_ROT || process.env.WPN_AT) {
  manifest = { ...manifest, items: manifest.items.map((it) => {
    if (it.id !== 'weapon_rifle_hand_r') return it;
    const n = { ...it };
    if (process.env.WPN_ROT) n.rotate = process.env.WPN_ROT.split(',').map(Number);
    if (process.env.WPN_AT) n.at = process.env.WPN_AT.split(',').map(Number);
    return n;
  }) };
}
if (process.env.SAB_ROT || process.env.SAB_AT) {
  manifest = { ...manifest, items: manifest.items.map((it) => {
    if (it.id !== 'weapon_saber_hand_r') return it;
    const n = { ...it };
    if (process.env.SAB_ROT) n.rotate = process.env.SAB_ROT.split(',').map(Number);
    if (process.env.SAB_AT) n.at = process.env.SAB_AT.split(',').map(Number);
    return n;
  }) };
}
// WEAPON=rifle|saber → show only that weapon (filter armory + items) for a clean single-weapon render.
if (process.env.WEAPON && manifest.armory && manifest.armory.weapons) {
  const keep = process.env.WEAPON;
  manifest = { ...manifest,
    armory: { ...manifest.armory, weapons: manifest.armory.weapons.filter((w) => w.tag === keep) },
    items: manifest.items.filter((it) => !/^weapon_/.test(String(it.id || '')) || it.id === `weapon_${keep}_hand_r`),
  };
}
const swings = ['neutral', 'forward', 'left', 'right', 'back'];
const baked = bakeUnitRig(manifest, { keys: 24, aim, aimArms, swings });

const decodeF32 = (b64) => new Float32Array(Buffer.from(b64, 'base64').buffer.slice(0));
const decodeU8 = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));
const clip = baked.clips[clipName];
if (!clip) { console.error(`no clip '${clipName}' (have ${Object.keys(baked.clips).join(',')})`); process.exit(1); }
const K = clip.k, nb = baked.bones.length, B = clip.b;

// quaternion rotate v by q=[x,y,z,w]
const qrot = (q, v) => {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
};

// posed faces (triangle soup → faces) for exact key k
const posedFaces = (k) => {
  const faces = [];
  for (let bi = 0; bi < nb; bi++) {
    const part = baked.parts[bi];
    if (!part) continue;
    const rh = baked.bones[bi].head;
    const o = (k * nb + bi) * 7;
    const q = [B[o], B[o + 1], B[o + 2], B[o + 3]];
    const hd = [B[o + 4], B[o + 5], B[o + 6]];
    const pos = decodeF32(part.pos), col = decodeU8(part.col);
    const nTri = pos.length / 9;
    for (let f = 0; f < nTri; f++) {
      const corners = [];
      for (let c = 0; c < 3; c++) {
        const j = f * 9 + c * 3;
        const v = [pos[j], pos[j + 1], pos[j + 2]];
        const p = qrot(q, [v[0] - rh[0], v[1] - rh[1], v[2] - rh[2]]);
        corners.push([p[0] + hd[0], p[1] + hd[1], p[2] + hd[2]]);
      }
      // simple lambert so the form reads (light from upper-front-left)
      const e1 = [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1], corners[1][2] - corners[0][2]];
      const e2 = [corners[2][0] - corners[0][0], corners[2][1] - corners[0][1], corners[2][2] - corners[0][2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / nl, n[1] / nl, n[2] / nl];
      const L = [0.4, -0.5, 0.75];
      const sh = 0.4 + 0.6 * Math.abs(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const ci = f * 9;
      const r = Math.round(col[ci] * sh), g = Math.round(col[ci + 1] * sh), bl = Math.round(col[ci + 2] * sh);
      faces.push({ corners, fill: `rgb(${r},${g},${bl})` });
    }
  }
  return faces;
};

// fixed camera from key-0 bounds so the bob/crouch is comparable across phases
const f0 = posedFaces(0);
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const f of f0) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
const ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
const span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
const D = span * 2.4;
// figure faces +y; view it from the −y/−x quarter and from the side (+x)
const cams = {
  'tq': [ctr[0] + D * 0.7, ctr[1] - D * 0.7, ctr[2] + D * 0.12],
  'side': [ctr[0] + D, ctr[1], ctr[2] + D * 0.05],
  'front': [ctr[0], ctr[1] - D, ctr[2] + D * 0.05],
  'top': [ctr[0], ctr[1] - 0.001, ctr[2] + D],   // looking down: shows arm forward(+y)/left(±x)
};
const phases = [0, 3, 6, 9, 12];   // keys: p=0, .125, .25(mid-stance), .375, .5
for (const [vn, pos] of Object.entries(cams)) {
  for (const k of phases) {
    const camera = { worldFraming: { cameraPosition: pos, lookAt: ctr, horizontalFov: 30 }, viewBox: { width: 620, height: 780 } };
    writeFileSync(`${outPrefix}-${vn}-k${k}.svg`, renderFacesScaffoldSvg(posedFaces(k), { camera, roomBasis: {}, light: WORKBENCH_LIGHT }));
  }
}
console.log(`${ref} clip=${clipName}: z[${mn[2].toFixed(2)},${mx[2].toFixed(2)}] → ${outPrefix}-{tq,side}-k{0,3,6,9,12}.svg`);
