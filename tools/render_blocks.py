"""Renders every placed block of the pack to one contact sheet, for reviewing the block art side by side.
Usage: python tools/render_blocks.py [out.png] [name ...]

A small software renderer: each cube face is sampled on a fine grid, coloured from its texture and drawn
into a z-buffer from a three-quarter view with flat face shading. Bone visibility is worked out from the
block file with every state at its first value (counts at their last), except growth stages, which are each drawn as their own tile.
It ignores bone animation and leaf translucency, so it is close to the game but not exact."""
import os, sys, json, re, glob, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RP = os.path.join(ROOT, 'Kaleidoscope Herbal [RP]'); BP = os.path.join(ROOT, 'Kaleidoscope Herbal [BP]')
TERRAIN = json.load(open(os.path.join(RP, 'textures', 'terrain_texture.json'), encoding='utf-8'))['texture_data']
GEOS = {}
for f in glob.glob(os.path.join(glob.escape(RP), 'models', 'blocks', '*.json')):
    for g in json.load(open(f, encoding='utf-8'))['minecraft:geometry']:
        GEOS[g['description']['identifier']] = g
_tex = {}
def texture(short):
    if short not in _tex:
        t = TERRAIN[short]['textures']; t = t if isinstance(t, str) else t[0]
        t = t if isinstance(t, str) else t['path']
        _tex[short] = np.asarray(Image.open(os.path.join(RP, t + '.png')).convert('RGBA'))
    return _tex[short]

def rot(r):
    x, y, z = [math.radians(a) for a in r]
    Rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    Rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]])
    return Rx @ Ry @ Rz

def visible(expr, states):
    if isinstance(expr, bool): return expr
    s = str(expr)
    s = re.sub(r"q(?:uery)?\.block_state\('([^']+)'\)", lambda m: repr(states.get(m.group(1), 0)), s)
    s = s.replace('&&', ' and ').replace('||', ' or ').replace('!=', '<>').replace('!', ' not ').replace('<>', '!=')
    s = s.replace('true', 'True').replace('false', 'False')
    # the expression comes from this pack's own block files, evaluated with no builtins
    try: return bool(eval(s, {'__builtins__': {}}))
    except Exception: return True

# face: (corner, u axis, v axis) in unit cube coordinates, and its brightness
FACES = {
    'north': ((1, 1, 0), (-1, 0, 0), (0, -1, 0), 0.8), 'south': ((0, 1, 1), (1, 0, 0), (0, -1, 0), 0.8),
    'east': ((1, 1, 1), (0, 0, -1), (0, -1, 0), 0.62), 'west': ((0, 1, 0), (0, 0, 1), (0, -1, 0), 0.62),
    'up': ((0, 1, 0), (1, 0, 0), (0, 0, 1), 1.0), 'down': ((0, 0, 1), (1, 0, 0), (0, 0, -1), 0.5)}

def box_uv(u, v, w, h, d):
    return {'east': (u, v + d, d, h), 'north': (u + d, v + d, w, h), 'west': (u + d + w, v + d, d, h),
            'south': (u + 2 * d + w, v + d, w, h), 'up': (u + d, v, w, d), 'down': (u + d + w, v + d, w, -d)}

