# -*- coding: utf-8 -*-
"""Repair every value that came out of a RGSS *Table*.

The bug
-------
``fixreader.table_values`` (used by ``convert.py``) reads the Table binary as

    [int32 dim][int32 xs][int32 ys][int32 zs]            <- 16 byte header
    [int16 data]

but the real payload written by this VX Ace build is

    [int32 dim][int32 xs][int32 ys][int32 zs][int32 n]   <- 20 byte header
    [int16 data * n]

Because the header is four bytes too short, ``values[0]`` and ``values[1]``
are actually the low half of the element count ``n`` (so they always look like
``[n_low16, n_high16]``) and the whole array is **shifted by two elements**.

That one off-by-four-bytes corrupted three different outputs:

* ``Animations.json``  -> frames were transposed *and* shifted, so
  ``Sprite_Animation.updateCellSprite`` read ``cell[6] === undefined`` and
  ``undefined.clamp()`` killed the game loop.
* ``Map*.json``        -> every map's tile array was shifted by two entries
  (you can still see the leftover ``[14400, 0]`` at the start of Map014).
* ``Tilesets.json``    -> passability flags were shifted by two tile ids, so
  collision was wrong for every tile on every map.

This script re-reads the original ``vxace_data_backup/*.rvdata2`` with the
correct 20 byte header and rewrites the three affected parts of the project
data.  It is idempotent: it always rebuilds from the source of truth, so it can
be re-run safely.

Usage
-----
    python fix_tables.py                 # repair ./Monline-MV (and mv_project)
    python fix_tables.py --dry-run       # report only
    python fix_tables.py --project DIR
"""
from __future__ import annotations

import argparse
import json
import os
import struct
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from fixreader import load_fix                      # noqa: E402

BACKUP = os.path.join(SCRIPT_DIR, "vxace_data_backup")
DEFAULT_PROJECTS = [os.path.join(SCRIPT_DIR, "Monline-MV"),
                    os.path.join(SCRIPT_DIR, "mv_project")]

HEADER_SIZE = 20


def rk(name):
    """Attribute key helper: '@data' or Symbol('@data') -> '@data'."""
    return name if hasattr(name, "startswith") else str(name)


def attrs_of(obj):
    return {rk(k): v for k, v in obj.attributes.items()}


def read_table(userdef):
    """Return (dim, xs, ys, zs, values) using the real 20 byte header."""
    d = getattr(userdef, "_private_data", None)
    if not d or len(d) < HEADER_SIZE:
        return None
    dim, xs, ys, zs, n = struct.unpack("<5i", d[:HEADER_SIZE])
    if n < 0 or HEADER_SIZE + 2 * n > len(d):
        # fall back to the old (buggy) interpretation for unexpected payloads
        if len(d) < 16:
            return None
        dim, xs, ys, zs = struct.unpack("<4i", d[:16])
        n = xs * ys * zs
        if 16 + 2 * n > len(d):
            return None
        vals = struct.unpack("<%dh" % n, d[16:16 + 2 * n])
    else:
        vals = struct.unpack("<%dh" % n, d[HEADER_SIZE:HEADER_SIZE + 2 * n])
    return dim, xs, ys, zs, list(vals)


# ---------------------------------------------------------------------------
# Tilesets: flags
# ---------------------------------------------------------------------------
def fix_tilesets(project, dry):
    src = os.path.join(BACKUP, "Tilesets.rvdata2")
    dst = os.path.join(project, "data", "Tilesets.json")
    if not (os.path.isfile(src) and os.path.isfile(dst)):
        return "skip (missing file)"
    raw = load_fix(open(src, "rb").read())
    with open(dst, encoding="utf-8") as f:
        proj = json.load(f)
    changed = 0
    for i, ts in enumerate(proj):
        if not ts or i >= len(raw) or raw[i] is None:
            continue
        a = attrs_of(raw[i])
        tf = a.get("@flags")
        if tf is None:
            continue
        parsed = read_table(tf)
        if not parsed:
            continue
        _dim, _xs, _ys, _zs, vals = parsed
        if ts.get("flags") != vals:
            changed += 1
            if not dry:
                ts["flags"] = vals
    if changed and not dry:
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(proj, f, ensure_ascii=False)
    return "flags rebuilt for %d tileset(s) (%d entries each)" % (changed, len(vals))


