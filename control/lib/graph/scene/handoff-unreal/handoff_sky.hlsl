// THE SKY IN UNREAL (the level's `environment.sky`, bound by import_handoff.py on the dome around the level): the World
// page's dome, from the horizon's colour to the zenith's by the height of the eye's ray (pow 0.6, as the page's and the
// other adapters'); below the horizon the horizon's colour. Unlit; it passes through the tone as the page's does, and the
// haze leaves it clear. A level with no sky has its background colour as both. The body of the dome material's Custom
// node. Inputs: P (absolute world position), Cam (the camera's), Zen, Hor (linear). Returns the colour (emissive).
float3 d = normalize(P - Cam);
return lerp(Hor.rgb, Zen.rgb, pow(max(d.z, 0.0), 0.6));
