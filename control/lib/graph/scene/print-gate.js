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
 * Supported CLI family: PrusaSlicer and its fork SuperSlicer (identical
 * flags). OrcaSlicer / Bambu Studio are DETECTED so the operator gets a real
 * message, but their CLI is not wired — the gate skips with the reason and the
 * 3MF opens in the app for the eyes gate.
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
