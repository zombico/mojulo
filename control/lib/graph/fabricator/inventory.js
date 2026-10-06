// fabricator/inventory — the off-the-shelf parts a design may be solved with, each with who owns its shape.
//
// The cluster: one shelf of standard parts every design draws from, so a new object pulls a 608 and four M3 inserts
// instead of minting a bearing. A row names its family, never its sizes: the sizes live where they already live, in
// the construction hardware codes (../construction/hardware.js) and the mechanical library's tables
// (../scad/mech-lib.js, read through ./mech-tables.js). A row says:
//   provenance  the tier that gates what may be done with it (./provenance.js);
//   standard    the published standard it follows, by number (cited, never quoted);
//   buy         the generic name the supply chain sells it under: the search term, never a brand;
//   hardware    an example construction-hardware code of the family (when the family has codes);
//   seat        the `fit` cutter seats THIS part (an insert's pilot, a bearing's seat), so a strategy that fits it
//               buys it too, as many as it seats;
//   codes       'bearing' when the codes a strategy picks are bearing designations (./mech-tables.js), not hardware;
//   fit         the library module that cuts its interface into the operator's part;
//   print       the library module that makes the part itself;
//   owner, notice, interface   for a reference row: whose it is, the nominative line it carries, and whether the
//               owner's interface drawing is vendored ('published') so it may be fitted;
//   licence     for an open row: the licence and attribution kept with what is made.
export const INVENTORY = Object.freeze(Object.fromEntries([
  // ── fasteners ──
  { id: 'socket-bolt', label: 'socket head cap screw', provenance: 'standard', standard: 'ISO 4762', buy: 'socket head cap screw, metric, A2 or 8.8', hardware: 'M3x10-socket', fit: 'mj_counterbore', print: 'mj_bolt' },
  { id: 'hex-bolt', label: 'hex head bolt', provenance: 'standard', standard: 'ISO 4017', buy: 'hex head bolt, metric, 8.8', hardware: 'M6x30-hex', fit: 'mj_clearance_hole', print: 'mj_bolt' },
  { id: 'button-bolt', label: 'button head screw', provenance: 'standard', standard: 'ISO 7380', buy: 'button head socket screw, metric', hardware: 'M4x10-button', fit: 'mj_clearance_hole' },
  { id: 'csk-bolt', label: 'countersunk screw', provenance: 'standard', standard: 'ISO 10642', buy: 'countersunk socket screw, metric', hardware: 'M4x12-csk', fit: 'mj_countersink' },
  { id: 'thumb-screw', label: 'knurled thumb screw', provenance: 'standard', standard: 'DIN 464', buy: 'knurled thumb screw, metric, stainless' },
  { id: 'set-screw', label: 'set screw, cup point', provenance: 'standard', standard: 'ISO 4029', buy: 'cup point set screw (grub screw), metric', fit: 'mj_tapped_hole' },
  { id: 'hex-nut', seat: true, label: 'hex nut', provenance: 'standard', standard: 'ISO 4032', buy: 'hex nut, metric', hardware: 'nut-M3', fit: 'mj_nut_trap', print: 'mj_nut' },
  { id: 'nyloc-nut', seat: true, label: 'nylon-insert lock nut', provenance: 'standard', standard: 'ISO 7040', buy: 'nylon insert lock nut, metric', hardware: 'nyloc-M6', fit: 'mj_nut_trap' },
  { id: 'washer', label: 'plain washer', provenance: 'standard', standard: 'ISO 7089', buy: 'flat washer, metric', hardware: 'washer-M6', print: 'mj_washer' },
  { id: 'heat-set-insert', seat: true, label: 'heat-set threaded insert', provenance: 'commodity', buy: 'brass heat-set threaded insert for plastics, metric', fit: 'mj_heatset_hole' },
  { id: 'rivet-nut', label: 'blind rivet nut', provenance: 'commodity', buy: 'blind rivet nut for sheet metal, metric, steel' },
  { id: 'wood-screw', label: 'chipboard screw', provenance: 'commodity', buy: 'countersunk Pozidriv chipboard screw', hardware: 'wood-4x30' },
  { id: 'confirmat', label: 'one-piece furniture connector screw', provenance: 'commodity', buy: 'one-piece furniture connector screw 7×50', hardware: 'confirmat-7x50' },
  { id: 'cam-lock', label: 'cam lock and connecting bolt', provenance: 'commodity', buy: 'eccentric cam lock ⌀15 with connecting bolt', hardware: 'cam-15' },
  { id: 'wood-insert', label: 'threaded insert for wood', provenance: 'commodity', buy: 'screw-in threaded insert for wood, metric', hardware: 'insert-M6' },
  { id: 'hanger-bolt', label: 'hanger bolt', provenance: 'commodity', buy: 'hanger bolt, wood thread to metric', hardware: 'hanger-bolt-M8x70' },
  { id: 'angle-bracket', label: 'angle bracket', provenance: 'commodity', buy: 'pressed steel angle bracket', hardware: 'bracket-L40' },
  { id: 't-nut', label: 'T-slot nut', provenance: 'commodity', buy: 'drop-in T-nut for 20-series slot, M5' },
  { id: 'standoff', label: 'hex standoff', provenance: 'commodity', buy: 'brass hex standoff, male–female, M2.5 or M3' },
  // ── location and catches ──
  { id: 'dowel-pin', seat: true, label: 'hardened dowel pin', provenance: 'standard', standard: 'ISO 8734', buy: 'hardened steel dowel pin, m6 tolerance', fit: 'mj_hole' },
  { id: 'wood-dowel', label: 'fluted wood dowel', provenance: 'commodity', buy: 'fluted beech dowel', hardware: 'dowel-8x35' },
  { id: 'shelf-pin', label: 'shelf support pin', provenance: 'commodity', buy: '5 mm shelf support pin', hardware: 'shelf-pin-5' },
  { id: 'magnet-disc', seat: true, label: 'neodymium disc magnet', provenance: 'commodity', buy: 'neodymium disc magnet, N35 or better, 6×3 mm', fit: 'mj_hole' },
  // ── motion ──
  { id: 'concealed-hinge', label: 'concealed cup hinge, ⌀35', provenance: 'commodity', buy: '35 mm concealed cup hinge, full overlay', hardware: 'hinge-35' },
  { id: 'butt-hinge', label: 'butt hinge', provenance: 'commodity', buy: 'steel butt hinge, 50–75 mm, with screws' },
  { id: 'drawer-slide', label: 'ball-bearing drawer slide', provenance: 'commodity', buy: 'ball bearing drawer slide pair, 45 mm', hardware: 'slide-450' },
  { id: 'radial-bearing', seat: true, label: 'deep-groove ball bearing', provenance: 'standard', standard: 'ISO 15', buy: 'deep groove ball bearing, 2RS sealed', codes: 'bearing', fit: 'mj_bearing_seat' },
  { id: 'linear-bearing', seat: true, label: 'linear ball bushing', provenance: 'commodity', buy: 'linear ball bushing LM-UU series', codes: 'bearing', fit: 'mj_bearing_seat' },
  { id: 'linear-rod', label: 'hardened linear rod', provenance: 'commodity', buy: 'hardened chromed linear shaft, h6' },
  { id: 'wheel-carriage', label: 'T-slot wheel carriage', provenance: 'commodity', buy: 'wheel gantry plate for 20-series T-slot, eccentric spacers' },
  { id: 'stepper-motor', seat: true, label: 'stepper motor', provenance: 'standard', standard: 'NEMA ICS 16', buy: 'NEMA frame bipolar stepper motor, 1.8°', fit: 'mj_nema_mount',
    notice: 'NEMA names the frame-size standard; motors are bought from any maker.' },
  { id: 'gearmotor', label: 'micro metal gearmotor', provenance: 'commodity', buy: '12 mm micro metal gearmotor, 3–6 V' },
  { id: 'spur-gear', label: 'spur gear', provenance: 'standard', standard: 'ISO 53 basic rack, metric module', buy: 'spur gear, metric module', print: 'mj_spur_gear' },
  { id: 'rack', label: 'gear rack', provenance: 'standard', standard: 'ISO 53 basic rack, metric module', buy: 'gear rack, metric module', print: 'mj_rack' },
  { id: 'worm-set', label: 'worm and wheel', provenance: 'standard', standard: 'ISO 53 basic rack, metric module', buy: 'worm and worm wheel set, metric module', print: 'mj_worm' },
  { id: 'bevel-gear', label: 'bevel gear pair', provenance: 'standard', standard: 'ISO 53 basic rack, metric module', buy: 'straight bevel gear pair, 1:1', print: 'mj_bevel_gear' },
  { id: 'planetary-set', label: 'planetary gear set', provenance: 'own', print: 'mj_planetary' },
  { id: 'timing-pulley', label: '2 mm pitch timing pulley', provenance: 'commodity', buy: '2 mm pitch timing pulley, 20 teeth, 5 mm bore', print: 'mj_gt2_pulley',
    notice: '"GT2" is a manufacturer\'s trade name for its belt profile; the generic part is sold as a 2 mm pitch timing pulley and is labelled that way here.' },
  { id: 'timing-belt', label: '2 mm pitch timing belt', provenance: 'commodity', buy: '2 mm pitch timing belt, 6 mm wide' },
  { id: 'circlip', seat: true, label: 'retaining ring', provenance: 'standard', standard: 'DIN 471 (shaft) / DIN 472 (bore)', buy: 'external retaining ring (circlip), DIN 471', fit: 'mj_circlip_groove' },
  { id: 'parallel-key', seat: true, label: 'parallel key', provenance: 'standard', standard: 'DIN 6885', buy: 'parallel key, DIN 6885 A', fit: 'mj_keyway_hub' },
  { id: 'd-shaft', label: 'D-flat shaft', provenance: 'commodity', buy: 'D-cut motor shaft', fit: 'mj_d_bore' },
  // ── sealing ──
  { id: 'o-ring', seat: true, label: 'O-ring', provenance: 'standard', standard: 'ISO 3601', buy: 'NBR 70 O-ring, metric cross-section', fit: 'mj_oring_groove' },
  { id: 'o-ring-cord', label: 'O-ring cord', provenance: 'commodity', buy: 'NBR 70 O-ring cord, cut to length and bonded into a loop' },
  { id: 'cable-gland', label: 'cable gland', provenance: 'commodity', buy: 'IP68 cable gland, M12×1.5 thread, for 3–6.5 mm cable, with lock nut', fit: 'mj_hole' },
  { id: 'breather-vent', label: 'breather vent', provenance: 'commodity', buy: 'M12×1.5 waterproof breather vent plug (membrane), with lock nut', fit: 'mj_hole' },
  { id: 'gasket-tape', label: 'closed-cell foam gasket tape', provenance: 'commodity', buy: 'EPDM closed-cell foam tape, adhesive-backed' },
  // ── frames and mounting hosts ──
  { id: 't-slot-extrusion', label: '20-series T-slot aluminium extrusion', provenance: 'commodity', buy: '2020 T-slot aluminium extrusion, 6 mm slot', print: 'mj_tslot',
    notice: 'The generic profile, labelled by series; several makers sell variants under their own trade names, which are not used here.' },
  { id: 'vesa-pattern', label: 'VESA mounting pattern', provenance: 'standard', standard: 'VESA FDMI (MIS)', fit: 'mj_vesa',
    notice: 'VESA names the display-mount standard; the pattern is cut here, nothing is certified.' },
  { id: 'tripod-thread', label: '1/4-20 camera thread', provenance: 'standard', standard: 'ISO 1222', buy: '1/4-20 UNC threaded insert or thumb screw' },
  { id: 'anti-tip-kit', label: 'furniture anti-tip kit', provenance: 'commodity', buy: 'furniture anti-tip kit: a strap or bracket pair with wall plugs and screws' },
  { id: 'pegboard', label: 'perforated hardboard', provenance: 'commodity', buy: 'pegboard, 1/4 in holes on a 1 in grid, with hooks' },
  { id: 'enclosure', label: 'parametric project box', provenance: 'own', print: 'mj_enclosure' },
  { id: 'board-standoffs', label: 'board standoffs', provenance: 'own', print: 'mj_board_standoffs' },
  { id: 'gridfinity', label: 'Gridfinity bin', provenance: 'open', print: 'mj_gridfinity_bin',
    licence: 'Gridfinity is an open system by Zack Freedman, released under the MIT licence; keep the attribution with any bin made.' },
  // ── reference only: another owner's product, fitted by its published interface or bought, never reproduced ──
  { id: 'board-raspberry-pi', label: 'Raspberry Pi board', provenance: 'reference', owner: 'Raspberry Pi Ltd', interface: 'published', fit: 'mj_board_standoffs',
    notice: 'Raspberry Pi is a trademark of Raspberry Pi Ltd. Named only to identify the board this part fits; the hole pattern follows the published mechanical drawing.' },
  { id: 'board-arduino', label: 'Arduino board', provenance: 'reference', owner: 'Arduino', interface: 'published', fit: 'mj_board_standoffs',
    notice: 'Arduino is a trademark of its owner. Named only to identify the board this part fits; the hole pattern follows the published board drawing.' },
  { id: 'action-cam-mount', label: 'action camera three-prong mount', provenance: 'reference', owner: 'GoPro, Inc.', buy: 'three-prong action camera mount adapter',
    notice: 'GoPro is a trademark of GoPro, Inc. Named only to say what the bought adapter fits; its mount geometry is not reproduced here.' },
  { id: 'brick-studs', label: 'toy-brick studs', provenance: 'reference', owner: 'the LEGO Group', buy: 'baseplate or plate from the brick system, bonded or screwed on',
    notice: 'LEGO is a trademark of the LEGO Group. The brick is bought and attached; its studs are not reproduced, and the word is used only to say what fits.' },
  { id: 'skadis-pegboard', label: 'SKÅDIS pegboard', provenance: 'reference', owner: 'Inter IKEA Systems B.V.', buy: 'SKÅDIS accessory, bonded or screwed to the part',
    notice: 'SKÅDIS is a trademark of Inter IKEA Systems B.V. Named only to say what the bought accessory hangs on; its slot geometry is not vendored.' },
  { id: 'camera-dovetail', label: 'Arca-type camera plate', provenance: 'reference', owner: 'Arca-Swiss', buy: 'Arca-type quick release plate, screwed on by 1/4-20',
    notice: 'Arca-Swiss is a trademark of its owner. A bought plate is screwed on; the dovetail is not reproduced.' },
].map((r) => [r.id, Object.freeze(r)])));
