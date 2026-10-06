"""Render Kimbo's app icon set from the same geometry as components/Kimbo.tsx (viewBox 0..100)."""
import math, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
SS = 4  # supersampling factor
PAPER = (251, 246, 238, 255)
BODY = (242, 169, 59, 255)
def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
# Pre-blended against the body so Pillow never has to alpha-blend.
SHADE = mix(BODY, (224, 143, 34), 0.45)
SHINE = mix(BODY, (255, 255, 255), 0.3)
CHEEK = mix(BODY, (244, 154, 132), 0.75)
INK = (35, 32, 27, 255)
LEAF = (46, 107, 79, 255)
LEAF_DEEP = (30, 76, 55, 255)

def bezier(p0, p1, p2, p3, n=40):
    return [((1-t)**3*p0[0]+3*(1-t)**2*t*p1[0]+3*(1-t)*t**2*p2[0]+t**3*p3[0],
             (1-t)**3*p0[1]+3*(1-t)**2*t*p1[1]+3*(1-t)*t**2*p2[1]+t**3*p3[1]) for t in [i/n for i in range(n+1)]]

def leaf(x, y, side, rot=-12, scale=1.0):
    pts = bezier((0,0),(5,-7),(13,-6),(17,-1)) + bezier((17,-1),(12,4),(5,5),(0,0))
    r = math.radians(rot)
    out = []
    for px, py in pts:
        px, py = px*scale, py*scale
        qx = px*math.cos(r) - py*math.sin(r)
        qy = px*math.sin(r) + py*math.cos(r)
        out.append((x + side*qx, y + qy))
    return out

def draw_kimbo(size, scale, offset, mono=False, bg=None):
    """scale: px per viewBox unit (before supersampling); offset: top-left of the 100x100 box."""
    W = size*SS
    img = Image.new("RGBA", (W, W), bg or (0,0,0,0))
    d = ImageDraw.Draw(img, "RGBA")
    k = scale*SS
    ox, oy = offset[0]*k, offset[1]*k
    P = lambda x, y: (ox + x*k, oy + y*k)
    def ell(cx, cy, rx, ry, fill):
        d.ellipse([P(cx-rx, cy-ry), P(cx+rx, cy+ry)], fill=fill)
    col = (lambda c: (255,255,255,255)) if mono else (lambda c: c)
    # sprout: stem + two leaves
    stem = [P(50 + 0.6*math.sin(t*math.pi), 30 - t*10) for t in [i/20 for i in range(21)]]
    d.line(stem, fill=col(LEAF), width=int(3*k))
    for (x, y, side, c) in [(50, 22, 1, LEAF), (50, 22, -1, LEAF_DEEP)]:
        d.polygon([P(*p) for p in leaf(x, y, side, scale=1.25)], fill=col(c))
    # body
    ell(50, 63, 39, 34, col(BODY))
    if not mono:
        ell(50, 84, 26, 7, SHADE)
        ell(37, 48, 11, 7, SHINE)
        ell(29, 70, 6, 3.6, CHEEK); ell(71, 70, 6, 3.6, CHEEK)
    face = (0,0,0,0) if mono else INK
    if mono:
        # monochrome icons are a single silhouette; cut the face out so it still reads
        face = (0,0,0,0)
    for x in (38, 62):
        if mono:
            d.ellipse([P(x-4.6, 59-4.6), P(x+4.6, 59+4.6)], fill=face)
        else:
            ell(x, 59, 4.6, 4.6, INK); ell(x+1.6, 57.2, 1.5, 1.5, (255,255,255,255))
    smile = bezier((44,70),(46,74),(54,74),(56,70), 30)
    d.line([P(*p) for p in smile], fill=face if mono else INK, width=int(2.8*k), joint="curve")
    return img.resize((size, size), Image.LANCZOS)

# 1024 legacy icon: Kimbo on paper with a rounded feel left to the launcher mask
icon = draw_kimbo(1024, 7.4, ((1024/7.4-100)/2, (1024/7.4-100)/2 - 5), bg=PAPER)
icon.convert("RGB").save(f"{OUT}/icon.png")

# Adaptive icon (Android): 1024 layers, artwork inside the central ~66% safe zone
fg = draw_kimbo(1024, 5.6, ((1024/5.6-100)/2, (1024/5.6-100)/2 - 5))
fg.save(f"{OUT}/android-icon-foreground.png")
Image.new("RGBA", (1024, 1024), PAPER).save(f"{OUT}/android-icon-background.png")
mono = draw_kimbo(1024, 5.6, ((1024/5.6-100)/2, (1024/5.6-100)/2 - 2), mono=True)
mono.save(f"{OUT}/android-icon-monochrome.png")

# Splash: the mark alone on transparent; background colour comes from app.json
splash = draw_kimbo(1024, 9.6, ((1024/9.6-100)/2, (1024/9.6-100)/2))
splash.save(f"{OUT}/splash-icon.png")
draw_kimbo(48, 0.44, ((48/0.44-100)/2, (48/0.44-100)/2), bg=PAPER).convert("RGB").save(f"{OUT}/favicon.png")
print("ok")
