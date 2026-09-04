// unreal-project.test.js — the Unreal emitters are pure text: determinism,
// guide protocol (T-numbered one-line steps — the sibling-proven format),
// the honest U0 ledger (mechanics are data-only until the U1 kernel), and a
// snapshot of the guide. Mirrors unity-project.test.js.
import { describe, it, expect } from 'vitest';
import { emitUnrealProject, emitUnrealGame, unrealLevelLedger } from './unreal-project.js';

const score = {
  ref: 'sk_test_world',
  title: 'Test World',
  kind: 'controllable',
  frame: 'z-up',
  units: '1 mojulo unit = 1 meter',
  spawn: [-300, 0, 0],
  eye: 1.7,
  ground: 0,
  colliders: [{ min: [-10, -10, 0], max: [10, 10, 8] }],
  cameras: [{ name: 'view 0', translation: [64, -96, 56] }],
  entities: [{ id: 'walker', name: 'entity:walker', translation: [-300, 0, 0] }],
  mechanics: [{ kind: 'reach-exit' }],
  player: 'walker',
  soundtrack: 'bt_theme',
  ledger: { skipped_fx: { count: 2, note: 'camera-facing/runtime fx (billboards, glows) — not geometry' } },
};

const emit = () => emitUnrealProject({ ref: 'sk_test_world', score, manifestHash: 'abcd1234abcd1234', audioFile: 'audio/bt_theme.wav' });

