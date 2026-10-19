/**
 * alien-body.js — the ALIEN BODY: a humanoid FORMED out of pointed ellipsoids (spindles) and the relations between
 * them, the way an alien Transformer reads as a figure without a single human-shaped part. No panel is a car's or a
 * suit's: every limb, the trunk, the head, is a long pointed shell laid along its bone, the joints only where two
 * shells meet; the figure is in their proportions and their angles (the shoulders thrown out and up, the forearms
 * fattening to blades, the head a forward-leaning dart, the feet long spurs). Folded face down, the same shells close
 * into an ALIEN JETSKI: a long keel shell (a blade down its back standing) runs under it as the hull, its point the
 * prow; the hull shells on its thighs slide up beside the trunk for sponsons; the legs together are its tail with the
 * feet hanging for skegs; its blades, spikes and spine swing back for fins.
 *
 *   alienBody({ H, palette, build }) → { manifest, kit, scheme: 'alien-jetski' }
 *
 * The same contract as variable-suit.js: `manifest` an assembler biped the suit bake rigs (facing +y, metres, feet on
 * z = 0), `kit` the shells that move apart as it folds ({ id, source, bone, flight: { bone, pivot, turns, to? } }).
 * `build` dials the relations: { reach (the arms' length), spur (the feet's), spread (the shoulders' throw) }. Pure.
 */

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

export const ALIEN_PALETTES = Object.freeze({
  void: { shell: '#2c2842', plate: '#4b4472', glow: '#5ff2e0', dark: '#15131f', accent: '#b46cff' },
  chrome: { shell: '#c8cdd8', plate: '#8e95a6', glow: '#ff4fa3', dark: '#2a2d35', accent: '#ffd2e8' },
  ember: { shell: '#2b1f1b', plate: '#5c2f1f', glow: '#ffa442', dark: '#140c0a', accent: '#ff6a2a' },
});

// a SPINDLE: a pointed ellipsoid shell from a to b (shares of H), its widest `r` at `bulge` along it
function spindle(H, a, b, r, tint, { bulge = 0.45, sides = 12 } = {}) {
  const P = (p) => ({ x: r4(p[0] * H), y: r4(p[1] * H), z: r4(p[2] * H) });
  const R = (v) => r4(Math.max(v, 0.0015) * H);
  return {
    axisFrom: P(a), axisTo: P(b), tint, crossSections: sides, samples: 10,
    profile: [
      { t: 0, radius: R(0) }, { t: r4(bulge * 0.45), radius: R(r * 0.72) }, { t: r4(bulge), radius: R(r) },
      { t: r4(bulge + (1 - bulge) * 0.5), radius: R(r * 0.68) }, { t: 1, radius: R(0) },
    ],
  };
}
const shells = (...lathes) => ({ lathes });

/**
 * alienBody({ H, palette, build }) → { manifest, kit, scheme: 'alien-jetski' }
 */
