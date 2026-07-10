#!/usr/bin/env python3
"""Build the BIMI-compliant Noteworthy News logo SVG.

Recreates the NW globe mark as clean vector geometry — no raster
tracing, so the output stays sharp and passes SVG Tiny PS validation.

Construction (measured from ios .../Logo.imageset/logo.png at 96px):
  - blue globe with light upper-left highlight
  - complete white N (DejaVu Sans Bold glyph), bbox x23-47
  - black W (DejaVu Sans Bold glyph) drawn ON TOP, bbox starting at
    x44 so its left edge slices over the N's right stem — the black W
    overlaps part of the N exactly like the original mark

Requires: fonttools (pip install fonttools) and DejaVu Sans Bold.

Run: python3 scripts/build-bimi-logo.py  (or npm run bimi:build)
"""

from __future__ import annotations

from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "bimi/bimi-logo.svg"
FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

SIZE = 96
CAP_HEIGHT_UNITS = 1493  # DejaVu Sans Bold capital height in font units
CAP_PX = 27.0
N_BASELINE_Y = 58.0
W_DROP = 2.5      # W sits slightly below the N's baseline, like the original
BLOCK_DX = -2.0   # shift the whole NW block left to center it on the globe

# Measured from the original 96px logo:
W_LEFT = 42.5 + BLOCK_DX  # W bbox left — slices over the N's right stem

# Heavy N polygon, measured row-by-row from the original (all x/y in the
# 96px grid before BLOCK_DX): stem x24-31, diagonal 8px thick from top
# (24-32) to the right stem's foot, right stem x40-47.5, cap y31.5-58.
N_POINTS = [
    (24, 31.5), (32, 31.5), (40, 45.3), (40, 31.5), (47.5, 31.5),
    (47.5, 58), (40, 58), (31, 43.6), (31, 58), (24, 58),
]
N_PATH = (
    "M" + " L".join(f"{x + BLOCK_DX:g} {y:g}" for x, y in N_POINTS) + " Z"
)


def main() -> None:
    glyph_set = TTFont(str(FONT)).getGlyphSet()
    yscale = CAP_PX / CAP_HEIGHT_UNITS

    pen = BoundsPen(glyph_set)
    glyph_set["W"].draw(pen)
    w_xmin, _, _, _ = pen.bounds

    svg_pen = SVGPathPen(glyph_set)
    dx = W_LEFT - w_xmin * yscale
    t = Transform().translate(dx, N_BASELINE_Y + W_DROP).scale(yscale, -yscale)
    glyph_set["W"].draw(TransformPen(svg_pen, t))
    w_path = svg_pen.getCommands()
    n_path = N_PATH

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.2" baseProfile="tiny-ps" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}" xmlns="http://www.w3.org/2000/svg">
  <title>Noteworthy News</title>
  <rect width="{SIZE}" height="{SIZE}" fill="#000000"/>
  <defs>
    <radialGradient id="globe" gradientUnits="userSpaceOnUse" cx="38" cy="33" r="62">
      <stop offset="0" stop-color="#87BCE9"/>
      <stop offset="0.33" stop-color="#3B76BA"/>
      <stop offset="0.7" stop-color="#1D4585"/>
      <stop offset="1" stop-color="#0D2450"/>
    </radialGradient>
  </defs>
  <circle cx="48" cy="48" r="36" fill="url(#globe)"/>
  <path fill="#FFFFFF" d="{n_path}"/>
  <path fill="#0B0B0B" d="{w_path}"/>
</svg>
'''
    OUT.write_text(svg)

    size_kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT} ({size_kb:.1f} KB)")
    if size_kb > 32:
        raise SystemExit("BIMI SVG exceeds 32 KB — simplify paths")


if __name__ == "__main__":
    main()
