# -*- coding: utf-8 -*-
"""Compare the converted database against a clean MV project's schema.

Each VX Ace -> MV converter bug found so far had the same shape: a required MV
key was missing or renamed, so the engine dereferenced `undefined` at runtime
and froze the game.

    System.json   : terms.messages             (fix_system.py)
    Actors.json   : traits                     (fix_traits.py)
    Map*.json     : pages[].image, not graphic (fix_pageimage.py)
    Troops.json   : pages[].conditions         (fix_troops.py)
    Classes.json  : params transposed          (fix_tables.py)

Rather than hunting these one crash at a time, this script derives the expected
key set from RPG Maker MV's own NewData sample project and reports every key the
converted data is missing - then guesses the rename (singular/plural, case).

Usage:
    python schema_check.py                 # report only
    python schema_check.py --json out.json # machine readable
"""
from __future__ import annotations

import argparse
import collections
import difflib
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONVERTED = os.path.join(HERE, "Monline-MV", "data")
# A pristine MV project shipped with the editor - the authoritative schema.
REFERENCES = [
    r"G:/SteamLibrary/steamapps/common/RPG Maker MV/NewData/data",
    r"C:/Program Files (x86)/Steam/steamapps/common/RPG Maker MV/NewData/data",
]

# Keys whose *value* shape differs by design and should not be compared.
IGNORE_KEYS = {"id"}


def find_reference():
    for d in REFERENCES:
        if os.path.isdir(d) and os.path.isfile(os.path.join(d, "Troops.json")):
            return d
    return None


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def walk(obj, path, out):
    """Collect `path -> frozenset(keys)` for every dict encountered."""
    if isinstance(obj, dict):
        if obj:
            out[path].update(obj.keys())
        for k, v in obj.items():
            walk(v, path + "." + k, out)
    elif isinstance(obj, list):
        for item in obj:
            walk(item, path + "[]", out)


def keyset(data):
    out = collections.defaultdict(set)
    walk(data, "$", out)
    return out


def singular_plural_guess(name, available):
    cands = set()
    if name.endswith("s"):
        cands.add(name[:-1])
    else:
        cands.add(name + "s")
    cands.add(name + "es")
    if name.endswith("es"):
        cands.add(name[:-2])
    # snake_case -> camelCase and back
    camel = re.sub(r"_(\w)", lambda m: m.group(1).upper(), name)
    cands.add(camel)
    snake = re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
    cands.add(snake)
    hits = [c for c in cands if c in available]
    if hits:
        return hits
    return difflib.get_close_matches(name, list(available), n=2, cutoff=0.75)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="write full report as JSON here")
    ap.add_argument("--converted", default=CONVERTED)
    args = ap.parse_args()

    ref_dir = find_reference()
    if not ref_dir:
        print("[FATAL] no MV reference project found")
        return 2
    print("reference : %s" % ref_dir)
    print("converted : %s\n" % args.converted)

    report = {}
    total_missing = 0
    checked = 0

    for ref_path in sorted(glob.glob(os.path.join(ref_dir, "*.json"))):
        name = os.path.basename(ref_path)
        conv_path = os.path.join(args.converted, name)
        if not os.path.isfile(conv_path):
            print("%-18s [no converted counterpart - skipped]" % name)
            continue
        ref = load(ref_path)
        conv = load(conv_path)
        if ref is None or conv is None:
            print("%-18s [unreadable]" % name)
            continue
        checked += 1
        rk = keyset(ref)
        ck = keyset(conv)

        missing = []
        for path in sorted(rk):
            ref_keys = rk[path] - IGNORE_KEYS
            conv_keys = ck.get(path, set())
            gone = sorted(ref_keys - conv_keys)
            if not gone:
                continue
            # Is this object even the same kind of thing? Compare only when the
            # converted side has *some* overlap or the path exists at all.
            if path not in ck and path != "$":
                continue
            for g in gone:
                guess = singular_plural_guess(g, conv_keys)
                missing.append({"path": path, "key": g, "guess": guess})

        if missing:
            total_missing += len(missing)
            report[name] = missing
            print("=== %s : %d missing key(s) ===" % (name, len(missing)))
            shown = collections.OrderedDict()
            for m in missing:
                shown.setdefault((m["path"], m["key"], tuple(m["guess"])), 0)
                shown[(m["path"], m["key"], tuple(m["guess"]))] += 1
            for (path, key, guess), n in list(shown.items())[:40]:
                hint = ("  -> rename to: %s" % ", ".join(guess)) if guess else ""
                print("    %-40s missing '%s'%s" % (path, key, hint))
            print()
        else:
            print("%-18s OK (schema matches)" % name)

    print("-" * 60)
    print("files checked      : %d" % checked)
    print("missing keys total : %d" % total_missing)
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
        print("report written     : %s" % args.json)
    return 1 if total_missing else 0


if __name__ == "__main__":
    sys.exit(main())
