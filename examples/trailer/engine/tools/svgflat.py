"""Flatten a reference SVG into JSON shapes for the engraving renderer.

Usage: python3 -I svgflat.py <in.svg> <out.json>

Each shape is {d, m:[a,b,c,d,e,f], fill, stroke, sw, lum}: the SVG path data, the accumulated
transform, the fill/stroke colours (hex or null), and the fill luminance (0..1). Group transforms,
inline styles, presentation attributes and simple CSS classes (.st0{fill:#..}) are resolved.
"""
import json, math, re, sys
import xml.etree.ElementTree as ET

NS = '{http://www.w3.org/2000/svg}'


def mat_mul(a, b):
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]


def parse_transform(s):
    m = [1, 0, 0, 1, 0, 0]
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', s or ''):
        v = [float(x) for x in re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?', args)]
        if name == 'matrix': t = v
        elif name == 'translate': t = [1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0]
        elif name == 'scale': t = [v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0]
        elif name == 'rotate':
            a = math.radians(v[0]); c, s_ = math.cos(a), math.sin(a)
            t = [c, s_, -s_, c, 0, 0]
            if len(v) == 3:
                t = mat_mul(mat_mul([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]])
        else: continue
        m = mat_mul(m, t)
    return m


def css_classes(root):
    out = {}
    for st in root.iter(NS + 'style'):
        for sel, body in re.findall(r'([^{}]+)\{([^}]*)\}', st.text or ''):
            for s in sel.split(','):
                s = s.strip()
                if s.startswith('.'):
                    out.setdefault(s[1:], {}).update(dict((k.strip(), v.strip()) for k, v in (p.split(':', 1) for p in body.split(';') if ':' in p)))
    return out


def lum(hexc):
    if not hexc or not hexc.startswith('#'): return None
    h = hexc[1:]
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return round(0.2126 * r + 0.7152 * g + 0.0722 * b, 3)


def shape_d(el, tag):
    g = lambda k, d=0.0: float(el.get(k, d) or d)
    if tag == 'path': return el.get('d')
    if tag in ('circle', 'ellipse'):
        cx, cy = g('cx'), g('cy')
        rx = g('r') if tag == 'circle' else g('rx'); ry = g('r') if tag == 'circle' else g('ry')
        return f'M{cx - rx},{cy}a{rx},{ry} 0 1,0 {2 * rx},0a{rx},{ry} 0 1,0 {-2 * rx},0z'
    if tag == 'rect':
        x, y, w, h = g('x'), g('y'), g('width'), g('height')
        return f'M{x},{y}h{w}v{h}h{-w}z'
    if tag in ('polygon', 'polyline'):
        pts = re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?', el.get('points', ''))
        if len(pts) < 4: return None
        d = 'M' + ' L'.join(f'{pts[i]},{pts[i + 1]}' for i in range(0, len(pts) - 1, 2))
        return d + ('z' if tag == 'polygon' else '')
    if tag == 'line':
        return f"M{g('x1')},{g('y1')}L{g('x2')},{g('y2')}"
    return None


def main():
    root = ET.parse(sys.argv[1]).getroot()
    classes = css_classes(root)
    vb = [float(x) for x in re.split(r'[ ,]+', root.get('viewBox', '0 0 100 100').strip())]
    shapes = []

    def walk(el, m, style):
        tag = el.tag.replace(NS, '')
        if tag in ('defs', 'clipPath', 'mask', 'style', 'title', 'metadata', 'text', 'linearGradient', 'radialGradient', 'symbol'):
            return
        st = dict(style)
        for c in (el.get('class') or '').split():
            st.update(classes.get(c, {}))
        for k in ('fill', 'stroke', 'stroke-width', 'display', 'opacity'):
            if el.get(k) is not None: st[k] = el.get(k)
        if el.get('style'):
            st.update(dict((k.strip(), v.strip()) for k, v in (p.split(':', 1) for p in el.get('style').split(';') if ':' in p)))
        if st.get('display') == 'none': return
        m2 = mat_mul(m, parse_transform(el.get('transform')))
        d = shape_d(el, tag)
        if d:
            fill = st.get('fill', '#000000')
            fill = None if fill in ('none', 'transparent') or fill.startswith('url') else fill
            stroke = st.get('stroke')
            stroke = None if not stroke or stroke == 'none' or stroke.startswith('url') else stroke
            sw = float(re.sub('[^0-9.]', '', st.get('stroke-width', '1')) or 1)
            shapes.append({'d': d, 'm': [round(x, 5) for x in m2], 'fill': fill, 'stroke': stroke, 'sw': sw, 'lum': lum(fill)})
        for ch in el:
            walk(ch, m2, st)

    walk(root, [1, 0, 0, 1, 0, 0], {})
    json.dump({'viewBox': vb, 'shapes': shapes}, open(sys.argv[2], 'w'))
    print(sys.argv[1].split('/')[-1], len(shapes), 'shapes', 'viewBox', vb)


main()
