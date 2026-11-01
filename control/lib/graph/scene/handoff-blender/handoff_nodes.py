"""
handoff_nodes.py - THE HANDOFF'S NODE TREES in Blender (mojulo's scene/handoff-blender.js, run by import_handoff.py):
the World page's fragments ported to shader nodes, so they run in EEVEE and in Cycles alike (no OSL).

  terrain_group(T, images)  the layered ground (the page's scene/channels/form-land.js `layeredGround`, as Godot's
                            handoff_terrain.gdshader ports it): each layer along the face's dominant axis (the rock along
                            both side axes on a turning face), its weight raised by its own height and by noise, its colour
                            about its mean over the corner's solved base; the path's mask feathered by noise, its powder and
                            clay; the undergrowth on a green land; the moss and the ledges' dirt on the rock; the scree
                            thinned by its stones' dice; the trail's patches and dust; the ground's parallax kinds (pebbles,
                            cracked earth, plates) as relief on the normal; the sand wet by its height. Not here: the page's
                            parallax marches (the scree's, the clay's, the undergrowth's, the rock's and the kinds': Blender's
                            nodes have no loop; the kinds' relief stands on the normal instead), and the dunes' and the snow's
                            own layers (the page's alone, as in Godot)
  sea_material(S, env, ...)  the page's sea: its colour lit, see-through at its opacity, faded toward the shore by the
                            depth under it, the page's sky dome in its reflection by Schlick's Fresnel; whole off its depth
                            map (the page's deep floor there is not in the handoff)
  haze_group(haze)          the page's haze (three's FogExp2: 1 - exp(-(density x distance)^2)), mixed over a material's
                            surface by the camera's distance; the sky stays clear of it, as on the page
  world(env)                the World: the camera sees the page's sky dome (horizon to zenith, through the tone curve as
                            on the page), everything else is lit by the solve's ambient alone (the page lights with it,
                            with no sky light over it)

The ports are written in a small expression language (`G`): Python arithmetic on node sockets that lays down Math,
Vector Math, Mix and Map Range nodes, so each line reads as the page's line it ports. The value noise is a node group
(`mojulo:vn`) over the page's own hash; the Voronoi of the parallax kinds is Blender's (its cells not the page's).
Mojulo's frame is z-up in metres, which Blender's world is: a point's world position is the page's.
"""
import bpy

TAG = 'mojulo_handoff'


def _tag(idb):
    idb[TAG] = True
    return idb


def use_nodes(idb):
    # (Blender 5 gives every material and world its nodes; before it, they are asked for)
    if bpy.app.version < (5, 0, 0):
        idb.use_nodes = True
    return idb


# ---- the expression language -------------------------------------------------------------------------------------

