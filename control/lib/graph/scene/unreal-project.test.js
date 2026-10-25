// unreal-project.test.js — the Unreal ASSET pack's text is pure: determinism, the guide's T-numbered protocol, the
// importer bringing in one asset and nothing of a level or a game, the material masters, a figure's clip, IK Rig and
// Retargeter, the verify checks and the diagnostics, and the README saying the contract (assets, not games or levels).
import { describe, it, expect } from 'vitest';
import { emitUnrealAsset, unrealAssetName } from './unreal-project.js';

const FIGURE = { name: 'body', clip: 'idle', clips: ['idle', 'walk', 'wave'], joints: 58, humanoid: ['hips', 'spine', 'chest', 'neck'] };
const emit = (over = {}) => emitUnrealAsset({ ref: 'sk_test-prop', kind: 'assembler', title: 'Test prop', manifestHash: 'abcd1234abcd1234', ...over });
const file = (out, name) => out.files.find((f) => f.file === name).text;
const py = (over) => file(emit(over), 'import_mojulo.py');

describe('the Unreal asset pack text', () => {
  it('is deterministic — same inputs, same bytes — and writes the importer, the guide and the README', () => {
    expect(emit().files.map((f) => f.text)).toEqual(emit().files.map((f) => f.text));
    expect(emit().files.map((f) => f.file)).toEqual(['import_mojulo.py', 'IMPORT-GUIDE.md', 'README.md']);
    for (const f of emit({ figure: FIGURE, lit: true }).files) {
      expect(f.text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
      expect(f.text).not.toMatch(/Math\.random|datetime\.now|time\.time\(|random\./);
    }
  });

  it('names the asset as the content browser keeps it, under its own folder with its own preview map', () => {
    expect(unrealAssetName('sk_test-prop')).toBe('sk_test_prop');
    const text = py();
    expect(text).toContain('ASSET = "sk_test_prop"');
    expect(text).toContain("CONTENT_ROOT = '/Game/Mojulo/' + ASSET");
    expect(text).toContain("MAP_PATH = CONTENT_ROOT + '/' + ASSET + '_Preview'");
  });

  it('brings in an asset, never a level or a game: no score, ground, colliders, start, soundtrack, game mode or kernel', () => {
    const text = py({ figure: FIGURE });
    for (const level of ['score.json', 'game.json', 'PlayerStart', 'MojuloCollider', "spawn_block('MojuloGround'", 'MojuloGameMode', 'MojuloKernel', 'AmbientSound', 'set_game_mode', 'MENU_MAP']) {
      expect(text, level).not.toContain(level);
    }
    expect(text).toContain("    import_glb(GLB, CONTENT_ROOT)\n");
    expect(text).toContain('    apply_unlit_materials(GLB)\n    settle_local_lights()\n    turn_lone_humanoids(GLB)\n    retarget_figures(GLB, CONTENT_ROOT)\n    loop_figure_clips(CONTENT_ROOT)\n');
  });

  it('LIT carries the lit master; unlit is the default; the preview floor is the matte one in both', () => {
    expect(py({ lit: true })).toContain('LIT = True');
    expect(py({ lit: true })).toContain("create_asset('M_MojuloLit'");
    expect(py()).toContain('LIT = False');
    expect(py({ lit: undefined })).toBe(py({ lit: false }));
    expect(py()).toContain("spawn_block('MojuloFloor', unreal.Vector(0.0, 0.0, -50.0), unreal.Vector(4000.0, 4000.0, 100.0), visible=True)\n    floor.static_mesh_component.set_material(0, ensure_ground_material())");
    // the slot swap keeps ink, emissive and sticker slots off the vertex-colour masters (no COLOR_0 means white there)
    expect(py()).toContain('is_emissive_slot(cur) or is_ink_slot(cur)');
  });

  it('a skinned figure loops its clip in the preview; none ⇒ FIGURE_CLIPS is empty', () => {
    expect(py({ figure: FIGURE })).toContain('FIGURE_CLIPS = {"body":"body:idle"}');
    expect(py()).toContain('FIGURE_CLIPS = {}');
    expect(py({ figure: FIGURE })).toContain('comp.override_animation_data(anim, True, True, 0.0, 1.0)');
  });

  it('the retarget seam: the lone humanoid turned, its IK Rig, its retargeter from the mannequin, rebuilt in place', () => {
    const text = py({ figure: FIGURE });
    expect(text).toContain("if name in skins and 'rotation' not in n:");
    expect(text).toContain("ctl.set_retarget_root(bone('hips'))");
    expect(text).toContain('rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)');
    expect(text).toContain("SOURCE_IK_RIGS = ['/Game/Characters/Mannequins/Rigs/IK_Mannequin'");
    expect(text).toContain('def asset_in_place(folder, name, cls, factory):');
    expect(text).toContain("ctl.remove_retarget_chain(c.get_editor_property('chain_name'))");
  });

  it('verify: the preview map, the asset, its materials (static and skeletal slots), its lights, its figure and rig', () => {
    const text = py({ figure: FIGURE });
    for (const label of ["check('preview_map'", "check('asset_imported'", "check('materials_' + ('lit' if LIT else 'unlit')", "check('lights_carried'",
      "check(prefix + 'figure_skinned:' + figure", "check('figure_clip:' + figure", "check(prefix + 'retarget_rig:' + figure"]) expect(text, label).toContain(label);
    expect(text).toContain('elif isinstance(a, unreal.SkeletalMesh):\n                try:\n                    mats = [');
    expect(text).toContain("if 'KHR_lights_punctual' in (n.get('extensions') or {})");
  });

  it('the run writes its notes even when it fails; verify embeds them with the figures\' facts, only when there are any', () => {
    const text = py({ figure: FIGURE });
    expect(text).toContain("    try:\n        build_asset()\n    finally:\n        with open(os.path.join(unreal.Paths.project_dir(), 'mojulo-import.json'), 'w') as f:");
    expect(text).toContain("    if diagnostics or notes:\n        gate['diagnostics'] = {'assets': diagnostics, 'import': notes}");
    for (const key of ["'anim_sequences'", "'first_bones'", "'attach_parent'", "'under_wrapper'"]) expect(text).toContain(key);
  });

  it('the guide follows the T/# protocol — one-line numbered steps, two-digit substeps, ascending', () => {
    for (const out of [emit(), emit({ figure: FIGURE, lit: true })]) {
      const guide = file(out, 'IMPORT-GUIDE.md');
      const tLines = guide.split('\n').filter((l) => /^T\d/.test(l));
      expect(tLines.length).toBeGreaterThanOrEqual(5);
      const seen = [];
      for (const line of tLines) {
        const m = /^T(\d{3})(?:\.(\d{2}))? \S/.exec(line);
        expect(m, `bad T line: ${line}`).toBeTruthy();
        seen.push(Number(m[1]) * 100 + Number(m[2] ?? 0));
      }
      expect([...seen].sort((x, y) => x - y)).toEqual(seen);
      for (const line of guide.split('\n').filter((l) => /^#\d/.test(l))) expect(line).toMatch(/^#\d{3} \S/);
      expect(guide).not.toMatch(/Add Component|spawn a PlayerStart|place a Box|Transform > /i);
    }
    expect(file(emit({ figure: FIGURE }), 'IMPORT-GUIDE.md')).toContain('#004 the figure `body` stands skinned');
    expect(file(emit({ figure: FIGURE }), 'IMPORT-GUIDE.md')).toContain('`IK_Mojulo_body`');
  });

  it('the README says the contract, and a Characters section only with a skinned figure', () => {
    const readme = file(emit(), 'README.md');
    expect(readme).toContain("Unreal takes mojulo's assets, not its games or levels.");
    expect(readme).toContain('one material: every slot takes mojulo\'s vertex-colour material');
    expect(readme).not.toContain('## Characters');
    const withFigure = file(emit({ figure: FIGURE }), 'README.md');
    expect(withFigure).toContain('`body` ships skinned: one mesh on a 58-joint skeleton and its clips (`idle`, `walk`, `wave`).');
    expect(withFigure).toContain('`IK_Mojulo_<figure>` under `Content/Mojulo/sk_test_prop/Retarget`');
    expect(readme).toContain("export_model { ref: 'sk_test-prop', format: 'unreal' }");
  });

  it('guide snapshot', () => {
    expect(file(emit({ figure: FIGURE }), 'IMPORT-GUIDE.md')).toMatchSnapshot();
  });
});
