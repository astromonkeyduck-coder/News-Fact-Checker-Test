#!/usr/bin/env python3
"""Build the BIMI-compliant Noteworthy News logo SVG.

Pure computed geometry — no fonts, no raster tracing — so the output is
sharp at any size and passes SVG Tiny PS validation.

Every coordinate below was measured row-by-row from the original mark
(ios .../Logo.imageset/logo.png rendered at 96px), then the whole letter
block is shifted by BLOCK_DX to sit dead-center on the globe.

Run: python3 scripts/build-bimi-logo.py  (or npm run bimi:build)
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "bimi/bimi-logo.svg"

SIZE = 96
BLOCK_DX = -1.25  # center the measured letter block on the globe (cx=48)

# ---- N (original coords, 96px grid) ----------------------------------------
# Stem x24-31, right stem x40-47.5, cap y31.5, baseline y58.
# Diagonal: top edge 24-32.5; right edge slope 0.556 (hits right stem at
# y45); left edge slope 0.667 (leaves stem at y42, crosses x40 at y55.5).
N_POINTS = [
    (24.0, 31.5), (32.5, 31.5), (40.0, 45.0), (40.0, 31.5), (47.5, 31.5),
    (47.5, 58.0), (40.0, 58.0), (40.0, 55.5), (31.0, 42.0), (31.0, 58.0),
    (24.0, 58.0),
]

# ---- W (original coords) ----------------------------------------------------
W_LEFT = 42.5
W_TOP = 31.5      # flush with the N cap line
W_BOTTOM = 59.5   # dips slightly below the N baseline
W_WIDTH = 32.0    # right edge lands at x74.5
W_STROKE = 5.8
W_SLANT = 6.5     # horizontal run of each stroke over the full height
W_APEX_LEFT = 12.3   # apex top edge, local coords
W_RIGHT_STROKE = 6.8  # the final up-stroke is a touch heavier, per original


def n_path() -> str:
    return (
        "M"
        + " L".join(f"{x + BLOCK_DX:g} {y:g}" for x, y in N_POINTS)
        + " Z"
    )


def w_path() -> str:
    """Four overlapping parallelogram strokes; nonzero fill unites them."""

    def para(top_l: float, bot_l: float, width: float) -> str:
        pts = [
            (W_LEFT + top_l, W_TOP),
            (W_LEFT + top_l + width, W_TOP),
            (W_LEFT + bot_l + width, W_BOTTOM),
            (W_LEFT + bot_l, W_BOTTOM),
        ]
        return (
            "M"
            + " L".join(f"{x + BLOCK_DX:g} {y:g}" for x, y in pts)
            + " Z"
        )

    s1 = para(0.0, W_SLANT, W_STROKE)                        # down
    s2 = para(W_APEX_LEFT, W_APEX_LEFT - W_SLANT, W_STROKE)  # up to apex
    s3 = para(W_APEX_LEFT, W_APEX_LEFT + W_SLANT, W_STROKE)  # down from apex
    s4 = para(                                               # final up-stroke
        W_WIDTH - W_RIGHT_STROKE,
        W_WIDTH - W_RIGHT_STROKE - W_SLANT,
        W_RIGHT_STROKE,
    )
    return " ".join([s1, s2, s3, s4])


def main() -> None:
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.2" baseProfile="tiny-ps" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}" xmlns="http://www.w3.org/2000/svg">
  <title>Noteworthy News</title>
  <rect width="{SIZE}" height="{SIZE}" fill="#000000"/>
  <defs>
    <radialGradient id="globe" gradientUnits="userSpaceOnUse" cx="37" cy="31" r="66">
      <stop offset="0" stop-color="#9CC8F0"/>
      <stop offset="0.22" stop-color="#5D95D2"/>
      <stop offset="0.5" stop-color="#2E67AE"/>
      <stop offset="0.78" stop-color="#1A4489"/>
      <stop offset="1" stop-color="#0B2148"/>
    </radialGradient>
  </defs>
  <circle cx="48" cy="48" r="36" fill="url(#globe)"/>
  <path fill="#FFFFFF" d="{n_path()}"/>
  <path fill="#0B0B0B" d="{w_path()}"/>
</svg>
'''
    OUT.write_text(svg)

    size_kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT} ({size_kb:.2f} KB)")
    if size_kb > 32:
        raise SystemExit("BIMI SVG exceeds 32 KB — simplify paths")


if __name__ == "__main__":
    main()