describe('unreal emitters', () => {
  it('is deterministic — same inputs, same bytes', () => {
    const a = emit(); const b = emit();
    expect(a.files.map((f) => f.text)).toEqual(b.files.map((f) => f.text));
    expect(a.files.map((f) => f.file)).toEqual([
      'import_mojulo.py', 'IMPORT-GUIDE.md', 'README.md',
    ]);
  });

  it('emits no wall-clock or dice into any file', () => {
    for (const f of emit().files) {
      expect(f.text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
      expect(f.text).not.toMatch(/Math\.random|datetime\.now|time\.time\(|random\./);
    }
  });

  it('guide follows the T/# protocol — one-line numbered steps, two-digit substeps, ascending', () => {
    const guide = emit().files.find((f) => f.file === 'IMPORT-GUIDE.md').text;
    const tLines = guide.split('\n').filter((l) => /^T\d/.test(l));
    expect(tLines.length).toBeGreaterThanOrEqual(5);
    const seen = [];
    for (const line of tLines) {
      const m = /^T(\d{3})(?:\.(\d{2}))? \S/.exec(line);
      expect(m, `bad T line: ${line}`).toBeTruthy();
      seen.push(Number(m[1]) * 100 + Number(m[2] ?? 0));
    }
    expect([...seen].sort((x, y) => x - y)).toEqual(seen);
    for (const line of guide.split('\n').filter((l) => /^#\d/.test(l))) {
      expect(line).toMatch(/^#\d{3} \S/);
    }
    // verify-before-instruct: the guide never instructs what the importer does
    expect(guide).not.toMatch(/Add Component|spawn a PlayerStart|place a Box|Transform > /i);
  });

  it('ledger is honest — mechanics data-only at U0, cameras data-only, ground promoted', () => {
    const ledger = unrealLevelLedger(score);
    expect(ledger.mechanics_data_only).toMatchObject({ count: 1, kinds: ['reach-exit'] });
    expect(ledger.interpreted_mechanics).toBeUndefined();
    expect(ledger.cameras_data_only).toMatchObject({ count: 1 });
    expect(ledger.promoted_ground).toBeTruthy();
    expect(ledger.skipped_fx.count).toBe(2);
    expect(unrealLevelLedger({ ...score, mechanics: [{ kind: 'collect' }] }, { gameMode: true }).no_completion_path).toBeTruthy();
    const readme = emit().files.find((f) => f.file === 'README.md').text;
    for (const key of Object.keys(ledger)) expect(readme).toContain(`\`${key}\``);
    expect(readme).toContain('abcd1234abcd1234');
  });

  it('importer python carries the one frame mapping, both modes, the gate file, the G1 ground', () => {
    const py = emit().files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain('unreal.Vector(v[0] * M, -v[1] * M, v[2] * M)');
    expect((py.match(/def P\(/g) ?? []).length).toBe(1);
    expect(py).toContain("os.environ.get('MOJULO_MODE', 'run')");
    expect(py).toContain('def build():');
    expect(py).toContain('def verify():');
    expect(py).toContain('mojulo-gate.json');
    expect(py).toContain('MojuloGround');
    expect(py).toContain('frame_landmark');
    // figure-first entity resolution (GLB wrappers are named by FIGURE)
    expect(py).toContain("find_actor_by_label('entity:' + entity.get('id', ''))");
  });

  it('greybox posture stamps the handoff sentence; unstamped is byte-identical', () => {
    const stamped = emitUnrealProject({ ref: 'sk_test_world', score: { ...score, posture: 'greybox' }, manifestHash: 'abcd1234abcd1234' });
    const guide = stamped.files.find((f) => f.file === 'IMPORT-GUIDE.md').text;
    expect(guide).toContain('BLOCKOUT');
    const plainA = emit(); const plainB = emit();
    expect(plainA.files.find((f) => f.file === 'IMPORT-GUIDE.md').text)
      .toBe(plainB.files.find((f) => f.file === 'IMPORT-GUIDE.md').text);
    expect(plainA.files.find((f) => f.file === 'IMPORT-GUIDE.md').text).not.toContain('BLOCKOUT');
  });

  it('guide snapshot', () => {
    expect(emit().files.find((f) => f.file === 'IMPORT-GUIDE.md').text).toMatchSnapshot();
  });
});

const gameManifest = {
  kind: 'game',
  title: 'Test Game',
  levels: [{ title: 'One', ref: 'lv-one' }, { title: 'Two', ref: 'lv-two', gate: { completed: 'lv-one' } }],
};
const gameLevels = [
  { ref: 'lv-one', score: { ...score, title: 'Level One' } },
  { ref: 'lv-two', score: { ...score, title: 'Level Two', mechanics: [{ kind: 'reach-exit' }, { kind: 'teleport' }] } },
];
const emitGame = () => emitUnrealGame({ ref: 'sk_test_game', manifest: gameManifest, levels: gameLevels, manifestHash: 'abcd1234abcd1234' });

describe('unreal game emitters (U1)', () => {
  it('is deterministic and ships the kernel plugin beside importer/guide/README', () => {
    const a = emitGame(); const b = emitGame();
    expect(a.files.map((f) => f.text)).toEqual(b.files.map((f) => f.text));
    const names = a.files.map((f) => f.file);
    expect(names[0]).toBe('import_mojulo.py');
    expect(names).toContain('MojuloKernel/MojuloKernel.uplugin');
    expect(names).toContain('MojuloKernel/Source/MojuloKernel/Private/MojuloGameMode.cpp');
    expect(names).toContain('MojuloKernel/Source/MojuloKernel/Private/MojuloMenuGameMode.cpp');
    expect(names.at(-1)).toBe('README.md');
    for (const f of a.files) {
      expect(f.text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
      expect(f.text).not.toMatch(/Math\.random|datetime\.now|time\.time\(/);
    }
  });

  it('the two frame maps stay identical: python and C++ both carry (x·100, −y·100, z·100)', () => {
    const files = emitGame().files;
    const py = files.find((f) => f.file === 'import_mojulo.py').text;
    const cpp = files.find((f) => f.file.endsWith('MojuloScore.cpp')).text;
    expect(py).toContain('unreal.Vector(v[0] * M, -v[1] * M, v[2] * M)');
    expect(cpp).toContain('FVector(X * 100.0, -Y * 100.0, Z * 100.0)');
  });

  it('kernel performs the closed vocabulary; unknown kinds ride as data', () => {
    const cpp = emitGame().files.find((f) => f.file.endsWith('MojuloScore.cpp')).text;
    for (const kind of ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death', 'survive']) {
      expect(cpp).toContain(`TEXT("${kind}")`);
    }
    const ledger = emitGame().ledger;
    expect(ledger.levels['lv-two'].interpreted_mechanics).toMatchObject({ kinds: ['reach-exit'] });
    expect(ledger.levels['lv-two'].unknown_mechanics).toMatchObject({ kinds: ['teleport'] });
    expect(ledger.skipped_store).toBeTruthy();
    expect(ledger.gate_approximated).toBeTruthy();
  });

  it('game importer python builds per-level maps + menu and wires the kernel game modes', () => {
    const py = emitGame().files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain("'/Script/MojuloKernel.MojuloGameMode'");
    expect(py).toContain("'/Script/MojuloKernel.MojuloMenuGameMode'");
    expect(py).toContain("CONTENT_ROOT + '/Maps/mojulo-menu'");
    expect(py).toContain('menu_scene');
    expect(py).toContain('kernel_wired');
  });

  it('game guide snapshot', () => {
    expect(emitGame().files.find((f) => f.file === 'IMPORT-GUIDE.md').text).toMatchSnapshot();
  });
});
