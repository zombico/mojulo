// A U-channel bracket in 2 mm steel: 30 / 50 / 30 mm flanges, inside radius 2, K-factor 0.44, 40 wide,
// two Ø5.5 mounting holes in the middle flange. `bent` is the part; `flat` is its blank, unrolled by bend allowance.
t = 2; r = 2; k = 0.44; w = 40;
fl = [[30, 90], [50, 90], [30, 0]];
ba = mj_sheet_ba(t, r, k, 90);
holes_y = [10, 30];
module flat2d() difference() {
  mj_sheet_flat(t, r, w, fl, k, bend_lines = true);
  for (y = holes_y) translate([fl[0][0] + ba + fl[1][0] / 2, y]) circle(d = 5.5, $fn = 48);
}
// The same holes on the bent part, through the frame mj_sheet puts the middle flange in: the end of the first
// flange, turned 90° about the bend's centre (t + r above the sheet).
module bent() color("#9aa4ae") difference() {
  mj_sheet(t, r, w, fl, k);
  for (y = holes_y) translate([fl[0][0], 0, t + r]) rotate([0, -90, 0]) translate([0, 0, -(t + r)])
    translate([fl[1][0] / 2, y, -1]) cylinder(d = 5.5, h = t + 2, $fn = 48);
}