class G:
    """A node tree being written: each operation a node, laid out in creation order."""

    def __init__(self, nt, cols=48):
        self.nt, self.n, self.cols = nt, 0, cols

    def new(self, t, **props):
        nd = self.nt.nodes.new(t)
        for k, v in props.items():
            setattr(nd, k, v)
        i = self.n
        self.n += 1
        nd.location = ((i // self.cols) * 200.0, -(i % self.cols) * 130.0)
        nd.hide = True
        return nd

    def put(self, val, sock):
        if isinstance(val, (int, float)):
            if hasattr(sock.default_value, '__len__'):
                sock.default_value = [float(val)] * len(sock.default_value)
            else:
                sock.default_value = float(val)
        elif isinstance(val, (tuple, list)):
            n = len(sock.default_value)
            v = [float(x) for x in val] + [1.0] * max(0, n - len(val))
            sock.default_value = v[:n]
        else:
            self.nt.links.new(val.s, sock)

    def f(self, sock):
        return F(self, sock)

    def v(self, sock):
        return V(self, sock)

    # (a constant as a socket, where an operation needs both sides as nodes)
    def const(self, x):
        nd = self.new('ShaderNodeValue')
        nd.outputs[0].default_value = float(x)
        return F(self, nd.outputs[0])


def _g(*xs):
    for x in xs:
        if isinstance(x, (F, V)):
            return x.g
    return None


_PY = {'ADD': lambda a, b: a + b, 'SUBTRACT': lambda a, b: a - b, 'MULTIPLY': lambda a, b: a * b,
       'DIVIDE': lambda a, b: a / b if b else 0.0, 'MINIMUM': min, 'MAXIMUM': max, 'LESS_THAN': lambda a, b: 1.0 if a < b else 0.0,
       'GREATER_THAN': lambda a, b: 1.0 if a > b else 0.0, 'POWER': lambda a, b: a ** b, 'SIGN': lambda a, b: (a > 0) - (a < 0),
       'ABSOLUTE': lambda a, b: abs(a), 'SQRT': lambda a, b: a ** 0.5, 'EXPONENT': lambda a, b: __import__('math').exp(a),
       'FLOOR': lambda a, b: float(__import__('math').floor(a)), 'FRACT': lambda a, b: a - __import__('math').floor(a)}


def math(op, a, b=None, c=None):
    g = _g(a, b, c)
    if g is None:
        # (constants fold: the page's line, worked out here)
        return float(_PY[op](a, b))
    nd = g.new('ShaderNodeMath', operation=op)
    g.put(a, nd.inputs[0])
    if b is not None:
        g.put(b, nd.inputs[1])
    if c is not None:
        g.put(c, nd.inputs[2])
    return F(g, nd.outputs[0])


def vmath(op, a, b=None, scale=None):
    g = _g(a, b, scale)
    nd = g.new('ShaderNodeVectorMath', operation=op)
    g.put(a, nd.inputs[0])
    if b is not None:
        g.put(b, nd.inputs[1])
    if scale is not None:
        g.put(scale, nd.inputs[3])
    return nd


class F:
    """A float socket."""

    def __init__(self, g, s):
        self.g, self.s = g, s

    # (a float against a vector, or a constant tuple, is a vector)
    def _vec(self, o):
        return o if isinstance(o, V) else cv(self.g, o) if isinstance(o, (tuple, list)) else None

    def __add__(self, o):
        v = self._vec(o)
        return v + self if v is not None else math('ADD', self, o)

    def __radd__(self, o):
        v = self._vec(o)
        return v + self if v is not None else math('ADD', o, self)

    def __sub__(self, o):
        v = self._vec(o)
        return vec_of(self) - v if v is not None else math('SUBTRACT', self, o)

    def __rsub__(self, o):
        v = self._vec(o)
        return v - self if v is not None else math('SUBTRACT', o, self)

    def __mul__(self, o):
        v = self._vec(o)
        return v * self if v is not None else math('MULTIPLY', self, o)

    def __rmul__(self, o):
        v = self._vec(o)
        return v * self if v is not None else math('MULTIPLY', o, self)

    def __truediv__(self, o):
        return math('DIVIDE', self, o)

    def __rtruediv__(self, o):
        v = self._vec(o)
        return v / self if v is not None else math('DIVIDE', o, self)

    def __neg__(self):
        return math('MULTIPLY', self, -1.0)


class V:
    """A vector socket (a colour too: Blender converts between them)."""

    def __init__(self, g, s):
        self.g, self.s, self._xyz = g, s, None

    def _sep(self):
        if self._xyz is None:
            nd = self.g.new('ShaderNodeSeparateXYZ')
            self.g.put(self, nd.inputs[0])
            self._xyz = (F(self.g, nd.outputs[0]), F(self.g, nd.outputs[1]), F(self.g, nd.outputs[2]))
        return self._xyz

    @property
    def x(self):
        return self._sep()[0]

    @property
    def y(self):
        return self._sep()[1]

    @property
    def z(self):
        return self._sep()[2]

    def __add__(self, o):
        return V(self.g, vmath('ADD', self, vec_of(o, self.g)).outputs[0])

    def __radd__(self, o):
        return self + o

    def __sub__(self, o):
        return V(self.g, vmath('SUBTRACT', self, vec_of(o, self.g)).outputs[0])

    def __rsub__(self, o):
        return V(self.g, vmath('SUBTRACT', vec_of(o, self.g), self).outputs[0])

    def __mul__(self, o):
        if isinstance(o, V):
            return V(self.g, vmath('MULTIPLY', self, o).outputs[0])
        if isinstance(o, (tuple, list)):
            return V(self.g, vmath('MULTIPLY', self, o).outputs[0])
        return V(self.g, vmath('SCALE', self, scale=o).outputs[0])

    def __rmul__(self, o):
        return self * o

    def __truediv__(self, o):
        if isinstance(o, (int, float)):
            return self * (1.0 / o)
        if isinstance(o, F):
            return V(self.g, vmath('SCALE', self, scale=1.0 / o).outputs[0])
        return V(self.g, vmath('DIVIDE', self, vec_of(o, self.g)).outputs[0])

    def __neg__(self):
        return self * -1.0


def vec_of(o, g=None):
    """A vector from a vector, a float (its three components) or a tuple."""
    if isinstance(o, V):
        return o
    if isinstance(o, F):
        return vec3(o, o, o)
    if isinstance(o, (int, float)):
        return (float(o),) * 3
    return tuple(o) + (0.0,) * (3 - len(o))


def cv(g, t):
    """A constant vector as a socket."""
    nd = g.new('ShaderNodeCombineXYZ')
    for k in range(3):
        nd.inputs[k].default_value = float(t[k])
    return V(g, nd.outputs[0])


def vec3(x, y, z=0.0):
    g = _g(x, y, z)
    if g is None:
        return (float(x), float(y), float(z))
    nd = g.new('ShaderNodeCombineXYZ')
    g.put(x, nd.inputs[0])
    g.put(y, nd.inputs[1])
    g.put(z, nd.inputs[2])
    return V(g, nd.outputs[0])


vec2 = vec3


def _num(x):
    return isinstance(x, (int, float))


def fract(x):
    return V(x.g, vmath('FRACTION', x).outputs[0]) if isinstance(x, V) else math('FRACT', x)


def floor(x):
    return V(x.g, vmath('FLOOR', x).outputs[0]) if isinstance(x, V) else math('FLOOR', x)


def absf(x):
    return V(x.g, vmath('ABSOLUTE', x).outputs[0]) if isinstance(x, V) else (abs(x) if _num(x) else math('ABSOLUTE', x))


def sign(x):
    return math('SIGN', x)


def sqrt(x):
    return math('SQRT', x)


def exp(x):
    return math('EXPONENT', x)


def powf(a, b):
    return math('POWER', a, b)


def minf(a, b):
    return min(a, b) if _num(a) and _num(b) else math('MINIMUM', a, b)


def maxf(a, b):
    return max(a, b) if _num(a) and _num(b) else math('MAXIMUM', a, b)


def clamp(x, lo=0.0, hi=1.0):
    return minf(maxf(x, lo), hi)


def smoothstep(a, b, x):
    """GLSL's smoothstep: Map Range's own smoothstep, clamped."""
    g = _g(a, b, x)
    if g is None:
        t = min(1.0, max(0.0, (x - a) / (b - a)))
        return t * t * (3.0 - 2.0 * t)
    nd = g.new('ShaderNodeMapRange', data_type='FLOAT', interpolation_type='SMOOTHSTEP', clamp=True)
    g.put(x, nd.inputs[0])
    g.put(a, nd.inputs[1])
    g.put(b, nd.inputs[2])
    g.put(0.0, nd.inputs[3])
    g.put(1.0, nd.inputs[4])
    return F(g, nd.outputs[0])


def step(edge, x):
    """GLSL's step: 1 where x >= edge."""
    return 1.0 - math('LESS_THAN', x, edge)


def lt(a, b):
    return math('LESS_THAN', a, b)


def gt(a, b):
    return math('GREATER_THAN', a, b)


def ge(a, b):
    return 1.0 - lt(a, b)


def band(*cs):
    """Conditions (0 or 1) and-ed."""
    out = cs[0]
    for c in cs[1:]:
        out = out * c
    return out


def mix(a, b, t):
    """GLSL's mix, unclamped: floats, or vectors by a float."""
    g = _g(a, b, t)
    if g is None:
        if isinstance(a, (tuple, list)) or isinstance(b, (tuple, list)):
            A, Bv = vec_of(a), vec_of(b)
            return tuple(A[k] + (Bv[k] - A[k]) * t for k in range(3))
        return a + (b - a) * t
    if isinstance(a, V) or isinstance(b, V) or (isinstance(a, (tuple, list))) or (isinstance(b, (tuple, list))):
        nd = g.new('ShaderNodeMix', data_type='VECTOR', clamp_factor=False)
        nd.factor_mode = 'UNIFORM'
        g.put(t, nd.inputs['Factor'])
        g.put(vec_of(a, g), _sock(nd.inputs, 'A_Vector'))
        g.put(vec_of(b, g), _sock(nd.inputs, 'B_Vector'))
        return V(g, _sock(nd.outputs, 'Result_Vector'))
    nd = g.new('ShaderNodeMix', data_type='FLOAT', clamp_factor=False)
    g.put(t, _sock(nd.inputs, 'Factor_Float'))
    g.put(a, _sock(nd.inputs, 'A_Float'))
    g.put(b, _sock(nd.inputs, 'B_Float'))
    return F(g, _sock(nd.outputs, 'Result_Float'))


def select(c, a, b):
    """c ? a : b, c being 0 or 1."""
    return mix(b, a, c)


def _sock(socks, ident):
    for s in socks:
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def dot(a, b):
    g = _g(a, b)
    return F(g, vmath('DOT_PRODUCT', a, vec_of(b, g)).outputs['Value'])


def length(a):
    return F(a.g, vmath('LENGTH', a).outputs['Value'])


def normalize(a):
    return V(a.g, vmath('NORMALIZE', a).outputs[0])


def group_node(g, tree):
    nd = g.new('ShaderNodeGroup')
    nd.node_tree = tree
    return nd


# ---- the value noise: the page's vn (a lattice of hashes, smoothly interpolated) ------------------------------------

def vn_group():
    name = 'mojulo:vn'
    ng = bpy.data.node_groups.get(name)
    if ng is not None and ng.get(TAG):
        return ng
    ng = _tag(bpy.data.node_groups.new(name, 'ShaderNodeTree'))
    ng.interface.new_socket('Vector', in_out='INPUT', socket_type='NodeSocketVector')
    ng.interface.new_socket('Value', in_out='OUTPUT', socket_type='NodeSocketFloat')
    g = G(ng, cols=12)
    gin = g.new('NodeGroupInput')
    gout = g.new('NodeGroupOutput')
    p = g.v(gin.outputs[0])
    i = floor(p)
    f = fract(p)
    f = f * f * (vec_of(3.0) - f * 2.0)

    # (the page's hash, fract(sin(dot(p, (127.1, 311.7))) x 43758.5453): the same lattice, so its fields (the dry ground,
    # the trail's stretches, its patches, the clay) fall where the page's do)
    def hn(q):
        return fract(math('SINE', dot(q, (127.1, 311.7, 0.0))) * 43758.5453)
    a, b = hn(i), hn(i + (1.0, 0.0, 0.0))
    c, d = hn(i + (0.0, 1.0, 0.0)), hn(i + (1.0, 1.0, 0.0))
    out = mix(mix(a, b, f.x), mix(c, d, f.x), f.y)
    g.put(out, gout.inputs[0])
    return ng


def vn(g, p):
    nd = group_node(g, vn_group())
    g.put(p, nd.inputs[0])
    return F(g, nd.outputs[0])


def tex(g, image, uv, interp='Linear', ext='REPEAT'):
    nd = g.new('ShaderNodeTexImage', interpolation=interp, extension=ext)
    nd.image = image
    g.put(uv, nd.inputs['Vector'])
    return V(g, nd.outputs['Color']), F(g, nd.outputs['Alpha'])


# ---- the layered ground ------------------------------------------------------------------------------------------

def _v3(a, d=(0.0, 0.0, 0.0)):
    return tuple(float(x) for x in a[:3]) if isinstance(a, (list, tuple)) and len(a) >= 3 else d


def _v2(a, d=(0.0, 0.0)):
    return tuple(float(x) for x in a[:2]) if isinstance(a, (list, tuple)) and len(a) >= 2 else d


def terrain_group(T, images, pixel=0.0013):
    """The layered ground as a node group (outputs Base Color, Roughness, Normal: a world-space normal). `images`: the
    layers' images by kind ({'base': [7], 'normal': [7], 'orm': [7]}) and the dice, path and grass images (or None).
    `pixel`: a pixel's footprint per metre of distance, standing in for the page's fwidth (Blender's nodes have no
    screen derivatives) where the parallax kinds fade by their detail."""
    name = 'mojulo:terrain'
    ng = _tag(bpy.data.node_groups.new(name, 'ShaderNodeTree'))
    ng.interface.new_socket('Base Color', in_out='OUTPUT', socket_type='NodeSocketColor')
    ng.interface.new_socket('Roughness', in_out='OUTPUT', socket_type='NodeSocketFloat')
    ng.interface.new_socket('Normal', in_out='OUTPUT', socket_type='NodeSocketVector')
    g = G(ng)
    gout = g.new('NodeGroupOutput')
    R = T.get('read', {})
    tile = [float(t) for t in R.get('tile', [])] + [1.0] * 7
    mean = [_v3(m, (0.5, 0.5, 0.5)) for m in R.get('mean', [])] + [(0.5, 0.5, 0.5)] * 7
    B = R.get('bases', {}) or {}
    uPathBase, uClayBase = _v3(B.get('path')), _v3(B.get('clay'))
    uStoneBase, uUnderBase = _v3(B.get('stone')), _v3(B.get('under'))
    uUnder = 1.0 if R.get('green') else 0.0
    uMoss = float(R.get('moss', 0.0) or 0.0)
    D = R.get('dress') if isinstance(R.get('dress'), dict) else {}
    uClay = float(D.get('clay', 0.0) or 0.0)
    uDress = (float(D.get('rubble', 0.0) or 0.0), float(D.get('dust', 0.0) or 0.0), float(D.get('reach', 0.0) or 0.0))
    uSdIn = float(D.get('sdIn', 1.5) if D.get('sdIn') is not None else 1.5)
    uPatch = _v3(D.get('patches', [0, 0, 0]))
    W = R.get('wet') if isinstance(R.get('wet'), dict) else None
    uWet = (-1e9 if not W or W.get('z') is None else float(W['z']), float((W or {}).get('band', 1.0)), float((W or {}).get('tone', 1.0)), float((W or {}).get('rough', 1.0)))
    P = R.get('path') if isinstance(R.get('path'), dict) else None
    hasPath = P is not None and images.get('path') is not None
    Gr = R.get('grass') if isinstance(R.get('grass'), dict) else None
    hasG = Gr is not None and images.get('grass') is not None
    X = R.get('parallax') if isinstance(R.get('parallax'), dict) else None
    uGpCell = (X['pebbles']['cell'], X['cracks']['cell'], X['plates']['cell']) if X else (0.09, 0.34, 0.75)
    uGpDepth = (X['pebbles']['depth'], X['cracks']['depth'], X['plates']['depth']) if X else (0.03, 0.035, 0.06)
    uGp = (X['dry'], X['stretch'], X['near']) if X else (9.0, 7.0, 30.0)

    geo = g.new('ShaderNodeNewGeometry')
    P3 = g.v(geo.outputs['Position'])
    # (Blender's shading normal already faces the viewer, as the page's normal does once turned by FRONT_FACING)
    nW = normalize(g.v(geo.outputs['Normal']))
    Vw = g.v(geo.outputs['Incoming'])
    cam = g.new('ShaderNodeCameraData')
    camD = g.f(cam.outputs['View Distance'])
    col = g.new('ShaderNodeVertexColor')
    col.layer_name = 'Color'
    diffuse = g.v(col.outputs['Color'])
    spl = g.new('ShaderNodeAttribute', attribute_type='GEOMETRY')
    spl.attribute_name = '_SPLAT'
    sp = g.v(spl.outputs['Vector'])
    vSplat = (sp.x, sp.y, sp.z, g.f(spl.outputs['Alpha']))
    xy = vec2(P3.x, P3.y)
    pz3 = P3.z
    aN = absf(nW)
    # the face's dominant axis: its plane's coordinates and tangents
    cz = band(ge(aN.z, aN.x), ge(aN.z, aN.y))
    cx = (1.0 - cz) * ge(aN.x, aN.y)
    sx, sy = sign(nW.x), sign(nW.y)
    uvW = select(cz, xy, select(cx, vec2(P3.y * sx, pz3), vec2(-P3.x * sy, pz3)))
    tT = select(cz, (1.0, 0.0, 0.0), select(cx, vec3(0.0, sx, 0.0), vec3(-sy, 0.0, 0.0)))
    tB = select(cz, (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))
    # the path: the mask at this point of the plan, on ground that faces up and at the trail's own height
    pw, pd = 0.0, 99.0
    if hasPath:
        pu = (xy - (_v2(P['origin']) + (0.0,))) / (_v2(P['metres'], (1.0, 1.0)) + (1.0,))
        inside = band(gt(pu.x, 0.0), gt(pu.y, 0.0), lt(pu.x, 1.0), lt(pu.y, 1.0))
        # (a data texture on the page: its first row at v = 0, where Blender's image starts at the bottom)
        pm, pa = tex(g, images['path'], vec2(pu.x, 1.0 - pu.y), ext='EXTEND')
        pZ = _v2(P['z'], (0.0, 1.0))
        pzz = pZ[0] + (pm.z * (255.0 * 256.0) + pa * 255.0) / 65535.0 * pZ[1]
        onIt = smoothstep(0.6, 0.85, nW.z) * (1.0 - smoothstep(0.6, 1.5, absf(pz3 - pzz))) * inside
        pd = select(gt(onIt, 0.0), pm.y * (uSdIn + uDress[2]) - uSdIn, 99.0)
        eN = vn(g, xy / 0.9 + 3.7) * 0.65 + vn(g, xy / 0.22 + 8.1) * 0.35 - 0.5
        eW = 0.35 + 0.55 * vn(g, xy / 1.6 + 1.3)
        pw = (1.0 - smoothstep(-0.25, eW, pd + eN * 0.75)) * onIt
    # (a face with no natural layer, the trail's own ribbons and the walls of its shelves: the path's material all over it)
    noLayer = lt(vSplat[0] + vSplat[1] + vSplat[2] + vSplat[3], 0.01)
    pw = select(noLayer, 1.0, pw) if not isinstance(pw, float) else noLayer * 1.0 + (1.0 - noLayer) * pw
    # each layer: its own plane coordinates over its repeat (no march: see above)
    imgs = images['layers']
    hgt, bs, ns, rs = [], [], [], []
    for i in range(7):
        a = uvW / tile[i]
        # (the page's layers are data textures: its first row at v = 0)
        a = vec2(a.x, -a.y)
        o, _ = tex(g, imgs['orm'][i], a)
        hgt.append(o.z)
        rs.append((o.x, o.y))
        b, _ = tex(g, imgs['base'][i], a)
        bs.append(b / mean[i])
        n, _ = tex(g, imgs['normal'][i], a)
        ns.append(n * 2.0 - 1.0)
    # the rock: on a face turning between the two side axes sampled along both and blended
    turning = band(lt(aN.z, maxf(aN.x, aN.y)), gt(vSplat[0], 0.001))
    bx = aN.x / maxf(aN.x + aN.y, 1e-4)
    xs = ge(aN.x, aN.y)
    rk2 = select(xs, vec2(-P3.x * sy, pz3), vec2(P3.y * sx, pz3)) / tile[0]
    rT2 = select(xs, vec3(-sy, 0.0, 0.0), vec3(0.0, sx, 0.0))
    rkB = turning * select(xs, 0.5 * (1.0 - smoothstep(0.0, 0.12, bx - 0.5)), 0.5 * (1.0 - smoothstep(0.0, 0.12, 0.5 - bx)))
    a2 = vec2(rk2.x, -rk2.y)
    o2, _ = tex(g, imgs['orm'][0], a2)
    n2, _ = tex(g, imgs['normal'][0], a2)
    n2 = n2 * 2.0 - 1.0
    b2, _ = tex(g, imgs['base'][0], a2)
    w1 = tT * ns[0].x + tB * ns[0].y + nW * ns[0].z
    w2 = rT2 * n2.x + vec3(0.0, 0.0, 1.0) * n2.y + nW * n2.z
    wb = normalize(mix(w1, w2, rkB))
    ns[0] = vec3(dot(wb, tT), dot(wb, tB), dot(wb, nW))
    hgt[0] = mix(hgt[0], o2.z, rkB)
    rs[0] = (mix(rs[0][0], o2.x, rkB), mix(rs[0][1], o2.y, rkB))
    bs[0] = mix(bs[0], b2 / mean[0], rkB)
    rockUp = (tT * ns[0].x + tB * ns[0].y + nW * ns[0].z).z
    # (dirt settles on the rock's ledges)
    ledge = gt(vSplat[0], 0.001) * (smoothstep(0.5, 0.85, rockUp) * (0.55 + 0.45 * vn(g, xy / 1.2 + pz3 * 0.7 + 63.0))
                                     + 0.3 * smoothstep(0.62, 0.85, nW.z) * smoothstep(0.5, 0.75, vn(g, xy / 2.0 + 29.0)))
    # (the trail's dirt two: powder and clay by a wandering field)
    clayK, core = 0.0, 0.0
    if uClay > 0.0:
        clayK = clamp(uClay * (1.0 + 2.2 * (vn(g, xy / 1.6 + 91.0) * 0.7 + vn(g, xy / 0.55 + 13.0) * 0.3 - 0.5)))
    if hasPath:
        cN = vn(g, xy / 0.7 + 21.0) * 0.6 + vn(g, xy / 0.18 + 5.5) * 0.4 - 0.5
        core = select(lt(pd, 98.0), 1.0 - smoothstep(-0.7, -0.1, pd + cN * 0.6), 0.0)
    if uClay > 0.0:
        clayK = clamp(clayK * mix(0.25, 1.0, core) + core * 0.35)
    # (the cover on a green land)
    gcov = 1.0
    if hasG:
        gc, _ = tex(g, images['grass'], _flipv((xy - (_v2(Gr['origin']) + (0.0,))) / (_v2(Gr['metres'], (1.0, 1.0)) + (1.0,))), ext='EXTEND')
        gcov = gc.z
    ugK = 0.0
    if uUnder > 0.5:
        ugK = uUnder * clamp(0.62 + 0.5 * (vn(g, xy / 3.5 + 47.0) - 0.5)) * mix(0.6, 1.0, gcov)
    npw = 1.0 - pw
    ws = [vSplat[0] * npw, vSplat[1] * npw, vSplat[2] * npw * (1.0 - ugK), vSplat[3] * npw, pw * (1.0 - clayK), pw * clayK, vSplat[2] * npw * ugK]
    toDirt = ws[0] * minf(ledge, 1.0) * 0.7
    ws[0] = ws[0] - toDirt
    ws[2] = ws[2] + toDirt
    dirtFrac = toDirt / maxf(ws[2], 1e-4)
    # (the moss)
    if uMoss > 0.0:
        mossK = uMoss * smoothstep(0.3, 0.75, rockUp) * smoothstep(0.3, 0.6, vn(g, xy / 1.8 + pz3 * 0.6 + 81.0) * 0.7 + vn(g, xy / 0.5 + 7.0) * 0.3)
        toMoss = ws[0] * minf(mossK * 1.6, 1.0)
        ws[0] = ws[0] - toMoss
        ws[6] = ws[6] + toMoss
    # the scree thins out by its stones
    wsum = maxf(ws[0] + ws[1] + ws[2] + ws[3] + ws[4] + ws[5] + ws[6], 1e-4)
    sh = ws[1] / wsum * smoothstep(0.55, 0.8, nW.z)
    sn = vn(g, xy / 2.5 + 17.3) * 0.7 + vn(g, xy / 0.8 + 5.1) * 0.3 - 0.5
    if hasPath:
        vergeW = uDress[0] * select(ge(0.05, pd), 0.15, exp(-powf((pd - 0.45) / 0.7, 2.0))) * smoothstep(0.6, 0.85, nW.z)
        sh = maxf(sh, select(lt(pd, 98.0), vergeW * 0.9, 0.0))
    scUV = uvW / tile[1]
    kept = 0.0
    if images.get('dice') is not None:
        # (the dice as the page loads them: an image, its first row at the top, as Blender reads an image)
        dc, _ = tex(g, images['dice'], scUV, interp='Closest')
        kept = gt(sh, 0.001) * step(dc.x, minf(sh * 1.2 + sn * 0.3 * minf(sh * 4.0, 1.0), 1.0))
    top = None
    steepF = 1.0 - smoothstep(0.5, 0.8, absf(nW.z))
    for i in range(7):
        nz = vn(g, xy / 2.5 + i * 17.3) * 0.7 + vn(g, xy / 0.8 + i * 5.1) * 0.3 - 0.5
        nzF = vn(g, xy / 0.35 + pz3 * 1.7 + i * 3.1) - 0.5
        if i == 1:
            ws[i] = kept * 4.0 if not isinstance(kept, float) else g.const(kept * 4.0)
        else:
            ws[i] = gt(ws[i], 0.001) * (ws[i] + (hgt[i] * mix(0.35, 0.95, steepF) + nz * 0.35 + nzF * 0.35 * steepF) * minf(ws[i] * 3.0, 1.0))
        top = ws[i] if top is None else maxf(top, ws[i])
    tw = None
    mb, mn, mr0, mr1 = None, None, None, None
    for i in range(7):
        w = maxf(ws[i] - (top - 0.08), 0.0)
        tw = w if tw is None else tw + w
        mb = bs[i] * w if mb is None else mb + bs[i] * w
        mn = ns[i] * w if mn is None else mn + ns[i] * w
        mr0 = rs[i][0] * w if mr0 is None else mr0 + rs[i][0] * w
        mr1 = rs[i][1] * w if mr1 is None else mr1 + rs[i][1] * w
        ws[i] = w
    itw = 1.0 / maxf(tw, 1e-4)
    mb = mb * itw
    mr0, mr1 = mr0 * itw, mr1 * itw
    mn = normalize(mn)
    # the trail's patches
    tsh = (ws[4] + ws[5]) * itw
    pkW = smoothstep(0.62, 0.72, vn(g, xy / 2.2 + 11.0)) * uPatch[0] * tsh
    pkD = smoothstep(0.7, 0.8, vn(g, xy / 2.0 + 37.0)) * uPatch[1] * tsh
    pkG = smoothstep(0.6, 0.7, vn(g, xy / 1.8 + 71.0)) * uPatch[2] * tsh
    mb = mix(mb, bs[1], pkG)
    mn = normalize(mix(mn, ns[1], pkG))
    mr0, mr1 = mix(mr0, rs[1][0], pkG), mix(mr1, rs[1][1], pkG)
    mb = mb * mix(1.0, 1.15, pkW) * mix(1.0, 0.78, pkD)
    mn = normalize(mix(mn, (0.0, 0.0, 1.0), 0.5 * pkW))
    mr1 = mix(mr1, 0.45, pkD)
    # the trail's dust
    dust = 0.0
    if hasPath:
        dust = (1.0 - 0.7 * ws[6] * itw) * uDress[1] * select(lt(pd, 98.0), (1.0 - smoothstep(0.1, uDress[2] * (0.45 + 0.55 * vn(g, xy / 3.0 + 5.0)), pd)) * mix(0.45, 1.0, smoothstep(0.0, 0.6, pd)), 0.0) * smoothstep(0.6, 0.85, nW.z)
    diffuse = mix(diffuse, uPathBase, ws[4] * itw)
    diffuse = mix(diffuse, uClayBase, ws[5] * itw)
    diffuse = mix(diffuse, uUnderBase, ws[6] * itw)
    diffuse = mix(diffuse, uStoneBase, ws[1] * itw)
    diffuse = mix(diffuse, mix(diffuse, uPathBase, 0.55), dirtFrac * ws[2] * itw)
    diffuse = diffuse * mb * mix(1.0, mr0, 0.5)
    rough = clamp(mr1, 0.04, 1.0)
    # the world normal the layers make, the parallax kinds' relief on it below
    nWorld = normalize(tT * mn.x + tB * mn.y + nW * mn.z)
    # the ground's own parallax kinds: pebbles, cracked earth, fractured plates (their relief on the normal by Blender's
    # Bump over the kind's height; the page marches them near the eye)
    sS, rS = ws[2] * itw, ws[0] * itw
    gBare = 1.0
    if hasG:
        gBare = 1.0 - gcov
    bare = sS * smoothstep(0.15, 0.7, gBare) * smoothstep(0.55, 0.8, nW.z)
    dryF = smoothstep(0.45, 0.65, vn(g, xy / uGp[0] + 4.2))
    tvF = vn(g, xy / uGp[1] + 55.0)
    tPeb = 1.0 - smoothstep(0.28, 0.38, tvF)
    tCrk = smoothstep(0.62, 0.72, tvF)
    fines = vSplat[1] * (1.0 - kept) * smoothstep(0.55, 0.8, nW.z) * npw
    wK0 = clamp(bare * (1.0 - dryF) + tsh * tPeb + fines * 0.9)
    wK1 = clamp(bare * dryF + tsh * tCrk)
    wK2 = rS * 0.85 * smoothstep(0.5, 0.62, vn(g, xy / 6.0 + pz3 * 0.35 + 9.0))
    wMax = maxf(wK0, maxf(wK1, wK2))
    k0 = ge(wK0, wMax)
    k1 = (1.0 - k0) * ge(wK1, wMax)
    k2 = 1.0 - k0 - k1
    cellK = k0 * uGpCell[0] + k1 * uGpCell[1] + k2 * uGpCell[2]
    depK = k0 * uGpDepth[0] + k1 * uGpDepth[1] + k2 * uGpDepth[2]
    # (the page's fwidth of the kind's coordinates, from the camera's distance and the face's slant)
    foot = camD * pixel / maxf(dot(Vw, nW), 0.25) * 1.414 / cellK
    detK = 1.0 - smoothstep(0.25, 0.7, foot)
    h0, h1, h2, cz0, cz1, cz2 = _kinds(g, uvW, uGpCell)
    h = k0 * h0 + k1 * h1 + k2 * h2
    czv = k0 * cz0 + k1 * cz1 + k2 * cz2
    wG = gt(wMax, 0.02) * wMax * detK
    bump = g.new('ShaderNodeBump')
    g.put(wG, bump.inputs['Strength'])
    g.put(depK, bump.inputs['Distance'])
    g.put(h, bump.inputs['Height'])
    g.put(nWorld, bump.inputs['Normal'])
    nWorld = g.v(bump.outputs['Normal'])
    peb = step(0.001, h)
    tone = k0 * mix(0.9, mix(0.72, 1.2, czv) * mix(0.7, 1.05, h), peb) + k1 * mix(0.42, 1.08, smoothstep(0.0, 0.6, h)) + k2 * (mix(0.62, 1.12, czv) * mix(0.55, 1.0, h))
    diffuse = diffuse * mix(1.0, tone, wG)
    diffuse = mix(diffuse, cv(g, uStoneBase) * (tone * mix(0.85, 1.1, fract(czv * 13.0))), 0.7 * peb * wG * k0)
    rough = mix(rough, k1 * 0.95 + (1.0 - k1) * 0.8, wG * 0.5)
    if hasPath:
        lum = uPathBase[0] * 0.2126 + uPathBase[1] * 0.7152 + uPathBase[2] * 0.0722
        dc0 = tuple((uPathBase[k] * 0.65 + lum * 0.35) * 1.25 for k in range(3))
        dustC = cv(g, dc0) * mix((1.0, 1.0, 1.0), mb, 0.3)
        diffuse = mix(diffuse, dustC, dust * 0.85)
        rough = mix(rough, 1.0, dust)
        nWorld = normalize(mix(nWorld, (0.0, 0.0, 1.0), dust * 0.6))
    # (the sand wet by its height over the water)
    if uWet[0] > -1e8:
        wet = (1.0 - smoothstep(0.0, uWet[1], absf(pz3 - uWet[0] + (vn(g, xy / 1.7 + 3.1) - 0.5) * uWet[1] * 0.8))) * ws[3] * itw
        diffuse = diffuse * mix(1.0, uWet[2], wet)
        rough = mix(rough, uWet[3], wet)
    g.put(diffuse, gout.inputs['Base Color'])
    g.put(rough, gout.inputs['Roughness'])
    g.put(nWorld, gout.inputs['Normal'])
    return ng


def _flipv(uv):
    return vec2(uv.x, 1.0 - uv.y)


def _kinds(g, uvW, cells):
    """The parallax kinds' heights at the point (pebbles, cracks, plates) and each kind's cell dice: the page's gHt over
    Blender's Voronoi (its F1 distance and cell colour; the cell edge's distance for the page's d2 - d1)."""
    out_h, out_c = [], []
    for k in range(3):
        p = uvW / cells[k]
        if k > 0:
            q = p * 0.45
            p = p + vec2(vn(g, q), vn(g, q + 7.7)) * (0.8 if k == 1 else 1.6)
        f1 = g.new('ShaderNodeTexVoronoi', voronoi_dimensions='2D', feature='F1', distance='EUCLIDEAN')
        g.put(p, f1.inputs['Vector'])
        g.put(1.0, f1.inputs['Scale'])
        g.put(0.8, f1.inputs['Randomness'])
        d1 = g.f(f1.outputs['Distance'])
        cz = g.v(f1.outputs['Color']).x
        if k == 0:
            r = mix(0.22, 0.46, fract(cz * 7.3))
            q = clamp(d1 / r)
            h = ge(cz, 0.28) * sqrt(maxf(1.0 - q * q, 0.0)) * mix(0.6, 1.0, cz)
        else:
            fe = g.new('ShaderNodeTexVoronoi', voronoi_dimensions='2D', feature='DISTANCE_TO_EDGE')
            g.put(p, fe.inputs['Vector'])
            g.put(1.0, fe.inputs['Scale'])
            g.put(0.8, fe.inputs['Randomness'])
            edge = g.f(fe.outputs['Distance']) * 2.0
            if k == 1:
                h = smoothstep(0.0, mix(0.012, 0.09, vn(g, p * 1.7 + 3.0)), edge) * (0.8 + 0.2 * d1)
            else:
                h = smoothstep(0.0, 0.05, edge) * mix(0.35, 1.0, cz)
        out_h.append(h)
        out_c.append(cz)
    return out_h[0], out_h[1], out_h[2], out_c[0], out_c[1], out_c[2]


# ---- the haze, the sky, the World ---------------------------------------------------------------------------------

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = str(h).lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def hex_linear(h):
    return tuple(srgb_to_linear(c) for c in hex_rgb(h))


# (the page's tone curve, for what is measured against it)
def neutral(c):
    """Khronos PBR Neutral (the page's tone curve, and Blender's view transform of that name), on a linear colour."""
    r, g, b = c
    x = min(r, g, b)
    off = x - 6.25 * x * x if x < 0.08 else 0.04
    r, g, b = r - off, g - off, b - off
    peak = max(r, g, b)
    if peak < 0.76:
        return (r, g, b)
    d = 0.24
    npk = 1.0 - d * d / (peak + d - 0.76)
    r, g, b = r * npk / peak, g * npk / peak, b * npk / peak
    k = 1.0 - 1.0 / (0.15 * (peak - npk) + 1.0)
    return (r + (npk - r) * k, g + (npk - g) * k, b + (npk - b) * k)


def untone(y):
    """The linear colour Khronos PBR Neutral takes to `y` (a fixed point: the curve is near the identity)."""
    x = list(y)
    for _ in range(200):
        f = neutral(x)
        x = [max(0.0, x[k] + (y[k] - f[k])) for k in range(3)]
    return tuple(x)


def haze_group(haze):
    """The page's haze as a node group over a material's surface: shader in, shader out."""
    name = 'mojulo:haze'
    ng = _tag(bpy.data.node_groups.new(name, 'ShaderNodeTree'))
    ng.interface.new_socket('Shader', in_out='INPUT', socket_type='NodeSocketShader')
    ng.interface.new_socket('Shader', in_out='OUTPUT', socket_type='NodeSocketShader')
    g = G(ng, cols=8)
    gin, gout = g.new('NodeGroupInput'), g.new('NodeGroupOutput')
    rho = g.new('ShaderNodeValue', label='density (exp-squared, per metre)')
    rho.outputs[0].default_value = float(haze.get('density', 0.0) or 0.0)
    cam = g.new('ShaderNodeCameraData')
    # (three's fog reads the view's depth, not the distance)
    d = g.f(cam.outputs['View Z Depth']) * g.f(rho.outputs[0])
    fog = 1.0 - exp(-(d * d))
    em = g.new('ShaderNodeEmission')
    # (the page's haze lands as its own colour, mixed over its toned picture: measured on the page, a surface's channels
    # all move toward the hex by the one factor. Mixed here before the tone curve, the hex's own linear colour lands
    # where the page's does over the land's middle tones; only a far, near-white haze reads a shade darker than the hex)
    em.inputs['Color'].default_value = hex_linear(haze.get('color', '#c8d4e0')) + (1.0,)
    ms = g.new('ShaderNodeMixShader')
    g.put(fog, ms.inputs[0])
    ng.links.new(gin.outputs[0], ms.inputs[1])
    ng.links.new(em.outputs[0], ms.inputs[2])
    ng.links.new(ms.outputs[0], gout.inputs[0])
    return ng


def wrap_haze(mat, hz):
    """Put the haze between a material's surface and its output. A see-through surface is hazed as itself and then laid
    over what is behind it by its alpha, so what shows through (hazed by its own material) is not hazed twice."""
    nt = mat.node_tree
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None) or next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if out is None or not out.inputs['Surface'].links:
        return False
    if any(n.type == 'GROUP' and n.node_tree == hz for n in nt.nodes):
        return True
    src = out.inputs['Surface'].links[0].from_socket
    gn = nt.nodes.new('ShaderNodeGroup')
    gn.node_tree = hz
    gn.name = gn.label = 'mojulo:haze'
    gn.location = (out.location[0] - 10, out.location[1] - 160)
    nt.links.new(src, gn.inputs[0])
    b = src.node if src.node.type == 'BSDF_PRINCIPLED' else None
    a = b.inputs['Alpha'] if b is not None else None
    if a is not None and (a.links or a.default_value < 1.0):
        mx = nt.nodes.new('ShaderNodeMixShader')
        mx.name = mx.label = 'mojulo:alpha'
        mx.location = (out.location[0] - 10, out.location[1] - 320)
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        tr.location = (out.location[0] - 200, out.location[1] - 420)
        if a.links:
            nt.links.new(a.links[0].from_socket, mx.inputs[0])
            nt.links.remove(a.links[0])
        else:
            mx.inputs[0].default_value = a.default_value
        a.default_value = 1.0
        nt.links.new(tr.outputs[0], mx.inputs[1])
        nt.links.new(gn.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs['Surface'])
    else:
        nt.links.new(gn.outputs[0], out.inputs['Surface'])
    return True


def world(env):
    """The World: the camera sees the page's sky dome (or its background colour), every other ray the solve's ambient."""
    w = _tag(bpy.data.worlds.new('mojulo:world'))
    use_nodes(w)
    nt = w.node_tree
    nt.nodes.clear()
    g = G(nt, cols=10)
    out = g.new('ShaderNodeOutputWorld')
    sky = env.get('sky') if isinstance(env.get('sky'), dict) else None
    bg = env.get('background')
    if sky:
        zen = hex_linear(sky.get('zenith', bg or '#6a8fc0'))
        hor = hex_linear(sky.get('horizon', bg or '#c8d4e0'))
        tc = g.new('ShaderNodeTexCoord')
        d = normalize(g.v(tc.outputs['Generated']))
        t = powf(maxf(d.z, 0.0), 0.6)
        seen = mix(hor, zen, t)
    else:
        seen = hex_linear(bg or '#c8d4e0')
    amb = env.get('ambient')
    lit = tuple(float(a) for a in amb[:3]) if isinstance(amb, list) and len(amb) >= 3 else None
    seen_bg = g.new('ShaderNodeBackground', label='the sky the camera sees')
    g.put(seen, seen_bg.inputs['Color'])
    if lit is None:
        nt.links.new(seen_bg.outputs[0], out.inputs['Surface'])
        w['mojulo_sky'] = bool(sky)
        return w
    lit_bg = g.new('ShaderNodeBackground', label='the solve\'s ambient')
    lit_bg.inputs['Color'].default_value = lit + (1.0,)
    lp = g.new('ShaderNodeLightPath')
    ms = g.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], ms.inputs[0])
    nt.links.new(lit_bg.outputs[0], ms.inputs[1])
    nt.links.new(seen_bg.outputs[0], ms.inputs[2])
    nt.links.new(ms.outputs[0], out.inputs['Surface'])
    w['mojulo_sky'] = bool(sky)
    w['mojulo_ambient'] = list(lit)
    return w


