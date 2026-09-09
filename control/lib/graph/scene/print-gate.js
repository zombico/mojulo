/**
 * print-gate — the slicer MACHINE GATE's pure half (interchange-seams.plan.md
 * seam 1b): locate a slicer, and read what a slice actually measured.
 *
 * The closure audit answers "are the rims closed?"; a slicer answers the
 * question a printer cares about — does it slice at all, how long, how much
 * filament, does it need supports. `scripts/slice-print.mjs` spawns the slicer
 * (operator-hosted, never a dependency — the Blender posture); everything that
 * can be unit-tested without one lives here: the binary search order, the
 * `--info` parser, and the G-code header parser. Both parsers are tolerant —
 * a field the slicer did not print is `null`, never a throw — because the
 * gate is ADVISORY: it reports and stamps, suitability is the operator's call.
 *
 * Supported CLI families:
 *  - `prusa` — PrusaSlicer and its fork SuperSlicer (identical flags). Verified
 *    on this host against 2.9.6 (interchange-next N2).
 *  - `orca` — OrcaSlicer and Bambu Studio (text-to-cad-seam.plan.md T6). Flags
 *    per Bambu Studio's "Command Line Usage" wiki as read 2026-09-08
 *    (`--load-settings "machine.json;process.json" --load-filaments f.json
 *    --slice 0 --arrange 1 --export-3mf out.3mf --export-slicedata dir
 *    --outputdir dir --debug n`); OrcaSlicer is the same CLI family. This family
 *    has NO defaults — a machine + process profile is REQUIRED — and no `--info`
 *    twin we can parse, so `size_agrees` is null there. UNVERIFIED on a real
 *    install (none on this host): the stamp says `verified: false` until one runs.
 */

// Search order for the slicer binary: explicit env, then PATH names, then the
// macOS app bundles. The caller passes `exists`/`which` so this stays pure.
export const SLICER_CANDIDATES = [
  { id: 'prusa', family: 'prusa', names: ['prusa-slicer', 'PrusaSlicer'], apps: ['/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer', '/Applications/Original Prusa Drivers/PrusaSlicer.app/Contents/MacOS/PrusaSlicer'] },
  { id: 'superslicer', family: 'prusa', names: ['superslicer', 'SuperSlicer'], apps: ['/Applications/SuperSlicer.app/Contents/MacOS/SuperSlicer'] },
  { id: 'orca', family: 'orca', names: ['orca-slicer', 'OrcaSlicer'], apps: ['/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer'] },
  { id: 'bambu', family: 'orca', names: ['bambu-studio', 'BambuStudio'], apps: ['/Applications/BambuStudio.app/Contents/MacOS/BambuStudio'] },
];

/**
 * findSlicer({ env, exists, which }) → { id, family, bin } | null.
 * `env.MOJULO_SLICER` wins (its family is guessed from the path; default
 * prusa). `which(name)` resolves a PATH binary or returns null; `exists(p)`
 * tests an absolute path.
 */
export function findSlicer({ env = {}, exists = () => false, which = () => null } = {}) {
  if (env.MOJULO_SLICER) {
    const bin = env.MOJULO_SLICER;
    const lower = bin.toLowerCase();
    const hit = SLICER_CANDIDATES.find((c) => c.names.some((n) => lower.includes(n.toLowerCase())));
    return { id: hit ? hit.id : 'custom', family: hit ? hit.family : 'prusa', bin };
  }
  for (const c of SLICER_CANDIDATES) {
    for (const n of c.names) { const p = which(n); if (p) return { id: c.id, family: c.family, bin: p }; }
    for (const p of c.apps) if (exists(p)) return { id: c.id, family: c.family, bin: p };
  }
  return null;
}

const num = (s) => { const v = Number.parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : null; };

/**
 * bedCenterFromProfile(iniText) → [x, y] | null — the centre of the profile's
 * `bed_shape` (`bed_shape = 0x0,250x0,250x210,0x210`). A mojulo 3MF places its
 * objects around THEIR origin (min_x ≈ −size/2), which the CLI reads literally —
 * "All objects are outside of the print volume" — so the driver hands the slicer
 * `--center` at the bed's centre. null when the key is absent or unreadable.
 */
