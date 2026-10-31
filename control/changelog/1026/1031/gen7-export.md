### Form export: gen-7 materials as every engine's graphics, Godot first

The form render (gen-7) gives a surface its material and its form and never its light, which is how every engine
lights a scene. This theme makes it the engines' graphics: a level leaves for Godot as what its surfaces are
(base colour, normal, occlusion and roughness, relief for parallax, the land's layers, the plants and the scree's stones
as instances) and how it is lit at its hour (the sun with its shadows, the sky, fog and occlusion), and Godot lights it.
It supersedes the paint export (the light held in vertex colour, drawn unlit) as Godot's graphics. One engine-neutral
contract carries it: materials in the GLB, what glTF has no slot for in its extras, and the level's environment in the
score, each engine reading it through its own adapter, so Blender, Unity and Unreal's asset leg follow by an adapter
each.

Built so far: nothing yet; the theme opens with its design.
