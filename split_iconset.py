#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Split the game's IconSet into texture-safe chunks.

Why this is needed
------------------
The game ships a custom 384 x 20000 IconSet with **24px cells, 16 columns**
(`extracted/Graphics/System/IconSet.png`) -- the VX Ace grid.  MV has two
hard-coded assumptions that this breaks:

1. `Window_Base._iconWidth = 32` (`js/rpg_windows.js:30`) and
   `Sprite_StateIcon._iconWidth = 32`.  Reading a 32px cell out of a 24px grid
   crops every icon and offsets it by a third of a cell, and columns 12..15
   (x >= 384) fall entirely off the 384px-wide sheet.

2. A 20000px-tall texture exceeds `MAX_TEXTURE_SIZE` (16384 on most GPUs, 8192
   with the ANGLE path).  PIXI refuses the upload, so under WebGL the whole
   sheet renders as nothing.

The fix keeps the art **pixel-perfect** (no resampling: 24 -> 32 is a 4/3
non-integer scale, which turns pixel art ragged) and instead:
  * tells MV the real cell size (MonlineIconSet.js),
  * cuts the sheet into chunks of at most ROWS_PER_CHUNK icon rows so every
    chunk stays well under a 8192 limit, and
  * teaches the two consumers to pick the chunk by row.

Chunk 0 keeps the plain `IconSet` name so anything that still asks for
"IconSet" (e.g. MV's own `ImageManager.reserveSystem('IconSet')` preload) gets
a sensible file.

Usage:  python split_iconset.py [--project Monline-MV]
"""
import argparse
import os
import sys

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

CELL = 24                 # the game's real icon cell size (VX Ace grid)
COLUMNS = 16
ROWS_PER_CHUNK = 256      # 256 * 24 = 6144 px, safe on an 8192-limit GPU
MASTER = os.path.join(SCRIPT_DIR, "extracted", "Graphics", "System", "IconSet.png")


def chunk_name(index):
    return "IconSet.png" if index == 0 else "IconSet_%d.png" % index


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.path.join(SCRIPT_DIR, "Monline-MV"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    dest = os.path.join(args.project, "img", "system")
    if not os.path.isfile(MASTER):
        print("master IconSet not found: %s" % MASTER)
        return 2

    src = Image.open(MASTER).convert("RGBA")
    w, h = src.size
    if w != CELL * COLUMNS:
        print("WARNING: %s is %dx%d, expected width %d for a %dpx / %d-column grid"
              % (MASTER, w, h, CELL * COLUMNS, CELL, COLUMNS))
    rows = h // CELL
    if h % CELL:
        print("WARNING: height %d is not a multiple of the %dpx cell; the last "
              "partial row is dropped" % (h, CELL))
    chunks = (rows + ROWS_PER_CHUNK - 1) // ROWS_PER_CHUNK
    print("master %dx%d = %d icon rows x %d columns -> %d chunk(s) of <= %d rows"
          % (w, h, rows, COLUMNS, chunks, ROWS_PER_CHUNK))

    if not os.path.isdir(dest):
        print("destination missing: %s" % dest)
        return 2

    for i in range(chunks):
        top = i * ROWS_PER_CHUNK
        bottom = min(top + ROWS_PER_CHUNK, rows)
        piece = src.crop((0, top * CELL, w, bottom * CELL))
        out = os.path.join(dest, chunk_name(i))
        print("  %-16s rows %4d..%-4d  %dx%d  (icons %d..%d)"
              % (chunk_name(i), top, bottom - 1, piece.size[0], piece.size[1],
                 top * COLUMNS, bottom * COLUMNS - 1))
        if not args.dry_run:
            piece.save(out, "PNG", optimize=True)

    # stale chunks from an earlier, larger split would keep loading
    for f in sorted(os.listdir(dest)):
        if not f.startswith("IconSet_"):
            continue
        try:
            idx = int(f[len("IconSet_"):-len(".png")])
        except ValueError:
            continue
        if idx >= chunks:
            print("  removing stale %s" % f)
            if not args.dry_run:
                os.remove(os.path.join(dest, f))

    print("ROWS_PER_CHUNK = %d, CELL = %d, COLUMNS = %d"
          % (ROWS_PER_CHUNK, CELL, COLUMNS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
