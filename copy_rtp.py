# -*- coding: utf-8 -*-
"""Deliverable B (part 2): copy missing RTP assets into the Monline MV project.

Usage
-----
    python copy_rtp.py --rtp "<RTP root>" [--dry-run]

``<RTP root>`` is the VX Ace *or* MV Runtime Package root that contains the
original ``Graphics/`` (+ ``Audio/`` for VX Ace) or ``img/`` (+ ``audio/`` for
MV) folders.  We look in both layouts so the script works with either RTP.

For every name listed in ``missing_assets.json`` the script searches the RTP for
a file whose *basename* (extension stripped) matches, copies it into the
corresponding ``mv_project/img`` / ``mv_project/audio`` sub-directory, and prints
a success / failure tally.

If a category in ``missing_assets.json`` is an **empty** list (e.g. no audio
references were found in the data), the *entire* RTP sub-directory for that
category is copied ("all missing").

Options
-------
    --rtp PATH     RTP root directory (required)
    --dry-run      only print what would be copied; write nothing
    --missing FILE override path to missing_assets.json (default: alongside this script)
    --project DIR  override path to the mv_project directory (default: ./mv_project)
"""
import argparse
import json
import os
import shutil
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Graphics categories: missing_assets key -> RTP source sub-dirs + destination.
GRAPHICS = {
    "tilesets": {
        "rtp_dirs": ["Graphics/Tilesets", "img/tilesets"],
        "dest": "mv_project/img/tilesets",
        "exts": (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"),
    },
    "characters": {
        "rtp_dirs": ["Graphics/Characters", "img/characters"],
        "dest": "mv_project/img/characters",
        "exts": (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"),
    },
    "faces": {
        "rtp_dirs": ["Graphics/Faces", "img/faces"],
        "dest": "mv_project/img/faces",
        "exts": (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"),
    },
}

# Audio categories: missing_assets key -> destination sub-dir + RTP source sub-dirs.
AUDIO = {
    "BGM": {"rtp_dirs": ["Audio/BGM", "audio/bgm"], "dest": "mv_project/audio/bgm",
            "exts": (".ogg", ".m4a", ".wav", ".mp3", ".mid", ".midi", ".mp4")},
    "ME": {"rtp_dirs": ["Audio/ME", "audio/me"], "dest": "mv_project/audio/me",
           "exts": (".ogg", ".m4a", ".wav", ".mp3", ".mid", ".midi", ".mp4")},
    "BGS": {"rtp_dirs": ["Audio/BGS", "audio/bgs"], "dest": "mv_project/audio/bgs",
            "exts": (".ogg", ".m4a", ".wav", ".mp3", ".mid", ".midi", ".mp4")},
    "SE": {"rtp_dirs": ["Audio/SE", "audio/se"], "dest": "mv_project/audio/se",
           "exts": (".ogg", ".m4a", ".wav", ".mp3", ".mid", ".midi", ".mp4")},
}


def find_first_existing(rtp_root, candidates):
    """Return the first candidate directory that exists under rtp_root, else None."""
    for cand in candidates:
        d = os.path.join(rtp_root, cand)
        if os.path.isdir(d):
            return d
    return None


def copy_one(src_file, dest_file, dry_run):
    """Copy a single file; create parent dirs. Returns True on success."""
    if dry_run:
        return True
    os.makedirs(os.path.dirname(dest_file), exist_ok=True)
    shutil.copy2(src_file, dest_file)
    return True


def resolve_graphics(rtp_root, key, names, cfg, dry_run, stats):
    src_dir = find_first_existing(rtp_root, cfg["rtp_dirs"])
    dest_dir = os.path.join(SCRIPT_DIR, cfg["dest"])
    if not src_dir:
        stats["no_src"] += len(names)
        print("  [WARN] RTP source dir not found for '%s' (tried %s)"
              % (key, ", ".join(cfg["rtp_dirs"])))
        return
    if not names:
        # empty list -> copy the whole RTP sub-directory ("all missing")
        for fn in sorted(os.listdir(src_dir)):
            sp = os.path.join(src_dir, fn)
            if os.path.isfile(sp):
                dp = os.path.join(dest_dir, fn)
                if copy_one(sp, dp, dry_run):
                    stats["copied"] += 1
                else:
                    stats["error"] += 1
        return
    for name in names:
        base = os.path.splitext(name)[0]
        found = None
        for ext in cfg["exts"]:
            cand = os.path.join(src_dir, base + ext)
            if os.path.isfile(cand):
                found = cand
                break
        if found is None:
            stats["missing"] += 1
            print("  [MISS] %-10s %s (no match in RTP)" % (key, name))
            continue
        dp = os.path.join(dest_dir, os.path.basename(found))
        if copy_one(found, dp, dry_run):
            stats["copied"] += 1
            if dry_run:
                print("  [DRY] %-10s %s -> %s" % (key, name, dp))
        else:
            stats["error"] += 1


def resolve_audio(rtp_root, key, names, cfg, dry_run, stats):
    src_dir = find_first_existing(rtp_root, cfg["rtp_dirs"])
    dest_dir = os.path.join(SCRIPT_DIR, cfg["dest"])
    if not src_dir:
        stats["no_src"] += 1
        print("  [WARN] RTP audio source dir not found for '%s' (tried %s)"
              % (key, ", ".join(cfg["rtp_dirs"])))
        return
    if not names:
        for fn in sorted(os.listdir(src_dir)):
            sp = os.path.join(src_dir, fn)
            if os.path.isfile(sp):
                dp = os.path.join(dest_dir, fn)
                if copy_one(sp, dp, dry_run):
                    stats["copied"] += 1
        return
    for name in names:
        base = os.path.splitext(name)[0]
        matches = []
        for ext in cfg["exts"]:
            cand = os.path.join(src_dir, base + ext)
            if os.path.isfile(cand):
                matches.append(cand)
        if not matches:
            stats["missing"] += 1
            print("  [MISS] audio/%-3s %s (no match in RTP)" % (key, name))
            continue
        for mf in matches:  # copy every encoding (e.g. .ogg + .m4a)
            dp = os.path.join(dest_dir, os.path.basename(mf))
            if copy_one(mf, dp, dry_run):
                stats["copied"] += 1
                if dry_run:
                    print("  [DRY] audio/%-3s %s -> %s" % (key, name, dp))
            else:
                stats["error"] += 1


def main():
    ap = argparse.ArgumentParser(description="Copy missing RTP assets into the Monline MV project.")
    ap.add_argument("--rtp", required=True, help="RTP root directory (contains Graphics/ + Audio/ or img/ + audio/)")
    ap.add_argument("--dry-run", action="store_true", help="only print what would be copied")
    ap.add_argument("--missing", default=os.path.join(SCRIPT_DIR, "missing_assets.json"),
                    help="path to missing_assets.json")
    ap.add_argument("--project", default=os.path.join(SCRIPT_DIR, "mv_project"),
                    help="path to the mv_project directory")
    args = ap.parse_args()

    if not os.path.isdir(args.rtp):
        print("[ERROR] RTP root not found: %s" % args.rtp, file=sys.stderr)
        sys.exit(2)
    if not os.path.isfile(args.missing):
        print("[ERROR] missing_assets.json not found: %s" % args.missing, file=sys.stderr)
        sys.exit(2)

    with open(args.missing, encoding="utf-8") as f:
        missing = json.load(f)

    # make destination paths resolve relative to --project when given
    global GRAPHICS, AUDIO
    if os.path.abspath(args.project) != os.path.join(SCRIPT_DIR, "mv_project"):
        for c in GRAPHICS.values():
            c["dest"] = os.path.join(args.project, os.path.relpath(c["dest"], "mv_project"))
        for c in AUDIO.values():
            c["dest"] = os.path.join(args.project, os.path.relpath(c["dest"], "mv_project"))

    stats = {"copied": 0, "missing": 0, "error": 0, "no_src": 0}
    print("RTP root : %s" % args.rtp)
    print("Project  : %s" % args.project)
    print("Dry-run  : %s" % args.dry_run)
    print("-" * 60)

    for key, cfg in GRAPHICS.items():
        names = missing.get(key, [])
        print("[%s] %d item(s)" % (key, len(names)))
        resolve_graphics(args.rtp, key, names, cfg, args.dry_run, stats)

    for key, cfg in AUDIO.items():
        names = missing.get("audio", {}).get(key, [])
        print("[audio/%s] %d referenced name(s)" % (key, len(names)))
        resolve_audio(args.rtp, key, names, cfg, args.dry_run, stats)

    print("-" * 60)
    print("Summary: copied=%d  not_in_rtp=%d  errors=%d  no_rtp_src=%d"
          % (stats["copied"], stats["missing"], stats["error"], stats["no_src"]))
    if args.dry_run:
        print("(dry-run: no files were written)")


if __name__ == "__main__":
    main()
