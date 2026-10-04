#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Register MonlineGameOver in js/plugins.js with its default parameters.

Textual insertion on purpose - the file is hand-maintained generated output
and is not guaranteed to be strictly parseable, so we never round-trip it.
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRY = {
    "name": "MonlineGameOver",
    "status": True,
    "description": "Port of DT's GameOver + (0254.rb): Load / To Title / Quit command window on the GameOver screen, plus optional reload-last-save (TSF Dungeon Kath_GameOver)",
    "parameters": {
        "Command Window X": "180",
        "Command Window Y": "300",
        "Command Window Width": "160",
        "Show Command Window": "true",
        "Disable Load If No Save": "true",
        "Party Death Common Event ID": "",
        "Show Game Over Scene": "true",
        "Reload Last Save": "false",
        "After Game Over Common Event ID": "",
    },
}
LINE = json.dumps(ENTRY, ensure_ascii=False, separators=(",", ":"))


def patch(path):
    with io.open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    idx = text.rfind("];")
    if idx < 0:
        raise SystemExit("no closing ]; in %s" % path)
    body = text[:idx].rstrip()
    tail = text[idx:]
    lines = body.split("\n")
    # Drop any previous registration of the same plugin.
    kept = []
    removed = 0
    for ln in lines:
        if '"MonlineGameOver"' in ln:
            removed += 1
            continue
        kept.append(ln)
    # The last entry of the array needs a trailing comma before ours.
    last = kept[-1].rstrip()
    if not last.endswith(","):
        last += ","
    kept[-1] = last
    kept.append(LINE)
    out = "\n".join(kept) + "\n" + tail
    if not out.endswith("\n"):
        out += "\n"
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(out)
    count = sum(1 for ln in kept if ln.strip().startswith('{"name"'))
    print("  %s -> %d plugins (removed %d old)" % (path, count, removed))


for rel in ("Monline-MV/js/plugins.js", "mv_project/js/plugins.js"):
    p = os.path.join(ROOT, rel)
    if os.path.exists(p):
        print(rel)
        patch(p)
    else:
        print("MISSING %s" % rel)
        sys.exit(1)
