"""Capture persistent identity and imported route bounds without creating actors."""
import json, os, hashlib
import unreal
root=unreal.Paths.project_dir()
levels=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
editor=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
report={}
for ref in ['night-run-city','night-run-cave','night-run-lounge']:
    assert levels.load_level('/Game/NightRun/Maps/'+ref)
    world=editor.get_editor_world()
    persistent=world.get_world_settings().get_level()
    dressing=[]
    route=[]
    for a in actors.get_all_level_actors():
        label=a.get_actor_label()
        if a.get_level()==persistent and label.startswith('NightRunDressing_'):
            v=a.get_actor_location()
            dressing.append({'label':label,'guid':a.get_editor_property('actor_guid').to_string(),'position':[v.x,v.y,v.z],'intensity':a.light_component.get_editor_property('intensity')})
        if 'relay' in label.lower() and 'route' in label.lower():
            pos,extent=a.get_actor_bounds(False)
            route.append({'label':label,'center':[pos.x,pos.y,pos.z],'extent':[extent.x,extent.y,extent.z]})
    assert dressing, 'Project dressing missing in '+ref
    report[ref]={'dressing':sorted(dressing,key=lambda x:x['label']),'route':sorted(route,key=lambda x:x['label']),'game_mode':world.get_world_settings().get_editor_property('default_game_mode').get_path_name()}
fx=os.path.join(root,'Content','NightRun','FX','NS_RelaySignal.uasset')
with open(fx,'rb') as source:
    report['_depiction']={'asset_sha256':hashlib.sha256(source.read()).hexdigest()}
with open(os.environ.get('NIGHTRUN_SNAPSHOT',os.path.join(root,'campaign-snapshot.json')),'w') as output:
    json.dump(report,output,indent=2)