export function bedCenterFromProfile(text) {
  const m = /^\s*bed_shape\s*=\s*(.+)$/m.exec(String(text || ''));
  if (!m) return null;
  const pts = m[1].split(',').map((pt) => pt.trim().split('x').map(num)).filter((pt) => pt.length === 2 && pt.every((v) => v != null));
  if (!pts.length) return null;
  const xs = pts.map((pt) => pt[0]); const ys = pts.map((pt) => pt[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/** PrusaSlicer's built-in bed when no profile is loaded: 200 × 200 mm, centre (100, 100). */
export const DEFAULT_BED_CENTER = [100, 100];

/**
 * sliceFailureReason(text) → a NAMED reason for a slice that produced no G-code,
 * or null when the slicer's output carries none the parser knows. A name, not a
 * grade: `outside_print_volume` is the honest answer for a literal-scale 1 m
 * lighthouse on a 200 mm bed — the fix is `--target-mm` or the operator's profile.
 */
export function sliceFailureReason(text) {
  const t = String(text || '');
  if (/outside of the print volume/i.test(t)) return 'outside_print_volume';
  if (/no such file|cannot open|failed to load|unable to load/i.test(t)) return 'file_not_read';
  return null;
}

/**
 * parseSlicerInfo(text) → { size_mm:[x,y,z]|null, volume_mm3, facets, parts,
 * manifold: true|false|null } — PrusaSlicer `--info` output (one block per file).
 */
export function parseSlicerInfo(text) {
  const t = String(text || '');
  const grab = (re) => { const m = re.exec(t); return m ? m[1].trim() : null; };
  const sx = num(grab(/size_x\s*=\s*([-\d.,]+)/i));
  const sy = num(grab(/size_y\s*=\s*([-\d.,]+)/i));
  const sz = num(grab(/size_z\s*=\s*([-\d.,]+)/i));
  const manifoldRaw = grab(/manifold\s*=\s*(\w+)/i);
  return {
    size_mm: sx != null && sy != null && sz != null ? [sx, sy, sz] : null,
    volume_mm3: num(grab(/volume\s*=\s*([-\d.,]+)/i)),
    facets: num(grab(/number_of_facets\s*=\s*(\d+)/i)),
    parts: num(grab(/number_of_parts\s*=\s*(\d+)/i)),
    manifold: manifoldRaw == null ? null : /^(yes|true|1)$/i.test(manifoldRaw),
  };
}

// "1d 2h 3m 4s" / "2h 3m" / "45s" → seconds.
export function parseDuration(s) {
  if (!s) return null;
  let total = 0; let any = false;
  for (const [, n, u] of String(s).matchAll(/(\d+)\s*([dhms])/g)) {
    any = true;
    total += Number(n) * { d: 86400, h: 3600, m: 60, s: 1 }[u];
  }
  return any ? total : null;
}

/**
 * parseGcodeHeader(text) → { print_time_s, filament_mm, filament_cm3,
 * filament_g, filament_cost, layer_height_mm, supports: true|false|null,
 * layers } — the `;` comment ledger PrusaSlicer writes at the head and tail of
 * a G-code (the tail echoes the whole config, which is where `support_material`
 * and `layer_height` live). Any field the slicer omitted is null.
 */
export function parseGcodeHeader(text) {
  const t = String(text || '');
  const grab = (re) => { const m = re.exec(t); return m ? m[1].trim() : null; };
  const supportsRaw = grab(/^;\s*support_material\s*=\s*(\d)/m);
  return {
    print_time_s: parseDuration(grab(/^;\s*estimated printing time(?: \(normal mode\))?\s*=\s*(.+)$/m)),
    filament_mm: num(grab(/^;\s*(?:total )?filament used \[mm\]\s*=\s*([\d.,]+)/m)),
    filament_cm3: num(grab(/^;\s*(?:total )?filament used \[cm3\]\s*=\s*([\d.,]+)/m)),
    filament_g: num(grab(/^;\s*total filament used \[g\]\s*=\s*([\d.,]+)/m) ?? grab(/^;\s*filament used \[g\]\s*=\s*([\d.,]+)/m)),
    filament_cost: num(grab(/^;\s*(?:total )?filament cost\s*=\s*([\d.,]+)/m)),
    layer_height_mm: num(grab(/^;\s*layer_height\s*=\s*([\d.,]+)/m)),
    supports: supportsRaw == null ? null : supportsRaw === '1',
    layers: (() => { const m = t.match(/^;LAYER_CHANGE/gm); return m ? m.length : null; })(),
  };
}

/**
 * orcaProfileFiles(profile, { listDir }) → { machine, process, filaments[] } | null.
 * The orca family loads JSON profiles, not a Prusa .ini bundle. `profile` is a
 * `;`-joined list of files, or a directory whose files are matched by name
 * (`*machine*.json`, `*process*.json`, `*filament*.json`); `listDir(dir)` returns
 * the directory's file names or null when it is not a directory. Null when the
 * required machine + process pair is not there.
 */
export function orcaProfileFiles(profile, { listDir = () => null } = {}) {
  if (!profile) return null;
  const parts = String(profile).split(';').map((s) => s.trim()).filter(Boolean);
  let files = parts;
  if (parts.length === 1) {
    const names = listDir(parts[0]);
    if (Array.isArray(names)) files = names.filter((n) => /\.json$/i.test(n)).map((n) => `${parts[0].replace(/\/$/, '')}/${n}`);
  }
  const pick = (re) => files.filter((f) => re.test(f.split('/').pop()));
  const machine = pick(/machine/i)[0] ?? null;
  const proc = pick(/process/i)[0] ?? null;
  const filaments = pick(/filament/i);
  if (!machine || !proc) return null;
  return { machine, process: proc, filaments };
}

/**
 * orcaSliceArgs({ file, outDir, profiles, supports, orient, debug }) → the argv for
 * an OrcaSlicer / Bambu Studio headless slice of `file` into `outDir`: the whole
 * plate (`--slice 0`), auto-arranged so the model lands on the bed (the placement
 * lesson N2 paid for), the sliced project as `sliced.3mf` and the slice data
 * (G-code per plate) under `outDir/slicedata`. Pure — the driver spawns it.
 */
export function orcaSliceArgs({ file, outDir, profiles, supports = false, orient = false, debug = 2 } = {}) {
  if (!profiles || !profiles.machine || !profiles.process) throw new Error('orcaSliceArgs: machine + process profiles are required');
  const args = ['--load-settings', `${profiles.machine};${profiles.process}`];
  if (profiles.filaments && profiles.filaments.length) args.push('--load-filaments', profiles.filaments.join(';'));
  args.push('--slice', '0', '--arrange', '1');
  if (orient) args.push('--orient');
  if (supports) args.push('--enable-support'); // per-process setting name in the JSON family; harmless if the build ignores it
  args.push('--debug', String(debug), '--export-3mf', 'sliced.3mf', '--export-slicedata', `${outDir}/slicedata`, '--outputdir', outDir, file);
  return args;
}

/**
 * parseOrcaGcodeHeader(text) → the same shape as parseGcodeHeader, from the `;`
 * ledger Bambu Studio / OrcaSlicer write at the head of a plate G-code. Their
 * keys differ from Prusa's (`model printing time`, `total estimated time`,
 * `total filament used [g]`, `total filament length [mm]`, `total layer number`);
 * every regex is tolerant and a missing field is null, never a throw.
 */
export function parseOrcaGcodeHeader(text) {
  const t = String(text || '');
  const grab = (re) => { const m = re.exec(t); return m ? m[1].trim() : null; };
  // Bambu writes both on ONE line: "; model printing time: 45m 12s; total estimated time: 50m 3s" — total wins
  const time = grab(/total estimated time:\s*([^;\n]+)/) ?? grab(/^;\s*model printing time:\s*([^;\n]+)/m) ?? grab(/^;\s*estimated printing time[^=:\n]*[=:]\s*(.+)$/m);
  const supportRaw = grab(/^;\s*(?:enable_)?support(?:_material)?\s*=\s*(\d)/m);
  const layersRaw = grab(/^;\s*total layer number:\s*(\d+)/m);
  return {
    print_time_s: parseDuration(time),
    filament_mm: num(grab(/^;\s*total filament (?:length|used) \[mm\][^=:\n]*[=:]\s*([\d.,]+)/m) ?? grab(/^;\s*filament used \[mm\]\s*=\s*([\d.,]+)/m)),
    filament_cm3: num(grab(/^;\s*total filament (?:volume|used) \[cm3\][^=:\n]*[=:]\s*([\d.,]+)/m)),
    filament_g: num(grab(/^;\s*total filament (?:weight|used) \[g\][^=:\n]*[=:]\s*([\d.,]+)/m)),
    filament_cost: num(grab(/^;\s*(?:total )?filament cost[^=:\n]*[=:]\s*([\d.,]+)/m)),
    layer_height_mm: num(grab(/^;\s*layer_height\s*=\s*([\d.,]+)/m)),
    supports: supportRaw == null ? null : supportRaw === '1',
    layers: layersRaw != null ? Number(layersRaw) : (() => { const m = t.match(/^;\s*LAYER_CHANGE/gmi); return m ? m.length : null; })(),
  };
}

/**
 * summarizePrintGate({ info, gcode, exportSizeMm }) → the gate verdict block:
 * `sliced` (a G-code came out), the measured numbers, and `size_agrees` — the
 * slicer's own bounding box vs mojulo's declared printed size, the check that
 * catches a unit mix-up (a ×10 / ×25.4 slip shows up here loudly).
 */
export function summarizePrintGate({ info = null, gcode = null, exportSizeMm = null, tolerance = 0.5 } = {}) {
  const sizeAgrees = info?.size_mm && exportSizeMm
    ? info.size_mm.every((v, i) => Math.abs(v - exportSizeMm[i]) <= tolerance)
    : null;
  return {
    sliced: !!gcode,
    size_agrees: sizeAgrees,
    manifold: info?.manifold ?? null,
    parts: info?.parts ?? null,
    volume_mm3: info?.volume_mm3 ?? null,
    print_time_s: gcode?.print_time_s ?? null,
    filament_g: gcode?.filament_g ?? null,
    filament_mm: gcode?.filament_mm ?? null,
    supports: gcode?.supports ?? null,
    layers: gcode?.layers ?? null,
    layer_height_mm: gcode?.layer_height_mm ?? null,
  };
}
