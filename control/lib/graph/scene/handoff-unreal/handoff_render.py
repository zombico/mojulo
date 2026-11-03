"""
handoff_render.py - a still per camera of the imported level, from the full editor, offscreen (the visual gate):

  MOJULO_SHOTS=<shots.json> UnrealEditor <pack>/MojuloHandoff.uproject -RenderOffscreen -unattended -nosplash -nosound
      -ExecCmds="py <pack>/mojulo/handoff_render.py"

shots.json: {"shots": [{"out": "<png>", "w": 1280, "h": 720, "camera": "<a CameraActor's label>"} | {"out", "w", "h",
"at": [x, y, z], "look": [x, y, z], "yfov": radians} (mojulo's frame: z-up metres)], "settle": seconds}. It opens the
developer's level (mojulo's sublevel streamed in), compiles mojulo's materials, lets the editor settle (the sky light
processes its cubemap, textures stream), shoots each camera with a high-resolution screenshot and quits. A commandlet
(-run=pythonscript) cannot shoot: it never ticks the world, so the sky light is never processed.
"""
import json
import math
import os
import time

import unreal

HERE = os.environ.get('MOJULO_HANDOFF') or os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'handoff.json')) as _f:
    H = json.load(_f)
_P = H.get('paths') or {}
MAP = os.environ.get('MOJULO_UNREAL_MAP') or _P.get('map') or '/Game/Level'
ROOT = os.environ.get('MOJULO_UNREAL_ROOT') or _P.get('root') or '/Game/Mojulo'
J = json.loads(open(os.environ['MOJULO_SHOTS']).read())
EAS = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
ST = {'n': 0, 'i': 0, 'busy': False, 'ready': None, 'next': 0.0, 'spawned': []}


def log(*a):
    unreal.log('[mojulo-handoff-render] ' + ' '.join(str(x) for x in a))


def ue(p):
    return unreal.Vector(float(p[0]) * 100.0, -float(p[1]) * 100.0, float(p[2]) * 100.0)


def camera_for(s):
    if s.get('camera'):
        return next((a for a in EAS.get_all_level_actors() if a.get_actor_label() == s['camera']), None)
    p, q = ue(s['at']), ue(s['look'])
    c = EAS.spawn_actor_from_class(unreal.CameraActor, p, unreal.MathLibrary.find_look_at_rotation(p, q))
    c.set_actor_label('MojuloShot_%d' % ST['i'])
    aspect = float(s.get('w', 1280)) / float(s.get('h', 720))
    v = float(s.get('yfov', math.radians(50.0)))
    cc = c.camera_component
    cc.set_editor_property('field_of_view', math.degrees(2.0 * math.atan(math.tan(v / 2.0) * aspect)))
    cc.set_editor_property('aspect_ratio', aspect)
    cc.set_editor_property('constrain_aspect_ratio', False)
    ST['spawned'].append(c)
    return c


def prepare():
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    log('open', MAP, les.load_level(MAP))
    t0, n = time.time(), 0
    for p in unreal.EditorAssetLibrary.list_assets(ROOT, recursive=True, include_folder=False):
        a = unreal.EditorAssetLibrary.load_asset(p)
        if isinstance(a, unreal.Material):
            unreal.MaterialEditingLibrary.recompile_material(a)
            n += 1
    log('compiled', n, 'materials in', round(time.time() - t0, 1), 's')


def tick(dt):
    if ST['busy']:
        return
    ST['busy'] = True
    try:
        ST['n'] += 1
        if ST['n'] == 20:
            prepare()
            ST['ready'] = time.time() + float(J.get('settle', 20))
        elif ST['ready'] is not None and time.time() >= ST['ready'] and time.time() >= ST['next']:
            if ST['i'] < len(J['shots']):
                s = J['shots'][ST['i']]
                cam = camera_for(s)
                ST['i'] += 1
                ST['next'] = time.time() + float(J.get('gap', 6))
                if cam is None:
                    unreal.log_error('[mojulo-handoff-render] ERROR no camera ' + str(s.get('camera')))
                else:
                    unreal.AutomationLibrary.take_high_res_screenshot(int(s.get('w', 1280)), int(s.get('h', 720)), s['out'], camera=cam)
                    log(cam.get_actor_label(), '->', s['out'])
            else:
                unreal.SystemLibrary.quit_editor()
    except Exception as e:  # noqa: BLE001
        unreal.log_error('[mojulo-handoff-render] ERROR ' + str(e))
        unreal.SystemLibrary.quit_editor()
    finally:
        ST['busy'] = False


unreal.register_slate_post_tick_callback(tick)
