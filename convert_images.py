#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Convert every non-PNG image under img/ into a real PNG.

Why
---
MV builds image URLs by **appending `.png` unconditionally**
(`js/rpg_managers.js:861`):

    var path = folder + encodeURIComponent(filename) + '.png';

so a `.jpg` on disk is simply unreachable.  The port worked around that with
`MonlineImageExt.js` -- a generated table of 3302 exceptions that rewrites the
URL to the real extension before the engine builds it.  That table is exactly
the kind of "forced compatibility" layer that makes the project feel patched,
and it is also a standing hazard: any image not in the table silently fails.

Converting the files removes both problems and lets MV take its native path.

Cost: measured at x2.31 on a 40-file random sample (photographic JPEG -> lossless
PNG), so img/ goes from ~1.6 GB to ~2.1 GB.  The originals are untouched in
`extracted/`, so nothing is lost if this needs to be undone.

Duplicate stems
---------------
Three files have a same-stem `.png` already, which means the `.jpg` is
unreachable dead weight (MV asks for the `.png`).  Converting would overwrite a
good file with a re-encode of a duplicate, so they are skipped.

Sources are kept by default
---------------------------
Pass `--delete-sources` to remove the `.jpg` after a successful conversion.
It is off by default on purpose: once `<name>.png` exists, MV can never ask for
`<name>.jpg` again, so the leftover is invisible dead weight - and deleting a
few thousand files in one pass is exactly the kind of bulk operation that
should be a deliberate, separable step rather than a side effect of converting.
It also makes a re-run of this script cheap and idempotent.

Truncated sources
-----------------
Some source JPEGs are short/truncated (byte-identical to the copies in
`extracted/`, so this is how the original game shipped them).  Browsers and
VX Ace both render a truncated JPEG up to the break, so
`LOAD_TRUNCATED_IMAGES` is enabled to match that; every such file is counted
and listed rather than silently dropped.

Usage:
    python convert_images.py [--project Monline-MV] [--dry-run] [--delete-sources]
"""
import argparse
import os
import sys

from PIL import Image, ImageFile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_EXT = (".jpg", ".jpeg")


def existing_png(stem):
    """An existing <stem>.png, whatever its case (Windows FS is
    case-insensitive; checking explicitly keeps the logic obvious)."""
    for cand in (stem + ".png", stem + ".PNG", stem + ".Png"):
        if os.path.isfile(cand):
            return cand
    return None


def is_truncated(path):
    """Load with truncation tolerance *off* to find out whether the source is
    short.  PIL is global about this flag, so it is toggled around the probe."""
    ImageFile.LOAD_TRUNCATED_IMAGES = False
    try:
        im = Image.open(path)
        im.load()
        return False
    except Exception:
        return True
    finally:
        ImageFile.LOAD_TRUNCATED_IMAGES = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.path.join(SCRIPT_DIR, "Monline-MV"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--delete-sources", action="store_true",
                    help="remove the .jpg after converting (off by default)")
    args = ap.parse_args()

    img_root = os.path.join(args.project, "img")
    if not os.path.isdir(img_root):
        print("no img/ under %s" % args.project)
        return 2

    targets = []
    for root, _dirs, files in os.walk(img_root):
        for f in files:
            if f.lower().endswith(SRC_EXT):
                targets.append(os.path.join(root, f))
    targets.sort()

    print("project : %s" % args.project)
    print("sources : %d non-PNG image(s)%s" % (len(targets),
          "  [delete-sources]" if args.delete_sources else ""))
    if not targets:
        print("nothing to do")
        return 0

    converted = 0
    skipped_dup = 0
    deleted = 0
    failures = []
    truncated = []
    bytes_in = bytes_out = 0

    for i, src in enumerate(targets, 1):
        stem = os.path.splitext(src)[0]
        out = stem + ".png"

        if existing_png(stem):
            # a real .png already answers for this name; never overwrite it
            skipped_dup += 1
            if args.delete_sources and not args.dry_run:
                os.remove(src)
                deleted += 1
            continue

        size_in = os.path.getsize(src)
        try:
            if not os.path.isfile(out) or os.path.getsize(out) == 0:
                if is_truncated(src):
                    truncated.append(src)
                im = Image.open(src)
                if im.mode not in ("RGB", "RGBA", "L", "LA", "P", "1", "I;16"):
                    im = im.convert("RGB")
                if not args.dry_run:
                    im.save(out, "PNG", compress_level=9)
            converted += 1
            bytes_in += size_in
            bytes_out += os.path.getsize(out) if os.path.isfile(out) else 0
            if args.delete_sources and not args.dry_run:
                os.remove(src)
                deleted += 1
        except Exception as e:
            failures.append((src, str(e)))

        if i % 400 == 0:
            print("  ... %d/%d" % (i, len(targets)))

    print("-" * 62)
    print("converted          : %d" % converted)
    print("skipped (already .png): %d" % skipped_dup)
    print("sources deleted    : %d%s" % (deleted,
          "" if args.delete_sources else "   (pass --delete-sources to remove them)"))
    print("truncated sources  : %d%s" % (len(truncated),
          "" if not truncated else "  (rendered up to the break, like a browser)"))
    print("failures           : %d" % len(failures))
    print("bytes              : %.1f MB -> %.1f MB (x%.2f)"
          % (bytes_in / 1048576, bytes_out / 1048576,
             (bytes_out / bytes_in) if bytes_in else 0))
    for p, e in failures[:10]:
        print("   FAIL %s: %s" % (p, e))
    for p in truncated[:8]:
        print("   TRUNC %s" % os.path.relpath(p, args.project))
    if len(truncated) > 8:
        print("   ... and %d more truncated" % (len(truncated) - 8))

    remaining = 0
    for root, _dirs, files in os.walk(img_root):
        for f in files:
            if f.lower().endswith(SRC_EXT):
                remaining += 1
    print("non-PNG remaining  : %d%s" % (remaining,
          "  (unreachable dead weight; MV only ever asks for .png)" if remaining and not args.delete_sources else ""))
    if args.delete_sources and remaining:
        print("WARNING: %d source(s) could not be removed" % remaining)
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
