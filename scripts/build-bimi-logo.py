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
BASELINE_Y = 58.0

# Measured from the original 96px logo:
N_LEFT = 23.0    # N bbox left edge
N_WIDTH = 24.0   # N bbox width (right edge x47)
W_LEFT = 42.5    # W bbox left edge — slices over the N's right stem at top


def main() -> None:
    glyph_set = TTFont(str(FONT)).getGlyphSet()
    yscale = CAP_PX / CAP_HEIGHT_UNITS

    def bbox(ch: str) -> tuple[float, float]:
        pen = BoundsPen(glyph_set)
        glyph_set[ch].draw(pen)
        xmin, _, xmax, _ = pen.bounds
        return xmin, xmax

    def path(ch: str, target_left: float, xscale: float, xmin_units: float) -> str:
        pen = SVGPathPen(glyph_set)
        dx = target_left - xmin_units * xscale
        t = Transform().translate(dx, BASELINE_Y).scale(xscale, -yscale)
        glyph_set[ch].draw(TransformPen(pen, t))
        return pen.getCommands()

    n_xmin, n_xmax = bbox("N")
    w_xmin, w_xmax = bbox("W")

    # N compressed to the original's 24px bbox; W at its natural width
    # for the same cap height (~34px, matching the original's ~31-34px).
    n_xscale = N_WIDTH / (n_xmax - n_xmin)
    w_xscale = yscale

    n_path = path("N", N_LEFT, n_xscale, n_xmin)
    w_path = path("W", W_LEFT, w_xscale, w_xmin)

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
