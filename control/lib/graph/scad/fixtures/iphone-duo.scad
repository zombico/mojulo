// iPhone Duo — block-in, hand-authored OpenSCAD (mm, z up, back faces -z)
$fn = 64;
W = 79.3; H = 117.8; R = 9;        // half body footprint
Z0 = 3; T = 5.2;                    // body base z, thickness
HX = 42.65;                         // half centre offset from the hinge line
fold = 0;                           // 0 = open flat, 1 = closed (set to $t for animation)

module rrect(w, h, r) { hull() for (sx = [-1, 1], sy = [-1, 1]) translate([sx * (w/2 - r), sy * (h/2 - r)]) circle(r = r); }
module slab(w, h, r, z0, z1) { translate([0, 0, z0]) linear_extrude(z1 - z0) rrect(w, h, r); }
module disc(r, z0, z1) { translate([0, 0, z0]) cylinder(r = r, h = z1 - z0); }

module half_body() { color("#2b3242") slab(W, H, R, Z0, Z0 + T); }
module inner_display(dx) { color("#0b0f14") translate([dx, 0, 0]) slab(78.85, 110.9, 6, 8.1, 8.4); }
module crease(x) { color("#0b0f14") translate([x, 0, 0]) slab(6, 110.9, 0, 8.1, 8.4); }
module spine(x) { color("#c9ccd3") translate([x, 0, 0]) slab(12, H, 1.5, 2.95, 8.25); }

module lens(x, y) {
  translate([x, y, 0]) {
    color("#2a2f38") disc(5.5, 0, 0.5);
    color("#141c33") disc(4.2, 0.05, 0.6);
  }
}

module half_a() {                              // camera half
  translate([-HX, 0, 0]) {
    half_body();
    color("#1f2637") slab(75.3, 113.8, 7.5, 2.9, 3.3);          // back glass
    color("#232a3a") translate([-14.35, 44, 0]) slab(44, 18, 9, 0.4, 3.1);  // camera plateau
  }
  lens(-69, 44); lens(-49, 44);
  color("#efe3b8") translate([-38, 44, 0]) disc(2.4, 0.3, 0.5);   // flash
  inner_display(-39.425);
}

module half_b() {                              // cover-display half
  translate([HX, 0, 0]) {
    half_body();
    color("#0b0f14") slab(77.2, 112.3, 7, 2.9, 3.3);              // cover display
    color("#000000") translate([0, 50, 0]) disc(1.75, 2.85, 3);    // selfie cam
    // usb-c on the -y edge
    color("#08090b") translate([0, -58.8, 5.6]) rotate([90, 0, 0]) linear_extrude(0.25) rrect(8.9, 3.2, 1.6);
  }
  spine(6);
  inner_display(39.425);
  crease(3);
  // side buttons on the +x edge: touch id, camera control
  color("#3a4253") for (p = [[22, 14], [-20, 20]])
    translate([82.2, p[0], 5.6]) rotate([90, 0, 90]) linear_extrude(0.8) rrect(p[1], 2.4, 1.2);
  // volume buttons on the +y edge
  color("#3a4253") for (x = [28, 42])
    translate([x, 58.8, 5.6]) rotate([90, 0, 0]) mirror([0, 0, 1]) linear_extrude(0.8) rrect(10, 2.4, 1.2);
}

module hinge() {
  color("#d8dbe1") translate([0, 0, 5.6]) rotate([90, 0, 0]) cylinder(r = 2.6, h = 104, center = true);
  spine(-6);
  crease(-3);
}

