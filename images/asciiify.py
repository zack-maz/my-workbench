import sys
from PIL import Image, ImageOps

RAMP = "@%#*+=-:. "          # dark -> light
src, width, invert = sys.argv[1], int(sys.argv[2]), len(sys.argv) > 3

img = Image.open(src).convert("L")
img = ImageOps.autocontrast(img)
w, h = img.size
height = max(1, int(width * h / w * 0.5))   # chars are ~2x taller than wide
img = img.resize((width, height), Image.LANCZOS)

px = img.load()
ramp = RAMP[::-1] if invert else RAMP
n = len(ramp) - 1
out = "\n".join(
    "".join(ramp[px[x, y] * n // 255] for x in range(width))
    for y in range(height)
)
print(out)
