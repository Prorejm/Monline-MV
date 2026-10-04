#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Put back the VX Ace versions of RTP art that the port took from MV instead.

The bug
-------
`port_assets.py` only copies files it considers *missing*, and an earlier round
(`copy_rtp.py`) had already dropped MV RTP art into the project for names the
game itself does not ship.  So when VX Ace has `People2.png` and MV also has
`People2.png`, the project ended up with **MV's**, and port_assets never looked
again.

That is not cosmetic: character sheets are indexed (`characterIndex` 0..7 on a
4x2 grid), and MV's `People2` is a different set of people from VX Ace's.  Every
nun, door, chest and NPC built from those sheets renders as the wrong thing -
with no error anywhere, because the name, the index and the file all match up.
The church nun in the demon district was reported this way: she is
`People2` index 1, and that is a different person in MV's sheet.

Scale: the port's world art is VX Ace x1.5 (nearest neighbour), so the VX Ace
file is upscaled the same way before it is written back.

Excluded on purpose:
  * `img/system`   - `Window.png` / `Balloon.png` were *deliberately* replaced
                     with MV's, because MV reads a 192x192 skin and 48px balloon
                     frames.  Swapping them back would undo that fix.
  * `img/tilesets` - MV's tileset geometry differs from VX Ace's; the map `data`
                     was converted for the sheets already in place, so replacing
                     them would shift every tile on every map.

Usage:
    python fix_rtp_sources.py [--project Monline-MV] [--dry-run]
"""
import argparse
import os
import sys

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VX = (r"C:/Program Files (x86)/Common Files/Enterbrain/RGSS3/RPGVXAce")
MV = (r"G:/SteamLibrary/steamapps/common/RPG Maker MV/NewData/img")
SCALE = 1.5

# ported folder -> VX Ace folder under the RTP, MV folder under NewData/img
CATEGORIES = [
    ("img/characters", "Graphics/Characters", "characters"),
    ("img/faces", "Graphics/Faces", "faces"),
    ("img/enemies", "Graphics/Battlers", "enemies"),
    ("img/parallaxes", "Graphics/Parallaxes", "parallaxes"),
    ("img/battlebacks1", "Graphics/Battlebacks1", "battlebacks1"),
    ("img/battlebacks2", "Graphics/Battlebacks2", "battlebacks2"),
]


def candidates(directory, stem):
    if not os.path.isdir(directory):
        return []
    low = stem.lower()
    return [os.path.join(directory, f) for f in os.listdir(directory)
            if os.path.splitext(f)[0].lower() == low]


def same_image(a, b):
    """True if `a` is `b` at its own size, or `b` scaled by 1.5 (nearest)."""
    if a.size == b.size:
        return list(a.getdata()) == list(b.getdata())
    tgt = (int(b.size[0] * SCALE), int(b.size[1] * SCALE))
    if a.size == tgt:
        return list(a.getdata()) == list(b.resize(tgt, Image.NEAREST).getdata())
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.path.join(SCRIPT_DIR, "Monline-MV"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    swapped = []
    for ported_dir, vx_dir, mv_dir in CATEGORIES:
        pd = os.path.join(args.project, ported_dir)
        if not os.path.isdir(pd):
            continue
        vx_root = os.path.join(VX, vx_dir)
        mv_root = os.path.join(MV, mv_dir)
        for f in sorted(os.listdir(pd)):
            stem = os.path.splitext(f)[0]
            vx_files = candidates(vx_root, stem)
            mv_files = candidates(mv_root, stem)
            if not vx_files or not mv_files:
                continue          # VX Ace has nothing better to offer
            try:
                ported = Image.open(os.path.join(pd, f)).convert("RGBA")
            except Exception:
                continue
            # only touch files that are demonstrably the MV one
            if not any(same_image(ported, Image.open(m).convert("RGBA"))
                       for m in mv_files):
                continue
            src = vx_files[0]
            try:
                src_img = Image.open(src).convert("RGBA")
            except Exception:
                continue
            target = (int(src_img.size[0] * SCALE), int(src_img.size[1] * SCALE))
            swapped.append((ported_dir, f, src_img.size, target))
            if not args.dry_run:
                out = src_img.resize(target, Image.NEAREST)
                out.save(os.path.join(pd, f), "PNG", compress_level=9)

    print("replaced with the VX Ace version: %d" % len(swapped))
    for d, f, s, t in swapped[:40]:
        print("   %-22s %-28s %s -> %s" % (d, f, s, t))
    if len(swapped) > 40:
        print("   ... and %d more" % (len(swapped) - 40))
    if args.dry_run:
        print("\n(dry run - nothing written)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
