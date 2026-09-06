"""ASCII art with the background dropped out: figure only, background rendered as spaces."""
import sys
from collections import deque
from PIL import Image

RAMP = "@%#*+=-:."          # dark -> light, no trailing space so the figure stays solid
THRESH = 110                # figure lum < 110, sky > 129 (measured from this image)

src, width = sys.argv[1], int(sys.argv[2])

rgb = Image.open(src).convert("RGB")
lum = rgb.convert("L")
w, h = lum.size
lp = lum.load()

# 1. dark pixels are figure candidates
dark = [[lp[x, y] < THRESH for x in range(w)] for y in range(h)]

# 2. keep only the largest connected blob (drops the dark photo-bezel corner)
seen = [[False] * w for _ in range(h)]
best = []
for sy in range(h):
    for sx in range(w):
        if dark[sy][sx] and not seen[sy][sx]:
            blob, q = [], deque([(sx, sy)])
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                blob.append((x, y))
                for nx, ny in ((x+1,y), (x-1,y), (x,y+1), (x,y-1)):
                    if 0 <= nx < w and 0 <= ny < h and dark[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if len(blob) > len(best):
                best = blob

mask = [[False] * w for _ in range(h)]
for x, y in best:
    mask[y][x] = True

# 3. fill enclosed holes: flood the true background inward from the border,
#    anything unreached and unmasked is interior (bright mask face, eye slits)
outside = [[False] * w for _ in range(h)]
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if not mask[y][x] and not outside[y][x]:
            outside[y][x] = True
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if not mask[y][x] and not outside[y][x]:
            outside[y][x] = True
            q.append((x, y))
while q:
    x, y = q.popleft()
    for nx, ny in ((x+1,y), (x-1,y), (x,y+1), (x,y-1)):
        if 0 <= nx < w and 0 <= ny < h and not mask[ny][nx] and not outside[ny][nx]:
            outside[ny][nx] = True
            q.append((nx, ny))
for y in range(h):
    for x in range(w):
        if not outside[y][x]:
            mask[y][x] = True

# 4. figure-only contrast stretch, so detail isn't crushed by the missing sky
vals = sorted(lp[x, y] for y in range(h) for x in range(w) if mask[y][x])
lo = vals[len(vals) * 2 // 100]          # percentile stretch: the few specular
hi = vals[len(vals) * 92 // 100]         # highlights shouldn't flatten everything else
span = max(1, hi - lo)

# 5. sample each character cell: >=50% figure coverage keeps it, else space
height = max(1, int(width * h / w * 0.5))
n = len(RAMP) - 1
rows = []
for r in range(height):
    y0, y1 = r * h // height, max(r * h // height + 1, (r + 1) * h // height)
    row = []
    for c in range(width):
        x0, x1 = c * w // width, max(c * w // width + 1, (c + 1) * w // width)
        tot = cnt = 0
        for y in range(y0, y1):
            for x in range(x0, x1):
                if mask[y][x]:
                    cnt += 1
                    tot += lp[x, y]
        area = (y1 - y0) * (x1 - x0)
        if cnt * 2 < area:
            row.append(" ")
        else:
            v = (tot // cnt - lo) * n // span
            row.append(RAMP[min(n, max(0, v))])
    rows.append("".join(row).rstrip())
while rows and not rows[0]:  rows.pop(0)    # trim empty sky rows
while rows and not rows[-1]: rows.pop()
print("\n".join(rows))
