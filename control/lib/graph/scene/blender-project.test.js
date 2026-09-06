// blender-project.test.js — the Blender pack's emitters are pure text: determinism, the
// T/# guide protocol (the shared operator-guide.js lift), no clock / dice / host paths,
// the two transport-agnostic scripts, the greybox stamp. Mirrors unreal-project.test.js.
import { describe, it, expect } from 'vitest';
import { emitBlenderPack, importerPy, exportReturnPy, BLENDER_LEG_VERSION } from './blender-project.js';
import { GREYBOX_HANDOFF_SENTENCE } from './engine-score.js';

const node = (name, min, max, triangles) => ({ name, min, max, size: max.map((v, i) => v - min[i]), triangles, primitives: 1, textured: false, vertexColour: true });
const pack = {
  leg: 'blender', version: BLENDER_LEG_VERSION, ref: 'sk_test_obj', title: 'Test Object', kind: 'workbench', manifestHash: 'abcd1234abcd1234',
  base: 'lit', posture: null, units: 'cm', meters_per_unit: 0.01, frame: 'z-up', epsilon: 1,
  glb: { bytes: 1000, nodes: 2, mesh_nodes: 2, triangles: 24, vertices: 48, textures: 0, lit: true },
  bounds: { min: [-2, -2, 0], max: [8, 2, 6], size: [10, 4, 6] },
  landmark: { name: 'spout', min: [4, -1, 2], max: [8, 1, 4], size: [4, 2, 2], asymmetry: 0.3 },
  collections: { body: ['body'], spout: ['spout'] },
  nodes: [node('body', [-2, -2, 0], [2, 2, 6], 12), node('spout', [4, -1, 2], [8, 1, 4], 12)],
};
const ledger = { base_lit: { note: 'real PBR over raw albedo' }, hand_work: { note: 'not regenerable' } };
const emit = (p = pack) => emitBlenderPack({ ref: 'sk_test_obj', title: 'Test Object', kind: 'workbench', pack: p, ledger, remint: 'node scripts/export-blender.mjs --ref sk_test_obj' });

describe('blender pack emitters', () => {
  it('is deterministic — same inputs, same bytes, fixed file set', () => {
    const a = emit(); const b = emit();
    expect(a.files.map((f) => f.text)).toEqual(b.files.map((f) => f.text));
    expect(a.files.map((f) => f.file)).toEqual(['import_mojulo.py', 'export_return.py', 'ARTPASS-GUIDE.md', 'README.md']);
  });

  it('emits no wall-clock, dice, or host paths into any file', () => {
    for (const f of emit().files) {
      expect(f.text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
      expect(f.text).not.toMatch(/Math\.random|datetime\.now|time\.time\(|random\./);
      expect(f.text).not.toMatch(/\/Users\/|data\/outcomes/);
    }
  });

  it('guide follows the T/# protocol — one-line numbered steps, two-digit substeps, ascending', () => {
    const guide = emit().files.find((f) => f.file === 'ARTPASS-GUIDE.md').text;
    const tLines = guide.split('\n').filter((l) => /^T\d/.test(l));
    expect(tLines.length).toBeGreaterThanOrEqual(7);
    const seen = [];
    for (const line of tLines) {
      const m = /^T(\d{3})(?:\.(\d{2}))? \S/.exec(line);
      expect(m, `bad T line: ${line}`).toBeTruthy();
      seen.push(Number(m[1]) * 100 + Number(m[2] ?? 0));
    }
    expect([...seen].sort((x, y) => x - y)).toEqual(seen);
    const hashes = guide.split('\n').filter((l) => /^#\d/.test(l));
    for (const line of hashes) expect(line).toMatch(/^#\d{3} \S/);
    const nums = hashes.map((l) => Number(l.slice(1, 4)));
    expect([...nums].sort((x, y) => x - y)).toEqual(nums);
    expect(new Set(nums).size).toBe(nums.length);
    // the five chunks, the landmark, the three transports, the bind-back
    for (const s of ['## ① Open', '## ② Look', '## ③ What is yours', '## ④ Re-export', '## ⑤ Bind', '`spout`', 'execute_blender_code', 'Run Script', 'bind_mesh_render', 'request_mesh_render', 'export_return.py']) expect(guide).toContain(s);
    // the ledger numbers from #101
    expect(guide).toContain('#101 base_lit');
  });

  it('README carries provenance, the four gates, the ledger keys, and the blender-mcp cautions', () => {
    const readme = emit().files.find((f) => f.file === 'README.md').text;
    expect(readme).toContain('abcd1234abcd1234');
    expect(readme).toContain(`leg v${BLENDER_LEG_VERSION}`);
    for (const key of Object.keys(ledger)) expect(readme).toContain(`\`${key}\``);
    for (const s of ['Machine, emit side', 'Eyes, emit side', 'Machine, return side', 'Eyes, return side', 'DISABLE_TELEMETRY', 'never a dependency', '1 unit = 0.01 m']) expect(readme).toContain(s);
  });

  it('import script: MOJULO_MODE run|verify with argv fallback, refuses to clobber a .blend, reads pack.json, sets units/shading/camera', () => {
    const py = importerPy();
    for (const s of ["os.environ.get('MOJULO_MODE', 'run')", "_opt('--mode')", "MODE == 'verify'", "MODE == 'run'", 'MOJ_REFUSED', 'MOJULO_FORCE', "pack.json", 'import_scene.gltf', 'scale_length', "color_type = 'VERTEX'", 'MojuloFraming', 'MOJ_GATE_WRITTEN', 'MOJ_RUN_DONE', 'MOJULO_PACK']) {
      expect(py, s).toContain(s);
    }
    expect(py).not.toMatch(/bpy\.ops\.mesh\.|bmesh|\.vertices\[.*\]\.co =/); // no geometry logic in the pack script
  });

  it('return script: the pinned export settings, filtered against the running Blender', () => {
    const py = exportReturnPy();
    for (const s of ["'export_format': 'GLB'", "'export_vertex_color': 'ACTIVE'", "'export_draco_mesh_compression_enable': False", "'export_yup': True", "'export_apply': True", "'export_cameras': False", 'get_rna_type().properties', 'return-%d.glb', 'MOJ_RETURN_WRITTEN']) {
      expect(py, s).toContain(s);
    }
  });

  it('greybox stamp: the sentence rides guide + README when declared; unstamped packs never mention it', () => {
    const plain = emit();
    const stamped = emit({ ...pack, posture: 'greybox' });
    for (const name of ['ARTPASS-GUIDE.md', 'README.md']) {
      expect(stamped.files.find((f) => f.file === name).text).toContain(GREYBOX_HANDOFF_SENTENCE);
      expect(plain.files.find((f) => f.file === name).text).not.toContain('Greybox handoff');
    }
    // the scripts are posture-blind
    for (const name of ['import_mojulo.py', 'export_return.py']) {
      expect(stamped.files.find((f) => f.file === name).text).toBe(plain.files.find((f) => f.file === name).text);
    }
  });
});
