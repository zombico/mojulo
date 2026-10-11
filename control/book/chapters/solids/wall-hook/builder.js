// A screw-on wall hook: a back plate, an arm and an upturned lip, drawn as one side profile with filleted inside
// corners and extruded across its width. Countersunk screw holes through the plate (ISO, from the mj_* library).
// Pure: the params in, the same OpenSCAD program out. The params lead the program as variables, so a row detached by
// a hand edit still reads as a recipe.

export const part = {
  id: 'wall-hook',
  title: 'wall hook',
  params: {
    reach: { default: 40, min: 15, max: 120, unit: 'mm', says: 'wall to the outer face of the lip' },
    lip: { default: 14, min: 0, max: 60, unit: 'mm', says: 'how far the tip turns up past the arm' },
    width: { default: 20, min: 10, max: 80, unit: 'mm', says: 'across the hook' },
    thickness: { default: 6, min: 3, max: 15, unit: 'mm', says: 'the section of the plate, arm and lip' },
    plate: { default: 60, min: 30, max: 180, unit: 'mm', says: 'height of the back plate' },
    screw: { default: 'M4', one_of: ['M3', 'M4', 'M5', 'none'], says: 'countersunk screws through the plate' },
  },
};

// The narrowest plate a countersunk head sits in with a 2 mm rim either side.
const MIN_WIDTH = { M3: 10, M4: 12, M5: 14, none: 0 };

export function source(p) {
  if (p.width < MIN_WIDTH[p.screw]) throw new Error(`a ${p.screw} countersunk head needs width ≥ ${MIN_WIDTH[p.screw]} mm (asked ${p.width})`);
  if (p.reach < 2 * p.thickness + 3) throw new Error(`reach ${p.reach} mm leaves no opening at thickness ${p.thickness} mm: reach ≥ ${2 * p.thickness + 3}`);
  // One screw on a short plate, two on a tall one: the holes sit clear of the arm and the top edge.
  const low = p.thickness + 10;
  const high = p.plate - 10;
  const holes = p.screw === 'none' ? [] : high - low >= 16 ? [low + 4, high] : [(low + high) / 2];
  return [
    '// wall hook · a recipe-book part (mm, z up, installed as it hangs)',
    `reach = ${p.reach};`,
    `lip = ${p.lip};`,
    `width = ${p.width};`,
    `t = ${p.thickness};`,
    `plate = ${p.plate};`,
    'fillet = t * 0.8;',
    '',
    'module profile() {',
    '  offset(r = -fillet) offset(delta = fillet) union() {',
    '    square([t, plate]);',
    '    square([reach, t]);',
    '    translate([reach - t, 0]) square([t, t + lip]);',
    '  }',
    '}',
    '',
    'difference() {',
    '  translate([0, width, 0]) rotate([90, 0, 0]) linear_extrude(width) profile();',
    ...holes.map((z) => `  translate([t, width / 2, ${z}]) rotate([0, 90, 0]) mj_countersink("${p.screw}", t + 1);`),
    '}',
    '',
  ].join('\n');
}
