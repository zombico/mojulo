/**
 * mech-lib — mojulo's own OpenSCAD library of mechanical features, for the `scad` kind.
 *
 * The scad fence refuses `include` / `use` (a recipe must carry its own geometry), so BOSL2 and MCAD
 * are out, and an agent writing a thread, an involute gear or a bolt from memory gets it wrong in
 * the quiet ways the industrial study measured: a twist-extruded circle that no nut fits, a hand
 * polyhedron Manifold refuses as non-manifold, a hole printed undersize because OpenSCAD's circles
 * are inscribed. This is the vendored, pinned allowlist the card promised: one program text, owned
 * here, versioned, PREPENDED to a source that calls an `mj_` module or function — never otherwise,
 * so a source without one renders byte-for-byte as before. The text is part of the program, so the
 * geometry memo keys on it, and `MECH_LIB_VERSION` is stamped in the ledger of a row that used it.
 *
 * Every number below is a compatibility promise over minted rows: change a table entry or a
 * profile and bump the version (the manual is solid-vocab/scad.md, section "mechanical library").
 *
 * Conventions: millimetres, z up, a part's base at z = 0 and its axis on z. Cutters (`*_hole`,
 * `mj_countersink`, `mj_nut_trap`, …) run from z = 0 DOWN into the material by `depth` plus a
 * little overshoot above, so `difference() { plate(); translate([x, y, top]) mj_clearance_hole("M4", 6); }`
 * is the whole idiom. Threads are real helices: an ISO 68-1 basic profile (or a trapezoidal / worm
 * one) swept on a sheared grid, so the flanks are exact planes between rows and the seam closes.
 */

export const MECH_LIB_VERSION = 1;

/** Does a (comment-stripped) source call the library? An identifier starting `mj_` is the trigger. */
export const usesMechLib = (bare) => /(^|[^A-Za-z0-9_])mj_[A-Za-z0-9_]/.test(String(bare));

