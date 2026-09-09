import json, os
import unreal
source='/Niagara/DefaultAssets/Templates/Systems/FountainLightweight'
dest='/Game/NightRun/FX/NS_RelaySignal'
if not unreal.EditorAssetLibrary.does_asset_exist(dest):
    template=unreal.load_asset(source)
    assert template is not None, 'Niagara template load failed'
    assert unreal.AssetToolsHelpers.get_asset_tools().duplicate_asset('NS_RelaySignal','/Game/NightRun/FX',template), 'Niagara template copy failed'
asset=unreal.EditorAssetLibrary.load_asset(dest)
assert isinstance(asset, unreal.NiagaraSystem), 'Expected a Niagara system'
unreal.EditorAssetLibrary.save_loaded_asset(asset)
with open(os.path.join(unreal.Paths.project_config_dir(),'MojuloDepiction.json'),'w') as output:
    json.dump({'pickup':dest+'.NS_RelaySignal','hazard':dest+'.NS_RelaySignal','exit':dest+'.NS_RelaySignal'},output,indent=2)
unreal.log('[night-run] project Niagara depiction bound')
