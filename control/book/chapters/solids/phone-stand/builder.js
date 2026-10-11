// A desk stand for a phone or a small tablet: a base, a front lip that catches the device's bottom edge, a backrest
// leaning at the viewing angle and a strut under it, drawn as one side profile and extruded across the width.
// An optional slot through the lip and base takes a charging cable. Pure: the params in, the same program out.

export const part = {
  id: 'phone-stand',
  title: 'phone stand',
  params: {
    device: { default: 11, min: 5, max: 30, unit: 'mm', says: 'thickness of the phone with its case: the groove is this plus a clearance' },
    angle: { default: 65, min: 45, max: 80, unit: '°', says: 'the backrest from the desk' },
    width: { default: 70, min: 30, max: 220, unit: 'mm', says: 'across the stand' },
    back: { default: 90, min: 40, max: 180, unit: 'mm', says: 'length of the backrest' },
    lip: { default: 9, min: 3, max: 25, unit: 'mm', says: 'how high the front lip stands above the groove floor' },
    wall: { default: 4, min: 2.4, max: 8, unit: 'mm', says: 'the section of every member' },
    cable: { default: true, says: 'a slot through the lip and base for a charging cable' },
  },
};

export function source(p) {
  return [
    '// phone stand · a recipe-book part (mm, z up, as it stands on the desk)',
    `device = ${p.device};`,
    `angle = ${p.angle};`,
    `width = ${p.width};`,
    `back = ${p.back};`,
    `lip = ${p.lip};`,
    `w = ${p.wall};`,
    `cable = ${p.cable ? 'true' : 'false'};`,
    'gap = device / sin(angle) + 1;          // the groove: the leaning device\'s footprint, with 1 mm of clearance',
    'x0 = w;                                 // the groove starts behind the lip',
    'lean = 90 - angle;',
    'top = [x0 + gap + back * cos(angle), w + back * sin(angle)];   // the backrest\'s upper end',
    'depth = top[0] + w + 10;                // the base runs past the top for stability',
    'strut = [x0 + gap + back * 0.55 * cos(angle), w + back * 0.55 * sin(angle)];',
    '',
    'module profile() {',
    '  offset(r = -w / 2) offset(delta = w / 2) union() {',
    '    square([depth, w]);                                   // base',
    '    square([w, w + lip]);                                 // front lip',
    '    translate([x0 + gap, w]) rotate(-lean) square([w, back]);   // backrest',
    '    translate([strut[0], 0]) square([w, strut[1]]);       // strut',
    '  }',
    '}',
    '',
    'difference() {',
    '  translate([0, width, 0]) rotate([90, 0, 0]) linear_extrude(width) profile();',
    '  if (cable) translate([-1, width / 2 - 6, -1]) cube([x0 + gap + 1, 12, w + lip + 2]);',
    '}',
    '',
  ].join('\n');
}