# ---- the sea ----------------------------------------------------------------------------------------------------

def sea_material(S, env, image, base, rough):
    """The page's sea: its colour lit, alpha its opacity faded by the depth under it, the sky in its reflection."""
    m = _tag(bpy.data.materials.new('mojulo:sea'))
    use_nodes(m)
    nt = m.node_tree
    nt.nodes.clear()
    g = G(nt, cols=24)
    out = g.new('ShaderNodeOutputMaterial')
    R = S.get('read', {})
    geo = g.new('ShaderNodeNewGeometry')
    Pw = g.v(geo.outputs['Position'])
    Vw = g.v(geo.outputs['Incoming'])
    o, mtr, mx = _v2(R.get('origin', [0, 0])), _v2(R.get('metres', [1, 1]), (1.0, 1.0)), float(R.get('max', 1.0) or 1.0)
    du = (vec2(Pw.x, Pw.y) - (o + (0.0,))) / (mtr + (1.0,))
    op = float(R.get('opacity', 0.9) or 0.9)
    alpha = op
    if image is not None:
        dc, _ = tex(g, image, vec2(du.x, 1.0 - du.y), ext='EXTEND')
        off = 1.0 - band(ge(du.x, 0.0), ge(du.y, 0.0), ge(1.0, du.x), ge(1.0, du.y))
        # (off the map, the open sea: the page lays a deep floor under it there, which the handoff does not carry, so the
        # sea is whole there rather than see-through onto nothing)
        alpha = select(off, 1.0, op * smoothstep(0.0, mx, dc.x * mx))
    sky = env.get('sky') if isinstance(env.get('sky'), dict) else {}
    bg = env.get('background', '#c8d4e0')
    zen, hor = hex_linear(sky.get('zenith', bg)), hex_linear(sky.get('horizon', bg))
    # (the reflected ray's height is the eye's: the plane faces up)
    vz = Vw.z
    skyC = mix(hor, zen, powf(maxf(vz, 0.0), 0.6))
    nv = clamp(vz)
    fres = 0.04 + 0.96 * powf(1.0 - nv, 5.0)
    bsdf = g.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = tuple(base[:3]) + (1.0,)
    bsdf.inputs['Roughness'].default_value = float(rough)
    bsdf.inputs['Metallic'].default_value = 0.0
    # (its reflection is the sky's alone, as the page's: Blender's own would reflect the World, which every ray but the
    # camera's sees as the solve's ambient; the sun's glint goes with it)
    bsdf.inputs['Specular IOR Level'].default_value = 0.0
    g.put(skyC * fres, bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.0
    g.put(alpha, bsdf.inputs['Alpha'])
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        m.blend_method = 'BLEND'
    try:
        m.use_transparency_overlap = False
    except Exception:
        pass
    return m
