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

export const MECH_LIB_VERSION = 2;

/** Does a (comment-stripped) source call the library? An identifier starting `mj_` is the trigger. */
export const usesMechLib = (bare) => /(^|[^A-Za-z0-9_])mj_[A-Za-z0-9_]/.test(String(bare));

export const MECH_LIB_SOURCE = String.raw`// ── mojulo mechanical library v2 (prepended by mojulo; call mj_* — edit your source, not this) ──
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
// A top-level $mj_fit_add (mm, from your mj_fit_coupon print) shifts every fit at once for this printer.
function mj__fit_base(fit) = fit == "press" ? 0 : fit == "tight" ? 0.1 : fit == "slip" ? 0.2 : fit == "loose" ? 0.4 : fit == "running" ? 0.3 : assert(false, str("mj_fit: press | tight | slip | running | loose, not ", fit));
function mj_fit(fit = "slip") = mj__fit_base(fit) + (is_undef($mj_fit_add) ? 0 : $mj_fit_add);
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

// ══ v2: standards ══════════════════════════════════════════════════════════════════════════════
// Every table is from the published standard; check your supplier's sheet before production.

// Stepper motor faces (NEMA ICS 16): [name, body square, hole spacing, pilot d, pilot h, screw, shaft d, shaft len]
MJ_NEMA = [
  [11, 28.2, 23.0, 22.0, 2.0, "M2.5", 5, 20],
  [14, 35.2, 26.0, 22.0, 2.0, "M3",   5, 20],
  [17, 42.3, 31.0, 22.0, 2.0, "M3",   5, 24],
  [23, 56.4, 47.14, 38.1, 1.6, "M5",  6.35, 21]
];
function mj_nema(n) = let(r = [for (e = MJ_NEMA) if (e[0] == n) e]) assert(len(r) == 1, str("mj_nema: one of 11 14 17 23, not ", n)) r[0];
// The cutter for a motor face mounted against a plate: pilot clearance and the four screw holes, from z = 0 down.
module mj_nema_mount(n, depth, fit = "slip") {
  e = mj_nema(n);
  mj_hole(e[3], depth, fit);
  for (x = [-1, 1], y = [-1, 1]) translate([x * e[2] / 2, y * e[2] / 2, 0]) mj_clearance_hole(e[5], depth);
}
// A stand-in motor (for an assembly view): face on z = 0, body down, D-flat shaft up.
module mj_nema_motor(n, length = 40) {
  e = mj_nema(n);
  translate([-e[1] / 2, -e[1] / 2, -length]) mj_chamfer_box([e[1], e[1], length], 2.5);
  cylinder(d = e[3], h = e[4], $fn = 64);
  difference() { cylinder(d = e[6], h = e[4] + e[7], $fn = 32); translate([e[6] / 2 - 0.5, -e[6], e[4] + 2]) cube([e[6], 2 * e[6], e[7]]); }
}

// Rolling bearings: [code, bore, od, width]
MJ_BEARINGS = [
  ["623", 3, 10, 4], ["624", 4, 13, 5], ["625", 5, 16, 5], ["626", 6, 19, 6], ["608", 8, 22, 7], ["688", 8, 16, 5],
  ["6000", 10, 26, 8], ["6001", 12, 28, 8], ["6002", 15, 32, 9], ["6200", 10, 30, 9], ["6201", 12, 32, 10],
  ["6202", 15, 35, 11], ["6203", 17, 40, 12], ["6204", 20, 47, 14],
  ["LM8UU", 8, 15, 24], ["LM10UU", 10, 19, 29], ["LM12UU", 12, 21, 30]
];
function mj_bearing_dims(code) = let(r = [for (e = MJ_BEARINGS) if (e[0] == code) e]) assert(len(r) == 1, str("mj_bearing: no bearing ", code)) r[0];
// The seat for a bearing's outer race, from z = 0 down by its width; shoulder = a smaller bore below it that
// stops the race but clears the inner ring (through = how far that bore runs on).
module mj_bearing_seat(code, fit = "press", shoulder = true, through = 0) {
  e = mj_bearing_dims(code);
  mj_hole(e[2], e[3], fit);
  if (shoulder) translate([0, 0, -e[3]]) mj_hole((e[1] + e[2]) / 2 + 1, through > 0 ? through : 1, "press", 0.01);
}
// A stand-in bearing on z = 0 (rings and a seal face; not a print-in-place part — see the study's bearing).
module mj_bearing(code) {
  e = mj_bearing_dims(code);
  difference() { cylinder(d = e[2], h = e[3], $fn = 64); translate([0, 0, -1]) cylinder(d = e[1], h = e[3] + 2, $fn = 48);
    for (z = [-0.01, e[3] - 0.3]) translate([0, 0, z]) difference() { cylinder(d = e[2] - (e[2] - e[1]) * 0.2, h = 0.31, $fn = 64); cylinder(d = e[1] + (e[2] - e[1]) * 0.2, h = 1, $fn = 48); } }
}

// Parallel keys, DIN 6885 A: [shaft from, shaft to, width b, height h, shaft depth t1, hub depth t2]
MJ_KEYS = [[6, 8, 2, 2, 1.2, 1.0], [8, 10, 3, 3, 1.8, 1.4], [10, 12, 4, 4, 2.5, 1.8], [12, 17, 5, 5, 3.0, 2.3],
  [17, 22, 6, 6, 3.5, 2.8], [22, 30, 8, 7, 4.0, 3.3], [30, 38, 10, 8, 5.0, 3.3], [38, 44, 12, 8, 5.0, 3.3],
  [44, 50, 14, 9, 5.5, 3.8], [50, 58, 16, 10, 6.0, 4.3]];
function mj_key(d) = let(r = [for (e = MJ_KEYS) if (d > e[0] && d <= e[1]) e]) assert(len(r) == 1, str("mj_key: DIN 6885 covers shafts over 6 to 58 mm, not ", d)) r[0];
// Cut from a shaft on z (keyseat on +x), length along z from z = 0 up.
module mj_keyway_shaft(d, length) { k = mj_key(d); translate([d / 2 - k[4], -k[2] / 2, 0]) cube([k[4] + 1, k[2], length]); }
// Cut from a hub: the bore (with its fit) plus the keyway on +x, from z = 0 down by length.
module mj_keyway_hub(d, length, fit = "slip") { k = mj_key(d); mj_hole(d, length, fit); translate([0, -k[2] / 2 - 0.05, -length]) cube([d / 2 + k[5] + 0.1, k[2] + 0.1, length + 1]); }

// Retaining rings: DIN 471 (on a shaft) [d, groove d, groove width]; DIN 472 (in a bore) the same.
MJ_CIRCLIP_SHAFT = [[8, 7.6, 0.9], [10, 9.6, 1.1], [12, 11.5, 1.1], [15, 14.3, 1.1], [17, 16.2, 1.1], [20, 19.0, 1.3], [25, 23.9, 1.3], [30, 28.6, 1.6]];
MJ_CIRCLIP_BORE = [[22, 23.0, 1.1], [26, 27.2, 1.3], [28, 29.4, 1.3], [32, 33.7, 1.3], [35, 37.0, 1.6], [40, 42.5, 1.85], [47, 49.5, 1.85]];
function mj__circlip(t, d, what) = let(r = [for (e = t) if (e[0] == d) e]) assert(len(r) == 1, str("mj_circlip_groove: no ", what, " size ", d)) r[0];
// A groove cutter at height z: kind "shaft" (DIN 471) or "bore" (DIN 472), width +0.1 for the print.
module mj_circlip_groove(d, z, kind = "shaft") {
  e = kind == "shaft" ? mj__circlip(MJ_CIRCLIP_SHAFT, d, "DIN 471 shaft") : mj__circlip(MJ_CIRCLIP_BORE, d, "DIN 472 bore");
  translate([0, 0, z]) linear_extrude(e[2] + 0.1) difference() {
    circle(d = kind == "shaft" ? d + 2 : e[1], $fn = 96); circle(d = kind == "shaft" ? e[1] : d - 2, $fn = 96); }
}
// A D-flat bore for a motor shaft (5 mm motors: flat 0.5), from z = 0 down.
module mj_d_bore(d = 5, depth = 10, flat = 0.5, fit = "slip") {
  dd = d + mj_fit(fit);
  difference() { mj_hole(d, depth, fit); translate([dd / 2 - flat, -dd, -depth - 1]) cube([dd, 2 * dd, depth + 3]); }
}

// O-ring glands by the usual static rule (about 25 % squeeze, groove 1.4 × the cross-section wide):
// "face" (a ring groove in a flange, d = the O-ring's inside diameter), "piston" (a groove round a piston of
// diameter d), "rod" (a groove inside a bore that a rod of diameter d runs in). From z = 0 down (face) or
// centred on z = 0 (piston, rod). Confirm the gland against the O-ring maker's handbook.
function mj_oring_gland(cs, squeeze = 0.25) = [cs * (1 - squeeze), cs * 1.4];
module mj_oring_groove(d, cs, type = "face", squeeze = 0.25) {
  g = mj_oring_gland(cs, squeeze); dep = g[0]; w = g[1];
  if (type == "face") translate([0, 0, -dep]) linear_extrude(dep + 0.5) difference() { circle(d = d + 2 * w, $fn = 128); circle(d = d, $fn = 128); }
  else if (type == "piston") translate([0, 0, -w / 2]) linear_extrude(w) difference() { circle(d = d + 2, $fn = 128); circle(d = d - 2 * dep, $fn = 128); }
  else if (type == "rod") translate([0, 0, -w / 2]) linear_extrude(w) difference() { circle(d = d + 2 * dep, $fn = 128); circle(d = d - 2, $fn = 128); }
  else assert(false, str("mj_oring_groove: face | piston | rod, not ", type));
}

// Boards: [name, [w, d], holes [[x, y]…] from the board's lower-left corner, screw]
MJ_BOARDS = [
  ["rpi3", [85, 56], [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]], "M2.5"],
  ["rpi4", [85, 56], [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]], "M2.5"],
  ["rpi5", [85, 56], [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]], "M2.5"],
  ["rpi-zero", [65, 30], [[3.5, 3.5], [61.5, 3.5], [3.5, 26.5], [61.5, 26.5]], "M2.5"],
  ["arduino-uno", [68.6, 53.3], [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56]], "M3"],
  ["arduino-mega", [101.6, 53.3], [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56], [90.17, 50.8], [96.52, 2.54]], "M3"]
];
function mj_board(name) = let(r = [for (e = MJ_BOARDS) if (e[0] == name) e]) assert(len(r) == 1, str("mj_board: one of rpi3 rpi4 rpi5 rpi-zero arduino-uno arduino-mega, not ", name)) r[0];
function mj_board_holes(name) = mj_board(name)[2];
// Standoffs for a board, its lower-left corner at the origin, standing on z = 0, h tall; insert = heat-set pilots.
module mj_board_standoffs(name, h = 5, insert = false) {
  b = mj_board(name); s = b[3]; od = mj_iso_d(s) * 2.4;
  for (p = b[2]) translate([p[0], p[1], 0]) difference() { cylinder(d = od, h = h, $fn = 32);
    translate([0, 0, h]) if (insert) mj_heatset_hole(s, h - 0.8); else mj_tapped_hole(s, h - 0.6, 0.15, 0.01); }
}
// VESA mounting patterns (75 and 100: M4; 200: M6), centred, from z = 0 down.
module mj_vesa(size, depth) { s = size == 200 ? "M6" : "M4"; assert(size == 75 || size == 100 || size == 200, "mj_vesa: 75 | 100 | 200");
  for (x = [-1, 1], y = [-1, 1]) translate([x * size / 2, y * size / 2, 0]) mj_clearance_hole(s, depth); }

// T-slot extrusion (20/30/40 series, slot 6/8/8): the profile is generic; vendors differ inside the slot,
// the outside, the slot opening and the core bore are the standard part. Along z from 0, centred.
function mj_tslot_dims(size) = size == 20 ? [20, 6.2, 4.2] : size == 30 ? [30, 8.2, 6.8] : size == 40 ? [40, 8.2, 6.8] : assert(false, "mj_tslot: 20 | 30 | 40");
module mj_tslot(size, length) {
  t = mj_tslot_dims(size); s = t[0]; slot = t[1]; lip = s * 0.09; inner = slot * 1.8;
  linear_extrude(length) difference() {
    offset(r = s * 0.075, $fn = 24) offset(delta = -s * 0.075) square(s, center = true);
    circle(d = t[2], $fn = 32);
    for (a = [0 : 90 : 270]) rotate(a) union() {
      translate([s / 2 - lip / 2, 0]) square([lip + 0.02, slot], center = true);
      translate([s / 2 - lip - s * 0.15, 0]) polygon([[s * 0.15, -inner / 2], [s * 0.15, inner / 2], [-s * 0.08, slot * 0.3], [-s * 0.08, -slot * 0.3]]);
    }
  }
}

// Gridfinity: a bin of ux × uy grid units (42 mm) and uz height units (7 mm), the published base profile
// (0.8 at 45°, 1.8 upright, 2.15 at 45°, 0.25 clearance), 1.2 mm walls, optional 6 × 2 magnet pockets.
// No stacking lip in this version.
module mj_gridfinity_bin(ux = 1, uy = 1, uz = 3, magnets = false, wall = 1.2) {
  u = 42; c = 0.25; H = 7 * uz; R = 3.75;
  module mj__grr(w, d, r, h) translate([-w / 2, -d / 2, 0]) hull() for (x = [r, w - r], y = [r, d - r]) translate([x, y, 0]) cylinder(r = r, h = h, $fn = 32);
  difference() {
    union() {
      for (i = [0 : ux - 1], j = [0 : uy - 1]) translate([(i - (ux - 1) / 2) * u, (j - (uy - 1) / 2) * u, 0]) {
        hull() { mj__grr(u - 2 * c - 2 * 2.95, u - 2 * c - 2 * 2.95, 0.8, 0.01); translate([0, 0, 0.8]) mj__grr(u - 2 * c - 2 * 2.15, u - 2 * c - 2 * 2.15, 1.6, 0.01); }
        translate([0, 0, 0.8]) mj__grr(u - 2 * c - 2 * 2.15, u - 2 * c - 2 * 2.15, 1.6, 1.8);
        hull() { translate([0, 0, 2.6]) mj__grr(u - 2 * c - 2 * 2.15, u - 2 * c - 2 * 2.15, 1.6, 0.01); translate([0, 0, 4.75]) mj__grr(u - 2 * c, u - 2 * c, R, 0.01); }
      }
      translate([0, 0, 4.75]) mj__grr(ux * u - 2 * c, uy * u - 2 * c, R, H - 4.75);
    }
    translate([0, 0, 4.75 + 1.2]) mj__grr(ux * u - 2 * c - 2 * wall, uy * u - 2 * c - 2 * wall, R - wall, H);
    if (magnets) for (i = [0 : ux - 1], j = [0 : uy - 1], x = [-13, 13], y = [-13, 13]) translate([(i - (ux - 1) / 2) * u + x, (j - (uy - 1) / 2) * u + y, -0.01]) cylinder(d = 6.5, h = 2.4, $fn = 32);
  }
}

// ══ v2: composition ════════════════════════════════════════════════════════════════════════════
// Gear 2 (z2 teeth) placed in mesh with gear 1 (z1 teeth, at the origin, unturned) at an angle round it, and
// turned so a tooth meets a space. Holds for any angle and tooth counts (checked by intersection).
function mj_gear_mesh_turn(z1, z2, angle) = angle * (1 + z1 / z2) + (z2 % 2 == 0 ? 180 / z2 : 0);
module mj_gear_meshed(mod, z1, z2, angle = 0) rotate(angle) translate([mj_gear_center(mod, z1, z2), 0, 0]) rotate(mj_gear_mesh_turn(z1, z2, angle) - angle) children();
// A bolt with its nut threaded on in phase, the nut's underside at nut_z above the head (rounded down onto
// the thread). The two are separate solids: the gap between them is the thread clearance.
function mj__nut_phase_z(size, head, z) = let(e = mj_iso(size), hk = head == "hex" ? e[4] : head == "socket" ? e[7] : head == "button" ? 0.55 * e[1] : 0, p = e[2], z0 = hk - 0.01 + 1)
  z0 + floor((z - z0) / p) * p;
module mj_bolt_and_nut(size, length, nut_z, head = "hex") { mj_bolt(size, length, head); translate([0, 0, mj__nut_phase_z(size, head, nut_z)]) mj_nut(size); }

// A matched enclosure: base, lid, alignment lip, screw posts and the lid's holes all derived from one set of
// numbers, so they cannot disagree. inner = the clear cavity [x, y, z]. part: "base" | "lid" (printed lip up,
// beside nothing) | "both" (lid set beside the base) | "assembled" (lid on top, for a fit check).
// board = a mj_board name for standoffs on the floor, centred.
function mj_enclosure_posts(inner, screw = "M3") = let(od = mj_iso_d(screw) * 2.6, x = inner[0] / 2 - od / 2, y = inner[1] / 2 - od / 2) [[-x, -y], [x, -y], [-x, y], [x, y]];
module mj_enclosure(inner, wall = 2, floor = 2, r = 3, screw = "M3", lid_t = 2, lip = 3, fit = "slip", part = "both", board = "", standoff = 5, insert = true) {
  L = inner[0] + 2 * wall; W = inner[1] + 2 * wall; H = floor + inner[2];
  od = mj_iso_d(screw) * 2.6; posts = mj_enclosure_posts(inner, screw); cl = mj_fit(fit) / 2;
  module mj__eplate(l, w, rr, h) translate([-l / 2, -w / 2, 0]) mj_rounded_plate([l, w, h], rr);
  module mj__ebase() difference() {
    union() {
      difference() { mj__eplate(L, W, r, H); translate([0, 0, floor]) mj__eplate(inner[0], inner[1], max(0.5, r - wall), H); }
      for (p = posts) translate([p[0], p[1], 0]) cylinder(d = od, h = H - lip - 0.3, $fn = 40);
      if (board != "") let(b = mj_board(board)) translate([-b[1][0] / 2, -b[1][1] / 2, floor - 0.01]) mj_board_standoffs(board, standoff, insert);
    }
    for (p = posts) translate([p[0], p[1], H - lip - 0.3]) if (insert && mj_iso(screw)[13] > 0) mj_heatset_hole(screw, H - lip - 0.3 - floor); else mj_tapped_hole(screw, H - lip - 0.3 - floor);
  }
  module mj__elid() difference() {
    union() { mj__eplate(L, W, r, lid_t);
      translate([0, 0, lid_t - 0.01]) difference() { mj__eplate(inner[0] - 2 * cl, inner[1] - 2 * cl, max(0.5, r - wall - cl), lip);
        translate([0, 0, -1]) mj__eplate(inner[0] - 2 * cl - 2 * 1.6, inner[1] - 2 * cl - 2 * 1.6, max(0.5, r - wall - 1.6), lip + 2);
        for (p = posts) translate([p[0], p[1], -1]) cylinder(d = od + 2 * cl + 0.4, h = lip + 2, $fn = 40); } }
    for (p = posts) translate([p[0], p[1], 0]) mirror([0, 0, 1]) translate([0, 0, -lid_t]) mj_countersink(screw, lid_t + 1);
  }
  if (part == "base") mj__ebase();
  else if (part == "lid") mj__elid();
  else if (part == "both") { mj__ebase(); translate([L + 10, 0, 0]) mj__elid(); }
  else if (part == "assembled") { mj__ebase(); translate([0, 0, H + lid_t]) mirror([0, 0, 1]) mj__elid(); }
  else assert(false, "mj_enclosure: part is base | lid | both | assembled");
}

// ══ v2: outputs ════════════════════════════════════════════════════════════════════════════════
// Sheet metal: thickness t, inside bend radius r, K-factor k, width w; flanges = [[length, bend°], …], each
// flange's straight length followed by the bend into the next (+ up, − down; the last bend is ignored).
// The bent part lies along +x from the origin, the first flange on z = 0, width along +y.
function mj_sheet_ba(t, r, k, a) = PI * abs(a) / 180 * (r + k * t);
function mj_sheet_flat_length(t, r, k, flanges) = let(n = len(flanges)) mj__sum([for (i = [0 : n - 1]) flanges[i][0] + (i < n - 1 ? mj_sheet_ba(t, r, k, flanges[i][1]) : 0)]);
function mj__sum(v, i = 0) = i >= len(v) ? 0 : v[i] + mj__sum(v, i + 1);
module mj__sheet_chain(t, r, w, f, i) {
  if (i < len(f)) {
    L = f[i][0]; a = i < len(f) - 1 ? f[i][1] : 0;
    cube([L, w, t]);
    if (a != 0) translate([L, 0, 0]) {
      c = a > 0 ? t + r : -r;   // the bend centre: above the sheet bending up, below it bending down
      translate([0, 0, c]) rotate([-90, 0, 0]) rotate([0, 0, a > 0 ? 90 - a : -90]) rotate_extrude(angle = abs(a), $fn = 64) translate([r, 0]) square([t, w]);
      translate([0, 0, c]) rotate([0, -a, 0]) translate([0, 0, -c]) mj__sheet_chain(t, r, w, f, i + 1);
    } else translate([L, 0, 0]) mj__sheet_chain(t, r, w, f, i + 1);
  }
}
module mj_sheet(t, r, w, flanges, k = 0.44) mj__sheet_chain(t, r, w, flanges, 0);
// The flat pattern (2D, for DXF): a strip of the flat length; bend_lines = true scores each bend's centre line
// as a 0.2 mm slot, for a laser to etch or a brake operator to read.
module mj_sheet_flat(t, r, w, flanges, k = 0.44, bend_lines = false) {
  n = len(flanges);
  difference() { square([mj_sheet_flat_length(t, r, k, flanges), w]);
    if (bend_lines) for (i = [0 : n - 2]) let(x = mj__sum([for (j = [0 : i]) flanges[j][0]]) + mj__sum([for (j = [0 : i]) j < i ? mj_sheet_ba(t, r, k, flanges[j][1]) : mj_sheet_ba(t, r, k, flanges[j][1]) / 2]))
      translate([x - 0.1, -1]) square([0.2, w + 2]); }
}

// A fit-test coupon: one plate of holes and a strip of pins of nominal diameter d, one per fit, marked by
// notches (1 = press … 5 = loose; this build has no fonts). Print it, try each pin in each hole, and set
// $mj_fit_add to the difference you need. Plate on z = 0, the pins beside it.
module mj_fit_coupon(d = 8, h = 5) {
  fits = ["press", "tight", "slip", "running", "loose"]; s = d + 6;
  difference() { cube([s * 5, s, h]);
    for (i = [0 : 4]) { translate([s * i + s / 2, s / 2, h]) mj_hole(d, h + 1, fits[i]);
      for (n = [0 : i]) translate([s * i + 2 + n * 1.6, -0.01, h - 1]) cube([0.8, 1.2, 1.1]); } }
  for (i = [0 : 4]) translate([s * i + s / 2, s * 1.8, 0]) { cylinder(d = d, h = h * 2, $fn = 64); for (n = [0 : i]) translate([-d / 2 - 2, -d / 2 + n * 1.6, 0]) cube([2.01, 0.8, 1]); }
}
// ── end of the mojulo mechanical library ──
`;
