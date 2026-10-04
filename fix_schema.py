# -*- coding: utf-8 -*-
"""Close the remaining MV-schema gaps found by ``schema_check.py``.

``schema_check.py`` compares the converted database against RPG Maker MV's own
NewData sample project and reported 16 keys that MV expects but the conversion
never produced.  Every earlier crash in this port was exactly this species of
bug (``terms.messages``, ``traits``, ``graphic`` -> ``image``), so they are all
fixed here in one place:

===================  ==========================================  ==========
file                 problem                                     severity
===================  ==========================================  ==========
Troops.json          ``pages[].condition`` must be ``conditions``  **CRASH**
States.json          missing ``motion`` / ``overlay``            cosmetic
Actors.json          missing ``profile`` (VX Ace ``description``) cosmetic
Actors.json          missing ``battlerName``                     unused
System / Map / Anim  audio objects missing ``pan``               guarded
===================  ==========================================  ==========

Only the first one stops the game:

    Game_Troop.meetsConditions = function(page) {
        var c = page.conditions;          // undefined -> TypeError
        if (!c.turnEnding && ...) ...

which is reached from ``BattleManager.updateEventMain`` the moment a battle
starts, i.e. every single fight froze.

The rest are grouped here because they are pure "make the data match the
schema" work with no behavioural risk.

Usage:
    python fix_schema.py                 # repair ./Monline-MV and ./mv_project
    python fix_schema.py --dry-run
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PROJECTS = [os.path.join(HERE, "Monline-MV"),
                    os.path.join(HERE, "mv_project")]

# MV's own defaults for the fields VX Ace does not model at all.
AUDIO_KEYS = ("titleBgm", "battleBgm", "victoryMe", "defeatMe", "gameoverMe")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def fix_audio_obj(a):
    """Give an MV audio object the shape the editor writes."""
    if not isinstance(a, dict):
        return 0
    n = 0
    for k, v in (("pan", 0), ("pitch", 100), ("volume", 90), ("name", "")):
        if k not in a:
            a[k] = v
            n += 1
    return n


# ---------------------------------------------------------------------------
# 1) Troops: condition -> conditions      *** the crash ***
# ---------------------------------------------------------------------------
def fix_troops(project, dry):
    path = os.path.join(project, "data", "Troops.json")
    if not os.path.isfile(path):
        return "skip"
    data = load(path)
    renamed = 0
    pages = 0
    for troop in data:
        if not isinstance(troop, dict):
            continue
        for page in (troop.get("pages") or []):
            if not isinstance(page, dict):
                continue
            pages += 1
            if "condition" in page and "conditions" not in page:
                cond = page.pop("condition")
                # VX Ace names its keys the same way MV does, with one
                # exception: the converter already emitted `actorId`, which is
                # also what MV's NewData uses, so only the wrapper is wrong.
                page["conditions"] = cond if isinstance(cond, dict) else {}
                renamed += 1
            elif "conditions" not in page:
                page["conditions"] = default_conditions()
                renamed += 1
    if renamed and not dry:
        save(path, data)
    return "pages=%d, renamed condition->conditions on %d page(s)" % (pages, renamed)


def default_conditions():
    return {
        "turnEnding": False, "turnValid": False, "turnA": 1, "turnB": 1,
        "enemyValid": False, "enemyIndex": 0, "enemyHp": 0,
        "actorValid": False, "actorId": 1, "actorHp": 0,
        "switchValid": False, "switchId": 1
    }


# ---------------------------------------------------------------------------
# 2) States: motion / overlay
# ---------------------------------------------------------------------------
def fix_states(project, dry):
    path = os.path.join(project, "data", "States.json")
    if not os.path.isfile(path):
        return "skip"
    data = load(path)
    n = 0
    for st in data:
        if not isinstance(st, dict):
            continue
        # VX Ace has no per-state motion/overlay field at all (verified against
        # States.rvdata2), so MV's "normal / none" default is the faithful value.
        for k, v in (("motion", 0), ("overlay", 0)):
            if k not in st:
                st[k] = v
                n += 1
    if n and not dry:
        save(path, data)
    return "added %d field(s)" % n


# ---------------------------------------------------------------------------
# 3) Actors: profile <- description, battlerName
# ---------------------------------------------------------------------------
def fix_actors(project, dry):
    path = os.path.join(project, "data", "Actors.json")
    if not os.path.isfile(path):
        return "skip"
    data = load(path)
    prof = 0
    bn = 0
    for ac in data:
        if not isinstance(ac, dict):
            continue
        if "profile" not in ac:
            # VX Ace called this @description; MV shows it on the status screen
            # via Window_Status -> $gameActors.actor(n).profile().
            ac["profile"] = ac.get("description", "") or ""
            prof += 1
        if "battlerName" not in ac:
            # Only used by side-view battles (System.optSideView = false here).
            ac["battlerName"] = ""
            bn += 1
    if (prof or bn) and not dry:
        save(path, data)
    return "profile for %d actor(s), battlerName for %d" % (prof, bn)


# ---------------------------------------------------------------------------
# 4) Audio objects: pan (guarded by MV, but keep the schema clean)
# ---------------------------------------------------------------------------
def fix_audio(project, dry):
    touched = 0
    fields = 0

    sys_path = os.path.join(project, "data", "System.json")
    if os.path.isfile(sys_path):
        s = load(sys_path)
        n = 0
        for k in AUDIO_KEYS:
            if k in s:
                n += fix_audio_obj(s[k])
        for veh in ("boat", "ship", "airship"):
            v = s.get(veh)
            if isinstance(v, dict):
                n += fix_audio_obj(v.get("bgm"))
                n += fix_audio_obj(v.get("bgs"))
        if isinstance(s.get("sounds"), list):
            for a in s["sounds"]:
                n += fix_audio_obj(a)
        if n:
            if not dry:
                save(sys_path, s)
            touched += 1
            fields += n

    # Map audio + animation timing SEs
    for pattern, kind in ((os.path.join(project, "data", "Map*.json"), "map"),
                          (os.path.join(project, "data", "Animations.json"), "anim")):
        for path in sorted(glob.glob(pattern)):
            base = os.path.basename(path)
            if base == "MapInfos.json":
                continue
            try:
                d = load(path)
            except Exception:
                continue
            n = 0
            if kind == "map":
                if not isinstance(d, dict):
                    continue
                for k in ("bgm", "bgs"):
                    n += fix_audio_obj(d.get(k))
            else:
                for an in d:
                    if not isinstance(an, dict):
                        continue
                    for t in (an.get("timings") or []):
                        if isinstance(t, dict):
                            n += fix_audio_obj(t.get("se"))
            if n:
                if not dry:
                    save(path, d)
                touched += 1
                fields += n

    return "%d file(s), %d field(s)" % (touched, fields)


# ---------------------------------------------------------------------------
# 5) Animations: timings[].condition -> conditions  (a plain integer in MV;
#    read only by the animation editor, never by the runtime)
# ---------------------------------------------------------------------------
def fix_animation_timings(project, dry):
    path = os.path.join(project, "data", "Animations.json")
    if not os.path.isfile(path):
        return "skip"
    data = load(path)
    n = 0
    for an in data:
        if not isinstance(an, dict):
            continue
        for t in (an.get("timings") or []):
            if not isinstance(t, dict):
                continue
            if "condition" in t and "conditions" not in t:
                t["conditions"] = t.pop("condition")
                n += 1
    if n and not dry:
        save(path, data)
    return "renamed condition->conditions on %d timing(s)" % n


# ---------------------------------------------------------------------------
def run(project, dry):
    print("=== %s ===" % project)
    print("  Troops    : " + fix_troops(project, dry))
    print("  States    : " + fix_states(project, dry))
    print("  Actors    : " + fix_actors(project, dry))
    print("  Anim time : " + fix_animation_timings(project, dry))
    print("  Audio pan : " + fix_audio(project, dry))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--project", action="append")
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
