export function seedHopper(sand) {
  const {width:w,height:h}=sand;
  const top=Math.floor(h*0.25),bottom=Math.floor(h*0.62),mid=Math.floor(w/2),half=7;
  const gate=[];
  for(let y=top;y<=bottom;y++){
    const reach=Math.round((w*0.36)*(1-(y-top)/(bottom-top))+half);
    for(let thickness=0;thickness<2;thickness++){
      sand.set(mid-reach-thickness,y,2);sand.set(mid+reach+thickness,y,2);
    }
  }
  for(let x=mid-half+1;x<mid+half;x++){sand.set(x,bottom,2);gate.push([x,bottom])}
  // A vertical lip at the rim: at a ~30° repose the same fill reaches the brim, and impact slides would spill over it.
  const rim=Math.round(w*0.36+half);
  for(let y=top-6;y<top;y++)for(let thickness=0;thickness<2;thickness++){sand.set(mid-rim-thickness,y,2);sand.set(mid+rim+thickness,y,2)}
  for(let x=0;x<w;x++)sand.set(x,h-1,2);
  for(let y=0;y<h;y++){sand.set(0,y,2);sand.set(w-1,y,2)}
  for(let y=6;y<top-2;y++)for(let x=Math.floor(w*0.25);x<Math.floor(w*0.75);x++)sand.set(x,y,1);
  return gate;
}
