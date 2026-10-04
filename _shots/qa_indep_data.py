#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QA independent ground-truth recomputation for Scene_LearnSkill.
Written from scratch by QA (Edward) -- deliberately does NOT reuse the
engineer's parsing code, so that a shared parsing bug cannot hide.
"""
import json, re, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "Monline-MV", "data")


def load(name):
    p = os.path.join(DATA, name)
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


classes = load("Classes.json")
skills = load("Skills.json")
system = load("System.json")

print("=== System.skillTypes ===")
st = system.get("skillTypes")
for i, s in enumerate(st):
    if s:
        print("  [%d] %s" % (i, s))
print("  total entries:", len(st))

# ---------------------------------------------------------------- classes
# ground truth: all <learn skills: ...> tags per class, accumulated, dedup, id>0
TAG_RE = re.compile(r"<learn\s+skills\s*:\s*([^>]*)>", re.IGNORECASE)

per_class = {}
for c in classes:
    if not c:
        continue
    note = c.get("note") or ""
    ids = []
    for m in TAG_RE.finditer(note):
        for tok in m.group(1).split(","):
            tok = tok.strip()
            if not tok:
                continue
            try:
                v = int(tok)
            except ValueError:
                continue
            if v > 0:
                ids.append(v)
    per_class[c["id"]] = {
        "name": c.get("name"),
        "tags": len(TAG_RE.findall(note)),
        "raw": ids,
        "uniq": sorted(set(ids)),
    }

print("\n=== classes with <learn skills:> tags ===")
total = 0
for cid in sorted(per_class):
    d = per_class[cid]
    if not d["raw"]:
        continue
    total += len(d["uniq"])
    dupes = len(d["raw"]) - len(d["uniq"])
    print("  class %-3d %-16s tags=%d raw=%d uniq=%d dupes=%d"
          % (cid, d["name"], d["tags"], len(d["raw"]), len(d["uniq"]), dupes))
print("  TOTAL learnable entries (deduped):", total)

# stype distribution per class
skill_by_id = {}
for s in skills:
    if s:
        skill_by_id[s["id"]] = s

EXPECT = {
    1: {1: 23, 2: 29, 3: 78},
    3: {1: 33, 2: 19, 6: 14},
    6: {1: 28, 2: 20, 5: 5},
    10: {2: 7, 4: 5},
    12: {1: 8, 2: 7},
    13: {1: 13, 2: 4},
    18: {1: 6, 2: 1},
    21: {9: 9},
}
EXPECT_COUNT = {1: 130, 3: 66, 6: 53, 10: 12, 12: 15, 13: 17, 18: 7, 21: 9}

print("\n=== stype distribution per class (independent) ===")
bad = 0
for cid in sorted(EXPECT_COUNT):
    d = per_class.get(cid)
    if d is None:
        print("  class %d MISSING" % cid)
        bad += 1
        continue
    dist = collections.Counter()
    unknown_ref = []
    for sid in d["uniq"]:
        sk = skill_by_id.get(sid)
        if sk is None:
            unknown_ref.append(sid)
            continue
        dist[sk.get("stypeId")] += 1
    ok_cnt = (len(d["uniq"]) == EXPECT_COUNT[cid])
    ok_dist = (dict(dist) == EXPECT[cid])
    if not ok_cnt or not ok_dist:
        bad += 1
    print("  class %-3d %-16s count=%-4d expect=%-4d %s | dist=%s expect=%s %s | dangling=%s"
          % (cid, d["name"], len(d["uniq"]), EXPECT_COUNT[cid],
             "OK" if ok_cnt else "MISMATCH",
             dict(sorted(dist.items())), EXPECT[cid],
             "OK" if ok_dist else "MISMATCH",
             unknown_ref if unknown_ref else "none"))

# classes WITHOUT learn tags
print("\n=== classes with NO <learn skills:> ===")
no_tag = [cid for cid in sorted(per_class) if not per_class[cid]["raw"]]
print("  count:", len(no_tag), "ids:", no_tag[:40], "..." if len(no_tag) > 40 else "")

# ---------------------------------------------------------------- skills
COST_RE = re.compile(r"<learn\s+cost\s*:\s*([^>]*)>", re.IGNORECASE)
REQ_RE = re.compile(r"<learn\s+require\s+([a-z]+)\s*:\s*([^>]*)>", re.IGNORECASE)

n_cost = 0
n_req = 0
req_kinds = collections.Counter()
req_examples = collections.defaultdict(list)
cost_examples = []
non_jp = collections.Counter()
for s in skills:
    if not s:
        continue
    note = s.get("note") or ""
    cm = COST_RE.search(note)
    if cm:
        n_cost += 1
        body = cm.group(1).strip()
        parts = body.split()
        cur = parts[1].lower() if len(parts) > 1 else "jp"
        non_jp[cur] += 1
        if len(cost_examples) < 5:
            cost_examples.append((s["id"], s.get("name"), body))
    rms = REQ_RE.findall(note)
    if rms:
        n_req += 1
    for kind, val in rms:
        req_kinds[kind.lower()] += 1
        if len(req_examples[kind.lower()]) < 3:
            req_examples[kind.lower()].append((s["id"], s.get("name"), val.strip()))

print("\n=== skills ===")
print("  with <learn cost:>      :", n_cost)
print("  with <learn require*>:  :", n_req)
print("  require kind distribution:", dict(req_kinds))
for k, v in req_examples.items():
    print("    %-8s e.g. %s" % (k, v))
print("  cost currency distribution:", dict(non_jp))
print("  cost examples:", cost_examples)

# sample checks
print("\n=== sample skills ===")
for sid in (3, 11):
    sk = skill_by_id.get(sid)
    if sk:
        print("  skill %d %-20s stype=%d note=%r" % (sid, sk.get("name"), sk.get("stypeId"), sk.get("note")))

print("\nBAD COUNT:", bad)
sys.exit(1 if bad else 0)
