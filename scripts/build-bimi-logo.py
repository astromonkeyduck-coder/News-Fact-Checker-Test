#!/usr/bin/env python3
"""Build the BIMI-compliant Noteworthy News logo SVG.

Recreates the NW globe mark (blue globe, white N, black W) as clean
vector geometry using real bold font glyphs — no raster tracing, so the
output stays sharp and passes SVG Tiny PS validation.

Requires: fonttools (pip install fonttools) and DejaVu Sans Bold
(preinstalled on most Linux systems).

Run: python3 scripts/build-bimi-logo.py  (or npm run bimi:build)
"""

from __future__ import annotations

from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "bimi/bimi-logo.svg"
FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

SIZE = 96
CAP_HEIGHT_UNITS = 1493  # DejaVu Sans Bold capital height in font units
TARGET_CAP_PX = 26.5
BASELINE_Y = 58.0
SQUEEZE = 0.88  # horizontal compression to match the logo's heavy look
OVERLAP = 4.0   # W tucks just behind the N's right stem (stem ~4.7px wide)


def main() -> None:
    glyph_set = TTFont(str(FONT)).getGlyphSet()
    scale = TARGET_CAP_PX / CAP_HEIGHT_UNITS

    def glyph(ch: str, dx: float) -> tuple[str, float]:
        pen = SVGPathPen(glyph_set)
        t = Transform().translate(dx, BASELINE_Y).scale(scale * SQUEEZE, -scale)
        glyph_set[ch].draw(TransformPen(pen, t))
        return pen.getCommands(), glyph_set[ch].width * scale * SQUEEZE

    _, n_adv = glyph("N", 0)
    _, w_adv = glyph("W", 0)
    total = n_adv + w_adv - OVERLAP
    n_x = SIZE / 2 - total / 2
    w_x = n_x + n_adv - OVERLAP

    n_path, _ = glyph("N", n_x)
    w_path, _ = glyph("W", w_x)

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
  <path fill="#0B0B0B" d="{w_path}"/>
  <path fill="#FFFFFF" d="{n_path}"/>
</svg>
'''
    OUT.write_text(svg)

    size_kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT} ({size_kb:.1f} KB)")
    if size_kb > 32:
        raise SystemExit("BIMI SVG exceeds 32 KB — simplify paths")


if __name__ == "__main__":
    main()
