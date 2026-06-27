/**
 * machina/mower-geometry.js — compose a reel mower as workbench MONOMERS (lathes + sweeps) from the
 * sized parameters, so the rendered World *is* the verified mechanism rather than resembling one. The
 * faithful bit: the drive sprocket / reel pinion radii encode the SIZED gear ratio (sprocketR/pinionR
 * = ratio), and the reel carries `blades` real helical cutters. This is the first slice of the generic
 * workbench-backed assembler the create_machina_view path will generalise.
 *
 * Frame: x = forward, y = across the cut width, z = up. Pure — returns { lathes, sweeps }.
 */

const TAU = Math.PI * 2;
const STEEL = '#3a4654', BLADE = '#9fb2c6', RUBBER = '#191d23', HUB = '#11141a', BRASS = '#b9912f', BAR = '#2b323c', GRIP = '#48535f';

const cyl = (from, to, radius, tint) => ({ axisFrom: from, axisTo: to, profile: [{ t: 0, radius }, { t: 1, radius }], tint });

// a helical cutter: wind once-ish around the reel axis (along y) at the reel radius.
function helixBlade(xc, zc, Rr, W, phase, turns, samples = 44) {
  const path = [];
  for (let i = 0; i < samples; i++) {
    const s = i / (samples - 1);
    const ang = phase + s * turns * TAU;
    path.push([xc + Rr * Math.cos(ang), -W / 2 + s * W, zc + Rr * Math.sin(ang)]);
  }
  return { path, radius: Rr * 0.10, sides: 6, tint: BLADE };
}

export function mowerMonomers({ Rw = 0.13, Rr = 0.055, W = 0.40, blades = 5, ratio = 8 } = {}) {
  const xReel = 0.24, xAxle = 0;                       // reel up front, drive axle behind
  const ySide = W / 2 + 0.03, yGear = W / 2 + 0.07;
  const lathes = [], sweeps = [];

  // reel: core shaft + blades
  lathes.push(cyl({ x: xReel, y: -W / 2, z: Rr }, { x: xReel, y: W / 2, z: Rr }, Rr * 0.32, STEEL));
  for (let i = 0; i < blades; i++) sweeps.push(helixBlade(xReel, Rr, Rr, W, (i / blades) * TAU, 1.1));

  // drive wheels (big side wheels on the rear axle) + dark hubs
  for (const sgn of [-1, 1]) {
    const y0 = sgn * ySide, y1 = sgn * (ySide + 0.035);
    lathes.push(cyl({ x: xAxle, y: y0, z: Rw }, { x: xAxle, y: y1, z: Rw }, Rw, RUBBER));
    lathes.push(cyl({ x: xAxle, y: y0 - sgn * 0.005, z: Rw }, { x: xAxle, y: y1 + sgn * 0.01, z: Rw }, Rw * 0.28, HUB));
  }

  // the gear-up that SETS the ratio: a big drive sprocket on the wheel axle + a small reel pinion,
  // radii in the sized ratio. A chain run (two sweeps) ties them — this is the faithful sizing.
  const pinionR = 0.016, sprocketR = Math.min(pinionR * ratio, 0.11);
  lathes.push(cyl({ x: xAxle, y: yGear, z: Rw }, { x: xAxle, y: yGear + 0.018, z: Rw }, sprocketR, BRASS));      // drive sprocket
  lathes.push(cyl({ x: xReel, y: yGear, z: Rr }, { x: xReel, y: yGear + 0.018, z: Rr }, pinionR, BRASS));        // reel pinion
  const yc = yGear + 0.009;
  sweeps.push({ path: [[xAxle, yc, Rw + sprocketR], [xReel, yc, Rr + pinionR]], radius: 0.005, sides: 5, tint: HUB });  // chain top
  sweeps.push({ path: [[xAxle, yc, Rw - sprocketR], [xReel, yc, Rr - pinionR]], radius: 0.005, sides: 5, tint: HUB });  // chain bottom

  // handle: two side rails sweeping up-and-back from the axle to a cross grip
  for (const sgn of [-1, 1]) {
    const y = sgn * (ySide + 0.02);
    sweeps.push({ path: [[xAxle, y, Rw], [-0.30, y, 0.46], [-0.62, y, 0.94]], radius: 0.013, sides: 7, tint: BAR });
  }
  sweeps.push({ path: [[-0.62, -(ySide + 0.02), 0.94], [-0.62, ySide + 0.02, 0.94]], radius: 0.015, sides: 8, tint: GRIP });

  return { lathes, sweeps };
}
