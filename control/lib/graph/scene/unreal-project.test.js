// unreal-project.test.js — the Unreal emitters are pure text: determinism,
// guide protocol (T-numbered one-line steps — the sibling-proven format),
// the honest U0 ledger (mechanics are data-only until the U1 kernel), and a
// snapshot of the guide. Mirrors unity-project.test.js.
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { emitUnrealProject, emitUnrealGame, unrealLevelLedger } from './unreal-project.js';
import { emitUnrealKernel } from './unreal-kernel.js';

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

describe('unreal locomotion + rigs (U2)', () => {
  it('kernel indexes LevelSequences and drives idle/walk — the two-state machine', () => {
    const files = emitGame().files;
    const buildCs = files.find((f) => f.file.endsWith('MojuloKernel.Build.cs')).text;
    expect(buildCs).toContain('"LevelSequence"');
    const gm = files.find((f) => f.file.endsWith('MojuloGameMode.cpp')).text;
    expect(gm).toContain('CreateLevelSequencePlayer');
    expect(gm).toContain('TickPlayerSuit');
    expect(gm).toContain('SetActorTreeHidden');
  });

  it('verify carries clips_bound; the importer hides the whole seat tree', () => {
    const py = emitGame().files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain("check('clips_bound'");
    expect(py).toContain('def hide_actor_tree');
    expect(py).toContain('MovieSceneSequenceExtensions.get_bindings');
  });

  it('sequences resolve PER LEVEL — a multi-level pack holds one copy of a shared figure per level', () => {
    // Pre-U4 landmine: pack-wide name lookup let the last level imported win.
    const files = emitGame().files;
    const gm = files.find((f) => f.file.endsWith('MojuloGameMode.cpp')).text;
    expect(gm).toContain('"/Game/MojuloPack/Levels/")) + LevelRef');
    expect(gm).toContain('return Scoped.Num() > 0 ? Scoped : PackWide');
    // the rigid figures' LevelSequences and the skinned figures' AnimSequences, both scoped the same way
    expect(gm).toContain('SequenceIndex = IndexLevelAssets(ULevelSequence::StaticClass(), LevelRef)');
    expect(gm).toContain('AnimIndex = IndexLevelAssets(UAnimSequence::StaticClass(), LevelRef)');
    const py = files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain("scored.append((score, CONTENT_ROOT + '/Levels/' + ref))");
    expect(py).toContain('verify_clips([(score, CONTENT_ROOT)])');
    expect(py).toContain('list_assets(content_dir, recursive=True');
  });
});

describe('lit handoff (lit-handoff.plan.md step 1)', () => {
  it('the importer carries LIT and the M_MojuloLit master when asked; default is unlit', () => {
    const py = (lit) => emitUnrealProject({ ref: 'sk_test_world', score, manifestHash: 'abcd1234abcd1234', lit }).files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py(true)).toContain('LIT = True');
    expect(py(true)).toContain("create_asset('M_MojuloLit'");
    expect(py(true)).toContain('MSM_DEFAULT_LIT');
    expect(py(true)).toContain('MP_BASE_COLOR');
    expect(py(false)).toContain('LIT = False');
    expect(py(undefined)).toBe(py(false));
  });

  it('the light rig is movable sun + sky atmosphere + sky light; pot lights spawn from score.lights and are verified', () => {
    const py = emitUnrealProject({ ref: 'sk_test_world', score, manifestHash: 'abcd1234abcd1234', lit: true }).files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain('def light_rig');
    expect(py).toContain('unreal.SkyAtmosphere');
    expect(py).toContain("set_editor_property('real_time_capture', True)");
    expect(py).toContain("pitch = -40.0 if preset == 'night' else -12.0 if preset in ('dawn', 'dusk') else -35.0");
    expect(py).toContain('unreal.Rotator(roll=0.0, pitch=pitch, yaw=-30.0)');
    expect(py).toContain('def ensure_pot_lights');
    expect(py).toContain('def settle_local_lights');
    // the score's sky preset drives the rig (unreal-demo D2): night = moon + fog; the lit ground is visible
    expect(py).toContain('def light_rig(score=None)');
    expect(py).toContain('light_rig(score)');
    expect(py).toContain('unreal.ExponentialHeightFog');
    expect(py).toContain("if preset == 'night':");
    expect(py).toContain("if preset == 'interior':");
    expect(py).toContain("if preset and preset != 'interior':");
    expect(py).toContain('unreal.PostProcessVolume');
    expect(py).toContain("if score.get('yaw') is not None:");
    expect(py).toContain("yaw=-float(score['yaw'])");
    expect(py).toContain("set_editor_property('auto_exposure_bias', -2.0 if preset == 'night' else -1.5)");
    expect(py).toContain('def ensure_ground_material');
    expect(py).toContain("spawn_block('MojuloGround', unreal.Vector(center.x, center.y, ground_z - 2.0), unreal.Vector(800.0 * M, 800.0 * M, M), visible=True)");
    expect(py).toContain("check(prefix + 'lights_carried'");
  });
});