def render(geo, mats, states, size=200, yaw=-35, pitch=-30):
    bones = {b['name']: b for b in geo['bones']}
    vis = {k: visible(v, states) for k, v in mats.get('_vis', {}).items()}
    def bone_ok(b):
        while b:
            if vis.get(b['name']) is False: return False
            b = bones.get(b.get('parent'))
        return True
    def bone_xf(b):
        M, P = np.eye(3), np.zeros(3)
        chain = []
        while b: chain.append(b); b = bones.get(b.get('parent'))
        return chain
    view = rot((pitch, 0, 0)) @ rot((0, yaw, 0))
    S = size / 24.0
    allX, allY, allZ, allC = [], [], [], []
    for b in geo['bones']:
        if not bone_ok(b): continue
        chain = bone_xf(b)
        for c in b.get('cubes', []):
            o = np.array(c['origin'], float); sz = np.array(c['size'], float); inf = c.get('inflate', 0)
            o -= inf; sz += 2 * inf
            uv = c.get('uv', [0, 0])
            if isinstance(uv, list): faces = {k: {'r': r} for k, r in box_uv(uv[0], uv[1], *c['size']).items()}
            else: faces = {k: {'r': (f['uv'][0], f['uv'][1], *f.get('uv_size', [0, 0])), 'm': f.get('material_instance', '*')} for k, f in uv.items()}
            for fn, fd in faces.items():
                corner, ua, va, light = FACES[fn]
                corner, ua, va = np.array(corner, float), np.array(ua, float), np.array(va, float)
                fw = abs(ua @ sz); fh = abs(va @ sz)
                n = max(2, int(max(fw, fh, 0.01) * 14))
                nu = max(2, int(fw * 14)) if fw > 0 else 2; nv = max(2, int(fh * 14)) if fh > 0 else 2
                s, t = np.meshgrid((np.arange(nu) + 0.5) / nu, (np.arange(nv) + 0.5) / nv)
                s, t = s.ravel(), t.ravel()
                p = o + (corner[None, :] + s[:, None] * ua[None, :] + t[:, None] * va[None, :]) * sz
                u0, v0, uw, vh = fd['r']
                m = fd.get('m', '*'); short = mats.get(m) or mats.get('*')
                if short is None: continue
                tx = texture(short); th, tw = tx.shape[:2]
                gw, gh = geo['description'].get('texture_width', tw), geo['description'].get('texture_height', th)
                if short.startswith('kh_item_') or short in ('kh_leaf', 'kh_hut_marker'): gw, gh = 16, 16
                tu = ((u0 + s * uw) * tw / gw).astype(int).clip(0, tw - 1)
                tv = ((v0 + t * vh) * th / gh).astype(int).clip(0, th - 1)
                col = tx[tv, tu]
                keep = col[:, 3] > 20
                p, col = p[keep], col[keep]
                if not len(p): continue
                normal = np.cross(ua, va)
                if 'rotation' in c:
                    pv = np.array(c.get('pivot', [0, 0, 0]), float); R = rot(c['rotation'])
                    p = (p - pv) @ R.T + pv
                for bb in chain:
                    if 'rotation' in bb:
                        pv = np.array(bb.get('pivot', [0, 0, 0]), float); R = rot(bb['rotation'])
                        p = (p - pv) @ R.T + pv
                q = (p - np.array([0, 8, 0])) @ view.T
                X = (size / 2 + q[:, 0] * S).astype(int); Y = (size / 2 - q[:, 1] * S).astype(int); Z = q[:, 2] * -1
                ok = (X >= 0) & (X < size) & (Y >= 0) & (Y < size)
                X, Y, Z, col = X[ok], Y[ok], Z[ok], col[ok]
                allX.append(X); allY.append(Y); allZ.append(Z); allC.append((col[:, :3] * light).astype(np.uint8))
    img = np.zeros((size, size, 4), np.uint8)
    if allX:
        X, Y, Z, C = map(np.concatenate, (allX, allY, allZ, allC)); o = np.argsort(Z, kind='stable')
        img[Y[o], X[o], :3] = C[o]; img[Y[o], X[o], 3] = 255
    return Image.fromarray(img)

def block_entries():
    out = []
    for f in sorted(glob.glob(os.path.join(glob.escape(BP), 'blocks', '*', '*.json'))):
        b = json.load(open(f, encoding='utf-8'))['minecraft:block']
        name = b['description']['identifier'].split(':')[1]
        comps = [b.get('components', {})] + [p.get('components', {}) for p in b.get('permutations', [])]
        geo = mats = None; vis = {}
        for c in comps:
            g = c.get('minecraft:geometry')
            if g and not geo: geo = g if isinstance(g, str) else g.get('identifier'); vis = {} if isinstance(g, str) else g.get('bone_visibility', {})
            if c.get('minecraft:material_instances') and not mats:
                mats = {k: v.get('texture') for k, v in c['minecraft:material_instances'].items() if isinstance(v, dict)}
        if geo not in GEOS: continue
        mats = dict(mats or {}); mats['_vis'] = vis
        g = GEOS[geo]; stages = sorted({bn['name'] for bn in g['bones'] if re.fullmatch(r'stage\d+', bn['name'])})
        states = {}
        for k, v in b['description'].get('states', {}).items():
            vals = v if isinstance(v, list) else list(range(v['values']['min'], v['values']['max'] + 1))
            states[k] = vals[-1] if 'count' in k else vals[0]
        if stages:
            for st in stages:
                v = dict(vis); v.update({s: s == st for s in stages}); m = dict(mats); m['_vis'] = v
                out.append((f'{name}:{st}', g, m, states))
        else:
            out.append((name, g, mats, states))
    return out

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'block_sheet.png')
    only = sys.argv[2:]
    ents = [e for e in block_entries() if not only or e[0].split(':')[0] in only]
    T, cols = 200, 8
    rows = (len(ents) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * T, rows * (T + 16)), (58, 62, 70, 255)); d = ImageDraw.Draw(sheet)
    for i, (n, g, m, st) in enumerate(ents):
        x, y = i % cols * T, i // cols * (T + 16)
        im = render(g, m, st, T); sheet.alpha_composite(im, (x, y)); d.text((x + 4, y + T + 2), n, fill=(230, 230, 230, 255))
        print(n, flush=True)
    sheet.save(out)
