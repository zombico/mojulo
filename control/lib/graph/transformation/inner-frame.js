/**
 * inner-frame.js — the robot a vehicle stands up into when no suit is given: an INNER FRAME (the skeleton a mobile
 * suit's armour hangs on, the endoskeleton a Transformer's panels part to show), made as a plain assembler biped so
 * the suit bake (worlds/unit-rig.js bakeUnitRig) rigs and animates it like any suit.
 *
 * Proportions are a heroic machine's, in fractions of the height `H` (metres): shoulders wide, a narrow waist, long
 * legs. Struts are lathes with a bulge at each joint, the trunk extruded blocks; slim on purpose, so the vehicle's
 * shell closes over it in the vehicle form. Station ids are the biped vocabulary unit-pose.js reads (sides by
 * position: −x is the left). Facing +y, metres, feet on z = 0.
 */

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

// a strut from `a` to `b` (fractions of H): radius r, a joint bulge rj at each end unless told otherwise
function strut(H, a, b, r, rj, tint, { capA = true, capB = true } = {}) {
  const P = (p) => ({ x: r4(p[0] * H), y: r4(p[1] * H), z: r4(p[2] * H) });
  const rr = (v) => r4(v * H);
  return {
    axisFrom: P(a), axisTo: P(b), tint, crossSections: 10, samples: 8,
    profile: [
      { t: 0, radius: rr(capA ? rj * 0.45 : r) },
      { t: 0.06, radius: rr(capA ? rj : r) },
      { t: 0.18, radius: rr(r) },
      { t: 0.82, radius: rr(r * 0.92) },
      { t: 0.94, radius: rr(capB ? rj * 0.9 : r) },
      { t: 1, radius: rr(capB ? rj * 0.4 : r) },
    ],
  };
}

// a block: rect w × d (x × y), from z0 to z1 (fractions of H), centred on (cx, cy)
function block(H, w, d, z0, z1, tint, cx = 0, cy = 0, round = 0.012) {
  return {
    profile: { rect: { w: r4(w * H), h: r4(d * H), r: r4(round * H) } },
    axisFrom: { x: r4(cx * H), y: r4(cy * H), z: r4(z0 * H) }, axisTo: { x: r4(cx * H), y: r4(cy * H), z: r4(z1 * H) },
    tint,
  };
}

/**
 * innerFrameManifest({ H, tint, joint, eye, build }) → an assembler manifest (kind 'assembler', facing '+y', units 'm').
 * `tint`: the struts (gunmetal by default); `joint`: the trunk blocks and the head; `eye`: the visor. `build`: the
 * frame's breadth, { shoulder, hip, chest } as shares of the height (0.19, 0.086, 0.3): a jet's frame is narrow
 * enough to lie inside its fuselage.
 */
export function innerFrameManifest({ H = 4.5, tint = '#3d434c', joint = '#6b737e', eye = '#7fd4ff', build = {} } = {}) {
  const sh = build.shoulder ?? 0.19, hp = build.hip ?? 0.086, ch = build.chest ?? 0.3;
  const item = (id, source) => ({ id, source, at: [0, 0, 0] });
  const L = (sx) => sx;   // side sign: −1 left, +1 right
  const side = (s, nm) => `${nm}_${s < 0 ? 'l' : 'r'}`;
  const limbs = [];
  for (const s of [-1, 1]) {
    const x = L(s);
    limbs.push(
      item(side(s, 'upper_arm'), { lathes: [strut(H, [(sh - 0.002) * x, 0, 0.79], [sh * x, 0, 0.625], 0.032, 0.05, tint)] }),
      item(side(s, 'forearm'), { lathes: [strut(H, [sh * x, 0, 0.618], [sh * x, 0.004, 0.462], 0.03, 0.04, tint)] }),
      item(side(s, 'hand'), { lathes: [strut(H, [sh * x, 0.004, 0.457], [sh * x, 0.008, 0.402], 0.03, 0.034, joint)] }),
      item(side(s, 'thigh'), { lathes: [strut(H, [hp * x, 0, 0.488], [hp * x, 0, 0.278], 0.044, 0.056, tint)] }),
      item(side(s, 'lower_leg'), { lathes: [strut(H, [hp * x, 0, 0.272], [hp * x, -0.004, 0.058], 0.037, 0.048, tint)] }),
      item(side(s, 'foot'), { extrudes: [block(H, 0.072, 0.17, 0, 0.052, joint, hp * x, 0.035, 0.01)] }),
    );
  }
  return {
    kind: 'assembler',
    title: 'inner frame',
    facing: '+y',
    units: 'm',
    items: [
      item('head', {
        lathes: [
          { ...strut(H, [0, 0, 0.868], [0, 0, 0.99], 0.056, 0.05, joint, { capA: true, capB: true }) },
          { ...strut(H, [0, 0.03, 0.915], [0, 0.058, 0.915], 0.012, 0.016, eye), crossSections: 6, samples: 4 },
        ],
      }),
      item('neck', { lathes: [strut(H, [0, 0, 0.8], [0, 0, 0.87], 0.024, 0.03, tint)] }),
      item('chest', { extrudes: [block(H, ch, 0.15, 0.645, 0.8, joint)] }),
      item('waist', { extrudes: [block(H, ch * 0.53, 0.11, 0.552, 0.648, tint)] }),
      item('pelvis', { extrudes: [block(H, Math.max(ch * 0.73, hp * 2 + 0.05), 0.13, 0.468, 0.556, joint)] }),
      ...limbs,
    ],
  };
}
