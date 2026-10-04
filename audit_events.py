#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Compare every map's events against the source `.rvdata2`, field by field.

This exists because "many events are missing" was reported after a play test,
and a runtime probe only covers the maps a smoke walk happens to visit.  The
authoritative comparison is against the source archive: `vxace_data_backup/`
holds the un-decoded `.rvdata2` files, and `fixreader.py` is the parser that
already rebuilt Tables for `fix_tables.py`, so the two sides are read with the
same vocabulary.

What it checks, per map and per event:

  * presence            - every source event id exists in the converted file,
                          and no converted event id is invented
  * position            - x / y
  * size                - page count and total command count per page
  * sprite              - every page's `@character_name` + `@character_index`
                          + `@tile_id`.  This is what makes an event *look*
                          wrong on screen: a sprite that points at the wrong
                          file or the wrong cell in the sheet renders as a
                          different character with no error anywhere.
  * trigger/priority    - the two flags that decide whether an event runs at all

It does not compare command bodies (that is `static_check`'s job); it compares
the structure that decides what exists and what it looks like.

Usage:  python audit_events.py [--limit N]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fixreader import load_fix, obj_attrs            # noqa: E402

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(SCRIPT_DIR, "vxace_data_backup")
DST = os.path.join(SCRIPT_DIR, "Monline-MV", "data")


def src_map(path):
    obj = load_fix(open(path, "rb").read())
    a = obj_attrs(obj)
    events = a.get("@events") or []
    out = {}
    if isinstance(events, list):
        for idx, ev in enumerate(events):
            if not ev:
                continue
            ea = obj_attrs(ev)
            out[idx] = ev
    elif isinstance(events, dict):
        for k, ev in events.items():
            if ev:
                out[int(k)] = ev
    return a, out


def page_image(page):
    """The event page's graphic.

    VX Ace calls it `@graphic` (`RPG::Event::Page::Graphic`); MV calls it
    `image`, which is what `fix_pageimage.py` renames it to.  Reading `@image`
    off the source yields None for *every* page, which silently reported ~14k
    bogus "sprite mismatches" until this was caught by grepping the raw
    `.rvdata2` bytes for a sprite name that was supposedly absent.
    """
    pa = obj_attrs(page)
    img = pa.get("@graphic")
    if img is None:
        img = pa.get("@image")
    if img is None:
        return {}
    return obj_attrs(img) if hasattr(img, "attributes") else (img or {})


def event_summary(ev):
    ea = obj_attrs(ev)
    pages = []
    for pg in (ea.get("@pages") or []):
        pa = obj_attrs(pg)
        ia = page_image(pg)
        pages.append({
            "characterName": ia.get("@character_name") or "",
            "characterIndex": int(ia.get("@character_index") or 0),
            "tileId": int(ia.get("@tile_id") or 0),
            "commands": len(pa.get("@list") or []),
            "trigger": int(pa.get("@trigger") or 0),
            "priorityType": int(pa.get("@priority_type") or 0),
        })
    return {
        "x": int(ea.get("@x") or 0),
        "y": int(ea.get("@y") or 0),
        "name": ea.get("@name") or "",
        "pages": pages,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only check N maps")
    args = ap.parse_args()

    names = sorted(f for f in os.listdir(SRC)
                   if f.startswith("Map") and f.endswith(".rvdata2")
                   and f[3:-len(".rvdata2")].isdigit())
    if args.limit:
        names = names[:args.limit]

    missing_events = 0
    extra_events = 0
    page_mismatch = 0
    cmd_mismatch = 0
    sprite_mismatch = 0
    pos_mismatch = 0
    maps_with_problems = []
    detail = []

    for fn in names:
        map_id = int(fn[3:-len(".rvdata2")])
        dst_path = os.path.join(DST, "Map%03d.json" % map_id)
        if not os.path.isfile(dst_path):
            print("!! converted file missing: %s" % dst_path)
            continue
        with open(dst_path, encoding="utf-8") as f:
            dst = json.load(f)

        src_info, src_events = src_map(os.path.join(SRC, fn))
        dst_events = dst.get("events") or []
        dst_by_id = {e["id"]: e for e in dst_events if e}

        problems = []

        for eid in sorted(src_events):
            if eid not in dst_by_id:
                missing_events += 1
                problems.append("event %d (%s) MISSING" % (eid, event_summary(src_events[eid])["name"]))
                continue
            s = event_summary(src_events[eid])
            d = dst_by_id[eid]
            if (s["x"], s["y"]) != (d.get("x"), d.get("y")):
                pos_mismatch += 1
                problems.append("event %d position %s -> %s" % (eid, (s["x"], s["y"]), (d.get("x"), d.get("y"))))
            if len(s["pages"]) != len(d.get("pages") or []):
                page_mismatch += 1
                problems.append("event %d pages %d -> %d" % (eid, len(s["pages"]), len(d.get("pages") or [])))
                continue
            for pi, (sp, dp) in enumerate(zip(s["pages"], d.get("pages") or [])):
                di = dp.get("image") or {}
                got = (di.get("characterName") or "", int(di.get("characterIndex") or 0), int(di.get("tileId") or 0))
                want = (sp["characterName"], sp["characterIndex"], sp["tileId"])
                if got != want:
                    sprite_mismatch += 1
                    problems.append("event %d page %d sprite %s -> %s" % (eid, pi, want, got))
                if sp["commands"] != len(dp.get("list") or []):
                    cmd_mismatch += 1
                    problems.append("event %d page %d commands %d -> %d"
                                    % (eid, pi, sp["commands"], len(dp.get("list") or [])))
                if (sp["trigger"], sp["priorityType"]) != (int(dp.get("trigger") or 0), int(dp.get("priorityType") or 0)):
                    problems.append("event %d page %d trigger/priority %s -> %s"
                                    % (eid, pi, (sp["trigger"], sp["priorityType"]),
                                       (dp.get("trigger"), dp.get("priorityType"))))

        for eid in dst_by_id:
            if eid not in src_events:
                extra_events += 1
                problems.append("event %d is NOT in the source" % eid)

        if problems:
            maps_with_problems.append((map_id, problems))
            for p in problems[:4]:
                detail.append("Map%03d  %s" % (map_id, p))

    print("maps compared            : %d" % len(names))
    print("missing events           : %d" % missing_events)
    print("invented events          : %d" % extra_events)
    print("position mismatches      : %d" % pos_mismatch)
    print("page-count mismatches    : %d" % page_mismatch)
    print("command-count mismatches : %d" % cmd_mismatch)
    print("sprite mismatches        : %d   <-- wrong on-screen character" % sprite_mismatch)
    print("maps with problems       : %d" % len(maps_with_problems))
    if detail:
        print("\n--- first findings ---")
        for line in detail[:40]:
            print("  " + line)
    worst = sorted(maps_with_problems, key=lambda kv: -len(kv[1]))[:12]
    if worst:
        print("\n--- maps by problem count ---")
        for map_id, problems in worst:
            print("  Map%03d : %d" % (map_id, len(problems)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