export function alienBody({ H = 3.5, palette = 'void', build = {} } = {}) {
  const C = typeof palette === 'object' ? { ...ALIEN_PALETTES.void, ...palette } : (ALIEN_PALETTES[palette] || ALIEN_PALETTES.void);
  const reach = build.reach ?? 1, spur = build.spur ?? 1, spread = build.spread ?? 1;
  const item = (id, source) => ({ id, source, at: [0, 0, 0] });
  const items = [], kit = [];
  for (const s of [-1, 1]) {
    const x = s, t = s < 0 ? 'l' : 'r';
    const sx = 0.17 + 0.02 * spread, ez = 0.8 - 0.17 * reach, wz = ez - 0.16 * reach;
    items.push(
      // the shoulder: a shell thrown out and up from the collar
      item(`shoulder_${t}`, shells(spindle(H, [0.06 * x, -0.01, 0.8], [(0.24 + 0.04 * spread) * x, -0.03, 0.86 + 0.02 * spread], 0.05, C.shell, { bulge: 0.4 }))),
      item(`upper_arm_${t}`, shells(spindle(H, [sx * x, 0, 0.83], [(sx + 0.01) * x, 0.005, ez], 0.032, C.plate))),
      // the forearm fattens toward the wrist into a blade
      item(`forearm_${t}`, shells(spindle(H, [(sx + 0.01) * x, 0.005, ez + 0.02], [(sx + 0.02) * x, 0.02, wz], 0.045, C.shell, { bulge: 0.62 }),
        spindle(H, [(sx + 0.01) * x, 0.02, ez + 0.005], [(sx + 0.01) * x, 0.03, ez - 0.015], 0.016, C.glow, { sides: 8 }))),
      item(`hand_${t}`, shells(spindle(H, [(sx + 0.02) * x, 0.02, wz + 0.01], [(sx + 0.02) * x, 0.035, wz - 0.07], 0.024, C.dark, { bulge: 0.35 }))),
      item(`thigh_${t}`, shells(spindle(H, [0.07 * x, 0, 0.53], [0.085 * x, 0.01, 0.27], 0.055, C.shell, { bulge: 0.32 }))),
      item(`shin_${t}`, shells(spindle(H, [0.085 * x, 0.005, 0.3], [0.09 * x, -0.02, 0.04], 0.048, C.plate, { bulge: 0.3 }),
        spindle(H, [0.085 * x, 0.02, 0.29], [0.085 * x, 0.03, 0.26], 0.018, C.glow, { sides: 8 }))),
      // the foot: a long spur forward from the heel
      item(`foot_${t}`, shells(spindle(H, [0.09 * x, -0.05, 0.035], [0.095 * x, 0.12 + 0.06 * spur, 0.01], 0.03, C.dark, { bulge: 0.3 }))),
    );
    // KIT: the forearm's outer blade swings out into a sponson fin
    kit.push({
      id: `blade_${t}`, bone: `forearm${s < 0 ? 'L' : 'R'}`,
      source: shells(spindle(H, [(sx + 0.05) * x, 0.0, ez], [(sx + 0.06) * x, -0.03, wz - 0.04], 0.018, C.accent, { bulge: 0.3, sides: 8 })),
      flight: { bone: `forearm${s < 0 ? 'L' : 'R'}`, pivot: [(sx + 0.05) * x * H, 0, ez * H], turns: [['y', s * 35]] },
    });
    // KIT: the hull shell on the outer thigh slides up beside the trunk into the jetski's sponson
    kit.push({
      id: `hull_${t}`, bone: `thigh${s < 0 ? 'L' : 'R'}`,
      source: shells(spindle(H, [0.15 * x, 0.0, 0.52], [0.165 * x, 0.01, 0.14], 0.052, C.plate, { bulge: 0.42 }),
        spindle(H, [0.152 * x, 0.035, 0.42], [0.16 * x, 0.042, 0.3], 0.012, C.glow, { sides: 6 })),
      flight: { bone: 'torso', pivot: [0.157 * x * H, 0.005 * H, 0.335 * H], turns: [], to: [0.2 * x * H, 0.05 * H, 0.66 * H] },
    });
    // KIT: the spike over the shoulder lies back along the body into a fairing
    kit.push({
      id: `spike_${t}`, bone: `upperArm${s < 0 ? 'L' : 'R'}`,
      source: shells(spindle(H, [(0.2 + 0.02 * spread) * x, -0.03, 0.88], [(0.33 + 0.03 * spread) * x, -0.06, 0.99], 0.016, C.accent, { bulge: 0.3, sides: 8 })),
      flight: { bone: `upperArm${s < 0 ? 'L' : 'R'}`, pivot: [(0.2 + 0.02 * spread) * x * H, -0.03 * H, 0.88 * H], turns: [['y', s * 110]] },
    });
  }
  items.push(
    // the trunk: a broad shell widest at the chest, a narrow waist shell, the pelvis a shell across
    item('chest', shells(spindle(H, [0, 0, 0.56], [0, 0, 0.9], 0.115, C.shell, { bulge: 0.62 }),
      spindle(H, [0, 0.07, 0.72], [0, 0.085, 0.79], 0.02, C.glow, { sides: 8 }))),
    item('waist', shells(spindle(H, [0, 0, 0.5], [0, 0, 0.64], 0.06, C.plate))),
    item('pelvis', shells(spindle(H, [-0.12, 0, 0.52], [0.12, 0, 0.52], 0.055, C.dark, { bulge: 0.5 }))),
    // the head: a dart leaning forward off the neck, its eye a sliver of light, a crest swept back
    item('head', shells(spindle(H, [0, -0.03, 0.88], [0, 0.07, 1.0], 0.045, C.plate, { bulge: 0.4 }),
      spindle(H, [-0.03, 0.045, 0.955], [0.03, 0.045, 0.955], 0.008, C.glow, { sides: 6 }),
      spindle(H, [0, -0.02, 0.96], [0, -0.1, 1.02], 0.014, C.accent, { bulge: 0.25, sides: 8 }))),
  );
  // KIT: the dorsal spine over the back stands up and sweeps back into the jetski's fin
  kit.push({
    id: 'spine', bone: 'torso',
    source: shells(spindle(H, [0, -0.1, 0.7], [0, -0.17, 0.92], 0.02, C.accent, { bulge: 0.25, sides: 8 })),
    flight: { bone: 'torso', pivot: [0, -0.1 * H, 0.7 * H], turns: [['x', 113]] },
  });
  // KIT: the keel, the jetski's whole hull: standing, a long blade hanging down its back like a tail; folded, under
  // the body from ahead of the head to the hips, its point the prow (a spindle reads the same either way along it)
  kit.push({
    id: 'keel', bone: 'torso',
    source: shells(spindle(H, [0, -0.17, 0.95], [0, -0.2, 0.25], 0.07, C.dark, { bulge: 0.38 }),
      spindle(H, [0, -0.235, 0.8], [0, -0.24, 0.55], 0.012, C.glow, { sides: 6 })),
    flight: { bone: 'torso', pivot: [0, -0.185 * H, 0.6 * H], turns: [['z', 180]], to: [0, 0.14 * H, 0.78 * H] },
  });
  return {
    manifest: { kind: 'assembler', title: `alien body (${typeof palette === 'string' ? palette : 'custom'})`, facing: '+y', units: 'm', items },
    kit,
    scheme: 'alien-jetski',
  };
}
