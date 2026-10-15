/** Front-end form only: no aerodynamic performance or physics claims. */
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const q=clamp(x);return q*q*(3-2*q);};

export function frontEnvelope({frame,language,frontWheelY,archRadius}) {
  const {L,H}=frame;
  // Stop before the wheel opening so its circular clearance is undisturbed.
  const run=Math.max(0.12,Math.min(0.55,L/2-frontWheelY-archRadius-0.04));
  const softness=language==='grandTourer'?1:language==='trackSpecial'?0.78:0.90;
  return {
    run,
    samples:[0.20,0.42,0.68,1].map(q=>q*run/L),
    deform(p,{noseWidth,noseTop,clearance}) {
      const [x,y,z]=p,d=L/2-y;
      if(d< -0.0001||d>=run)return p;
      const weight=1-smooth(d/run);
      const h=clamp((z-clearance)/(noseTop-clearance));
      const upper=Math.pow(clamp((h-0.28)/0.72),1.7);
      const lower=Math.pow(clamp((0.28-h)/0.28),2);
      const corner=Math.pow(clamp(Math.abs(x)/noseWidth),2.5);
      // Maximum setback is below half the blend length: the smooth loft
      // stays monotonic rather than folding back through itself.
      const setback=run*(0.02+0.30*upper+0.10*lower+0.17*corner)*softness;
      return [x,y-weight*setback,z-weight*H*0.055*softness*h];
    },
  };
}
