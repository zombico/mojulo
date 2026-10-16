/** Small, replayable design cards; independent exterior options stay composable. */
import {compileSupercarSurface} from './vehicle-odm-surface.js';
const card=(title,brief,surface)=>Object.freeze({title,brief:Object.freeze(brief),surface:Object.freeze(surface)});
export const SUPERCAR_LIBRARY=Object.freeze({
  razor:card('Razor wedge',{architecture:'midEngine',language:'aeroWedge',aero:'road'},
    {cabinStyle:'wedge',headlightStyle:'catEye',ventStyle:'sideBlades',spoilerStyle:'pedestal',paint:'scarlet'}),
  strada:card('Strada coupe',{architecture:'midEngine',language:'grandTourer',aero:'road'},
    {cabinStyle:'teardrop',headlightStyle:'slim',ventStyle:'sideBlades',spoilerStyle:'ducktail',paint:'pearl'}),
  endurance:card('Endurance special',{architecture:'rearEngine',language:'trackSpecial',aero:'track'},
    {cabinStyle:'teardrop',headlightStyle:'slim',ventStyle:'sideBlades',spoilerStyle:'swanNeck',paint:'amber'}),
  touring:card('Touring fastback',{architecture:'frontEngine',language:'grandTourer',aero:'road'},
    {cabinStyle:'fastback',headlightStyle:'round',ventStyle:'hoodLouvers',spoilerStyle:'ducktail',paint:'cobalt'}),
});
export function composeSupercar({preset='razor',seed=1,brief={},surface={}}={}) {
  const entry=Object.hasOwn(SUPERCAR_LIBRARY,preset)?SUPERCAR_LIBRARY[preset]:null;
  if(!entry)throw new Error('vehicle-odm: unknown composition preset');
  const resolvedBrief={...entry.brief,...brief,seed};
  const resolvedSurface={...entry.surface,...surface};
  return {...compileSupercarSurface(resolvedBrief,resolvedSurface),composition:{preset,seed,brief:resolvedBrief,surface:resolvedSurface}};
}