describe('shader look (rim + ink, shader-look phase 4)', () => {
  const py = () => emit().files.find((f) => f.file === 'import_mojulo.py').text;

  it('the importer keeps toon:ink slots off the vertex-colour masters — no COLOR_0 means WHITE there', () => {
    const text = py();
    expect(text).toContain('def is_ink_slot');
    expect(text).toContain('is_emissive_slot(cur) or is_ink_slot(cur)');            // static swap keeps ink
    expect(text).toContain('is_mojulo_material(cur) or is_ink_slot(cur)');          // skeletal swap keeps ink
    expect(text).toContain('is_emissive_slot(mi) or is_ink_slot(mi)');              // verify counts kept ink as ok
  });

  it('the rim master is the fresnel construction over the mode master, params on instances', () => {
    const text = py();
    expect(text).toContain('def ensure_rim_master');
    expect(text).toContain("'M_MojuloRimLit' if LIT else 'M_MojuloRim'");
    expect(text).toContain('unreal.MaterialExpressionFresnel');
    expect(text).toContain("connect_material_expressions(rim_power, '', fres, 'ExponentIn')");
    for (const p of ['RimColor', 'RimPower', 'RimStrength']) expect(text).toContain(`'${p}'`);
    // strength defaults to 0 — an instance that never sets it draws the plain look
    expect(text).toContain("rim_strength.set_editor_property('default_value', 0.0)");
  });

  it('build applies rim AFTER the plain swap and never onto ink; verify carries rim_applied only when look declares it', () => {
    const text = py();
    const level = text.slice(text.indexOf('def build_level'));
    expect(level.indexOf('apply_unlit_materials(glb_path)')).toBeGreaterThan(-1);
    expect(level.indexOf('apply_unlit_materials(glb_path)')).toBeLessThan(level.indexOf('apply_rim_materials(score)'));
    expect(text).toContain('def rim_tokens');
    expect(text).toContain('def apply_rim_materials');
    expect(text).toContain('def verify_rim');
    expect(text).toContain("check('rim_applied'");
    // the gate stays byte-identical without score.look
    expect(text).toContain('if not tokens:');
    // the same five numbers the Godot kernel spends, restamped on every export
    expect(text).toContain("set_material_instance_vector_parameter_value(mic, 'RimColor', unreal.LinearColor(float(rim[0]), float(rim[1]), float(rim[2]), 1.0))");
    expect(text).toContain("set_material_instance_scalar_parameter_value(mic, 'RimStrength', float(rim[3]))");
    expect(text).toContain("set_material_instance_scalar_parameter_value(mic, 'RimPower', float(rim[4]))");
  });
});

describe('the kernel as source files (unreal-kernel/)', () => {
  it('a game pack ships every file of the plugin folder as it is, and nothing the folder lacks', () => {
    const root = path.join(process.cwd(), 'lib/graph/scene/unreal-kernel');
    const walk = (d) => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
    const onDisk = walk(root).map((f) => path.relative(root, f).split(path.sep).join('/')).sort();
    const shipped = emitUnrealKernel().map((f) => f.file);
    expect([...shipped].sort()).toEqual(onDisk);
    const game = emitGame().files;
    for (const f of emitUnrealKernel()) expect(game.find((g) => g.file === f.file)?.text, f.file).toBe(f.text);
  });
});

