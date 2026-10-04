# -*- coding: utf-8 -*-
"""Audit and port the assets a VX Ace -> MV conversion still needs.

Why this script exists
----------------------
The Monline project was converted from RPG Maker VX Ace to RPG Maker MV.
Everything the original shipped inside ``Game.rgss3a`` was carried over, but the
original *also* referenced the **VX Ace Runtime Package (RTP)** and a handful of
files that simply are not inside the archive.  RPG Maker MV reacts to a missing
image by showing its "Loading Error" screen and stopping the scene, i.e. the
game appears to crash.

This script
-----------
1. re-scans every ``data/*.json`` for the asset names the game actually
   references (actors, enemies, tilesets, animations, maps, system, dialogue
   command parameters ...),
2. resolves each name against three sources,
3. copies what it finds into the project, **upscaling VX Ace graphics x1.5 with
   nearest-neighbour** so they match the rest of the already converted artwork
   (VX Ace uses a 32 px grid, MV a 48 px grid -> 32 * 1.5 = 48),
4. writes ``missing_assets.json`` (the audit) and ``port_report.json`` (the
   result), plus ``MonlineAudioExt.js`` -- an extension-override plugin for the
   audio files that are not ``.ogg`` (MV only ever asks for ``.ogg``/``.m4a``).

Usage
-----
    python port_assets.py                     # full run on ./Monline-MV
    python port_assets.py --scan-only         # audit only
    python port_assets.py --dry-run           # show, write nothing
    python port_assets.py --project <dir>
    python port_assets.py --prefer mv         # use the MV RTP at native scale
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from collections import OrderedDict, defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------------------
# Sources, in priority order
# --------------------------------------------------------------------------
SOURCE_ROOTS = OrderedDict([
    ("game",  r"G:/新建文件夹 (20)/Monline 0.9.8"),
    ("vxace", r"C:/Program Files (x86)/Common Files/Enterbrain/RGSS3/RPGVXAce"),
    ("mv",    r"G:/SteamLibrary/steamapps/common/RPG Maker MV/NewData"),
])

# category -> (destination folder under the project, {source: relative dir})
GRAPHICS = OrderedDict([
    ("tilesets",     ("img/tilesets",     {"game": "Graphics/Tilesets",     "vxace": "Graphics/Tilesets",     "mv": "img/tilesets"})),
    ("characters",   ("img/characters",   {"game": "Graphics/Characters",   "vxace": "Graphics/Characters",   "mv": "img/characters"})),
    ("faces",        ("img/faces",        {"game": "Graphics/Faces",        "vxace": "Graphics/Faces",        "mv": "img/faces"})),
    ("enemies",      ("img/enemies",      {"game": "Graphics/Battlers",     "vxace": "Graphics/Battlers",     "mv": "img/enemies"})),
    ("animations",   ("img/animations",   {"game": "Graphics/Animations",   "vxace": "Graphics/Animations",   "mv": "img/animations"})),
    ("parallaxes",   ("img/parallaxes",   {"game": "Graphics/Parallaxes",   "vxace": "Graphics/Parallaxes",   "mv": "img/parallaxes"})),
    ("pictures",     ("img/pictures",     {"game": "Graphics/Pictures",     "vxace": "Graphics/Pictures",     "mv": "img/pictures"})),
    ("fogs",         ("img/fogs",         {"game": "Graphics/Fogs",         "vxace": "Graphics/Fogs",         "mv": "img/fogs"})),
    ("titles1",      ("img/titles1",      {"game": "Graphics/Titles1",      "vxace": "Graphics/Titles1",      "mv": "img/titles1"})),
    ("titles2",      ("img/titles2",      {"game": "Graphics/Titles2",      "vxace": "Graphics/Titles2",      "mv": "img/titles2"})),
    ("battlebacks1", ("img/battlebacks1", {"game": "Graphics/Battlebacks1", "vxace": "Graphics/Battlebacks1", "mv": "img/battlebacks1"})),
    ("battlebacks2", ("img/battlebacks2", {"game": "Graphics/Battlebacks2", "vxace": "Graphics/Battlebacks2", "mv": "img/battlebacks2"})),
])

AUDIO = OrderedDict([
    ("bgm", ("audio/bgm", {"game": "Audio/BGM", "vxace": "Audio/BGM", "mv": "audio/bgm"})),
    ("bgs", ("audio/bgs", {"game": "Audio/BGS", "vxace": "Audio/BGS", "mv": "audio/bgs"})),
    ("me",  ("audio/me",  {"game": "Audio/ME",  "vxace": "Audio/ME",  "mv": "audio/me"})),
    ("se",  ("audio/se",  {"game": "Audio/SE",  "vxace": "Audio/SE",  "mv": "audio/se"})),
])

IMG_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp")
AUD_EXTS = (".ogg", ".m4a", ".wav", ".mp3", ".mid", ".midi", ".mp4")
KNOWN_EXTS = IMG_EXTS + AUD_EXTS

# How much a VX Ace graphic has to grow to land on MV's grid.
# Measured against the artwork the converter already produced, so that the
# assets added here sit on exactly the same scale as the rest of the project.
#
#   tilesets     512 ->  768   (32px tile -> 48px tile)          x1.5
#   characters   384 ->  576   (32px cell -> 48px cell)          x1.5
#   faces        384 ->  576   (96px cell -> 144px cell)         x1.5
#   enemies      208 ->  312   (VX Ace Battlers)                 x1.5
#   animations   960 ->  960   already 5 x 192, identical to MV  x1.0
#   parallaxes   544 ->  816   = MV screen width                 x1.5
#   titles1/2    544 ->  816                                     x1.5
#   battlebacks  580 ->  870   (MV rescales these to the screen) x1.5
#   pictures     544 ->  544   converter kept them at native size x1.0
#   fogs         544 ->  544   ditto                              x1.0
SCALE_BY_CATEGORY = {
    "tilesets": 1.5,
    "characters": 1.5,
    "faces": 1.5,
    "enemies": 1.5,
    "animations": 1.0,
    "parallaxes": 1.5,
    "pictures": 1.0,
    "fogs": 1.0,
    "titles1": 1.5,
    "titles2": 1.5,
    "battlebacks1": 1.5,
    "battlebacks2": 1.5,
}

SCALE_SOURCES = ("vxace",)   # only the VX Ace RTP needs upscaling


# --------------------------------------------------------------------------
# 1. Scan the project data for referenced asset names
# --------------------------------------------------------------------------
AUDIO_COMMANDS = {
    241: "bgm",   # Play BGM
    245: "bgs",   # Play BGS
    249: "me",    # Play ME
    250: "se",    # Play SE
    132: "bgm",   # Change Battle BGM
    133: "me",    # Change Victory ME
    139: "me",    # Change Defeat ME
}


def add_image(need, cat, name):
    if isinstance(name, str) and name.strip():
        need["images"][cat].add(name.strip())


def add_audio(need, cat, name):
    if isinstance(name, str) and name.strip():
        need["audio"][cat].add(name.strip())


def scan_event_commands(need, commands):
    if not isinstance(commands, list):
        return
    for cmd in commands:
        if not isinstance(cmd, dict):
            continue
        code = cmd.get("code")
        params = cmd.get("parameters") or []
        if code in AUDIO_COMMANDS and params and isinstance(params[0], dict):
            add_audio(need, AUDIO_COMMANDS[code], params[0].get("name"))
        elif code == 204:  # Change Map Settings
            if len(params) > 0:
                add_image(need, "parallaxes", params[0])
            if len(params) > 2:
                add_image(need, "fogs", params[2])
            if len(params) > 4:
                add_image(need, "battlebacks1", params[4])
            if len(params) > 5:
                add_image(need, "battlebacks2", params[5])
        elif code == 283:  # Change Battle Back
            if len(params) > 0:
                add_image(need, "battlebacks1", params[0])
            if len(params) > 1:
                add_image(need, "battlebacks2", params[1])
        elif code == 322:  # Change Actor Images
            if len(params) > 1:
                add_image(need, "characters", params[1])
            if len(params) > 3:
                add_image(need, "faces", params[3])
            if len(params) > 5:
                add_image(need, "enemies", params[5])
        elif code == 231:  # Show Picture
            if len(params) > 1:
                add_image(need, "pictures", params[1])
        elif code == 356:  # plugin command / script with image-ish strings
            pass


def scan_data(data_dir):
    need = {"images": defaultdict(set), "audio": defaultdict(set)}
    if not os.path.isdir(data_dir):
        return need

    for fn in sorted(os.listdir(data_dir)):
        if not fn.lower().endswith(".json"):
            continue
        path = os.path.join(data_dir, fn)
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        stem = fn[:-5]

        if stem.startswith("Map") and stem[3:].isdigit():
            if isinstance(data, dict):
                # The map header names a parallax AND both battlebacks.  Only
                # the parallax used to be collected here, so every map-level
                # `battleback1Name` / `battleback2Name` was never requested and
                # 13 battlebacks ended up missing at run time while the smoke
                # test still reported MISSING_ASSETS 0 (it only walks the paths
                # it happens to take).  `System.json` covers the *default*
                # battleback, not the per-map override.
                for k, cat in (("parallaxName", "parallaxes"),
                               ("battleback1Name", "battlebacks1"),
                               ("battleback2Name", "battlebacks2")):
                    add_image(need, cat, data.get(k))
                for k in ("bgm", "bgs"):
                    v = data.get(k)
                    if isinstance(v, dict):
                        add_audio(need, k, v.get("name"))
                for ev in (data.get("events") or []):
                    if isinstance(ev, dict):
                        for page in (ev.get("pages") or []):
                            if isinstance(page, dict):
                                img = page.get("image") or {}
                                add_image(need, "characters", img.get("characterName"))
                                add_image(need, "faces", img.get("faceName"))
                                add_image(need, "enemies", img.get("battlerName"))
                                add_image(need, "tilesets", img.get("tileName"))
                                scan_event_commands(need, page.get("list"))
            continue

        if stem == "CommonEvents" and isinstance(data, list):
            for ce in data:
                if isinstance(ce, dict):
                    scan_event_commands(need, ce.get("list"))
            continue

        if stem == "Troops" and isinstance(data, list):
            for tr in data:
                if isinstance(tr, dict):
                    for page in (tr.get("pages") or []):
                        if isinstance(page, dict):
                            scan_event_commands(need, page.get("list"))
            continue

        if stem == "Actors" and isinstance(data, list):
            for a in data:
                if isinstance(a, dict):
                    add_image(need, "characters", a.get("characterName"))
                    add_image(need, "faces", a.get("faceName"))
                    add_image(need, "enemies", a.get("battlerName"))
            continue

        if stem == "Enemies" and isinstance(data, list):
            for e in data:
                if isinstance(e, dict):
                    add_image(need, "enemies", e.get("battlerName"))
            continue

        if stem == "Animations" and isinstance(data, list):
            for a in data:
                if isinstance(a, dict):
                    add_image(need, "animations", a.get("animation1Name"))
                    add_image(need, "animations", a.get("animation2Name"))
            continue

        if stem == "Tilesets" and isinstance(data, list):
            for t in data:
                if isinstance(t, dict):
                    for n in (t.get("tilesetNames") or []):
                        add_image(need, "tilesets", n)
            continue

        if stem == "System" and isinstance(data, dict):
            for k, cat in (("title1Name", "titles1"), ("title2Name", "titles2"),
                           ("battleback1Name", "battlebacks1"), ("battleback2Name", "battlebacks2"),
                           ("battlerName", "enemies")):
                add_image(need, cat, data.get(k))
            add_image(need, "characters", data.get("boat", {}).get("characterName") if isinstance(data.get("boat"), dict) else None)
            add_image(need, "characters", data.get("ship", {}).get("characterName") if isinstance(data.get("ship"), dict) else None)
            add_image(need, "characters", data.get("airship", {}).get("characterName") if isinstance(data.get("airship"), dict) else None)
            for k, cat in (("titleBgm", "bgm"), ("battleBgm", "bgm"),
                           ("victoryMe", "me"), ("defeatMe", "me"), ("gameoverMe", "me")):
                v = data.get(k)
                if isinstance(v, dict):
                    add_audio(need, cat, v.get("name"))
            for s in (data.get("sounds") or []):
                if isinstance(s, dict):
                    add_audio(need, "se", s.get("name"))
            continue

    return need


# --------------------------------------------------------------------------
# 2. Source indexes
# --------------------------------------------------------------------------
def strip_exts(name):
    """X.wav.wav -> X ;  'Boss - Lich' -> 'Boss - Lich'."""
    stem = name
    guard = 0
    while guard < 4:
        root, ext = os.path.splitext(stem)
        if ext.lower() in KNOWN_EXTS and root:
            stem = root
            guard += 1
        else:
            break
    return stem


class SourceIndex(object):
    """Basename lookup: normalized stem -> real file name."""

    def __init__(self, root, rel_dirs, exts):
        self.dir = None
        self.exts = exts
        self.files = {}          # stem(lower) -> real file name
        self._names = []         # (stem, name)
        for rel in rel_dirs:
            d = os.path.join(root, *rel.split("/"))
            if os.path.isdir(d):
                self.dir = d
                break
        if self.dir:
            for fn in os.listdir(self.dir):
                if os.path.splitext(fn)[1].lower() in exts:
                    self.files.setdefault(strip_exts(fn).lower(), fn)

    @property
    def ok(self):
        return self.dir is not None

    def find(self, base):
        return self.files.get(strip_exts(base).lower())


def build_indexes(kind):
    """kind is 'images' or 'audio' -> {category: {source: SourceIndex}}"""
    table = GRAPHICS if kind == "images" else AUDIO
    exts = IMG_EXTS if kind == "images" else AUD_EXTS
    out = OrderedDict()
    for cat, (_dest, srcs) in table.items():
        out[cat] = OrderedDict()
        for src, rel in srcs.items():
            root = SOURCE_ROOTS.get(src)
            if not root or not os.path.isdir(root):
                continue
            out[cat][src] = SourceIndex(root, [rel], exts)
    return out


def project_files(folder):
    """Set of stems already present in a project folder."""
    got = set()
    if not os.path.isdir(folder):
        return got
    for fn in os.listdir(folder):
        if os.path.splitext(fn)[1].lower() in KNOWN_EXTS:
            got.add(strip_exts(fn).lower())
    return got


# --------------------------------------------------------------------------
# 3. Upscale helper
# --------------------------------------------------------------------------
def upscale_png(src, dst, factor):
    from PIL import Image
    with Image.open(src) as im:
        im = im.convert("RGBA")
        w = int(round(im.width * factor))
        h = int(round(im.height * factor))
        im = im.resize((w, h), Image.NEAREST)
        im.save(dst, "PNG", optimize=True)
        return (im.width, im.height)


# --------------------------------------------------------------------------
# 4. Main
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Audit + port missing VX Ace assets into the MV project.")
    ap.add_argument("--project", default=os.path.join(SCRIPT_DIR, "Monline-MV"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--scan-only", action="store_true")
    ap.add_argument("--prefer", choices=("vxace", "mv", "auto"), default="vxace",
                    help="which RTP to prefer when several have the file "
                         "(vxace = upscaled x1.5, mv = native 48px, auto = first hit)")
    args = ap.parse_args()

    project = os.path.abspath(args.project)
    data_dir = os.path.join(project, "data")
    if not os.path.isdir(data_dir):
        print("[ERROR] no data/ in %s" % project, file=sys.stderr)
        return 2

    print("project : %s" % project)
    print("scan    : %s" % data_dir)

    need = scan_data(data_dir)
    ninfo = OrderedDict()
    for cat in GRAPHICS:
        names = sorted(need["images"].get(cat, ()))
        ninfo[cat] = names
    ainfo = OrderedDict()
    for cat in AUDIO:
        ainfo[cat] = sorted(need["audio"].get(cat, ()))

    total_refs = sum(len(v) for v in ninfo.values()) + sum(len(v) for v in ainfo.values())
    print("referenced asset names: %d" % total_refs)

    # ---- resolve ------------------------------------------------------------
    img_idx = build_indexes("images")
    aud_idx = build_indexes("audio")

    audit = OrderedDict()
    for cat, names in ninfo.items():
        present = project_files(os.path.join(project, "img", cat))
        miss = [n for n in names if strip_exts(n).lower() not in present]
        if miss:
            audit[cat] = miss
    for cat, names in ainfo.items():
        present = project_files(os.path.join(project, "audio", cat))
        miss = [n for n in names if strip_exts(n).lower() not in present]
        if miss:
            audit[cat] = miss

    audit_audio = OrderedDict((k, v) for k, v in audit.items() if k in AUDIO)
    audit_images = OrderedDict((k, v) for k, v in audit.items() if k in GRAPHICS)
    print("missing: %d image name(s) in %d categor(ies), %d audio name(s) in %d categor(ies)"
          % (sum(len(v) for v in audit_images.values()), len(audit_images),
             sum(len(v) for v in audit_audio.values()), len(audit_audio)))

    # write the audit json
    audit_json = OrderedDict()
    for cat in GRAPHICS:
        if cat in audit_images:
            audit_json[cat] = audit_images[cat]
    audit_json["audio"] = OrderedDict((k, v) for k, v in audit_audio.items())
    if not args.dry_run:
        with open(os.path.join(SCRIPT_DIR, "missing_assets.json"), "w", encoding="utf-8") as f:
            json.dump(audit_json, f, ensure_ascii=False, indent=2)
        print("wrote missing_assets.json")

    if args.scan_only:
        for cat, names in audit.items():
            print("  [%s] %d" % (cat, len(names)))
        return 0

    # ---- port ---------------------------------------------------------------
    stats = defaultdict(int)
    unresolved = OrderedDict()
    audio_ext = OrderedDict()
    copied_list = []
    src_tally = defaultdict(int)

    order = list(GRAPHICS) if args.prefer == "vxace" else None

    def source_order(idx):
        keys = ["game"] + (["vxace", "mv"] if args.prefer in ("vxace", "auto", "mv") else [])
        if args.prefer == "mv":
            keys = ["game", "mv", "vxace"]
        elif args.prefer == "auto":
            keys = ["game", "vxace", "mv"]
        else:
            keys = ["game", "vxace", "mv"]
        return [k for k in keys if k in idx]

    def do_images(cat, names):
        dest_rel, _srcs = GRAPHICS[cat]
        dest_dir = os.path.join(project, *dest_rel.split("/"))
        idx = img_idx.get(cat, {})
        for name in names:
            hit = None
            for src in source_order(idx):
                si = idx[src]
                if not si.ok:
                    continue
                fn = si.find(name)
                if fn:
                    hit = (src, si.dir, fn)
                    break
            if not hit:
                unresolved.setdefault(cat, []).append(name)
                stats["unresolved"] += 1
                continue
            src, sdir, fn = hit
            spath = os.path.join(sdir, fn)
            base = strip_exts(fn)
            ext = os.path.splitext(fn)[1].lower()
            factor = SCALE_BY_CATEGORY.get(cat, 1.0) if src in SCALE_SOURCES else 1.0
            if factor != 1.0 and ext == ".png":
                out = base + ".png"
                dpath = os.path.join(dest_dir, out)
                if args.dry_run:
                    stats["would_copy"] += 1
                else:
                    os.makedirs(dest_dir, exist_ok=True)
                    try:
                        upscale_png(spath, dpath, factor)
                        stats["copied_scaled"] += 1
                    except Exception as e:
                        print("  [ERR] %s: %s" % (fn, e))
                        stats["error"] += 1
                        continue
                copied_list.append({"cat": cat, "name": name, "from": src, "file": out,
                                    "scale": factor, "src": spath})
                src_tally[src] += 1
            else:
                out = strip_exts(fn) + ext
                dpath = os.path.join(dest_dir, out)
                if args.dry_run:
                    stats["would_copy"] += 1
                else:
                    os.makedirs(dest_dir, exist_ok=True)
                    try:
                        shutil.copy2(spath, dpath)
                        stats["copied"] += 1
                    except Exception as e:
                        print("  [ERR] %s: %s" % (fn, e))
                        stats["error"] += 1
                        continue
                copied_list.append({"cat": cat, "name": name, "from": src, "file": out,
                                    "scale": 1.0, "src": spath})
                src_tally[src] += 1

    def do_audio(cat, names):
        dest_rel, _srcs = AUDIO[cat]
        dest_dir = os.path.join(project, *dest_rel.split("/"))
        idx = aud_idx.get(cat, {})
        for name in names:
            hit = None
            for src in source_order(idx):
                si = idx[src]
                if not si.ok:
                    continue
                fn = si.find(name)
                if fn:
                    hit = (src, si.dir, fn)
                    break
            if not hit:
                unresolved.setdefault("audio/" + cat, []).append(name)
                stats["unresolved"] += 1
                continue
            src, sdir, fn = hit
            spath = os.path.join(sdir, fn)
            out = strip_exts(fn) + os.path.splitext(fn)[1].lower()
            dpath = os.path.join(dest_dir, out)
            if args.dry_run:
                stats["would_copy"] += 1
            else:
                os.makedirs(dest_dir, exist_ok=True)
                try:
                    shutil.copy2(spath, dpath)
                    stats["copied"] += 1
                except Exception as e:
                    print("  [ERR] %s: %s" % (fn, e))
                    stats["error"] += 1
                    continue
            ext = os.path.splitext(out)[1].lower()
            if ext != ".ogg":
                audio_ext["%s/%s" % (cat, strip_exts(fn))] = ext
            copied_list.append({"cat": "audio/" + cat, "name": name, "from": src, "file": out,
                                "scale": 1.0, "src": spath})
            src_tally[src] += 1

    for cat in GRAPHICS:
        names = audit_images.get(cat, [])
        if names:
            print("[img/%-12s] %d to port" % (cat, len(names)))
            do_images(cat, names)
    for cat in AUDIO:
        names = audit_audio.get(cat, [])
        if names:
            print("[audio/%-8s] %d to port" % (cat, len(names)))
            do_audio(cat, names)

    # ---- extension-override plugin -----------------------------------------
    plugin_txt = None
    if audio_ext:
        lines = ["// Generated by port_assets.py -- do not edit by hand.",
                 "// Tells AudioManager the real extension of files that are not .ogg.",
                 "(function() {",
                 "    var EXT = {"]
        for k, v in sorted(audio_ext.items()):
            lines.append('        %s: %s,' % (json.dumps(k, ensure_ascii=False), json.dumps(v)))
        lines += ["    };",
                  "    var _createBuffer = AudioManager.createBuffer;",
                  "    AudioManager.createBuffer = function(folder, name) {",
                  "        var ext = EXT[folder + '/' + name];",
                  "        if (ext) {",
                  "            var url = this._path + folder + '/' + encodeURIComponent(name) + ext;",
                  "            return new WebAudio(url);",
                  "        }",
                  "        return _createBuffer.call(this, folder, name);",
                  "    };",
                  "})();",
                  ""]
        plugin_txt = "\n".join(lines)

    report = OrderedDict([
        ("project", project),
        ("prefer", args.prefer),
        ("scale_by_category", dict(SCALE_BY_CATEGORY)),
        ("stats", dict(stats)),
        ("by_source", dict(src_tally)),
        ("audio_ext_overrides", len(audio_ext)),
        ("unresolved", {k: v for k, v in unresolved.items()}),
        ("files", copied_list),
    ])

    if not args.dry_run:
        with open(os.path.join(SCRIPT_DIR, "port_report.json"), "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        if plugin_txt:
            pdir = os.path.join(project, "js", "plugins")
            os.makedirs(pdir, exist_ok=True)
            with open(os.path.join(pdir, "MonlineAudioExt.js"), "w", encoding="utf-8", newline="\n") as f:
                f.write(plugin_txt)
            print("wrote js/plugins/MonlineAudioExt.js (%d override(s))" % len(audio_ext))

    print("-" * 62)
    print("copied(upscaled)=%d copied(as-is)=%d would-copy=%d errors=%d unresolved=%d"
          % (stats["copied_scaled"], stats["copied"], stats["would_copy"],
             stats["error"], stats["unresolved"]))
    print("by source: %s" % dict(src_tally))
    if unresolved:
        for k, v in unresolved.items():
            print("  unresolved [%s] %d: %s" % (k, len(v), ", ".join(v[:6])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
