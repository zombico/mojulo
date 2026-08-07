---
{ "id": "r-brush", "name": "rBrush smart-pen matter", "summary": "loaded brush / smart 3D pen / realistic single-source flame / natural ink stroke", "when": "painterly matter, loaded brush behavior, realistic single-source flame, smart 3D pen, natural ink-pen stroke, or an explicit alternative to vector-sticker drawing", "tier": "render-primitive", "marks": ["rBrush"], "phase": "p1" }
---

`rBrush` is form prima materia in mandala space. It can also operate in 2D
mode. One matter envelope or path lowers into soft body polygons, reasoned
gradients/color, contained Pastamaker strings, heat/detail subforms, same-color
edge atmosphere, or natural lateral ink stroke matter.

## Shape

```
rBrush{
  role,
  mode?: "2d",
  points?: [[x,y],...] OR from/to,
  matter: {
    phase?: "fire" | "ink",
    mode?: "2d",
    basis?: { origin:[x,y,z], flow:[x,y,z], lift:[x,y,z], cross:[x,y,z],
              screenOrigin?, east?, north?, zenith?, unitScale?, depthScale?,
              perspectiveSizing? },
    envelope: { profile?: "fat-lick"|"ink-pen"|"brush-pen"|"dry-brush"|"marker"|"calligraphy"|"lateral-stroke",
                sourceRadius?, coverageScale?, height?:[min,max], width?:number|[min,max],
                pointiness?, wobble?, noise?, taper?, pressure?:[min,max],
                points?, blur?, chiselAngle?, chiselStrength?,
                swirlAmount?, swirlTurns? }
  },
  print?: { mode?:"stamp", die?:{family?:"doubleDot"|"bristleFan"|"sparkDab"|"splotch"|"grainScatter", radius?, gap?, scale?:[min,max]},
            mergeMode?:"trace"|"component-trace"|"lane-trace", linkage?:"stroke-object", strokeId?,
            frequencyFactor?, spacingPx?, tracePolicy?:"stripHull"|"convexHull"|"alphaHull",
            spacing?, scatter?, scale?:[min,max], smoothing?,
            renderBudget?:{ maxStamps?, maxDabs?, maxTracePoints? } },
  load?: [{ role?, die:{family:"noisySpaghetti", stroke?, strokeWidth?, opacity?},
            field:{kind?:"insideEnvelope"|"insideStroke", count?, density?, length?, lanes?,
                   lateralJitter?, alignment?, fractalOctaves?, fractalSplit?, samples? },
            valueBudget? }],
  color?: { reasoning?:"combustion", ink?, independentLighting?,
            stops?:[{role:"source-white"|"hot-yellow"|"body-orange"|"cool-red", color}],
            innerOpacity?, innerBlur? },
  edge?: { atmosphere?:"same-color-soft-glow"|false, outline?, blur?, opacity? },
  fill?, stroke?, z?
}
```

## Realistic match flame

Use `rBrush` with `matter.phase:"fire"`, `envelope.profile:"fat-lick"`,
`sourceRadius`, combustion color reasoning, `outline:false`, and
`noisySpaghetti` loads inside the envelope. Fire emits one fat lick with
source-radius coverage, contained noisySpaghetti brush matter, same-color
glow, and no implicit black cutouts.

## 2D ink pen

Use `mode:"2d"`, `matter.phase:"ink"`, `envelope.profile:"ink-pen"`,
`points`/`from`/`to`, `width`/`noise`/`taper`/`pressure`, optional
`chiselAngle`/`chiselStrength`, and `insideStroke` noisySpaghetti loads to
make natural lateral strokes without requiring an elemental 3D basis.

## 2D brush printing

For Photoshop-like 2D brush printing, set `print.mergeMode:"trace"`: repeated
temporary brush dabs merge into one map trace polygon, so the line stays one
object while optional load strings provide budgeted internal texture.

For retained visible impressions, set `print.mode:"stamp"` with
`die.family:"doubleDot"`; frequency derives from `die.radius` unless
`spacingPx` is supplied. Every emitted dot is linked by
`rBrushStrokeId`/`linkage:"stroke-object"`.

For browser-sustainable double-dot strokes that preserve the center gap, set
`print.mode:"stamp"` and `print.mergeMode:"component-trace"`: each dot lane
merges into one retained trace polygon while both traces share one
`rBrushStrokeId`.