describe('skinned figures (C1)', () => {
  const kernel = () => emitGame().files.find((f) => f.file.endsWith('MojuloGameMode.cpp')).text;

  it('the kernel plays a skinned figure\'s clips as AnimSequences on its mesh, else through its LevelSequence', () => {
    const gm = kernel();
    expect(gm).toContain('if (!PlayFigureClip(Figure, Entity.IdleClip, true)) PlayClip(Entity.IdleClip, true);');
    expect(gm).toContain('Mesh->PlayAnimation(Anim, bLoop);');
    // the suit: idle and walk swap on the mesh when both are there; the LevelSequences when no AnimSequence is found
    expect(gm).toContain('SuitSkeletal->PlayAnimation(bMoving ? SuitWalkAnim : SuitIdleAnim, true);');
    expect(gm).toContain('else SuitSkeletal = nullptr; // no AnimSequence by either name: the LevelSequences below');
    // the clip by its cleaned GLB name, else the one asset containing it — the importer's find_clip reads the same way
    expect(gm).toContain('if (Hits.Num() == 1) Path = AnimIndex.Find(Hits[0]);');
    const py = emitGame().files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain('return index[hits[0]] if len(hits) == 1 else None');
  });

  it('a world pack\'s importer loops the figure\'s clip at import; a game pack\'s leaves it to the kernel', () => {
    const figure = { name: 'body', clip: 'idle', clips: ['idle', 'walk'], joints: 57 };
    const world = emitUnrealProject({ ref: 'sk_test_world', score, manifestHash: 'abcd1234abcd1234', figure }).files;
    const py = world.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain('FIGURE_CLIPS = {"body":"body:idle"}');
    expect(py).toContain('    if game_mode is None:\n        loop_figure_clips(content_dir)\n');
    expect(py).toContain("comp.override_animation_data(anim, True, True, 0.0, 1.0)");
    expect(emitGame().files.find((f) => f.file === 'import_mojulo.py').text).toContain('FIGURE_CLIPS = {}');
    // without a figure the world guide is the snapshot's; with one it says what the eyes should see
    expect(world.find((f) => f.file === 'IMPORT-GUIDE.md').text).toContain('#003 the figure `body` stands skinned');
  });

  it('verify: a SkeletalMesh per skin the GLB declares, the world figure\'s clip set, AnimSequences bind as clips', () => {
    const py = emitGame().files.find((f) => f.file === 'import_mojulo.py').text;
    expect(py).toContain("check(prefix + 'figure_skinned:' + figure");
    expect(py).toContain("check('figure_clip:' + figure");
    expect(py).toContain("if name.endswith(':skin'):");
    expect(py).toContain('p = names.get(want) or find_clip(anims, clip)');
    expect(py).toContain("verify_figures([(os.path.join(PACK, 'model.glb'), CONTENT_ROOT, '')])");
  });

  it('the README names the characters only when a figure ships skinned', () => {
    const readme = (files) => files.find((f) => f.file === 'README.md').text;
    expect(readme(emit().files)).not.toContain('## Characters');
    expect(readme(emitGame().files)).not.toContain('## Characters');
    const skinned = emitUnrealGame({ ref: 'sk_test_game', manifest: gameManifest, levels: [{ ...gameLevels[0], skinned: ['body'] }, gameLevels[1]], manifestHash: 'abcd1234abcd1234' });
    expect(readme(skinned.files)).toContain('- `lv-one`: `body`');
    expect(readme(skinned.files)).not.toContain('`lv-two`:');
  });
});

describe('the retarget seam (C2)', () => {
  const py = () => emitGame().files.find((f) => f.file === 'import_mojulo.py').text;

  it('every level, either scope: the lone humanoid turned to the world facing, its IK Rig, its retargeter when a source rig is there', () => {
    expect(py()).toContain('    turn_lone_humanoids(glb_path)\n    retarget_figures(glb_path, content_dir)\n    if game_mode is None:\n');
    // a placed figure carries its rotation from scene-gltf; only the unplaced scene root is turned
    expect(py()).toContain("if name in skins and 'rotation' not in n:");
    expect(py()).toContain("ctl.set_retarget_root(bone('hips'))");
    expect(py()).toContain("rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)");
    expect(py()).toContain("SOURCE_IK_RIGS = ['/Game/Characters/Mannequins/Rigs/IK_Mannequin'");
  });

  it('rebuilt in place on a re-run, so what the project points at survives a re-mint', () => {
    expect(py()).toContain('def asset_in_place(folder, name, cls, factory):');
    expect(py()).toContain("ctl.remove_retarget_chain(c.get_editor_property('chain_name'))");
  });

  it('verify: retarget_rig per humanoid figure; retargeter only when the project holds a mannequin rig', () => {
    expect(py()).toContain("check(prefix + 'retarget_rig:' + figure");
    expect(py()).toContain("                if source_ik_rig() is not None:\n                    rtg = content_dir + '/Retarget/RTG_Mojulo_' + want");
    expect(py()).toContain('verify_retarget(level_glbs)');
  });
});

describe('the gate run reports what it found (the first-run diagnostics)', () => {
  const py = () => emitGame().files.find((f) => f.file === 'import_mojulo.py').text;

  it('the run writes its notes even when it fails; verify embeds them with the figures\' facts, only when there are any', () => {
    expect(py()).toContain("    try:\n        build_pack()\n    finally:\n        with open(os.path.join(unreal.Paths.project_dir(), 'mojulo-import.json'), 'w') as f:");
    expect(py()).toContain("    if diagnostics or notes:\n        gate['diagnostics'] = {'levels': diagnostics, 'import': notes}");
    // the facts the first run pins: the clips' asset names, the meshes' bones, where the skinned mesh hangs
    for (const key of ["'anim_sequences'", "'first_bones'", "'attach_parent'", "'under_wrapper'"]) expect(py()).toContain(key);
    expect(py()).toContain("note('retarget', figure=figure, content_dir=content_dir, mesh=hits[0], bones_read=len(names), chains=made, source=source.get_path_name(), steps=log)");
  });
});