export const MECH_LIB_SOURCE = String.raw`// ── mojulo mechanical library v1 (prepended by mojulo; call mj_* — edit your source, not this) ──
// ISO metric coarse: [name, d, pitch, hex AF (ISO 4032/4017), hex head k, nut m, socket dk, socket k,
//   hex key, countersunk dk (ISO 10642), clearance close/normal/loose (ISO 273), heat-set hole]
MJ_ISO = [
  ["M2",   2,   0.4,  4,   1.4,  1.6,  3.8,  2,   1.5, 3.8,   2.2,  2.4,  2.6,  3.2],
  ["M2.5", 2.5, 0.45, 5,   1.7,  2.0,  4.5,  2.5, 2,   4.7,   2.7,  2.9,  3.1,  3.6],
  ["M3",   3,   0.5,  5.5, 2,    2.4,  5.5,  3,   2.5, 6.72,  3.2,  3.4,  3.6,  4.0],
  ["M4",   4,   0.7,  7,   2.8,  3.2,  7,    4,   3,   8.96,  4.3,  4.5,  4.8,  5.6],
  ["M5",   5,   0.8,  8,   3.5,  4.7,  8.5,  5,   4,   11.2,  5.3,  5.5,  5.8,  6.4],
  ["M6",   6,   1.0,  10,  4,    5.2,  10,   6,   5,   13.44, 6.4,  6.6,  7,    8.0],
  ["M8",   8,   1.25, 13,  5.3,  6.8,  13,   8,   6,   17.92, 8.4,  9,    10,   10.0],
  ["M10",  10,  1.5,  16,  6.4,  8.4,  16,   10,  8,   22.4,  10.5, 11,   12,   0],
  ["M12",  12,  1.75, 18,  7.5,  10.8, 18,   12,  10,  26.88, 13,   13.5, 14.5, 0],
  ["M16",  16,  2.0,  24,  10,   14.8, 24,   16,  14,  33.6,  17,   17.5, 18.5, 0],
  ["M20",  20,  2.5,  30,  12.5, 18,   30,   20,  17,  40.32, 21,   22,   24,   0],
  ["M24",  24,  3.0,  36,  15,   21.5, 36,   24,  19,  0,     25,   26,   28,   0]
];
function mj_iso(size) = let(r = [for (e = MJ_ISO) if (e[0] == size) e])
  assert(len(r) == 1, str("mj_iso: no ISO coarse size ", size, " — one of M2 M2.5 M3 M4 M5 M6 M8 M10 M12 M16 M20 M24"))
  r[0];
function mj_iso_d(size) = mj_iso(size)[1];
function mj_iso_pitch(size) = mj_iso(size)[2];
function mj_clearance(size, fit = "normal") = mj_iso(size)[fit == "close" ? 10 : fit == "loose" ? 12 : 11];
// A printed fit: diametral clearance added to a nominal size (FDM defaults; SLA/SLS wants about half).
function mj_fit(fit = "slip") = fit == "press" ? 0 : fit == "tight" ? 0.1 : fit == "slip" ? 0.2 : fit == "loose" ? 0.4 : fit == "running" ? 0.3 : assert(false, str("mj_fit: press | tight | slip | running | loose, not ", fit));
// OpenSCAD inscribes its circles, so a printed bore comes out undersize by the facet sagitta:
// mj_hole circumscribes, so the FLATS of the polygon sit on the asked diameter.
function mj__n(d) = $fn > 0 ? max(3, $fn) : max(16, ceil(d * PI / 0.5));
module mj_circle_out(d) { n = mj__n(d); circle(d = d / cos(180 / n), $fn = n); }
module mj_hole(d, depth, fit = "press", over = 1) {
  dd = d + mj_fit(fit); n = mj__n(dd);
  translate([0, 0, -depth]) cylinder(d = dd / cos(180 / n), h = depth + over, $fn = n);
}

// ── threads ──────────────────────────────────────────────────────────────────────────────────
// A profile is [depth, crest, flank_lo, root, flank_hi] as fractions of the pitch (axial widths),
// crest at the major radius. mj__rad maps a phase u in [0,1) to the radial drop below major.
function mj_profile_iso(pitch) = [0.54127 * pitch, 1/8, 5/16, 1/4, 5/16];
function mj_profile_trapezoid(pitch) = [0.5 * pitch, 0.366, 0.134, 0.366, 0.134];   // ISO 2904, 30°
function mj_profile_worm(mod, pa = 20) = let(p = PI * mod, h = 2.25 * mod, f = h * tan(pa) / p, c = 0.5 - 2 * mod * tan(pa) / p) [h, c, f, 1 - c - 2 * f, f];
// The breakpoints of one pitch: [u, drop] with u ascending from 0 (crest start) to 1.
function mj__rows(prof) = let(c = prof[1], f1 = prof[2], r = prof[3])
  [[0, 0], [c, 0], [c + f1, 1], [c + f1 + r, 1]];
// A helical rod of major diameter d, axis z, from z = 0 to length, with flat ends.
module mj_thread_rod(d, pitch, length, prof = undef, starts = 1, left = false, segments = 0) {
  pr = is_undef(prof) ? mj_profile_iso(pitch) : prof;
  na = segments > 0 ? segments : max(24, min(96, ceil(d * PI / 0.6)));
  lead = pitch * starts;
  R = d / 2; depth = pr[0];
  br = mj__rows(pr);
  m = len(br);
  // rows run from below z = 0 by a lead plus a pitch to above length by the same, so the ragged
  // helical ends are cut away by the intersection below
  k0 = -ceil(lead / pitch) - 1; k1 = ceil(length / pitch) + 1;
  rows = [for (k = [k0 : k1], b = br) [pitch * (k + b[0]), b[1]]];
  nr = len(rows);
  S = m * starts;                     // a full turn advances the row index by one lead
  sg = left ? -1 : 1;
  pts = concat(
    [for (i = [0 : na - 1], j = [0 : nr - 1]) let(a = sg * 360 * i / na, z = rows[j][0] + lead * i / na, r = R - depth * rows[j][1]) [r * cos(a), r * sin(a), z]],
    [[0, 0, rows[0][0] - lead], [0, 0, rows[nr - 1][0] + 2 * lead]]);
  id = function (i, j) i * nr + j;
  bot = na * nr; top = bot + 1;
  side = concat(
    [for (i = [0 : na - 2], j = [0 : nr - 2]) [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]],
    [for (j = [0 : nr - 2 - S]) [id(na - 1, j), id(0, j + S), id(0, j + S + 1), id(na - 1, j + 1)]]);
  // the two ragged rims, each fanned to a point on the axis beyond it
  rimB = concat([for (i = [0 : na - 1]) id(i, 0)], [for (j = [S : -1 : 1]) id(0, j)]);
  rimT = concat([for (i = [0 : na - 1]) id(i, nr - 1)], [for (j = [nr - 2 : -1 : nr - 1 - S]) id(na - 1, j)]);
  fans = concat(
    [for (q = [0 : len(rimB) - 1]) [bot, rimB[(q + 1) % len(rimB)], rimB[q]]],
    [for (q = [0 : len(rimT) - 1]) [top, rimT[q], rimT[(q + 1) % len(rimT)]]]);
  faces = [for (f = concat(side, fans)) sg > 0 ? [for (q = [len(f) - 1 : -1 : 0]) f[q]] : f];
  intersection() {
    polyhedron(pts, faces, convexity = 6);
    translate([0, 0, 0]) cylinder(r = R + 1, h = length, $fn = 8);
  }
}
// An ISO metric thread, external; chamfer = a 45° lead-in at both ends (the printed one that starts).
module mj_thread(size, length, chamfer = true, left = false, starts = 1) {
  d = mj_iso_d(size); p = mj_iso_pitch(size); dm = d - 1.22687 * p;
  intersection() {
    mj_thread_rod(d, p, length, starts = starts, left = left);
    if (chamfer) rotate_extrude($fn = 48) polygon([[0, 0], [dm / 2, 0], [d / 2 + 0.01, d / 2 - dm / 2], [d / 2 + 0.01, length - (d / 2 - dm / 2)], [dm / 2, length], [0, length]]);
    else cylinder(d = d + 2, h = length);
  }
}
// The cutter for an internal thread (a nut, a tapped hole): the ideal mating bolt grown by a radial
// clearance, run from z = 0 down by depth. 0.15 mm is an FDM default; SLA wants 0.05–0.1.
module mj_tapped_hole(size, depth, clearance = 0.15, over = 1, left = false) {
  d = mj_iso_d(size); p = mj_iso_pitch(size);
  translate([0, 0, -depth]) {
    mj_thread_rod(d + 2 * clearance, p, depth + over, left = left);
    cylinder(d = d - 1.0825 * p + 2 * clearance, h = depth + over, $fn = 48);
    translate([0, 0, depth - 0.5 * p]) cylinder(d1 = d - 1.0825 * p, d2 = d + 2 * clearance + p, h = 0.5 * p + over, $fn = 48);
  }
}
module mj_trapezoid_thread(d, pitch, length, starts = 1, left = false) mj_thread_rod(d, pitch, length, mj_profile_trapezoid(pitch), starts, left);

// ── fasteners ────────────────────────────────────────────────────────────────────────────────
// head: "hex" | "socket" | "button" | "countersunk". Printed orientation: the head on z = 0 (a
// countersunk head's wide face down), the shank up; length is under the head (the full length for
// countersunk, as ISO 10642 counts it). thread = threaded length from the tip (default all of it).
// Real threads: it screws into mj_nut / mj_tapped_hole.
module mj_bolt(size, length, head = "hex", thread = 0) {
  e = mj_iso(size); d = e[1];
  tl = thread > 0 ? min(thread, length) : length;
  hk = head == "hex" ? e[4] : head == "socket" ? e[7] : head == "button" ? 0.55 * d : 0;
  if (head == "hex") cylinder(d = e[3] / cos(30), h = e[4], $fn = 6);
  else if (head == "socket") difference() { cylinder(d = e[6], h = e[7], $fn = 48); translate([0, 0, -1]) cylinder(d = e[8] / cos(30), h = 0.6 * e[7] + 1, $fn = 6); }
  else if (head == "button") difference() { resize([0.95 * e[6], 0.95 * e[6], hk]) intersection() { translate([0, 0, 0]) sphere(d = 2, $fn = 48); translate([-1, -1, 0]) cube(2); } translate([0, 0, -1]) cylinder(d = e[8] / cos(30), h = 0.6 * hk + 1, $fn = 6); }
  else if (head == "countersunk") difference() { cylinder(d1 = e[9], d2 = d, h = (e[9] - d) / 2, $fn = 48); translate([0, 0, -1]) cylinder(d = e[8] / cos(30), h = 0.3 * d + 1, $fn = 6); }
  else assert(false, str("mj_bolt: head is hex | socket | button | countersunk, not ", head));
  sl = length - tl; sh = head == "countersunk" ? (e[9] - d) / 2 : 0;
  translate([0, 0, hk - 0.01]) {
    if (sl > 0) cylinder(d = d, h = sl + 0.02, $fn = 48);
    translate([0, 0, sl]) mj_thread(size, tl + 0.01 - (head == "countersunk" ? 0 : 0));
  }
}
// A hex nut (ISO 4032), threaded, on z = 0. thin = true is the jam nut (ISO 4035, 0.5 d).
module mj_nut(size, thin = false, clearance = 0.15) {
  e = mj_iso(size); m = thin ? 0.5 * e[1] : e[5];
  difference() {
    intersection() { cylinder(d = e[3] / cos(30), h = m, $fn = 6); cylinder(d1 = e[3] / cos(30) + 2 * m, d2 = e[3] / cos(30) - 0.05, h = m, $fn = 48); mirror([0, 0, 1]) translate([0, 0, -m]) cylinder(d1 = e[3] / cos(30) + 2 * m, d2 = e[3] / cos(30) - 0.05, h = m, $fn = 48); }
    translate([0, 0, m]) mj_tapped_hole(size, m + 1, clearance);
  }
}
module mj_washer(size) { e = mj_iso(size); difference() { cylinder(d = 2 * e[1] + 1, h = 0.18 * e[1] + 0.2, $fn = 48); translate([0, 0, -1]) cylinder(d = e[11], h = e[1], $fn = 48); } }

// ── fastener cutters (all from z = 0 down) ───────────────────────────────────────────────────
module mj_clearance_hole(size, depth, fit = "normal") mj_hole(mj_clearance(size, fit), depth);
module mj_counterbore(size, depth, head_depth = 0, fit = "normal") {
  e = mj_iso(size); hd = head_depth > 0 ? head_depth : e[7] + 0.2;
  mj_hole(mj_clearance(size, fit), depth); mj_hole(e[6] + 1, hd);
}
module mj_countersink(size, depth, fit = "normal") {
  e = mj_iso(size); dk = e[9] > 0 ? e[9] : 2 * e[1]; h = (dk - mj_clearance(size, fit)) / 2;
  mj_hole(mj_clearance(size, fit), depth);
  translate([0, 0, -h]) cylinder(d1 = mj_clearance(size, fit), d2 = dk + 0.4, h = h + 0.2, $fn = 48);
  translate([0, 0, 0.19]) cylinder(d = dk + 0.4, h = 1, $fn = 48);
}
// A hex pocket that captures a nut (point up/down along z), with a clearance bore through.
module mj_nut_trap(size, depth = 0, through = 0, clearance = 0.2) {
  e = mj_iso(size); dd = depth > 0 ? depth : e[5] + 0.3;
  translate([0, 0, -dd]) cylinder(d = (e[3] + clearance) / cos(30), h = dd + 1, $fn = 6);
  if (through > 0) mj_clearance_hole(size, through);
}
// A side-loaded nut slot: the trap, extended in +x by slot so the nut slides in from an edge.
module mj_nut_slot(size, slot, depth = 0, clearance = 0.2) {
  e = mj_iso(size); dd = depth > 0 ? depth : e[5] + 0.3; af = e[3] + clearance;
  translate([0, 0, -dd]) hull() { cylinder(d = af / cos(30), h = dd, $fn = 6); translate([slot, 0, 0]) cylinder(d = af / cos(30), h = dd, $fn = 6); }
}
// The pilot for a heat-set insert (M2–M8), with a lead-in. Check your insert's datasheet.
module mj_heatset_hole(size, depth) { e = mj_iso(size); assert(e[13] > 0, str("mj_heatset_hole: no insert size for ", size)); mj_hole(e[13], depth); translate([0, 0, -0.6]) cylinder(d1 = e[13], d2 = e[13] + 1, h = 0.61, $fn = 48); }

// ── gears ────────────────────────────────────────────────────────────────────────────────────
// Involute, metric module, 20° default. pitch d = mod * teeth; centre distance = mod*(z1+z2)/2.
function mj_gear_pitch_d(mod, teeth) = mod * teeth;
function mj_gear_center(mod, z1, z2) = mod * (z1 + z2) / 2;
function mj_ring_center(mod, ring, planet) = mod * (ring - planet) / 2;
function mj__inv(rb, t) = [rb * (cos(t * 180 / PI) + t * sin(t * 180 / PI)), rb * (sin(t * 180 / PI) - t * cos(t * 180 / PI))];
function mj__rot(p, a) = [p[0] * cos(a) - p[1] * sin(a), p[0] * sin(a) + p[1] * cos(a)];
// One tooth outline (2D), centred on +x, from the root circle out to the tip, flanks involute.
function mj_gear_tooth(mod, teeth, pa = 20, backlash = 0, clearance = 0.25, steps = 10) =
  let(rp = mod * teeth / 2, rb = rp * cos(pa), ra = rp + mod, rf = rp - (1 + clearance) * mod,
      tmax = sqrt(pow(ra / rb, 2) - 1), tp = sqrt(pow(rp / rb, 2) - 1), q = mj__inv(rb, tp),
      half = 90 / teeth + atan2(q[1], q[0]) - (backlash / 2) / rp * 180 / PI,
      r0 = max(rf, rb) == rb ? 0 : sqrt(pow(rf / rb, 2) - 1),
      fl = [for (i = [0 : steps]) mj__inv(rb, r0 + (tmax - r0) * i / steps)],
      a0 = rf < rb ? [mj__rot([rf, 0], -half)] : [])
  concat(a0, [for (p = fl) mj__rot(p, -half)], [for (i = [steps : -1 : 0]) let(p = fl[i]) mj__rot([p[0], -p[1]], half)], rf < rb ? [mj__rot([rf, 0], half)] : []);
module mj_gear2d(mod, teeth, pa = 20, backlash = 0, bore = 0) {
  rf = mod * teeth / 2 - 1.25 * mod;
  difference() {
    union() { circle(r = rf + 0.01, $fn = max(48, teeth * 4)); for (k = [0 : teeth - 1]) rotate(k * 360 / teeth) polygon(concat([[0, 0]], mj_gear_tooth(mod, teeth, pa, backlash))); }
    if (bore > 0) mj_circle_out(bore);
  }
}
// A spur gear (helix = 0) or helical gear (helix in degrees; a meshing pair takes opposite signs),
// herringbone = true doubles the helix as a chevron. On z = 0, axis z.
module mj_spur_gear(mod, teeth, thickness, bore = 0, pa = 20, helix = 0, herringbone = false, backlash = 0.1) {
  rp = mod * teeth / 2;
  tw = thickness * tan(helix) / rp * 180 / PI;
  if (helix == 0) linear_extrude(thickness) mj_gear2d(mod, teeth, pa, backlash, bore);
  else if (!herringbone) linear_extrude(thickness, twist = tw, slices = max(4, ceil(abs(tw) / 3))) mj_gear2d(mod, teeth, pa, backlash, bore);
  else { h = thickness / 2; t2 = tw / 2;
    linear_extrude(h, twist = t2, slices = max(4, ceil(abs(t2) / 3))) mj_gear2d(mod, teeth, pa, backlash, bore);
    translate([0, 0, h]) rotate(-t2) linear_extrude(h, twist = -t2, slices = max(4, ceil(abs(t2) / 3))) mj_gear2d(mod, teeth, pa, backlash, bore); }
}
// A rack along +x (teeth up), length = teeth * PI * mod, pitch line at z = height.
module mj_rack(mod, teeth, thickness, height, pa = 20, backlash = 0.1) {
  p = PI * mod; a = mod; f = 1.25 * mod; w2 = p / 4 - backlash / 4;
  rotate([90, 0, 0]) translate([0, 0, -thickness / 2]) linear_extrude(thickness) union() {
    square([teeth * p, height - f]);
    for (k = [0 : teeth - 1]) translate([k * p + p / 2, height]) polygon([[-w2 - f * tan(pa), -f - 0.01], [w2 + f * tan(pa), -f - 0.01], [w2 - a * tan(pa), a], [-w2 + a * tan(pa), a]]);
  }
}
// A ring gear: internal teeth for a spur of the same module (a planetary's annulus). od = outside.
module mj_ring_gear(mod, teeth, thickness, od, pa = 20, backlash = 0.1) {
  linear_extrude(thickness) difference() {
    circle(d = od, $fn = max(64, teeth * 3));
    // the tooth spaces are an external gear with its addendum and dedendum exchanged (+ backlash)
    offset(delta = backlash / 2) mj_gear2d(mod, teeth, pa, -backlash);
    circle(r = mod * teeth / 2 - mod + 0.01, $fn = max(64, teeth * 3));
  }
}
// A planetary set, assembled and phased: sun s teeth, n planets of p teeth, ring s + 2p. It only
// assembles with equally spaced planets when (s + ring) % n == 0 — asserted, not left to collide.
// The ring's outside diameter is od (default ring pitch + 6 modules). Ratio, ring fixed: 1 + ring/s.
function mj_planetary_ring(s, p) = s + 2 * p;
module mj_planetary(mod, sun, planet, n, thickness, od = 0, sun_bore = 0, planet_bore = 0, backlash = 0.1, parts = "all") {
  r = sun + 2 * planet;
  assert((sun + r) % n == 0, str("mj_planetary: ", n, " equally spaced planets need (sun + ring) % n == 0; sun ", sun, " + ring ", r, " = ", sun + r));
  if (parts == "all" || parts == "ring") mj_ring_gear(mod, r, thickness, od > 0 ? od : mod * (r + 6), backlash = backlash);
  if (parts == "all" || parts == "sun") rotate(planet % 2 ? 0 : 180 / sun) mj_spur_gear(mod, sun, thickness, sun_bore, backlash = backlash);
  if (parts == "all" || parts == "planets") for (k = [0 : n - 1]) let(th = 360 * k / n) rotate(th) translate([mj_gear_center(mod, sun, planet), 0, 0]) rotate(th * (1 + sun / planet)) mj_spur_gear(mod, planet, thickness, planet_bore, backlash = backlash);
}
// A straight bevel gear on a cone of pitch angle cone_deg (45 for a 1:1 mitre pair; for a ratio
// z1:z2, atan(z1/z2) and atan(z2/z1)). Approximation: the spur profile scaled toward the apex, so
// the tooth converges on the apex like a bevel's but is not a spherical involute. Back face on z = 0.
module mj_bevel_gear(mod, teeth, face, cone_deg = 45, bore = 0, pa = 20, backlash = 0.1) {
  rp = mod * teeth / 2; apex = rp / tan(cone_deg);
  assert(face < apex, "mj_bevel_gear: the face width must be shorter than the cone distance to the apex");
  difference() { linear_extrude(face, scale = 1 - face / apex) mj_gear2d(mod, teeth, pa, backlash);
    if (bore > 0) translate([0, 0, -1]) linear_extrude(face + 2) mj_circle_out(bore); }
}
// A worm (single or multi-start) of pitch diameter pd; it meshes a helical mj_spur_gear of the same
// module with helix = the lead angle atan(starts * mod / pd).
module mj_worm(mod, length, pd, starts = 1, bore = 0) {
  difference() { translate([0, 0, 0]) mj_thread_rod(pd + 2 * mod, PI * mod, length, mj_profile_worm(mod), starts);
    if (bore > 0) translate([0, 0, -1]) linear_extrude(length + 2) mj_circle_out(bore); }
}
function mj_worm_lead_angle(mod, pd, starts = 1) = atan(starts * mod / pd);

// ── belts ───────────────────────────────────────────────────────────────────────────────────
// A GT2 (2 mm pitch) timing pulley: teeth, belt width, bore; flanges and a hub with a set screw.
// The groove is drawn from the belt's published dims (tooth R0.555, height 0.75, PLD 0.254);
// printed profiles from the belt maker differ by a few hundredths.
module mj_gt2_pulley(teeth, width = 6, bore = 5, flange = 1, hub_d = 0, hub_h = 6, set_screw = "M3") {
  pd = teeth * 2 / PI; od = pd - 0.508; fd = od + 3; hd = hub_d > 0 ? hub_d : min(fd, max(bore + 7, od * 0.8));
  difference() {
    union() {
      cylinder(d = fd, h = flange, $fn = 64);
      translate([0, 0, flange]) linear_extrude(width + 0.6) difference() {
        circle(d = od, $fn = teeth * 4);
        for (k = [0 : teeth - 1]) rotate(k * 360 / teeth) translate([od / 2 - 0.75 + 0.555, 0]) hull() { circle(r = 0.555, $fn = 16); translate([1, 0]) square([0.1, 1.11], center = true); }
      }
      translate([0, 0, flange + width + 0.6]) cylinder(d = fd, h = flange, $fn = 64);
      if (hub_h > 0) translate([0, 0, 2 * flange + width + 0.6 - 0.01]) cylinder(d = hd, h = hub_h, $fn = 48);
    }
    translate([0, 0, -1]) linear_extrude(2 * flange + width + hub_h + 3) mj_circle_out(bore);
    if (hub_h > 0 && set_screw != "") translate([0, 0, 2 * flange + width + 0.6 + hub_h / 2]) rotate([0, 90, 0]) translate([0, 0, hd / 2 + 1]) rotate([180, 0, 0]) mj_tapped_hole(set_screw, hd / 2 + 1, 0.15, 0.01);
  }
}

// ── edges, shells, molded features ──────────────────────────────────────────────────────────
// A box with every edge filleted at r (true spherical corners), or chamfered at c.
module mj_rounded_box(size, r, center = false) {
  s = is_list(size) ? size : [size, size, size]; rr = min(r, min(s) / 2 - 0.001);
  translate(center ? -s / 2 : [0, 0, 0]) hull() for (x = [rr, s[0] - rr], y = [rr, s[1] - rr], z = [rr, s[2] - rr]) translate([x, y, z]) sphere(r = rr, $fn = max(16, ceil(rr * PI * 2 / 0.6)));
}
module mj_chamfer_box(size, c, center = false) {
  s = is_list(size) ? size : [size, size, size];
  translate(center ? -s / 2 : [0, 0, 0]) hull() { translate([c, c, 0]) cube([s[0] - 2 * c, s[1] - 2 * c, s[2]]); translate([0, c, c]) cube([s[0], s[1] - 2 * c, s[2] - 2 * c]); translate([c, 0, c]) cube([s[0] - 2 * c, s[1], s[2] - 2 * c]); }
}
// A rounded box filleted only on its vertical edges (r) — a plate, a lid, a case body.
module mj_rounded_plate(size, r) { linear_extrude(size[2]) translate([r, r]) offset(r = r, $fn = max(16, ceil(r * PI * 2 / 0.6))) square([size[0] - 2 * r, size[1] - 2 * r]); }
// Material to ADD into an inside corner: a fillet of radius r along +x, length l, in the y>0, z>0 quadrant.
module mj_fillet(l, r) { rotate([90, 0, 90]) linear_extrude(l) difference() { translate([-0.01, -0.01]) square(r + 0.01); translate([r, r]) circle(r = r, $fn = max(16, ceil(r * PI * 2 / 0.5))); } }
// Material to SUBTRACT from an outside edge along +x (the edge on the x axis, the solid in y<0, z<0): a fillet or a 45° chamfer.
module mj_edge_round(l, r) { translate([-0.01, 0, 0]) rotate([90, 0, 90]) linear_extrude(l + 0.02) difference() { translate([-r, -r]) square(r + 0.01); translate([-r, -r]) circle(r = r, $fn = max(16, ceil(r * PI * 2 / 0.5))); } }
module mj_edge_chamfer(l, c) { translate([-0.01, 0, 0]) rotate([90, 0, 90]) linear_extrude(l + 0.02) polygon([[0.01, 0.01], [-c, 0.01], [0.01, -c]]); }
// A molded shell: footprint [L, W], height H, wall t, corner radius r, draft in degrees on the
// outside walls (the inside drafts the same way), open at the top. No hull of tiny solids — that is
// what crashed the study's first attempt.
module mj_molded_shell(L, W, H, t, r = 3, draft = 1, floor = 0) {
  fl = floor > 0 ? floor : t;
  sh = H * tan(draft);
  module mj__footprint(l, w, rr) translate([-l / 2 + rr, -w / 2 + rr]) offset(r = rr, $fn = max(16, ceil(rr * PI * 2 / 0.6))) square([l - 2 * rr, w - 2 * rr]);
  difference() {
    linear_extrude(H, scale = [(L - 2 * sh) / L, (W - 2 * sh) / W]) mj__footprint(L, W, r);
    translate([0, 0, fl]) linear_extrude(H - fl + 0.01, scale = [(L - 2 * t - 2 * sh) / (L - 2 * t), (W - 2 * t - 2 * sh) / (W - 2 * t)]) mj__footprint(L - 2 * t, W - 2 * t, max(0.2, r - t));
  }
}
// A screw boss (od, pilot hole, height) with a drafted wall, and a gusset rib. Both stand on z = 0.
module mj_boss(od, hole, h, draft = 1) difference() { cylinder(d1 = od, d2 = od - 2 * h * tan(draft), h = h, $fn = 48); translate([0, 0, h]) mj_hole(hole, h - 0.6); }
module mj_rib(l, h, t, draft = 0.5) rotate([90, 0, 0]) translate([0, 0, -t / 2]) linear_extrude(t, center = false) polygon([[0, 0], [l, 0], [l, h], [0, h]]);

// ── lofts and blades ────────────────────────────────────────────────────────────────────────
// A closed solid through sections: each a ring of [x,y,z] points, every ring the same length and
// winding (CCW seen from the first ring toward the last). Caps on both ends.
module mj_loft(sections) {
  n = len(sections[0]); m = len(sections);
  pts = [for (s = sections) each s];
  faces = concat(
    [[for (i = [n - 1 : -1 : 0]) i]],
    [for (k = [0 : m - 2], i = [0 : n - 1]) [k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i]],
    [[for (i = [0 : n - 1]) (m - 1) * n + i]]);
  polyhedron(pts, [for (f = faces) [for (q = [len(f) - 1 : -1 : 0]) f[q]]], convexity = 4);
}
// A NACA 4-digit section (m = max camber %, p = its position in tenths, t = thickness %), chord c,
// leading edge at the origin, chord along +x, CCW, 2*n points, closed trailing edge.
function mj_naca4(m, p, t, c = 1, n = 16) =
  let(M = m / 100, P = p / 10, T = t / 100,
      yt = function (x) 5 * T * (0.2969 * sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x),
      yc = function (x) M == 0 ? 0 : x < P ? M / (P * P) * (2 * P * x - x * x) : M / pow(1 - P, 2) * ((1 - 2 * P) + 2 * P * x - x * x),
      xs = [for (i = [0 : n]) (1 - cos(180 * i / n)) / 2])
  concat([for (i = [n : -1 : 1]) let(x = xs[i]) [c * x, c * (yc(x) - yt(x))]], [for (i = [0 : n - 1]) let(x = xs[i]) [c * x, c * (yc(x) + yt(x))]]);
// A blade from the hub out along +x: stations [[r, chord, twist_deg, naca [m,p,t]], …], the section
// lying in the y-z plane, pitched about the radial axis by twist, chord centred at a quarter chord.
module mj_blade(stations, n = 16) {
  mj_loft([for (s = stations) let(sec = mj_naca4(s[3][0], s[3][1], s[3][2], s[1], n)) [for (q = sec) let(u = q[0] - s[1] / 4, v = q[1]) [s[0], u * cos(s[2]) - v * sin(s[2]), u * sin(s[2]) + v * cos(s[2])]]]);
}
// ── end of the mojulo mechanical library ──
`;
