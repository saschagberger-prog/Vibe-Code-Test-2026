#!/usr/bin/env python3
"""Erzeugt die PWA-App-Icons (PNG) ohne externe Abhängigkeiten (nur stdlib)."""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public"
BG = (0, 120, 212)      # #0078d4
FG = (255, 255, 255)


def write_png(path: Path, size: int, pixels) -> None:
    raw = b"".join(b"\x00" + bytes(row) for row in pixels)
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def dist_to_segment(px, py, x1, y1, x2, y2) -> float:
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def rounded_rect_inside(px, py, w, h, r) -> bool:
    if px < 0 or py < 0 or px >= w or py >= h:
        return False
    cx = min(max(px, r), w - r)
    cy = min(max(py, r), h - r)
    return math.hypot(px - cx, py - cy) <= r


def make_icon(size: int, maskable: bool) -> list:
    scale = size / 64.0
    pad = 8 * scale if maskable else 2 * scale
    inner = size - 2 * pad
    r = 14 * scale
    check_thick = 3.2 * scale
    p1 = (pad + 18 * scale, pad + 33 * scale)
    p2 = (pad + 28 * scale, pad + 43 * scale)
    p3 = (pad + 47 * scale, pad + 22 * scale)
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            if rounded_rect_inside(x - pad, y - pad, inner, inner, r):
                d = min(
                    dist_to_segment(x, y, p1[0], p1[1], p2[0], p2[1]),
                    dist_to_segment(x, y, p2[0], p2[1], p3[0], p3[1]),
                )
                if d <= check_thick:
                    row.extend(FG)
                else:
                    row.extend(BG)
            else:
                row.extend(BG)
        rows.append(row)
    return rows


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_png(OUT / "icon-192.png", 192, make_icon(192, maskable=False))
    write_png(OUT / "icon-512.png", 512, make_icon(512, maskable=False))
    write_png(OUT / "icon-maskable-512.png", 512, make_icon(512, maskable=True))
    print("Icons geschrieben:", ", ".join(p.name for p in sorted(OUT.glob("icon-*.png"))))


if __name__ == "__main__":
    main()
