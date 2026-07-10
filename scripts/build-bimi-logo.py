#!/usr/bin/env python3
"""Build a BIMI-compliant SVG from the official NW logo PNG."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ios/NoteworthyLive/App/Resources/Assets.xcassets/Logo.imageset/logo.png"
OUT = ROOT / "bimi/bimi-logo.svg"
WORK = ROOT / "bimi/work"
SIZE = 96

CANVAS_PATH = re.compile(
    r"^M0 \d+ l0 -\d+ \d+ 0 \d+ 0 0 \d+ 0 \d+ -\d+ 0 -\d+ 0 0 -\d+z\s*",
    re.I,
)


def classify(r: int, g: int, b: int, a: int) -> str:
    if a < 20:
        return "bg"
    if r > 200 and g > 200 and b > 200:
        return "white"
    if r < 55 and g < 55 and b < 55:
        return "black"
    if b > r + 20 and b > g + 10:
        return "blue"
    return "bg"


def mask_image(img: Image.Image, target: str) -> Image.Image:
    out = Image.new("1", img.size, 0)
    px = img.load()
    mask = out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            mask[x, y] = 1 if classify(r, g, b, a) == target else 0
    return out


def globe_geometry(img: Image.Image) -> tuple[float, float, float]:
    px = img.load()
    pts = []
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if classify(*px[x, y]) == "blue":
                pts.append((x, y))
    if not pts:
        return SIZE / 2, SIZE / 2, SIZE * 0.41
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    radius = max(max(xs) - min(xs), max(ys) - min(ys)) / 2
    return cx, cy, radius


def split_subpaths(d: str) -> list[str]:
    parts = re.split(r"\s+(?=[Mm])", d.strip())
    return [p.strip() for p in parts if p.strip()]


def fix_relative_origin(d: str, canvas_height: int) -> str:
    """Potrace letter paths are relative to the canvas moveto — restore absolute coords."""
    d = re.sub(r"\s+", " ", d).strip()
    d = CANVAS_PATH.sub("", d).strip()
    match = re.match(r"^m\s*([-\d]+)\s+([-\d]+)", d, re.I)
    if match:
        x, y = int(match.group(1)), int(match.group(2))
        d = f"M{x} {canvas_height + y}{d[match.end():]}"
    return d.strip()


def keep_main_subpaths(d: str, max_paths: int = 2) -> str:
    d = fix_relative_origin(d, canvas_height=SIZE * 5)
    subpaths = split_subpaths(d)
    subpaths = [p for p in subpaths if p and not CANVAS_PATH.match(p)]
    if not subpaths:
        return ""
    return " ".join(subpaths[:max_paths])


def trace_layer(mask: Image.Image, layer_name: str, max_paths: int = 2) -> str:
    WORK.mkdir(parents=True, exist_ok=True)
    pbm = WORK / f"{layer_name}.pbm"
    svg = WORK / f"{layer_name}.svg"
    mask.save(pbm)
    subprocess.run(
        ["potrace", "-s", "--flat", "-o", str(svg), str(pbm)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    paths = re.findall(r"<path d=\"([^\"]+)\"", svg.read_text(), re.S)
    cleaned = [keep_main_subpaths(p, max_paths=max_paths) for p in paths]
    cleaned = [p for p in cleaned if p]
    return " ".join(cleaned)


def main() -> None:
    img = Image.open(SOURCE).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    cx, cy, r = globe_geometry(img)

    svg_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        (
            f'<svg version="1.2" baseProfile="tiny-ps" width="{SIZE}" height="{SIZE}" '
            f'viewBox="0 0 {SIZE} {SIZE}" xmlns="http://www.w3.org/2000/svg">'
        ),
        f'<rect width="{SIZE}" height="{SIZE}" fill="#000000"/>',
        "<defs>",
        (
            f'<radialGradient id="globe" cx="{cx - r * 0.12:.2f}" cy="{cy - r * 0.18:.2f}" '
            f'fx="{cx - r * 0.18:.2f}" fy="{cy - r * 0.22:.2f}" r="{r * 1.05:.2f}">'
        ),
        '<stop offset="0%" stop-color="#6EC0FF"/>',
        '<stop offset="45%" stop-color="#2E8FE8"/>',
        '<stop offset="100%" stop-color="#0F4F96"/>',
        "</radialGradient>",
        "</defs>",
        f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="url(#globe)"/>',
        f'<g transform="translate(0,{SIZE}) scale(0.1,-0.1)">',
    ]

    letter_layers = [
        ("white", "#FFFFFF", 1),
        ("black", "#101010", 1),
    ]

    for name, fill, max_paths in letter_layers:
        d = trace_layer(mask_image(img, name), name, max_paths=max_paths)
        if d:
            svg_parts.append(f'<path fill="{fill}" d="{d}"/>')

    svg_parts.extend(["</g>", "</svg>"])
    OUT.write_text("\n".join(svg_parts))

    size_kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT} ({size_kb:.1f} KB)")
    if size_kb > 32:
        raise SystemExit("BIMI SVG exceeds 32 KB — simplify paths")


if __name__ == "__main__":
    main()
