# -*- coding: utf-8 -*-
"""Audit every 'script' payload that came from Ruby.

Two places can carry Ruby source into the MV project:

* Event command ``355`` (with continuations ``655``) - handed to
  ``Game_Interpreter.command355``.
* Move-route command ``45`` (inside the list of a ``205`` "Set Move Route"
  command) - handed to ``Game_Character.processMoveCommand``.

Both end up in ``eval()``.  Anything that is valid Ruby but invalid JS throws
and (depending on the call site) can stop the game, so we need a complete
inventory before writing the translator.

Usage:
    python analyze_scripts.py            # summary
    python analyze_scripts.py --dump 40  # print the 40 most common snippets
"""
from __future__ import annotations

import argparse
import collections
import glob
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PROJECT = os.path.join(SCRIPT_DIR, "Monline-MV")

# Ruby-only constructs that can never survive eval() as JavaScript.
RUBY_MARKERS = [
    ("instance_var", re.compile(r"(?<![\w.])@[a-zA-Z_]\w*")),
    ("global_var", re.compile(r"\$[a-zA-Z_]\w*")),
    ("symbol", re.compile(r"(?<![\w:])[:,][a-zA-Z_]\w*(?![\w:])")),
    ("hash_rocket", re.compile(r"=>")),
    ("nil", re.compile(r"\bnil\b")),
    ("def_end", re.compile(r"^\s*def\s")),
    ("ruby_block", re.compile(r"\bdo\s*\|")),
    ("if_modifier", re.compile(r"\bif\b.*\bthen\b|\bunless\b")),
    ("unless", re.compile(r"\bunless\b")),
    ("puts", re.compile(r"\bputs\b")),
    ("rgss_call", re.compile(r"\bvx_|\brgss|自|代入")),
]

# Ruby method names that a JS shim could plausibly provide.
KNOWN_RUBY_CALLS = re.compile(r"\b([a-z_]\w*[!?]?)\s*\(")


def iter_commands(data, filename):
    """Yield (where, code, params) for every command in every list."""
    if isinstance(data, dict) and "events" in data:
        for ev in data.get("events") or []:
            if not ev:
                continue
            for pi, page in enumerate(ev.get("pages") or []):
                if not page:
                    continue
                where = "%s ev%d p%d" % (filename, ev.get("id"), pi)
                for cmd in (page.get("list") or []):
                    if cmd:
                        yield where, cmd, True
    elif isinstance(data, list):
        for i, obj in enumerate(data):
            if not isinstance(obj, dict):
                continue
            where = "%s #%d" % (filename, i)
            for cmd in (obj.get("list") or []):
                if cmd:
                    yield where, cmd, True


def walk_scripts(project):
    """Return (event_scripts, move_scripts) lists of raw source strings."""
    ev_scripts = collections.Counter()
    mv_scripts = collections.Counter()
    ev_files = collections.Counter()
    mv_files = collections.Counter()
    for path in sorted(glob.glob(os.path.join(project, "data", "*.json"))):
        name = os.path.basename(path)[:-5]
        if name in ("System", "Tilesets"):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        for where, cmd, _ in iter_commands(data, name):
            code = cmd.get("code")
            params = cmd.get("parameters") or []
            if code == 355 and params:
                src = params[0]
                if isinstance(src, str) and src.strip():
                    ev_scripts[src] += 1
                    ev_files[where.split()[0]] += 1
            elif code == 205 and len(params) >= 2:
                route = params[1]
                if isinstance(route, dict):
                    for sub in (route.get("list") or []):
                        if sub and sub.get("code") == 45:
                            sp = (sub.get("parameters") or [None])[0]
                            if isinstance(sp, str) and sp.strip():
                                mv_scripts[sp] += 1
                                mv_files[where.split()[0]] += 1
    return ev_scripts, mv_scripts, ev_files, mv_files


def classify(src):
    hits = []
    for label, rx in RUBY_MARKERS:
        if rx.search(src):
            hits.append(label)
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=DEFAULT_PROJECT)
    ap.add_argument("--dump", type=int, default=0, help="print N most common snippets")
    ap.add_argument("--only", choices=["all", "ruby", "clean"], default="all")
    args = ap.parse_args()

    ev, mv, evf, mvf = walk_scripts(args.project)
    print("=== %s ===" % args.project)
    print("event 355 scripts : %d unique / %d uses across %d files"
          % (len(ev), sum(ev.values()), len(evf)))
    print("moveroute 45      : %d unique / %d uses across %d files"
          % (len(mv), sum(mv.values()), len(mvf)))

    for label, ctr in (("EVENT-355", ev), ("MOVEROUTE-45", mv)):
        buckets = collections.Counter()
        for src, n in ctr.items():
            buckets["+".join(classify(src)) or "clean"] += n
        print("\n-- %s pattern buckets --" % label)
        for k, v in buckets.most_common():
            print("   %-40s %d" % (k, v))

    if args.dump:
        for label, ctr in (("EVENT-355", ev), ("MOVEROUTE-45", mv)):
            print("\n===== %s top %d =====" % (label, args.dump))
            for src, n in ctr.most_common(args.dump):
                hits = classify(src)
                if args.only == "ruby" and not hits:
                    continue
                if args.only == "clean" and hits:
                    continue
                flat = src.replace("\n", "\\n")
                if len(flat) > 150:
                    flat = flat[:150] + "..."
                print("  [%3d] (%s) %s" % (n, ",".join(hits) or "-", flat))
    return 0


if __name__ == "__main__":
    sys.exit(main())
