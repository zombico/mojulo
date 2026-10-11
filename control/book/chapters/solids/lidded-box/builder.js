// A box with a lid that drops in: the base is a rounded shell, the lid a plate with a lip that slips inside the
// opening at a printed fit (mj_fit: slip by default). Two parts, laid out side by side as they print, the lid upside
// down. The params name the INSIDE, the space the box holds. Pure: the params in, the same program out.

export const part = {
  id: 'lidded-box',
  title: 'box with a lid',
  params: {
    inside_w: { default: 80, min: 10, max: 250, unit: 'mm', says: 'inside width, the space it holds' },
    inside_d: { default: 50, min: 10, max: 250, unit: 'mm', says: 'inside depth' },
    inside_h: { default: 35, min: 5, max: 200, unit: 'mm', says: 'inside height, floor to rim' },
    wall: { default: 2, min: 1.2, max: 6, unit: 'mm', says: 'wall, floor and lid thickness' },
    corner: { default: 5, min: 0, max: 30, unit: 'mm', says: 'outside corner radius' },
    lid_lip: { default: 6, min: 2, max: 30, unit: 'mm', says: 'how deep the lid\'s lip reaches into the box' },
    fit: { default: 'slip', one_of: ['tight', 'slip', 'loose'], says: 'how the lid goes in: tight holds, loose lifts off' },
  },
};

export function source(p) {
  const least = 2 * p.wall + 4;
  if (p.inside_w < least || p.inside_d < least) throw new Error(`the lid's lip needs inside_w and inside_d ≥ ${least} mm at wall ${p.wall}`);
  return {
    source: [
      '// box with a lid · a recipe-book part (mm, z up, laid out as it prints)',
      `inside = [${p.inside_w}, ${p.inside_d}, ${p.inside_h}];`,
      `wall = ${p.wall};`,
      `corner = ${p.corner};`,
      `lip = ${p.lid_lip};`,
      `fit = "${p.fit}";`,
      'outside = [inside[0] + 2 * wall, inside[1] + 2 * wall];',
      'c = mj_fit(fit);                        // clearance each side between the lid\'s lip and the wall',
      'r_out = max(corner, 0.01);',
      'r_in = max(corner - wall, 0.01);',
      '',
      'module box_base() difference() {',
      '  mj_rounded_plate([outside[0], outside[1], inside[2] + wall], r_out);',
      '  translate([wall, wall, wall]) mj_rounded_plate([inside[0], inside[1], inside[2] + 1], r_in);',
      '}',
      '',
      'module box_lid() {',
      '  mj_rounded_plate([outside[0], outside[1], wall], r_out);',
      '  translate([wall + c, wall + c, wall]) difference() {',
      '    mj_rounded_plate([inside[0] - 2 * c, inside[1] - 2 * c, lip], max(r_in - c, 0.01));',
      '    translate([wall, wall, -1]) mj_rounded_plate([inside[0] - 2 * c - 2 * wall, inside[1] - 2 * c - 2 * wall, lip + 2], max(r_in - c - wall, 0.01));',
      '  }',
      '}',
      '',
    ].join('\n'),
    parts: {
      base: 'box_base();',
      lid: `translate([${p.inside_w + 2 * p.wall + 10}, 0, 0]) box_lid();`,
    },
  };
}