# ---------------------------------------------------------------------------
# Maps: data
# ---------------------------------------------------------------------------
def fix_map(project, name, dry):
    src = os.path.join(BACKUP, name + ".rvdata2")
    dst = os.path.join(project, "data", name + ".json")
    if not (os.path.isfile(src) and os.path.isfile(dst)):
        return None
    raw = load_fix(open(src, "rb").read())
    a = attrs_of(raw)
    with open(dst, encoding="utf-8") as f:
        mp = json.load(f)
    W = int(mp.get("width") or a.get("@width") or 0)
    H = int(mp.get("height") or a.get("@height") or 0)
    if not W or not H:
        return None
    td = a.get("@data")
    parsed = read_table(td) if td is not None else None
    if not parsed:
        return None
    _dim, xs, ys, zs, vals = parsed

    # MV map data: z 0..3 = tile layers (painted bottom-up), z 4 = shadow bits,
    # z 5 = region ids.  VX Ace: z 0,1,2 = editor layers 1-3, z 3 = region ids.
    #
    # We deliberately keep the plane layout the converter already produced
    # (vx z -> mv z, 3 planes) and only repair the two-element shift: changing
    # the layer order would alter how every map renders, which is out of scope
    # for a corruption fix.  MV tolerates the missing planes (tileId() falls
    # back to 0).
    data = [0] * (W * H * 3)
    for z in range(min(zs, 3)):
        for y in range(H):
            for x in range(W):
                if x < xs and y < ys:
                    v = vals[x + y * xs + z * xs * ys]
                    data[x + y * W + z * W * H] = int(v)
    old = mp.get("data")
    if old == data:
        return None
    if not dry:
        mp["data"] = data
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(mp, f, ensure_ascii=False)
    return "planes=%d (kept as-is)" % zs


# ---------------------------------------------------------------------------
# Animations: frames
# ---------------------------------------------------------------------------
def fix_animations(project, dry):
    src = os.path.join(BACKUP, "Animations.rvdata2")
    dst = os.path.join(project, "data", "Animations.json")
    if not (os.path.isfile(src) and os.path.isfile(dst)):
        return "skip (missing file)"
    raw = load_fix(open(src, "rb").read())
    with open(dst, encoding="utf-8") as f:
        proj = json.load(f)
    fixed = 0
    cells = 0
    for i, an in enumerate(proj):
        if not an or i >= len(raw) or raw[i] is None:
            continue
        a = attrs_of(raw[i])
        src_frames = a.get("@frames") or []
        out = []
        for fr in src_frames:
            if fr is None:
                out.append([])
                continue
            fa = attrs_of(fr)
            cd = fa.get("@cell_data")
            parsed = read_table(cd) if cd is not None else None
            if not parsed:
                out.append([])
                continue
            _dim, xs, ys, _zs, vals = parsed
            # RGSS Table[x, y] -> flat[x + y*xs]; x = cell, y = field
            frame = []
            for c in range(xs):
                frame.append([int(vals[c + f * xs]) for f in range(ys)])
            cells += len(frame)
            out.append(frame)
        if an.get("frames") != out:
            fixed += 1
            if not dry:
                an["frames"] = out
    if fixed and not dry:
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(proj, f, ensure_ascii=False)
    return "frames rebuilt for %d animation(s), %d cells" % (fixed, cells)


# ---------------------------------------------------------------------------
# Classes: params  (8 params x 100 levels)
# ---------------------------------------------------------------------------
def fix_classes(project, dry):
    src = os.path.join(BACKUP, "Classes.rvdata2")
    dst = os.path.join(project, "data", "Classes.json")
    if not (os.path.isfile(src) and os.path.isfile(dst)):
        return "skip (missing file)"
    raw = load_fix(open(src, "rb").read())
    with open(dst, encoding="utf-8") as f:
        proj = json.load(f)
    changed = 0
    shape = None
    for i, cl in enumerate(proj):
        if not cl or i >= len(raw) or raw[i] is None:
            continue
        a = attrs_of(raw[i])
        tp = a.get("@params")
        parsed = read_table(tp) if tp is not None else None
        if not parsed:
            continue
        _dim, xs, ys, _zs, vals = parsed
        # RGSS: params[param, level] -> flat[param + level*xs]
        # MV:   params[paramId][level]  (8 rows of 100)
        out = [[int(vals[p + l * xs]) for l in range(ys)] for p in range(xs)]
        shape = (len(out), len(out[0]))
        if cl.get("params") != out:
            changed += 1
            if not dry:
                cl["params"] = out
    if changed and not dry:
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(proj, f, ensure_ascii=False)
    return "params rebuilt for %d class(es), shape=%s" % (changed, shape)


# ---------------------------------------------------------------------------
def project_label(project):
    return os.path.basename(os.path.normpath(project))


def run(project, dry):
    print("=== %s ===" % project)
    print("  Tilesets  : " + fix_tilesets(project, dry))
    print("  Classes   : " + fix_classes(project, dry))
    print("  Animations: " + fix_animations(project, dry))

    maps = sorted(f[:-len(".rvdata2")] for f in os.listdir(BACKUP)
                  if f.startswith("Map") and f.endswith(".rvdata2")
                  and f[3:-len(".rvdata2")].isdigit())
    done = 0
    notes = set()
    for name in maps:
        r = fix_map(project, name, dry)
        if r:
            done += 1
            notes.add(r)
    print("  Maps      : rebuilt %d/%d map(s) %s"
          % (done, len(maps), " ".join(sorted(notes)) if notes else ""))


def main():
    ap = argparse.ArgumentParser(description="Repair RGSS Table off-by-4-byte corruption.")
    ap.add_argument("--project", action="append", help="project dir (repeatable)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    projects = [os.path.abspath(p) for p in (args.project or DEFAULT_PROJECTS)]
    for p in projects:
        if not os.path.isdir(os.path.join(p, "data")):
            print("[SKIP] %s has no data/" % p)
            continue
        run(p, args.dry_run)
    if args.dry_run:
        print("(dry-run: nothing written)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
