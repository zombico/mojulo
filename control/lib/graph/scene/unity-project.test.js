// unity-project.test.js — the Unity emitters are pure text: determinism,
// guide protocol (T-numbered one-line steps — the donated AGENTS-doc
// format), deterministic .meta GUIDs, and a snapshot of the guide.
import { describe, it, expect } from 'vitest';
import { emitUnityProject, emitUnityGame, unityGuid, unityMeta, unityLevelLedger } from './unity-project.js';

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

const emit = () => emitUnityProject({ ref: 'sk_test_world', score, manifestHash: 'abcd1234abcd1234', audioFile: 'audio/bt_theme.wav' });

describe('unity emitters', () => {
  it('is deterministic — same inputs, same bytes', () => {
    const a = emit(); const b = emit();
    expect(a.files.map((f) => f.text)).toEqual(b.files.map((f) => f.text));
    expect(a.files.map((f) => f.file)).toEqual([
      'Editor/MojuloImport.cs',
      'Runtime/MojuloWalker.cs', 'Runtime/MojuloLevel.cs', 'Runtime/MojuloGame.cs', 'Runtime/MojuloMenu.cs',
      'IMPORT-GUIDE.md', 'README.md',
    ]);
  });

  it('mints deterministic, distinct .meta guids', () => {
    const g1 = unityGuid('abcd1234abcd1234', 'model.glb');
    expect(g1).toBe(unityGuid('abcd1234abcd1234', 'model.glb'));
    expect(g1).toMatch(/^[0-9a-f]{32}$/);
    expect(g1).not.toBe(unityGuid('abcd1234abcd1234', 'score.json'));
    expect(g1).not.toBe(unityGuid('ffff0000ffff0000', 'model.glb'));
    expect(unityMeta(g1)).toBe(`fileFormatVersion: 2\nguid: ${g1}\n`);
    expect(unityMeta(g1, { folder: true })).toContain('folderAsset: yes');
  });

  it('emits no wall-clock or dice into any file', () => {
    for (const f of emit().files) {
      expect(f.text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
      expect(f.text).not.toMatch(/Math\.random|DateTime\.Now|System\.Random/);
    }
  });

  it('guide follows the T/# protocol — one-line numbered steps, two-digit substeps, ascending', () => {
    const guide = emit().files.find((f) => f.file === 'IMPORT-GUIDE.md').text;
    const tLines = guide.split('\n').filter((l) => /^T\d/.test(l));
    expect(tLines.length).toBeGreaterThanOrEqual(6);
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
    expect(guide).not.toMatch(/Add Component|Box Collider — set|Transform > Position > set/i);
  });

  it('ledger is honest — vocabulary interpreted, cameras data-only', () => {
    const ledger = unityLevelLedger(score);
    expect(ledger.interpreted_mechanics).toMatchObject({ count: 1, kinds: ['reach-exit'] });
    expect(ledger.cameras_data_only).toMatchObject({ count: 1 });
    expect(ledger.promoted_ground).toBeTruthy();
    expect(ledger.skipped_fx.count).toBe(2);
    expect(unityLevelLedger({ ...score, mechanics: [{ kind: 'collect' }] }, { gameMode: true }).no_completion_path).toBeTruthy();
    const readme = emit().files.find((f) => f.file === 'README.md').text;
    for (const key of Object.keys(ledger)) expect(readme).toContain(`\`${key}\``);
    expect(readme).toContain('abcd1234abcd1234');
  });

  it('kernel C# carries the frame mapping, both batch entries, the vocabulary', () => {
    const files = Object.fromEntries(emit().files.map((f) => [f.file, f.text]));
    expect(files['Runtime/MojuloLevel.cs']).toContain('new Vector3(-v[0], v[2], -v[1])');
    for (const kind of ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death', 'survive']) {
      expect(files['Runtime/MojuloLevel.cs']).toContain(`"${kind}"`);
    }
    expect(files['Editor/MojuloImport.cs']).toContain('public static void Run()');
    expect(files['Editor/MojuloImport.cs']).toContain('public static void Verify()');
    expect(files['Editor/MojuloImport.cs']).toContain('EditorBuildSettings.scenes');
    for (const f of Object.values(files)) if (f.includes('namespace Mojulo')) expect(f).toContain('/// <summary>');
  });

  it('game emit: per-level ledgers, gated guide, determinism', () => {
    const lvA = { ref: 'lv-a', title: 'Level A', gate: null, score };
    const lvB = { ref: 'lv-b', title: 'Level B', gate: { completed: 'lv-a' }, score: { ...score, mechanics: [] } };
    const emitG = () => emitUnityGame({ ref: 'sk_test_game', title: 'Test Game', manifestHash: 'ffff0000ffff0000', levels: [lvA, lvB], shellExtras: ['menu'] });
    const a = emitG(); const b = emitG();
    expect(a.files.map((f) => f.text)).toEqual(b.files.map((f) => f.text));
    expect(a.ledger.levels['lv-b'].no_completion_path).toBeTruthy();
    expect(a.ledger.skipped_shell.kinds).toEqual(['menu']);
    const guide = a.files.find((f) => f.file === 'IMPORT-GUIDE.md').text;
    expect(guide).toContain('unlocks after `lv-a`');
    expect(guide).toContain('mojulo-menu.unity');
    for (const line of guide.split('\n').filter((l) => /^T\d/.test(l))) {
      expect(line).toMatch(/^T(\d{3})(?:\.(\d{2}))? \S/);
    }
    const readme = a.files.find((f) => f.file === 'README.md').text;
    expect(readme).toContain('### `lv-a`');
    expect(readme).toContain('### `lv-b`');
  });

  it('locomotion row (walking-suit-backport): performed by the kernel, ledgered, gated, eyes-listed', () => {
    const files = Object.fromEntries(emit().files.map((f) => [f.file, f.text]));
    // the kernel always carries the machinery — it is the score row that switches it on
    expect(files['Runtime/MojuloLevel.cs']).toContain('class LegacyRig');   // glTFast's shipped-.meta default: legacy clips
    expect(files['Runtime/MojuloLevel.cs']).toContain('class MecanimRig');  // the operator flipped the importer: Playables
    expect(files['Runtime/MojuloLevel.cs']).toContain('AnimationLayerMixerPlayable');
    expect(files['Runtime/MojuloLevel.cs']).toContain('public List<AnimationClip> clips');
    expect(files['Runtime/MojuloLevel.cs']).toContain('class Locomotion');
    expect(files['Runtime/MojuloWalker.cs']).toContain('public void SetCameraRig(');
    expect(files['Editor/MojuloImport.cs']).toContain('LoadAllAssetsAtPath(glbPath)');
    expect(files['Editor/MojuloImport.cs']).not.toContain('AssetDatabase.FindAssets('); // a pack-wide index = last level wins
    expect(files['Editor/MojuloImport.cs']).toContain('locomotion clips bind');
    // no row ⇒ no ledger line, no eyes line (byte-identical to the pre-row pack)
    expect(unityLevelLedger(score).locomotion_performed).toBeUndefined();
    expect(files['IMPORT-GUIDE.md']).not.toContain('third-person');
    // a row on the player ⇒ the suit line + the ledger line
    const suitScore = {
      ...score,
      entities: [
        { id: 'walker', figure: 'gframe_mk2_multi', translation: [-300, 0, 0], locomotion: { idle: 'gframe_mk2_multi:idle', walk: 'gframe_mk2_multi:forward' } },
        { id: 'dummy', figure: 'z_multi', translation: [140, 0, 0], locomotion: { idle: 'z_multi:idle' } },
      ],
    };
    const ledger = unityLevelLedger(suitScore);
    expect(ledger.locomotion_performed).toMatchObject({ count: 2 });
    expect(ledger.locomotion_performed.note).toContain('third-person suit');
    const suitEmit = emitUnityProject({ ref: 'sk_test_world', score: suitScore, manifestHash: 'abcd1234abcd1234' });
    const guide = suitEmit.files.find((f) => f.file === 'IMPORT-GUIDE.md').text;
    expect(guide).toContain('#006 the player suit is in view from a third-person boom');
    expect(guide).toContain('`locomotion_performed`'.replace(/`/g, '')); // ledger block names it
    // a row on a non-player entity only ⇒ idles, no suit sentence
    const ambientOnly = { ...score, entities: [{ id: 'dummy', figure: 'z_multi', translation: [140, 0, 0], locomotion: { idle: 'z_multi:idle' } }] };
    expect(unityLevelLedger(ambientOnly).locomotion_performed.note).not.toContain('third-person');
    const game = emitUnityGame({ ref: 'g', title: 'G', manifestHash: 'ffff0000ffff0000', levels: [{ ref: 'lv-a', title: 'A', gate: null, score: suitScore }] });
    expect(game.files.find((f) => f.file === 'IMPORT-GUIDE.md').text).toContain('#022 levels whose player is a rigged figure');
  });

  it('guide snapshot', () => {
    expect(emit().files.find((f) => f.file === 'IMPORT-GUIDE.md').text).toMatchSnapshot();
  });
});
