#!/usr/bin/env python3
"""Build the BIMI-compliant Noteworthy News logo SVG.

Pure computed geometry — no fonts, no raster tracing — so the output is
sharp at any size and passes SVG Tiny PS validation.

Construction (measured row-by-row from ios .../Logo.imageset/logo.png):
  - blue globe, light upper-left highlight, deep navy rim
  - heavy white N (stem + 8px diagonal + right stem)
  - heavy black W drawn ON TOP as four united parallelogram strokes,
    its left edge slicing across the N's right stem like the original

Run: python3 scripts/build-bimi-logo.py  (or npm run bimi:build)
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "bimi/bimi-logo.svg"

SIZE = 96

# ---- Layout (96px grid) ----------------------------------------------------
# Letter block is centered on the globe (cx=48): N spans x22-45.5,
# W spans x41.5-73 and sits slightly lower than the N like the original.
N_LEFT = 22.0
N_TOP = 31.5
N_BASE = 58.0
STEM = 7.5        # stem thickness
DIAG = 8.0        # diagonal horizontal thickness

W_LEFT = 41.5
W_TOP = 33.0
W_BOTTOM = 61.0   # dips below the N baseline like the original
W_WIDTH = 31.5
W_STROKE = 6.2    # stroke thickness (horizontal)
W_SLANT = 5.6     # horizontal run of each stroke over full height
W_APEX_LEFT = 11.5  # apex top edge, local coords


def n_path() -> str:
    l, t, b = N_LEFT, N_TOP, N_BASE
    r = l + 23.5                # N bbox right (x45.5)
    sr = l + STEM               # left stem right edge
    rl = r - STEM               # right stem left edge
    dt = l + DIAG               # diagonal top right corner
    # Where the diagonal's right edge meets the right stem, and where its
    # left edge leaves the left stem (slope chosen to land on stem corners).
    slope = (r - DIAG - l) / (b - t)
    y_hit_right = t + (rl - dt) / slope
    y_leave_left = t + (sr - l) / slope
    pts = [
        (l, t), (dt, t), (rl, y_hit_right), (rl, t), (r, t),
        (r, b), (rl, b), (sr, y_leave_left), (sr, b), (l, b),
    ]
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"


def w_path() -> str:
    """Four overlapping parallelogram strokes; nonzero fill unites them."""
    h = W_BOTTOM - W_TOP
    apex_r = W_APEX_LEFT + W_STROKE

    def para(top_l: float, bot_l: float) -> str:
        pts = [
            (W_LEFT + top_l, W_TOP),
            (W_LEFT + top_l + W_STROKE, W_TOP),
            (W_LEFT + bot_l + W_STROKE, W_BOTTOM),
            (W_LEFT + bot_l, W_BOTTOM),
        ]
        return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"

    s1 = para(0.0, W_SLANT)                                   # down
    s2 = para(W_APEX_LEFT, W_APEX_LEFT - W_SLANT)             # up to apex
    s3 = para(W_APEX_LEFT, W_APEX_LEFT + W_SLANT)             # down from apex
    s4 = para(W_WIDTH - W_STROKE, W_WIDTH - W_STROKE - W_SLANT)  # up
    _ = apex_r, h
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
