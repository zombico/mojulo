// godot-bake — the rate Godot's scene importer bakes a GLB's clips at, and the `.import` that sets it (godot-pack.js
// writePack; the harness, godot-harness.js).

/** The rate Godot's scene importer bakes a GLB's clips at (`animation/fps`; 30 by default, which cuts across every key
 * that falls between two of its samples): the lowest whole rate from 30 up at which every key of every clip lands on a
 * sample, so the import plays the page's keys; null when 30 already does or the GLB has no clips; 240 when no rate up
 * to it does (the nearest the importer gets). */
export function bakeFps(bytes) {
  const buf = Buffer.from(bytes), jsonLen = buf.readUInt32LE(12), j = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const bin = buf.subarray(20 + jsonLen + 8), times = [];
  for (const ai of new Set((j.animations || []).flatMap((a) => a.samplers.map((sm) => sm.input)))) {
    const acc = j.accessors[ai], bv = j.bufferViews[acc.bufferView], off = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    for (let i = 0; i < acc.count; i++) times.push(bin.readFloatLE(off + i * 4));
  }
  if (!times.length) return null;
  const lands = (f) => times.every((t) => Math.abs(t * f - Math.round(t * f)) < 1e-3);
  for (let f = 30; f <= 240; f++) if (lands(f)) return f === 30 ? null : f;
  return 240;
}

/** A GLB's `.import` carrying only its bake rate (bakeFps), for a GLB the pack writes no other import for. */
export const bakeImport = (fps) => `[remap]

importer="scene"
importer_version=1
type="PackedScene"

[params]

animation/fps=${fps}
`;
